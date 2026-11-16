package simulator

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

var registration = regexp.MustCompile(`\bTypeId\b\s*(?:[A-Za-z_]\w*\s*)?[({]\s*"(ns3::[A-Za-z0-9_:]+)"\s*[)}]`)

// Keep quoted literals, strip comments and C++ raw strings before matching declarations.
func registeredTypes(code string) []string {
	var out strings.Builder
	for i := 0; i < len(code); {
		if strings.HasPrefix(code[i:], "//") {
			end := strings.IndexByte(code[i:], '\n')
			if end < 0 {
				break
			}
			i += end
			out.WriteByte(' ')
			continue
		}
		if strings.HasPrefix(code[i:], "/*") {
			end := strings.Index(code[i+2:], "*/")
			if end < 0 {
				break
			}
			i += end + 4
			out.WriteByte(' ')
			continue
		}
		if strings.HasPrefix(code[i:], `R"`) {
			open := strings.IndexByte(code[i+2:], '(')
			if open >= 0 && open <= 16 {
				delimiter := code[i+2 : i+2+open]
				close := ")" + delimiter + `"`
				end := strings.Index(code[i+3+open:], close)
				if end >= 0 {
					i += 3 + open + end + len(close)
					out.WriteByte(' ')
					continue
				}
			}
		}
		if code[i] == '"' || code[i] == '\'' {
			quote := code[i]
			start := i
			i++
			for i < len(code) {
				if code[i] == '\\' {
					i += 2
					continue
				}
				if code[i] == quote {
					i++
					break
				}
				i++
			}
			if i > len(code) {
				i = len(code)
			}
			if quote == '"' {
				out.WriteString(code[start:i])
			} else {
				out.WriteByte(' ')
			}
			continue
		}
		out.WriteByte(code[i])
		i++
	}
	matches := registration.FindAllStringSubmatch(out.String(), -1)
	values := []string{}
	for _, m := range matches {
		values = append(values, m[1])
	}
	return values
}
func contains(values []string, value string) bool {
	for _, v := range values {
		if v == value {
			return true
		}
	}
	return false
}
func readSource(file string) (string, error) {
	info, e := os.Lstat(file)
	if e != nil {
		return "", e
	}
	if !info.Mode().IsRegular() {
		return "", errors.New("只能读取普通源码文件")
	}
	if info.Size() > 1_000_000 {
		return "", errors.New("源码文件超过 1 MB")
	}
	f, e := os.Open(file)
	if e != nil {
		return "", e
	}
	defer f.Close()
	b, e := io.ReadAll(io.LimitReader(f, 1_000_001))
	if e != nil {
		return "", e
	}
	if len(b) > 1_000_000 {
		return "", errors.New("源码文件超过 1 MB")
	}
	return string(b), nil
}
func (s *Service) source(w http.ResponseWriter, home string, req map[string]any) {
	typeID, ok := req["typeId"].(string)
	if !ok || len(typeID) > 256 || !typeIDPattern.MatchString(typeID) {
		fail(w, 400, errors.New("缺少有效的协议 TypeId"))
		return
	}
	selected := ""
	if raw, exists := req["path"]; exists {
		var ok bool
		selected, ok = raw.(string)
		if !ok {
			fail(w, 400, errors.New("源码路径必须是字符串"))
			return
		}
	}
	if selected != "" && (len(selected) > 1024 || strings.ContainsAny(selected, "\\\x00") || filepath.ToSlash(filepath.Clean(selected)) != selected) {
		fail(w, 403, errors.New("只能查看关联源码"))
		return
	}
	value, e := engineCall("sources")
	if e != nil {
		fail(w, 500, e)
		return
	}
	b, _ := json.Marshal(value.Export())
	var builtins []struct {
		Path string `json:"path"`
		Code string `json:"code"`
	}
	_ = json.Unmarshal(b, &builtins)
	for _, item := range builtins {
		if contains(registeredTypes(item.Code), typeID) {
			if selected != "" && selected != item.Path {
				fail(w, 403, errors.New("只能查看当前协议关联源码"))
				return
			}
			reply(w, 200, response{"ok": true, "typeId": typeID, "files": []response{{"path": item.Path, "language": "cpp"}}, "selectedPath": item.Path, "code": item.Code})
			return
		}
	}
	module := filepath.Join(home, "src", "aqua-sim-tg")
	for _, dir := range []string{filepath.Join(home, "src"), module} {
		info, e := os.Lstat(dir)
		if e != nil || info.Mode()&os.ModeSymlink != 0 {
			fail(w, 403, errors.New("协议目录不能使用符号链接"))
			return
		}
	}
	candidates := map[string]string{}
	count, bytes := 0, 0
	e = filepath.WalkDir(module, func(file string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		count++
		if count > 4096 {
			return errors.New("协议源码条目过多")
		}
		relative, _ := filepath.Rel(module, file)
		if strings.Count(relative, string(os.PathSeparator)) > 32 {
			return errors.New("协议源码层级过深")
		}
		if d.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if d.IsDir() {
			return nil
		}
		ext := filepath.Ext(file)
		if ext != ".cc" && ext != ".cpp" && ext != ".cxx" {
			return nil
		}
		code, e := readSource(file)
		if e != nil {
			return e
		}
		bytes += len(code)
		if bytes > 32_000_000 {
			return errors.New("协议源码总量超过 32 MB")
		}
		if contains(registeredTypes(code), typeID) {
			name := "src/aqua-sim-tg/" + filepath.ToSlash(relative)
			candidates[name] = code
			for _, suffix := range []string{".h", ".hpp", ".hxx"} {
				header := strings.TrimSuffix(file, ext) + suffix
				if info, e := os.Lstat(header); e == nil && info.Mode().IsRegular() {
					content, e := readSource(header)
					if e != nil {
						return e
					}
					bytes += len(content)
					if bytes > 32_000_000 {
						return errors.New("协议源码总量超过 32 MB")
					}
					candidates[strings.TrimSuffix(name, ext)+suffix] = content
				}
			}
		}
		return nil
	})
	if e != nil {
		fail(w, 400, e)
		return
	}
	if len(candidates) == 0 {
		fail(w, 404, fmt.Errorf("未找到 %s 的注册实现", typeID))
		return
	}
	paths := make([]string, 0, len(candidates))
	for key := range candidates {
		paths = append(paths, key)
	}
	sort.Strings(paths)
	if selected == "" {
		selected = paths[0]
		for _, name := range paths {
			if strings.HasSuffix(name, ".cc") || strings.HasSuffix(name, ".cpp") || strings.HasSuffix(name, ".cxx") {
				selected = name
				break
			}
		}
	}
	code, ok := candidates[selected]
	if !ok {
		fail(w, 403, errors.New("只能查看当前协议关联源码"))
		return
	}
	files := []response{}
	for _, file := range paths {
		files = append(files, response{"path": file, "language": "cpp"})
	}
	reply(w, 200, response{"ok": true, "typeId": typeID, "files": files, "selectedPath": selected, "code": code})
}
