package clerk

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"strings"
)

type Options struct {
	SecretKey            string `long:"clerk-secret-key" env:"CLERK_SECRET_KEY" required:"true" default-mask:"-" description:"Clerk backend secret key (prefer CLERK_SECRET_KEY)"`
	PublishableKey       string `long:"clerk-publishable-key" env:"VITE_CLERK_PUBLISHABLE_KEY" required:"true" description:"Clerk publishable key for the expected instance"`
	WebhookSigningSecret string `long:"clerk-webhook-signing-secret" env:"CLERK_WEBHOOK_SIGNING_SECRET" default-mask:"-" description:"Svix signing secret for the Clerk webhook endpoint"`
	//nolint:staticcheck // SA5008: go-flags documents repeated default tags for slice defaults.
	AllowedOrigins []string `long:"app-origin" env:"APP_ORIGINS" env-delim:"," default:"http://127.0.0.1:3100" default:"http://localhost:3100" description:"Allowed application origin; repeat flag or use comma-separated APP_ORIGINS"`
	Issuer         string   `no-flag:"true"`
}

// Validate resolves the trusted issuer from the public key and normalizes
// origins. The issuer cannot be overridden independently through an option.
func (o *Options) Validate() error {
	if o.SecretKey == "" {
		return fmt.Errorf("CLERK_SECRET_KEY or --clerk-secret-key is required")
	}
	issuer, err := issuerFromKey(o.PublishableKey)
	if err != nil {
		return err
	}
	o.Issuer = issuer
	if strings.HasPrefix(o.PublishableKey, "pk_live_") && o.WebhookSigningSecret == "" {
		return fmt.Errorf("CLERK_WEBHOOK_SIGNING_SECRET is required for live Clerk accounts")
	}
	if len(o.AllowedOrigins) == 0 || (len(o.AllowedOrigins) == 1 && o.AllowedOrigins[0] == "") {
		o.AllowedOrigins = []string{"http://127.0.0.1:3100", "http://localhost:3100"}
	}
	for i, origin := range o.AllowedOrigins {
		origin = strings.TrimSpace(origin)
		parsed, err := url.Parse(origin)
		if err != nil {
			return fmt.Errorf("APP_ORIGINS or --app-origin must contain HTTP(S) origins without paths")
		}
		invalidAddress := (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == ""
		hasExtraParts := parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.User != nil
		if invalidAddress || hasExtraParts {
			return fmt.Errorf("APP_ORIGINS or --app-origin must contain HTTP(S) origins without paths")
		}
		o.AllowedOrigins[i] = origin
	}
	return nil
}

func issuerFromKey(key string) (string, error) {
	encoded, found := strings.CutPrefix(key, "pk_test_")
	if !found {
		encoded, found = strings.CutPrefix(key, "pk_live_")
	}
	if !found {
		return "", fmt.Errorf("VITE_CLERK_PUBLISHABLE_KEY or --clerk-publishable-key must be a Clerk publishable key")
	}
	decoded, err := base64.RawStdEncoding.DecodeString(strings.TrimRight(encoded, "="))
	if err != nil || !strings.HasSuffix(string(decoded), "$") {
		return "", fmt.Errorf("invalid Clerk publishable key")
	}
	host := strings.TrimSuffix(string(decoded), "$")
	parsed, err := url.Parse("https://" + host)
	if err != nil {
		return "", fmt.Errorf("invalid Clerk instance host")
	}
	invalidHost := parsed.Host != host || parsed.Hostname() == ""
	hasExtraParts := parsed.Path != "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != ""
	if invalidHost || hasExtraParts {
		return "", fmt.Errorf("invalid Clerk instance host")
	}
	return parsed.String(), nil
}
