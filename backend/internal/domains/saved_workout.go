package domains

import "time"

// WorkoutPlan preserves the prescriptions and estimates shown at generation time.
// History never recomputes these values against newer catalogue or timing rules.
type WorkoutPlan struct {
	Level            int
	RequestedMinutes int
	EstimatedMinutes int
	WarmupMinutes    int
	Focus            string
	Blocks           []SavedBlock
}

type SavedBlock struct {
	Name             string
	Sets             int
	EstimatedMinutes int
	Difficulty       string
	Exercises        []Exercise
}

type SavedWorkout struct {
	ID        string
	CreatedAt time.Time
	WorkoutPlan
	// History comes from completion records. The plan snapshot never stores it.
	History WorkoutHistory
}

// WorkoutHistory counts the active (not undone) completions of one saved plan.
type WorkoutHistory struct {
	CompletedCount  int
	LastCompletedAt *time.Time
}

func (h *WorkoutHistory) Add(completedAt time.Time) {
	h.CompletedCount++
	if h.LastCompletedAt == nil || completedAt.After(*h.LastCompletedAt) {
		h.LastCompletedAt = &completedAt
	}
}

type WorkoutCursor struct {
	CreatedAt        time.Time `json:"createdAt"`
	ID               string    `json:"id"`
	EstimatedMinutes int       `json:"estimatedMinutes"`
}

type WorkoutPage struct {
	Items      []SavedWorkout
	NextCursor string
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

// WorkoutFilter describes a view over all saved plans owned by one account.
// An empty level means all levels. Query is a literal case-insensitive substring.
type WorkoutFilter struct {
	Query string
	Level int
	Sort  string
}

type LevelCount struct{ Level, Count int }
type WorkoutSummary struct {
	Count          int
	PlannedMinutes int
	AverageMinutes float64
	Levels         []LevelCount
}
