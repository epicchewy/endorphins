package v1

import (
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

type UserResponse struct {
	ID                    string     `json:"id"`
	ClerkUserID           string     `json:"clerkUserId"`
	CreatedAt             time.Time  `json:"createdAt"`
	DefaultLevel          int        `json:"defaultLevel"`
	OnboardingCompletedAt *time.Time `json:"onboardingCompletedAt"`
}

func NewUserResponse(user domains.User) UserResponse {
	return UserResponse(user)
}

type AccountExportResponse struct {
	Version     int                  `json:"version"`
	ExportedAt  time.Time            `json:"exportedAt"`
	User        UserResponse         `json:"user"`
	Workouts    []WorkoutResponse    `json:"workouts"`
	Completions []CompletionResponse `json:"completions"`
}

func NewAccountExportResponse(export domains.AccountExport) AccountExportResponse {
	return AccountExportResponse{
		Version:     2,
		ExportedAt:  export.ExportedAt,
		User:        NewUserResponse(export.User),
		Workouts:    newWorkoutResponses(export.Workouts),
		Completions: newCompletionResponses(export.Completions),
	}
}
