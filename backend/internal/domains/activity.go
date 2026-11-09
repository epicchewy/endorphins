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

// ActivityCalendar groups completion times into the four Monday-start weeks
// that end with the current week in the reader's time zone.
type ActivityCalendar struct {
	location *time.Location
	// Each week's Monday as a calendar date at UTC midnight, oldest first.
	weeks [4]time.Time
}

func NewActivityCalendar(now time.Time, location *time.Location) ActivityCalendar {
	calendar := ActivityCalendar{location: location}
	thisWeek := mondayOf(now.In(location))
	for i := range calendar.weeks {
		calendar.weeks[i] = thisWeek.AddDate(0, 0, -7*(3-i))
	}
	return calendar
}

// Window returns a UTC range that contains every instant of the four local
// weeks. It pads one day at each end because no zone is more than a day from
// UTC, and a zone that skips local midnight must not lose a completion.
func (c ActivityCalendar) Window() (from, until time.Time) {
	return c.weeks[0].AddDate(0, 0, -1), c.weeks[3].AddDate(0, 0, 8)
}

// Fold counts completions in each week and the distinct local dates in the
// current week. It ignores times outside the four weeks.
func (c ActivityCalendar) Fold(completedAt []time.Time) (weeks []ActivityWeek, activeDaysThisWeek int) {
	weeks = make([]ActivityWeek, len(c.weeks))
	for i, start := range c.weeks {
		weeks[i].Start = start.Format(time.DateOnly)
	}
	activeDays := make(map[string]struct{})
	for _, at := range completedAt {
		local := at.In(c.location)
		monday := mondayOf(local)
		for i, start := range c.weeks {
			if start.Equal(monday) {
				weeks[i].Count++
			}
		}
		if monday.Equal(c.weeks[3]) {
			activeDays[local.Format(time.DateOnly)] = struct{}{}
		}
	}
	return weeks, len(activeDays)
}

// mondayOf returns the Monday of t's local week as a date at UTC midnight. A
// UTC date cannot move to the previous day when a zone skips local midnight.
func mondayOf(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -(int(t.Weekday())+6)%7)
}
