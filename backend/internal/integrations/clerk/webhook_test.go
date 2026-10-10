package clerk

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	svix "github.com/svix/svix-webhooks/go"
)

type eraserFunc func(context.Context, string) error

func (f eraserFunc) Erase(ctx context.Context, subject string) error { return f(ctx, subject) }
func TestVerifiedDeletionWebhook(t *testing.T) {
	t.Parallel()
	const secret = "whsec_dGVzdC13ZWJob29rLXNpZ25pbmctc2VjcmV0"
	signer, err := svix.NewWebhook(secret)
	require.NoError(t, err)
	for _, tt := range []struct {
		name, body            string
		offset                time.Duration
		tamper, missing, fail bool
		status, calls         int
	}{
		{name: "signed deletion", body: `{"type":"user.deleted","data":{"id":"user_delete","deleted":true}}`, status: 204, calls: 1},
		{name: "ignore other verified events", body: `{"type":"user.updated","data":{"id":"user_delete"}}`, status: 204},
		{name: "tampered body", body: `{"type":"user.deleted","data":{"id":"user_delete","deleted":true}}`, tamper: true, status: 400},
		{name: "unsigned", body: `{}`, missing: true, status: 400},
		{name: "expired", body: `{}`, offset: -10 * time.Minute, status: 400},
		{name: "future", body: `{}`, offset: 10 * time.Minute, status: 400},
		{name: "invalid JSON", body: `{`, status: 400},
		{name: "invalid deletion", body: `{"type":"user.deleted","data":{"id":"user_delete","deleted":false}}`, status: 400},
		{name: "storage failure retries", body: `{"type":"user.deleted","data":{"id":"user_delete","deleted":true}}`, fail: true, status: 500, calls: 1},
		{name: "bounded body", body: strings.Repeat("x", (1<<20)+1), status: 400},
	} {
		t.Run(tt.name, func(t *testing.T) {
			called := 0
			handler, err := NewWebhook(secret, eraserFunc(func(_ context.Context, subject string) error {
				called++
				assert.Equal(t, "user_delete", subject)
				if tt.fail {
					return errors.New("secret database detail")
				}
				return nil
			}), slog.New(slog.NewTextHandler(io.Discard, nil)))
			require.NoError(t, err)
			timestamp := time.Now().Add(tt.offset)
			signature, err := signer.Sign("msg_test", timestamp, []byte(tt.body))
			require.NoError(t, err)
			body := tt.body
			if tt.tamper {
				body += " "
			}
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/webhooks/clerk", strings.NewReader(body))
			if !tt.missing {
				req.Header.Set("svix-id", "msg_test")
				req.Header.Set("svix-timestamp", strconv.FormatInt(timestamp.Unix(), 10))
				req.Header.Set("svix-signature", signature)
			}
			res := httptest.NewRecorder()
			res.Header().Set("X-Request-ID", "test-request")
			handler.ServeHTTP(res, req)
			assert.Equal(t, tt.status, res.Code)
			assert.Equal(t, tt.calls, called)
			assert.NotContains(t, res.Body.String(), "secret database")
			if res.Code >= 400 {
				assert.Contains(t, res.Body.String(), `"requestId":"test-request"`)
			}
		})
	}
	_, err = NewWebhook("", nil, nil)
	require.Error(t, err)
}
