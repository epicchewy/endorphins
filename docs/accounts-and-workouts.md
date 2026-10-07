# Accounts and saved workouts

Clerk owns authentication and sessions. Endorphins stores application data in Postgres.

```mermaid
erDiagram
  CLERK_USER ||--o| USERS : "verified subject maps to"
  USERS ||--o{ WORKOUTS : owns
  USERS ||--o{ WORKOUT_COMPLETIONS : records
  WORKOUTS ||--o{ WORKOUT_COMPLETIONS : uses
  USERS {
    uuid id PK
    text clerk_user_id UK
    smallint default_level
    timestamptz onboarding_completed_at
    timestamptz created_at
  }
  WORKOUTS {
    text id PK
    uuid user_id
    timestamptz created_at
    smallint snapshot_version
    jsonb plan
    text idempotency_key
    text input_fingerprint
  }
  WORKOUT_COMPLETIONS {
    uuid id PK
    uuid user_id
    text workout_id
    timestamptz completed_at
    timestamptz undone_at
    text idempotency_key
  }
  DELETED_ACCOUNTS {
    text subject_hash PK
    timestamptz deleted_at
  }
```

The diagram shows application ownership. The database has no foreign key constraints.

`deleted_accounts` is separate from active users. It retains a SHA-256 digest of the Clerk subject after erasure; it contains no workout snapshot or raw Clerk user ID.

## Identity and sessions

The Clerk CLI links this project to the Endorphins app (`app_3K5z4w8PFdIMSXl1sR7bXIDV6EV`). Its TanStack Start middleware and provider manage browser sign-in, sign-up, session refresh, account switching, profile controls, and sign-out. Development credentials live in the ignored `frontend/.env.local` file written by the CLI. Only the publishable key may appear in a browser bundle.

Browser API calls obtain a fresh token from the specific Clerk session resource, then send `Authorization: Bearer …` through the same-origin proxy. Go verifies the signature and token times using the Clerk SDK, requires a user subject, session ID and expiry, checks the exact instance issuer derived from the publishable key, and restricts `azp` to `APP_ORIGINS`. Pending/non-active session claims are rejected. Older session tokens without `sts` remain supported. Cookies and client-supplied user IDs do not authorize the Go API.

Verification uses Clerk's cached public signing keys. Session revocation takes effect as short-lived tokens expire; the API does not look up the Clerk session on each request. A processed account-deletion webhook also blocks otherwise valid stale tokens through the local tombstone. Tokens, passwords, and secrets are never stored in Postgres or application browser storage. Clerk owns its own session storage and lifecycle.

Private routes use a server auth check when entering the private route tree and also withhold their contents if the browser session disappears. These screens fetch their data on the client; Go remains the authorization boundary. The canonical query-key factory scopes profile, workout lists, summaries, details, exports, activity, and write mutations to the Clerk session ID. On sign-out or account switching, the previous session's requests and caches are cleared, and page state is remounted. Late responses cannot replace the new account's data. Auth-dependent HTML and API responses are not publicly cacheable.

## Application users

The first authenticated API request resolves `sub` to `users.clerk_user_id`. Resolution and erasure acquire the same per-subject transaction lock. Resolution checks the deletion digest, returns an existing user without rewriting it, or inserts a user. Simultaneous first requests return the same internal UUID; a first request racing a deletion cannot recreate the account after erasure commits.

`users.id` is the stable key for application relationships. Completion logs and preferences use it. Future favorites and other account records should also reference it. Never use email, display name, or a browser-provided owner ID as the relationship key. Clerk remains the source for email and profile details; the app stores no profile copy.

`GET /api/v1/me` returns the current internal user and Clerk linkage. Provisioning is lazy, so a Clerk account that has never called the API may not yet have an Endorphins row. The `/app/account` screen shows its creation date and application reference, links back to the library, and provides an application-data download. Clerk's profile menu owns sign-in/profile management.

## Workout ownership and retries

`POST /api/v1/workouts` generates a plan and inserts it for the authenticated internal user. It returns `201 Created` with `Location` only after persistence succeeds. A successful new generate or shuffle action creates a separate saved workout.

The optional `Idempotency-Key` header binds one save attempt to its owner and generation input. Keys contain 1–128 visible ASCII characters. Replaying the same owner/key/duration/level returns the exact original saved workout and the same resource location, also with `201`. Reusing that key with different input returns `409` and `idempotency_conflict`. A unique owner/key constraint and a single conditional SQL upsert enforce this under concurrent requests; failed inserts do not reserve a key. Keys remain with their workout until account erasure.

The frontend retains the key across a manual retry of a failed attempt with unchanged preferences. Success, resetting the attempt, or changing preferences starts a new action. The key is local to the mounted view; reloading the page starts a new attempt. Mutations are not automatically retried. The backend also accepts requests without a key, which create an independent plan each time.

## Historical snapshots and API models

The `plan` JSONB column preserves level, requested duration, warm-up, total and per-block estimates, focus, sets, exercise descriptions, reps, timed rounds, and rests. History reads this snapshot without recalculating it. Edits to the source catalogue or estimate formulas do not change old workouts. The generator's existing opaque random text IDs are retained; the database supplies creation timestamps.

Storage has an explicit version-1 encoder/decoder with its own structs. Every read selects `snapshot_version`; an unsupported version fails explicitly. Public request/response DTOs live in `internal/api/v1`, with resource-specific request/response conversions beside the DTOs. Changing an HTTP field or domain struct therefore does not silently change the historical storage format. `api/openapi.json` defines the public contract and generates frontend types.

## Search, pagination, and summaries

`GET /api/v1/workouts` returns `{ items, nextCursor }` and searches all matching records owned by the caller, independently of the pages already loaded in the browser. It accepts:

| Parameter | Meaning                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`       | Trimmed, case-insensitive literal substring across focus, block names, and exercise names; at most 200 Unicode characters. `%` and `_` are ordinary characters. |
| `level`   | Optional level 1–5; omission includes every level.                                                                                                              |
| `sort`    | `newest` by default, or `shortest` by estimated minutes.                                                                                                        |
| `limit`   | 1–50 records, default 20.                                                                                                                                       |
| `cursor`  | Opaque continuation position for the same owner, normalized filters, and ordering.                                                                              |

Newest ordering uses `(created_at DESC, id DESC)`. Shortest ordering uses estimated minutes ascending, then the same timestamp/ID tie-breakers. Cursors carry the relevant position and a scope digest; changing owner, filters, or order requires starting a new first page. An empty `nextCursor` means the final page. Cursors are positions, not credentials: SQL still checks the authenticated owner on every request.

`GET /api/v1/workouts/summary` applies the same `q` and `level` filters to the complete library. It returns matching `count`, total estimated `plannedMinutes`, `averageMinutes` (zero for an empty result), and five `{ level, count }` entries including zero counts. These totals describe generated plans. Completion records supply activity totals. Library filters and sorting live in validated route search, so refresh and browser navigation restore the view.

`GET /api/v1/workouts/{id}` applies both owner and workout ID in SQL. Missing and other-account IDs both return `404`. There is no unscoped repository read method, public share link, or workout-edit endpoint.

## Export and account erasure

`GET /api/v1/me/export` returns a versioned JSON download containing the application user, all owned workout snapshots, completion logs (including undone records), and an export timestamp. Version 2 adds the completion array and account preferences. A read-only, repeatable-read transaction gives the export a consistent database view. It does not export Clerk-held credentials or profile information. The account screen fetches it with the captured session's bearer token, verifies the returned application owner, downloads a Blob, and discards the payload. Switching sessions suppresses a late download from the previous account.

`POST /api/webhooks/clerk` verifies the signature and timestamp over the raw, size-bounded body before decoding. It needs no browser session. A `user.deleted` event records the subject digest and deletes completion logs, plans, and the user in one transaction. Duplicate deletions are harmless. A deletion received before initial provisioning still records a tombstone. Other verified event types are acknowledged without changing application data.

The receiver is implemented, but its external Clerk endpoint subscription and signing secret still need deployment configuration. Delivery is asynchronous; erasure occurs when a valid deletion event is processed. Erasure failures return an error so the provider can retry. There is no separate application-only deletion button: account deletion is managed through Clerk and synchronized by the verified event.

Tombstones currently have no automatic expiry. They retain only the subject digest and deletion time to prevent stale sessions or late events from reprovisioning an erased account; they remain security-related retained data. Database backups and restored copies require a separate retention and erasure-reconciliation policy. Deleting the live row does not rewrite old backups. See the [deployment runbook](deployment.md) before enabling public accounts. Billing and media storage are deferred.

## Migrations

`cmd/migrate` applies embedded SQL with golang-migrate’s version table, lock, and dirty-state handling. API startup never applies migrations. See [architecture](architecture.md) for module ownership.

The current API requires clean schema version 4, both at startup and in its database-aware `/readyz` probe. `/healthz` reports process liveness separately. Run migrations before deploying a matching API binary. Future schema changes add migrations. The user's removal of legacy foreign keys is the authorized exception to preserving applied SQL. Never silently reset a database to clear a dirty state.

## Preferences and completion records

Migration 3 adds `users.default_level` (1–5, initially Light) and `users.onboarding_completed_at`. `PATCH /api/v1/me` updates the caller's level and can set the onboarding timestamp once. It cannot change ownership or clear onboarding.

`workout_completions` stores an ID, account ID, saved plan ID, server confirmation time, optional undo time, and required retry key. Repository transactions check plan ownership and lock the account row before writing. The account/key pair is unique. `POST /api/v1/workouts/{id}/completions` replays the same record for the same key and plan; another plan with that key returns 409. A fresh key counts another workout. `DELETE /api/v1/completions/{id}` voids the caller's record; repeating Undo is harmless. Replaying a voided completion returns 409. Account erasure removes all logs.

`GET /api/v1/activity?timezone=America/New_York` excludes voided records. It counts all completed workouts, distinct local dates this week, four Monday-start weeks, and five recent records. Local calendar arithmetic preserves week boundaries across daylight-saving changes. Weekly chart counts are zero-filled. Confirmation time is not a measured training duration. Generated plans stay separate from activity totals.

## No foreign keys

Foreign keys are prohibited in all application migrations, including rollback migrations. Migrations 1 and 3 contain no relationship constraints. Migration 4 drops the legacy constraints and the redundant owner/plan unique index from already migrated databases. Rollback never restores foreign keys. Primary keys, unique retry keys, value checks, and query indexes remain.

Workout and completion writes hold a `FOR KEY SHARE` lock on the owner row until commit. Missing owners return `ErrNotFound`. Account erasure takes `FOR UPDATE` on that row before deleting completion logs, saved workouts, and the account. A concurrent write either commits before cleanup or finds no owner after cleanup. The subject tombstone and all data deletion commit together. The locks prevent child records from surviving account erasure.

Real Postgres tests cover zero-foreign-key schemas, legacy version-three upgrades without data loss, writes during erasure, and rollback after a failed user delete. [Browser contracts](../e2e/specs/contracts.spec.ts) check ownership, retries, exports, and signed deletion through the production proxy. See [test ownership](engineering-practices.md#test-ownership) for the remaining checks. Actual Clerk signup, profile changes, and webhook delivery need a development-instance check.
