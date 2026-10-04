package handlers_test

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
	"github.com/epicchewy/endorphins/backend/internal/handlers"
	"github.com/epicchewy/endorphins/backend/internal/server"
	"github.com/epicchewy/endorphins/backend/internal/services/library"
	"github.com/epicchewy/endorphins/backend/internal/services/workout"
)

func TestGenerateHTTPContract(t *testing.T) {
	t.Parallel()
	auth := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(domains.WithSubject(r.Context(), "user_test")))
		})
	}
	router := server.New(handlers.NewWorkout(testWorkouts{t: t}), handlers.NewAccount(testAccount{}), auth, slog.New(slog.NewTextHandler(io.Discard, nil)))
	for _, tt := range []struct {
		name, body, contentType string
		status                  int
	}{
		{"valid", `{"durationMinutes":45,"level":2}`, "application/json", 201},
		{"invalid range", `{"durationMinutes":10,"level":2}`, "application/json", 422},
		{"invalid level", `{"durationMinutes":30,"level":6}`, "application/json", 422},
		{"unknown property", `{"durationMinutes":30,"level":2,"admin":true}`, "application/json", 400},
		{"trailing JSON", `{"durationMinutes":30,"level":2} {}`, "application/json", 400},
		{"malformed", `{`, "application/json", 400},
		{"null", `null`, "application/json", 422},
		{"fractional duration", `{"durationMinutes":30.5,"level":2}`, "application/json", 400},
		{"wrong content type", `{}`, "text/plain", 415},
		{"oversized", `{"durationMinutes":45,"level":2,"padding":"` + strings.Repeat("x", 9000) + `"}`, "application/json", 400},
	} {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/v1/workouts", strings.NewReader(tt.body))
			req.Header.Set("Content-Type", tt.contentType)
			res := httptest.NewRecorder()
			router.ServeHTTP(res, req)
			if res.Code != tt.status {
				t.Fatalf("status %d: %s", res.Code, res.Body)
			}
			if tt.status == 201 {
				var result domains.SavedWorkout
				if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
					t.Fatal(err)
				}
				if result.EstimatedMinutes > 45 || result.WarmupMinutes != 5 || len(result.Blocks) != 3 || result.ID == "" {
					t.Fatalf("bad contract: %+v", result)
				}
				if res.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("generated plans should not be cached")
				}
			} else {
				var result map[string]any
				if err := json.Unmarshal(res.Body.Bytes(), &result); err != nil {
					t.Fatal(err)
				}
				if _, ok := result["message"].(string); !ok {
					t.Fatalf("missing public error: %s", res.Body)
				}
			}
		})
	}
}

type testAccount struct{}

func (testAccount) Resolve(context.Context, string) (domains.User, error) {
	return domains.User{ID: "test-user"}, nil
}
func (testAccount) Export(context.Context, string) (domains.AccountExport, error) {
	panic("unexpected Export call")
}

type testWorkouts struct{ t *testing.T }

func (s testWorkouts) Create(_ context.Context, owner string, input workout.GenerateInput, key string) (domains.SavedWorkout, error) {
	s.t.Helper()
	if owner != "test-user" || key != "" {
		s.t.Fatalf("unexpected owner/key: %q %q", owner, key)
	}
	if input.DurationMinutes < 30 || input.DurationMinutes > 120 || input.Level < 1 || input.Level > 5 {
		return domains.SavedWorkout{}, workout.ErrInvalidInput
	}
	return domains.SavedWorkout{ID: "saved-plan", CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC), WorkoutPlan: domains.WorkoutPlan{Level: input.Level, RequestedMinutes: input.DurationMinutes, EstimatedMinutes: 35, WarmupMinutes: 5, Focus: "legs", Blocks: []domains.SavedBlock{
		{Name: "legs", Sets: 2, EstimatedMinutes: 10, Difficulty: "easy", Exercises: []domains.Exercise{{Name: "Squat", Difficulty: "easy", Reps: 12}}},
		{Name: "upper body", Sets: 2, EstimatedMinutes: 10, Difficulty: "easy", Exercises: []domains.Exercise{{Name: "Push-up", Difficulty: "easy", Reps: 12}}},
		{Name: "core", Sets: 2, EstimatedMinutes: 10, Difficulty: "easy", Exercises: []domains.Exercise{{Name: "Crunch", Difficulty: "easy", Reps: 12}}},
	}}}, nil
}
func (testWorkouts) Get(context.Context, string, string) (domains.SavedWorkout, error) {
	panic("unexpected Get call")
}
func (testWorkouts) List(context.Context, string, library.ListInput) (domains.WorkoutPage, error) {
	panic("unexpected List call")
}
func (testWorkouts) Summary(context.Context, string, domains.WorkoutFilter) (domains.WorkoutSummary, error) {
	panic("unexpected Summary call")
}

// Unexpected internal causes stay in server logs, never in a public envelope.
func TestSafeErrorsAndRequestIDs(t *testing.T) {
	t.Parallel()
	for _, tt := range []struct {
		err    error
		status int
		code   string
	}{
		{errors.New("postgres://secret@host/private"), 500, "internal_error"},
		{domains.ErrAccountDeleted, 401, "account_deleted"},
		{domains.ErrIdempotencyConflict, 409, "idempotency_conflict"},
		{library.ErrInvalidPage, 400, "invalid_page"},
	} {
		router := server.New(handlers.NewWorkout(testWorkouts{t: t}), handlers.NewAccount(failedAccount{err: tt.err}), func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				next.ServeHTTP(w, r.WithContext(domains.WithSubject(r.Context(), "user")))
			})
		}, slog.New(slog.NewTextHandler(io.Discard, nil)))
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/api/v1/me", nil)
		req.Header.Set("X-Request-ID", "untrusted")
		res := httptest.NewRecorder()
		router.ServeHTTP(res, req)
		var body struct{ Message, Code, RequestID string }
		if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if res.Code != tt.status || body.Code != tt.code || body.RequestID == "" || body.RequestID == "untrusted" || body.RequestID != res.Header().Get("X-Request-ID") || strings.Contains(body.Message, "secret") {
			t.Fatalf("unsafe/malformed response: %d %s", res.Code, res.Body)
		}
	}
}

type failedAccount struct{ err error }

func (s failedAccount) Resolve(context.Context, string) (domains.User, error) {
	return domains.User{}, s.err
}
func (failedAccount) Export(context.Context, string) (domains.AccountExport, error) {
	panic("unexpected Export call")
}
