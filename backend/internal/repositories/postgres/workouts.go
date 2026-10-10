package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Workouts struct{ db *gorm.DB }

func NewWorkouts(db *gorm.DB) *Workouts { return &Workouts{db: db} }

type workoutRow struct {
	ID               string    `gorm:"primaryKey;type:text;index:workouts_user_created_id_idx,priority:3,sort:desc;index:workouts_user_duration_created_id_idx,priority:4,sort:desc"`
	UserID           string    `gorm:"type:uuid;not null;index:workouts_user_created_id_idx,priority:1;index:workouts_user_duration_created_id_idx,priority:1;uniqueIndex:workouts_owner_idempotency,priority:1"`
	CreatedAt        time.Time `gorm:"not null;index:workouts_user_created_id_idx,priority:2,sort:desc;index:workouts_user_duration_created_id_idx,priority:3,sort:desc"`
	SnapshotVersion  int       `gorm:"type:smallint;not null;default:1"`
	Plan             []byte    `gorm:"type:jsonb;not null"`
	IdempotencyKey   *string   `gorm:"type:text;uniqueIndex:workouts_owner_idempotency,priority:2"`
	InputFingerprint *string   `gorm:"type:text"`
	// Literal defaults let AutoMigrate add query fields to populated tables.
	Level            int `gorm:"type:integer;not null;default:0"`
	EstimatedMinutes int `gorm:"type:integer;not null;default:0;index:workouts_user_duration_created_id_idx,priority:2"`
}

func (workoutRow) TableName() string { return "workouts" }

type workoutSearchTerm struct {
	UserID    string `gorm:"primaryKey;type:uuid"`
	WorkoutID string `gorm:"primaryKey;type:text"`
	Position  int    `gorm:"primaryKey;type:integer;autoIncrement:false"`
	Name      string `gorm:"type:text;not null"`
}

func (workoutSearchTerm) TableName() string { return "workout_search_terms" }

func (row workoutRow) domain() (domains.SavedWorkout, error) {
	plan, err := decodeSnapshot(row.SnapshotVersion, row.Plan)
	if err != nil {
		return domains.SavedWorkout{}, err
	}
	return domains.SavedWorkout{ID: row.ID, CreatedAt: row.CreatedAt.UTC(), WorkoutPlan: plan}, nil
}

func (s *Workouts) Create(ctx context.Context, userID string, workout domains.SavedWorkout, key, fingerprint string) (domains.SavedWorkout, error) {
	if size := utf8.RuneCountInString(workout.ID); size < 1 || size > 128 {
		return domains.SavedWorkout{}, fmt.Errorf("invalid workout ID")
	}
	if workout.Level < 1 || workout.Level > 5 {
		return domains.SavedWorkout{}, fmt.Errorf("invalid workout level")
	}
	if (key == "") != (fingerprint == "") || utf8.RuneCountInString(key) > 128 || (fingerprint != "" && utf8.RuneCountInString(fingerprint) != 64) {
		return domains.SavedWorkout{}, fmt.Errorf("invalid workout retry metadata")
	}
	plan, err := encodeSnapshot(workout.WorkoutPlan)
	if err != nil {
		return domains.SavedWorkout{}, fmt.Errorf("encode workout: %w", err)
	}
	row := workoutRow{ID: workout.ID, UserID: userID, Plan: plan,
		Level: workout.Level, EstimatedMinutes: workout.EstimatedMinutes}
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
		if err != nil {
			return err
		}
		// Build terms from the returned immutable plan, including on a retry.
		terms := workoutSearchTerms(userID, item)
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&terms).Error; err != nil {
			return fmt.Errorf("save workout search terms: %w", err)
		}
		result = item
		return nil
	})
	if err != nil {
		return domains.SavedWorkout{}, fmt.Errorf("save workout: %w", err)
	}
	return result, nil
}

func workoutSearchTerms(userID string, workout domains.SavedWorkout) []workoutSearchTerm {
	names := []string{workout.Focus}
	for _, block := range workout.Blocks {
		names = append(names, block.Name)
	}
	for _, block := range workout.Blocks {
		for _, exercise := range block.Exercises {
			names = append(names, exercise.Name)
		}
	}
	terms := make([]workoutSearchTerm, 0, len(names))
	for i, name := range names {
		terms = append(terms, workoutSearchTerm{UserID: userID, WorkoutID: workout.ID, Position: i + 1, Name: strings.ToLower(name)})
	}
	return terms
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
	query := db.Model(&workoutRow{}).Where(map[string]any{"workouts.user_id": userID})
	if filter.Level != 0 {
		query = query.Where(map[string]any{"level": filter.Level})
	}
	if filter.Query != "" {
		pattern := "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(strings.ToLower(filter.Query)) + "%"
		query = query.Clauses(clause.From{Joins: []clause.Join{{
			Type:  clause.InnerJoin,
			Table: clause.Table{Name: "workout_search_terms", Alias: "terms"},
			ON: clause.Where{Exprs: []clause.Expression{
				clause.Eq{Column: clause.Column{Table: "terms", Name: "user_id"}, Value: clause.Column{Table: clause.CurrentTable, Name: "user_id"}},
				clause.Eq{Column: clause.Column{Table: "terms", Name: "workout_id"}, Value: clause.Column{Table: clause.CurrentTable, Name: "id"}},
				clause.Like{Column: clause.Column{Table: "terms", Name: "name"}, Value: pattern},
			}},
		}}}).Distinct()
	}
	return query
}

func (s *Workouts) List(ctx context.Context, userID string, filter domains.WorkoutFilter, before *domains.WorkoutCursor, limit int) ([]domains.SavedWorkout, error) {
	if limit < 1 || limit > 51 {
		return nil, fmt.Errorf("workout list limit must be 1–51")
	}
	query := filterWorkouts(s.db.WithContext(ctx), userID, filter)
	minutes := clause.Column{Name: "estimated_minutes"}
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
	var rows []struct {
		ID                      string
		Level, EstimatedMinutes int
	}
	err := filterWorkouts(s.db.WithContext(ctx), userID, filter).
		Select("id", "level", "estimated_minutes").Find(&rows).Error
	if err != nil {
		return result, fmt.Errorf("summarize workouts: %w", err)
	}
	for _, row := range rows {
		if row.Level < 1 || row.Level > 5 {
			return result, fmt.Errorf("invalid stored workout level")
		}
		result.Levels[row.Level-1].Count++
		result.Count++
		result.PlannedMinutes += row.EstimatedMinutes
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
