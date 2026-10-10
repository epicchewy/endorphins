//go:build integration

package postgres_test

import (
	"testing"

	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
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
			err := db.WithContext(t.Context()).Session(&gorm.Session{AllowGlobalUpdate: true}).Table("schema_migrations").Updates(map[string]any{"version": tt.version, "dirty": tt.dirty}).Error
			require.NoError(t, err)
			assert.ErrorContains(t, store.CheckReady(t.Context(), db), "incompatible database schema")
			err = db.WithContext(t.Context()).Session(&gorm.Session{AllowGlobalUpdate: true}).Table("schema_migrations").Updates(map[string]any{"version": store.SchemaVersion, "dirty": false}).Error
			require.NoError(t, err)
			assert.NoError(t, store.CheckReady(t.Context(), db))
		})
	}
}

func TestCheckReadyRejectsClosedDatabase(t *testing.T) {
	db, err := store.Open(t.Context(), repositoryTestURL)
	require.NoError(t, err)
	cleanupRepositoryDatabase(t, db)
	require.NoError(t, store.CheckReady(t.Context(), db))
	pool, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, pool.Close())
	assert.ErrorContains(t, store.CheckReady(t.Context(), db), "check database schema")
}
