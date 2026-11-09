package postgres

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

var schemaModels = []any{
	&userRow{}, &workoutRow{}, &completionRow{}, &deletedAccountRow{},
}

// Migrate follows Temper: model-driven schema creation and repeatable data fixes.
// Run once before starting the API. Postgres rolls back schema and data together.
func Migrate(ctx context.Context, db *gorm.DB) error {
	err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.AutoMigrate(schemaModels...); err != nil {
			return err
		}
		return dropLibrarySearch(tx.Migrator())
	})
	if err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}
	return nil
}

// dropLibrarySearch removes the search projection that saved-plan search, level
// filters and duration sorting used. AutoMigrate never drops schema, so an
// upgraded database would otherwise differ from a fresh one. Dropping the
// column also drops its sort index.
func dropLibrarySearch(m gorm.Migrator) error {
	if err := m.DropTable("workout_search_terms"); err != nil {
		return fmt.Errorf("drop workout search terms: %w", err)
	}
	if m.HasColumn(&workoutRow{}, "estimated_minutes") {
		if err := m.DropColumn(&workoutRow{}, "estimated_minutes"); err != nil {
			return fmt.Errorf("drop workout estimate projection: %w", err)
		}
	}
	return nil
}
