# Deployment runbook

Deploy the frontend and Go API behind one public origin. Bun serves the frontend and proxies `/api/` to Go. Configure hosting, managed Postgres, TLS, backups, and the Clerk webhook endpoint on the deployment platform.

## Configure the environment

Use the deployment platform's secret store. Local Clerk CLI credentials in `frontend/.env.local` are for development. Never copy them into images or commit them.

| Variable                       | Consumer and purpose                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                 | Go API/migration process; use the managed Postgres connection and its required TLS configuration. The local Compose URL is development-only. |
| `VITE_CLERK_PUBLISHABLE_KEY`   | Frontend build and server configuration; also lets Go derive the exact expected Clerk issuer. Use the key for the intended instance.         |
| `CLERK_SECRET_KEY`             | Server-only Clerk credentials for the Go/Start processes that need them. Never place this value in a `VITE_*` variable.                      |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Go's verifier for the specific Clerk webhook endpoint. Required when using a live publishable key.                                           |
| `APP_ORIGINS`                  | Comma-separated public application origins accepted in session tokens, such as `https://endorphins.example`. No paths or wildcard defaults.  |
| `EXERCISE_DIR`                 | Go; an existing directory containing the five shipped exercise catalogues. Include these files in the deployment.                            |
| `API_ADDRESS`                  | Go listener; defaults to `127.0.0.1:8088`. Choose an appropriate internal interface when separate containers need connectivity.              |
| `API_ORIGIN`                   | Bun proxy target, normally an internal Go service address; defaults to `http://127.0.0.1:8088`.                                              |
| `HOST`, `PORT`                 | Bun listener; defaults to `127.0.0.1` and `3100`.                                                                                            |

Use an externally reachable HTTPS origin for the application and webhook, terminating TLS in the hosting platform or reverse proxy. Health probes should target the Go service directly: Bun only forwards paths under `/api/`.

## Build and start in order

Use the pinned Go and Bun toolchains and frozen frontend lockfile. Include version and revision in the Go startup log:

```sh
# Run from backend/. Supply release metadata from the build system.
export GOTOOLCHAIN=go1.27.1
ENDORPHINS_VERSION=0.3.0
ENDORPHINS_REVISION=$(git rev-parse --short HEAD)
go build -ldflags="-X github.com/epicchewy/endorphins/backend/internal/app.Version=$ENDORPHINS_VERSION -X github.com/epicchewy/endorphins/backend/internal/app.Revision=$ENDORPHINS_REVISION" -o bin/api ./cmd/api
go build -o bin/migrate ./cmd/migrate
```

Build the frontend from `frontend/` with `bun install --frozen-lockfile` and `bun run build`. Ship `frontend/build`, its required runtime dependencies, and `frontend/server.ts`; run it with `bun run server.ts`. Never ship an `e2e` frontend build or a Go binary built with `-tags=e2e`. The shared `backend/Dockerfile` and `frontend/Dockerfile` default to production. E2E tests opt into `GO_BUILD_TAGS=e2e` and `BUILD_MODE=e2e`; do not use those arguments for a release. The PDF-recovered Sharp Serif asset is a preview; replace it with the original licensed font package before public release.

Build container images from the repository root:

```sh
docker build -f backend/Dockerfile -t endorphins-api .
docker build -f frontend/Dockerfile -t endorphins-web \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="$VITE_CLERK_PUBLISHABLE_KEY" .
```

The public Clerk key is a frontend build argument. Supply secret keys and database credentials only at runtime. The backend image includes `/app/migrate` and `/app/api`; its default command starts only the API, so run migrations as a separate deployment step. Testcontainers uses these same images with explicit test build arguments and runs migrations before starting its disposable API.

Deployment sequence:

1. Verify the intended database, recoverable backup, environment, and release artifact. Do not print connection strings or secrets into logs.
2. Run the release's `bin/migrate` once with `DATABASE_URL` set. Migrations are embedded; golang-migrate handles its lock and dirty-state table. API startup does not apply them.
3. Start `bin/api` with the matching environment and catalogue. Startup fails if the catalogue is invalid, the database is unreachable, or schema compatibility fails.
4. Start the Bun frontend/proxy and route traffic only after the Go readiness probe succeeds.
5. Check a signed-in generation, saved detail/reload, library filters, and account export through the public origin. Check the configured Clerk lifecycle flow separately.

The current API accepts clean schema version 4 only. A dirty migration, old version, future version, or missing migration table prevents startup/readiness. Inspect and repair failed migrations before advancing the version; do not clear dirty state by resetting the database.

Migration 4 removes legacy foreign keys. Stop the old API before applying it, then start the matching API with explicit account cleanup and owner-row locks. Older binaries that depend on cascading deletes cannot safely run against this schema. Rollback migrations never restore foreign keys.

## Liveness, readiness, and request diagnosis

- `GET /healthz`: process liveness. A running API remains live during a database outage; restarting it repeatedly will not repair the database.
- `GET /readyz`: database connectivity and schema compatibility, bounded to two seconds. Returns `200` when ready or a safe `503` envelope otherwise; responses are not cached.
- Startup logs include application `version` and `revision`. Unset build metadata appears as `development`/`unknown`.
- API failures use `{message, code, requestId}`. Match the returned `X-Request-ID` to structured logs to inspect an unexpected cause. Internal database errors and secrets are not returned to clients. A proxy connection failure produces its own safe request ID.

## Configure Clerk account deletion

Register the receiver at `POST /api/webhooks/clerk`. The external endpoint and subscription are not configured by this repository.

In the intended Clerk instance, register the public HTTPS URL ending in `/api/webhooks/clerk`, subscribe to `user.deleted`, and put that endpoint's signing secret in `CLERK_WEBHOOK_SIGNING_SECRET`. Keep the route reachable without a browser-session redirect; its authentication is the Svix signature. Preserve the raw request body and `svix-id`, `svix-timestamp`, and `svix-signature` headers through every proxy. The checked-in Bun proxy forwards them.

After deployment, send a test delivery from that instance, then verify an actual development-account deletion: a valid event receives `204`, duplicate delivery remains harmless, workouts disappear, and a previously issued token cannot reprovision the account. Invalid signatures or timestamps receive `400`; storage failures receive `500` so delivery can retry. Keep failed-delivery monitoring enabled in Clerk. Local tests cover signatures and the proxy/database flow. Verify external reachability after deployment.

Clerk delivery is asynchronous. The application erases its account, plans, and completion logs when it processes a verified deletion. Short-lived session tokens and the normal Clerk session lifecycle still apply before delivery. Consult Clerk's [webhook overview](https://clerk.com/docs/guides/development/webhooks/overview) for delivery behavior and Svix's [Go verification guide](https://www.svix.com/guides/receiving/receive-webhooks-with-go/) for the signing protocol.

## Retention, backups, and rollback

Account erasure inserts a SHA-256 subject digest into `deleted_accounts`, locks the user row, and deletes completion logs, plans, and the user in one transaction. The digest/deletion time currently have no expiry. Retain them to reject stale sessions and late provisioning, and document that narrow retention purpose. The digest remains account-related data.

Live database deletion does not modify existing backups. Define backup retention and access policies with the hosting operator. Before opening traffic after a restore, preserve or reconcile completed erasures and tombstones so old account data is not restored as active. Backup expiry and restore-time erasure reconciliation are operational responsibilities; this repository does not automate them.

Rollback requires a binary compatible with the database schema. The current strict version check prevents assuming an older binary can run after a newer migration. Prefer a reviewed forward fix or a previously tested compatible artifact. Do not automatically run the version-2 down migration: it drops deletion tombstones and idempotency metadata. Any database rollback or backup restore needs explicit assessment of those data-loss and account-lifecycle effects before traffic resumes.
