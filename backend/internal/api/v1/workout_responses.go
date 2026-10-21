package v1

import (
	"time"

	"github.com/epicchewy/endorphins/backend/internal/domains"
)

type ExerciseResponse struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Difficulty  string `json:"difficulty"`
	Reps        int    `json:"reps,omitempty"`
	Duration    int    `json:"duration,omitempty"`
	Rest        int    `json:"rest,omitempty"`
	Rounds      int    `json:"rounds,omitempty"`
}

type WorkoutBlockResponse struct {
	Name             string             `json:"name"`
	Sets             int                `json:"sets"`
	EstimatedMinutes int                `json:"estimatedMinutes"`
	Difficulty       string             `json:"difficulty"`
	Exercises        []ExerciseResponse `json:"exercises"`
}

type WorkoutResponse struct {
	ID               string                 `json:"id"`
	CreatedAt        time.Time              `json:"createdAt"`
	Level            int                    `json:"level"`
	RequestedMinutes int                    `json:"requestedMinutes"`
	EstimatedMinutes int                    `json:"estimatedMinutes"`
	WarmupMinutes    int                    `json:"warmupMinutes"`
	Focus            string                 `json:"focus"`
	Blocks           []WorkoutBlockResponse `json:"blocks"`
}

func NewWorkoutResponse(workout domains.SavedWorkout) WorkoutResponse {
	blocks := make([]WorkoutBlockResponse, 0, len(workout.Blocks))
	for _, block := range workout.Blocks {
		exercises := make([]ExerciseResponse, 0, len(block.Exercises))
		for _, exercise := range block.Exercises {
			exercises = append(exercises, ExerciseResponse(exercise))
		}
		blocks = append(blocks, WorkoutBlockResponse{
			Name:             block.Name,
			Sets:             block.Sets,
			EstimatedMinutes: block.EstimatedMinutes,
			Difficulty:       block.Difficulty,
			Exercises:        exercises,
		})
	}
	return WorkoutResponse{
		ID:               workout.ID,
		CreatedAt:        workout.CreatedAt,
		Level:            workout.Level,
		RequestedMinutes: workout.RequestedMinutes,
		EstimatedMinutes: workout.EstimatedMinutes,
		WarmupMinutes:    workout.WarmupMinutes,
		Focus:            workout.Focus,
		Blocks:           blocks,
	}
}

func newWorkoutResponses(workouts []domains.SavedWorkout) []WorkoutResponse {
	responses := make([]WorkoutResponse, 0, len(workouts))
	for _, workout := range workouts {
		responses = append(responses, NewWorkoutResponse(workout))
	}
	return responses
}

type WorkoutPageResponse struct {
	Items      []WorkoutResponse `json:"items"`
	NextCursor string            `json:"nextCursor"`
}

func NewWorkoutPageResponse(page domains.WorkoutPage) WorkoutPageResponse {
	return WorkoutPageResponse{
		Items:      newWorkoutResponses(page.Items),
		NextCursor: page.NextCursor,
	}
}

type WorkoutSummaryResponse struct {
	Count int `json:"count"`
}

func NewWorkoutSummaryResponse(summary domains.WorkoutSummary) WorkoutSummaryResponse {
	return WorkoutSummaryResponse(summary)
}
