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
			exercises = append(exercises, ExerciseResponse{
				Name:        exercise.Name,
				Description: exercise.Description,
				Difficulty:  exercise.Difficulty,
				Reps:        exercise.Reps,
				Duration:    exercise.Duration,
				Rest:        exercise.Rest,
				Rounds:      exercise.Rounds,
			})
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

type WorkoutLevelCountResponse struct {
	Level int `json:"level"`
	Count int `json:"count"`
}

type WorkoutSummaryResponse struct {
	Count          int                         `json:"count"`
	PlannedMinutes int                         `json:"plannedMinutes"`
	AverageMinutes float64                     `json:"averageMinutes"`
	Levels         []WorkoutLevelCountResponse `json:"levels"`
}

func NewWorkoutSummaryResponse(summary domains.WorkoutSummary) WorkoutSummaryResponse {
	levels := make([]WorkoutLevelCountResponse, 0, len(summary.Levels))
	for _, level := range summary.Levels {
		levels = append(levels, WorkoutLevelCountResponse{Level: level.Level, Count: level.Count})
	}
	return WorkoutSummaryResponse{
		Count:          summary.Count,
		PlannedMinutes: summary.PlannedMinutes,
		AverageMinutes: summary.AverageMinutes,
		Levels:         levels,
	}
}
