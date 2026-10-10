package server

import (
	"errors"
	"log/slog"
	"net/http"

	v1 "github.com/epicchewy/endorphins/backend/internal/api/v1"
	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/epicchewy/endorphins/backend/internal/services/account"
	"github.com/epicchewy/endorphins/backend/internal/services/library"
	"github.com/epicchewy/endorphins/backend/internal/services/workout"
	"github.com/labstack/echo/v5"
)

func errorHandler(logger *slog.Logger) echo.HTTPErrorHandler {
	return func(c *echo.Context, err error) {
		if response, _ := echo.UnwrapResponse(c.Response()); response != nil && response.Committed {
			return
		}
		status, code, message := publicError(err)
		if status >= 500 {
			logger.ErrorContext(c.Request().Context(), "request failed", "request_id", c.Response().Header().Get("X-Request-ID"), "error", err)
		}
		if status == http.StatusUnauthorized {
			c.Response().Header().Set("WWW-Authenticate", "Bearer")
		}
		if c.Request().Method == http.MethodHead {
			_ = c.NoContent(status)
			return
		}
		v1.WriteError(c.Response(), status, code, message)
	}
}
func publicError(err error) (int, string, string) {
	switch {
	case errors.Is(err, account.ErrInvalidLevel):
		return 422, "invalid_level", "Choose a default level from 1 to 5."
	case errors.Is(err, library.ErrInvalidTimezone):
		return 400, "invalid_timezone", "Use a valid time zone."
	case errors.Is(err, library.ErrCompletionUndone):
		return 409, "completion_undone", "This completion was undone. Start a new confirmation."
	case errors.Is(err, domains.ErrAccountDeleted):
		return 401, "account_deleted", "This account has been deleted."
	case errors.Is(err, domains.ErrNotFound):
		return 404, "not_found", "Workout not found."
	case errors.Is(err, domains.ErrIdempotencyConflict):
		return 409, "idempotency_conflict", "This request key was already used for another workout or different preferences."
	case errors.Is(err, library.ErrInvalidKey):
		return 400, "invalid_request", "Use a request key with 1–128 visible ASCII characters."
	case errors.Is(err, library.ErrInvalidPage):
		return 400, "invalid_page", "Choose a valid workout filter or page."
	case errors.Is(err, workout.ErrInvalidInput):
		return 422, "invalid_workout", "Choose a duration from 30 to 120 minutes and a level from 1 to 5."
	}
	var httpError *echo.HTTPError
	if errors.As(err, &httpError) {
		switch httpError.Code {
		case 400:
			return 400, "invalid_request", "Send a valid request."
		case 401:
			return 401, "unauthenticated", "Sign in to access your workouts."
		case 404:
			return 404, "not_found", "The requested resource was not found."
		case 405:
			return 405, "method_not_allowed", "This method is not supported."
		case 413:
			return 413, "invalid_request", "This request is too large."
		case 415:
			return 415, "unsupported_media_type", "Send this request as JSON."
		case 503:
			return 503, "unavailable", "The service is temporarily unavailable. Please try again."
		}
	}
	return 500, "internal_error", "Something went wrong. Please try again."
}
