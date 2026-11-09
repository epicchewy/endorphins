//go:build integration

package postgres_test

import (
	"errors"
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

func TestMigrateFailureRollsBackSchemaAndCanBeRetried(t *testing.T) {
	db := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(t.Context(), db))
	user, err := store.NewUsers(db).Ensure(t.Context(), "retained-owner")
	require.NoError(t, err)
	plans := store.NewWorkouts(db)
	before, err := plans.Create(t.Context(), user.ID, workoutSnapshot("retained-plan"), "", "")
	require.NoError(t, err)
	fixture := db.WithContext(t.Context()).Migrator()
	require.NoError(t, fixture.DropColumn("workouts", "level"))
	require.NoError(t, fixture.CreateTable(&legacySearchTerm{}))
	// Dropping the legacy search table runs last, after AutoMigrate restores the column.
	require.NoError(t, db.Callback().Raw().Before("gorm:raw").Register("test:reject_search_cleanup", func(tx *gorm.DB) {
		if strings.Contains(tx.Statement.SQL.String(), "workout_search_terms") {
			_ = tx.AddError(errors.New("injected migration failure"))
		}
	}))
	require.ErrorContains(t, store.Migrate(t.Context(), db), "injected migration failure")
	assert.True(t, fixture.HasTable("workout_search_terms"))
	assert.False(t, fixture.HasColumn("workouts", "level"))

	require.NoError(t, db.Callback().Raw().Remove("test:reject_search_cleanup"))
	require.NoError(t, store.Migrate(t.Context(), db))
	assert.False(t, fixture.HasTable("workout_search_terms"))
	assert.True(t, fixture.HasColumn("workouts", "level"))
	retained, err := plans.Get(t.Context(), user.ID, "retained-plan")
	require.NoError(t, err)
	assert.Equal(t, before, retained)
}

func TestMigrateDropsLibrarySearchProjection(t *testing.T) {
	db := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(t.Context(), db))
	user, err := store.NewUsers(db).Ensure(t.Context(), "upgraded-owner")
	require.NoError(t, err)
	plans := store.NewWorkouts(db)
	before, err := plans.Create(t.Context(), user.ID, workoutSnapshot("upgraded-plan"), "", "")
	require.NoError(t, err)
	// Recreate the projection that releases with saved-plan search left behind.
	fixture := db.WithContext(t.Context()).Migrator()
	require.NoError(t, fixture.CreateTable(&legacySearchTerm{}))
	require.NoError(t, fixture.AddColumn(&legacyWorkout{}, "EstimatedMinutes"))

	require.NoError(t, store.Migrate(t.Context(), db))
	assert.False(t, fixture.HasTable("workout_search_terms"))
	assert.False(t, fixture.HasColumn("workouts", "estimated_minutes"))
	after, err := plans.Get(t.Context(), user.ID, "upgraded-plan")
	require.NoError(t, err)
	assert.Equal(t, before, after)
}

type legacySearchTerm struct {
	UserID    string `gorm:"primaryKey;type:uuid"`
	WorkoutID string `gorm:"primaryKey;type:text"`
	Position  int    `gorm:"primaryKey;autoIncrement:false"`
	Name      string `gorm:"type:text;not null"`
}

func (legacySearchTerm) TableName() string { return "workout_search_terms" }

type legacyWorkout struct {
	EstimatedMinutes int `gorm:"type:integer;not null;default:0"`
}

func (legacyWorkout) TableName() string { return "workouts" }

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
