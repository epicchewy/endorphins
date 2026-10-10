//go:build integration

package postgres_test

import (
	"context"
	"fmt"
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

	other, err := store.Open(t.Context(), repositoryTestURL)
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
	items, err := repo.List(t.Context(), user.ID, domains.WorkoutFilter{}, nil, 20)
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
	items, err := repo.List(t.Context(), bob.ID, domains.WorkoutFilter{}, nil, 20)
	require.NoError(t, err)
	assert.Empty(t, items)

	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_, err = repo.Get(ctx, alice.ID, "alice-only")
	assert.ErrorIs(t, err, context.Canceled)
}

func TestWorkoutsListSearchesFullLibraryAndTreatsQueryLiterally(t *testing.T) {
	db := setupRepositoryTest(t)
	userID := seedWorkoutLibrary(t, db)
	repo := store.NewWorkouts(db)
	first, err := repo.List(t.Context(), userID, domains.WorkoutFilter{}, nil, 20)
	require.NoError(t, err)
	require.Len(t, first, 20)
	assert.Equal(t, "query-25", first[0].ID)
	assert.Equal(t, "query-06", first[19].ID)

	for _, tt := range []struct {
		name   string
		filter domains.WorkoutFilter
		ids    []string
	}{
		{"exercise beyond first page", domains.WorkoutFilter{Query: "rare shoulder"}, []string{"query-00"}},
		{"literal SQL wildcards", domains.WorkoutFilter{Query: "%_"}, []string{"query-01"}},
		{"SQL injection is data", domains.WorkoutFilter{Query: "' OR 1=1 --"}, []string{}},
		{"query and level intersect", domains.WorkoutFilter{Query: "squat", Level: 1}, []string{"query-25", "query-20", "query-15", "query-10", "query-05"}},
		{"case insensitive", domains.WorkoutFilter{Query: "SQUAT", Level: 1}, []string{"query-25", "query-20", "query-15", "query-10", "query-05"}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			items, err := repo.List(t.Context(), userID, tt.filter, nil, 20)
			require.NoError(t, err)
			assert.Equal(t, tt.ids, workoutIDs(items))
		})
	}
}

func TestWorkoutsListPaginatesStableTimestampAndDurationTies(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewWorkouts(db)
	user, err := store.NewUsers(db).Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	for _, row := range []struct {
		id      string
		day     int
		minutes int
	}{{"a", 1, 30}, {"b", 1, 30}, {"c", 2, 20}, {"d", 2, 30}, {"e", 3, 20}, {"f", 3, 45}} {
		plan := workoutSnapshot(row.id)
		plan.EstimatedMinutes = row.minutes
		_, err := repo.Create(t.Context(), user.ID, plan, "", "")
		require.NoError(t, err)
		err = db.WithContext(t.Context()).Table("workouts").Where(map[string]any{"id": row.id}).Update("created_at", time.Date(2026, 1, row.day, 12, 0, 0, 0, time.UTC)).Error
		require.NoError(t, err)
	}
	for _, tt := range []struct {
		sort  string
		pages [][]string
	}{
		{"newest", [][]string{{"f", "e"}, {"d", "c"}, {"b", "a"}}},
		{"shortest", [][]string{{"e", "c"}, {"d", "b"}, {"a", "f"}}},
	} {
		t.Run(tt.sort, func(t *testing.T) {
			var cursor *domains.WorkoutCursor
			for _, expected := range tt.pages {
				items, err := repo.List(t.Context(), user.ID, domains.WorkoutFilter{Sort: tt.sort}, cursor, 2)
				require.NoError(t, err)
				require.Len(t, items, 2)
				assert.Equal(t, expected, workoutIDs(items))
				last := items[1]
				cursor = &domains.WorkoutCursor{CreatedAt: last.CreatedAt, ID: last.ID, EstimatedMinutes: last.EstimatedMinutes}
			}
			items, err := repo.List(t.Context(), user.ID, domains.WorkoutFilter{Sort: tt.sort}, cursor, 2)
			require.NoError(t, err)
			assert.Empty(t, items)
		})
	}
}

func TestWorkoutsSummaryCoversAllMatchingRecords(t *testing.T) {
	db := setupRepositoryTest(t)
	userID := seedWorkoutLibrary(t, db)
	repo := store.NewWorkouts(db)
	for _, tt := range []struct {
		name     string
		filter   domains.WorkoutFilter
		expected domains.WorkoutSummary
	}{
		{"entire library", domains.WorkoutFilter{}, domains.WorkoutSummary{Count: 26, PlannedMinutes: 805, AverageMinutes: 805.0 / 26, Levels: []domains.LevelCount{{Level: 1, Count: 6}, {Level: 2, Count: 5}, {Level: 3, Count: 5}, {Level: 4, Count: 5}, {Level: 5, Count: 5}}}},
		{"duplicate matching names", domains.WorkoutFilter{Query: "legs"}, domains.WorkoutSummary{Count: 26, PlannedMinutes: 805, AverageMinutes: 805.0 / 26, Levels: []domains.LevelCount{{Level: 1, Count: 6}, {Level: 2, Count: 5}, {Level: 3, Count: 5}, {Level: 4, Count: 5}, {Level: 5, Count: 5}}}},
		{"level filter", domains.WorkoutFilter{Level: 1}, domains.WorkoutSummary{Count: 6, PlannedMinutes: 186, AverageMinutes: 31, Levels: []domains.LevelCount{{Level: 1, Count: 6}, {Level: 2}, {Level: 3}, {Level: 4}, {Level: 5}}}},
		{"exercise query", domains.WorkoutFilter{Query: "rare shoulder"}, domains.WorkoutSummary{Count: 1, PlannedMinutes: 30, AverageMinutes: 30, Levels: []domains.LevelCount{{Level: 1, Count: 1}, {Level: 2}, {Level: 3}, {Level: 4}, {Level: 5}}}},
		{"no matches", domains.WorkoutFilter{Query: "missing"}, domains.WorkoutSummary{Levels: []domains.LevelCount{{Level: 1}, {Level: 2}, {Level: 3}, {Level: 4}, {Level: 5}}}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got, err := repo.Summary(t.Context(), userID, tt.filter)
			require.NoError(t, err)
			assert.Equal(t, tt.expected, got)
		})
	}
}

func TestWorkoutsReadsRejectUnsupportedSnapshotVersion(t *testing.T) {
	db, databaseURL := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(databaseURL))
	users := store.NewUsers(db)
	user, err := users.Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	repo := store.NewWorkouts(db)
	_, err = repo.Create(t.Context(), user.ID, workoutSnapshot("future-snapshot"), "", "")
	require.NoError(t, err)
	require.NoError(t, db.WithContext(t.Context()).Migrator().DropConstraint("workouts", "workouts_snapshot_version_check"))
	require.NoError(t, db.WithContext(t.Context()).Session(&gorm.Session{AllowGlobalUpdate: true}).
		Table("workouts").Update("snapshot_version", 2).Error)
	_, err = repo.Get(t.Context(), user.ID, "future-snapshot")
	assert.ErrorContains(t, err, "unsupported snapshot version 2")
	_, err = repo.List(t.Context(), user.ID, domains.WorkoutFilter{}, nil, 20)
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

func seedWorkoutLibrary(t *testing.T, db *gorm.DB) string {
	t.Helper()
	users, repo := store.NewUsers(db), store.NewWorkouts(db)
	alice, err := users.Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	bob, err := users.Ensure(t.Context(), "user_bob")
	require.NoError(t, err)
	for i := range 26 {
		plan := workoutSnapshot(fmt.Sprintf("query-%02d", i))
		plan.Level, plan.EstimatedMinutes = i%5+1, 30+i%3
		if i == 0 {
			plan.Blocks[0].Exercises[0].Name = "Rare shoulder press"
		}
		if i == 1 {
			plan.Blocks[0].Name = "Literal 100%_effort"
		}
		_, err := repo.Create(t.Context(), alice.ID, plan, "", "")
		require.NoError(t, err)
	}
	other := workoutSnapshot("bob-private")
	other.Focus, other.EstimatedMinutes = "Rare shoulder press", 999
	_, err = repo.Create(t.Context(), bob.ID, other, "", "")
	require.NoError(t, err)
	err = db.WithContext(t.Context()).Session(&gorm.Session{AllowGlobalUpdate: true}).Table("workouts").Update("created_at", time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)).Error
	require.NoError(t, err)
	return alice.ID
}
