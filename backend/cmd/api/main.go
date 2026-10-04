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
	cfg, err := config.Load(os.Args[1:])
	if flags.WroteHelp(err) {
		fmt.Println(err)
		return 0
	}
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "configuration failed:", err)
		return 2
	}
	logger := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	if err := app.Run(ctx, cfg, logger); err != nil {
		logger.Error("api stopped", "error", err)
		return 1
	}
	return 0
}
