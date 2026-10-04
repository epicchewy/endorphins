package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strconv"

	v1 "github.com/epicchewy/endorphins/backend/internal/api/v1"
	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/epicchewy/endorphins/backend/internal/services/library"
	"github.com/epicchewy/endorphins/backend/internal/services/workout"
	"github.com/labstack/echo/v5"
)

type workoutService interface {
	Create(context.Context, string, workout.GenerateInput, string) (domains.SavedWorkout, error)
	Get(context.Context, string, string) (domains.SavedWorkout, error)
	List(context.Context, string, library.ListInput) (domains.WorkoutPage, error)
	Summary(context.Context, string, domains.WorkoutFilter) (domains.WorkoutSummary, error)
}
type Workout struct{ service workoutService }

func NewWorkout(service workoutService) *Workout { return &Workout{service: service} }

func (h *Workout) Create(c *echo.Context) error {
	mediaType, _, err := mime.ParseMediaType(c.Request().Header.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return echo.NewHTTPError(http.StatusUnsupportedMediaType, "Send this request as JSON.")
	}
	c.Request().Body = http.MaxBytesReader(c.Response(), c.Request().Body, 8192)
	decoder := json.NewDecoder(c.Request().Body)
	decoder.DisallowUnknownFields()
	var input v1.CreateWorkoutRequest
	if err := decoder.Decode(&input); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Enter a valid duration and level.")
	}
	if err := decoder.Decode(new(any)); !errors.Is(err, io.EOF) {
		return echo.NewHTTPError(http.StatusBadRequest, "Send one workout request at a time.")
	}
	result, err := h.service.Create(c.Request().Context(), currentUser(c).ID, input.ToInput(), c.Request().Header.Get("Idempotency-Key"))
	if err != nil {
		return err
	}
	c.Response().Header().Set("Location", "/api/v1/workouts/"+result.ID)
	return c.JSON(http.StatusCreated, v1.NewWorkoutResponse(result))
}

func (h *Workout) Get(c *echo.Context) error {
	result, err := h.service.Get(c.Request().Context(), currentUser(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, v1.NewWorkoutResponse(result))
}

func (h *Workout) List(c *echo.Context) error {
	limit := 20
	if value := c.QueryParam("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "Invalid page size.")
		}
		limit = parsed
	}
	filter, err := workoutFilterRequest(c)
	if err != nil {
		return err
	}
	request := v1.ListWorkoutsRequest{
		Cursor:               c.QueryParam("cursor"),
		Limit:                limit,
		WorkoutFilterRequest: filter,
	}
	result, err := h.service.List(c.Request().Context(), currentUser(c).ID, request.ToInput())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, v1.NewWorkoutPageResponse(result))
}
func (h *Workout) Summary(c *echo.Context) error {
	filter, err := workoutFilterRequest(c)
	if err != nil {
		return err
	}
	result, err := h.service.Summary(c.Request().Context(), currentUser(c).ID, filter.ToInput())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, v1.NewWorkoutSummaryResponse(result))
}
func workoutFilterRequest(c *echo.Context) (v1.WorkoutFilterRequest, error) {
	filter := v1.WorkoutFilterRequest{Query: c.QueryParam("q"), Sort: c.QueryParam("sort")}
	if value := c.QueryParam("level"); value != "" {
		level, err := strconv.Atoi(value)
		if err != nil || level < 1 || level > 5 {
			return filter, library.ErrInvalidPage
		}
		filter.Level = level
	}
	return filter, nil
}
