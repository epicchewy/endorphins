//go:build !e2e

package app

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwks"
	clerkAuth "github.com/epicchewy/endorphins/backend/internal/integrations/clerk"
	"github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
)

func newClerkEnvironment(options clerkAuth.Options, _ *postgres.Users, _ *postgres.Workouts, _ *slog.Logger) (clerkEnvironment, error) {
	return clerkEnvironment{
		keys: jwks.NewClient(&clerk.ClientConfig{BackendConfig: clerk.BackendConfig{
			Key:        clerk.String(options.SecretKey),
			HTTPClient: &http.Client{Timeout: 5 * time.Second},
		}}),
		webhookSecret: options.WebhookSigningSecret,
		wrap:          func(handler http.Handler) http.Handler { return handler },
		close:         func() {},
	}, nil
}
