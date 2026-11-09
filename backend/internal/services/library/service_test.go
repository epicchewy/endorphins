package library_test

import (
	"context"
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/epicchewy/endorphins/backend/internal/services/library"
	"github.com/epicchewy/endorphins/backend/internal/services/workout"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListResumesFromReturnedCursor(t *testing.T) {
	store := &pageStore{}
	service := library.New(nil, store)
	first, err := service.List(t.Context(), "alice", library.ListInput{Limit: 1})
	require.NoError(t, err)
	require.Len(t, first.Items, 1)
	assert.Equal(t, "newer", first.Items[0].ID)
	assert.Nil(t, store.before)
	require.NotEmpty(t, first.NextCursor)

	second, err := service.List(t.Context(), "alice", library.ListInput{Limit: 1, Cursor: first.NextCursor})
	require.NoError(t, err)
	require.Len(t, second.Items, 1)
	assert.Equal(t, "older", second.Items[0].ID)
	assert.Empty(t, second.NextCursor)
	assert.Equal(t, &domains.WorkoutCursor{ID: "newer", CreatedAt: time.Date(2026, 1, 2, 12, 0, 0, 0, time.UTC)}, store.before)
}

func TestListRejectsInvalidPages(t *testing.T) {
	service := library.New(nil, &pageStore{})
	for _, tt := range []struct {
		name  string
		input library.ListInput
	}{
		{"zero limit", library.ListInput{Limit: 0}},
		{"limit over 50", library.ListInput{Limit: 51}},
		{"not base64", library.ListInput{Limit: 1, Cursor: "not a cursor"}},
		{"not JSON", library.ListInput{Limit: 1, Cursor: base64.RawURLEncoding.EncodeToString([]byte("plain"))}},
		{"older version", library.ListInput{Limit: 1, Cursor: base64.RawURLEncoding.EncodeToString([]byte(`{"v":1,"createdAt":"2026-01-02T12:00:00Z","id":"newer"}`))}},
		{"missing position", library.ListInput{Limit: 1, Cursor: base64.RawURLEncoding.EncodeToString([]byte(`{"v":2,"id":"newer"}`))}},
		{"oversized", library.ListInput{Limit: 1, Cursor: strings.Repeat("a", 513)}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.List(t.Context(), "alice", tt.input)
			assert.ErrorIs(t, err, library.ErrInvalidPage)
		})
	}
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
