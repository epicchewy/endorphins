// Package account maps verified Clerk subjects to stable application users.
package account

import (
	"context"
	"errors"
	"fmt"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

type Users interface {
	Ensure(context.Context, string) (domains.User, error)
	Erase(context.Context, string) error
	Export(context.Context, string) (domains.AccountExport, error)
	Update(context.Context, string, int, bool) (domains.User, error)
}

var ErrInvalidLevel = errors.New("choose a default level from 1 to 5")

type Service struct{ users Users }

func New(users Users) *Service { return &Service{users: users} }
func (s *Service) Resolve(ctx context.Context, subject string) (domains.User, error) {
	if subject == "" || len(subject) > 255 {
		return domains.User{}, fmt.Errorf("verified subject is required")
	}
	return s.users.Ensure(ctx, subject)
}
func (s *Service) Erase(ctx context.Context, subject string) error {
	if subject == "" || len(subject) > 255 {
		return fmt.Errorf("verified subject is required")
	}
	return s.users.Erase(ctx, subject)
}
func (s *Service) Export(ctx context.Context, userID string) (domains.AccountExport, error) {
	if userID == "" {
		return domains.AccountExport{}, fmt.Errorf("account owner is required")
	}
	return s.users.Export(ctx, userID)
}

func (s *Service) Update(ctx context.Context, userID string, level int, completeOnboarding bool) (domains.User, error) {
	if level < 1 || level > 5 {
		return domains.User{}, ErrInvalidLevel
	}
	return s.users.Update(ctx, userID, level, completeOnboarding)
}
