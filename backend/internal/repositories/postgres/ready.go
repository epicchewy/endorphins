package postgres

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// CheckReady checks database connectivity. Schema changes run in cmd/migrate.
func CheckReady(ctx context.Context, db *gorm.DB) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	pool, err := db.DB()
	if err != nil {
		return fmt.Errorf("get database pool: %w", err)
	}
	if err := pool.PingContext(ctx); err != nil {
		return fmt.Errorf("check database connection: %w", err)
	}
	return nil
}
