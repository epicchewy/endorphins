// Package library owns account-scoped generation and workout history.
package library

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/epicchewy/endorphins/backend/internal/services/workout"
)

var ErrInvalidPage = errors.New("invalid workout page")
var ErrInvalidKey = errors.New("invalid idempotency key")

func validIdempotencyKey(key string) bool {
	if len(key) > 128 {
		return false
	}
	for _, c := range key {
		if c < 33 || c > 126 {
			return false
		}
	}
	return true
}

type Generator interface {
	Generate(context.Context, workout.GenerateInput) (domains.Workout, error)
}
type Workouts interface {
	Create(context.Context, string, domains.SavedWorkout, string, string) (domains.SavedWorkout, error)
	Get(context.Context, string, string) (domains.SavedWorkout, error)
	List(context.Context, string, *domains.WorkoutCursor, int) ([]domains.SavedWorkout, error)
	Summary(context.Context, string) (domains.WorkoutSummary, error)
	Complete(context.Context, string, string, string) (domains.Completion, error)
	Undo(context.Context, string, string) error
	Activity(context.Context, string, string) (domains.Activity, error)
}
type Service struct {
	generator Generator
	workouts  Workouts
}

func New(generator Generator, workouts Workouts) *Service {
	return &Service{generator: generator, workouts: workouts}
}

func (s *Service) Create(ctx context.Context, userID string, input workout.GenerateInput, key string) (domains.SavedWorkout, error) {
	if userID == "" {
		return domains.SavedWorkout{}, fmt.Errorf("workout owner is required")
	}
	if !validIdempotencyKey(key) {
		return domains.SavedWorkout{}, ErrInvalidKey
	}
	generated, err := s.generator.Generate(ctx, input)
	if err != nil {
		return domains.SavedWorkout{}, err
	}
	fingerprint := ""
	if key != "" {
		// A versioned canonical input binds retries to exactly the requested generation.
		digest := sha256.Sum256(fmt.Appendf(nil, "v1:%d:%d", input.DurationMinutes, input.Level))
		fingerprint = hex.EncodeToString(digest[:])
	}
	return s.workouts.Create(ctx, userID, domains.Snapshot(generated), key, fingerprint)
}
func (s *Service) Get(ctx context.Context, userID, id string) (domains.SavedWorkout, error) {
	if userID == "" {
		return domains.SavedWorkout{}, fmt.Errorf("workout owner is required")
	}
	return s.workouts.Get(ctx, userID, id)
}

type ListInput struct {
	Cursor string
	Limit  int
}
type pageCursor struct {
	Version int    `json:"v"`
	Scope   string `json:"scope"`
	domains.WorkoutCursor
}

// cursorScope binds a cursor to its owner so it cannot resume another library.
func cursorScope(userID string) string {
	digest := sha256.Sum256([]byte(userID))
	return hex.EncodeToString(digest[:])
}
func (s *Service) List(ctx context.Context, userID string, input ListInput) (domains.WorkoutPage, error) {
	if userID == "" {
		return domains.WorkoutPage{}, fmt.Errorf("workout owner is required")
	}
	if input.Limit < 1 || input.Limit > 50 {
		return domains.WorkoutPage{}, ErrInvalidPage
	}
	scope := cursorScope(userID)
	var before *domains.WorkoutCursor
	if input.Cursor != "" {
		if len(input.Cursor) > 512 {
			return domains.WorkoutPage{}, ErrInvalidPage
		}
		data, err := base64.RawURLEncoding.DecodeString(input.Cursor)
		if err != nil {
			return domains.WorkoutPage{}, ErrInvalidPage
		}
		var cursor pageCursor
		if err := json.Unmarshal(data, &cursor); err != nil {
			return domains.WorkoutPage{}, ErrInvalidPage
		}
		wrongScope := cursor.Version != 1 || cursor.Scope != scope
		invalidPosition := cursor.CreatedAt.IsZero()
		invalidID := cursor.ID == "" || len(cursor.ID) > 128
		if wrongScope || invalidPosition || invalidID {
			return domains.WorkoutPage{}, ErrInvalidPage
		}
		before = &cursor.WorkoutCursor
	}
	items, err := s.workouts.List(ctx, userID, before, input.Limit+1)
	if err != nil {
		return domains.WorkoutPage{}, err
	}
	page := domains.WorkoutPage{Items: items}
	if len(items) > input.Limit {
		page.Items = items[:input.Limit]
		last := page.Items[input.Limit-1]
		data, err := json.Marshal(pageCursor{Version: 1, Scope: scope, WorkoutCursor: domains.WorkoutCursor{CreatedAt: last.CreatedAt, ID: last.ID}})
		if err != nil {
			return domains.WorkoutPage{}, fmt.Errorf("encode cursor: %w", err)
		}
		page.NextCursor = base64.RawURLEncoding.EncodeToString(data)
	}
	return page, nil
}
func (s *Service) Summary(ctx context.Context, userID string) (domains.WorkoutSummary, error) {
	if userID == "" {
		return domains.WorkoutSummary{}, fmt.Errorf("workout owner is required")
	}
	return s.workouts.Summary(ctx, userID)
}
