package v1

import (
	"github.com/epicchewy/endorphins/backend/internal/domains"
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

// WorkoutFilterRequest holds decoded query values. The library service owns
// normalization and the rules that make a filter valid for a saved-workout query.
type WorkoutFilterRequest struct {
	Query string
	Level int
	Sort  string
}

func (r WorkoutFilterRequest) ToInput() domains.WorkoutFilter {
	return domains.WorkoutFilter(r)
}

type ListWorkoutsRequest struct {
	Cursor string
	Limit  int
	WorkoutFilterRequest
}

func (r ListWorkoutsRequest) ToInput() library.ListInput {
	return library.ListInput{
		Cursor: r.Cursor,
		Limit:  r.Limit,
		Filter: r.WorkoutFilterRequest.ToInput(),
	}
}
