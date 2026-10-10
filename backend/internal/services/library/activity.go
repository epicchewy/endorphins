package library

import (
	"context"
	"errors"
	"time"
	_ "time/tzdata"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

var ErrInvalidTimezone = errors.New("choose a valid time zone")
var ErrCompletionUndone = errors.New("this completion was undone")

func (s *Service) Complete(ctx context.Context, userID, workoutID, key string) (domains.Completion, error) {
	if key == "" || !validIdempotencyKey(key) {
		return domains.Completion{}, ErrInvalidKey
	}
	result, err := s.workouts.Complete(ctx, userID, workoutID, key)
	if err == nil && result.UndoneAt != nil {
		return domains.Completion{}, ErrCompletionUndone
	}
	return result, err
}

func (s *Service) Undo(ctx context.Context, userID, id string) error {
	return s.workouts.Undo(ctx, userID, id)
}

func (s *Service) Activity(ctx context.Context, userID, zone string) (domains.Activity, error) {
	if len(zone) > 100 || zone == "" || zone == "Local" {
		return domains.Activity{}, ErrInvalidTimezone
	}
	if _, err := time.LoadLocation(zone); err != nil {
		return domains.Activity{}, ErrInvalidTimezone
	}
	return s.workouts.Activity(ctx, userID, zone)
}
