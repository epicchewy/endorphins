//go:build e2e

package app

import (
	"fmt"
	"log/slog"

	clerkAuth "github.com/epicchewy/endorphins/backend/internal/integrations/clerk"
	"github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/epicchewy/endorphins/backend/internal/testfixtures"
)

func newClerkEnvironment(options clerkAuth.Options, users *postgres.Users, workouts *postgres.Workouts, logger *slog.Logger) (clerkEnvironment, error) {
	if len(options.AllowedOrigins) == 0 {
		return clerkEnvironment{}, fmt.Errorf("e2e identity requires a configured application origin")
	}
	fixture, err := testfixtures.New(options.Issuer, options.AllowedOrigins[0], users, workouts, logger)
	if err != nil {
		return clerkEnvironment{}, err
	}
	return clerkEnvironment{
		keys:          fixture.Client,
		webhookSecret: fixture.WebhookSigningSecret,
		wrap:          fixture.Wrap,
		close:         fixture.Close,
	}, nil
}
