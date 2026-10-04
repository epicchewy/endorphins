package server

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestHealthAndReadinessAreIndependent(t *testing.T) {
	t.Parallel()
	for _, tt := range []struct {
		name   string
		ready  func(context.Context) error
		status int
	}{
		{name: "missing", status: 503},
		{name: "unavailable", ready: func(context.Context) error { return errors.New("internal database address") }, status: 503},
		{name: "ready", ready: func(ctx context.Context) error {
			deadline, ok := ctx.Deadline()
			if !ok || time.Until(deadline) > 2*time.Second {
				t.Error("readiness is not bounded")
			}
			return nil
		}, status: 200},
	} {
		t.Run(tt.name, func(t *testing.T) {
			router := New(nil, nil, nil, slog.New(slog.NewTextHandler(io.Discard, nil)), Options{Ready: tt.ready})
			for _, path := range []string{"/healthz", "/readyz"} {
				req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, nil)
				res := httptest.NewRecorder()
				router.ServeHTTP(res, req)
				expected := tt.status
				if path == "/healthz" {
					expected = 200
				}
				if res.Code != expected || strings.Contains(res.Body.String(), "internal database") {
					t.Fatalf("%s: %d %s", path, res.Code, res.Body)
				}
				if path == "/readyz" && res.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("readiness may be cached")
				}
			}
		})
	}
}
