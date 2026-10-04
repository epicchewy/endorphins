package clerk

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	v1 "github.com/epicchewy/endorphins/backend/internal/api/v1"
	svix "github.com/svix/svix-webhooks/go"
)

type accountEraser interface {
	Erase(context.Context, string) error
}

// NewWebhook verifies Clerk's Svix signature over the raw body before decoding.
// The repository makes erasure idempotent, including repeated event deliveries.
func NewWebhook(secret string, accounts accountEraser, logger *slog.Logger) (http.Handler, error) {
	verifier, err := svix.NewWebhook(secret)
	if err != nil {
		return nil, fmt.Errorf("invalid Clerk webhook signing secret")
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		payload, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1<<20))
		if err != nil {
			v1.WriteError(w, 400, "invalid_webhook", "Invalid webhook body.")
			return
		}
		if err := verifier.Verify(payload, r.Header); err != nil {
			v1.WriteError(w, 400, "invalid_webhook", "Webhook verification failed.")
			return
		}
		var event struct {
			Type string `json:"type"`
			Data struct {
				ID      string `json:"id"`
				Deleted bool   `json:"deleted"`
			} `json:"data"`
		}
		if err := json.Unmarshal(payload, &event); err != nil || event.Type == "" {
			v1.WriteError(w, 400, "invalid_webhook", "Invalid webhook event.")
			return
		}
		if event.Type == "user.deleted" {
			if event.Data.ID == "" || len(event.Data.ID) > 255 || !event.Data.Deleted {
				v1.WriteError(w, 400, "invalid_webhook", "Invalid deleted account.")
				return
			}
			if err := accounts.Erase(r.Context(), event.Data.ID); err != nil {
				logger.ErrorContext(r.Context(), "account erasure failed", "request_id", w.Header().Get("X-Request-ID"), "error", err)
				v1.WriteError(w, 500, "internal_error", "Account erasure could not be completed. Please retry.")
				return
			}
		}
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusNoContent)
	}), nil
}
