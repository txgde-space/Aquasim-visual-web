// Package simulator adapts the existing pure generator to a Go HTTP service.
// ns-3's Python launcher is never invoked. Simulation needs a native ns-3 build
// and a CMake/C++ toolchain; field telemetry/replay have no such dependency.
package simulator

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

type response map[string]any
type task struct {
	Kind string `json:"kind"`
	Home string `json:"home"`
}
type progress struct {
	Home      string `json:"home"`
	Phase     string `json:"phase"`
	Completed int    `json:"completed"`
	Total     int    `json:"total"`
}
type joinedBuild struct {
	done   chan struct{}
	status int
	body   []byte
}
type capturedResponse struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func (c *capturedResponse) Header() http.Header    { return c.header }
func (c *capturedResponse) WriteHeader(status int) { c.status = status }
func (c *capturedResponse) Write(b []byte) (int, error) {
	if c.status == 0 {
		c.status = 200
	}
	return c.body.Write(b)
}

type Service struct {
	ctx         context.Context
	cancel      context.CancelFunc
	closed      bool
	jobs        sync.WaitGroup
	defaultHome string
	mu          sync.Mutex
	active      *task
	joined      *joinedBuild
	progress    *progress
	runCommand  func(string, time.Duration, string, ...string) (string, error)
}

func New(defaultHome string) *Service {
	if defaultHome == "" {
		defaultHome = os.Getenv("AQUA_SIM_HOME")
	}
	if defaultHome == "" {
		defaultHome = "../aqua-sim-dev"
	}
	home, _ := filepath.Abs(defaultHome)
	ctx, cancel := context.WithCancel(context.Background())
	return &Service{defaultHome: home, ctx: ctx, cancel: cancel, runCommand: func(home string, timeout time.Duration, program string, args ...string) (string, error) {
		return command(ctx, home, timeout, program, args...)
	}}
}

// Close stops native subprocess groups and waits for their owning operations.
// HTTP client disconnects intentionally do not cancel a server-side experiment.
func (s *Service) Close() {
	s.mu.Lock()
	s.closed = true
	s.cancel()
	s.mu.Unlock()
	s.jobs.Wait()
}
func reply(w http.ResponseWriter, status int, data response) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
func fail(w http.ResponseWriter, status int, err error) {
	reply(w, status, response{"ok": false, "error": err.Error()})
}
func (s *Service) resolve(value any) (string, error) {
	text := ""
	if value != nil {
		var ok bool
		text, ok = value.(string)
		if !ok {
			return "", errors.New("仿真目录必须是字符串")
		}
	}
	text = strings.TrimSpace(text)
	if text == "" {
		text = s.defaultHome
	}
	if text == "~" || strings.HasPrefix(text, "~/") {
		h, e := os.UserHomeDir()
		if e != nil {
			return "", e
		}
		text = filepath.Join(h, strings.TrimPrefix(text, "~/"))
		if value == "~" {
			text = h
		}
	}
	home, e := filepath.Abs(text)
	if e != nil {
		return "", e
	}
	if real, e := filepath.EvalSymlinks(home); e == nil {
		home = real
	}
	return home, nil
}
func (s *Service) inspect(home string) response {
	result := response{"ok": true, "home": home, "defaultHome": s.defaultHome, "source": "standalone", "runtime": "go-native"}
	for _, name := range []string{"CMakeLists.txt", "src/aqua-sim-tg"} {
		if _, e := os.Stat(filepath.Join(home, name)); e != nil {
			result["ok"] = false
			result["error"] = "目录内缺少 " + name + "，请选择已有的 Aqua-Sim/ns-3 源码与构建目录"
			break
		}
	}
	return result
}
func (s *Service) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		fail(w, 405, errors.New("请使用 POST"))
		return
	}
	var req map[string]any
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1_000_000))
	if e := decoder.Decode(&req); e != nil || req == nil {
		fail(w, 400, errors.New("请求体必须是有效 JSON 对象（最多 1 MB）"))
		return
	}
	var trailing any
	if decoder.Decode(&trailing) != io.EOF {
		fail(w, 400, errors.New("请求体只能包含一个 JSON 对象"))
		return
	}
	home, e := s.resolve(req["aquaSimHome"])
	if e != nil {
		fail(w, 400, e)
		return
	}
	if r.URL.Path == "/api/simulator/directories" {
		s.directories(w, home)
		return
	}
	config := s.inspect(home)
	if config["ok"] != true {
		reply(w, 400, config)
		return
	}
	switch r.URL.Path {
	case "/api/simulator/check":
		s.mu.Lock()
		busy := s.active != nil
		s.mu.Unlock()
		var catalog json.RawMessage
		if !busy {
			catalog = loadCache(home)
		}
		config["catalog"] = catalog
		config["buildReusable"] = len(catalog) > 0
		reply(w, 200, config)
		return
	case "/api/simulator/build-progress":
		s.mu.Lock()
		defer s.mu.Unlock()
		var p *progress
		if s.progress != nil && s.progress.Home == home {
			copy := *s.progress
			p = &copy
		}
		reply(w, 200, response{"ok": true, "progress": p, "task": s.active})
		return
	case "/api/simulator/source":
		s.source(w, home, req)
		return
	}
	kind := ""
	switch r.URL.Path {
	case "/api/simulator/build":
		kind = "build"
	case "/api/simulator/clean":
		kind = "clean"
	case "/api/run":
		kind = "run"
	default:
		fail(w, 404, errors.New("未知仿真接口"))
		return
	}
	if kind == "run" {
		spec := req["spec"]
		if spec == nil {
			spec = req
		}
		if _, err := engineCall("preflight", spec); err != nil {
			fail(w, 400, err)
			return
		}
	}
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		fail(w, 503, errors.New("仿真服务正在关闭"))
		return
	}
	if s.active != nil {
		active := *s.active
		joined := s.joined
		if kind == "build" && active.Kind == "build" && active.Home == home && joined != nil {
			s.mu.Unlock()
			select {
			case <-r.Context().Done():
				return
			case <-joined.done:
			}
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			w.WriteHeader(joined.status)
			_, _ = w.Write(joined.body)
			return
		}
		s.mu.Unlock()
		reply(w, 409, response{"ok": false, "code": "SIMULATOR_BUSY", "error": "仿真环境正在使用，请稍后重试", "task": active})
		return
	}
	s.active = &task{kind, home}
	s.jobs.Add(1)
	if kind == "build" {
		s.joined = &joinedBuild{done: make(chan struct{})}
	}
	joined := s.joined
	s.mu.Unlock()
	defer func() { s.mu.Lock(); s.active = nil; s.mu.Unlock(); s.jobs.Done() }()
	if kind == "clean" {
		forgetCache(home)
		cache := configured(home)
		if cache == "" {
			fail(w, 400, errors.New("没有已配置的 CMake 构建目录"))
			return
		}
		out, err := s.runCommand(home, 3*time.Minute, "cmake", "--build", cache, "--target", "clean")
		if err != nil {
			reply(w, 500, response{"ok": false, "error": "清理失败，请查看输出", "stdout": out})
			return
		}
		s.setProgress(home, "", 0, 0)
		reply(w, 200, response{"ok": true, "home": home, "stdout": out})
		return
	}
	if kind == "build" {
		captured := &capturedResponse{header: make(http.Header)}
		s.build(captured, home)
		joined.status = captured.status
		joined.body = append([]byte(nil), captured.body.Bytes()...)
		close(joined.done)
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(joined.status)
		_, _ = w.Write(joined.body)
		return
	}
	spec := req["spec"]
	if spec == nil {
		spec = req
	}
	s.run(w, home, spec)
}
func (s *Service) setProgress(home, phase string, n, total int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if phase == "" {
		s.progress = nil
	} else {
		s.progress = &progress{home, phase, n, total}
	}
}
func configured(home string) string {
	entries, _ := os.ReadDir(home)
	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		dir := filepath.Join(home, entry.Name())
		b, e := os.ReadFile(filepath.Join(dir, "CMakeCache.txt"))
		if e == nil && strings.Contains(string(b), "build_profile:INTERNAL=") && strings.Contains(string(b), "CMAKE_GENERATOR:INTERNAL=") {
			return dir
		}
	}
	return ""
}
func (s *Service) configure(home string) (string, string, error) {
	cache := configured(home)
	if cache == "" {
		cache = filepath.Join(home, "cmake-cache")
	}
	out, e := s.runCommand(home, 15*time.Minute, "cmake", "-S", home, "-B", cache, "-DNS3_WARNINGS_AS_ERRORS=OFF")
	if e != nil {
		return cache, out, fmt.Errorf("CMake 配置失败；仿真需要预装的 CMake、C++ 工具链和 ns-3 依赖。真实试验与回放不需要这些依赖：%w", e)
	}
	return cache, out, nil
}
func identifier() string {
	b := make([]byte, 8)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func (s *Service) program(home, code string) (string, string, error) {
	name := "aqua-visual-" + identifier()
	source := filepath.Join(home, "scratch", name+".cc")
	if e := os.MkdirAll(filepath.Dir(source), 0755); e != nil {
		return "", "", e
	}
	if e := os.WriteFile(source, []byte(code), 0600); e != nil {
		return "", "", e
	}
	defer os.Remove(source)
	cache, out, e := s.configure(home)
	if e != nil {
		return "", out, e
	}
	built, e := s.runCommand(home, 15*time.Minute, "cmake", "--build", cache, "--target", "scratch_"+name, "--parallel", "2")
	out += built
	if e != nil {
		return "", out, fmt.Errorf("编译生成的实验程序失败：%w", e)
	}
	candidates, _ := filepath.Glob(filepath.Join(home, "build", "scratch", "*"+name+"*"))
	var executable string
	for _, file := range candidates {
		info, e := os.Stat(file)
		if e == nil && !info.IsDir() && (info.Mode()&0111 != 0 || strings.HasSuffix(file, ".exe")) {
			if executable != "" {
				return "", out, errors.New("发现多个实验程序，请清理构建后重试")
			}
			executable = file
		}
	}
	if executable == "" {
		return "", out, errors.New("构建成功但未找到 build/scratch 下的实验可执行程序")
	}
	ran, e := s.runCommand(home, 3*time.Minute, executable)
	out += ran
	return ran, out, e
}
func (s *Service) discover(home string) (json.RawMessage, string, error) {
	code, e := probeSource()
	if e != nil {
		return nil, "", e
	}
	ran, out, e := s.program(home, code)
	if e != nil {
		return nil, out, e
	}
	cat, e := parseCatalog(ran)
	return cat, out, e
}
func (s *Service) build(w http.ResponseWriter, home string) {
	forgetCache(home)
	s.setProgress(home, "configure", 0, 0)
	cache, out, e := s.configure(home)
	if e != nil {
		s.setProgress(home, "failed", 0, 0)
		reply(w, 500, response{"ok": false, "error": e.Error(), "stdout": out})
		return
	}
	before, _ := inputSignature(home)
	s.setProgress(home, "build", 0, 0)
	built, e := s.runCommand(home, 15*time.Minute, "cmake", "--build", cache, "--parallel", "2")
	out += built
	if e != nil {
		s.setProgress(home, "failed", 0, 0)
		reply(w, 500, response{"ok": false, "error": "预编译失败，请查看输出", "stdout": out})
		return
	}
	s.setProgress(home, "catalog", 0, 0)
	cat, probe, e := s.discover(home)
	out += probe
	if e != nil {
		s.setProgress(home, "failed", 0, 0)
		reply(w, 500, response{"ok": false, "error": "读取注册协议失败：" + e.Error(), "stdout": out})
		return
	}
	saveCache(home, before, cat)
	s.setProgress(home, "done", 1, 1)
	reply(w, 200, response{"ok": true, "home": home, "catalog": cat, "stdout": out})
}
func (s *Service) run(w http.ResponseWriter, home string, spec any) {
	catalog := loadCache(home)
	out := ""
	if len(catalog) == 0 {
		var e error
		catalog, out, e = s.discover(home)
		if e != nil {
			reply(w, 500, response{"ok": false, "error": "读取注册协议失败：" + e.Error(), "stdout": out})
			return
		}
	}
	logName := "net.aqua-visual-" + identifier() + ".json"
	code, e := generate(spec, catalog, logName)
	if e != nil {
		fail(w, 400, e)
		return
	}
	start := time.Now()
	_, runOut, e := s.program(home, code)
	out += runOut
	logText, actualName := collectLog(home, start, logName)
	result := response{"ok": e == nil, "stdout": out, "log": nil, "logName": actualName, "command": "CMake scratch build + native executable"}
	if logText != "" {
		result["log"] = logText
	}
	if e != nil {
		result["error"] = e.Error()
		reply(w, 500, result)
		return
	}
	reply(w, 200, result)
}
func collectLog(home string, start time.Time, wanted string) (string, string) {
	type hit struct {
		file     string
		modified time.Time
	}
	var hits []hit
	for _, dir := range []string{home, filepath.Join(home, "scratch")} {
		entries, _ := os.ReadDir(dir)
		for _, entry := range entries {
			name := entry.Name()
			if entry.IsDir() || !strings.HasPrefix(name, "net.") || (strings.HasPrefix(name, "net.aqua-visual-") && name != wanted) {
				continue
			}
			info, e := entry.Info()
			if e == nil && info.ModTime().After(start) && info.Size() <= 64<<20 {
				hits = append(hits, hit{filepath.Join(dir, name), info.ModTime()})
			}
		}
	}
	sort.Slice(hits, func(i, j int) bool {
		a, b := filepath.Base(hits[i].file) == wanted, filepath.Base(hits[j].file) == wanted
		if a != b {
			return a
		}
		return hits[i].modified.After(hits[j].modified)
	})
	for _, h := range hits {
		b, e := os.ReadFile(h.file)
		if e != nil {
			continue
		}
		if filepath.Base(h.file) == wanted && len(hits) > 1 {
			var data struct {
				Packets   []any `json:"packets"`
				Movements []any `json:"movements"`
			}
			if json.Unmarshal(b, &data) != nil || (len(data.Packets) == 0 && len(data.Movements) == 0) {
				continue
			}
		}
		return string(b), filepath.Base(h.file)
	}
	return "", ""
}
func (s *Service) directories(w http.ResponseWriter, home string) {
	entries, e := os.ReadDir(home)
	if e != nil {
		fail(w, 400, fmt.Errorf("无法浏览目录：%w", e))
		return
	}
	dirs := []response{}
	for _, entry := range entries {
		if info, e := os.Stat(filepath.Join(home, entry.Name())); e == nil && info.IsDir() {
			dirs = append(dirs, response{"name": entry.Name(), "path": filepath.Join(home, entry.Name())})
		}
	}
	var parent any = filepath.Dir(home)
	if parent == home {
		parent = nil
	}
	reply(w, 200, response{"ok": true, "home": home, "parent": parent, "directories": dirs, "simulator": s.inspect(home)})
}

type tailBuffer struct {
	mu sync.Mutex
	b  []byte
}

func (t *tailBuffer) Write(b []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.b = append(t.b, b...)
	if len(t.b) > 400000 {
		t.b = append([]byte(nil), t.b[len(t.b)-200000:]...)
	}
	return len(b), nil
}
func command(parent context.Context, home string, timeout time.Duration, program string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, program, args...)
	configureProcess(cmd)
	cmd.Dir = home
	cmd.WaitDelay = 5 * time.Second
	cmd.Env = os.Environ()
	for _, key := range []string{"LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"} {
		cmd.Env = append(cmd.Env, key+"="+filepath.Join(home, "build", "lib")+string(os.PathListSeparator)+os.Getenv(key))
	}
	var output tailBuffer
	cmd.Stdout = &output
	cmd.Stderr = &output
	e := cmd.Run()
	if e != nil {
		_, _ = output.Write([]byte("\n" + e.Error()))
	}
	return string(output.b), e
}

var typeIDPattern = regexp.MustCompile(`^ns3::[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*$`)
