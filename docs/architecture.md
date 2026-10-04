# Endorphins architecture

Updated October 4, 2026. This describes the implemented application after the Temper comparison: explicit backend contracts, full-library queries, account lifecycle operations, shared frontend primitives, and hermetic browser verification. Payment, offline installation, and media storage remain deferred.

## Current product boundary

Generate a workout from the existing Python tool’s five JSON catalogues. Inputs are an integer duration of 30–120 minutes and a level of 1–5. Outputs are legs, upper-body, and core blocks, sets, repetitions or timed rounds, rest, notes, and an honest duration estimate. The UI can shuffle the same preferences and print the plan. Sign-in is required to generate a plan. Each plan is saved to the account and can be reopened from the workout journal.

Billing, Backblaze, guided timers, and offline installation are not implemented. The exercise view can step through a plan; it does not record completed training. A deployment runbook exists, but this change does not provision hosting or configure the external Clerk webhook subscription.

## Runtime

```mermaid
flowchart LR
  Browser[Phone or desktop browser] --> Web[TanStack Start / Bun]
  Web -->|same-origin /api proxy| API[Go / Echo]
  Browser --> Clerk[Clerk identity and sessions]
  API -->|verified JWT and owner-scoped queries| Postgres[(Postgres users and workouts)]
  Clerk -->|signed user.deleted event through /api proxy| Web
  API --> Catalogue[Validated JSON catalogue in memory]
  Files[Existing exercises/*.json] -->|startup| Catalogue
```

Start renders the application shell. Generation runs on Go, through a browser-triggered TanStack Query mutation. No SSR loader self-fetches a relative API URL. There is one QueryClient per router instance. Vite proxies `/api` in development; the Bun production server owns the same proxy and static assets. Go binds to loopback by default. Workout API requests carry a Clerk bearer token through the same-origin proxy. Clerk handles its own identity-service requests. Private history and account pages fetch on the client after a server auth guard; the API independently verifies every token. The account-deletion webhook is a separate public route authenticated by its raw-body Svix signature and timestamp, not a browser session.

## Stack

| Area           | Implemented                                                                           |
| -------------- | ------------------------------------------------------------------------------------- |
| Go             | 1.27.1, project toolchain; exact compiler also selected for the linter                |
| HTTP           | Echo v5.4.0, request IDs, recovery, structured request logs                           |
| React          | 19.3.0                                                                                |
| Routing        | TanStack Start 1.168.59 / Router 1.170.40                                             |
| Remote state   | Query 5.104.0 / SSR bridge 1.167.3                                                    |
| Styling        | Tailwind 4.3.3 utilities, semantic tokens and locally served fonts                    |
| Runtime/build  | Bun 1.4.2, Node 26.10.0, Vite 8.3.1                                                   |
| Authentication | Clerk TanStack Start SDK 1.6.3 / Go SDK v2.7.0; Svix v1.99.1 for webhook verification |
| Persistence    | Postgres 17, pgx v5.11.0, golang-migrate v4.20.1                                      |
| Database tests | Testcontainers Go v0.44.0                                                             |
| Browser tests  | Playwright 1.61.0, desktop Chromium and Pixel 7 mobile emulation                      |
| Contract       | OpenAPI 3.0.3, generated TypeScript with openapi-typescript 7.13.0                    |
| Checks         | strict TypeScript, Oxlint, Prettier, Go race tests, golangci-lint 2.14.0              |

The frontend versions follow the inspected Postmaker migration in `/Users/lchui/.codex/worktrees/1825/postmaker`, HEAD `ec8e694224e8f1db3e26b2b8133fe6e129bf94ad`. Endorphins has its own visual identity. Shared primitives wrap native controls and disclosures where appropriate. TanStack Form, Base UI, and Zustand have not been added without a concrete need.

Go 1.27.1 was verified against [official downloads](https://go.dev/dl/) and downloaded successfully during implementation. Echo’s [v5 quickstart](https://echo.labstack.com/docs/quick-start) was checked before setup. Lockfiles pin the resolved application dependencies.

## Repository structure

```text
api/openapi.json
frontend/
  Dockerfile                 # Shared production/e2e image build
  app/
    auth/                    # Production Clerk client/server adapters
    routes/                  # Routes, validated URL state, screen composition
    pages/                   # Landing/builder composition
    components/ui/           # Controlled buttons, fields, feedback, presence
    components/workout/      # Workout-specific builder, library, plan, exercise view
    components/auth/         # Account controls, auth layout, session boundary
    server/auth.ts           # Private-route server auth check
    hooks/                   # Query/mutation policy, export, print behavior
    services/                # HTTP, account/workout transport, keys, pure helpers
    types/api.gen.ts          # Generated from OpenAPI
    router.tsx               # Per-router QueryClient
    app.css                  # Ordered stylesheet import manifest
    app.css                  # Tailwind theme, fonts, base rules, keyframes, print setup
  test/                      # Focused unit tests and build-only identity fixtures
  scripts/check-boundaries.ts # Frontend dependency and primitive ownership checks
  server.ts                  # Bun SSR/static server and bounded same-origin proxy
e2e/
  setup.ts                   # Disposable Postgres/API/frontend lifecycle
  harness/                   # Testcontainers image build, network and app lifecycle
  fixtures.ts                # Per-test identities and local-only network policy
  specs/                     # Browser flows and actual HTTP/OpenAPI contracts
  playwright.config.ts       # Desktop/mobile projects and failure artifacts
backend/
  Dockerfile                 # Shared production/e2e image build
  cmd/api/main.go            # Signals, config, application entry point
  cmd/migrate/main.go        # Explicit versioned schema migration
  internal/
    api/v1/                 # Public request/response DTOs and error envelope
    app/                    # Constructor wiring and shutdown ownership
    config/                 # Grouped go-flags configuration
    server/                 # Routes, middleware, central error mapping, probes
    handlers/               # HTTP decoding/status/headers and consumed service interfaces
    services/workout/       # Pure generation and consumed catalogue port
    services/account/       # Identity resolution, erasure, and export
    services/library/       # Account-owned generation, queries, and cursor scope
    integrations/clerk/     # JWT verification and verified deletion webhook
    domains/                # Application values and pure workout rules
    repositories/catalogue/ # Concrete filesystem store
    repositories/postgres/  # SQL stores, versioned snapshots, migrations, query tests
    testfixtures/           # e2e-tag-only Clerk signing and workout seed helpers
exercises/                  # Original catalogue, shared with Python
scripts/                    # Development lifecycle and backend layer checks
```

`internal/services` is a grouping directory, not a Go package. Each service area gets a package when it has behavior to own. Methods for workout generation live beside `Service`, `New`, and the small `Catalogue` port.

## Dependency rules

Handlers declare small interfaces for the service methods they consume. Resource DTO files in `internal/api/v1` own `ToInput` and `New…Response` conversions, following Temper. Request/response types are separate from business rules and stored snapshots; the API layer can depend inward on service inputs and domains. Services use domain values and their own small interfaces. Repositories satisfy those interfaces structurally, without importing services. Storage snapshot structs are independent of public DTOs and domain serialization, so API changes do not redefine old plans. The application root constructs the repository, service, handler, and server explicitly. Domain code depends only on the standard library.

Services cannot import Echo, handlers, server, repositories, application setup, integrations, or configuration. Repositories cannot import services or HTTP layers. Handlers cannot construct storage or depend on the server. `scripts/check-layers.py` enforces these rules, including transitive imports, in `make check`.

Frontend import rules also run as part of linting. UI primitives and pure services cannot depend on application hooks/routes; hooks own remote-state policy; product components compose primitives. Motion ownership stays in the UI library. These restrictions preserve useful seams without introducing a container, ORM, or generic repository framework.

HTTP paths do not determine package boundaries. `POST /api/v1/workouts` persists a resource and returns `201` with its retrieval URL. Optional owner/input-scoped idempotency keys replay the saved result; a conflicting input receives `409`. Authenticated reads include `/api/v1/workouts`, `/api/v1/workouts/summary`, `/api/v1/workouts/{id}`, `/api/v1/me`, and `/api/v1/me/export`. Errors use safe `{message, code, requestId}` envelopes. The server generates the correlation ID; structured internal logs retain unexpected causes while responses expose safe copy.

`GET /healthz` is process liveness. `GET /readyz` checks the database and clean supported schema version with a two-second bound. Startup validates both catalogue and database schema. See [the account and workout model](accounts-and-workouts.md) for ownership, cursors, snapshots, idempotency, and deletion semantics; see [deployment](deployment.md) for operational setup.

## Generation policy

1. Validate duration and level before loading the catalogue.
2. Sample three distinct leg exercises, three upper-body exercises, and four core exercises.
3. Reserve five warm-up minutes for requests of at least 45 minutes, preserving the script’s threshold.
4. If a demanding initial sample exceeds the budget, remove its costliest exercise until it fits, retaining every body area.
5. Add whole sets or previously unused exercises while they fit. Prefer another set approximately 70% of the time when both choices are possible.
6. Return the actual estimated total, including warm-up, and the body area with the largest time allocation.

Repetition-based estimates retain the original easy/medium/hard values of 1/2/5 minutes. Interval estimates round up full work/rest rounds and add one transition minute. The generator never pads a plan with invisible time and never exceeds the requested estimate. A plan can finish a few estimated minutes below the request.

Random choices are local to each calculation and use concurrency-safe randomness in production. Deterministic tests supply an integer generator. Shared catalogue slices are not mutated. Startup validates every catalogue file, so missing or invalid data prevents readiness.

## Frontend ownership

Validated URL search owns builder minutes/level and library query/level/sort. The custom-duration input keeps an editing draft so intermediate values can be typed; only valid integers update route state. Library search typing replaces the current history entry, while deliberate filter/sort navigation can be revisited with back/forward. Defaults are omitted from the URL. Changing filters selects a new query key and starts a fresh page.

Hooks own fetching, pagination, retries, and mutations. `services/http.ts` owns authenticated transport, cancellation/deadlines, and safe error parsing; account and workout transport are separate modules. One key factory scopes every private query and mutation to the Clerk session. Generating a workout seeds its detail cache and invalidates all list/summary variants only if the originating session remains current. There is still one QueryClient per router instance.

The page owns the displayed generated workout and transient exercise/disclosure state; Postgres owns durable history. An unsuccessful generation preserves the previous plan. Shuffle uses the displayed plan's preferences; edited form settings show an explicit notice until a new plan is generated. Writes are not automatically retried. A manual retry in the same view keeps its idempotency key until success, reset, or changed preferences.

The library fetches filtered, ordered records and aggregate statistics across all matching saved plans. Loaded pages only determine which cards are currently displayed. Summary counts and estimated minutes never imply completed activity. The `/account` screen shows application account details and downloads a consistent owner-scoped export; late downloads are suppressed after a session switch.

## Design system

`components/ui` is the controlled primitive library: native buttons and link presentation, fields/inputs/selects/search/radios, error/retry feedback, loading/empty states, and Presence transitions. These components own presentation and interaction contracts; callers own application values, routing, and requests. Native exercise disclosures remain workout-specific components.

`app.css` contains font loading, semantic Tailwind tokens, base rules, and keyframes. It is the only application stylesheet. Shared primitives own control styles and states through Tailwind utilities; layouts and responsive/print variants stay beside their markup. The palette supports light and dark schemes. Shared controls preserve readable text, keyboard focus, disabled/pending behavior, and touch targets. Motion follows the shared reduced-motion policy.

Successful generation focuses the plan title and scrolls to it at mobile widths, respecting reduced motion. Print opens disclosures temporarily and restores them afterward. Fonts and photography are served locally. The display face is the Sharp Serif Text PDF preview recovered from the supplied specimen, paired with Inter; the original font package is still needed for public release. The [implemented design-system document](design-system.md) describes tokens and component contracts, and the development-only `/design-system` gallery renders the actual primitives.

Mobbin informed information hierarchy; the [Paper file](https://app.paper.design/file/01M3TVV9XXTXF2N7ZD43K3WH3V) stores desktop/mobile studies. Application tokens and implemented component contracts are the current source of truth and should be reconciled with future Paper changes.

## Verification and release isolation

Keep tests at the seam that owns the invariant. Generator/JWT tests and real Postgres race/constraint tests cover cases that are expensive or unreliable to infer through browser flows. Browser tests cover product interactions against the actual application and API. They also validate actual response bodies against OpenAPI, exercising the production same-origin proxy, idempotency, ownership, exports, and verified deletion.

The Playwright harness builds and starts the Go API, frontend and Postgres with Testcontainers on one private network. Each run gets fresh data and random host ports. Playwright runs on the host, as in Temper. Both image builds use the application Dockerfiles, with explicit E2E build arguments. The backend runs the normal migration and API commands; the frontend runs the production Bun SSR/static/proxy entry point. Startup and teardown own all containers and the network, including partial-failure cleanup. Tests block external browser requests and retain logs, traces, screenshots and video.

The Go `e2e` build swaps only the external Clerk backend for ephemeral keys and fixture routes from `internal/testfixtures`. The frontend substitutes its Clerk adapter only in `e2e` build mode. Tokens and deletion events still pass the real JWT and webhook verifiers; app wiring, owner-scoped queries and SQL migrations remain unchanged. Release import checks reject test fixtures, and frontend release checks reject test identity code. Real Clerk signup and provider webhook delivery remain separate integration checks. See [the harness guide](../e2e/README.md).

Postgres tests use one migrated container per package, created by `TestMain` in `repositories_test.go`. Serial resource tests reset rows before each case. Schema and migration tests use temporary databases within that same container. These tests call repositories directly and cover SQL behavior; browser tests own full HTTP journeys.
