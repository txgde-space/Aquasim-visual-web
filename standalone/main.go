package main

import (
	"context"
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"log"
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
	addr := flag.String("listen", "0.0.0.0:8080", "HTTP listen address")
	home := flag.String("simulator-home", "", "Optional prepared native ns-3 directory")
	flag.Parse()
	root, e := fs.Sub(assets, "web")
	if e != nil {
		log.Fatal(e)
	}
	if _, e = fs.Stat(root, "index.html"); e != nil {
		log.Fatal("Frontend assets missing. Build with scripts/build-standalone.sh.")
	}
	manager := field.NewManager()
	defer manager.Close()
	mux := http.NewServeMux()
	mux.Handle("/api/field/", manager.Handler())
	sim := simulator.New(*home)
	defer sim.Close()
	mux.Handle("/api/run", sim)
	mux.Handle("/api/simulator/", sim)
	mux.HandleFunc("/api/capabilities", func(w http.ResponseWriter, r *http.Request) {
		field.JSON(w, 200, map[string]any{"ok": true, "runtime": "go", "fieldDevices": true, "simulator": true})
	})
	mux.Handle("/", staticHandler(root))
	server := &http.Server{Addr: *addr, Handler: field.SameOrigin(mux), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16384}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		manager.Close()
		sim.Close()
		deadline, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(deadline)
	}()
	fmt.Printf("AquaSim field server listening on %s (open /field for real experiments)\n", *addr)
	if e = server.ListenAndServe(); e != nil && e != http.ErrServerClosed {
		log.Fatal(e)
	}
}
