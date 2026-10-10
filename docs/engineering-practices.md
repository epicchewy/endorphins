# Endorphins engineering practices

Read [architecture](architecture.md) for module ownership and [Jukebox notes](jukebox-backend-notes.md) for the reference code.

## Working commands

- `make setup` downloads pinned dependencies.
- `make db-up` starts local Postgres; `make migrate` applies versioned SQL using golang-migrate.
- `make dev` starts the database, runs migrations, and supervises the API and frontend; Ctrl-C stops both.
- `make format` applies formatting; `make lint` checks formatting and code without fixing it.
- `make check` checks layers, lint, race tests, frontend tests, generated types, TypeScript, and production builds.
- `make browsers` installs pinned Chromium once. `make e2e` runs desktop/mobile journeys against disposable app containers. See [browser tests](../e2e/README.md). `make smoke` is an alias.

CI runs `make check` and `make e2e`, rejects generated route/API drift, checks release bundles for test-identity leakage, and uploads browser reports, traces, videos and stack logs. The external Clerk provider UI is replaced only in the explicit e2e build; real API authorization and SQL remain exercised. Real Clerk sign-up still needs a provider integration check.

## Go structure and discipline

1. Keep one Go module under `backend/`. Use Go 1.27.1 and run the pinned linter with that compiler. Commit `go.sum` and `frontend/bun.lock`.
2. Keep domain rules pure. Services run use cases; repositories own external data; handlers translate HTTP. Respect the transitive import checks.
3. Give each service area a package with `Service`, `New`, and small consumed ports. Split files by use case. Do not create a root `services` package, global container, `BaseService`, or generic utility layer.
4. Use explicit constructor wiring in `internal/app`. Validate all catalogue data at startup. One owner handles lifecycle and graceful shutdown.
5. Accept `context.Context` first for I/O. Preserve cancellation and use deadlines. Pure calculations need no context parameter.
6. Return expected errors, wrap causes with `%w`, and classify with `errors.Is`. The HTTP boundary returns safe public messages. Do not log and return the same failure at several layers.
7. Use `slog`, structured request logs, and request IDs. Avoid logging request bodies or secrets.
8. Bound request bodies, headers, and server timeouts. Own and join every goroutine. Shared repository data is immutable; callers get independent snapshots.
9. Prefer concrete values, ordinary loops, early returns, small APIs, and straightforward code. Add an interface when it hides useful implementation detail or provides a needed test seam.
10. Use `gofmt` and the checked-in golangci-lint configuration. Suppress a linter only for a specific, explained exception.

Tests constrain time budgets, warm-up preservation, valid levels, catalogue isolation, real catalogue generation, race safety, and HTTP validation. Real-file and real-Postgres Testcontainers tests use the `integration` build tag. Repository tests follow Temper: one migrated container per package in `repositories_test.go`, serial tests with a data reset, and resource-named test files. DDL and migration cases use separate databases in that container. Never add `main_test.go` or command-entrypoint tests. Docker is required; tests must not silently skip when it is unavailable. Keep SQL parameterized and owner-scoped, propagate contexts, and close every rows cursor. Schema changes add versioned migrations; do not edit applied migrations except for the authorized removal of legacy foreign keys. Never add foreign keys. Repository transactions enforce parent existence, ownership, and explicit account cleanup. Unit tests use deterministic random sources rather than expecting a particular production shuffle.

## Frontend discipline

Routes own navigation and document metadata. Pages compose controls and presentation. Components do not know about Go package layout. HTTP calls live in `services/`; hooks coordinate remote state. Query keys come from one session-aware factory. URL search owns builder preferences and library q/level/sort; controls emit field patches and functional navigation merges the latest state. Keep incomplete number drafts local.

Create a QueryClient for each router instance, with `defaultPreloadStaleTime: 0`. Browser-only effects belong in effects or event handlers. Do not access `window` during server rendering or create a global SSR cache. Scope private queries and mutations by Clerk session ID, clear the old session on changes, and capture tokens from the specific session resource. Route guards never replace API authorization.

Use native controls until richer interaction needs an accessible primitive. Use local state for the two-field form. Generated API types come from `api/openapi.json`; do not edit generated files manually. Update the contract, Go response mapping, and UI together.

Keep pending, error, and success states distinct. Failed shuffles keep the saved plan. Writes have no automatic retry. A manual retry keeps its key; changed inputs or a new action get a new key. Saved-plan input is immutable. Confirmation and Undo belong to one hook. Refresh analytics without delaying confirmation.

Workout generation uses Query's `networkMode: 'always'` so connectivity failures reach the bounded fetch/error path instead of leaving controls paused offline. Keep the generation status region outside the result's `aria-busy` container, and announce success only for the current mutation's successful state. Show a failed shuffle beside the retained plan, with one error announcement.

Use Paper’s semantic tokens and locally served fonts. Use the shared `components/ui` library and its development `/design-system` gallery. Use Tailwind utilities in markup and shared primitive variants. Keep global theme/font/base rules in `app.css`; do not add page CSS or shared mapping dumping grounds. Keep motion inside the shared Presence component. Prefer readable copy, 48px controls (44px minimum targets), visible keyboard focus, native disclosure behavior, and reduced-motion support. Check 320/390/768px layouts and desktop in a real browser when browser access is available. Verify the print dialog and actual PDF before asserting print QA has passed.

## Scope and handoff

Accounts and saved workouts use Clerk and Postgres. Billing, cloud media, and guided timers remain deferred. Follow [the account data model](accounts-and-workouts.md); new account-owned records reference the internal user UUID. Do not create speculative adapters or empty packages.

Preserve the Python reference and exercise data when changing the application. Times are estimates. Filter new plans in the Go catalogue adapter; keep the original JSON files intact. Describe behavior changes and limits in the README.

Review the final diff, run relevant checks, and report only checks actually completed. Keep architecture and setup instructions synchronized with the implementation. Deploy or publish only when requested.

## Test ownership

Browser tests own generation, retry/offline behavior, URL persistence, account switching, library search, export, keyboard/mobile interactions and print output. The production-proxy contract checks live in the same Playwright harness. Focused tests retain algorithm budgets, JWT rejection cases, immutable snapshot compatibility, concurrent SQL/idempotency/deletion invariants and session-cache policy. Retire a duplicated test only after its replacement has passed; do not replace hard-to-reach database failures with browser mocks.
