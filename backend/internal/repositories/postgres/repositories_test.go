//go:build integration

package postgres_test

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"os"
	"testing"
	"time"

	store "github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/stretchr/testify/require"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"gorm.io/gorm"
)

var (
	repositoryTestDB        *gorm.DB
	repositoryTestURL       string
	repositoryTestContainer *tcpostgres.PostgresContainer
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
	repositoryTestContainer = container
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
	pool, err := repositoryTestDB.DB()
	if err != nil {
		fmt.Fprintln(os.Stderr, "get repository test pool:", err)
		return 1
	}
	defer func() { _ = pool.Close() }()
	return m.Run()
}

// Repository tests run serially. Each starts with empty application tables while
// retaining the schema migrated once by TestMain.
func setupRepositoryTest(t *testing.T) *gorm.DB {
	t.Helper()
	for _, table := range []string{"workout_completions", "workout_search_terms", "workouts", "users", "deleted_accounts"} {
		err := repositoryTestDB.WithContext(t.Context()).Session(&gorm.Session{AllowGlobalUpdate: true}).
			Table(table).Delete(&struct{}{}).Error
		require.NoError(t, err)
	}
	return repositoryTestDB
}

// Schema mutations and fault injection use another database in the same
// container. A failed assertion cannot leave DDL behind for another test.
func isolatedRepositoryDatabase(t *testing.T) (*gorm.DB, string) {
	t.Helper()
	name := fmt.Sprintf("isolated_%d", time.Now().UnixNano())
	runPostgresCommand(t, t.Context(), "createdb", "--username=test", "--maintenance-db=endorphins_repositories_test", name)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		runPostgresCommand(t, ctx, "dropdb", "--username=test", "--force", "--maintenance-db=endorphins_repositories_test", name)
	})
	parsed, err := url.Parse(repositoryTestURL)
	require.NoError(t, err)
	parsed.Path = "/" + name
	databaseURL := parsed.String()
	pool, err := store.Open(t.Context(), databaseURL)
	require.NoError(t, err)
	cleanupRepositoryDatabase(t, pool)
	return pool, databaseURL
}

func runPostgresCommand(t *testing.T, ctx context.Context, command ...string) {
	t.Helper()
	code, output, err := repositoryTestContainer.Exec(ctx, command)
	require.NoError(t, err)
	message, err := io.ReadAll(output)
	require.NoError(t, err)
	require.Zero(t, code, "%s: %s", command[0], message)
}

func cleanupRepositoryDatabase(t *testing.T, db *gorm.DB) {
	t.Helper()
	pool, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, pool.Close()) })
}
