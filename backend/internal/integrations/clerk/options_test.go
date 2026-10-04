package clerk

import (
	"encoding/base64"
	"testing"
)

func TestIssuerFromPublishableKey(t *testing.T) {
	t.Parallel()
	for _, prefix := range []string{"pk_test_", "pk_live_"} {
		key := prefix + base64.StdEncoding.EncodeToString([]byte("test.clerk.accounts.dev$"))
		issuer, err := issuerFromKey(key)
		if err != nil || issuer != "https://test.clerk.accounts.dev" {
			t.Fatalf("issuer %q: %v", issuer, err)
		}
	}
	for _, host := range []string{"", "evil.example/path$", "evil.example?query$", "a@evil.example$", "no-terminator"} {
		if _, err := issuerFromKey("pk_test_" + base64.StdEncoding.EncodeToString([]byte(host))); err == nil {
			t.Errorf("accepted invalid host %q", host)
		}
	}
}
