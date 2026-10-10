//go:build integration

package postgres_test

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"testing"
	"time"

	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/require"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

var (
	repositoryTestDB  *pgxpool.Pool
	repositoryTestURL string
)

func TestMain(m *testing.M) {
	os.Exit(runRepositoryTests(m))
}

func runRepositoryTests(m *testing.M) (code int) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	container, err := tcpostgres.Run(ctx, "postgres:17-alpine",
		tcpostgres.WithDatabase("endorphins_repositories_test"),
		tcpostgres.WithUsername("test"), tcpostgres.WithPassword("test"),
		tcpostgres.BasicWaitStrategies(),
	)
	if container != nil {
		defer func() {
			cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cleanupCancel()
			if err := container.Terminate(cleanupCtx); err != nil {
				fmt.Fprintln(os.Stderr, "terminate repository test Postgres:", err)
				code = 1
			}
		}()
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "start repository test Postgres:", err)
		return 1
	}
	repositoryTestURL, err = container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		fmt.Fprintln(os.Stderr, "get repository test connection:", err)
		return 1
	}
	if err := store.Migrate(repositoryTestURL); err != nil {
		fmt.Fprintln(os.Stderr, "migrate repository test database:", err)
		return 1
	}
	repositoryTestDB, err = store.Open(ctx, repositoryTestURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open repository test database:", err)
		return 1
	}
	defer repositoryTestDB.Close()
	return m.Run()
}

// Repository tests run serially. Each starts with empty application tables while
// retaining the schema migrated once by TestMain.
func setupRepositoryTest(t *testing.T) *pgxpool.Pool {
	t.Helper()
	_, err := repositoryTestDB.Exec(t.Context(), `TRUNCATE workout_completions, workouts, users, deleted_accounts RESTART IDENTITY`)
	require.NoError(t, err)
	return repositoryTestDB
}

// Schema mutations and fault injection use another database in the same
// container. A failed assertion cannot leave DDL behind for another test.
func isolatedRepositoryDatabase(t *testing.T) (*pgxpool.Pool, string) {
	t.Helper()
	name := fmt.Sprintf("isolated_%d", time.Now().UnixNano())
	identifier := pgx.Identifier{name}.Sanitize()
	_, err := repositoryTestDB.Exec(t.Context(), "CREATE DATABASE "+identifier)
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_, err := repositoryTestDB.Exec(ctx, "DROP DATABASE "+identifier+" WITH (FORCE)")
		require.NoError(t, err)
	})
	parsed, err := url.Parse(repositoryTestURL)
	require.NoError(t, err)
	parsed.Path = "/" + name
	databaseURL := parsed.String()
	pool, err := store.Open(t.Context(), databaseURL)
	require.NoError(t, err)
	t.Cleanup(pool.Close)
	return pool, databaseURL
}
