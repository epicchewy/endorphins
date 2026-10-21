//go:build integration

package postgres_test

import (
	"context"
	"testing"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestWorkoutsCreatePersistsSnapshotAcrossConnections(t *testing.T) {
	db := setupRepositoryTest(t)
	user, err := store.NewUsers(db).Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	saved, err := store.NewWorkouts(db).Create(t.Context(), user.ID, workoutSnapshot("saved-plan"), "", "")
	require.NoError(t, err)
	assert.Equal(t, "saved-plan", saved.ID)
	assert.Equal(t, workoutSnapshot("saved-plan").WorkoutPlan, saved.WorkoutPlan)
	assert.WithinDuration(t, time.Now(), saved.CreatedAt, 5*time.Second)

	other, err := store.Open(t.Context(), repositoryTestURL, 5*time.Second)
	require.NoError(t, err)
	cleanupRepositoryDatabase(t, other)
	loaded, err := store.NewWorkouts(other).Get(t.Context(), user.ID, "saved-plan")
	require.NoError(t, err)
	assert.Equal(t, saved, loaded)
}

func TestWorkoutsCreateRejectsDuplicateIDsAndMissingOwners(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewWorkouts(db)
	user, err := store.NewUsers(db).Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	other, err := store.NewUsers(db).Ensure(t.Context(), "user_bob")
	require.NoError(t, err)
	_, err = repo.Create(t.Context(), user.ID, workoutSnapshot("existing"), "", "")
	require.NoError(t, err)

	_, err = repo.Create(t.Context(), other.ID, workoutSnapshot("existing"), "", "")
	var duplicate *pgconn.PgError
	require.ErrorAs(t, err, &duplicate)
	assert.Equal(t, "23505", duplicate.Code)
	_, err = repo.Create(t.Context(), "00000000-0000-0000-0000-000000000000", workoutSnapshot("orphan"), "", "")
	assert.ErrorIs(t, err, domains.ErrNotFound)
	var orphanCount int64
	require.NoError(t, db.WithContext(t.Context()).Table("workouts").Where(map[string]any{"id": "orphan"}).Count(&orphanCount).Error)
	assert.Zero(t, orphanCount)
	items, err := repo.List(t.Context(), user.ID, nil, 20)
	require.NoError(t, err)
	assert.Equal(t, []string{"existing"}, workoutIDs(items))
}

func TestWorkoutsGetAndListAreOwnerScoped(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewWorkouts(db)
	users := store.NewUsers(db)
	alice, err := users.Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	bob, err := users.Ensure(t.Context(), "user_bob")
	require.NoError(t, err)
	_, err = repo.Create(t.Context(), alice.ID, workoutSnapshot("alice-only"), "", "")
	require.NoError(t, err)
	owned, err := repo.Get(t.Context(), alice.ID, "alice-only")
	require.NoError(t, err)
	assert.Equal(t, "alice-only", owned.ID)
	for _, id := range []string{"alice-only", "missing", "' OR 1=1 --"} {
		_, err := repo.Get(t.Context(), bob.ID, id)
		assert.ErrorIs(t, err, domains.ErrNotFound, "id %q", id)
	}
	items, err := repo.List(t.Context(), bob.ID, nil, 20)
	require.NoError(t, err)
	assert.Empty(t, items)
	for owner, count := range map[string]int{alice.ID: 1, bob.ID: 0} {
		summary, err := repo.Summary(t.Context(), owner)
		require.NoError(t, err)
		assert.Equal(t, domains.WorkoutSummary{Count: count}, summary)
	}

	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err = repo.Get(ctx, alice.ID, "alice-only")
	assert.ErrorIs(t, err, context.Canceled)
}

func TestWorkoutsListPaginatesNewestFirstWithTimestampTies(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewWorkouts(db)
	user, err := store.NewUsers(db).Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	for _, row := range []struct {
		id  string
		day int
	}{{"a", 1}, {"b", 1}, {"c", 2}, {"d", 2}, {"e", 3}, {"f", 3}} {
		_, err := repo.Create(t.Context(), user.ID, workoutSnapshot(row.id), "", "")
		require.NoError(t, err)
		err = db.WithContext(t.Context()).Table("workouts").Where(map[string]any{"id": row.id}).Update("created_at", time.Date(2026, 1, row.day, 12, 0, 0, 0, time.UTC)).Error
		require.NoError(t, err)
	}
	var cursor *domains.WorkoutCursor
	for _, expected := range [][]string{{"f", "e"}, {"d", "c"}, {"b", "a"}} {
		items, err := repo.List(t.Context(), user.ID, cursor, 2)
		require.NoError(t, err)
		require.Len(t, items, 2)
		assert.Equal(t, expected, workoutIDs(items))
		cursor = &domains.WorkoutCursor{CreatedAt: items[1].CreatedAt, ID: items[1].ID}
	}
	items, err := repo.List(t.Context(), user.ID, cursor, 2)
	require.NoError(t, err)
	assert.Empty(t, items)
}

func TestWorkoutsReadsRejectUnsupportedSnapshotVersion(t *testing.T) {
	db := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(t.Context(), db))
	users := store.NewUsers(db)
	user, err := users.Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	repo := store.NewWorkouts(db)
	_, err = repo.Create(t.Context(), user.ID, workoutSnapshot("future-snapshot"), "", "")
	require.NoError(t, err)
	require.NoError(t, db.WithContext(t.Context()).Session(&gorm.Session{AllowGlobalUpdate: true}).
		Table("workouts").Update("snapshot_version", 2).Error)
	_, err = repo.Get(t.Context(), user.ID, "future-snapshot")
	assert.ErrorContains(t, err, "unsupported snapshot version 2")
	_, err = repo.List(t.Context(), user.ID, nil, 20)
	assert.ErrorContains(t, err, "unsupported snapshot version 2")
	_, err = users.Export(t.Context(), user.ID)
	assert.ErrorContains(t, err, "unsupported snapshot version 2")
	completion, err := repo.Complete(t.Context(), user.ID, "future-snapshot", "metadata-only")
	require.NoError(t, err)
	assert.Equal(t, 2, completion.Level)
	assert.Equal(t, "legs", completion.Focus)
}

func workoutSnapshot(id string) domains.SavedWorkout {
	return domains.SavedWorkout{ID: id, WorkoutPlan: domains.WorkoutPlan{
		Level: 2, RequestedMinutes: 45, EstimatedMinutes: 39, WarmupMinutes: 5, Focus: "legs",
		Blocks: []domains.SavedBlock{{Name: "legs", Sets: 2, EstimatedMinutes: 34, Difficulty: "hard", Exercises: []domains.Exercise{
			{Name: "Squat", Description: "Stand tall", Difficulty: "easy", Reps: 12},
			{Name: "Sprint", Difficulty: "hard", Duration: 30, Rest: 10, Rounds: 3},
		}}},
	}}
}

func workoutIDs(items []domains.SavedWorkout) []string {
	ids := make([]string, len(items))
	for i, item := range items {
		ids[i] = item.ID
	}
	return ids
}
