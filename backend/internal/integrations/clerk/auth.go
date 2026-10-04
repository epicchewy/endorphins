// Package clerk adapts Clerk's verified session claims to an application identity.
package clerk

import (
	"context"
	"net/http"
	"slices"
	"strings"

	clerkSDK "github.com/clerk/clerk-sdk-go/v2"
	clerkHTTP "github.com/clerk/clerk-sdk-go/v2/http"
	"github.com/clerk/clerk-sdk-go/v2/jwks"
	v1 "github.com/epicchewy/endorphins/backend/internal/api/v1"
	"github.com/epicchewy/endorphins/backend/internal/domains"
)

type sessionState struct {
	Status string `json:"sts"`
}

func New(client *jwks.Client, issuer string, origins []string) func(http.Handler) http.Handler {
	unauthorized := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("WWW-Authenticate", "Bearer")
		v1.WriteError(w, http.StatusUnauthorized, "unauthenticated", "Sign in to access your workouts.")
	})
	verify := clerkHTTP.WithHeaderAuthorization(
		clerkHTTP.JWKSClient(client),
		clerkHTTP.AuthorizationJWTExtractor(func(r *http.Request) string {
			parts := strings.Fields(r.Header.Get("Authorization"))
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				return ""
			}
			return parts[1]
		}),
		clerkHTTP.AuthorizedParty(func(origin string) bool { return origin != "" && slices.Contains(origins, origin) }),
		clerkHTTP.CustomClaimsConstructor(func(context.Context) any { return &sessionState{} }),
		clerkHTTP.AuthorizationFailureHandler(unauthorized),
	)
	return func(next http.Handler) http.Handler {
		return verify(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := clerkSDK.SessionClaimsFromContext(r.Context())
			if !ok || claims == nil || claims.Issuer != issuer || claims.Subject == "" || claims.SessionID == "" || claims.Expiry == nil {
				unauthorized.ServeHTTP(w, r)
				return
			}
			state, ok := claims.Custom.(*sessionState)
			if !ok || (state.Status != "" && state.Status != "active") {
				unauthorized.ServeHTTP(w, r)
				return
			}
			next.ServeHTTP(w, r.WithContext(domains.WithSubject(r.Context(), claims.Subject)))
		}))
	}
}
