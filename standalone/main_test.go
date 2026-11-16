package main

import (
	"net/http/httptest"
	"testing"
	"testing/fstest"
)

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
