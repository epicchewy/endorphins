package clerk

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	clerkSDK "github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwks"
	"github.com/epicchewy/endorphins/backend/internal/domains"
	jose "github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSessionVerification(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	wrongKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)
	const issuer = "https://test-session.clerk.accounts.dev"
	const origin = "http://127.0.0.1:3100"
	kid := "test-key-" + rand.Text()
	keys := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/jwks" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		assert.NoError(t, json.NewEncoder(w).Encode(jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: kid, Algorithm: "RS256", Use: "sig"}}}))
	}))
	defer keys.Close()
	client := jwks.NewClient(&clerkSDK.ClientConfig{BackendConfig: clerkSDK.BackendConfig{URL: clerkSDK.String(keys.URL), Key: clerkSDK.String("test"), HTTPClient: keys.Client()}})
	verified := New(client, issuer, []string{origin})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "user_alice", domains.Subject(r.Context()))
		w.WriteHeader(http.StatusNoContent)
	}))
	for _, tt := range []struct {
		name           string
		changes        map[string]any
		wrongSignature bool
		header         string
		status         int
	}{
		{name: "valid", status: 204},
		{name: "legacy session", changes: map[string]any{"sts": nil}, status: 204},
		{name: "expired", changes: map[string]any{"exp": time.Now().Add(-time.Minute).Unix()}, status: 401},
		{name: "future", changes: map[string]any{"nbf": time.Now().Add(time.Minute).Unix()}, status: 401},
		{name: "other instance", changes: map[string]any{"iss": "https://other.clerk.accounts.dev"}, status: 401},
		{name: "wrong origin", changes: map[string]any{"azp": "https://evil.example"}, status: 401},
		{name: "missing origin", changes: map[string]any{"azp": nil}, status: 401},
		{name: "missing subject", changes: map[string]any{"sub": nil}, status: 401},
		{name: "missing session", changes: map[string]any{"sid": nil}, status: 401},
		{name: "missing expiry", changes: map[string]any{"exp": nil}, status: 401},
		{name: "pending", changes: map[string]any{"sts": "pending"}, status: 401},
		{name: "forged signature", wrongSignature: true, status: 401},
		{name: "absent token", header: "absent", status: 401},
		{name: "malformed token", header: "Bearer garbage", status: 401},
		{name: "wrong scheme", header: "Basic garbage", status: 401},
	} {
		t.Run(tt.name, func(t *testing.T) {
			claims := map[string]any{"iss": issuer, "sub": "user_alice", "sid": "sess_test", "azp": origin, "exp": time.Now().Add(time.Minute).Unix(), "iat": time.Now().Unix(), "nbf": time.Now().Add(-time.Second).Unix(), "sts": "active"}
			for name, value := range tt.changes {
				if value == nil {
					delete(claims, name)
				} else {
					claims[name] = value
				}
			}
			signingKey := key
			if tt.wrongSignature {
				signingKey = wrongKey
			}
			signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: signingKey}, (&jose.SignerOptions{}).WithHeader("kid", kid))
			require.NoError(t, err)
			token, err := jwt.Signed(signer).Claims(claims).CompactSerialize()
			require.NoError(t, err)
			header := "Bearer " + token
			if tt.header != "" {
				header = tt.header
			}
			if tt.header == "absent" {
				header = ""
			}
			req := httptest.NewRequestWithContext(t.Context(), "GET", "/api/v1/me", nil)
			req.Header.Set("Authorization", header)
			// Cookies alone do not authenticate the Go API.
			req.AddCookie(&http.Cookie{Name: "__session", Value: token})
			res := httptest.NewRecorder()
			verified.ServeHTTP(res, req)
			assert.Equal(t, tt.status, res.Code)
			if tt.status == 401 {
				assert.Equal(t, "no-store", res.Header().Get("Cache-Control"))
				assert.Equal(t, "Bearer", res.Header().Get("WWW-Authenticate"))
			}
		})
	}
}
