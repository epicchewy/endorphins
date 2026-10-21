//go:build integration

package postgres_test

import (
	"strings"
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

func TestMigrateUpgradesOldSchemaAndRemovesLegacyConstraints(t *testing.T) {
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

	// Recreate the old schema shape with GORM, without storing migration history.
	restoreLibrarySearchSchema(t, db, user.ID)
	fixture := db.WithContext(t.Context()).Migrator()
	require.NoError(t, fixture.CreateTable(&legacyMigrationState{}))
	require.NoError(t, fixture.RenameIndex("users", "uni_users_clerk_user_id", "users_clerk_user_id_key"))
	require.NoError(t, fixture.CreateIndex(&legacyWorkout{}, "workouts_owner_id"))
	require.NoError(t, fixture.CreateConstraint(&legacyWorkout{}, "User"))
	require.NoError(t, fixture.CreateConstraint(&legacyCompletion{}, "User"))
	require.NoError(t, fixture.CreateConstraint(&legacyCompletion{}, "Workout"))

	require.NoError(t, store.Migrate(t.Context(), db))
	require.NoError(t, store.Migrate(t.Context(), db))
	assertNoForeignKeys(t, db)
	assert.Empty(t, remainingLibrarySearchSchema(t, db))
	assert.False(t, db.Migrator().HasTable("schema_migrations"))
	assert.False(t, db.Migrator().HasIndex("workouts", "workouts_owner_id"))
	after, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	assert.Equal(t, before.User, after.User)
	assert.Equal(t, before.Workouts, after.Workouts)
	assert.Equal(t, before.Completions, after.Completions)

	_, err = users.Ensure(t.Context(), "previously-deleted")
	assert.ErrorIs(t, err, domains.ErrAccountDeleted)
	require.NoError(t, users.Erase(t.Context(), "legacy-owner"))
	for _, table := range []string{"workouts", "workout_completions"} {
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
	before, err := plans.Create(t.Context(), user.ID, workoutSnapshot("retained-plan"), "first", strings.Repeat("a", 64))
	require.NoError(t, err)
	_, err = plans.Create(t.Context(), user.ID, workoutSnapshot("second-plan"), "second", strings.Repeat("a", 64))
	require.NoError(t, err)
	restoreLibrarySearchSchema(t, db, user.ID)
	fixture := db.WithContext(t.Context()).Migrator()
	require.NoError(t, fixture.CreateTable(&legacyMigrationState{}))
	// A duplicate retry key makes AutoMigrate fail to restore the unique index.
	require.NoError(t, fixture.DropIndex("workouts", "workouts_owner_idempotency"))
	setSecondKey := func(key string) {
		require.NoError(t, db.WithContext(t.Context()).Table("workouts").
			Where(map[string]any{"id": "second-plan"}).UpdateColumn("idempotency_key", key).Error)
	}
	setSecondKey("first")

	require.ErrorContains(t, store.Migrate(t.Context(), db), "workouts_owner_idempotency")
	assert.Len(t, remainingLibrarySearchSchema(t, db), 4)
	assert.True(t, fixture.HasTable("schema_migrations"))
	retained, err := plans.Get(t.Context(), user.ID, "retained-plan")
	require.NoError(t, err)
	assert.Equal(t, before, retained)

	setSecondKey("second")
	require.NoError(t, store.Migrate(t.Context(), db))
	assert.Empty(t, remainingLibrarySearchSchema(t, db))
	assert.False(t, fixture.HasTable("schema_migrations"))
	items, err := plans.List(t.Context(), user.ID, nil, 20)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"retained-plan", "second-plan"}, workoutIDs(items))
}

// restoreLibrarySearchSchema recreates the removed search table, projection
// columns, and duration index, with one stored search term.
func restoreLibrarySearchSchema(t *testing.T, db *gorm.DB, userID string) {
	t.Helper()
	fixture := db.WithContext(t.Context()).Migrator()
	require.NoError(t, fixture.CreateTable(&legacySearchTerm{}))
	require.NoError(t, fixture.AddColumn(&legacyWorkout{}, "Level"))
	require.NoError(t, fixture.AddColumn(&legacyWorkout{}, "EstimatedMinutes"))
	require.NoError(t, fixture.CreateIndex(&legacyWorkout{}, "workouts_user_duration_created_id_idx"))
	require.NoError(t, db.WithContext(t.Context()).Create(&legacySearchTerm{UserID: userID, WorkoutID: "any", Name: "squat"}).Error)
}

func remainingLibrarySearchSchema(t *testing.T, db *gorm.DB) []string {
	t.Helper()
	m := db.WithContext(t.Context()).Migrator()
	var found []string
	if m.HasTable("workout_search_terms") {
		found = append(found, "workout_search_terms")
	}
	for _, column := range []string{"level", "estimated_minutes"} {
		if m.HasColumn("workouts", column) {
			found = append(found, column)
		}
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
	ID               string     `gorm:"primaryKey;uniqueIndex:workouts_owner_id"`
	UserID           string     `gorm:"type:uuid;uniqueIndex:workouts_owner_id"`
	User             legacyUser `gorm:"foreignKey:UserID;references:ID;constraint:workouts_user_id_fkey,OnDelete:CASCADE"`
	Level            int
	EstimatedMinutes int `gorm:"index:workouts_user_duration_created_id_idx"`
}

func (legacyWorkout) TableName() string { return "workouts" }

type legacySearchTerm struct{ UserID, WorkoutID, Name string }

func (legacySearchTerm) TableName() string { return "workout_search_terms" }

type legacyCompletion struct {
	UserID    string `gorm:"type:uuid"`
	WorkoutID string
	User      legacyUser    `gorm:"foreignKey:UserID;references:ID;constraint:workout_completions_user_id_fkey,OnDelete:CASCADE"`
	Workout   legacyWorkout `gorm:"foreignKey:UserID,WorkoutID;references:UserID,ID;constraint:workout_completions_user_id_workout_id_fkey,OnDelete:CASCADE"`
}

func (legacyCompletion) TableName() string { return "workout_completions" }
