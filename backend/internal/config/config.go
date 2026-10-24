// Package config composes owner-defined option groups for each command.
package config

import (
	"errors"
	"fmt"
	"net"
	"strconv"
	"strings"

	"github.com/epicchewy/endorphins/backend/internal/integrations/clerk"
	"github.com/epicchewy/endorphins/backend/internal/repositories/catalogue"
	"github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	"github.com/jessevdk/go-flags"
)

type HTTPOptions struct {
	Address string `long:"api-address" env:"API_ADDRESS" default:"127.0.0.1:8088" description:"HTTP listener address (host:port)"`
}

type Config struct {
	HTTP      HTTPOptions       `group:"HTTP"`
	Catalogue catalogue.Options `group:"Catalogue"`
	Postgres  postgres.Options  `group:"Postgres"`
	Clerk     clerk.Options     `group:"Clerk"`
}

// MigrationConfig deliberately omits identity and HTTP options: migrating a
// database does not require a Clerk instance or application listener.
type MigrationConfig struct {
	Postgres postgres.Options `group:"Postgres"`
}

// SeedOptions reads the publishable key only to refuse live Clerk instances.
type SeedOptions struct {
	PublishableKey string   `long:"clerk-publishable-key" env:"VITE_CLERK_PUBLISHABLE_KEY" required:"true" description:"Clerk publishable key; seeding needs a development (pk_test_) key"`
	Subjects       []string `long:"subject" env:"SEED_SUBJECTS" env-delim:"," description:"Clerk user ID to seed; repeat or use comma-separated SEED_SUBJECTS"`
	AllAccounts    bool     `long:"all-accounts" description:"Also seed every existing account that has no saved plans"`
}

type SeedConfig struct {
	Catalogue catalogue.Options `group:"Catalogue"`
	Postgres  postgres.Options  `group:"Postgres"`
	Seed      SeedOptions       `group:"Seed"`
}

func Load(args []string) (Config, error) {
	var cfg Config
	if err := parse(&cfg, "endorphins-api", args); err != nil {
		return Config{}, err
	}
	_, port, err := net.SplitHostPort(cfg.HTTP.Address)
	if err != nil {
		return Config{}, fmt.Errorf("API_ADDRESS or --api-address must use host:port")
	}
	number, err := strconv.Atoi(port)
	if err != nil || number < 0 || number > 65535 {
		return Config{}, fmt.Errorf("API_ADDRESS or --api-address must use a port from 0 to 65535")
	}
	if err := cfg.Postgres.Validate(); err != nil {
		return Config{}, err
	}
	if err := cfg.Clerk.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func LoadMigration(args []string) (MigrationConfig, error) {
	var cfg MigrationConfig
	if err := parse(&cfg, "endorphins-migrate", args); err != nil {
		return MigrationConfig{}, err
	}
	if err := cfg.Postgres.Validate(); err != nil {
		return MigrationConfig{}, err
	}
	return cfg, nil
}

func LoadSeed(args []string) (SeedConfig, error) {
	var cfg SeedConfig
	if err := parse(&cfg, "endorphins-seed", args); err != nil {
		return SeedConfig{}, err
	}
	if err := cfg.Postgres.Validate(); err != nil {
		return SeedConfig{}, err
	}
	if !strings.HasPrefix(cfg.Seed.PublishableKey, "pk_test_") {
		return SeedConfig{}, fmt.Errorf("seeding needs a Clerk development key (pk_test_); it never runs against a live instance")
	}
	subjects := cfg.Seed.Subjects[:0]
	for _, subject := range cfg.Seed.Subjects {
		if subject = strings.TrimSpace(subject); subject != "" {
			subjects = append(subjects, subject)
		}
	}
	cfg.Seed.Subjects = subjects
	return cfg, nil
}

func parse(options any, name string, args []string) error {
	// Disable PrintErrors: the command owns output and untrusted argument values
	// must never be printed by the parser. Secret option defaults are also masked.
	parser := flags.NewParser(options, flags.HelpFlag|flags.PassDoubleDash)
	parser.Name = name
	rest, err := parser.ParseArgs(args)
	if err != nil {
		var flagErr *flags.Error
		if errors.As(err, &flagErr) && flagErr.Type == flags.ErrHelp {
			return err
		}
		if errors.As(err, &flagErr) && flagErr.Type == flags.ErrRequired {
			// ErrRequired lists option names, never their supplied values.
			return fmt.Errorf("missing required options: %s", flagErr.Message)
		}
		return fmt.Errorf("invalid command-line options; run --help for usage")
	}
	if len(rest) > 0 {
		return fmt.Errorf("positional arguments are not supported; run --help for usage")
	}
	return nil
}
