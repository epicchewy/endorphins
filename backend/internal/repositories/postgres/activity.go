package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/jackc/pgx/v5"
)

const completionSelect = `SELECT c.id::text,c.workout_id,c.completed_at,c.undone_at,
 (w.plan->>'level')::int,w.plan->>'focus'
 FROM workout_completions c JOIN workouts w ON w.user_id=c.user_id AND w.id=c.workout_id`

func scanCompletion(row pgx.Row) (domains.Completion, error) {
	var result domains.Completion
	err := row.Scan(&result.ID, &result.WorkoutID, &result.CompletedAt, &result.UndoneAt, &result.Level, &result.Focus)
	return result, err
}
func collectCompletions(rows pgx.Rows) ([]domains.Completion, error) {
	result, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (domains.Completion, error) {
		return scanCompletion(row)
	})
	if err != nil {
		return nil, fmt.Errorf("read completions: %w", err)
	}
	return result, nil
}

func (s *Workouts) Complete(ctx context.Context, userID, workoutID, key string) (domains.Completion, error) {
	var result domains.Completion
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return result, fmt.Errorf("begin completion save: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := lockWorkoutOwner(ctx, tx, userID); err != nil {
		return result, err
	}
	// The owner check and unique retry key are enforced in the same write.
	result, err = scanCompletion(tx.QueryRow(ctx, `WITH saved AS (
 INSERT INTO workout_completions (user_id,workout_id,idempotency_key)
 SELECT user_id,id,$3 FROM workouts WHERE user_id=$1 AND id=$2
 ON CONFLICT (user_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
 WHERE workout_completions.workout_id=EXCLUDED.workout_id
 RETURNING id,workout_id,completed_at,undone_at
 ) SELECT saved.id::text,saved.workout_id,saved.completed_at,saved.undone_at,
 (w.plan->>'level')::int,w.plan->>'focus'
 FROM saved JOIN workouts w ON w.user_id=$1 AND w.id=saved.workout_id`, userID, workoutID, key))
	if errors.Is(err, pgx.ErrNoRows) {
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM workouts WHERE user_id=$1 AND id=$2)`, userID, workoutID).Scan(&exists); err != nil {
			return result, fmt.Errorf("check completion plan: %w", err)
		}
		if !exists {
			return result, domains.ErrNotFound
		}
		return result, domains.ErrIdempotencyConflict
	}
	if err != nil {
		return result, fmt.Errorf("save completion: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return result, fmt.Errorf("commit completion save: %w", err)
	}
	return result, nil
}

func (s *Workouts) Undo(ctx context.Context, userID, id string) error {
	// Retain the retry key: a delayed repeat request must not restore an undone log.
	result, err := s.db.Exec(ctx, `UPDATE workout_completions SET undone_at=COALESCE(undone_at,now()) WHERE user_id=$1 AND id::text=$2`, userID, id)
	if err != nil {
		return fmt.Errorf("undo completion: %w", err)
	}
	if result.RowsAffected() == 0 {
		return domains.ErrNotFound
	}
	return nil
}

func (s *Workouts) Activity(ctx context.Context, userID, zone string) (domains.Activity, error) {
	result := domains.Activity{Weeks: make([]domains.ActivityWeek, 4), Recent: make([]domains.Completion, 0)}
	location, err := time.LoadLocation(zone)
	if err != nil {
		return result, fmt.Errorf("load activity time zone: %w", err)
	}
	now := time.Now().In(location)
	week := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, location).AddDate(0, 0, -(int(now.Weekday())+6)%7)
	for i := range result.Weeks {
		result.Weeks[i].Start = week.AddDate(0, 0, -7*(3-i)).Format("2006-01-02")
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return result, fmt.Errorf("begin activity summary: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	err = tx.QueryRow(ctx, `SELECT count(*),count(DISTINCT (completed_at AT TIME ZONE $2)::date)
 FILTER(WHERE completed_at >= $3 AND completed_at < $4)
 FROM workout_completions WHERE user_id=$1 AND undone_at IS NULL`, userID, zone, week, week.AddDate(0, 0, 7)).Scan(&result.CompletedCount, &result.ActiveDaysThisWeek)
	if err != nil {
		return result, fmt.Errorf("summarize activity: %w", err)
	}
	rows, err := tx.Query(ctx, `SELECT to_char(date_trunc('week',completed_at AT TIME ZONE $2),'YYYY-MM-DD'),count(*)
 FROM workout_completions WHERE user_id=$1 AND undone_at IS NULL AND completed_at >= $3 AND completed_at < $4
 GROUP BY 1`, userID, zone, week.AddDate(0, 0, -21), week.AddDate(0, 0, 7))
	if err != nil {
		return result, fmt.Errorf("summarize activity weeks: %w", err)
	}
	for rows.Next() {
		var start string
		var count int
		if err := rows.Scan(&start, &count); err != nil {
			rows.Close()
			return result, fmt.Errorf("read activity week: %w", err)
		}
		for i := range result.Weeks {
			if result.Weeks[i].Start == start {
				result.Weeks[i].Count = count
			}
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, fmt.Errorf("read activity weeks: %w", err)
	}
	rows, err = tx.Query(ctx, completionSelect+` WHERE c.user_id=$1 AND c.undone_at IS NULL ORDER BY c.completed_at DESC,c.id DESC LIMIT 5`, userID)
	if err != nil {
		return result, fmt.Errorf("list recent activity: %w", err)
	}
	result.Recent, err = collectCompletions(rows)
	if err != nil {
		return result, err
	}
	if err := tx.Commit(ctx); err != nil {
		return result, fmt.Errorf("finish activity summary: %w", err)
	}
	return result, nil
}
