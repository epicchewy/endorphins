package domains

import (
	"context"
	"errors"
	"time"
)

var ErrNotFound = errors.New("not found")

type User struct {
	ID                    string    `json:"id"`
	ClerkUserID           string    `json:"clerkUserId"`
	CreatedAt             time.Time `json:"createdAt"`
	DefaultLevel          int
	OnboardingCompletedAt *time.Time
}

type subjectKey struct{}

// WithSubject carries an already verified identity across the HTTP boundary.
func WithSubject(ctx context.Context, subject string) context.Context {
	return context.WithValue(ctx, subjectKey{}, subject)
}

func Subject(ctx context.Context) string {
	subject, _ := ctx.Value(subjectKey{}).(string)
	return subject
}

var ErrAccountDeleted = errors.New("account deleted")
var ErrIdempotencyConflict = errors.New("idempotency key already used for different input")

type AccountExport struct {
	User        User
	Workouts    []SavedWorkout
	Completions []Completion
	ExportedAt  time.Time
}
