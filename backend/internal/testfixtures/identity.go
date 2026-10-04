//go:build e2e

// Package testfixtures supplies browser-test identity and seed data.
// Only e2e builds include its signing keys and fixture routes; the application
// still verifies real JWTs and webhook signatures through its production code.
package testfixtures

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strconv"
	"time"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwks"
	"github.com/epicchewy/endorphins/backend/internal/repositories/postgres"
	jose "github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"
	svix "github.com/svix/svix-webhooks/go"
)

var validSubject = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,100}$`)

type Fixture struct {
	Client               *jwks.Client
	WebhookSigningSecret string
	keyServer            *httptest.Server
	signer               jose.Signer
	webhookSigner        *svix.Webhook
	issuer               string
	origin               string
	users                *postgres.Users
	workouts             *postgres.Workouts
	logger               *slog.Logger
}

func New(issuer, origin string, users *postgres.Users, workouts *postgres.Workouts, logger *slog.Logger) (*Fixture, error) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, fmt.Errorf("create fixture signing key: %w", err)
	}
	kid := rand.Text()
	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.RS256, Key: key}, (&jose.SignerOptions{}).WithHeader("kid", kid))
	if err != nil {
		return nil, fmt.Errorf("create fixture token signer: %w", err)
	}
	webhookSecret := "whsec_" + base64.StdEncoding.EncodeToString([]byte(rand.Text()))
	webhookSigner, err := svix.NewWebhook(webhookSecret)
	if err != nil {
		return nil, fmt.Errorf("create fixture webhook signer: %w", err)
	}
	keyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/jwks" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		keys := jose.JSONWebKeySet{Keys: []jose.JSONWebKey{{Key: &key.PublicKey, KeyID: kid, Algorithm: "RS256", Use: "sig"}}}
		if err := json.NewEncoder(w).Encode(keys); err != nil {
			logger.Error("fixture key response failed", "error", err)
		}
	}))
	client := keyServer.Client()
	client.Timeout = 5 * time.Second
	return &Fixture{
		Client: jwks.NewClient(&clerk.ClientConfig{BackendConfig: clerk.BackendConfig{
			URL: clerk.String(keyServer.URL), Key: clerk.String("fixture"), HTTPClient: client,
		}}),
		WebhookSigningSecret: webhookSecret,
		keyServer:            keyServer,
		signer:               signer,
		webhookSigner:        webhookSigner,
		issuer:               issuer,
		origin:               origin,
		users:                users,
		workouts:             workouts,
		logger:               logger,
	}, nil
}

func (f *Fixture) Close() {
	f.keyServer.Close()
}

func (f *Fixture) Wrap(handler http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/", handler)
	mux.HandleFunc("GET /api/__fixture/token", f.token)
	mux.HandleFunc("POST /api/__fixture/deletion-event", f.deletionEvent)
	mux.HandleFunc("POST /api/__fixture/seed", f.seed)
	return mux
}

func (f *Fixture) token(w http.ResponseWriter, r *http.Request) {
	subject := r.URL.Query().Get("subject")
	if !validSubject.MatchString(subject) {
		http.Error(w, "invalid fixture subject", http.StatusBadRequest)
		return
	}
	now := time.Now()
	token, err := jwt.Signed(f.signer).Claims(map[string]any{
		"iss": f.issuer,
		"sub": subject,
		"sid": "sess_" + rand.Text(),
		"azp": f.origin,
		"exp": now.Add(time.Hour).Unix(),
		"nbf": now.Add(-time.Second).Unix(),
		"sts": "active",
	}).CompactSerialize()
	if err != nil {
		http.Error(w, "fixture token unavailable", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if err := json.NewEncoder(w).Encode(map[string]string{"token": token}); err != nil {
		f.logger.Error("fixture token response failed", "error", err)
	}
}

func (f *Fixture) deletionEvent(w http.ResponseWriter, r *http.Request) {
	subject := r.URL.Query().Get("subject")
	if !validSubject.MatchString(subject) {
		http.Error(w, "invalid fixture subject", http.StatusBadRequest)
		return
	}
	body := fmt.Sprintf(`{"type":"user.deleted","data":{"id":%q,"deleted":true}}`, subject)
	messageID, timestamp := "msg_"+rand.Text(), time.Now()
	signature, err := f.webhookSigner.Sign(messageID, timestamp, []byte(body))
	if err != nil {
		http.Error(w, "fixture signature unavailable", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	event := map[string]any{
		"body": body,
		"headers": map[string]string{
			"Content-Type":   "application/json",
			"svix-id":        messageID,
			"svix-timestamp": strconv.FormatInt(timestamp.Unix(), 10),
			"svix-signature": signature,
		},
	}
	if err := json.NewEncoder(w).Encode(event); err != nil {
		f.logger.Error("fixture event response failed", "error", err)
	}
}
