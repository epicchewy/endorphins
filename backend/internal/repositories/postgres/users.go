package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Users struct{ db *pgxpool.Pool }

func NewUsers(db *pgxpool.Pool) *Users { return &Users{db: db} }
func subjectHash(subject string) string {
	digest := sha256.Sum256([]byte(subject))
	return hex.EncodeToString(digest[:])
}

// Ensure and Erase take the same per-subject transaction lock. A deletion racing
// first-use provisioning always leaves a tombstone and no resurrected account.
func (s *Users) Ensure(ctx context.Context, subject string) (domains.User, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return domains.User{}, fmt.Errorf("begin account resolution: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, subject); err != nil {
		return domains.User{}, fmt.Errorf("lock account: %w", err)
	}
	var deleted bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM deleted_accounts WHERE subject_hash=$1)`, subjectHash(subject)).Scan(&deleted); err != nil {
		return domains.User{}, fmt.Errorf("check account lifecycle: %w", err)
	}
	if deleted {
		return domains.User{}, domains.ErrAccountDeleted
	}
	var user domains.User
	err = tx.QueryRow(ctx, `SELECT id::text,clerk_user_id,created_at,default_level,onboarding_completed_at FROM users WHERE clerk_user_id=$1`, subject).Scan(&user.ID, &user.ClerkUserID, &user.CreatedAt, &user.DefaultLevel, &user.OnboardingCompletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `INSERT INTO users (clerk_user_id) VALUES ($1) RETURNING id::text,clerk_user_id,created_at,default_level,onboarding_completed_at`, subject).Scan(&user.ID, &user.ClerkUserID, &user.CreatedAt, &user.DefaultLevel, &user.OnboardingCompletedAt)
	}
	if err != nil {
		return domains.User{}, fmt.Errorf("resolve user: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return domains.User{}, fmt.Errorf("commit account resolution: %w", err)
	}
	return user, nil
}
func (s *Users) Erase(ctx context.Context, subject string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin account erasure: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, subject); err != nil {
		return fmt.Errorf("lock account erasure: %w", err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO deleted_accounts (subject_hash) VALUES ($1) ON CONFLICT DO NOTHING`, subjectHash(subject)); err != nil {
		return fmt.Errorf("record deleted account: %w", err)
	}
	// Lock before deleting children. Child writes hold a key-share lock on the
	// same row, so a concurrent save either precedes cleanup or finds no owner.
	var userID string
	err = tx.QueryRow(ctx, `SELECT id::text FROM users WHERE clerk_user_id=$1 FOR UPDATE`, subject).Scan(&userID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("lock account cleanup: %w", err)
	}
	if userID != "" {
		if _, err := tx.Exec(ctx, `DELETE FROM workout_completions WHERE user_id=$1`, userID); err != nil {
			return fmt.Errorf("erase account completions: %w", err)
		}
		if _, err := tx.Exec(ctx, `DELETE FROM workouts WHERE user_id=$1`, userID); err != nil {
			return fmt.Errorf("erase account workouts: %w", err)
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM users WHERE clerk_user_id=$1`, subject); err != nil {
		return fmt.Errorf("erase account: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit account erasure: %w", err)
	}
	return nil
}
func (s *Users) Export(ctx context.Context, userID string) (domains.AccountExport, error) {
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return domains.AccountExport{}, fmt.Errorf("begin account export: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	result := domains.AccountExport{ExportedAt: time.Now().UTC()}
	err = tx.QueryRow(ctx, `SELECT id::text,clerk_user_id,created_at,default_level,onboarding_completed_at FROM users WHERE id=$1`, userID).Scan(&result.User.ID, &result.User.ClerkUserID, &result.User.CreatedAt, &result.User.DefaultLevel, &result.User.OnboardingCompletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, domains.ErrNotFound
	}
	if err != nil {
		return result, fmt.Errorf("export user: %w", err)
	}
	rows, err := tx.Query(ctx, `SELECT id,created_at,snapshot_version,plan FROM workouts WHERE user_id=$1 ORDER BY created_at DESC,id DESC`, userID)
	if err != nil {
		return result, fmt.Errorf("export workouts: %w", err)
	}
	result.Workouts, err = collectWorkouts(rows)
	if err != nil {
		return result, err
	}
	completionRows, err := tx.Query(ctx, completionSelect+` WHERE c.user_id=$1 ORDER BY c.completed_at DESC,c.id DESC`, userID)
	if err != nil {
		return result, fmt.Errorf("export completions: %w", err)
	}
	result.Completions, err = collectCompletions(completionRows)
	if err != nil {
		return result, err
	}
	if err := tx.Commit(ctx); err != nil {
		return result, fmt.Errorf("finish account export: %w", err)
	}
	return result, nil
}

func (s *Users) Update(ctx context.Context, userID string, level int, completeOnboarding bool) (domains.User, error) {
	var user domains.User
	err := s.db.QueryRow(ctx, `UPDATE users SET default_level=$2,
 onboarding_completed_at=CASE WHEN $3 THEN COALESCE(onboarding_completed_at,now()) ELSE onboarding_completed_at END
 WHERE id=$1 RETURNING id::text,clerk_user_id,created_at,default_level,onboarding_completed_at`, userID, level, completeOnboarding).Scan(&user.ID, &user.ClerkUserID, &user.CreatedAt, &user.DefaultLevel, &user.OnboardingCompletedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return user, domains.ErrNotFound
	}
	if err != nil {
		return user, fmt.Errorf("update account: %w", err)
	}
	return user, nil
}
