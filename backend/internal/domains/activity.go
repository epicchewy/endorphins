package domains

import "time"

// Completion records a user's confirmation, not measured exercise performance.
type Completion struct {
	ID          string
	WorkoutID   string
	CompletedAt time.Time
	UndoneAt    *time.Time
	Level       int
	Focus       string
}

type ActivityWeek struct {
	Start string
	Count int
}

type Activity struct {
	CompletedCount     int
	ActiveDaysThisWeek int
	Weeks              []ActivityWeek
	Recent             []Completion
}
