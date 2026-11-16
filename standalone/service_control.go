package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const serviceIdentity = "aquasim-standalone"

// This endpoint is only for the local CLI, not browsers or LAN clients.
func serviceStopHandler(stop func()) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		ip := net.ParseIP(host)
		browser := false
		for name := range r.Header {
			name = strings.ToLower(name)
			if name == "origin" || strings.HasPrefix(name, "sec-fetch-") {
				browser = true
			}
		}
		if err != nil || ip == nil || !ip.IsLoopback() || browser || r.Header.Get("X-AquaSim-Control") != "stop" {
			http.Error(w, "Only the local AquaSim CLI can stop this service", http.StatusForbidden)
			return
		}
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", http.MethodPost)
			http.Error(w, "Use POST", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(map[string]any{"service": serviceIdentity, "stopping": true})
		stop()
	})
}

func stopTarget(addr string) (string, error) {
	host, port, err := net.SplitHostPort(addr)
	portNumber, portErr := strconv.Atoi(port)
	if err != nil || portErr != nil || portNumber < 1 || portNumber > 65535 {
		return "", fmt.Errorf("无效监听地址 %q，请使用 -listen 主机:端口", addr)
	}
	switch host {
	case "", "0.0.0.0":
		host = "127.0.0.1"
	case "::":
		host = "::1"
	case "localhost":
	default:
		if ip := net.ParseIP(host); ip == nil || !ip.IsLoopback() {
			return "", fmt.Errorf("stop 仅连接本机；请使用默认监听地址或回环地址，指定 LAN 地址运行的服务请在原终端按 Ctrl+C 停止")
		}
	}
	return "http://" + net.JoinHostPort(host, port), nil
}

// No proxy or redirects: a local stop command must not reach another machine.
func stopService(addr string) error {
	base, err := stopTarget(addr)
	if err != nil {
		return err
	}
	transport := &http.Transport{DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
		conn, e := (&net.Dialer{Timeout: time.Second}).DialContext(ctx, network, address)
		if e != nil {
			return nil, e
		}
		if peer, ok := conn.RemoteAddr().(*net.TCPAddr); !ok || !peer.IP.IsLoopback() {
			_ = conn.Close()
			return nil, fmt.Errorf("stop 仅连接本机回环地址")
		}
		return conn, nil
	}}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport, Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}}
	request := func(method, path string) (map[string]any, error) {
		req, e := http.NewRequest(method, base+path, nil)
		if e != nil {
			return nil, e
		}
		req.Header.Set("X-AquaSim-Control", "stop")
		resp, e := client.Do(req)
		if e != nil {
			return nil, e
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("服务返回 HTTP %d", resp.StatusCode)
		}
		var body map[string]any
		if e = json.NewDecoder(io.LimitReader(resp.Body, 4096)).Decode(&body); e != nil {
			return nil, fmt.Errorf("无法识别服务响应: %w", e)
		}
		if body["service"] != serviceIdentity {
			return nil, fmt.Errorf("该端口不是支持 stop 的 AquaSim 服务；旧版服务请先在原终端按 Ctrl+C 停止")
		}
		return body, nil
	}
	if _, err = request(http.MethodGet, "/api/capabilities"); err != nil {
		if errors.Is(err, syscall.ECONNREFUSED) {
			fmt.Println("AquaSim 服务未运行，无需停止。")
			return nil
		}
		return err
	}
	response, err := request(http.MethodPost, "/api/service/stop")
	if err != nil {
		return err
	}
	if response["stopping"] != true {
		return fmt.Errorf("服务未确认停止请求")
	}
	// Wait for the listener to close before reporting that the port is available.
	deadline := time.Now().Add(6 * time.Second)
	for time.Now().Before(deadline) {
		conn, e := net.DialTimeout("tcp", strings.TrimPrefix(base, "http://"), 250*time.Millisecond)
		if errors.Is(e, syscall.ECONNREFUSED) {
			fmt.Println("AquaSim 服务已停止。")
			return nil
		}
		if e != nil {
			return fmt.Errorf("已发送停止请求，无法确认退出: %w", e)
		}
		_ = conn.Close()
		time.Sleep(50 * time.Millisecond)
	}
	return fmt.Errorf("已发送停止请求，服务仍在退出中，请稍后重试")
}
