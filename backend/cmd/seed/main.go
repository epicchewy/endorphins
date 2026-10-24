// Command seed fills development accounts with a realistic workout history.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/epicchewy/endorphins/backend/internal/app"
	"github.com/epicchewy/endorphins/backend/internal/config"
	"github.com/jessevdk/go-flags"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	exitCode := run(ctx)
	stop()
	os.Exit(exitCode)
}

func run(ctx context.Context) int {
	cfg, err := config.LoadSeed(os.Args[1:])
	if flags.WroteHelp(err) {
		fmt.Println(err)
		return 0
	}
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "configuration failed:", err)
		return 2
	}
	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	if err := app.Seed(ctx, cfg, logger); err != nil {
		logger.Error("seed failed", "error", err)
		return 1
	}
	return 0
}
