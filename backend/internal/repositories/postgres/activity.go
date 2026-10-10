package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type completionRow struct {
	ID             string `gorm:"primaryKey;type:uuid;default:(-)"`
	UserID         string
	WorkoutID      string
	CompletedAt    time.Time `gorm:"default:(-)"`
	UndoneAt       *time.Time
	IdempotencyKey string
	// Both parts of the relationship are required for account ownership.
	Workout workoutRow `gorm:"foreignKey:UserID,WorkoutID;references:UserID,ID"`
}

func (completionRow) TableName() string { return "workout_completions" }

func (row completionRow) domain() (domains.Completion, error) {
	level, focus, err := decodeCompletionMetadata(row.Workout.Plan)
	if err != nil {
		return domains.Completion{}, err
	}
	return domains.Completion{
		ID: row.ID, WorkoutID: row.WorkoutID, CompletedAt: row.CompletedAt,
		UndoneAt: row.UndoneAt, Level: level, Focus: focus,
	}, nil
}

func completionQuery(db *gorm.DB, userID string) *gorm.DB {
	return db.Model(&completionRow{}).InnerJoins("Workout", db.Select("ID", "UserID", "Plan")).
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

func (s *Workouts) Complete(ctx context.Context, userID, workoutID, key string) (domains.Completion, error) {
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

func (s *Workouts) Activity(ctx context.Context, userID, zone string) (domains.Activity, error) {
	result := domains.Activity{Weeks: make([]domains.ActivityWeek, 4), Recent: make([]domains.Completion, 0)}
	location, err := time.LoadLocation(zone)
	if err != nil {
		return result, fmt.Errorf("load activity time zone: %w", err)
	}
	now := s.db.NowFunc().In(location)
	// UTC here represents calendar dates, so a skipped local midnight cannot
	// move a week label into the previous day.
	week := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -(int(now.Weekday())+6)%7)
	for i := range result.Weeks {
		result.Weeks[i].Start = week.AddDate(0, 0, -7*(3-i)).Format("2006-01-02")
	}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		err := tx.Model(&completionRow{}).Where(map[string]any{"user_id": userID, "undone_at": nil}).
			Count(&count).Error
		if err != nil {
			return fmt.Errorf("summarize activity: %w", err)
		}
		result.CompletedCount = int(count)
		var dates []time.Time
		// Pad the UTC window by one day at each end to include every local date,
		// even when a zone skips midnight. Only the four week labels count below.
		from, until := week.AddDate(0, 0, -22), week.AddDate(0, 0, 8)
		err = tx.Model(&completionRow{}).Where(map[string]any{"user_id": userID, "undone_at": nil}).
			Where(clause.Gte{Column: "completed_at", Value: from}).
			Where(clause.Lt{Column: "completed_at", Value: until}).
			Pluck("completed_at", &dates).Error
		if err != nil {
			return fmt.Errorf("summarize activity weeks: %w", err)
		}
		activeDays := make(map[string]struct{})
		for _, date := range dates {
			local := date.In(location)
			start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, time.UTC).
				AddDate(0, 0, -(int(local.Weekday())+6)%7).Format("2006-01-02")
			for i := range result.Weeks {
				if result.Weeks[i].Start == start {
					result.Weeks[i].Count++
				}
			}
			if start == result.Weeks[3].Start {
				activeDays[local.Format("2006-01-02")] = struct{}{}
			}
		}
		result.ActiveDaysThisWeek = len(activeDays)
		var recent []completionRow
		if err := completionQuery(tx, userID).Where(map[string]any{"workout_completions.undone_at": nil}).Limit(5).Find(&recent).Error; err != nil {
			return fmt.Errorf("list recent activity: %w", err)
		}
		result.Recent, err = completionDomains(recent)
		return err
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return result, fmt.Errorf("get activity: %w", err)
	}
	return result, nil
}
