//go:build integration

package postgres_test

import (
	"fmt"
	"strings"
	"testing"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWorkoutsCreateConcurrentRetriesReturnOneSavedSnapshot(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewWorkouts(db)
	user, err := store.NewUsers(db).Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	type result struct {
		workout domains.SavedWorkout
		err     error
	}
	start := make(chan struct{})
	results := make(chan result, 20)
	for i := range 20 {
		go func() {
			<-start
			plan := workoutSnapshot(fmt.Sprintf("attempt-%02d", i))
			plan.EstimatedMinutes = 20 + i
			saved, err := repo.Create(t.Context(), user.ID, plan, "same-action", strings.Repeat("a", 64))
			results <- result{saved, err}
		}()
	}
	close(start)
	var received []result
	for range 20 {
		received = append(received, <-results)
	}
	for _, got := range received {
		require.NoError(t, got.err)
		assert.Equal(t, received[0].workout, got.workout)
	}
	summary, err := repo.Summary(t.Context(), user.ID, domains.WorkoutFilter{})
	require.NoError(t, err)
	assert.Equal(t, 1, summary.Count)

	replay, err := repo.Create(t.Context(), user.ID, workoutSnapshot("later-attempt"), "same-action", strings.Repeat("a", 64))
	require.NoError(t, err)
	assert.Equal(t, received[0].workout, replay)
}

func TestWorkoutsCreateBindsIdempotencyKeyToOwnerAndInput(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewWorkouts(db)
	users := store.NewUsers(db)
	alice, err := users.Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	bob, err := users.Ensure(t.Context(), "user_bob")
	require.NoError(t, err)
	saved, err := repo.Create(t.Context(), alice.ID, workoutSnapshot("original"), "same-key", strings.Repeat("a", 64))
	require.NoError(t, err)
	_, err = repo.Create(t.Context(), alice.ID, workoutSnapshot("different-input"), "same-key", strings.Repeat("b", 64))
	assert.ErrorIs(t, err, domains.ErrIdempotencyConflict)
	unchanged, err := repo.Get(t.Context(), alice.ID, "original")
	require.NoError(t, err)
	assert.Equal(t, saved, unchanged)
	other, err := repo.Create(t.Context(), bob.ID, workoutSnapshot("bob-plan"), "same-key", strings.Repeat("a", 64))
	require.NoError(t, err)
	assert.Equal(t, "bob-plan", other.ID)
}

func TestWorkoutsCreateFailureDoesNotReserveIdempotencyKey(t *testing.T) {
	db, databaseURL := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(databaseURL))
	repo := store.NewWorkouts(db)
	user, err := store.NewUsers(db).Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	_, err = db.Exec(t.Context(), `ALTER TABLE workouts ADD CONSTRAINT reject_fixture CHECK (id <> 'rejected')`)
	require.NoError(t, err)
	_, err = repo.Create(t.Context(), user.ID, workoutSnapshot("rejected"), "retry-key", strings.Repeat("a", 64))
	var rejected *pgconn.PgError
	require.ErrorAs(t, err, &rejected)
	assert.Equal(t, "23514", rejected.Code)

	saved, err := repo.Create(t.Context(), user.ID, workoutSnapshot("accepted"), "retry-key", strings.Repeat("a", 64))
	require.NoError(t, err)
	assert.Equal(t, "accepted", saved.ID)
	items, err := repo.List(t.Context(), user.ID, domains.WorkoutFilter{}, nil, 20)
	require.NoError(t, err)
	assert.Equal(t, []string{"accepted"}, workoutIDs(items))
}

func TestWorkoutsCreateRequiresCompleteIdempotencyMetadata(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewWorkouts(db)
	user, err := store.NewUsers(db).Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	for _, tt := range []struct {
		name        string
		key         string
		fingerprint string
	}{
		{"missing fingerprint", "action", ""},
		{"missing key", "", strings.Repeat("a", 64)},
		{"short fingerprint", "action", "abc"},
		{"oversized key", strings.Repeat("x", 129), strings.Repeat("a", 64)},
	} {
		t.Run(tt.name, func(t *testing.T) {
			_, err := repo.Create(t.Context(), user.ID, workoutSnapshot("invalid"), tt.key, tt.fingerprint)
			var rejected *pgconn.PgError
			require.ErrorAs(t, err, &rejected)
			assert.Equal(t, "23514", rejected.Code)
		})
	}
	for _, id := range []string{"without-key-a", "without-key-b"} {
		saved, err := repo.Create(t.Context(), user.ID, workoutSnapshot(id), "", "")
		require.NoError(t, err)
		assert.Equal(t, id, saved.ID)
	}
	summary, err := repo.Summary(t.Context(), user.ID, domains.WorkoutFilter{})
	require.NoError(t, err)
	assert.Equal(t, 2, summary.Count)
}
