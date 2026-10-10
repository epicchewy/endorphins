// Command migrate applies the GORM schema before API deployment.
package main

import (
	"context"
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
	ctx := context.Background()
	db, err := postgres.Open(ctx, cfg.Postgres.URL)
	if err != nil {
		logger.Error("database connection failed", "error", err)
		return 1
	}
	pool, err := db.DB()
	if err != nil {
		logger.Error("database pool failed", "error", err)
		return 1
	}
	defer func() { _ = pool.Close() }()
	if err := postgres.Migrate(ctx, db); err != nil {
		logger.Error("migration failed", "error", err)
		return 1
	}
	logger.Info("database schema is current")
	return 0
}
