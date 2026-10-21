package postgres

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

var schemaModels = []any{
	&userRow{}, &workoutRow{}, &completionRow{}, &deletedAccountRow{}, &workoutSearchTerm{},
}

// Migrate follows Temper: model-driven schema creation and repeatable data fixes.
// Run once before starting the API. Postgres rolls back schema and data together.
func Migrate(ctx context.Context, db *gorm.DB) error {
	err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return tx.AutoMigrate(schemaModels...)
	})
	if err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}
	return nil
}
