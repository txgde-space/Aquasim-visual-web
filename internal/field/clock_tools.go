package field

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Commands struct {
	Query  string `json:"query"`
	Set    string `json:"set"`
	Ending string `json:"ending"`
}

func DefaultCommands() Commands { return Commands{Query: "!T?", Set: "!TA{unix}", Ending: "crlf"} }
func (c Commands) ending() string {
	switch c.Ending {
	case "lf":
		return "\n"
	case "cr":
		return "\r"
	case "none":
		return ""
	}
	return "\r\n"
}
func (c Commands) validate() error {
	if c.Ending != "crlf" && c.Ending != "lf" && c.Ending != "cr" && c.Ending != "none" {
		return errors.New("结束符必须为 crlf、lf、cr 或 none")
	}
	for _, s := range []string{c.Query, c.Set} {
		if len(s) == 0 || len(s) > 256 {
			return errors.New("指令长度必须为 1–256 字节")
		}
		for _, b := range []byte(s) {
			if b < 32 || b > 126 {
				return errors.New("指令只接受可打印 ASCII；结束符请单独选择")
			}
		}
	}
	if strings.ContainsAny(c.Query, "{}") {
		return errors.New("查询指令不能包含时间占位符")
	}
	rest := c.Set
	found := false
	for _, token := range []string{"{unix}", "{unix_ms}", "{iso}"} {
		if strings.Contains(rest, token) {
			found = true
		}
		rest = strings.ReplaceAll(rest, token, "")
	}
	if !found || strings.ContainsAny(rest, "{}") {
		return errors.New("设置指令须包含 {unix}、{unix_ms} 或 {iso}，且不能包含其他占位符")
	}
	return nil
}
func (c Commands) render(at time.Time) (string, error) {
	if e := c.validate(); e != nil {
		return "", e
	}
	return strings.NewReplacer("{unix}", strconv.FormatInt(at.Unix(), 10), "{unix_ms}", strconv.FormatInt(at.UnixMilli(), 10), "{iso}", at.UTC().Format(time.RFC3339Nano)).Replace(c.Set) + c.ending(), nil
}
func (m *Manager) SetCommands(c Commands) error {
	if e := c.validate(); e != nil {
		return e
	}
	m.syncMu.Lock()
	defer m.syncMu.Unlock()
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.auto.Enabled {
		return errors.New("请先关闭自动同步再更改指令")
	}
	m.commands = c
	return nil
}

type ClockToolsState struct {
	Commands Commands      `json:"commands"`
	Auto     AutoSyncState `json:"auto"`
}
type AutoSyncState struct {
	Enabled         bool   `json:"enabled"`
	Device          string `json:"device"`
	Direction       string `json:"direction"`
	IntervalSeconds int    `json:"intervalSeconds"`
	MaxStepSeconds  int    `json:"maxStepSeconds"`
	LastAt          string `json:"lastAt,omitempty"`
	LastAction      string `json:"lastAction,omitempty"`
	Error           string `json:"error,omitempty"`
}

func (m *Manager) stopAutoLocked() {
	if m.autoCancel != nil {
		close(m.autoCancel)
		m.autoCancel = nil
	}
	m.auto.Enabled = false
}

type BatchOpenResult struct {
	Devices []string `json:"devices"`
}

// Opening is transactional: if one fails, only newly opened batch ports are closed.
func (m *Manager) OpenAtomicBatch(configs []Config) (BatchOpenResult, error) {
	if len(configs) == 0 || len(configs) > 64 {
		return BatchOpenResult{}, errors.New("请选择 1–64 个原子钟串口")
	}
	m.syncMu.Lock()
	defer m.syncMu.Unlock()
	keys := map[string]bool{}
	for i := range configs {
		configs[i].Device = "atomic"
		if e := validateConfig(&configs[i]); e != nil {
			return BatchOpenResult{}, e
		}
		key := portKey(configs[i].Port)
		if keys[key] {
			return BatchOpenResult{}, errors.New("串口重复")
		}
		keys[key] = true
	}
	ids := []string{}
	for _, c := range configs {
		m.mu.Lock()
		if m.sessions["atomic"] == nil {
			c.Device = "atomic"
		} else {
			m.nextAtomic++
			c.Device = fmt.Sprintf("atomic:%d", m.nextAtomic)
		}
		m.mu.Unlock()
		commands := DefaultCommands()
		if e := m.connect(c, &commands); e != nil {
			for _, id := range ids {
				_ = m.Disconnect(id)
			}
			return BatchOpenResult{}, fmt.Errorf("%s: %w；本次新开串口已回退关闭", c.Port, e)
		}
		ids = append(ids, c.Device)
	}
	return BatchOpenResult{Devices: ids}, nil
}

type BatchRow struct {
	Device          string  `json:"device"`
	Port            string  `json:"port"`
	SentAt          string  `json:"sentAt,omitempty"`
	CompletedAt     string  `json:"completedAt,omitempty"`
	Error           string  `json:"error,omitempty"`
	EstimatedWireMS float64 `json:"estimatedWireMs"`
}
type BatchResult struct {
	Target           string     `json:"targetUtcTime"`
	DispatchSpreadMS float64    `json:"dispatchSpreadMs"`
	Rows             []BatchRow `json:"rows"`
}

func (m *Manager) SyncAtomicBatch(ids []string) (BatchResult, error) {
	if len(ids) == 0 || len(ids) > 64 {
		return BatchResult{}, errors.New("请选择 1–64 台已连接原子钟")
	}
	m.syncMu.Lock()
	defer m.syncMu.Unlock()
	m.mu.Lock()
	if m.auto.Enabled {
		m.mu.Unlock()
		return BatchResult{}, errors.New("初始对钟前请关闭自动同步，避免时间源相互覆盖")
	}
	sessions := make([]*session, 0, len(ids))
	seen := map[string]bool{}
	for _, id := range ids {
		s := m.sessions[id]
		if !atomicDevice(id) || s == nil || seen[id] {
			m.mu.Unlock()
			return BatchResult{}, errors.New("存在未连接、重复或非原子钟设备，请重新选择")
		}
		seen[id] = true
		sessions = append(sessions, s)
	}
	// Initial alignment always uses the device's default set-time protocol.
	commands := DefaultCommands()
	m.mu.Unlock()
	// Stable lock order, and no query bytes interleaved with the set command.
	sort.Slice(sessions, func(i, j int) bool { return sessions[i].config.Device < sessions[j].config.Device })
	for _, s := range sessions {
		s.writeMu.Lock()
	}
	defer func() {
		for _, s := range sessions {
			s.writeMu.Unlock()
		}
	}()
	for _, s := range sessions {
		select {
		case <-s.done:
			return BatchResult{}, errors.New("有串口已断开，未执行对钟")
		default:
		}
	}
	target := m.now().Truncate(time.Second).Add(2 * time.Second)
	command, e := commands.render(target)
	if e != nil {
		return BatchResult{}, e
	}
	result := BatchResult{Target: target.UTC().Format(time.RFC3339Nano), Rows: make([]BatchRow, len(sessions))}
	gate := make(chan struct{})
	var ready, writes sync.WaitGroup
	ready.Add(len(sessions))
	writes.Add(len(sessions))
	starts := make([]time.Time, len(sessions))
	for i, s := range sessions {
		go func(i int, s *session) {
			defer writes.Done()
			ready.Done()
			<-gate
			row := BatchRow{Device: s.config.Device, Port: s.config.Port}
			bits := 1 + s.config.DataBits + s.config.StopBits
			if s.config.Parity != "none" {
				bits++
			}
			row.EstimatedWireMS = float64(len(command)*bits) * 1000 / float64(s.config.BaudRate)
			select {
			case <-s.done:
				row.Error = "串口已断开"
				result.Rows[i] = row
				return
			default:
			}
			start := m.now()
			starts[i] = start
			row.SentAt = start.UTC().Format(time.RFC3339Nano)
			n, err := s.port.Write([]byte(command))
			row.CompletedAt = m.now().UTC().Format(time.RFC3339Nano)
			if err != nil {
				row.Error = err.Error()
			} else if n != len(command) {
				row.Error = "串口未完整写入指令"
			}
			if row.Error == "" {
				m.mu.Lock()
				if m.sessions[s.config.Device] == s {
					st := m.states[s.config.Device]
					st.LastSync = &SyncResult{Source: "system", SentAt: row.SentAt, TargetUTCTime: result.Target, State: "sent"}
					m.states[s.config.Device] = st
				}
				m.mu.Unlock()
			}
			result.Rows[i] = row
		}(i, s)
	}
	ready.Wait()
	delay := target.Sub(m.now())
	if delay > 0 {
		time.Sleep(delay)
	}
	close(gate)
	writes.Wait()
	var first, last time.Time
	for _, at := range starts {
		if at.IsZero() {
			continue
		}
		if first.IsZero() || at.Before(first) {
			first = at
		}
		if at.After(last) {
			last = at
		}
	}
	if !first.IsZero() {
		result.DispatchSpreadMS = float64(last.Sub(first)) / float64(time.Millisecond)
	}
	return result, nil
}

type AutoSyncConfig struct {
	Enabled         bool   `json:"enabled"`
	Device          string `json:"device"`
	Direction       string `json:"direction"`
	IntervalSeconds int    `json:"intervalSeconds"`
	MaxStepSeconds  int    `json:"maxStepSeconds"`
}

func (m *Manager) ConfigureAuto(c AutoSyncConfig) error {
	m.syncMu.Lock()
	defer m.syncMu.Unlock()
	m.mu.Lock()
	defer m.mu.Unlock()
	if !c.Enabled {
		m.stopAutoLocked()
		return nil
	}
	if m.closed {
		return errors.New("服务正在退出")
	}
	if c.Direction != "atomic-to-system" && c.Direction != "system-to-atomic" {
		return errors.New("请明确选择自动同步方向")
	}
	if c.IntervalSeconds < 5 || c.IntervalSeconds > 86400 {
		return errors.New("自动同步间隔必须为 5–86400 秒")
	}
	if c.MaxStepSeconds < 1 || c.MaxStepSeconds > 86400 {
		return errors.New("最大允许时间差必须为 1–86400 秒")
	}
	if !atomicDevice(c.Device) || m.sessions[c.Device] == nil {
		return errors.New("请选择已连接的原子钟")
	}
	if c.Direction == "atomic-to-system" && !m.state(c.Device, m.now()).ValidTime {
		return errors.New("原子钟尚无新鲜有效时间，不能用于系统校时")
	}
	m.stopAutoLocked()
	cancel := make(chan struct{})
	m.autoCancel = cancel
	m.auto = AutoSyncState{Enabled: true, Device: c.Device, Direction: c.Direction, IntervalSeconds: c.IntervalSeconds, MaxStepSeconds: c.MaxStepSeconds}
	go m.autoLoop(c, cancel)
	return nil
}
func (m *Manager) autoLoop(c AutoSyncConfig, cancel <-chan struct{}) {
	ticker := time.NewTicker(time.Duration(c.IntervalSeconds) * time.Second)
	defer ticker.Stop()
	// First tick follows the explicitly chosen interval; enabling is not a hidden immediate write.
	for {
		select {
		case <-cancel:
			return
		case <-ticker.C:
			if !m.autoTick(c, cancel) {
				return
			}
		}
	}
}
func (m *Manager) autoTick(c AutoSyncConfig, cancel <-chan struct{}) bool {
	m.syncMu.Lock()
	defer m.syncMu.Unlock()
	m.mu.Lock()
	if m.autoCancel != cancel || !m.auto.Enabled {
		m.mu.Unlock()
		return false
	}
	s := m.sessions[c.Device]
	now := m.now()
	st := m.state(c.Device, now)
	commands := m.commands
	m.mu.Unlock()
	var e error
	var target time.Time
	lastAction := "atomic-command-sent"
	if s == nil {
		e = errors.New("原子钟已断开，自动同步已关闭")
	} else if c.Direction == "atomic-to-system" {
		if !st.ValidTime || st.Error != "" {
			e = errors.New("原子钟时间过期，自动同步已关闭")
		} else {
			target, e = time.Parse(time.RFC3339Nano, st.UTCTime)
			if e == nil {
				target = target.Add(now.Sub(st.timeReceived))
				delta := target.Sub(now)
				if delta < 0 {
					delta = -delta
				}
				if delta > time.Duration(c.MaxStepSeconds)*time.Second {
					e = errors.New("原子钟与系统时间差超出允许值，自动同步已关闭，请核对设备日期与时间源")
				} else if delta < time.Second {
					// An integer-second reply does not identify the phase within that second.
					// Do not repeatedly step an already-close system clock using a quantized sample.
					lastAction = "within-resolution"
				} else {
					e = m.setClock(target)
					lastAction = "system-set"
				}
			}
		}
	} else {
		target = now
		var command string
		command, e = commands.render(target)
		if e == nil {
			e = s.write(command)
		}
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.autoCancel != cancel {
		return false
	}
	if e != nil {
		m.auto.Error = e.Error()
		m.stopAutoLocked()
		return false
	}
	m.auto.LastAt = m.now().UTC().Format(time.RFC3339Nano)
	m.auto.LastAction = lastAction
	m.auto.Error = ""
	if c.Direction == "system-to-atomic" && m.sessions[c.Device] == s {
		st = m.states[c.Device]
		st.LastSync = &SyncResult{Source: "system", SentAt: now.UTC().Format(time.RFC3339Nano), TargetUTCTime: target.UTC().Format(time.RFC3339Nano), State: "sent"}
		m.states[c.Device] = st
	}
	return true
}
