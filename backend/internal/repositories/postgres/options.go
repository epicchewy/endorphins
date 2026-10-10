package postgres

import (
	"fmt"
	"net/url"

	"github.com/jackc/pgx/v5"
)

// Options belongs to the store and is shared by the API and migration commands.
type Options struct {
	URL string `long:"database-url" env:"DATABASE_URL" required:"true" default-mask:"-" description:"Postgres connection URL (prefer DATABASE_URL for credentials)"`
}

func (o Options) Validate() error {
	if o.URL == "" {
		return fmt.Errorf("DATABASE_URL or --database-url is required")
	}
	parsed, err := url.Parse(o.URL)
	if err != nil || (parsed.Scheme != "postgres" && parsed.Scheme != "postgresql") || parsed.Fragment != "" {
		return fmt.Errorf("DATABASE_URL or --database-url must be a valid postgres:// or postgresql:// URL")
	}
	if _, err := pgx.ParseConfig(o.URL); err != nil {
		return fmt.Errorf("DATABASE_URL or --database-url contains invalid Postgres connection options")
	}
	return nil
}
