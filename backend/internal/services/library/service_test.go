package library_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/epicchewy/endorphins/backend/internal/services/library"
	"github.com/epicchewy/endorphins/backend/internal/services/workout"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListResumesFromReturnedCursorForTheSameOwner(t *testing.T) {
	store := &pageStore{}
	service := library.New(nil, store)
	first, err := service.List(t.Context(), "alice", library.ListInput{Limit: 1})
	require.NoError(t, err)
	require.Len(t, first.Items, 1)
	assert.Equal(t, "newer", first.Items[0].ID)
	require.NotEmpty(t, first.NextCursor)

	_, err = service.List(t.Context(), "bob", library.ListInput{Limit: 1, Cursor: first.NextCursor})
	assert.ErrorIs(t, err, library.ErrInvalidPage)

	second, err := service.List(t.Context(), "alice", library.ListInput{Limit: 1, Cursor: first.NextCursor})
	require.NoError(t, err)
	require.Len(t, second.Items, 1)
	assert.Equal(t, "older", second.Items[0].ID)
	assert.Empty(t, second.NextCursor)
	assert.Equal(t, &domains.WorkoutCursor{ID: "newer", CreatedAt: time.Date(2026, 1, 2, 12, 0, 0, 0, time.UTC)}, store.before)
}

func TestCreateRejectsInvalidIdempotencyKeys(t *testing.T) {
	service := library.New(nil, nil)
	for _, tt := range []struct {
		name string
		key  string
	}{
		{"space", "bad key"},
		{"over 128 bytes", strings.Repeat("x", 129)},
		{"non ASCII", "é"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.Create(t.Context(), "alice", workout.GenerateInput{DurationMinutes: 45, Level: 2}, tt.key)
			assert.ErrorIs(t, err, library.ErrInvalidKey)
		})
	}
}

// Only List is needed to exercise paging policy. Generation and storage
// constraints have separate generator, real SQL, and full-stack coverage.
type pageStore struct {
	library.Workouts
	before *domains.WorkoutCursor
}

func (s *pageStore) List(_ context.Context, _ string, before *domains.WorkoutCursor, _ int) ([]domains.SavedWorkout, error) {
	s.before = before
	older := domains.SavedWorkout{ID: "older", CreatedAt: time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)}
	if before != nil {
		return []domains.SavedWorkout{older}, nil
	}
	return []domains.SavedWorkout{{ID: "newer", CreatedAt: time.Date(2026, 1, 2, 12, 0, 0, 0, time.UTC)}, older}, nil
}
