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
	var count int
	require.NoError(t, db.QueryRow(t.Context(), `SELECT count(*) FROM users WHERE clerk_user_id=$1`, "user_racing").Scan(&count))
	assert.Equal(t, 1, count)
}

func TestUsersEraseCascadesOnlyOwnedWorkoutsAndRejectsStaleSessions(t *testing.T) {
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
		var count int
		require.NoError(t, db.QueryRow(t.Context(), `SELECT count(*) FROM users WHERE clerk_user_id=$1`, subject).Scan(&count))
		assert.Equal(t, 0, count)
	}
}

func TestUsersEraseFailureRollsBackTombstoneAndData(t *testing.T) {
	db, databaseURL := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(databaseURL))
	repo := store.NewUsers(db)
	user, err := repo.Ensure(t.Context(), "retained-user")
	require.NoError(t, err)
	_, err = store.NewWorkouts(db).Create(t.Context(), user.ID, workoutSnapshot("retained-plan"), "", "")
	require.NoError(t, err)
	_, err = db.Exec(t.Context(), `CREATE TABLE retained_fixture (user_id uuid REFERENCES users(id))`)
	require.NoError(t, err)
	_, err = db.Exec(t.Context(), `INSERT INTO retained_fixture VALUES ($1)`, user.ID)
	require.NoError(t, err)

	require.Error(t, repo.Erase(t.Context(), "retained-user"))
	resolved, err := repo.Ensure(t.Context(), "retained-user")
	require.NoError(t, err)
	assert.Equal(t, user, resolved)
	exported, err := repo.Export(t.Context(), user.ID)
	require.NoError(t, err)
	assert.Equal(t, []string{"retained-plan"}, workoutIDs(exported.Workouts))

	_, err = db.Exec(t.Context(), `DROP TABLE retained_fixture`)
	require.NoError(t, err)
	require.NoError(t, repo.Erase(t.Context(), "retained-user"))
	_, err = repo.Ensure(t.Context(), "retained-user")
	assert.ErrorIs(t, err, domains.ErrAccountDeleted)
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
	_, err = db.Exec(t.Context(), `UPDATE workouts SET created_at='2026-01-01T12:00:00Z'`)
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
