package postgres

import (
	"context"
	"fmt"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var schemaModels = []any{
	&userRow{}, &workoutRow{}, &completionRow{}, &deletedAccountRow{}, &workoutSearchTerm{},
}

// Migrate follows Temper: model-driven schema creation and repeatable data fixes.
// Run once before starting the API. Postgres rolls back schema and data together.
func Migrate(ctx context.Context, db *gorm.DB) error {
	err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		m := tx.Migrator()
		legacy := m.HasTable("schema_migrations")
		backfill := legacy || (m.HasTable(&workoutRow{}) &&
			(!m.HasColumn(&workoutRow{}, "Level") || !m.HasColumn(&workoutRow{}, "EstimatedMinutes") || !m.HasTable(&workoutSearchTerm{})))
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
		if backfill && m.HasIndex(&workoutRow{}, "workouts_user_duration_created_id_idx") {
			if err := m.DropIndex(&workoutRow{}, "workouts_user_duration_created_id_idx"); err != nil {
				return err
			}
		}
		if err := tx.AutoMigrate(schemaModels...); err != nil {
			return err
		}
		if backfill {
			var rows []workoutRow
			err := tx.FindInBatches(&rows, 100, func(batch *gorm.DB, _ int) error {
				for _, row := range rows {
					// Read projected fields without decoding unrelated snapshot values.
					plan, err := decodeWorkoutQueryFields(row.Plan)
					if err != nil {
						return err
					}
					if err := batch.Model(&workoutRow{}).Where(map[string]any{"user_id": row.UserID, "id": row.ID}).
						UpdateColumns(map[string]any{"level": plan.Level, "estimated_minutes": plan.EstimatedMinutes}).Error; err != nil {
						return err
					}
					terms := workoutSearchTerms(row.UserID, domains.SavedWorkout{ID: row.ID, WorkoutPlan: plan})
					if err := batch.Clauses(clause.OnConflict{DoNothing: true}).Create(&terms).Error; err != nil {
						return err
					}
				}
				return nil
			}).Error
			if err != nil {
				return err
			}
		}
		if legacy {
			return m.DropTable("schema_migrations")
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}
	return nil
}
