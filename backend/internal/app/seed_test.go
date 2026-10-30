package app

import (
	"log/slog"
	"testing"

	"github.com/epicchewy/endorphins/backend/internal/config"
)

func TestSeedSkipsProductionBeforeOpeningAnything(t *testing.T) {
	// An unreadable catalogue makes any real seeding attempt fail at once.
	cfg := config.SeedConfig{Seed: config.SeedOptions{Environment: "production"}}
	cfg.Catalogue.Directory = t.TempDir()
	logger := slog.New(slog.DiscardHandler)
	if err := Seed(t.Context(), cfg, logger); err != nil {
		t.Fatalf("production must be skipped, got %v", err)
	}
	cfg.Seed.Environment = "endorphins-pr-16"
	if err := Seed(t.Context(), cfg, logger); err == nil {
		t.Fatal("a preview environment must attempt to seed")
	}
}
