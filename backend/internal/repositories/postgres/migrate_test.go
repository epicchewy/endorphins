//go:build integration

package postgres_test

import (
	"errors"
	"fmt"
	"testing"

	"github.com/epicchewy/endorphins/backend/internal/domains"
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

func TestMigrateUpgradesExistingPlansAndRemovesLegacyConstraints(t *testing.T) {
	db := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(t.Context(), db))
	users, plans := store.NewUsers(db), store.NewWorkouts(db)
	user, err := users.Ensure(t.Context(), "legacy-owner")
	require.NoError(t, err)
	_, err = plans.Create(t.Context(), user.ID, workoutSnapshot("legacy-plan"), "", "")
	require.NoError(t, err)
	_, err = plans.Complete(t.Context(), user.ID, "legacy-plan", "legacy-intent")
	require.NoError(t, err)
	require.NoError(t, users.Erase(t.Context(), "previously-deleted"))
	before, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	other, err := users.Ensure(t.Context(), "batch-owner")
	require.NoError(t, err)
	for i := range 102 {
		_, err = plans.Create(t.Context(), other.ID, workoutSnapshot(fmt.Sprintf("batch-%03d", i)), "", "")
		require.NoError(t, err)
	}
	// Projection must ignore unrelated fields and preserve the original JSON.
	preserved := []byte(`{"level":"2","estimatedMinutes":"39","requestedMinutes":"45","focus":"legs","blocks":[{"name":"legs","exercises":[{"name":"Squat"}]}]}`)
	require.NoError(t, db.WithContext(t.Context()).Table("workouts").
		Where(map[string]any{"user_id": other.ID, "id": "batch-000"}).UpdateColumn("plan", preserved).Error)

	// Recreate the old schema shape with GORM, without storing migration history.
	fixture := db.WithContext(t.Context()).Migrator()
	require.NoError(t, fixture.DropTable("workout_search_terms"))
	require.NoError(t, fixture.DropColumn("workouts", "level"))
	require.NoError(t, fixture.DropColumn("workouts", "estimated_minutes"))
	require.NoError(t, fixture.CreateTable(&legacyMigrationState{}))
	require.NoError(t, fixture.RenameIndex("users", "uni_users_clerk_user_id", "users_clerk_user_id_key"))
	require.NoError(t, fixture.CreateIndex(&legacyWorkout{}, "workouts_owner_id"))
	require.NoError(t, fixture.CreateConstraint(&legacyWorkout{}, "User"))
	require.NoError(t, fixture.CreateConstraint(&legacyCompletion{}, "User"))
	require.NoError(t, fixture.CreateConstraint(&legacyCompletion{}, "Workout"))

	require.NoError(t, store.Migrate(t.Context(), db))
	require.NoError(t, store.Migrate(t.Context(), db))
	assertNoForeignKeys(t, db)
	assert.False(t, db.Migrator().HasTable("schema_migrations"))
	assert.False(t, db.Migrator().HasIndex("workouts", "workouts_owner_id"))
	after, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	assert.Equal(t, before.User, after.User)
	assert.Equal(t, before.Workouts, after.Workouts)
	assert.Equal(t, before.Completions, after.Completions)
	for _, query := range []string{"legs", "squat", "sprint"} {
		filter := domains.WorkoutFilter{Query: query, Level: 2, Sort: "shortest"}
		items, err := plans.List(t.Context(), user.ID, filter, nil, 20)
		require.NoError(t, err)
		assert.Equal(t, before.Workouts, items, query)
		summary, err := plans.Summary(t.Context(), user.ID, filter)
		require.NoError(t, err)
		assert.Equal(t, 1, summary.Count, query)
		assert.Equal(t, 39, summary.PlannedMinutes, query)
	}
	summary, err := plans.Summary(t.Context(), other.ID, domains.WorkoutFilter{Query: "squat", Level: 2})
	require.NoError(t, err)
	assert.Equal(t, 102, summary.Count)
	assert.Equal(t, 102*39, summary.PlannedMinutes)
	var stored struct{ Plan []byte }
	require.NoError(t, db.WithContext(t.Context()).Table("workouts").
		Where(map[string]any{"user_id": other.ID, "id": "batch-000"}).Take(&stored).Error)
	assert.JSONEq(t, string(preserved), string(stored.Plan))

	_, err = users.Ensure(t.Context(), "previously-deleted")
	assert.ErrorIs(t, err, domains.ErrAccountDeleted)
	require.NoError(t, users.Erase(t.Context(), "legacy-owner"))
	for _, table := range []string{"workouts", "workout_completions", "workout_search_terms"} {
		var count int64
		require.NoError(t, db.WithContext(t.Context()).Table(table).Where(map[string]any{"user_id": user.ID}).Count(&count).Error)
		assert.Zero(t, count, table)
	}
}

func TestMigrateFailureRollsBackSchemaAndCanBeRetried(t *testing.T) {
	db := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(t.Context(), db))
	user, err := store.NewUsers(db).Ensure(t.Context(), "retained-owner")
	require.NoError(t, err)
	plans := store.NewWorkouts(db)
	before, err := plans.Create(t.Context(), user.ID, workoutSnapshot("retained-plan"), "", "")
	require.NoError(t, err)
	fixture := db.WithContext(t.Context()).Migrator()
	require.NoError(t, fixture.DropTable("workout_search_terms"))
	require.NoError(t, fixture.DropColumn("workouts", "level"))
	require.NoError(t, fixture.DropColumn("workouts", "estimated_minutes"))
	require.NoError(t, fixture.CreateTable(&legacyMigrationState{}))
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register("test:reject_backfill", func(tx *gorm.DB) {
		if tx.Statement.Table == "workout_search_terms" {
			_ = tx.AddError(errors.New("injected backfill failure"))
		}
	}))
	require.ErrorContains(t, store.Migrate(t.Context(), db), "injected backfill failure")
	assert.False(t, fixture.HasTable("workout_search_terms"))
	assert.False(t, fixture.HasColumn("workouts", "level"))
	assert.False(t, fixture.HasColumn("workouts", "estimated_minutes"))
	assert.True(t, fixture.HasTable("schema_migrations"))
	retained, err := plans.Get(t.Context(), user.ID, "retained-plan")
	require.NoError(t, err)
	assert.Equal(t, before, retained)

	require.NoError(t, db.Callback().Create().Remove("test:reject_backfill"))
	require.NoError(t, store.Migrate(t.Context(), db))
	items, err := plans.List(t.Context(), user.ID, domains.WorkoutFilter{Query: "squat"}, nil, 20)
	require.NoError(t, err)
	assert.Equal(t, []domains.SavedWorkout{before}, items)
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

type legacyMigrationState struct {
	Version int
	Dirty   bool
}

func (legacyMigrationState) TableName() string { return "schema_migrations" }

// These models describe legacy relationships only. Production never creates them.
type legacyUser struct {
	ID string `gorm:"primaryKey;type:uuid"`
}

func (legacyUser) TableName() string { return "users" }

type legacyWorkout struct {
	ID     string     `gorm:"primaryKey;uniqueIndex:workouts_owner_id"`
	UserID string     `gorm:"type:uuid;uniqueIndex:workouts_owner_id"`
	User   legacyUser `gorm:"foreignKey:UserID;references:ID;constraint:workouts_user_id_fkey,OnDelete:CASCADE"`
}

func (legacyWorkout) TableName() string { return "workouts" }

type legacyCompletion struct {
	UserID    string `gorm:"type:uuid"`
	WorkoutID string
	User      legacyUser    `gorm:"foreignKey:UserID;references:ID;constraint:workout_completions_user_id_fkey,OnDelete:CASCADE"`
	Workout   legacyWorkout `gorm:"foreignKey:UserID,WorkoutID;references:UserID,ID;constraint:workout_completions_user_id_workout_id_fkey,OnDelete:CASCADE"`
}

func (legacyCompletion) TableName() string { return "workout_completions" }
