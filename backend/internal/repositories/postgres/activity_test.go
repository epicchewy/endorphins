//go:build integration

package postgres_test

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/epicchewy/endorphins/backend/internal/services/library"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestOnboardingCompletionRetryUndoAndErasure(t *testing.T) {
	db := setupRepositoryTest(t)
	users, plans := store.NewUsers(db), store.NewWorkouts(db)
	service := library.New(nil, plans)
	alice, err := users.Ensure(t.Context(), "alice")
	require.NoError(t, err)
	bob, err := users.Ensure(t.Context(), "bob")
	require.NoError(t, err)
	assert.Equal(t, 1, alice.DefaultLevel)
	assert.Nil(t, alice.OnboardingCompletedAt)
	alice, err = users.Update(t.Context(), alice.ID, 3, true)
	require.NoError(t, err)
	require.NotNil(t, alice.OnboardingCompletedAt)
	changed, err := users.Update(t.Context(), alice.ID, 2, true)
	require.NoError(t, err)
	assert.Equal(t, alice.OnboardingCompletedAt, changed.OnboardingCompletedAt)
	assert.Equal(t, 2, changed.DefaultLevel)
	for _, id := range []string{"one", "two"} {
		_, err = plans.Create(t.Context(), alice.ID, workoutSnapshot(id), "", "")
		require.NoError(t, err)
	}
	first, err := service.Complete(t.Context(), alice.ID, "one", "first")
	require.NoError(t, err)
	again, err := service.Complete(t.Context(), alice.ID, "one", "first")
	require.NoError(t, err)
	assert.Equal(t, first, again)
	_, err = service.Complete(t.Context(), alice.ID, "two", "first")
	assert.ErrorIs(t, err, domains.ErrIdempotencyConflict)
	_, err = service.Complete(t.Context(), bob.ID, "one", "other")
	assert.ErrorIs(t, err, domains.ErrNotFound)
	require.ErrorIs(t, service.Undo(t.Context(), bob.ID, first.ID), domains.ErrNotFound)
	second, err := service.Complete(t.Context(), alice.ID, "one", "second")
	require.NoError(t, err)
	assert.NotEqual(t, first.ID, second.ID)
	activity, err := service.Activity(t.Context(), alice.ID, "America/New_York")
	require.NoError(t, err)
	assert.Equal(t, 2, activity.CompletedCount)
	assert.Equal(t, 1, activity.ActiveDaysThisWeek)
	require.NoError(t, service.Undo(t.Context(), alice.ID, first.ID))
	undone, err := plans.Complete(t.Context(), alice.ID, "one", "first")
	require.NoError(t, err)
	require.NotNil(t, undone.UndoneAt)
	require.NoError(t, service.Undo(t.Context(), alice.ID, first.ID))
	replayed, err := plans.Complete(t.Context(), alice.ID, "one", "first")
	require.NoError(t, err)
	assert.Equal(t, undone, replayed)
	assert.ErrorIs(t, service.Undo(t.Context(), alice.ID, "missing"), domains.ErrNotFound)
	_, err = service.Complete(t.Context(), alice.ID, "one", "first")
	assert.ErrorIs(t, err, library.ErrCompletionUndone)
	activity, err = service.Activity(t.Context(), alice.ID, "America/New_York")
	require.NoError(t, err)
	assert.Equal(t, 1, activity.CompletedCount)
	exported, err := users.Export(t.Context(), alice.ID)
	require.NoError(t, err)
	assert.Len(t, exported.Workouts, 2)
	assert.Len(t, exported.Completions, 2)
	assert.Equal(t, changed, exported.User)
	_, err = plans.Complete(t.Context(), bob.ID, "one", "fk")
	assert.ErrorIs(t, err, domains.ErrNotFound)
	require.NoError(t, users.Erase(t.Context(), "alice"))
	var count int64
	require.NoError(t, db.WithContext(t.Context()).Table("workout_completions").Where(map[string]any{"user_id": alice.ID}).Count(&count).Error)
	assert.Zero(t, count)
}

func TestCompletionConcurrentRetriesCountOnce(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewWorkouts(db)
	user, err := store.NewUsers(db).Ensure(t.Context(), "racing")
	require.NoError(t, err)
	_, err = repo.Create(t.Context(), user.ID, workoutSnapshot("racing-plan"), "", "")
	require.NoError(t, err)
	type result struct {
		item domains.Completion
		err  error
	}
	results := make(chan result, 12)
	for range 12 {
		go func() {
			item, err := repo.Complete(t.Context(), user.ID, "racing-plan", "same-intent")
			results <- result{item, err}
		}()
	}
	received := make([]result, 0, 12)
	for range 12 {
		received = append(received, <-results)
	}
	for _, got := range received {
		require.NoError(t, got.err)
		assert.Equal(t, received[0].item.ID, got.item.ID)
	}
	summary, err := repo.Activity(t.Context(), user.ID, "UTC")
	require.NoError(t, err)
	assert.Equal(t, 1, summary.CompletedCount)
}

func TestActivityUsesLocalDaysAndMondayWeeksAcrossAllLogs(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewWorkouts(db)
	user, err := store.NewUsers(db).Ensure(t.Context(), "activity")
	require.NoError(t, err)
	_, err = repo.Create(t.Context(), user.ID, workoutSnapshot("plan"), "", "")
	require.NoError(t, err)
	location, err := time.LoadLocation("America/New_York")
	require.NoError(t, err)
	now := time.Now().In(location)
	monday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location).AddDate(0, 0, -(int(now.Weekday())+6)%7)
	// Two confirmations on Monday count as one active day. One second before
	// local Monday belongs to the previous week, even when its UTC day is Monday.
	dates := []time.Time{monday, monday.Add(time.Hour), monday.AddDate(0, 0, 1), monday.Add(-time.Second), monday.AddDate(0, 0, -7), monday.AddDate(0, 0, -14), monday.AddDate(0, 0, -21), monday.AddDate(0, 0, -28)}
	for i, date := range dates {
		item, err := repo.Complete(t.Context(), user.ID, "plan", fmt.Sprintf("log-%d", i))
		require.NoError(t, err)
		err = db.WithContext(t.Context()).Table("workout_completions").Where(map[string]any{"id": item.ID}).Update("completed_at", date).Error
		require.NoError(t, err)
	}
	activity, err := repo.Activity(t.Context(), user.ID, "America/New_York")
	require.NoError(t, err)
	assert.Equal(t, 8, activity.CompletedCount)
	assert.Equal(t, 2, activity.ActiveDaysThisWeek)
	assert.Equal(t, []domains.ActivityWeek{{Start: monday.AddDate(0, 0, -21).Format("2006-01-02"), Count: 1}, {Start: monday.AddDate(0, 0, -14).Format("2006-01-02"), Count: 1}, {Start: monday.AddDate(0, 0, -7).Format("2006-01-02"), Count: 2}, {Start: monday.Format("2006-01-02"), Count: 3}}, activity.Weeks)
	assert.Len(t, activity.Recent, 5)
	assert.Equal(t, monday.AddDate(0, 0, 1).UTC(), activity.Recent[0].CompletedAt.UTC())
}

func TestActivityCountsCompletionsWhenLocalMidnightIsSkipped(t *testing.T) {
	for _, tt := range []struct {
		zone, confirmation, monday string
	}{
		{"America/Santiago", "2026-09-06T12:00:00-03:00", "2026-08-31"},
		{"America/Havana", "2026-03-08T12:00:00-04:00", "2026-03-02"},
		{"Asia/Tehran", "2010-03-21T23:30:00+03:30", "2010-03-15"},
	} {
		t.Run(tt.zone, func(t *testing.T) {
			db := setupRepositoryTest(t)
			now, err := time.Parse(time.RFC3339, tt.confirmation)
			require.NoError(t, err)
			repo := store.NewWorkouts(db.Session(&gorm.Session{NowFunc: func() time.Time { return now }}))
			user, err := store.NewUsers(db).Ensure(t.Context(), "midnight-gap")
			require.NoError(t, err)
			_, err = repo.Create(t.Context(), user.ID, workoutSnapshot("plan"), "", "")
			require.NoError(t, err)
			item, err := repo.Complete(t.Context(), user.ID, "plan", "confirmation")
			require.NoError(t, err)
			require.NoError(t, db.WithContext(t.Context()).Table("workout_completions").
				Where(map[string]any{"id": item.ID}).Update("completed_at", now).Error)
			activity, err := repo.Activity(t.Context(), user.ID, tt.zone)
			require.NoError(t, err)
			assert.Equal(t, 1, activity.CompletedCount)
			assert.Equal(t, 1, activity.ActiveDaysThisWeek)
			assert.Equal(t, domains.ActivityWeek{Start: tt.monday, Count: 1}, activity.Weeks[3])
		})
	}
}

func TestCompletionConcurrentDifferentPlansWithOneKeyKeepOneWinner(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewWorkouts(db)
	user, err := store.NewUsers(db).Ensure(t.Context(), "mixed-retries")
	require.NoError(t, err)
	for _, id := range []string{"one", "two"} {
		_, err := repo.Create(t.Context(), user.ID, workoutSnapshot(id), "", "")
		require.NoError(t, err)
	}
	type result struct {
		item domains.Completion
		err  error
	}
	start := make(chan struct{})
	results := make(chan result, 12)
	for i := range 12 {
		id := []string{"one", "two"}[i%2]
		go func() {
			<-start
			item, err := repo.Complete(t.Context(), user.ID, id, "one-intent")
			results <- result{item, err}
		}()
	}
	close(start)
	received := make([]result, 0, 12)
	for range 12 {
		received = append(received, <-results)
	}
	exported, err := store.NewUsers(db).Export(t.Context(), user.ID)
	require.NoError(t, err)
	require.Len(t, exported.Completions, 1)
	winner := exported.Completions[0]
	for _, got := range received {
		if got.err == nil {
			assert.Equal(t, winner, got.item)
		} else {
			assert.ErrorIs(t, got.err, domains.ErrIdempotencyConflict)
		}
	}
	replayed, err := repo.Complete(t.Context(), user.ID, winner.WorkoutID, "one-intent")
	require.NoError(t, err)
	assert.Equal(t, winner, replayed)
}

func TestCompletionRejectsInvalidMetadataWithoutReservingRetryKey(t *testing.T) {
	for _, tt := range []struct {
		name string
		plan map[string]any
	}{
		{"missing level", map[string]any{"focus": "legs"}},
		{"missing focus", map[string]any{"level": 2}},
		{"null fields", map[string]any{"level": nil, "focus": nil}},
		{"invalid level", map[string]any{"level": "bad", "focus": "legs"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			db := setupRepositoryTest(t)
			repo := store.NewWorkouts(db)
			user, err := store.NewUsers(db).Ensure(t.Context(), "invalid-metadata")
			require.NoError(t, err)
			_, err = repo.Create(t.Context(), user.ID, workoutSnapshot("plan"), "", "")
			require.NoError(t, err)
			plan, err := json.Marshal(tt.plan)
			require.NoError(t, err)
			query := db.WithContext(t.Context()).Table("workouts").Where(map[string]any{"user_id": user.ID, "id": "plan"})
			require.NoError(t, query.Update("plan", plan).Error)
			_, err = repo.Complete(t.Context(), user.ID, "plan", "one-intent")
			require.Error(t, err)
			var count int64
			require.NoError(t, db.WithContext(t.Context()).Table("workout_completions").
				Where(map[string]any{"user_id": user.ID}).Count(&count).Error)
			assert.Zero(t, count)

			// Historical projections accepted integer levels stored as strings.
			plan, err = json.Marshal(map[string]any{"level": "2", "focus": "legs"})
			require.NoError(t, err)
			require.NoError(t, query.Update("plan", plan).Error)
			completed, err := repo.Complete(t.Context(), user.ID, "plan", "one-intent")
			require.NoError(t, err)
			assert.Equal(t, 2, completed.Level)
			assert.Equal(t, "legs", completed.Focus)
		})
	}
}
