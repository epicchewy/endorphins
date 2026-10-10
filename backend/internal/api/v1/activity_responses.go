package v1

import (
	"github.com/epicchewy/endorphins/backend/internal/domains"
	"time"
)

type CompletionResponse struct {
	ID          string     `json:"id"`
	WorkoutID   string     `json:"workoutId"`
	CompletedAt time.Time  `json:"completedAt"`
	UndoneAt    *time.Time `json:"undoneAt"`
	Level       int        `json:"level"`
	Focus       string     `json:"focus"`
}

func NewCompletionResponse(c domains.Completion) CompletionResponse {
	return CompletionResponse{ID: c.ID, WorkoutID: c.WorkoutID, CompletedAt: c.CompletedAt, UndoneAt: c.UndoneAt, Level: c.Level, Focus: c.Focus}
}
func newCompletionResponses(items []domains.Completion) []CompletionResponse {
	result := make([]CompletionResponse, 0, len(items))
	for _, item := range items {
		result = append(result, NewCompletionResponse(item))
	}
	return result
}

type ActivityWeekResponse struct {
	Start string `json:"start"`
	Count int    `json:"count"`
}
type ActivityResponse struct {
	CompletedCount     int                    `json:"completedCount"`
	ActiveDaysThisWeek int                    `json:"activeDaysThisWeek"`
	Weeks              []ActivityWeekResponse `json:"weeks"`
	Recent             []CompletionResponse   `json:"recent"`
}

func NewActivityResponse(a domains.Activity) ActivityResponse {
	weeks := make([]ActivityWeekResponse, 0, len(a.Weeks))
	for _, week := range a.Weeks {
		weeks = append(weeks, ActivityWeekResponse{Start: week.Start, Count: week.Count})
	}
	return ActivityResponse{CompletedCount: a.CompletedCount, ActiveDaysThisWeek: a.ActiveDaysThisWeek, Weeks: weeks, Recent: newCompletionResponses(a.Recent)}
}
