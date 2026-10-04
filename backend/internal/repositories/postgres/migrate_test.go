//go:build integration

package postgres_test

import (
	"testing"

	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
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
	exported, err := users.Export(t.Context(), user.ID)
	require.NoError(t, err)
	assert.Equal(t, user, exported.User)
	assert.Equal(t, []string{"saved-before-migrate"}, workoutIDs(exported.Workouts))
}
