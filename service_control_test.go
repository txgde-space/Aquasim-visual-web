package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestServiceStopFromLocalCLI(t *testing.T) {
	for _, remote := range []string{"127.0.0.1:49152", "127.0.0.2:49152", "[::1]:49152", "[::ffff:127.0.0.1]:49152"} {
		t.Run(remote, func(t *testing.T) {
			stopped := 0
			h := serviceStopHandler(func() { stopped++ })
			r := httptest.NewRequest(http.MethodPost, "/api/service/stop", nil)
			r.RemoteAddr = remote
			r.Header.Set("X-AquaSim-Control", "stop")
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code != http.StatusOK || stopped != 1 {
				t.Fatalf("status=%d stopped=%d body=%q", w.Code, stopped, w.Body.String())
			}
			var response struct {
				Service  string `json:"service"`
				Stopping bool   `json:"stopping"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if response.Service != serviceIdentity || !response.Stopping {
				t.Fatalf("unexpected stop acknowledgement: %+v", response)
			}
		})
	}
}

func TestServiceStopRejectsRemoteAndBrowserRequests(t *testing.T) {
	tests := []struct {
		name    string
		method  string
		remote  string
		control string
		headers http.Header
	}{
		{name: "GET", method: http.MethodGet, remote: "127.0.0.1:49152", control: "stop"},
		{name: "HEAD", method: http.MethodHead, remote: "127.0.0.1:49152", control: "stop"},
		{name: "preflight", method: http.MethodOptions, remote: "127.0.0.1:49152", control: "stop"},
		{name: "PUT", method: http.MethodPut, remote: "127.0.0.1:49152", control: "stop"},
		{name: "missing CLI header", remote: "127.0.0.1:49152"},
		{name: "wrong CLI header", remote: "127.0.0.1:49152", control: "restart"},
		{name: "LAN peer", remote: "192.168.1.10:49152", control: "stop"},
		{name: "IPv6 peer", remote: "[2001:db8::1]:49152", control: "stop"},
		{name: "missing peer", control: "stop"},
		{name: "malformed peer", remote: "localhost:49152", control: "stop"},
		{name: "missing peer port", remote: "127.0.0.1", control: "stop"},
		{name: "forwarded loopback", remote: "192.168.1.10:49152", control: "stop", headers: http.Header{
			"X-Forwarded-For": {"127.0.0.1"}, "X-Real-Ip": {"127.0.0.1"}, "Forwarded": {"for=127.0.0.1"},
		}},
		{name: "same origin browser", remote: "127.0.0.1:49152", control: "stop", headers: http.Header{"Origin": {"http://localhost:8080"}}},
		{name: "cross origin browser", remote: "127.0.0.1:49152", control: "stop", headers: http.Header{"Origin": {"https://example.com"}}},
		{name: "null origin", remote: "127.0.0.1:49152", control: "stop", headers: http.Header{"Origin": {"null"}}},
		{name: "empty origin", remote: "127.0.0.1:49152", control: "stop", headers: http.Header{"Origin": {""}}},
		{name: "fetch site", remote: "127.0.0.1:49152", control: "stop", headers: http.Header{"Sec-Fetch-Site": {"same-origin"}}},
		{name: "fetch mode", remote: "127.0.0.1:49152", control: "stop", headers: http.Header{"Sec-Fetch-Mode": {"cors"}}},
		{name: "empty fetch metadata", remote: "127.0.0.1:49152", control: "stop", headers: http.Header{"Sec-Fetch-Dest": {""}}},
		{name: "other fetch metadata", remote: "127.0.0.1:49152", control: "stop", headers: http.Header{"Sec-Fetch-User": {"?1"}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stopped := false
			h := serviceStopHandler(func() { stopped = true })
			method := tt.method
			if method == "" {
				method = http.MethodPost
			}
			r := httptest.NewRequest(method, "http://localhost:8080/api/service/stop", nil)
			r.RemoteAddr = tt.remote
			for name, values := range tt.headers {
				r.Header[name] = values
			}
			if tt.control != "" {
				r.Header.Set("X-AquaSim-Control", tt.control)
			}
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)
			if w.Code < 400 || w.Code >= 500 || stopped {
				t.Fatalf("status=%d stopped=%v body=%q", w.Code, stopped, w.Body.String())
			}
		})
	}
}

func TestStopTarget(t *testing.T) {
	for input, want := range map[string]string{
		"0.0.0.0:8080":         "http://127.0.0.1:8080",
		":8080":                "http://127.0.0.1:8080",
		"[::]:8080":            "http://[::1]:8080",
		"127.0.0.1:8080":       "http://127.0.0.1:8080",
		"127.0.0.2:19090":      "http://127.0.0.2:19090",
		"[::1]:19090":          "http://[::1]:19090",
		"localhost:19090":      "http://localhost:19090",
		"0.0.0.0:65535":        "http://127.0.0.1:65535",
		"[::ffff:127.0.0.1]:1": "http://[::ffff:127.0.0.1]:1",
	} {
		t.Run(input, func(t *testing.T) {
			got, err := stopTarget(input)
			if err != nil || got != want {
				t.Fatalf("stopTarget(%q) = %q, %v; want %q", input, got, err, want)
			}
		})
	}
	for _, input := range []string{
		"", "8080", "localhost", "http://localhost:8080", "127.0.0.1:", ":0", ":65536", ":-1", ":abc",
		"127.0.0.999:8080", "192.168.1.10:8080", "10.0.0.1:8080", "example.com:8080", "[2001:db8::1]:8080",
	} {
		t.Run("reject_"+input, func(t *testing.T) {
			if got, err := stopTarget(input); err == nil {
				t.Fatalf("accepted invalid or nonlocal target %q as %q", input, got)
			}
		})
	}
}
