//go:build integration

package postgres_test

import (
	"testing"

	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func TestMigrateReapplicationPreservesAccountsAndWorkouts(t *testing.T) {
	db := setupRepositoryTest(t)
	users, workouts := store.NewUsers(db), store.NewWorkouts(db)
	user, err := users.Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	_, err = workouts.Create(t.Context(), user.ID, workoutSnapshot("saved-before-migrate"), "", "")
	require.NoError(t, err)
	require.NoError(t, store.Migrate(repositoryTestURL))
	require.NoError(t, store.CheckReady(t.Context(), db))
	assertNoForeignKeys(t, db)
	exported, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	assert.Equal(t, user, exported.User)
	assert.Equal(t, []string{"saved-before-migrate"}, workoutIDs(exported.Workouts))
}

func TestVersionThreeUpgradeRemovesLegacyRelationshipsWithoutLosingData(t *testing.T) {
	db, databaseURL := isolatedRepositoryDatabase(t)
	for _, name := range []string{"migrations/000001_accounts_workouts.up.sql", "migrations/000002_library_lifecycle.up.sql", "migrations/000003_onboarding_activity.up.sql"} {
		sql, err := testMigrationFiles.ReadFile(name)
		require.NoError(t, err)
		err = db.WithContext(t.Context()).Exec(string(sql)).Error
		require.NoError(t, err)
	}
	// Simulate an already deployed version-three database. These constraints
	// are legacy test data, never part of the application's current schema.
	err := db.WithContext(t.Context()).Exec(testLegacyVersionThreeSQL).Error
	require.NoError(t, err)
	users, plans := store.NewUsers(db), store.NewWorkouts(db)
	user, err := users.Ensure(t.Context(), "legacy-owner")
	require.NoError(t, err)
	_, err = plans.Create(t.Context(), user.ID, workoutSnapshot("legacy-plan"), "", "")
	require.NoError(t, err)
	_, err = plans.Complete(t.Context(), user.ID, "legacy-plan", "legacy-intent")
	require.NoError(t, err)
	before, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	require.NoError(t, store.Migrate(databaseURL))
	require.NoError(t, store.CheckReady(t.Context(), db))
	assertNoForeignKeys(t, db)
	after, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	assert.Equal(t, before.User, after.User)
	assert.Equal(t, before.Workouts, after.Workouts)
	assert.Equal(t, before.Completions, after.Completions)
	require.NoError(t, users.Erase(t.Context(), "legacy-owner"))
	for _, table := range []string{"workouts", "workout_completions"} {
		var count int64
		require.NoError(t, db.WithContext(t.Context()).Table(table).Count(&count).Error)
		assert.Zero(t, count, table)
	}
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

func TestVersionTwoUpgradePreservesHistoricalPlans(t *testing.T) {
	db, databaseURL := isolatedRepositoryDatabase(t)
	for _, name := range []string{"migrations/000001_accounts_workouts.up.sql", "migrations/000002_library_lifecycle.up.sql"} {
		sql, err := testMigrationFiles.ReadFile(name)
		require.NoError(t, err)
		err = db.WithContext(t.Context()).Exec(string(sql)).Error
		require.NoError(t, err)
	}
	err := db.WithContext(t.Context()).Exec(testLegacyVersionTwoSQL).Error
	require.NoError(t, err)
	var historical struct{ ID, ClerkUserID string }
	historical.ClerkUserID = "historical"
	require.NoError(t, db.WithContext(t.Context()).Table("users").Select("clerk_user_id").
		Clauses(clause.Returning{Columns: []clause.Column{{Name: "id"}}}).Create(&historical).Error)
	owner := historical.ID
	plans := store.NewWorkouts(db)
	original, err := plans.Create(t.Context(), owner, workoutSnapshot("historical-plan"), "", "")
	require.NoError(t, err)
	require.NoError(t, store.Migrate(databaseURL))
	require.NoError(t, store.CheckReady(t.Context(), db))
	restored, err := plans.Get(t.Context(), owner, "historical-plan")
	require.NoError(t, err)
	assert.Equal(t, original, restored)
	user, err := store.NewUsers(db).Ensure(t.Context(), "historical")
	require.NoError(t, err)
	assert.Equal(t, owner, user.ID)
	assert.Equal(t, 1, user.DefaultLevel)
	assert.Nil(t, user.OnboardingCompletedAt)
	_, err = plans.Complete(t.Context(), owner, "historical-plan", "after-upgrade")
	require.NoError(t, err)
}
