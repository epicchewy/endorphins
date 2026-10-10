//go:build integration

package postgres_test

import (
	"errors"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/source/file"
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
	migrateToVersion(t, databaseURL, 3)
	// Simulate an already deployed version-three database. These constraints
	// are legacy test data, never part of the application's current schema.
	fixture := db.WithContext(t.Context()).Migrator()
	require.NoError(t, fixture.CreateIndex(&legacyWorkout{}, "workouts_owner_id"))
	require.NoError(t, fixture.CreateConstraint(&legacyWorkout{}, "User"))
	require.NoError(t, fixture.CreateConstraint(&legacyCompletion{}, "User"))
	require.NoError(t, fixture.CreateConstraint(&legacyCompletion{}, "Workout"))
	users, plans := store.NewUsers(db), store.NewWorkouts(db)
	user, err := users.Ensure(t.Context(), "legacy-owner")
	require.NoError(t, err)
	createHistoricalWorkout(t, db, user.ID, "legacy-plan")
	_, err = plans.Complete(t.Context(), user.ID, "legacy-plan", "legacy-intent")
	require.NoError(t, err)
	before, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	require.NoError(t, store.Migrate(databaseURL))
	db, err = store.Open(t.Context(), databaseURL)
	require.NoError(t, err)
	cleanupRepositoryDatabase(t, db)
	users = store.NewUsers(db)
	require.NoError(t, store.CheckReady(t.Context(), db))
	assertNoForeignKeys(t, db)
	after, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	assert.Equal(t, before.User, after.User)
	assert.Equal(t, before.Workouts, after.Workouts)
	assert.Equal(t, before.Completions, after.Completions)
	require.NoError(t, users.Erase(t.Context(), "legacy-owner"))
	for _, table := range []string{"workouts", "workout_completions", "workout_search_terms"} {
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
	migrateToVersion(t, databaseURL, 2)
	var historical struct{ ID, ClerkUserID string }
	historical.ClerkUserID = "historical"
	require.NoError(t, db.WithContext(t.Context()).Table("users").Select("clerk_user_id").
		Clauses(clause.Returning{Columns: []clause.Column{{Name: "id"}}}).Create(&historical).Error)
	owner := historical.ID
	plans := store.NewWorkouts(db)
	createHistoricalWorkout(t, db, owner, "historical-plan")
	original, err := plans.Get(t.Context(), owner, "historical-plan")
	require.NoError(t, err)
	require.NoError(t, store.Migrate(databaseURL))
	db, err = store.Open(t.Context(), databaseURL)
	require.NoError(t, err)
	cleanupRepositoryDatabase(t, db)
	plans = store.NewWorkouts(db)
	require.NoError(t, store.CheckReady(t.Context(), db))
	restored, err := plans.Get(t.Context(), owner, "historical-plan")
	require.NoError(t, err)
	assert.Equal(t, original, restored)
	for _, query := range []string{"legs", "squat", "sprint"} {
		filter := domains.WorkoutFilter{Query: query, Level: 2, Sort: "shortest"}
		items, err := plans.List(t.Context(), owner, filter, nil, 20)
		require.NoError(t, err)
		assert.Equal(t, []domains.SavedWorkout{original}, items, query)
		summary, err := plans.Summary(t.Context(), owner, filter)
		require.NoError(t, err)
		assert.Equal(t, 1, summary.Count, query)
		assert.Equal(t, 39, summary.PlannedMinutes, query)
	}
	user, err := store.NewUsers(db).Ensure(t.Context(), "historical")
	require.NoError(t, err)
	assert.Equal(t, owner, user.ID)
	assert.Equal(t, 1, user.DefaultLevel)
	assert.Nil(t, user.OnboardingCompletedAt)
	_, err = plans.Complete(t.Context(), owner, "historical-plan", "after-upgrade")
	require.NoError(t, err)
}

func TestQueryFieldRollbackAndReapplyPreserveAccountData(t *testing.T) {
	db, databaseURL := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(databaseURL))
	users, plans := store.NewUsers(db), store.NewWorkouts(db)
	user, err := users.Ensure(t.Context(), "rollback-owner")
	require.NoError(t, err)
	_, err = plans.Create(t.Context(), user.ID, workoutSnapshot("rollback-plan"), "retry-key", strings.Repeat("a", 64))
	require.NoError(t, err)
	_, err = plans.Complete(t.Context(), user.ID, "rollback-plan", "completion-key")
	require.NoError(t, err)
	before, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)

	migrateToVersion(t, databaseURL, 4)
	assert.False(t, db.Migrator().HasTable("workout_search_terms"))
	assert.False(t, db.Migrator().HasColumn("workouts", "estimated_minutes"))
	assert.False(t, db.Migrator().HasColumn("workouts", "level"))
	require.NoError(t, store.Migrate(databaseURL))
	upgraded, err := store.Open(t.Context(), databaseURL)
	require.NoError(t, err)
	cleanupRepositoryDatabase(t, upgraded)
	require.NoError(t, store.CheckReady(t.Context(), upgraded))
	after, err := store.NewUsers(upgraded).Export(t.Context(), user.ID)
	require.NoError(t, err)
	assert.Equal(t, before.User, after.User)
	assert.Equal(t, before.Workouts, after.Workouts)
	assert.Equal(t, before.Completions, after.Completions)
	items, err := store.NewWorkouts(upgraded).List(t.Context(), user.ID, domains.WorkoutFilter{Query: "squat"}, nil, 20)
	require.NoError(t, err)
	assert.Equal(t, before.Workouts, items)
}

func createHistoricalWorkout(t *testing.T, db *gorm.DB, owner, id string) {
	t.Helper()
	// Literal v1 JSON protects the historical storage contract from Go type changes.
	row := legacyWorkout{ID: id, UserID: owner, Plan: []byte(`{
		"level": 2, "requestedMinutes": 45, "estimatedMinutes": 39,
		"warmupMinutes": 5, "focus": "legs", "blocks": [{
			"name": "legs", "sets": 2, "estimatedMinutes": 34, "difficulty": "hard",
			"exercises": [
				{"name": "Squat", "description": "Stand tall", "difficulty": "easy", "reps": 12},
				{"name": "Sprint", "difficulty": "hard", "duration": 30, "rest": 10, "rounds": 3}
			]
		}]
	}`)}
	require.NoError(t, db.WithContext(t.Context()).Select("id", "user_id", "plan").Create(&row).Error)
}

func migrateToVersion(t *testing.T, databaseURL string, version uint) {
	t.Helper()
	parsed, err := url.Parse(databaseURL)
	require.NoError(t, err)
	parsed.Scheme = "pgx5"
	m, err := migrate.New("file://migrations", parsed.String())
	require.NoError(t, err)
	t.Cleanup(func() {
		sourceErr, databaseErr := m.Close()
		require.NoError(t, errors.Join(sourceErr, databaseErr))
	})
	require.NoError(t, m.Migrate(version))
}

// These models describe legacy relationships only. Production never creates them.
type legacyUser struct {
	ID string `gorm:"primaryKey;type:uuid"`
}

func (legacyUser) TableName() string { return "users" }

type legacyWorkout struct {
	ID              string     `gorm:"primaryKey;uniqueIndex:workouts_owner_id"`
	UserID          string     `gorm:"type:uuid;uniqueIndex:workouts_owner_id"`
	User            legacyUser `gorm:"foreignKey:UserID;references:ID;constraint:workouts_user_id_fkey,OnDelete:CASCADE"`
	CreatedAt       time.Time  `gorm:"autoCreateTime:false;default:(-)"`
	SnapshotVersion int        `gorm:"default:(-)"`
	Plan            []byte     `gorm:"type:jsonb"`
}

func (legacyWorkout) TableName() string { return "workouts" }

type legacyCompletion struct {
	UserID    string `gorm:"type:uuid"`
	WorkoutID string
	User      legacyUser    `gorm:"foreignKey:UserID;references:ID;constraint:workout_completions_user_id_fkey,OnDelete:CASCADE"`
	Workout   legacyWorkout `gorm:"foreignKey:UserID,WorkoutID;references:UserID,ID;constraint:workout_completions_user_id_workout_id_fkey,OnDelete:CASCADE"`
}

func (legacyCompletion) TableName() string { return "workout_completions" }
