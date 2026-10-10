//go:build integration

package postgres_test

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUsersEnsurePreservesApplicationIdentity(t *testing.T) {
	repo := store.NewUsers(setupRepositoryTest(t))
	alice, err := repo.Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	assert.Equal(t, "user_alice", alice.ClerkUserID)
	assert.Regexp(t, `^[a-f0-9-]{36}$`, alice.ID)
	assert.WithinDuration(t, time.Now(), alice.CreatedAt, 5*time.Second)

	again, err := repo.Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	assert.Equal(t, alice, again)
	bob, err := repo.Ensure(t.Context(), "user_bob")
	require.NoError(t, err)
	assert.Equal(t, "user_bob", bob.ClerkUserID)
	assert.NotEqual(t, alice.ID, bob.ID)
}

func TestUsersEnsureConcurrentFirstRequestsCreateOneAccount(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewUsers(db)
	type result struct {
		user domains.User
		err  error
	}
	start := make(chan struct{})
	results := make(chan result, 20)
	for range 20 {
		go func() {
			<-start
			user, err := repo.Ensure(t.Context(), "user_racing")
			results <- result{user, err}
		}()
	}
	close(start)
	// Drain every worker before asserting, so cleanup cannot race an active query.
	var received []result
	for range 20 {
		received = append(received, <-results)
	}
	for _, got := range received {
		require.NoError(t, got.err)
		assert.Equal(t, "user_racing", got.user.ClerkUserID)
		assert.Equal(t, received[0].user, got.user)
	}
	var count int64
	require.NoError(t, db.WithContext(t.Context()).Table("users").Where(map[string]any{"clerk_user_id": "user_racing"}).Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestUsersEraseRemovesOnlyOwnedWorkoutsAndRejectsStaleSessions(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewUsers(db)
	workouts := store.NewWorkouts(db)
	alice, err := repo.Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	bob, err := repo.Ensure(t.Context(), "user_bob")
	require.NoError(t, err)
	_, err = workouts.Create(t.Context(), alice.ID, workoutSnapshot("alice-plan"), "", "")
	require.NoError(t, err)
	_, err = workouts.Create(t.Context(), bob.ID, workoutSnapshot("bob-plan"), "", "")
	require.NoError(t, err)

	require.NoError(t, repo.Erase(t.Context(), "user_alice"))
	require.NoError(t, repo.Erase(t.Context(), "user_alice"))
	_, err = repo.Ensure(t.Context(), "user_alice")
	assert.ErrorIs(t, err, domains.ErrAccountDeleted)
	_, err = workouts.Get(t.Context(), alice.ID, "alice-plan")
	assert.ErrorIs(t, err, domains.ErrNotFound)
	_, err = repo.Export(t.Context(), alice.ID)
	assert.ErrorIs(t, err, domains.ErrNotFound)

	remaining, err := repo.Export(t.Context(), bob.ID)
	require.NoError(t, err)
	assert.Equal(t, "user_bob", remaining.User.ClerkUserID)
	assert.Equal(t, []string{"bob-plan"}, workoutIDs(remaining.Workouts))
}

func TestUsersEraseBeforeProvisioningPreventsLateCreation(t *testing.T) {
	repo := store.NewUsers(setupRepositoryTest(t))
	require.NoError(t, repo.Erase(t.Context(), "deleted-before-first-request"))
	_, err := repo.Ensure(t.Context(), "deleted-before-first-request")
	assert.ErrorIs(t, err, domains.ErrAccountDeleted)
	active, err := repo.Ensure(t.Context(), "active-user")
	require.NoError(t, err)
	assert.Equal(t, "active-user", active.ClerkUserID)
}

func TestUsersConcurrentProvisioningCannotUndoErasure(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewUsers(db)
	for attempt := range 10 {
		subject := fmt.Sprintf("racing-delete-%d", attempt)
		start := make(chan struct{})
		provisioned := make(chan error, 5)
		erased := make(chan error, 1)
		for range 5 {
			go func() {
				<-start
				_, err := repo.Ensure(t.Context(), subject)
				provisioned <- err
			}()
		}
		go func() {
			<-start
			erased <- repo.Erase(t.Context(), subject)
		}()
		close(start)
		var provisionErrors []error
		for range 5 {
			provisionErrors = append(provisionErrors, <-provisioned)
		}
		eraseErr := <-erased
		require.NoError(t, eraseErr)
		for _, err := range provisionErrors {
			if !errors.Is(err, domains.ErrAccountDeleted) {
				require.NoError(t, err)
			}
		}
		_, err := repo.Ensure(t.Context(), subject)
		assert.ErrorIs(t, err, domains.ErrAccountDeleted)
		var count int64
		require.NoError(t, db.WithContext(t.Context()).Table("users").Where(map[string]any{"clerk_user_id": subject}).Count(&count).Error)
		assert.Zero(t, count)
	}
}

func TestUsersEraseFailureRollsBackTombstoneAndData(t *testing.T) {
	db := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(t.Context(), db))
	repo := store.NewUsers(db)
	user, err := repo.Ensure(t.Context(), "retained-user")
	require.NoError(t, err)
	_, err = store.NewWorkouts(db).Create(t.Context(), user.ID, workoutSnapshot("retained-plan"), "", "")
	require.NoError(t, err)
	_, err = store.NewWorkouts(db).Complete(t.Context(), user.ID, "retained-plan", "retained-completion")
	require.NoError(t, err)
	// Fail the final delete after child cleanup to check the transaction rollback.
	require.NoError(t, db.Callback().Delete().Before("gorm:delete").Register("test:reject_account_delete", func(tx *gorm.DB) {
		if tx.Statement.Table == "users" {
			_ = tx.AddError(errors.New("injected erasure failure"))
		}
	}))

	require.Error(t, repo.Erase(t.Context(), "retained-user"))
	resolved, err := repo.Ensure(t.Context(), "retained-user")
	require.NoError(t, err)
	assert.Equal(t, user, resolved)
	exported, err := repo.Export(t.Context(), user.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{"retained-plan"}, workoutIDs(exported.Workouts))
	assert.Len(t, exported.Completions, 1)
	search, err := store.NewWorkouts(db).List(t.Context(), user.ID, domains.WorkoutFilter{Query: "squat"}, nil, 20)
	require.NoError(t, err)
	assert.Equal(t, []string{"retained-plan"}, workoutIDs(search))

	require.NoError(t, db.Callback().Delete().Remove("test:reject_account_delete"))
	require.NoError(t, repo.Erase(t.Context(), "retained-user"))
	_, err = repo.Ensure(t.Context(), "retained-user")
	assert.ErrorIs(t, err, domains.ErrAccountDeleted)
}

func TestUsersEraseRacingWorkoutAndCompletionWritesLeavesNoOrphans(t *testing.T) {
	db := setupRepositoryTest(t)
	users, workouts := store.NewUsers(db), store.NewWorkouts(db)
	for attempt := range 10 {
		subject := fmt.Sprintf("racing-writes-%d", attempt)
		user, err := users.Ensure(t.Context(), subject)
		require.NoError(t, err)
		planID := fmt.Sprintf("existing-%d", attempt)
		_, err = workouts.Create(t.Context(), user.ID, workoutSnapshot(planID), "", "")
		require.NoError(t, err)
		start := make(chan struct{})
		results := make(chan error, 12)
		for i := range 6 {
			go func() {
				<-start
				_, err := workouts.Create(t.Context(), user.ID, workoutSnapshot(fmt.Sprintf("new-%d-%d", attempt, i)), "", "")
				results <- err
			}()
			go func() {
				<-start
				_, err := workouts.Complete(t.Context(), user.ID, planID, fmt.Sprintf("intent-%d", i))
				results <- err
			}()
		}
		erased := make(chan error, 1)
		go func() { <-start; erased <- users.Erase(t.Context(), subject) }()
		close(start)
		var writeErrors []error
		for range 12 {
			writeErrors = append(writeErrors, <-results)
		}
		eraseErr := <-erased
		require.NoError(t, eraseErr)
		for _, err := range writeErrors {
			if !errors.Is(err, domains.ErrNotFound) {
				require.NoError(t, err)
			}
		}
		for _, table := range []string{"users", "workouts", "workout_completions", "workout_search_terms"} {
			column := "user_id"
			if table == "users" {
				column = "id"
			}
			var remaining int64
			require.NoError(t, db.WithContext(t.Context()).Table(table).Where(map[string]any{column: user.ID}).Count(&remaining).Error)
			assert.Zero(t, remaining, table)
		}
		_, err = users.Ensure(t.Context(), subject)
		assert.ErrorIs(t, err, domains.ErrAccountDeleted)
	}
}

func TestUsersExportIncludesOnlyOwnedWorkoutsInStableOrder(t *testing.T) {
	db := setupRepositoryTest(t)
	repo := store.NewUsers(db)
	workouts := store.NewWorkouts(db)
	alice, err := repo.Ensure(t.Context(), "user_alice")
	require.NoError(t, err)
	bob, err := repo.Ensure(t.Context(), "user_bob")
	require.NoError(t, err)
	for _, id := range []string{"alice-a", "alice-b"} {
		_, err := workouts.Create(t.Context(), alice.ID, workoutSnapshot(id), "", "")
		require.NoError(t, err)
	}
	_, err = workouts.Create(t.Context(), bob.ID, workoutSnapshot("bob-private"), "", "")
	require.NoError(t, err)
	err = db.WithContext(t.Context()).Session(&gorm.Session{AllowGlobalUpdate: true}).Table("workouts").Update("created_at", time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)).Error
	require.NoError(t, err)

	exported, err := repo.Export(t.Context(), alice.ID)
	require.NoError(t, err)
	assert.Equal(t, alice, exported.User)
	assert.Equal(t, []string{"alice-b", "alice-a"}, workoutIDs(exported.Workouts))
	assert.WithinDuration(t, time.Now(), exported.ExportedAt, 5*time.Second)
	for _, saved := range exported.Workouts {
		assert.Equal(t, workoutSnapshot(saved.ID).WorkoutPlan, saved.WorkoutPlan)
	}
	_, err = repo.Export(t.Context(), "00000000-0000-0000-0000-000000000000")
	assert.ErrorIs(t, err, domains.ErrNotFound)
}

func TestUsersUpdateChangesLevelWithoutRestartingOnboarding(t *testing.T) {
	repo := store.NewUsers(setupRepositoryTest(t))
	user, err := repo.Ensure(t.Context(), "preferences")
	require.NoError(t, err)
	updated, err := repo.Update(t.Context(), user.ID, 4, false)
	require.NoError(t, err)
	assert.Equal(t, 4, updated.DefaultLevel)
	assert.Nil(t, updated.OnboardingCompletedAt)
	assert.Equal(t, user.ID, updated.ID)
	assert.Equal(t, user.CreatedAt, updated.CreatedAt)

	completed, err := repo.Update(t.Context(), user.ID, 4, true)
	require.NoError(t, err)
	require.NotNil(t, completed.OnboardingCompletedAt)
	updated, err = repo.Update(t.Context(), user.ID, 2, false)
	require.NoError(t, err)
	assert.Equal(t, 2, updated.DefaultLevel)
	assert.Equal(t, completed.OnboardingCompletedAt, updated.OnboardingCompletedAt)
	_, err = repo.Update(t.Context(), "00000000-0000-0000-0000-000000000000", 2, true)
	assert.ErrorIs(t, err, domains.ErrNotFound)
}

func TestRepositoryTimestampsUseGORMClock(t *testing.T) {
	db := setupRepositoryTest(t).Session(&gorm.Session{NowFunc: func() time.Time {
		return time.Date(2000, 1, 1, 0, 0, 0, 123456789, time.UTC)
	}})
	user, err := store.NewUsers(db).Ensure(t.Context(), "database-clock")
	require.NoError(t, err)
	assert.Equal(t, time.Date(2000, 1, 1, 0, 0, 0, 123456000, time.UTC), user.CreatedAt)
	again, err := store.NewUsers(db).Ensure(t.Context(), "database-clock")
	require.NoError(t, err)
	assert.Equal(t, user, again)

	repo := store.NewWorkouts(db)
	plan, err := repo.Create(t.Context(), user.ID, workoutSnapshot("database-clock-plan"), "", "")
	require.NoError(t, err)
	assert.Equal(t, time.Date(2000, 1, 1, 0, 0, 0, 123456000, time.UTC), plan.CreatedAt)
	completion, err := repo.Complete(t.Context(), user.ID, plan.ID, "database-clock-completion")
	require.NoError(t, err)
	assert.Equal(t, time.Date(2000, 1, 1, 0, 0, 0, 123456000, time.UTC), completion.CompletedAt)
}
