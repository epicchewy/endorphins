package v1

import (
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

type UserResponse struct {
	ID          string    `json:"id"`
	ClerkUserID string    `json:"clerkUserId"`
	CreatedAt   time.Time `json:"createdAt"`
}

func NewUserResponse(user domains.User) UserResponse {
	return UserResponse{
		ID:          user.ID,
		ClerkUserID: user.ClerkUserID,
		CreatedAt:   user.CreatedAt,
	}
}

type AccountExportResponse struct {
	Version    int               `json:"version"`
	ExportedAt time.Time         `json:"exportedAt"`
	User       UserResponse      `json:"user"`
	Workouts   []WorkoutResponse `json:"workouts"`
}

func NewAccountExportResponse(export domains.AccountExport) AccountExportResponse {
	return AccountExportResponse{
		Version:    1,
		ExportedAt: export.ExportedAt,
		User:       NewUserResponse(export.User),
		Workouts:   newWorkoutResponses(export.Workouts),
	}
}
