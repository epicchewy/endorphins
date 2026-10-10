package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Workouts struct{ db *gorm.DB }

func NewWorkouts(db *gorm.DB) *Workouts { return &Workouts{db: db} }

type workoutRow struct {
	ID               string `gorm:"primaryKey"`
	UserID           string
	CreatedAt        time.Time `gorm:"autoCreateTime:false;default:(-)"`
	SnapshotVersion  int       `gorm:"default:(-)"`
	Plan             []byte    `gorm:"type:jsonb"`
	IdempotencyKey   *string
	InputFingerprint *string
}

func (workoutRow) TableName() string { return "workouts" }

func (row workoutRow) domain() (domains.SavedWorkout, error) {
	plan, err := decodeSnapshot(row.SnapshotVersion, row.Plan)
	if err != nil {
		return domains.SavedWorkout{}, err
	}
	return domains.SavedWorkout{ID: row.ID, CreatedAt: row.CreatedAt, WorkoutPlan: plan}, nil
}

func (s *Workouts) Create(ctx context.Context, userID string, workout domains.SavedWorkout, key, fingerprint string) (domains.SavedWorkout, error) {
	plan, err := encodeSnapshot(workout.WorkoutPlan)
	if err != nil {
		return domains.SavedWorkout{}, fmt.Errorf("encode workout: %w", err)
	}
	row := workoutRow{ID: workout.ID, UserID: userID, Plan: plan}
	if key != "" {
		row.IdempotencyKey = &key
	}
	if fingerprint != "" {
		row.InputFingerprint = &fingerprint
	}
	var result domains.SavedWorkout
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockWorkoutOwner(tx, userID); err != nil {
			return err
		}
		// A retry returns the original snapshot; a different input cannot replace it.
		saved := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "idempotency_key"}},
			DoUpdates: clause.AssignmentColumns([]string{"idempotency_key"}),
			Where: clause.Where{Exprs: []clause.Expression{clause.Eq{
				Column: clause.Column{Table: "workouts", Name: "input_fingerprint"},
				Value:  clause.Column{Table: "excluded", Name: "input_fingerprint"},
			}}},
		}, clause.Returning{}).Create(&row)
		if saved.Error != nil {
			return saved.Error
		}
		if saved.RowsAffected == 0 {
			return domains.ErrIdempotencyConflict
		}
		item, err := row.domain()
		result = item
		return err
	})
	if err != nil {
		return domains.SavedWorkout{}, fmt.Errorf("save workout: %w", err)
	}
	return result, nil
}

func lockWorkoutOwner(tx *gorm.DB, userID string) error {
	var owner userRow
	err := tx.Select("id").Clauses(clause.Locking{Strength: "KEY SHARE"}).
		Where(map[string]any{"id": userID}).Take(&owner).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domains.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("lock workout owner: %w", err)
	}
	return nil
}

func (s *Workouts) Get(ctx context.Context, userID, id string) (domains.SavedWorkout, error) {
	var row workoutRow
	err := s.db.WithContext(ctx).Where(map[string]any{"user_id": userID, "id": id}).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domains.SavedWorkout{}, domains.ErrNotFound
	}
	if err != nil {
		return domains.SavedWorkout{}, fmt.Errorf("get workout: %w", err)
	}
	return row.domain()
}

// Both list and summary use the same owner and search scope.
func filterWorkouts(db *gorm.DB, userID string, filter domains.WorkoutFilter) *gorm.DB {
	query := db.Model(&workoutRow{}).Where(map[string]any{"user_id": userID})
	if filter.Level != 0 {
		query = query.Where(clause.Eq{
			Column: clause.Column{Name: strings.TrimSpace(workoutLevelSQL), Raw: true},
			Value:  filter.Level,
		})
	}
	if filter.Query != "" {
		query = query.Where(gorm.Expr(workoutSearchSQL, filter.Query, filter.Query, filter.Query))
	}
	return query
}

func (s *Workouts) List(ctx context.Context, userID string, filter domains.WorkoutFilter, before *domains.WorkoutCursor, limit int) ([]domains.SavedWorkout, error) {
	if limit < 1 || limit > 51 {
		return nil, fmt.Errorf("workout list limit must be 1–51")
	}
	query := filterWorkouts(s.db.WithContext(ctx), userID, filter)
	minutes := clause.Column{Name: strings.TrimSpace(workoutMinutesSQL), Raw: true}
	if before != nil {
		position := clause.Or(
			clause.Lt{Column: "created_at", Value: before.CreatedAt},
			clause.And(
				clause.Eq{Column: "created_at", Value: before.CreatedAt},
				clause.Lt{Column: "id", Value: before.ID},
			),
		)
		if filter.Sort == "shortest" {
			query = query.Where(clause.Or(
				clause.Gt{Column: minutes, Value: before.EstimatedMinutes},
				clause.And(clause.Eq{Column: minutes, Value: before.EstimatedMinutes}, position),
			))
		} else {
			query = query.Where(position)
		}
	}
	if filter.Sort == "shortest" {
		query = query.Order(clause.OrderByColumn{Column: minutes})
	}
	query = query.Order(clause.OrderByColumn{Column: clause.Column{Name: "created_at"}, Desc: true}).
		Order(clause.OrderByColumn{Column: clause.Column{Name: "id"}, Desc: true}).Limit(limit)
	var rows []workoutRow
	if err := query.Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("list workouts: %w", err)
	}
	return workoutDomains(rows)
}

func (s *Workouts) Summary(ctx context.Context, userID string, filter domains.WorkoutFilter) (domains.WorkoutSummary, error) {
	result := domains.WorkoutSummary{Levels: make([]domains.LevelCount, 5)}
	for i := range result.Levels {
		result.Levels[i].Level = i + 1
	}
	var rows []struct{ Level, Count, Minutes int }
	err := filterWorkouts(s.db.WithContext(ctx), userID, filter).
		Select(workoutSummaryFieldsSQL).
		Clauses(clause.GroupBy{Columns: []clause.Column{{Name: strings.TrimSpace(workoutLevelSQL), Raw: true}}}).
		Scan(&rows).Error
	if err != nil {
		return result, fmt.Errorf("summarize workouts: %w", err)
	}
	for _, row := range rows {
		if row.Level < 1 || row.Level > 5 {
			return result, fmt.Errorf("invalid stored workout level")
		}
		result.Levels[row.Level-1].Count = row.Count
		result.Count += row.Count
		result.PlannedMinutes += row.Minutes
	}
	if result.Count > 0 {
		result.AverageMinutes = float64(result.PlannedMinutes) / float64(result.Count)
	}
	return result, nil
}

func workoutDomains(rows []workoutRow) ([]domains.SavedWorkout, error) {
	result := make([]domains.SavedWorkout, 0, len(rows))
	for _, row := range rows {
		item, err := row.domain()
		if err != nil {
			return nil, fmt.Errorf("read workout: %w", err)
		}
		result = append(result, item)
	}
	return result, nil
}
