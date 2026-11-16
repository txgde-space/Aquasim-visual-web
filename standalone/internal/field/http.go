package field

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"sort"

	"go.bug.st/serial"
)

func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
func failure(w http.ResponseWriter, status int, e error) {
	JSON(w, status, map[string]any{"ok": false, "error": e.Error()})
}
func decode(r *http.Request, v any) error {
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		return e
	}
	if d.Decode(new(any)) != io.EOF {
		return errors.New("只允许一个 JSON 对象")
	}
	return nil
}

// Origin checking prevents another web page from issuing device commands through
// the browser. Local CLI clients without Origin remain supported.
func SameOrigin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" && r.Method != "HEAD" {
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				failure(w, 403, errors.New("拒绝跨站请求"))
				return
			}
			if origin := r.Header.Get("Origin"); origin != "" {
				u, e := url.Parse(origin)
				if e != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host != r.Host {
					failure(w, 403, errors.New("拒绝跨站请求"))
					return
				}
			}
			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		}
		next.ServeHTTP(w, r)
	})
}
func (m *Manager) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/field/status":
			if r.Method != "GET" {
				w.Header().Set("Allow", "GET")
				failure(w, 405, errors.New("仅支持 GET"))
				return
			}
			JSON(w, 200, m.Snapshot())
		case "/api/field/ports":
			if r.Method != "GET" {
				w.Header().Set("Allow", "GET")
				failure(w, 405, errors.New("仅支持 GET"))
				return
			}
			ports, e := serial.GetPortsList()
			if e != nil {
				failure(w, 500, e)
				return
			}
			if ports == nil {
				ports = []string{}
			}
			sort.Strings(ports)
			JSON(w, 200, map[string]any{"ok": true, "ports": ports})
		case "/api/field/connect":
			if r.Method != "POST" {
				w.Header().Set("Allow", "POST")
				failure(w, 405, errors.New("仅支持 POST"))
				return
			}
			var c Config
			if e := decode(r, &c); e != nil {
				failure(w, 400, e)
				return
			}
			if e := m.Connect(c); e != nil {
				failure(w, 400, e)
				return
			}
			JSON(w, 200, m.Snapshot())
		case "/api/field/disconnect":
			if r.Method != "POST" {
				w.Header().Set("Allow", "POST")
				failure(w, 405, errors.New("仅支持 POST"))
				return
			}
			var q struct {
				Device string `json:"device"`
			}
			if e := decode(r, &q); e != nil {
				failure(w, 400, e)
				return
			}
			if e := m.Disconnect(q.Device); e != nil {
				failure(w, 400, e)
				return
			}
			JSON(w, 200, m.Snapshot())
		case "/api/field/atomic-sync":
			if r.Method != "POST" {
				w.Header().Set("Allow", "POST")
				failure(w, 405, errors.New("仅支持 POST"))
				return
			}
			var q struct {
				Source string `json:"source"`
			}
			if e := decode(r, &q); e != nil {
				failure(w, 400, e)
				return
			}
			res, e := m.SyncAtomic(q.Source)
			if e != nil {
				failure(w, 400, e)
				return
			}
			JSON(w, 200, map[string]any{"ok": true, "lastSync": res, "message": "校时命令已发送；请通过后续查询确认设备时间，不代表已验证同步精度。"})
		default:
			failure(w, 404, errors.New("未知设备接口"))
		}
	})
}
