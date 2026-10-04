package postgres

import (
	"embed"
	"errors"
	"fmt"
	"net/url"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

// Migrate applies embedded, versioned migrations using golang-migrate's locking
// and dirty-state handling. Run explicitly before starting the API.
func Migrate(databaseURL string) (err error) {
	parsed, err := url.Parse(databaseURL)
	if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") {
		return fmt.Errorf("DATABASE_URL must use postgres:// or postgresql://")
	}
	parsed.Scheme = "pgx5"
	source, err := iofs.New(migrationFiles, "migrations")
	if err != nil {
		return fmt.Errorf("open migrations: %w", err)
	}
	// The pgx/v5 driver uses its own URL scheme.
	m, err := migrate.NewWithSourceInstance("iofs", source, parsed.String())
	if err != nil {
		return errors.Join(fmt.Errorf("initialize migrations: %w", err), source.Close())
	}
	defer func() { sourceErr, databaseErr := m.Close(); err = errors.Join(err, sourceErr, databaseErr) }()
	if err = m.Up(); errors.Is(err, migrate.ErrNoChange) {
		return nil
	}
	return err
}
