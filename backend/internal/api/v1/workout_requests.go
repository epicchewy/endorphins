package v1

import (
	"github.com/epicchewy/endorphins/backend/internal/services/library"
	"github.com/epicchewy/endorphins/backend/internal/services/workout"
)

type CreateWorkoutRequest struct {
	DurationMinutes int `json:"durationMinutes"`
	Level           int `json:"level"`
}

func (r CreateWorkoutRequest) ToInput() workout.GenerateInput {
	return workout.GenerateInput(r)
}

type ListWorkoutsRequest struct {
	Cursor string
	Limit  int
}

func (r ListWorkoutsRequest) ToInput() library.ListInput {
	return library.ListInput(r)
}
