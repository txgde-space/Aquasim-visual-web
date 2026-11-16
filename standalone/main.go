package main

import (
	"context"
	"embed"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path"
	"strings"
	"syscall"
	"time"

	"aquasim-standalone/internal/field"
	"aquasim-standalone/internal/simulator"
)

// The build script copies the production Vue assets here before compiling.
//
//go:embed all:web
var assets embed.FS

func staticHandler(root fs.FS) http.Handler {
	files := http.FileServer(http.FS(root))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" && r.Method != "HEAD" {
			w.WriteHeader(405)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		filename := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if filename == "" {
			filename = "index.html"
		}
		if _, e := fs.Stat(root, filename); e != nil {
			if strings.Contains(path.Base(filename), ".") {
				http.NotFound(w, r)
				return
			}
			content, e := fs.ReadFile(root, "index.html")
			if e != nil {
				http.Error(w, "Frontend missing: run scripts/build-standalone.sh", 503)
				return
			}
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache")
			if r.Method != "HEAD" {
				_, _ = w.Write(content)
			}
			return
		}
		if strings.HasPrefix(filename, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}
		files.ServeHTTP(w, r)
	})
}
func main() {
	if err := run(os.Args[1:]); err != nil && !errors.Is(err, flag.ErrHelp) {
		log.Print(err)
		os.Exit(1)
	}
}

func run(args []string) error {
	stopping := len(args) > 0 && args[0] == "stop"
	if stopping {
		args = args[1:]
	}
	flags := flag.NewFlagSet("aquasim", flag.ContinueOnError)
	flags.Usage = func() {
		fmt.Fprintln(flags.Output(), "Usage: aquasim [stop] [-listen 0.0.0.0:8080] [-simulator-home path]\nDevelopment: go run . [stop] [flags]")
		flags.PrintDefaults()
	}
	addr := flags.String("listen", "0.0.0.0:8080", "HTTP listen address")
	home := flags.String("simulator-home", "", "Optional prepared native ns-3 directory")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return fmt.Errorf("未知参数 %q；停止服务请使用 stop -listen 地址", flags.Arg(0))
	}
	if stopping {
		return stopService(*addr)
	}
	root, e := fs.Sub(assets, "web")
	if e != nil {
		return e
	}
	if _, e = fs.Stat(root, "index.html"); e != nil {
		return fmt.Errorf("Frontend assets missing. Build with scripts/build-standalone.sh.")
	}
	listener, e := net.Listen("tcp", *addr)
	if e != nil {
		return fmt.Errorf("无法启动服务: %w；如需停止已有 AquaSim 服务，请使用 stop 命令", e)
	}
	defer listener.Close()
	manager := field.NewManager()
	defer manager.Close()
	mux := http.NewServeMux()
	mux.Handle("/api/field/", manager.Handler())
	sim := simulator.New(*home)
	defer sim.Close()
	mux.Handle("/api/run", sim)
	mux.Handle("/api/simulator/", sim)
	mux.HandleFunc("/api/capabilities", func(w http.ResponseWriter, r *http.Request) {
		field.JSON(w, 200, map[string]any{"ok": true, "service": serviceIdentity, "runtime": "go", "fieldDevices": true, "simulator": true})
	})
	mux.Handle("/", staticHandler(root))
	server := &http.Server{Addr: *addr, Handler: field.SameOrigin(mux), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16384}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	mux.Handle("/api/service/stop", serviceStopHandler(stop))
	shutdownDone := make(chan struct{})
	go func() {
		defer close(shutdownDone)
		<-ctx.Done()
		manager.Close()
		sim.Close()
		deadline, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(deadline); err != nil {
			_ = server.Close()
		}
	}()
	fmt.Printf("AquaSim field server listening on %s (open /field for real experiments)\n", *addr)
	fmt.Println("按 Ctrl+C 停止，或在另一个终端执行同一程序的 stop 命令（开发模式：go run . stop）。")
	e = server.Serve(listener)
	stop()
	<-shutdownDone
	if e != nil && e != http.ErrServerClosed {
		return e
	}
	return nil
}
