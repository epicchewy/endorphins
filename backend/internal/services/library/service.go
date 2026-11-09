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
	"time"

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
	Count(context.Context, string) (int, error)
	Complete(context.Context, string, string, string) (domains.Completion, error)
	Undo(context.Context, string, string) error
	Activity(context.Context, string, *time.Location) (domains.Activity, error)
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

func (s *Service) List(ctx context.Context, userID string, input ListInput) (domains.WorkoutPage, error) {
	if userID == "" {
		return domains.WorkoutPage{}, fmt.Errorf("workout owner is required")
	}
	if input.Limit < 1 || input.Limit > 50 {
		return domains.WorkoutPage{}, ErrInvalidPage
	}
	before, err := decodeCursor(input.Cursor)
	if err != nil {
		return domains.WorkoutPage{}, err
	}
	items, err := s.workouts.List(ctx, userID, before, input.Limit+1)
	if err != nil {
		return domains.WorkoutPage{}, err
	}
	page := domains.WorkoutPage{Items: items}
	if len(items) > input.Limit {
		page.Items = items[:input.Limit]
		last := page.Items[input.Limit-1]
		page.NextCursor, err = encodeCursor(domains.WorkoutCursor{CreatedAt: last.CreatedAt, ID: last.ID})
		if err != nil {
			return domains.WorkoutPage{}, err
		}
	}
	return page, nil
}

// pageCursor is the opaque newest-first position. Cursors are positions, not
// credentials: every store query still checks the owner.
type pageCursor struct {
	Version   int       `json:"v"`
	CreatedAt time.Time `json:"createdAt"`
	ID        string    `json:"id"`
}

func encodeCursor(position domains.WorkoutCursor) (string, error) {
	data, err := json.Marshal(pageCursor{Version: 2, CreatedAt: position.CreatedAt, ID: position.ID})
	if err != nil {
		return "", fmt.Errorf("encode cursor: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

// decodeCursor returns nil for the first page.
func decodeCursor(value string) (*domains.WorkoutCursor, error) {
	if value == "" {
		return nil, nil
	}
	if len(value) > 512 {
		return nil, ErrInvalidPage
	}
	data, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, ErrInvalidPage
	}
	var cursor pageCursor
	if err := json.Unmarshal(data, &cursor); err != nil {
		return nil, ErrInvalidPage
	}
	if cursor.Version != 2 || cursor.CreatedAt.IsZero() || cursor.ID == "" || len(cursor.ID) > 128 {
		return nil, ErrInvalidPage
	}
	return &domains.WorkoutCursor{CreatedAt: cursor.CreatedAt, ID: cursor.ID}, nil
}

// Count reports how many plans the account has saved.
func (s *Service) Count(ctx context.Context, userID string) (int, error) {
	if userID == "" {
		return 0, fmt.Errorf("workout owner is required")
	}
	return s.workouts.Count(ctx, userID)
}
