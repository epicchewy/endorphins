package postgres

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Users struct{ db *gorm.DB }

func NewUsers(db *gorm.DB) *Users { return &Users{db: db} }

type userRow struct {
	ID                    string `gorm:"primaryKey;type:uuid;default:(-)"`
	ClerkUserID           string
	CreatedAt             time.Time `gorm:"autoCreateTime:false;default:(-)"`
	DefaultLevel          int       `gorm:"default:(-)"`
	OnboardingCompletedAt *time.Time
}

func (userRow) TableName() string { return "users" }
func (row userRow) domain() domains.User {
	return domains.User{
		ID: row.ID, ClerkUserID: row.ClerkUserID, CreatedAt: row.CreatedAt,
		DefaultLevel: row.DefaultLevel, OnboardingCompletedAt: row.OnboardingCompletedAt,
	}
}

type deletedAccountRow struct {
	SubjectHash string `gorm:"primaryKey"`
}

func (deletedAccountRow) TableName() string { return "deleted_accounts" }

func subjectHash(subject string) string {
	digest := sha256.Sum256([]byte(subject))
	return hex.EncodeToString(digest[:])
}

// Ensure and Erase share the same transaction lock. Erasure leaves a tombstone
// that prevents a concurrent or late request from recreating the account.
func (s *Users) Ensure(ctx context.Context, subject string) (domains.User, error) {
	var row userRow
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(lockAccountSQL, subject).Error; err != nil {
			return fmt.Errorf("lock account: %w", err)
		}
		var deleted int64
		if err := tx.Model(&deletedAccountRow{}).Where(map[string]any{"subject_hash": subjectHash(subject)}).Count(&deleted).Error; err != nil {
			return fmt.Errorf("check account lifecycle: %w", err)
		}
		if deleted != 0 {
			return domains.ErrAccountDeleted
		}
		return tx.Where(map[string]any{"clerk_user_id": subject}).FirstOrCreate(&row).Error
	})
	if err != nil {
		return domains.User{}, fmt.Errorf("resolve user: %w", err)
	}
	return row.domain(), nil
}

func (s *Users) Erase(ctx context.Context, subject string) error {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec(lockAccountSQL, subject).Error; err != nil {
			return fmt.Errorf("lock account erasure: %w", err)
		}
		tombstone := deletedAccountRow{SubjectHash: subjectHash(subject)}
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&tombstone).Error; err != nil {
			return fmt.Errorf("record deleted account: %w", err)
		}
		// Child writes hold KEY SHARE on the same owner. Cleanup takes UPDATE.
		var owner userRow
		err := tx.Select("id").Clauses(clause.Locking{Strength: "UPDATE"}).
			Where(map[string]any{"clerk_user_id": subject}).Take(&owner).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("lock account cleanup: %w", err)
		}
		if err := tx.Where(map[string]any{"user_id": owner.ID}).Delete(&completionRow{}).Error; err != nil {
			return fmt.Errorf("erase account completions: %w", err)
		}
		if err := tx.Where(map[string]any{"user_id": owner.ID}).Delete(&workoutRow{}).Error; err != nil {
			return fmt.Errorf("erase account workouts: %w", err)
		}
		return tx.Delete(&owner).Error
	})
	if err != nil {
		return fmt.Errorf("erase account: %w", err)
	}
	return nil
}

func (s *Users) Export(ctx context.Context, userID string) (domains.AccountExport, error) {
	result := domains.AccountExport{ExportedAt: time.Now().UTC()}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user userRow
		err := tx.Where(map[string]any{"id": userID}).Take(&user).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return domains.ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("export user: %w", err)
		}
		result.User = user.domain()
		var workouts []workoutRow
		err = tx.Where(map[string]any{"user_id": userID}).
			Order(clause.OrderByColumn{Column: clause.Column{Name: "created_at"}, Desc: true}).
			Order(clause.OrderByColumn{Column: clause.Column{Name: "id"}, Desc: true}).Find(&workouts).Error
		if err != nil {
			return fmt.Errorf("export workouts: %w", err)
		}
		result.Workouts, err = workoutDomains(workouts)
		if err != nil {
			return err
		}
		var completions []completionRow
		if err := completionQuery(tx, userID).Find(&completions).Error; err != nil {
			return fmt.Errorf("export completions: %w", err)
		}
		result.Completions, err = completionDomains(completions)
		return err
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return result, fmt.Errorf("export account: %w", err)
	}
	return result, nil
}

func (s *Users) Update(ctx context.Context, userID string, level int, completeOnboarding bool) (domains.User, error) {
	var row userRow
	updates := map[string]any{"default_level": level}
	if completeOnboarding {
		updates["onboarding_completed_at"] = gorm.Expr(onboardingTimestampSQL)
	}
	result := s.db.WithContext(ctx).Model(&row).Where(map[string]any{"id": userID}).
		Clauses(clause.Returning{}).Updates(updates)
	if result.Error != nil {
		return domains.User{}, fmt.Errorf("update account: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return domains.User{}, domains.ErrNotFound
	}
	return row.domain(), nil
}
