package field

import (
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"go.bug.st/serial"
)

type Config struct {
	Device         string `json:"device"`
	Port           string `json:"port"`
	BaudRate       int    `json:"baudRate"`
	DataBits       int    `json:"dataBits"`
	StopBits       int    `json:"stopBits"`
	Parity         string `json:"parity"`
	PollIntervalMS int    `json:"pollIntervalMs"`
}
type SyncResult struct {
	Source        string `json:"source"`
	SentAt        string `json:"sentAt"`
	TargetUTCTime string `json:"targetUtcTime"`
	State         string `json:"state"`
}
type DeviceState struct {
	Connected                           bool        `json:"connected"`
	Port                                string      `json:"port"`
	BaudRate                            int         `json:"baudRate"`
	DataBits                            int         `json:"dataBits"`
	StopBits                            int         `json:"stopBits"`
	Parity                              string      `json:"parity"`
	PollIntervalMS                      int         `json:"pollIntervalMs"`
	FixValid                            bool        `json:"fixValid"`
	FixQuality                          *int        `json:"fixQuality,omitempty"`
	Satellites                          *int        `json:"satellites,omitempty"`
	Latitude                            *float64    `json:"latitude,omitempty"`
	Longitude                           *float64    `json:"longitude,omitempty"`
	AltitudeM                           *float64    `json:"altitudeM,omitempty"`
	HDOP                                *float64    `json:"hdop,omitempty"`
	UTCTime                             string      `json:"utcTime,omitempty"`
	LastReceivedAt                      string      `json:"lastReceivedAt,omitempty"`
	TimeReceivedAt                      string      `json:"timeReceivedAt,omitempty"`
	Error                               string      `json:"error,omitempty"`
	Raw                                 string      `json:"raw,omitempty"`
	Stale                               bool        `json:"stale"`
	ValidTime                           bool        `json:"validTime"`
	LastSync                            *SyncResult `json:"lastSync,omitempty"`
	received, timeReceived, fixReceived time.Time
}
type Status struct {
	OK         bool        `json:"ok"`
	SystemTime string      `json:"systemTime"`
	GPS        DeviceState `json:"gps"`
	Atomic     DeviceState `json:"atomic"`
}
type Port interface {
	io.ReadWriteCloser
	SetReadTimeout(time.Duration) error
}
type session struct {
	port    Port
	key     string
	config  Config
	done    chan struct{}
	once    sync.Once
	writeMu sync.Mutex
}

func (s *session) close() { s.once.Do(func() { close(s.done); _ = s.port.Close() }) }
func (s *session) write(command string) error {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	select {
	case <-s.done:
		return errors.New("串口已断开")
	default:
	}
	n, e := s.port.Write([]byte(command))
	if e == nil && n != len(command) {
		e = io.ErrShortWrite
	}
	return e
}

type Manager struct {
	mu       sync.Mutex
	sessions map[string]*session
	states   map[string]DeviceState
	open     func(Config) (Port, error)
	now      func() time.Time
}

func NewManager() *Manager {
	return &Manager{sessions: map[string]*session{}, states: map[string]DeviceState{"gps": {}, "atomic": {}}, open: openPort, now: time.Now}
}
func validDevice(s string) bool { return s == "gps" || s == "atomic" }
func validateConfig(c *Config) error {
	if !validDevice(c.Device) {
		return errors.New("device 必须为 gps 或 atomic")
	}
	c.Port = strings.TrimSpace(c.Port)
	if c.Port == "" || len(c.Port) > 256 || strings.ContainsAny(c.Port, "\x00\r\n") {
		return errors.New("串口路径无效")
	}
	if runtime.GOOS == "windows" {
		name := strings.ToUpper(strings.TrimPrefix(c.Port, `\\.\`))
		if !strings.HasPrefix(name, "COM") || len(name) < 4 {
			return errors.New("请选择 COM 串口")
		}
		for _, c := range name[3:] {
			if c < '0' || c > '9' {
				return errors.New("请选择 COM 串口")
			}
		}
	} else if !strings.HasPrefix(c.Port, "/dev/") {
		return errors.New("串口必须位于 /dev 下")
	}
	if c.BaudRate < 300 || c.BaudRate > 4000000 {
		return errors.New("波特率必须为 300–4000000")
	}
	if c.DataBits < 5 || c.DataBits > 8 {
		return errors.New("数据位必须为 5–8")
	}
	if c.StopBits != 1 && c.StopBits != 2 {
		return errors.New("停止位必须为 1 或 2")
	}
	if c.Parity != "none" && c.Parity != "even" && c.Parity != "odd" {
		return errors.New("校验必须为 none、even 或 odd")
	}
	if c.PollIntervalMS == 0 {
		c.PollIntervalMS = 1000
	}
	if c.PollIntervalMS < 200 || c.PollIntervalMS > 60000 {
		return errors.New("查询周期必须为 200–60000 ms")
	}
	return nil
}
func portKey(name string) string {
	if runtime.GOOS == "windows" {
		return strings.ToUpper(strings.TrimPrefix(name, `\\.\`))
	}
	if real, e := filepath.EvalSymlinks(name); e == nil {
		return real
	}
	return filepath.Clean(name)
}
func openPort(c Config) (Port, error) {
	parity := serial.NoParity
	if c.Parity == "even" {
		parity = serial.EvenParity
	} else if c.Parity == "odd" {
		parity = serial.OddParity
	}
	stop := serial.OneStopBit
	if c.StopBits == 2 {
		stop = serial.TwoStopBits
	}
	return serial.Open(c.Port, &serial.Mode{BaudRate: c.BaudRate, DataBits: c.DataBits, StopBits: stop, Parity: parity})
}
func (m *Manager) Connect(c Config) error {
	if e := validateConfig(&c); e != nil {
		return e
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	key := portKey(c.Port)
	for _, s := range m.sessions {
		if s.key == key {
			return errors.New("串口已连接；请先断开，GPS 与原子钟不可共用同一串口")
		}
	}
	if m.sessions[c.Device] != nil {
		return errors.New("设备已连接，请先断开再更换串口")
	}
	p, e := m.open(c)
	if e != nil {
		return fmt.Errorf("打开串口失败: %w", e)
	}
	if e = p.SetReadTimeout(250 * time.Millisecond); e != nil {
		_ = p.Close()
		return fmt.Errorf("设置读取超时失败: %w", e)
	}
	s := &session{port: p, key: key, config: c, done: make(chan struct{})}
	m.sessions[c.Device] = s
	m.states[c.Device] = DeviceState{Connected: true, Port: c.Port, BaudRate: c.BaudRate, DataBits: c.DataBits, StopBits: c.StopBits, Parity: c.Parity, PollIntervalMS: c.PollIntervalMS}
	go m.read(s)
	if c.Device == "atomic" {
		go m.poll(s)
	}
	return nil
}
func (m *Manager) Disconnect(device string) error {
	if !validDevice(device) {
		return errors.New("device 必须为 gps 或 atomic")
	}
	m.mu.Lock()
	s := m.sessions[device]
	delete(m.sessions, device)
	state := m.states[device]
	state.Connected = false
	state.FixValid = false
	state.ValidTime = false
	m.states[device] = state
	m.mu.Unlock()
	if s != nil {
		s.close()
	}
	return nil
}
func (m *Manager) Close() { _ = m.Disconnect("gps"); _ = m.Disconnect("atomic") }
func (m *Manager) fail(s *session, e error) {
	m.mu.Lock()
	if m.sessions[s.config.Device] == s {
		delete(m.sessions, s.config.Device)
		st := m.states[s.config.Device]
		st.Connected = false
		st.FixValid = false
		st.ValidTime = false
		st.Error = bounded(e.Error())
		m.states[s.config.Device] = st
	}
	m.mu.Unlock()
	s.close()
}
func bounded(s string) string {
	if len(s) > 512 {
		return s[:512]
	}
	return s
}
func (m *Manager) recordError(s *session, e error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sessions[s.config.Device] != s {
		return
	}
	st := m.states[s.config.Device]
	st.Error = bounded(e.Error())
	m.states[s.config.Device] = st
}
func (m *Manager) read(s *session) {
	var framer Framer
	buf := make([]byte, 1024)
	for {
		select {
		case <-s.done:
			return
		default:
		}
		n, e := s.port.Read(buf)
		if e != nil {
			m.fail(s, fmt.Errorf("串口读取失败: %w", e))
			return
		}
		if n == 0 {
			continue
		}
		lines, overflow := framer.Feed(buf[:n])
		if overflow {
			m.recordError(s, errors.New("串口行超过 4096 字节，已丢弃"))
		}
		for _, line := range lines {
			m.consume(s, line)
		}
	}
}
func (m *Manager) consume(s *session, line string) {
	var update *GPSUpdate
	var at time.Time
	var err error
	if s.config.Device == "gps" {
		update, err = ParseGPS(line)
		if err == nil && update == nil {
			return
		}
	} else {
		at, err = ParseAtomic(line)
	}
	if err != nil {
		m.recordError(s, err)
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sessions[s.config.Device] != s {
		return
	}
	st := m.states[s.config.Device]
	now := m.now()
	st.received = now
	st.LastReceivedAt = now.UTC().Format(time.RFC3339Nano)
	st.Error = ""
	st.Raw = bounded(line)
	if update != nil {
		if update.FixValid != nil {
			st.FixValid = *update.FixValid
			st.fixReceived = now
			if !st.FixValid {
				st.Latitude = nil
				st.Longitude = nil
			}
		}
		if update.Latitude != nil {
			st.Latitude = update.Latitude
			st.Longitude = update.Longitude
		}
		if update.FixQuality != nil {
			st.FixQuality = update.FixQuality
		}
		if update.Satellites != nil {
			st.Satellites = update.Satellites
		}
		if update.AltitudeM != nil {
			st.AltitudeM = update.AltitudeM
		}
		if update.HDOP != nil {
			st.HDOP = update.HDOP
		}
		if update.TimeValid != nil {
			st.ValidTime = *update.TimeValid
		}
		if update.Time != nil {
			at = *update.Time
		}
	}
	if !at.IsZero() {
		st.UTCTime = at.UTC().Format(time.RFC3339Nano)
		st.TimeReceivedAt = st.LastReceivedAt
		st.timeReceived = now
		st.ValidTime = true
	}
	m.states[s.config.Device] = st
}
func (m *Manager) poll(s *session) {
	ticker := time.NewTicker(time.Duration(s.config.PollIntervalMS) * time.Millisecond)
	defer ticker.Stop()
	for {
		if e := s.write("!T?\r\n"); e != nil {
			m.fail(s, fmt.Errorf("原子钟查询失败: %w", e))
			return
		}
		select {
		case <-s.done:
			return
		case <-ticker.C:
		}
	}
}
func (m *Manager) state(device string, now time.Time) DeviceState {
	st := m.states[device]
	maxAge := 5 * time.Second
	if device == "atomic" && time.Duration(st.PollIntervalMS)*3*time.Millisecond > maxAge {
		maxAge = time.Duration(st.PollIntervalMS) * 3 * time.Millisecond
	}
	st.Stale = !st.Connected || st.received.IsZero() || now.Sub(st.received) > maxAge
	st.ValidTime = st.ValidTime && st.Connected && !st.timeReceived.IsZero() && now.Sub(st.timeReceived) <= maxAge
	st.FixValid = st.FixValid && st.Connected && !st.fixReceived.IsZero() && now.Sub(st.fixReceived) <= maxAge
	return st
}
func (m *Manager) Snapshot() Status {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	return Status{OK: true, SystemTime: now.UTC().Format(time.RFC3339Nano), GPS: m.state("gps", now), Atomic: m.state("atomic", now)}
}
func (m *Manager) SyncAtomic(source string) (SyncResult, error) {
	m.mu.Lock()
	s := m.sessions["atomic"]
	now := m.now()
	target := now
	if s == nil {
		m.mu.Unlock()
		return SyncResult{}, errors.New("请先连接原子钟")
	}
	if source == "gps" {
		gps := m.state("gps", now)
		if !gps.ValidTime {
			m.mu.Unlock()
			return SyncResult{}, errors.New("GPS UTC 时间无效或已过期")
		}
		parsed, e := time.Parse(time.RFC3339Nano, gps.UTCTime)
		if e != nil {
			m.mu.Unlock()
			return SyncResult{}, e
		}
		target = parsed.Add(now.Sub(gps.timeReceived))
	} else if source != "system" {
		m.mu.Unlock()
		return SyncResult{}, errors.New("source 必须为 gps 或 system")
	}
	m.mu.Unlock()
	if e := s.write(AtomicSetCommand(target)); e != nil {
		m.fail(s, e)
		return SyncResult{}, e
	}
	result := SyncResult{Source: source, SentAt: now.UTC().Format(time.RFC3339Nano), TargetUTCTime: time.Unix(target.Unix(), 0).UTC().Format(time.RFC3339), State: "sent"}
	m.mu.Lock()
	if m.sessions["atomic"] == s {
		st := m.states["atomic"]
		st.LastSync = &result
		m.states["atomic"] = st
	}
	m.mu.Unlock()
	return result, nil
}
