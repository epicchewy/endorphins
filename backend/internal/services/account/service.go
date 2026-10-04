// Package account maps verified Clerk subjects to stable application users.
package account

import (
	"context"
	"fmt"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

type Users interface {
	Ensure(context.Context, string) (domains.User, error)
	Erase(context.Context, string) error
	Export(context.Context, string) (domains.AccountExport, error)
}
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
