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
		m := tx.Migrator()
		// AutoMigrate never removes old relationship constraints or replaces indexes.
		for _, constraint := range []struct{ table, name string }{
			{"workout_completions", "workout_completions_user_id_workout_id_fkey"},
			{"workout_completions", "workout_completions_user_id_fkey"},
			{"workouts", "workouts_user_id_fkey"},
			{"workouts", "workouts_owner_id"},
		} {
			if m.HasConstraint(constraint.table, constraint.name) {
				if err := m.DropConstraint(constraint.table, constraint.name); err != nil {
					return err
				}
			}
		}
		if m.HasIndex(&workoutRow{}, "workouts_owner_id") {
			if err := m.DropIndex(&workoutRow{}, "workouts_owner_id"); err != nil {
				return err
			}
		}
		// Library search and sorting were removed. Dropping a column also drops
		// the duration index that used it.
		for _, column := range []string{"level", "estimated_minutes"} {
			if m.HasColumn(&workoutRow{}, column) {
				if err := m.DropColumn(&workoutRow{}, column); err != nil {
					return err
				}
			}
		}
		// DropTable skips missing tables: old search terms and migration history.
		if err := m.DropTable("workout_search_terms", "schema_migrations"); err != nil {
			return err
		}
		return tx.AutoMigrate(schemaModels...)
	})
	if err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}
	return nil
}
