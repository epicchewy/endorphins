// Package app is the composition root and owns the server lifecycle.
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/clerk/clerk-sdk-go/v2/jwks"
	"github.com/epicchewy/endorphins/backend/internal/config"
	"github.com/epicchewy/endorphins/backend/internal/handlers"
	clerkAuth "github.com/epicchewy/endorphins/backend/internal/integrations/clerk"
	"github.com/epicchewy/endorphins/backend/internal/repositories/catalogue"
	"github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/epicchewy/endorphins/backend/internal/server"
	"github.com/epicchewy/endorphins/backend/internal/services/account"
	"github.com/epicchewy/endorphins/backend/internal/services/library"
	"github.com/epicchewy/endorphins/backend/internal/services/workout"
)

// Version and Revision are set by release build ldflags and included in startup logs.
var Version = "development"
var Revision = "unknown"

// The e2e build replaces only the external identity provider and adds its test
// helper routes. Services, authentication, storage and server wiring stay here.
type clerkEnvironment struct {
	keys          *jwks.Client
	webhookSecret string
	wrap          func(http.Handler) http.Handler
	close         func()
}

func Run(ctx context.Context, cfg config.Config, logger *slog.Logger) error {
	catalogue, err := catalogue.New(os.DirFS(cfg.Catalogue.Directory))
	if err != nil {
		return fmt.Errorf("initialize catalogue: %w", err)
	}
	pool, err := postgres.Open(ctx, cfg.Postgres.URL)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := postgres.CheckReady(ctx, pool); err != nil {
		return err
	}
	users, workouts := postgres.NewUsers(pool), postgres.NewWorkouts(pool)
	libraryService := library.New(workout.New(catalogue), workouts)
	accountService := account.New(users)
	clerk, err := newClerkEnvironment(cfg.Clerk, users, workouts, logger)
	if err != nil {
		return fmt.Errorf("initialize Clerk: %w", err)
	}
	defer clerk.close()
	authenticate := clerkAuth.New(clerk.keys, cfg.Clerk.Issuer, cfg.Clerk.AllowedOrigins)
	var webhook http.Handler
	if clerk.webhookSecret != "" {
		webhook, err = clerkAuth.NewWebhook(clerk.webhookSecret, accountService, logger)
		if err != nil {
			return err
		}
	} else {
		logger.Warn("Clerk account deletion webhook is not configured for this development instance")
	}
	router := server.New(handlers.NewWorkout(libraryService), handlers.NewAccount(accountService), authenticate, logger, server.Options{
		Ready: func(ctx context.Context) error { return postgres.CheckReady(ctx, pool) }, ClerkWebhook: webhook,
	})
	srv := &http.Server{
		Addr:              cfg.HTTP.Address,
		Handler:           clerk.wrap(router),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	stopped := make(chan error, 1)
	go func() { stopped <- srv.ListenAndServe() }()
	logger.Info("api started", "address", cfg.HTTP.Address, "version", Version, "revision", Revision)
	select {
	case err := <-stopped:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return fmt.Errorf("serve api: %w", err)
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			closeErr := srv.Close()
			<-stopped
			return fmt.Errorf("shut down api: %w", errors.Join(err, closeErr))
		}
		err := <-stopped
		if !errors.Is(err, http.ErrServerClosed) {
			return fmt.Errorf("stop api: %w", err)
		}
		return nil
	}
}
