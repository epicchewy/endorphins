package postgres

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

var schemaModels = []any{&userRow{}, &workoutRow{}, &completionRow{}, &deletedAccountRow{}}

// Migrate follows Temper: model-driven schema creation and repeatable data fixes.
// Run once before starting the API. Postgres rolls back schema and data together.
func Migrate(ctx context.Context, db *gorm.DB) error {
	err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// AutoMigrate never drops schema. Remove the library search table and
		// the estimated-minutes column; dropping it also drops the duration index.
		m := tx.Migrator()
		if m.HasColumn(&workoutRow{}, "estimated_minutes") {
			if err := m.DropColumn(&workoutRow{}, "estimated_minutes"); err != nil {
				return err
			}
		}
		if err := m.DropTable("workout_search_terms"); err != nil {
			return err
		}
		return tx.AutoMigrate(schemaModels...)
	})
	if err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}
	return nil
}
