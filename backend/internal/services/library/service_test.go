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

func TestListNormalizesFiltersAndResumesFromReturnedCursor(t *testing.T) {
	store := &pageStore{}
	service := library.New(nil, store)
	first, err := service.List(t.Context(), "alice", library.ListInput{Limit: 1, Filter: domains.WorkoutFilter{Query: "  RARE SHOULDER  "}})
	require.NoError(t, err)
	require.Len(t, first.Items, 1)
	assert.Equal(t, "newer", first.Items[0].ID)
	assert.Equal(t, domains.WorkoutFilter{Query: "rare shoulder", Sort: "newest"}, store.filter)
	require.NotEmpty(t, first.NextCursor)

	second, err := service.List(t.Context(), "alice", library.ListInput{Limit: 1, Cursor: first.NextCursor, Filter: domains.WorkoutFilter{Query: "rare shoulder", Sort: "newest"}})
	require.NoError(t, err)
	require.Len(t, second.Items, 1)
	assert.Equal(t, "older", second.Items[0].ID)
	assert.Empty(t, second.NextCursor)
	assert.Equal(t, &domains.WorkoutCursor{ID: "newer", CreatedAt: time.Date(2026, 1, 2, 12, 0, 0, 0, time.UTC), EstimatedMinutes: 30}, store.before)
}

func TestListRejectsCursorFromAnotherOwnerOrFilter(t *testing.T) {
	service := library.New(nil, &pageStore{})
	first, err := service.List(t.Context(), "alice", library.ListInput{Limit: 1})
	require.NoError(t, err)
	require.NotEmpty(t, first.NextCursor)
	for _, tt := range []struct {
		name   string
		owner  string
		filter domains.WorkoutFilter
	}{
		{"owner", "bob", domains.WorkoutFilter{}},
		{"query", "alice", domains.WorkoutFilter{Query: "legs"}},
		{"level", "alice", domains.WorkoutFilter{Level: 1}},
		{"sort", "alice", domains.WorkoutFilter{Sort: "shortest"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.List(t.Context(), tt.owner, library.ListInput{Limit: 1, Cursor: first.NextCursor, Filter: tt.filter})
			assert.ErrorIs(t, err, library.ErrInvalidPage)
		})
	}
}

func TestSummaryRejectsInvalidFilters(t *testing.T) {
	service := library.New(nil, &pageStore{})
	for _, tt := range []struct {
		name   string
		filter domains.WorkoutFilter
	}{
		{"query longer than 200 characters", domains.WorkoutFilter{Query: strings.Repeat("é", 201)}},
		{"NUL in query", domains.WorkoutFilter{Query: "bad\x00query"}},
		{"invalid level", domains.WorkoutFilter{Level: 6}},
		{"invalid sort", domains.WorkoutFilter{Sort: "unsupported"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.Summary(t.Context(), "alice", tt.filter)
			assert.ErrorIs(t, err, library.ErrInvalidPage)
		})
	}
	store := &pageStore{}
	summary, err := library.New(nil, store).Summary(t.Context(), "alice", domains.WorkoutFilter{Query: "  LEGS  ", Level: 2})
	require.NoError(t, err)
	assert.Equal(t, domains.WorkoutSummary{Count: 1, PlannedMinutes: 30, AverageMinutes: 30}, summary)
	assert.Equal(t, domains.WorkoutFilter{Query: "legs", Level: 2, Sort: "newest"}, store.filter)
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

// Only read methods are needed to exercise paging policy. Generation and storage
// constraints have separate generator, real SQL, and full-stack coverage.
type pageStore struct {
	library.Workouts
	filter domains.WorkoutFilter
	before *domains.WorkoutCursor
}

func (s *pageStore) List(_ context.Context, _ string, filter domains.WorkoutFilter, before *domains.WorkoutCursor, _ int) ([]domains.SavedWorkout, error) {
	s.filter, s.before = filter, before
	older := domains.SavedWorkout{ID: "older", CreatedAt: time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC), WorkoutPlan: domains.WorkoutPlan{EstimatedMinutes: 45}}
	if before != nil {
		return []domains.SavedWorkout{older}, nil
	}
	return []domains.SavedWorkout{{ID: "newer", CreatedAt: time.Date(2026, 1, 2, 12, 0, 0, 0, time.UTC), WorkoutPlan: domains.WorkoutPlan{EstimatedMinutes: 30}}, older}, nil
}

func (s *pageStore) Summary(_ context.Context, _ string, filter domains.WorkoutFilter) (domains.WorkoutSummary, error) {
	s.filter = filter
	return domains.WorkoutSummary{Count: 1, PlannedMinutes: 30, AverageMinutes: 30}, nil
}
