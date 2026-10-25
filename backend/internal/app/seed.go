package app

import (
	"context"
	"crypto/rand"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/epicchewy/endorphins/backend/internal/config"
	"github.com/epicchewy/endorphins/backend/internal/domains"
	"github.com/epicchewy/endorphins/backend/internal/repositories/catalogue"
	"github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/epicchewy/endorphins/backend/internal/services/library"
	"github.com/epicchewy/endorphins/backend/internal/services/workout"
	"gorm.io/gorm"
)

// Five weeks of plans, oldest first. done counts completions; 2 is a repeat.
var seedHistory = []struct{ daysAgo, minutes, level, done int }{
	{34, 30, 1, 1}, {31, 45, 2, 1}, {27, 45, 2, 0}, {24, 60, 2, 1},
	{20, 30, 3, 1}, {17, 45, 2, 2}, {13, 75, 3, 0}, {10, 45, 3, 1},
	{6, 60, 2, 1}, {3, 90, 4, 0}, {2, 45, 3, 1}, {0, 30, 2, 1},
}

// Seed gives development accounts a realistic history through the real
// generator and stores. It never adds to an account that already has plans.
// It reads every account back, so a schema or snapshot break fails here.
func Seed(ctx context.Context, cfg config.SeedConfig, logger *slog.Logger) error {
	catalogue, err := catalogue.New(os.DirFS(cfg.Catalogue.Directory))
	if err != nil {
		return fmt.Errorf("initialize catalogue: %w", err)
	}
	db, err := postgres.Open(ctx, cfg.Postgres.URL, 5*time.Second)
	if err != nil {
		return err
	}
	pool, err := db.DB()
	if err != nil {
		return fmt.Errorf("get database pool: %w", err)
	}
	defer func() { _ = pool.Close() }()
	// Stores take creation and completion times from this clock, so the
	// history is backdated through the same code paths the API uses.
	var now time.Time
	clocked := db.Session(&gorm.Session{NowFunc: func() time.Time { return now }})
	users, workouts := postgres.NewUsers(clocked), postgres.NewWorkouts(clocked)
	plans := library.New(workout.New(catalogue), workouts)
	subjects := cfg.Seed.Subjects
	if cfg.Seed.AllAccounts {
		existing, err := users.Subjects(ctx)
		if err != nil {
			return err
		}
		subjects = append(subjects, existing...)
	}
	if len(subjects) == 0 {
		logger.Info("no accounts to seed; pass --subject or --all-accounts")
	}
	start := time.Now().UTC()
	for _, subject := range subjects {
		now = start.AddDate(0, 0, -seedHistory[0].daysAgo-1)
		user, err := users.Ensure(ctx, subject)
		if err != nil {
			return fmt.Errorf("seed %s: %w", subject, err)
		}
		summary, err := workouts.Summary(ctx, user.ID, domains.WorkoutFilter{})
		if err != nil {
			return fmt.Errorf("seed %s: %w", subject, err)
		}
		if summary.Count == 0 {
			if err := seedAccount(ctx, users, workouts, plans, user.ID, start, &now); err != nil {
				return fmt.Errorf("seed %s: %w", subject, err)
			}
		}
		account, err := users.Export(ctx, user.ID)
		if err != nil {
			return fmt.Errorf("read back %s: %w", subject, err)
		}
		logger.Info("account ready", "subject", subject, "seeded", summary.Count == 0,
			"workouts", len(account.Workouts), "completions", len(account.Completions))
	}
	return nil
}

func seedAccount(ctx context.Context, users *postgres.Users, workouts *postgres.Workouts, plans *library.Service, userID string, start time.Time, now *time.Time) error {
	if _, err := users.Update(ctx, userID, 2, true); err != nil {
		return err
	}
	var last string
	for _, item := range seedHistory {
		*now = start.AddDate(0, 0, -item.daysAgo).Add(-3 * time.Hour)
		saved, err := plans.Create(ctx, userID, workout.GenerateInput{DurationMinutes: item.minutes, Level: item.level}, "")
		if err != nil {
			return err
		}
		for repeat := range item.done {
			*now = now.Add(time.Duration(item.minutes)*time.Minute + time.Duration(repeat)*48*time.Hour)
			completion, err := workouts.Complete(ctx, userID, saved.ID, rand.Text())
			if err != nil {
				return err
			}
			last = completion.ID
		}
	}
	// One voided completion, as the undo endpoint leaves it.
	return workouts.Undo(ctx, userID, last)
}
