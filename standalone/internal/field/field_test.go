package field

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func sentence(body string) string {
	var sum byte
	for i := range body {
		sum ^= body[i]
	}
	return fmt.Sprintf("$%s*%02X", body, sum)
}
func TestFraming(t *testing.T) {
	var f Framer
	lines, overflow := f.Feed([]byte("abc\r"))
	if overflow || len(lines) != 1 || lines[0] != "abc" {
		t.Fatal(lines)
	}
	lines, _ = f.Feed([]byte("\ndef\npart"))
	if len(lines) != 1 || lines[0] != "def" {
		t.Fatal(lines)
	}
	lines, _ = f.Feed([]byte("ial\r\n"))
	if len(lines) != 1 || lines[0] != "partial" {
		t.Fatal(lines)
	}
	lines, overflow = f.Feed([]byte(strings.Repeat("x", 5000) + "\nvalid\n"))
	if !overflow || len(lines) != 1 || lines[0] != "valid" {
		t.Fatal(lines, overflow)
	}
}
func TestGPS(t *testing.T) {
	raw := sentence("GNRMC,123519.250,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W")
	u, e := ParseGPS(raw)
	if e != nil || u.Time.UTC().Format(time.RFC3339Nano) != "1994-03-23T12:35:19.25Z" || !*u.FixValid || *u.Latitude < 48.1172 || *u.Latitude > 48.1174 {
		t.Fatal(u, e)
	}
	if _, e = ParseGPS(raw[:len(raw)-2] + "00"); e == nil {
		t.Fatal("checksum accepted")
	}
	if _, e = ParseGPS(sentence("GPRMC,123519,A,9060.000,N,01131.000,E,0,0,230394,,,")); e == nil {
		t.Fatal("invalid coordinates accepted")
	}
	if _, e = ParseGPS(sentence("GPRMC,123519,A,4807.038,N,01131.000,E,0,0,310224,,,")); e == nil {
		t.Fatal("invalid date accepted")
	}
	u, e = ParseGPS(sentence("GPRMC,123519,V,,,,,,,230394,,,"))
	if e != nil || *u.FixValid || *u.TimeValid {
		t.Fatal(u, e)
	}
	u, e = ParseGPS(sentence("GPGGA,123519,4807.038,S,01131.000,W,1,08,0.9,545.4,M,46.9,M,,"))
	if e != nil || u.Time != nil || *u.Latitude >= 0 || *u.Longitude >= 0 || *u.Satellites != 8 {
		t.Fatal(u, e)
	}
	u, e = ParseGPS(sentence("GNZDA,181813.5,15,07,2021,00,00"))
	if e != nil || u.Time.Format(time.RFC3339Nano) != "2021-07-15T18:18:13.5Z" {
		t.Fatal(u, e)
	}
	if _, e = ParseGPS(sentence("GNZDA,181860,15,07,2021,00,00")); e == nil {
		t.Fatal("leap second silently normalized")
	}
}
func TestFractionalTimestamp(t *testing.T) {
	at, e := dateTime("123519.123456789", 2026, 11, 16)
	if e != nil || at.Nanosecond() != 123456789 {
		t.Fatal(at, e)
	}
	for _, input := range []string{"123519e0", "123519.", "123519.0000000001", "+23519"} {
		if _, e := dateTime(input, 2026, 11, 16); e == nil {
			t.Fatal(input)
		}
	}
}
func TestAtomic(t *testing.T) {
	at, e := ParseAtomic(" 1700000000 ")
	if e != nil || at.Unix() != 1700000000 {
		t.Fatal(at, e)
	}
	for _, v := range []string{"OK", "!TA1700000000", "1700000000.5", "-1", "NaN", "999999999999999999999"} {
		if _, e := ParseAtomic(v); e == nil {
			t.Fatal(v)
		}
	}
	if s := AtomicSetCommand(at); s != "!TA1700000000\r\n" {
		t.Fatalf("unexpected framing %q", s)
	}
}

type fakePort struct {
	mu     sync.Mutex
	writes bytes.Buffer
	closed chan struct{}
	once   sync.Once
}

func newPort() *fakePort { return &fakePort{closed: make(chan struct{})} }
func (p *fakePort) Read(b []byte) (int, error) {
	select {
	case <-p.closed:
		return 0, io.EOF
	case <-time.After(time.Millisecond * 10):
		return 0, nil
	}
}
func (p *fakePort) Write(b []byte) (int, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	select {
	case <-p.closed:
		return 0, io.ErrClosedPipe
	default:
		return p.writes.Write(b)
	}
}
func (p *fakePort) Close() error                       { p.once.Do(func() { close(p.closed) }); return nil }
func (p *fakePort) SetReadTimeout(time.Duration) error { return nil }
func (p *fakePort) text() string                       { p.mu.Lock(); defer p.mu.Unlock(); return p.writes.String() }
func testConfig(device, port string) Config {
	return Config{Device: device, Port: port, BaudRate: 57600, DataBits: 8, StopBits: 1, Parity: "none", PollIntervalMS: 1000}
}
func TestManagerFreshnessAndIsolation(t *testing.T) {
	m := NewManager()
	defer m.Close()
	now := time.Date(2026, 11, 16, 0, 0, 0, 0, time.UTC)
	m.now = func() time.Time { return now }
	m.open = func(Config) (Port, error) { return newPort(), nil }
	if e := m.Connect(testConfig("gps", "/dev/test-gps")); e != nil {
		t.Fatal(e)
	}
	if e := m.Connect(testConfig("atomic", "/dev/test-gps")); e == nil {
		t.Fatal("shared port accepted")
	}
	gps := m.sessions["gps"]
	m.consume(gps, sentence("GNRMC,000000,A,3230.000,N,11130.000,E,0,0,161126,,,"))
	st := m.Snapshot()
	if !st.GPS.FixValid || !st.GPS.ValidTime || st.GPS.Stale {
		t.Fatal(st.GPS)
	}
	now = now.Add(6 * time.Second)
	st = m.Snapshot()
	if st.GPS.FixValid || st.GPS.ValidTime || !st.GPS.Stale {
		t.Fatal(st.GPS)
	}
	_ = m.Disconnect("gps")
	if e := m.Connect(testConfig("gps", "/dev/test-gps")); e != nil {
		t.Fatal(e)
	}
	m.consume(gps, sentence("GNRMC,000000,A,3230.000,N,11130.000,E,0,0,161126,,,"))
	if m.Snapshot().GPS.UTCTime != "" {
		t.Fatal("old session overwrote new state")
	}
	m.open = func(Config) (Port, error) { return nil, errors.New("fixture open failure") }
	if e := m.Connect(testConfig("atomic", "/dev/test-atomic")); e == nil {
		t.Fatal("open failure hidden")
	}
	if m.Snapshot().Atomic.Connected {
		t.Fatal("failed device connected")
	}
}
func TestSyncDoesNotClaimSuccess(t *testing.T) {
	m := NewManager()
	defer m.Close()
	p := newPort()
	m.open = func(Config) (Port, error) { return p, nil }
	if e := m.Connect(testConfig("atomic", "/dev/test-atomic")); e != nil {
		t.Fatal(e)
	}
	if _, e := m.SyncAtomic("gps"); e == nil {
		t.Fatal("invalid GPS allowed")
	}
	r, e := m.SyncAtomic("system")
	if e != nil || r.State != "sent" {
		t.Fatal(r, e)
	}
	if !strings.Contains(p.text(), "!TA") || strings.Contains(p.text(), "\r\n\r\n") {
		t.Fatal(p.text())
	}
	st := m.Snapshot()
	if st.Atomic.ValidTime || st.Atomic.UTCTime != "" {
		t.Fatal("write fabricated readback")
	}
}
func TestHTTP(t *testing.T) {
	m := NewManager()
	defer m.Close()
	h := SameOrigin(m.Handler())
	call := func(method, path, body, origin string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://localhost:8080"+path, strings.NewReader(body))
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	if w := call("GET", "/api/field/status", "", ""); w.Code != 200 {
		t.Fatal(w.Code)
	}
	if w := call("POST", "/api/field/disconnect", `{"device":"gps"}`, "http://evil.test"); w.Code != 403 {
		t.Fatal(w.Code)
	}
	if w := call("POST", "/api/field/disconnect", `{"device":"gps"}`, "http://localhost:8080"); w.Code != 200 {
		t.Fatal(w.Code)
	}
	if w := call("POST", "/api/field/connect", `{"device":"gps","port":"/etc/passwd","baudRate":9600,"dataBits":8,"stopBits":1,"parity":"none"}`, ""); w.Code != 400 {
		t.Fatal(w.Code)
	}
	if w := call("GET", "/api/field/connect", "", ""); w.Code != 405 {
		t.Fatal(w.Code)
	}
	if w := call("POST", "/api/field/disconnect", `{"device":"gps","extra":1}`, ""); w.Code != 400 {
		t.Fatal(w.Code)
	}
	w := call("POST", "/api/field/atomic-sync", `{"source":"system"}`, "")
	var response map[string]any
	if e := json.Unmarshal(w.Body.Bytes(), &response); e != nil || response["ok"] != false {
		t.Fatal(response, e)
	}
}
