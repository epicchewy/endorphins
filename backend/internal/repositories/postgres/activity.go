package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
	"unicode/utf8"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type completionRow struct {
	ID             string     `gorm:"primaryKey;type:uuid;index:workout_completions_user_activity_idx,priority:4,sort:desc"`
	UserID         string     `gorm:"type:uuid;not null;uniqueIndex:workout_completions_user_id_idempotency_key_key,priority:1;index:workout_completions_user_activity_idx,priority:1;index:workout_completions_user_workout_idx,priority:1"`
	WorkoutID      string     `gorm:"type:text;not null;index:workout_completions_user_workout_idx,priority:2"`
	CompletedAt    time.Time  `gorm:"not null;autoCreateTime;index:workout_completions_user_activity_idx,priority:3,sort:desc"`
	UndoneAt       *time.Time `gorm:"index:workout_completions_user_activity_idx,priority:2"`
	IdempotencyKey string     `gorm:"type:text;not null;uniqueIndex:workout_completions_user_id_idempotency_key_key,priority:2"`
	// Both parts of the relationship are required for account ownership.
	Workout workoutRow `gorm:"foreignKey:UserID,WorkoutID;references:UserID,ID"`
}

func (completionRow) TableName() string { return "workout_completions" }

func (row *completionRow) BeforeCreate(_ *gorm.DB) error {
	if row.ID == "" {
		row.ID = uuid.NewString()
	}
	return nil
}

func (row completionRow) domain() (domains.Completion, error) {
	// Read only the focus, independent of the snapshot version, so a completion
	// still records against a plan saved by a newer release.
	var plan struct {
		Focus *string `json:"focus"`
	}
	if err := json.Unmarshal(row.Workout.Plan, &plan); err != nil || plan.Focus == nil {
		return domains.Completion{}, fmt.Errorf("read completion plan focus")
	}
	if row.UndoneAt != nil {
		undone := row.UndoneAt.UTC()
		row.UndoneAt = &undone
	}
	return domains.Completion{
		ID: row.ID, WorkoutID: row.WorkoutID, CompletedAt: row.CompletedAt.UTC(),
		UndoneAt: row.UndoneAt, Level: row.Workout.Level, Focus: *plan.Focus,
	}, nil
}

func completionQuery(db *gorm.DB, userID string) *gorm.DB {
	return db.Model(&completionRow{}).InnerJoins("Workout", db.Select("ID", "UserID", "Level", "Plan")).
		Where(map[string]any{"workout_completions.user_id": userID}).
		Order(clause.OrderByColumn{Column: clause.Column{Table: clause.CurrentTable, Name: "completed_at"}, Desc: true}).
		Order(clause.OrderByColumn{Column: clause.Column{Table: clause.CurrentTable, Name: "id"}, Desc: true})
}

func completionDomains(rows []completionRow) ([]domains.Completion, error) {
	result := make([]domains.Completion, 0, len(rows))
	for _, row := range rows {
		item, err := row.domain()
		if err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, nil
}

// addHistory counts each active completion against its saved plan.
func addHistory(items []domains.SavedWorkout, completions []completionRow) {
	index := make(map[string]*domains.WorkoutHistory, len(items))
	for i := range items {
		index[items[i].ID] = &items[i].History
	}
	for _, row := range completions {
		if history := index[row.WorkoutID]; history != nil && row.UndoneAt == nil {
			history.Add(row.CompletedAt.UTC())
		}
	}
}

// withHistory reads the active completions of plans that one owner already holds.
func withHistory(db *gorm.DB, userID string, items []domains.SavedWorkout) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]string, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}
	var rows []completionRow
	err := db.Select("workout_id", "completed_at", "undone_at").
		Where(map[string]any{"user_id": userID, "workout_id": ids, "undone_at": nil}).Find(&rows).Error
	if err != nil {
		return fmt.Errorf("read workout history: %w", err)
	}
	addHistory(items, rows)
	return nil
}

func (s *Workouts) Complete(ctx context.Context, userID, workoutID, key string) (domains.Completion, error) {
	if size := utf8.RuneCountInString(key); size < 1 || size > 128 {
		return domains.Completion{}, fmt.Errorf("invalid completion retry key")
	}
	row := completionRow{UserID: userID, WorkoutID: workoutID, IdempotencyKey: key}
	var result domains.Completion
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockWorkoutOwner(tx, userID); err != nil {
			return err
		}
		if err := tx.Where(map[string]any{"user_id": userID, "id": workoutID}).Take(&row.Workout).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return domains.ErrNotFound
			}
			return fmt.Errorf("check completion plan: %w", err)
		}
		saved := tx.Omit(clause.Associations).Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "idempotency_key"}},
			DoUpdates: clause.AssignmentColumns([]string{"idempotency_key"}),
			Where: clause.Where{Exprs: []clause.Expression{clause.Eq{
				Column: clause.Column{Table: "workout_completions", Name: "workout_id"},
				Value:  clause.Column{Table: "excluded", Name: "workout_id"},
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
		return domains.Completion{}, fmt.Errorf("save completion: %w", err)
	}
	return result, nil
}

func (s *Workouts) Undo(ctx context.Context, userID, id string) error {
	parsed, err := uuid.Parse(id)
	if err != nil || parsed.String() != id {
		return domains.ErrNotFound
	}
	// Keep the first undo time and retry key. A delayed retry cannot restore it.
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row completionRow
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where(map[string]any{"user_id": userID, "id": id}).Take(&row).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domains.ErrNotFound
		}
		if err != nil || row.UndoneAt != nil {
			return err
		}
		return tx.Model(&row).Where(map[string]any{"user_id": userID}).UpdateColumn("undone_at", time.Now().UTC()).Error
	})
	if err != nil {
		return fmt.Errorf("undo completion: %w", err)
	}
	return nil
}

// Activity reads one consistent snapshot of the owner's active completions and
// folds their times into the reader's local calendar.
func (s *Workouts) Activity(ctx context.Context, userID string, location *time.Location) (domains.Activity, error) {
	calendar := domains.NewActivityCalendar(s.db.NowFunc(), location)
	from, until := calendar.Window()
	result := domains.Activity{Recent: make([]domains.Completion, 0)}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		err := tx.Model(&completionRow{}).Where(map[string]any{"user_id": userID, "undone_at": nil}).
			Count(&count).Error
		if err != nil {
			return fmt.Errorf("summarize activity: %w", err)
		}
		result.CompletedCount = int(count)
		var dates []time.Time
		err = tx.Model(&completionRow{}).Where(map[string]any{"user_id": userID, "undone_at": nil}).
			Where(clause.Gte{Column: "completed_at", Value: from}).
			Where(clause.Lt{Column: "completed_at", Value: until}).
			Pluck("completed_at", &dates).Error
		if err != nil {
			return fmt.Errorf("summarize activity weeks: %w", err)
		}
		result.Weeks, result.ActiveDaysThisWeek = calendar.Fold(dates)
		var recent []completionRow
		if err := completionQuery(tx, userID).Where(map[string]any{"workout_completions.undone_at": nil}).Limit(5).Find(&recent).Error; err != nil {
			return fmt.Errorf("list recent activity: %w", err)
		}
		result.Recent, err = completionDomains(recent)
		return err
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return domains.Activity{}, fmt.Errorf("get activity: %w", err)
	}
	return result, nil
}
