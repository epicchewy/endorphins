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
	err = tx.QueryRow(ctx, `SELECT id::text,clerk_user_id,created_at FROM users WHERE clerk_user_id=$1`, subject).Scan(&user.ID, &user.ClerkUserID, &user.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `INSERT INTO users (clerk_user_id) VALUES ($1) RETURNING id::text,clerk_user_id,created_at`, subject).Scan(&user.ID, &user.ClerkUserID, &user.CreatedAt)
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
	err = tx.QueryRow(ctx, `SELECT id::text,clerk_user_id,created_at FROM users WHERE id=$1`, userID).Scan(&result.User.ID, &result.User.ClerkUserID, &result.User.CreatedAt)
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
	rows.Close()
	if err != nil {
		return result, err
	}
	if err := tx.Commit(ctx); err != nil {
		return result, fmt.Errorf("finish account export: %w", err)
	}
	return result, nil
}
