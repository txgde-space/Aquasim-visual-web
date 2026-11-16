package field

import (
	"errors"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestClockCommands(t *testing.T) {
	at := time.Unix(1700000000, 123000000)
	c := DefaultCommands()
	got, e := c.render(at)
	if e != nil || got != "!TA1700000000\r\n" {
		t.Fatal(got, e)
	}
	c.Set = "SET {unix_ms} {iso}"
	c.Ending = "lf"
	got, e = c.render(at)
	if e != nil || !strings.Contains(got, "1700000000123") || !strings.HasSuffix(got, "\n") || strings.Contains(got, "\r") {
		t.Fatal(got, e)
	}
	for _, bad := range []Commands{{"!T?", "!TA123", "crlf"}, {"!T?\n", "!TA{unix}", "crlf"}, {"!T?", "!TA{bad}", "crlf"}, {"!T?", "!TA{unix}", "bogus"}} {
		if bad.validate() == nil {
			t.Fatal("accepted", bad)
		}
	}
}
func TestAtomicBatchRollbackAndExclusivity(t *testing.T) {
	m := NewManager()
	defer m.Close()
	p := newPort()
	opens := 0
	m.open = func(Config) (Port, error) {
		opens++
		if opens == 2 {
			return nil, errors.New("missing adapter")
		}
		return p, nil
	}
	if _, e := m.OpenAtomicBatch([]Config{testConfig("atomic", "/dev/a"), testConfig("atomic", "/dev/b")}); e == nil {
		t.Fatal("partial open accepted")
	}
	select {
	case <-p.closed:
	default:
		t.Fatal("first adapter leaked")
	}
	if len(m.sessions) != 0 {
		t.Fatal(m.sessions)
	}
	opens = 0
	if _, e := m.OpenAtomicBatch([]Config{testConfig("atomic", "/dev/a"), testConfig("atomic", "/dev/a")}); e == nil {
		t.Fatal("duplicate accepted")
	}
	if opens != 0 {
		t.Fatal("opened before validation")
	}
	m.open = func(Config) (Port, error) { return newPort(), nil }
	if e := m.Connect(testConfig("gps", "/dev/gps")); e != nil {
		t.Fatal(e)
	}
	if _, e := m.OpenAtomicBatch([]Config{testConfig("atomic", "/dev/gps")}); e == nil {
		t.Fatal("GPS port reused")
	}
	if !m.Snapshot().GPS.Connected {
		t.Fatal("batch disconnected GPS")
	}
}
func TestBatchCommonEpochAndObservedState(t *testing.T) {
	m := NewManager()
	defer m.Close()
	ports := map[string]*fakePort{}
	m.open = func(c Config) (Port, error) { p := newPort(); ports[c.Port] = p; return p, nil }
	opened, e := m.OpenAtomicBatch([]Config{testConfig("atomic", "/dev/a"), testConfig("atomic", "/dev/b")})
	if e != nil {
		t.Fatal(e)
	}
	result, e := m.SyncAtomicBatch(opened.Devices)
	if e != nil {
		t.Fatal(e)
	}
	at, e := time.Parse(time.RFC3339Nano, result.Target)
	if e != nil {
		t.Fatal(e)
	}
	for _, row := range result.Rows {
		if row.Error != "" || row.SentAt == "" || row.EstimatedWireMS <= 0 {
			t.Fatal(row)
		}
		if !strings.Contains(ports[row.Port].text(), AtomicSetCommand(at)) {
			t.Fatal(ports[row.Port].text())
		}
	}
	for _, st := range m.Snapshot().Atomics {
		if st.Connected && (st.ValidTime || st.UTCTime != "" || st.LastSync == nil || st.LastSync.State != "sent") {
			t.Fatal(st)
		}
	}
	if _, e = m.SyncAtomicBatch([]string{opened.Devices[0], opened.Devices[0]}); e == nil {
		t.Fatal("duplicate batch accepted")
	}
	m.Close()
	for _, p := range ports {
		select {
		case <-p.closed:
		default:
			t.Fatal("leaked port")
		}
	}
	if e = m.Connect(testConfig("atomic", "/dev/c")); e == nil {
		t.Fatal("opened after shutdown")
	}
}

func TestAutoClockDirectionAndGuards(t *testing.T) {
	m := NewManager()
	defer m.Close()
	p := newPort()
	m.open = func(Config) (Port, error) { return p, nil }
	if e := m.Connect(testConfig("atomic", "/dev/auto")); e != nil {
		t.Fatal(e)
	}
	c := AutoSyncConfig{Enabled: true, Device: "atomic", Direction: "atomic-to-system", IntervalSeconds: 60, MaxStepSeconds: 5}
	if m.ConfigureAuto(c) == nil {
		t.Fatal("enabled without fresh sample")
	}
	calls := 0
	m.setClock = func(at time.Time) error {
		calls++
		if time.Since(at) > 5*time.Second {
			t.Fatal(at)
		}
		return nil
	}
	m.consume(m.sessions["atomic"], strconv.FormatInt(time.Now().Add(2*time.Second).Unix(), 10))
	if e := m.ConfigureAuto(c); e != nil {
		t.Fatal(e)
	}
	if calls != 0 {
		t.Fatal("setting changed system clock immediately")
	}
	cancel := m.autoCancel
	if !m.autoTick(c, cancel) || calls != 1 {
		t.Fatal("atomic to system did not execute")
	}
	m.consume(m.sessions["atomic"], strconv.FormatInt(time.Now().Unix(), 10))
	if !m.autoTick(c, cancel) || calls != 1 || m.Snapshot().ClockTools.Auto.LastAction != "within-resolution" {
		t.Fatal("quantized sample stepped already-close clock")
	}
	if m.SetCommands(DefaultCommands()) == nil {
		t.Fatal("command settings changed during auto sync")
	}
	if _, e := m.SyncAtomicBatch([]string{"atomic"}); e == nil {
		t.Fatal("batch permitted with auto enabled")
	}
	if _, e := m.SyncAtomic("system"); e == nil {
		t.Fatal("manual reverse sync permitted with auto enabled")
	}
	_ = m.ConfigureAuto(AutoSyncConfig{})
	if m.autoTick(c, cancel) {
		t.Fatal("cancelled auto tick applied")
	}
	m.consume(m.sessions["atomic"], "1700000000")
	if e := m.ConfigureAuto(c); e != nil {
		t.Fatal(e)
	}
	if m.autoTick(c, m.autoCancel) || calls != 1 || m.Snapshot().ClockTools.Auto.Enabled {
		t.Fatal("large step guard failed")
	}
	m.consume(m.sessions["atomic"], strconv.FormatInt(time.Now().Add(2*time.Second).Unix(), 10))
	m.setClock = func(time.Time) error { return errors.New("permission denied") }
	if e := m.ConfigureAuto(c); e != nil {
		t.Fatal(e)
	}
	if m.autoTick(c, m.autoCancel) || !strings.Contains(m.Snapshot().ClockTools.Auto.Error, "permission") {
		t.Fatal("privilege failure not surfaced")
	}
	c.Direction = "system-to-atomic"
	if e := m.ConfigureAuto(c); e != nil {
		t.Fatal(e)
	}
	if !m.autoTick(c, m.autoCancel) || !strings.Contains(p.text(), "!TA") {
		t.Fatal("system to atomic did not write")
	}
	_ = m.Disconnect("atomic")
	if m.Snapshot().ClockTools.Auto.Enabled {
		t.Fatal("disconnect left automation enabled")
	}
}
