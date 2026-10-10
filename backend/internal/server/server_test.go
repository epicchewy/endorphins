package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/epicchewy/endorphins/backend/internal/services/library"
	"github.com/labstack/echo/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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

func TestSafeErrorsAndRequestIDs(t *testing.T) {
	t.Parallel()
	for _, tt := range []struct {
		code   string
		err    error
		status int
	}{
		{code: "internal_error", err: errors.New("postgres://secret@host/private"), status: 500},
		{code: "account_deleted", err: domains.ErrAccountDeleted, status: 401},
		{code: "idempotency_conflict", err: domains.ErrIdempotencyConflict, status: 409},
		{code: "invalid_page", err: library.ErrInvalidPage, status: 400},
	} {
		t.Run(tt.code, func(t *testing.T) {
			router := New(nil, nil, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
			router.GET("/failure", func(*echo.Context) error { return tt.err })
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/failure", nil)
			req.Header.Set("X-Request-ID", "untrusted")
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)
			var body struct{ Message, Code, RequestID string }
			require.NoError(t, json.Unmarshal(res.Body.Bytes(), &body))
			assert.Equal(t, tt.status, res.Code)
			assert.Equal(t, tt.code, body.Code)
			assert.NotEmpty(t, body.RequestID)
			assert.NotEqual(t, "untrusted", body.RequestID)
			assert.Equal(t, res.Header().Get("X-Request-ID"), body.RequestID)
			assert.NotContains(t, body.Message, "secret")
		})
	}
}
