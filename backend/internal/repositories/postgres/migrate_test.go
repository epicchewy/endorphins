//go:build integration

package postgres_test

import (
	"os"
	"testing"

	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
		sql, err := os.ReadFile(name)
		require.NoError(t, err)
		_, err = db.Exec(t.Context(), string(sql))
		require.NoError(t, err)
	}
	// Simulate an already deployed version-three database. These constraints
	// are legacy test data, never part of the application's current schema.
	_, err := db.Exec(t.Context(), `ALTER TABLE workouts ADD CONSTRAINT workouts_user_id_fkey FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE;
 ALTER TABLE workouts ADD CONSTRAINT workouts_owner_id UNIQUE(user_id,id);
 ALTER TABLE workout_completions ADD CONSTRAINT workout_completions_user_id_fkey FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE;
 ALTER TABLE workout_completions ADD CONSTRAINT workout_completions_user_id_workout_id_fkey FOREIGN KEY(user_id,workout_id) REFERENCES workouts(user_id,id) ON DELETE CASCADE;
 CREATE TABLE schema_migrations(version bigint NOT NULL PRIMARY KEY,dirty boolean NOT NULL);
 INSERT INTO schema_migrations VALUES(3,false)`)
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
	var count int
	require.NoError(t, db.QueryRow(t.Context(), `SELECT (SELECT count(*) FROM workouts) + (SELECT count(*) FROM workout_completions)`).Scan(&count))
	assert.Zero(t, count)
}

func assertNoForeignKeys(t *testing.T, db *pgxpool.Pool) {
	t.Helper()
	var count int
	require.NoError(t, db.QueryRow(t.Context(), `SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE c.contype='f' AND n.nspname='public'`).Scan(&count))
	assert.Zero(t, count, "application migrations must leave no foreign keys")
}

func TestVersionTwoUpgradePreservesHistoricalPlans(t *testing.T) {
	db, databaseURL := isolatedRepositoryDatabase(t)
	for _, name := range []string{"migrations/000001_accounts_workouts.up.sql", "migrations/000002_library_lifecycle.up.sql"} {
		sql, err := os.ReadFile(name)
		require.NoError(t, err)
		_, err = db.Exec(t.Context(), string(sql))
		require.NoError(t, err)
	}
	_, err := db.Exec(t.Context(), `CREATE TABLE schema_migrations(version bigint NOT NULL PRIMARY KEY,dirty boolean NOT NULL);INSERT INTO schema_migrations VALUES(2,false)`)
	require.NoError(t, err)
	var owner string
	require.NoError(t, db.QueryRow(t.Context(), `INSERT INTO users(clerk_user_id) VALUES('historical') RETURNING id::text`).Scan(&owner))
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
