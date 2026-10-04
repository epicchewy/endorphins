package server

import (
	"context"
	"crypto/rand"
	"log/slog"
	"net/http"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/handlers"
	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
)

type Options struct {
	Ready        func(context.Context) error
	ClerkWebhook http.Handler
}

func New(workouts *handlers.Workout, accounts *handlers.Account, authenticate func(http.Handler) http.Handler, logger *slog.Logger, options ...Options) *echo.Echo {
	var opts Options
	if len(options) > 0 {
		opts = options[0]
	}
	e := echo.New()
	e.Logger = logger
	e.HTTPErrorHandler = errorHandler(logger)
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			// Generate our own correlation identifier; do not reflect untrusted headers.
			requestID := rand.Text()
			c.Response().Header().Set("X-Request-ID", requestID)
			c.Request().Header.Set("X-Request-ID", requestID)
			return next(c)
		}
	}, middleware.RequestLogger(), middleware.Recover())
	e.GET("/healthz", func(c *echo.Context) error { return c.JSON(http.StatusOK, map[string]string{"status": "ok"}) })
	e.GET("/readyz", func(c *echo.Context) error {
		c.Response().Header().Set("Cache-Control", "no-store")
		if opts.Ready == nil {
			return echo.NewHTTPError(http.StatusServiceUnavailable, "Readiness is not configured.")
		}
		ctx, cancel := context.WithTimeout(c.Request().Context(), 2*time.Second)
		defer cancel()
		if err := opts.Ready(ctx); err != nil {
			return echo.NewHTTPError(http.StatusServiceUnavailable, "Database is unavailable.").Wrap(err)
		}
		return c.JSON(http.StatusOK, map[string]string{"status": "ready"})
	})
	e.POST("/api/webhooks/clerk", func(c *echo.Context) error {
		if opts.ClerkWebhook == nil {
			return echo.NewHTTPError(http.StatusServiceUnavailable, "Account webhooks are not configured.")
		}
		opts.ClerkWebhook.ServeHTTP(c.Response(), c.Request())
		return nil
	})
	api := e.Group("/api/v1", echo.WrapMiddleware(authenticate), accounts.Require)
	api.GET("/me", accounts.Me)
	api.GET("/me/export", accounts.Export)
	api.POST("/workouts", workouts.Create)
	api.GET("/workouts", workouts.List)
	api.GET("/workouts/summary", workouts.Summary)
	api.GET("/workouts/:id", workouts.Get)
	return e
}
