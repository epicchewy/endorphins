//go:build integration

package postgres_test

import (
	"context"
	"testing"

	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckReadyChecksConnectivityAndCancellation(t *testing.T) {
	db := setupRepositoryTest(t)
	require.NoError(t, store.CheckReady(t.Context(), db))
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	assert.ErrorIs(t, store.CheckReady(ctx, db), context.Canceled)
}

func TestCheckReadyRejectsClosedDatabase(t *testing.T) {
	db, err := store.Open(t.Context(), repositoryTestURL)
	require.NoError(t, err)
	require.NoError(t, store.CheckReady(t.Context(), db))
	pool, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, pool.Close())
	assert.ErrorContains(t, store.CheckReady(t.Context(), db), "check database connection")
}
