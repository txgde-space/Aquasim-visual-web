package main

import (
	"io/fs"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"testing/fstest"
)

func TestEmbeddedWebIsComplete(t *testing.T) {
	index, err := assets.ReadFile("web/index.html")
	if err != nil {
		t.Fatal(err)
	}
	for _, match := range regexp.MustCompile(`(?:src|href)="(/[^"?]+)"`).FindAllStringSubmatch(string(index), -1) {
		if _, err := fs.Stat(assets, "web"+match[1]); err != nil {
			t.Errorf("missing browser entry resource %s: %v", match[1], err)
		}
	}
	wasm := 0
	if err := fs.WalkDir(assets, "web", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !entry.IsDir() && strings.HasSuffix(name, ".wasm") {
			wasm++
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if wasm == 0 {
		t.Fatal("offline MBTiles requires embedded SQLite WASM")
	}
}

func TestStaticOfflineRoutes(t *testing.T) {
	h := staticHandler(fstest.MapFS{"index.html": {Data: []byte("<html>offline</html>")}, "assets/test.wasm": {Data: []byte{0, 97, 115, 109}}})
	for _, route := range []string{"/", "/field", "/replay"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", route, nil))
		if w.Code != 200 || w.Body.String() != "<html>offline</html>" {
			t.Fatal(route, w.Code, w.Body.String())
		}
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "/assets/test.wasm", nil))
	if w.Code != 200 || w.Header().Get("Content-Type") != "application/wasm" {
		t.Fatal(w.Code, w.Header())
	}
	for _, route := range []string{"/api/unknown", "/assets/missing.js"} {
		w := httptest.NewRecorder()
		h.ServeHTTP(w, httptest.NewRequest("GET", route, nil))
		if w.Code != 404 {
			t.Fatal(route, w.Code)
		}
	}
}
