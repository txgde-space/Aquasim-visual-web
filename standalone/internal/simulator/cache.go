package simulator

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type snapshot struct {
	Version             int
	Home, Input, Output string
	Catalog             json.RawMessage
}

func cacheFile(home string) string {
	root := os.Getenv("AQUASIM_CACHE_DIR")
	if root == "" {
		var e error
		root, e = os.UserCacheDir()
		if e != nil {
			return ""
		}
	}
	sum := sha256.Sum256([]byte(home))
	return filepath.Join(root, "aquasim-standalone", "builds", hex.EncodeToString(sum[:])+".json")
}
func forgetCache(home string) {
	file := cacheFile(home)
	if file != "" {
		_ = os.Remove(file)
	}
}
func inputSignature(home string) (string, error) {
	hash := sha256.New()
	_, _ = io.WriteString(hash, engineSource)
	for _, entry := range []string{"CMakeLists.txt", "VERSION", ".ns3rc", "src", "contrib", "scratch", "examples", "utils", "bindings", "build-support"} {
		root := filepath.Join(home, entry)
		if _, e := os.Stat(root); os.IsNotExist(e) {
			_, _ = io.WriteString(hash, root+":missing")
			continue
		}
		e := filepath.WalkDir(root, func(file string, d os.DirEntry, e error) error {
			if e != nil {
				return e
			}
			if d.IsDir() {
				if d.Name() == ".git" || d.Name() == "node_modules" || d.Name() == "__pycache__" {
					return filepath.SkipDir
				}
				return nil
			}
			if filepath.Dir(file) == filepath.Join(home, "scratch") && strings.HasPrefix(d.Name(), "aqua-visual-") && strings.HasSuffix(d.Name(), ".cc") {
				return nil
			}
			if d.Type()&os.ModeSymlink != 0 {
				return fmt.Errorf("存在符号链接输入，不复用构建：%s", file)
			}
			_, _ = io.WriteString(hash, file+"\x00")
			f, e := os.Open(file)
			if e != nil {
				return e
			}
			defer f.Close()
			_, e = io.Copy(hash, f)
			return e
		})
		if e != nil {
			return "", e
		}
	}
	cache := configured(home)
	if cache == "" {
		return "", fmt.Errorf("not configured")
	}
	b, e := os.ReadFile(filepath.Join(cache, "CMakeCache.txt"))
	if e != nil {
		return "", e
	}
	for _, line := range strings.Split(string(b), "\n") {
		// Generated scratch targets are deliberately ephemeral. User configuration is retained.
		if strings.Contains(line, "aqua-visual-") || strings.HasPrefix(line, "//") || strings.HasPrefix(line, "#") {
			continue
		}
		_, _ = io.WriteString(hash, line+"\n")
		if strings.HasPrefix(line, "CMAKE_CXX_COMPILER:FILEPATH=") || strings.HasPrefix(line, "CMAKE_C_COMPILER:FILEPATH=") {
			file := strings.SplitN(line, "=", 2)[1]
			info, e := os.Stat(file)
			if e != nil {
				return "", e
			}
			_, _ = fmt.Fprintf(hash, "%s:%d:%d", file, info.Size(), info.ModTime().UnixNano())
		}
	}
	for _, key := range []string{"PATH", "CC", "CXX", "CFLAGS", "CXXFLAGS", "CPPFLAGS", "LDFLAGS", "SDKROOT", "DEVELOPER_DIR", "CMAKE_PREFIX_PATH"} {
		_, _ = io.WriteString(hash, key+"="+os.Getenv(key)+"\x00")
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}
func outputSignature(home string) (string, error) {
	hash := sha256.New()
	dir := filepath.Join(home, "build", "lib")
	entries, e := os.ReadDir(dir)
	if e != nil {
		return "", e
	}
	count := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !(strings.Contains(name, ".so") || strings.HasSuffix(name, ".dylib") || strings.HasSuffix(name, ".dll") || strings.HasSuffix(name, ".a")) {
			continue
		}
		info, e := os.Stat(filepath.Join(dir, name))
		if e != nil {
			return "", e
		}
		_, _ = fmt.Fprintf(hash, "%s:%d:%d\x00", name, info.Size(), info.ModTime().UnixNano())
		count++
	}
	if count == 0 {
		return "", fmt.Errorf("no compiled libraries")
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}
func saveCache(home, before string, catalog json.RawMessage) {
	input, e := inputSignature(home)
	if e != nil || before == "" || input != before {
		return
	}
	output, e := outputSignature(home)
	if e != nil {
		return
	}
	file := cacheFile(home)
	if file == "" {
		return
	}
	b, e := json.Marshal(snapshot{1, home, input, output, catalog})
	if e != nil {
		return
	}
	if os.MkdirAll(filepath.Dir(file), 0700) != nil {
		return
	}
	temp, e := os.CreateTemp(filepath.Dir(file), "build-*.tmp")
	if e != nil {
		return
	}
	defer os.Remove(temp.Name())
	if _, e = temp.Write(b); e != nil {
		temp.Close()
		return
	}
	if temp.Close() != nil {
		return
	}
	_ = os.Rename(temp.Name(), file)
}
func loadCache(home string) json.RawMessage {
	b, e := os.ReadFile(cacheFile(home))
	if e != nil || len(b) > 16<<20 {
		return nil
	}
	var saved snapshot
	if json.Unmarshal(b, &saved) != nil || saved.Version != 1 || saved.Home != home || !json.Valid(saved.Catalog) {
		return nil
	}
	output, e := outputSignature(home)
	if e != nil || output != saved.Output {
		return nil
	}
	input, e := inputSignature(home)
	if e != nil || input != saved.Input {
		return nil
	}
	return saved.Catalog
}
