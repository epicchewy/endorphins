//go:build integration

package postgres_test

import (
	"strings"
	"testing"

	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMigrateReapplicationPreservesAccountData(t *testing.T) {
	db := setupRepositoryTest(t)
	users, plans := store.NewUsers(db), store.NewWorkouts(db)
	user, err := users.Ensure(t.Context(), "current-owner")
	require.NoError(t, err)
	_, err = plans.Create(t.Context(), user.ID, workoutSnapshot("saved-plan"), "", "")
	require.NoError(t, err)
	_, err = plans.Complete(t.Context(), user.ID, "saved-plan", "confirmation")
	require.NoError(t, err)
	before, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)

	require.NoError(t, store.Migrate(t.Context(), db))
	require.NoError(t, store.Migrate(t.Context(), db))
	assertNoForeignKeys(t, db)
	after, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	assert.Equal(t, before.User, after.User)
	assert.Equal(t, before.Workouts, after.Workouts)
	assert.Equal(t, before.Completions, after.Completions)
}

func TestMigrateDropsLibrarySearchSchemaAndKeepsAccountData(t *testing.T) {
	db := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(t.Context(), db))
	users, plans := store.NewUsers(db), store.NewWorkouts(db)
	user, err := users.Ensure(t.Context(), "search-owner")
	require.NoError(t, err)
	_, err = plans.Create(t.Context(), user.ID, workoutSnapshot("searched-plan"), "", "")
	require.NoError(t, err)
	_, err = plans.Complete(t.Context(), user.ID, "searched-plan", "search-intent")
	require.NoError(t, err)
	before, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	restoreLibrarySearchSchema(t, db, user.ID)
	require.Len(t, remainingLibrarySearchSchema(t, db), 3)

	require.NoError(t, store.Migrate(t.Context(), db))
	require.NoError(t, store.Migrate(t.Context(), db))
	assertNoForeignKeys(t, db)
	assert.Empty(t, remainingLibrarySearchSchema(t, db))
	after, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	assert.Equal(t, before.User, after.User)
	assert.Equal(t, before.Workouts, after.Workouts)
	assert.Equal(t, before.Completions, after.Completions)
}

func TestMigrateFailureRollsBackSchemaAndCanBeRetried(t *testing.T) {
	db := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(t.Context(), db))
	user, err := store.NewUsers(db).Ensure(t.Context(), "retained-owner")
	require.NoError(t, err)
	plans := store.NewWorkouts(db)
	before, err := plans.Create(t.Context(), user.ID, workoutSnapshot("retained-plan"), "first", strings.Repeat("a", 64))
	require.NoError(t, err)
	_, err = plans.Create(t.Context(), user.ID, workoutSnapshot("second-plan"), "second", strings.Repeat("a", 64))
	require.NoError(t, err)
	restoreLibrarySearchSchema(t, db, user.ID)
	// A duplicate retry key makes AutoMigrate fail to restore the unique index,
	// after the search schema was already dropped in the same transaction.
	fixture := db.WithContext(t.Context()).Migrator()
	require.NoError(t, fixture.DropIndex("workouts", "workouts_owner_idempotency"))
	setSecondKey := func(key string) {
		require.NoError(t, db.WithContext(t.Context()).Table("workouts").
			Where(map[string]any{"id": "second-plan"}).UpdateColumn("idempotency_key", key).Error)
	}
	setSecondKey("first")

	require.ErrorContains(t, store.Migrate(t.Context(), db), "workouts_owner_idempotency")
	assert.Len(t, remainingLibrarySearchSchema(t, db), 3)
	retained, err := plans.Get(t.Context(), user.ID, "retained-plan")
	require.NoError(t, err)
	assert.Equal(t, before, retained)

	setSecondKey("second")
	require.NoError(t, store.Migrate(t.Context(), db))
	assert.Empty(t, remainingLibrarySearchSchema(t, db))
	items, err := plans.List(t.Context(), user.ID, nil, 20)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"retained-plan", "second-plan"}, workoutIDs(items))
}

// restoreLibrarySearchSchema recreates the removed search table, minutes
// column, and duration index, with one stored search term.
func restoreLibrarySearchSchema(t *testing.T, db *gorm.DB, userID string) {
	t.Helper()
	fixture := db.WithContext(t.Context()).Migrator()
	require.NoError(t, fixture.CreateTable(&removedSearchTerm{}))
	require.NoError(t, fixture.AddColumn(&removedWorkoutColumns{}, "EstimatedMinutes"))
	require.NoError(t, fixture.CreateIndex(&removedWorkoutColumns{}, "workouts_user_duration_created_id_idx"))
	require.NoError(t, db.WithContext(t.Context()).Create(&removedSearchTerm{UserID: userID, WorkoutID: "any", Name: "squat"}).Error)
}

func remainingLibrarySearchSchema(t *testing.T, db *gorm.DB) []string {
	t.Helper()
	m := db.WithContext(t.Context()).Migrator()
	var found []string
	if m.HasTable("workout_search_terms") {
		found = append(found, "workout_search_terms")
	}
	if m.HasColumn("workouts", "estimated_minutes") {
		found = append(found, "estimated_minutes")
	}
	if m.HasIndex("workouts", "workouts_user_duration_created_id_idx") {
		found = append(found, "workouts_user_duration_created_id_idx")
	}
	return found
}

func assertNoForeignKeys(t *testing.T, db *gorm.DB) {
	t.Helper()
	var count int64
	var namespace struct {
		OID uint32 `gorm:"column:oid"`
	}
	require.NoError(t, db.WithContext(t.Context()).Table("pg_namespace").
		Select("oid").Where(map[string]any{"nspname": "public"}).Take(&namespace).Error)
	require.NoError(t, db.WithContext(t.Context()).Table("pg_constraint").
		Where(map[string]any{"contype": "f", "connamespace": namespace.OID}).Count(&count).Error)
	assert.Zero(t, count, "application migrations must leave no foreign keys")
}

// These models describe the removed library search schema. Production never
// creates them.
type removedWorkoutColumns struct {
	EstimatedMinutes int `gorm:"index:workouts_user_duration_created_id_idx"`
}

func (removedWorkoutColumns) TableName() string { return "workouts" }

type removedSearchTerm struct{ UserID, WorkoutID, Name string }

func (removedSearchTerm) TableName() string { return "workout_search_terms" }
