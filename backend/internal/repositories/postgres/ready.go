package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const SchemaVersion = 2

// CheckReady checks connectivity and the exact migration version this binary
// supports. Future migrations require an explicit compatibility decision.
func CheckReady(ctx context.Context, pool *pgxpool.Pool) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	var version int
	var dirty bool
	if err := pool.QueryRow(ctx, `SELECT version,dirty FROM schema_migrations`).Scan(&version, &dirty); err != nil {
		return fmt.Errorf("check database schema: %w", err)
	}
	if dirty || version != SchemaVersion {
		return fmt.Errorf("incompatible database schema: version=%d dirty=%t", version, dirty)
	}
	return nil
}
