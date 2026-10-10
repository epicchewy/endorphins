//go:build integration

package postgres_test

import (
	"testing"

	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCheckReadyRejectsUnmigratedDatabase(t *testing.T) {
	db, databaseURL := isolatedRepositoryDatabase(t)
	assert.ErrorContains(t, store.CheckReady(t.Context(), db), "check database schema")
	require.NoError(t, store.Migrate(databaseURL))
	assert.NoError(t, store.CheckReady(t.Context(), db))
}

func TestCheckReadyRequiresCleanSupportedSchema(t *testing.T) {
	db, databaseURL := isolatedRepositoryDatabase(t)
	require.NoError(t, store.Migrate(databaseURL))
	for _, tt := range []struct {
		name    string
		version int
		dirty   bool
	}{
		{"dirty migration", 4, true},
		{"first migration only", 1, false},
		{"previous schema", 3, false},
		{"future schema", 5, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			_, err := db.Exec(t.Context(), `UPDATE schema_migrations SET version=$1, dirty=$2`, tt.version, tt.dirty)
			require.NoError(t, err)
			assert.ErrorContains(t, store.CheckReady(t.Context(), db), "incompatible database schema")
			_, err = db.Exec(t.Context(), `UPDATE schema_migrations SET version=4, dirty=false`)
			require.NoError(t, err)
			assert.NoError(t, store.CheckReady(t.Context(), db))
		})
	}
}

func TestCheckReadyRejectsClosedDatabase(t *testing.T) {
	db, err := store.Open(t.Context(), repositoryTestURL)
	require.NoError(t, err)
	t.Cleanup(db.Close)
	require.NoError(t, store.CheckReady(t.Context(), db))
	db.Close()
	assert.ErrorContains(t, store.CheckReady(t.Context(), db), "check database schema")
}
