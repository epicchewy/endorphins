// Command migrate applies pending database migrations before API deployment.
package main

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/epicchewy/endorphins/backend/internal/config"
	"github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/jessevdk/go-flags"
)

func main() { os.Exit(run()) }

func run() int {
	cfg, err := config.LoadMigration(os.Args[1:])
	if flags.WroteHelp(err) {
		fmt.Println(err)
		return 0
	}
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "configuration failed:", err)
		return 2
	}
	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	if err := postgres.Migrate(cfg.Postgres.URL); err != nil {
		logger.Error("migration failed", "error", err)
		return 1
	}
	logger.Info("database migrations are current")
	return 0
}
