package domains

import (
	"testing"
	"time"
	_ "time/tzdata"
)

func TestActivityCalendarUsesLocalDaysAndMondayWeeks(t *testing.T) {
	location, err := time.LoadLocation("America/New_York")
	if err != nil {
		t.Fatal(err)
	}
	monday := time.Date(2026, 3, 9, 0, 0, 0, 0, location)
	calendar := NewActivityCalendar(monday.Add(57*time.Hour), location)
	// Two times on Monday count as one active day. One second before local
	// Monday belongs to the previous week, although its UTC day is Monday.
	// The fifth week back is outside the calendar.
	weeks, activeDays := calendar.Fold([]time.Time{
		monday, monday.Add(time.Hour), monday.AddDate(0, 0, 1), monday.Add(-time.Second),
		monday.AddDate(0, 0, -7), monday.AddDate(0, 0, -14), monday.AddDate(0, 0, -21), monday.AddDate(0, 0, -28),
	})
	expected := []ActivityWeek{{"2026-02-16", 1}, {"2026-02-23", 1}, {"2026-03-02", 2}, {"2026-03-09", 3}}
	if len(weeks) != len(expected) {
		t.Fatalf("weeks %v", weeks)
	}
	for i := range expected {
		if weeks[i] != expected[i] {
			t.Fatalf("weeks %v, want %v", weeks, expected)
		}
	}
	if activeDays != 2 {
		t.Fatalf("active days %d, want 2", activeDays)
	}
	from, until := calendar.Window()
	if !from.Before(monday.AddDate(0, 0, -21)) || !until.After(monday.AddDate(0, 0, 7)) {
		t.Fatalf("window %s–%s misses the four local weeks", from, until)
	}
}

func TestActivityCalendarCountsDaysWhenLocalMidnightIsSkipped(t *testing.T) {
	for _, tt := range []struct {
		zone, confirmation, monday string
	}{
		{"America/Santiago", "2026-09-06T12:00:00-03:00", "2026-08-31"},
		{"America/Havana", "2026-03-08T12:00:00-04:00", "2026-03-02"},
		{"Asia/Tehran", "2010-03-21T23:30:00+03:30", "2010-03-15"},
	} {
		t.Run(tt.zone, func(t *testing.T) {
			location, err := time.LoadLocation(tt.zone)
			if err != nil {
				t.Fatal(err)
			}
			now, err := time.Parse(time.RFC3339, tt.confirmation)
			if err != nil {
				t.Fatal(err)
			}
			calendar := NewActivityCalendar(now, location)
			if from, until := calendar.Window(); now.Before(from) || !now.Before(until) {
				t.Fatalf("window %s–%s excludes %s", from, until, now)
			}
			weeks, activeDays := calendar.Fold([]time.Time{now})
			if weeks[3] != (ActivityWeek{Start: tt.monday, Count: 1}) || activeDays != 1 {
				t.Fatalf("weeks %v, active days %d", weeks, activeDays)
			}
		})
	}
}
