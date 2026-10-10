package postgres

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"
)

const SchemaVersion = 4

// CheckReady checks connectivity and the exact migration version this binary
// supports. Future migrations require an explicit compatibility decision.
func CheckReady(ctx context.Context, db *gorm.DB) error {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	var schema struct {
		Version int
		Dirty   bool
	}
	if err := db.WithContext(ctx).Table("schema_migrations").Take(&schema).Error; err != nil {
		return fmt.Errorf("check database schema: %w", err)
	}
	if schema.Dirty || schema.Version != SchemaVersion {
		return fmt.Errorf("incompatible database schema: version=%d dirty=%t", schema.Version, schema.Dirty)
	}
	return nil
}
