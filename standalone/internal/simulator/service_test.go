package simulator

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const catalogRows = `[{"layer":"phy","typeId":"ns3::FixturePhy","attributes":[]},{"layer":"mac","typeId":"ns3::FixtureMac","attributes":[]},{"layer":"routing","typeId":"ns3::FixtureRoute","attributes":[]},{"layer":"channel","typeId":"ns3::FixtureChannel","attributes":[]},{"layer":"propagation","typeId":"ns3::FixturePropagation","attributes":[]}]`

func fixtureSpec() any {
	var v any
	_ = json.Unmarshal([]byte(`{"schema":"aqua-sim-experiment/v0","simStop":"3s","channel":{"type":"ns3::FixtureChannel","propagation":"ns3::FixturePropagation"},"stack":{"phy":{"type":"ns3::FixturePhy","attrs":{}},"mac":{"type":"ns3::FixtureMac","attrs":{}},"routing":{"type":"ns3::FixtureRoute"}},"traffic":{"preset":"none"},"nodes":[{"id":1,"x":0,"y":0,"z":0,"name":"A","role":"node","app":""},{"id":2,"x":1,"y":0,"z":0,"name":"B","role":"node","app":""}]}`), &v)
	return v
}
func catalogOutput() string {
	return "native output\nAQUASIM_CATALOG_BEGIN\n" + catalogRows + "\nAQUASIM_CATALOG_END"
}
func TestSharedGenerator(t *testing.T) {
	probe, e := probeSource()
	if e != nil {
		t.Fatal(e)
	}
	if !strings.Contains(probe, "AQUASIM_CATALOG_BEGIN") {
		t.Fatal("missing real probe")
	}
	cat, e := parseCatalog(catalogOutput())
	if e != nil {
		t.Fatal(e)
	}
	code, e := generate(fixtureSpec(), cat, "net.fixture.json")
	if e != nil {
		t.Fatal(e)
	}
	for _, value := range []string{"ns3::FixturePhy", "ns3::FixtureMac", "net.fixture.json"} {
		if !strings.Contains(code, value) {
			t.Fatal("missing", value)
		}
	}
	spec := fixtureSpec().(map[string]any)
	spec["simStop"] = "invalid"
	if _, e = generate(spec, cat, "x"); e == nil {
		t.Fatal("invalid time accepted")
	}
	spec = fixtureSpec().(map[string]any)
	spec["stack"].(map[string]any)["phy"].(map[string]any)["type"] = "ns3::Unregistered"
	if _, e = generate(spec, cat, "x"); e == nil {
		t.Fatal("unregistered protocol accepted")
	}
	if _, e = parseCatalog("AQUASIM_CATALOG_BEGIN [] AQUASIM_CATALOG_END"); e == nil {
		t.Fatal("empty catalog accepted")
	}
}
func testHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	for _, dir := range []string{"src/aqua-sim-tg", "scratch", "build/lib", "build/scratch", "cmake-cache"} {
		if e := os.MkdirAll(filepath.Join(home, dir), 0755); e != nil {
			t.Fatal(e)
		}
	}
	for file, content := range map[string]string{"CMakeLists.txt": "project(test)", "src/aqua-sim-tg/fixture.cc": "void input() {}", "cmake-cache/CMakeCache.txt": "build_profile:INTERNAL=debug\nCMAKE_GENERATOR:INTERNAL=Ninja\n", "build/lib/libns3-test.so": "built library"} {
		if e := os.WriteFile(filepath.Join(home, file), []byte(content), 0600); e != nil {
			t.Fatal(e)
		}
	}
	return home
}
func call(s *Service, path string, data any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(data)
	r := httptest.NewRequest("POST", path, strings.NewReader(string(b)))
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	return w
}
func decode(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var v map[string]any
	if e := json.Unmarshal(w.Body.Bytes(), &v); e != nil {
		t.Fatal(e)
	}
	return v
}
func TestNativeBuildAndReuse(t *testing.T) {
	t.Setenv("AQUASIM_CACHE_DIR", t.TempDir())
	home := testHome(t)
	defer forgetCache(home)
	s := New(home)
	commands := 0
	s.runCommand = func(cwd string, timeout time.Duration, program string, args ...string) (string, error) {
		commands++
		if program == "cmake" {
			if len(args) >= 4 && args[2] == "--target" {
				name := strings.TrimPrefix(args[3], "scratch_")
				e := os.WriteFile(filepath.Join(home, "build/scratch", "ns3-"+name+"-debug"), []byte("fake executable"), 0700)
				if e != nil {
					t.Fatal(e)
				}
			}
			return "build ok\n", nil
		}
		if strings.Contains(program, "aqua-visual-") {
			return catalogOutput(), nil
		}
		t.Fatal("unexpected command", program)
		return "", nil
	}
	w := call(s, "/api/simulator/check", map[string]any{})
	if w.Code != 200 || decode(t, w)["buildReusable"] != false || commands != 0 {
		t.Fatal("check executes or reuses unverified build", w.Body.String())
	}
	w = call(s, "/api/simulator/build", map[string]any{})
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	before := commands
	w = call(s, "/api/simulator/check", map[string]any{})
	if decode(t, w)["buildReusable"] != true || commands != before {
		t.Fatal("successful build not reused", w.Body.String())
	}
	w = call(New(home), "/api/simulator/check", map[string]any{})
	if decode(t, w)["buildReusable"] != true {
		t.Fatal("restart cannot restore catalog")
	}
	if e := os.WriteFile(filepath.Join(home, "src/aqua-sim-tg/fixture.cc"), []byte("changed source"), 0600); e != nil {
		t.Fatal(e)
	}
	w = call(s, "/api/simulator/check", map[string]any{})
	if decode(t, w)["buildReusable"] != false {
		t.Fatal("changed input reused")
	}
	files, _ := filepath.Glob(filepath.Join(home, "scratch/aqua-visual-*.cc"))
	if len(files) != 0 {
		t.Fatal("temporary source leaked")
	}
	s.active = &task{"run", home}
	w = call(s, "/api/simulator/build", map[string]any{})
	if w.Code != 409 || decode(t, w)["code"] != "SIMULATOR_BUSY" {
		t.Fatal("missing exclusion")
	}
}
func TestSourceConfinement(t *testing.T) {
	home := testHome(t)
	s := New(home)
	content := `// TypeId("ns3::Fake")
const char* s=R"tag(TypeId("ns3::Fake"))tag";
TypeId tid = TypeId("ns3::Actual");`
	file := filepath.Join(home, "src/aqua-sim-tg/actual.cc")
	_ = os.WriteFile(file, []byte(content), 0600)
	_ = os.WriteFile(strings.TrimSuffix(file, ".cc")+".h", []byte("header"), 0600)
	w := call(s, "/api/simulator/source", map[string]any{"typeId": "ns3::Actual"})
	if w.Code != 200 || decode(t, w)["code"] != content {
		t.Fatal(w.Body.String())
	}
	w = call(s, "/api/simulator/source", map[string]any{"typeId": "ns3::Fake"})
	if w.Code != 404 {
		t.Fatal("comment interpreted as registration")
	}
	w = call(s, "/api/simulator/source", map[string]any{"typeId": "ns3::Actual", "path": "src/aqua-sim-tg/../../CMakeLists.txt"})
	if w.Code != 403 {
		t.Fatal("path traversal accepted")
	}
	outside := filepath.Join(t.TempDir(), "secret.cc")
	_ = os.WriteFile(outside, []byte(`TypeId("ns3::Secret")`), 0600)
	_ = os.Symlink(outside, filepath.Join(home, "src/aqua-sim-tg/linked.cc"))
	w = call(s, "/api/simulator/source", map[string]any{"typeId": "ns3::Secret"})
	if w.Code != 404 {
		t.Fatal("symlink discovered")
	}
}
func TestFailedBuildNeverCached(t *testing.T) {
	home := testHome(t)
	s := New(home)
	s.runCommand = func(_ string, _ time.Duration, _ string, _ ...string) (string, error) {
		return "compiler detail", fmt.Errorf("failed")
	}
	w := call(s, "/api/simulator/build", map[string]any{})
	if w.Code != 500 || decode(t, w)["stdout"] != "compiler detail" {
		t.Fatal(w.Body.String())
	}
	if loadCache(home) != nil {
		t.Fatal("failure cached")
	}
}

func TestConcurrentBuildsShareFailure(t *testing.T) {
	home := testHome(t)
	s := New(home)
	started := make(chan struct{})
	release := make(chan struct{})
	commands := 0
	s.runCommand = func(_ string, _ time.Duration, _ string, _ ...string) (string, error) {
		commands++
		close(started)
		<-release
		return "shared configure failure", fmt.Errorf("failure")
	}
	first := make(chan *httptest.ResponseRecorder)
	second := make(chan *httptest.ResponseRecorder)
	go func() { first <- call(s, "/api/simulator/build", map[string]any{}) }()
	<-started
	go func() { second <- call(s, "/api/simulator/build", map[string]any{}) }()
	// Joining must not execute a competing command or return BUSY.
	select {
	case r := <-second:
		t.Fatalf("returned before shared result: %d", r.Code)
	case <-time.After(30 * time.Millisecond):
	}
	close(release)
	a, b := <-first, <-second
	if a.Code != 500 || b.Code != a.Code || a.Body.String() != b.Body.String() || commands != 1 {
		t.Fatal("builds were not joined", a.Body.String(), b.Body.String(), commands)
	}
}

func TestMalformedRunNeverInvokesCompiler(t *testing.T) {
	s := New(testHome(t))
	s.runCommand = func(_ string, _ time.Duration, _ string, _ ...string) (string, error) {
		t.Fatal("malformed request started a compiler")
		return "", nil
	}
	for _, spec := range []any{map[string]any{}, []any{}, nil} {
		w := call(s, "/api/run", map[string]any{"spec": spec})
		if w.Code != 400 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	spec := fixtureSpec().(map[string]any)
	spec["simStop"] = "bad"
	w := call(s, "/api/run", map[string]any{"spec": spec})
	if w.Code != 400 {
		t.Fatal(w.Body.String())
	}
	if s.active != nil {
		t.Fatal("invalid request entered active task")
	}
}

func TestCloseCancelsActiveBuild(t *testing.T) {
	s := New(testHome(t))
	started := make(chan struct{})
	s.runCommand = func(_ string, _ time.Duration, _ string, _ ...string) (string, error) {
		close(started)
		<-s.ctx.Done()
		return "stopped", s.ctx.Err()
	}
	result := make(chan *httptest.ResponseRecorder)
	go func() { result <- call(s, "/api/simulator/build", map[string]any{}) }()
	<-started
	s.Close()
	r := <-result
	if r.Code != 500 || s.active != nil {
		t.Fatal("shutdown did not finish active build")
	}
	r = call(s, "/api/simulator/build", map[string]any{})
	if r.Code != 503 {
		t.Fatal("closed service started another build")
	}
	s.Close() // shutdown paths may close defensively twice
}
