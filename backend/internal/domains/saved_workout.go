package domains

import "time"

// WorkoutPlan preserves the prescriptions and estimates shown at generation time.
// History never recomputes these values against newer catalogue or timing rules.
type WorkoutPlan struct {
	Level            int          `json:"level"`
	RequestedMinutes int          `json:"requestedMinutes"`
	EstimatedMinutes int          `json:"estimatedMinutes"`
	WarmupMinutes    int          `json:"warmupMinutes"`
	Focus            string       `json:"focus"`
	Blocks           []SavedBlock `json:"blocks"`
}

type SavedBlock struct {
	Name             string     `json:"name"`
	Sets             int        `json:"sets"`
	EstimatedMinutes int        `json:"estimatedMinutes"`
	Difficulty       string     `json:"difficulty"`
	Exercises        []Exercise `json:"exercises"`
}

type SavedWorkout struct {
	ID        string    `json:"id"`
	CreatedAt time.Time `json:"createdAt"`
	WorkoutPlan
}

type WorkoutCursor struct {
	CreatedAt time.Time `json:"createdAt"`
	ID        string    `json:"id"`
}

type WorkoutPage struct {
	Items      []SavedWorkout `json:"items"`
	NextCursor string         `json:"nextCursor"`
}

func Snapshot(w Workout) SavedWorkout {
	result := SavedWorkout{ID: w.ID, WorkoutPlan: WorkoutPlan{
		Level: w.Level, RequestedMinutes: w.RequestedMinutes, EstimatedMinutes: w.Minutes(),
		WarmupMinutes: w.WarmupMinutes, Focus: w.Focus(), Blocks: make([]SavedBlock, 0, len(w.Blocks)),
	}}
	for _, b := range w.Blocks {
		result.Blocks = append(result.Blocks, SavedBlock{
			Name: b.Name, Sets: b.Sets, EstimatedMinutes: b.Minutes(), Difficulty: b.Difficulty(), Exercises: b.Exercises,
		})
	}
	return result
}

type WorkoutSummary struct{ Count int }
