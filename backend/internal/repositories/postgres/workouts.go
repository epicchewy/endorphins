package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Workouts struct{ db *pgxpool.Pool }

func NewWorkouts(db *pgxpool.Pool) *Workouts { return &Workouts{db: db} }

func (s *Workouts) Create(ctx context.Context, userID string, workout domains.SavedWorkout, key, fingerprint string) (domains.SavedWorkout, error) {
	plan, err := encodeSnapshot(workout.WorkoutPlan)
	if err != nil {
		return domains.SavedWorkout{}, fmt.Errorf("encode workout: %w", err)
	}
	// The unique owner/key constraint serializes concurrent retries. PostgreSQL
	// returns the original immutable snapshot; a different input cannot overwrite it.
	result, err := scanWorkout(s.db.QueryRow(ctx, `INSERT INTO workouts (id,user_id,plan,idempotency_key,input_fingerprint)
 VALUES ($1,$2,$3,NULLIF($4,''),NULLIF($5,''))
 ON CONFLICT (user_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
 WHERE workouts.input_fingerprint=EXCLUDED.input_fingerprint
 RETURNING id,created_at,snapshot_version,plan`, workout.ID, userID, plan, key, fingerprint))
	if errors.Is(err, pgx.ErrNoRows) {
		return domains.SavedWorkout{}, domains.ErrIdempotencyConflict
	}
	if err != nil {
		return domains.SavedWorkout{}, fmt.Errorf("save workout: %w", err)
	}
	return result, nil
}
func (s *Workouts) Get(ctx context.Context, userID, id string) (domains.SavedWorkout, error) {
	result, err := scanWorkout(s.db.QueryRow(ctx, `SELECT id,created_at,snapshot_version,plan FROM workouts WHERE user_id=$1 AND id=$2`, userID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return domains.SavedWorkout{}, domains.ErrNotFound
	}
	if err != nil {
		return domains.SavedWorkout{}, fmt.Errorf("get workout: %w", err)
	}
	return result, nil
}

// Search covers focus, block and exercise names, matching the library's displayed
// content. strpos treats %, _ and backslashes literally instead of LIKE wildcards.
const workoutFilterSQL = `user_id=$1 AND ($2::int=0 OR (plan->>'level')::int=$2)
 AND ($3='' OR strpos(lower(plan->>'focus'),$3)>0
 OR EXISTS (SELECT 1 FROM jsonb_array_elements(plan->'blocks') b
 WHERE strpos(lower(b->>'name'),$3)>0 OR EXISTS (SELECT 1 FROM jsonb_array_elements(b->'exercises') e WHERE strpos(lower(e->>'name'),$3)>0)))`

func (s *Workouts) List(ctx context.Context, userID string, filter domains.WorkoutFilter, before *domains.WorkoutCursor, limit int) ([]domains.SavedWorkout, error) {
	if limit < 1 || limit > 51 {
		return nil, fmt.Errorf("workout list limit must be 1–51")
	}
	args := []any{userID, filter.Level, filter.Query, limit}
	query := `SELECT id,created_at,snapshot_version,plan FROM workouts WHERE ` + workoutFilterSQL
	if before != nil {
		args = append(args, before.CreatedAt, before.ID)
		if filter.Sort == "shortest" {
			args = append(args, before.EstimatedMinutes)
			query += ` AND ((plan->>'estimatedMinutes')::int>$7 OR ((plan->>'estimatedMinutes')::int=$7 AND (created_at,id)<($5,$6)))`
		} else {
			query += ` AND (created_at,id)<($5,$6)`
		}
	}
	if filter.Sort == "shortest" {
		query += ` ORDER BY (plan->>'estimatedMinutes')::int ASC,created_at DESC,id DESC LIMIT $4`
	} else {
		query += ` ORDER BY created_at DESC,id DESC LIMIT $4`
	}
	// Only fixed SQL fragments above are joined. Every user-supplied value is bound.
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list workouts: %w", err)
	}
	defer rows.Close()
	return collectWorkouts(rows)
}
func (s *Workouts) Summary(ctx context.Context, userID string, filter domains.WorkoutFilter) (domains.WorkoutSummary, error) {
	result := domains.WorkoutSummary{Levels: make([]domains.LevelCount, 5)}
	for i := range result.Levels {
		result.Levels[i].Level = i + 1
	}
	rows, err := s.db.Query(ctx, `SELECT (plan->>'level')::int,count(*),COALESCE(sum((plan->>'estimatedMinutes')::int),0)
 FROM workouts WHERE `+workoutFilterSQL+` GROUP BY (plan->>'level')::int`, userID, filter.Level, filter.Query)
	if err != nil {
		return result, fmt.Errorf("summarize workouts: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var level, count, minutes int
		if err := rows.Scan(&level, &count, &minutes); err != nil {
			return result, fmt.Errorf("read summary: %w", err)
		}
		if level < 1 || level > 5 {
			return result, fmt.Errorf("invalid stored workout level")
		}
		result.Levels[level-1].Count = count
		result.Count += count
		result.PlannedMinutes += minutes
	}
	if err := rows.Err(); err != nil {
		return result, fmt.Errorf("read summary: %w", err)
	}
	if result.Count > 0 {
		result.AverageMinutes = float64(result.PlannedMinutes) / float64(result.Count)
	}
	return result, nil
}
func collectWorkouts(rows pgx.Rows) ([]domains.SavedWorkout, error) {
	result := []domains.SavedWorkout{}
	for rows.Next() {
		item, err := scanWorkout(rows)
		if err != nil {
			return nil, fmt.Errorf("read workout: %w", err)
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read workouts: %w", err)
	}
	return result, nil
}
func scanWorkout(row pgx.Row) (domains.SavedWorkout, error) {
	var result domains.SavedWorkout
	var plan []byte
	var version int
	if err := row.Scan(&result.ID, &result.CreatedAt, &version, &plan); err != nil {
		return result, err
	}
	decoded, err := decodeSnapshot(version, plan)
	if err != nil {
		return domains.SavedWorkout{}, err
	}
	result.WorkoutPlan = decoded
	return result, nil
}
