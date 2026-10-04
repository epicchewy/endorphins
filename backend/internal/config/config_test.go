package config

import (
	"encoding/base64"
	"reflect"
	"strings"
	"testing"

	"github.com/jessevdk/go-flags"
)

var configEnvironment = []string{
	"API_ADDRESS", "EXERCISE_DIR", "DATABASE_URL", "CLERK_SECRET_KEY",
	"VITE_CLERK_PUBLISHABLE_KEY", "CLERK_WEBHOOK_SIGNING_SECRET", "APP_ORIGINS", "GO_FLAGS_COMPLETION",
}

func clearEnvironment(t *testing.T) {
	t.Helper()
	for _, name := range configEnvironment {
		t.Setenv(name, "")
	}
}
func validEnvironment(t *testing.T) {
	t.Helper()
	clearEnvironment(t)
	t.Setenv("DATABASE_URL", "postgres://fixture:private-password@localhost:5432/test?sslmode=disable")
	t.Setenv("CLERK_SECRET_KEY", "sk_test_private-value")
	t.Setenv("VITE_CLERK_PUBLISHABLE_KEY", publishable("pk_test_", "fixture.clerk.accounts.dev$"))
}
func publishable(prefix, host string) string {
	return prefix + base64.StdEncoding.EncodeToString([]byte(host))
}

func TestGroupedOptionsDefaults(t *testing.T) {
	validEnvironment(t)
	cfg, err := Load(nil)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.HTTP.Address != "127.0.0.1:8088" || cfg.Catalogue.Directory != "../exercises" {
		t.Fatal("existing HTTP/catalogue defaults changed")
	}
	if !reflect.DeepEqual(cfg.Clerk.AllowedOrigins, []string{"http://127.0.0.1:3100", "http://localhost:3100"}) {
		t.Fatalf("wrong default origins: %v", cfg.Clerk.AllowedOrigins)
	}
	if cfg.Clerk.Issuer != "https://fixture.clerk.accounts.dev" || cfg.Postgres.URL == "" || cfg.Clerk.SecretKey == "" {
		t.Fatal("owner options were not loaded or resolved")
	}
}

func TestFlagsOverrideEnvironmentAndReplaceOriginList(t *testing.T) {
	validEnvironment(t)
	t.Setenv("API_ADDRESS", "127.0.0.1:9000")
	t.Setenv("EXERCISE_DIR", "/environment/catalogue")
	t.Setenv("APP_ORIGINS", "https://environment.example,https://other.example")
	t.Setenv("CLERK_WEBHOOK_SIGNING_SECRET", "whsec_environment")
	cfg, err := Load([]string{
		"--api-address=[::1]:8089", "--exercise-dir=/flags/catalogue",
		"--database-url=postgresql://flag-user:flag-password@localhost/flag-db",
		"--clerk-secret-key=sk_test_flag-value",
		"--clerk-publishable-key=" + publishable("pk_live_", "live.clerk.accounts.dev$"),
		"--clerk-webhook-signing-secret=whsec_flag-value",
		"--app-origin=https://flags.example", "--app-origin=https://second.example",
	})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.HTTP.Address != "[::1]:8089" || cfg.Catalogue.Directory != "/flags/catalogue" || cfg.Postgres.URL != "postgresql://flag-user:flag-password@localhost/flag-db" {
		t.Fatal("CLI did not override environment")
	}
	if cfg.Clerk.SecretKey != "sk_test_flag-value" || cfg.Clerk.WebhookSigningSecret != "whsec_flag-value" || cfg.Clerk.Issuer != "https://live.clerk.accounts.dev" {
		t.Fatal("Clerk CLI options did not override environment")
	}
	if !reflect.DeepEqual(cfg.Clerk.AllowedOrigins, []string{"https://flags.example", "https://second.example"}) {
		t.Fatalf("origin flags must replace environment list: %v", cfg.Clerk.AllowedOrigins)
	}
}

func TestOriginsNormalizeExistingCSVEnvironment(t *testing.T) {
	validEnvironment(t)
	t.Setenv("APP_ORIGINS", " https://one.example ,http://localhost:3100 ")
	cfg, err := Load(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cfg.Clerk.AllowedOrigins, []string{"https://one.example", "http://localhost:3100"}) {
		t.Fatalf("origins were not normalized: %v", cfg.Clerk.AllowedOrigins)
	}
}

func TestValidationDoesNotEchoValues(t *testing.T) {
	for _, tt := range []struct{ name, env, value, want string }{
		{name: "missing database", env: "DATABASE_URL", want: "DATABASE_URL"},
		{name: "bad database", env: "DATABASE_URL", value: "https://private-password@host/db", want: "DATABASE_URL"},
		{name: "invalid connection options", env: "DATABASE_URL", value: "postgres://user:private-password@localhost/test?sslmode=private-password", want: "Postgres connection options"},
		{name: "missing backend key", env: "CLERK_SECRET_KEY", want: "CLERK_SECRET_KEY"},
		{name: "invalid address", env: "API_ADDRESS", value: "private-password", want: "API_ADDRESS"},
		{name: "invalid port", env: "API_ADDRESS", value: "127.0.0.1:99999", want: "API_ADDRESS"},
		{name: "invalid public key", env: "VITE_CLERK_PUBLISHABLE_KEY", value: "private-password", want: "publishable key"},
		{name: "invalid issuer", env: "VITE_CLERK_PUBLISHABLE_KEY", value: publishable("pk_test_", "private-password@example.com/path$"), want: "instance host"},
		{name: "live webhook required", env: "VITE_CLERK_PUBLISHABLE_KEY", value: publishable("pk_live_", "live.clerk.accounts.dev$"), want: "CLERK_WEBHOOK_SIGNING_SECRET"},
		{name: "origin credentials", env: "APP_ORIGINS", value: "https://user:private-password@example.com", want: "APP_ORIGINS"},
		{name: "origin path", env: "APP_ORIGINS", value: "https://example.com/private-password", want: "APP_ORIGINS"},
		{name: "empty list member", env: "APP_ORIGINS", value: "https://example.com,", want: "APP_ORIGINS"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			validEnvironment(t)
			t.Setenv(tt.env, tt.value)
			_, err := Load(nil)
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("wanted safe %s validation failure", tt.want)
			}
			if strings.Contains(err.Error(), "private-password") {
				t.Fatal("configuration error exposed a value")
			}
		})
	}
}

func TestHelpPrecedesValidationAndMasksSecrets(t *testing.T) {
	validEnvironment(t)
	t.Setenv("API_ADDRESS", "invalid")
	for _, args := range [][]string{{"--help"}, {"--clerk-secret-key=argument-secret", "--database-url=postgres://user:argument-password@localhost/test", "--help"}} {
		_, err := Load(args)
		if !flags.WroteHelp(err) {
			t.Fatalf("help should bypass validation: %v", err)
		}
		for _, group := range []string{"HTTP:", "Catalogue:", "Postgres:", "Clerk:", "--api-address", "--app-origin"} {
			if !strings.Contains(err.Error(), group) {
				t.Fatalf("missing help group or option %q", group)
			}
		}
		for _, secret := range []string{"private-password", "sk_test_private-value", "argument-secret", "argument-password"} {
			if strings.Contains(err.Error(), secret) {
				t.Fatal("help exposed a credential")
			}
		}
	}
	clearEnvironment(t)
	if _, err := Load([]string{"--help"}); !flags.WroteHelp(err) {
		t.Fatal("help required credentials")
	}
}

func TestParsingRejectsUnknownFlagsAndPositionalsSafely(t *testing.T) {
	validEnvironment(t)
	for _, args := range [][]string{{"--private-password=secret"}, {"private-password"}, {"--api-address"}, {"--", "private-password"}} {
		if _, err := Load(args); err == nil || strings.Contains(err.Error(), "private-password") {
			t.Fatal("bad CLI arguments accepted or echoed")
		}
	}
}

func TestMigrationOnlyRequiresPostgres(t *testing.T) {
	clearEnvironment(t)
	cfg, err := LoadMigration([]string{"--database-url=postgres://fixture@localhost/test"})
	if err != nil || cfg.Postgres.URL != "postgres://fixture@localhost/test" {
		t.Fatal("migration should only require Postgres")
	}
	_, err = LoadMigration([]string{"--help"})
	if !flags.WroteHelp(err) || strings.Contains(err.Error(), "Clerk") {
		t.Fatal("migration help should omit unrelated options")
	}
	if _, err := LoadMigration(nil); err == nil {
		t.Fatal("migration accepted missing database")
	}
	if _, err := LoadMigration([]string{"--database-url=private-password"}); err == nil || strings.Contains(err.Error(), "private-password") {
		t.Fatal("migration must reject invalid URL safely")
	}
}
