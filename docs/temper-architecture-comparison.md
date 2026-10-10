# Endorphins × Temper architecture comparison

Reviewed October 3, 2026; implemented October 4. This records the proposal and pre-change baseline. See [the implementation report](temper-improvements.md) for changes, screenshots, tests, and limits.

Persistence changed on October 9, 2026: Endorphins now uses GORM for application queries and follows Temper's separate model-driven `AutoMigrate` command. Versioned SQL migrations and their runner are removed. Its models and transactions remain in repositories. The pgx decisions below describe the earlier baseline. See [current architecture](architecture.md) for the implemented rules.

The comparison used Endorphins’ working files, including the uncommitted full-stack application, and the local Fireworks checkout at `16bec7603b7`. Temper's most recent path-specific commit is `cc0e515b6c2`. Source links point to the inspected local checkouts. Endorphins does not depend on them. I followed representative backend request/storage paths, frontend query/navigation/UI paths, and test/CI configuration. This is not an exhaustive audit of Temper's agent, infrastructure, or analytics subsystems.

Keep Endorphins’ Go layers, TanStack frontend, Echo, pgx, and manual constructors. Adopt Temper’s explicit contracts, shared frontend conventions, and behavior tests.

## Module structure

Temper's established CRUD path is:

```text
HTTP handler → API DTO mapping → service → store interface → repository → Postgres
```

`stores` collects interfaces for persistence adapters. For example, [CustomerStore](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/stores/customer.go:10) is implemented by [CustomerRepository](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/repositories/customer.go:12) and consumed by [CustomerService](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/services/customer.go:10). Newer service packages also own narrower interfaces, such as [models.ControlPlaneClient](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/services/models/control_plane.go:13).

Endorphins already follows the equivalent runtime flow:

```text
Echo handler → services/library → its Workouts interface → repositories/postgres
                               → services/workout → catalogue interface → filesystem catalogue
```

The [library service owns its consumed interfaces](/Users/lchui/.codex/worktrees/3ae1/endorphins/backend/internal/services/library/service.go:17); concrete repositories satisfy them structurally. This keeps the chosen `domains / services / repositories / handlers` organization. A `stores/` directory would only relocate those interfaces.

Both applications use pragmatic layers. Temper's domain models include GORM metadata and hooks, and some services normalize GORM errors; its domain is coupled to persistence. Endorphins already keeps its domain and service packages independent of pgx/Echo through an enforced import graph. Resource semantics and HTTP behavior define RESTfulness. Endorphins' create/list/get workout endpoints already fit that model.

## Comparison and decisions

| Area | Temper evidence | Endorphins baseline | Decision |
|---|---|---|---|
| Composition | Explicit construction in [main](/Users/lchui/Desktop/code/fireworks/temper/backend/cmd/temper/main.go:96), plus a repository registry and route wiring | One small [composition/lifecycle owner](/Users/lchui/.codex/worktrees/3ae1/endorphins/backend/internal/app/app.go:26) | **Keep.** Introduce named wiring helpers only when this becomes hard to read; no registry/container now. |
| Package ownership | Older root `services` package coexists with newer service subpackages | `services/account`, `services/workout`, `services/library` | **Keep.** The current per-service packages are more consistent with the architecture already agreed here. |
| Handler seam | [Handler-local service interface](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/handlers/customer.go:14) | [Workout handler takes a concrete library service](/Users/lchui/.codex/worktrees/3ae1/endorphins/backend/internal/handlers/workout.go:17) | **Adopt.** Small consumed interfaces permit focused HTTP mapping/error tests. |
| API models | Dedicated [requests and mappings](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/api/v1/demand_requests.go:15) and [responses](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/api/v1/demand_responses.go:12) | Separate generation request, but saved domain values are serialized directly | **Adapt.** Explicit response DTOs and mappings let HTTP and stored snapshots evolve independently. |
| Errors | Shared [public error representation](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/api/v1/response.go:10) and [service-error mapping](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/handlers/json.go:102) | Echo messages and status-specific copy in one [frontend request helper](/Users/lchui/.codex/worktrees/3ae1/endorphins/frontend/app/services/workouts.ts:18) | **Adapt.** Stable error codes, safe messages, and request IDs; retain Echo. |
| Transactions | [InTx/WithTx orchestration](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/services/supply_upload.go:211), with real [multi-store rollback tests](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/repositories/tx_rollback_test.go:59) | Saving a generated workout is one atomic INSERT | **Defer infrastructure.** Add an atomic repository operation when a real multi-write invariant appears. |
| Database changes | [GORM AutoMigrate plus explicit adjustment code](/Users/lchui/Desktop/code/fireworks/temper/backend/cmd/automigrate/main.go:29) | [Versioned SQL migrations](/Users/lchui/.codex/worktrees/3ae1/endorphins/backend/internal/repositories/postgres/migrate.go:18), explicit execution, locks/dirty-state handling | **Adopted October 9.** Use GORM models and repeatable data fixes through a separate command. |
| Query/cache policy | [Canonical query key factory](/Users/lchui/Desktop/code/fireworks/temper/frontend/src/lib/query-keys.ts:8), hooks own fetching policy | Session-scoped keys repeated across hooks, routes, and cache cleanup | **Adopt the factory**, preserving session identity in every private key. |
| URL state | [Validated search and stripped defaults](/Users/lchui/Desktop/code/fireworks/temper/frontend/src/routes/supply/index.tsx:12) | Builder accepts URL preferences; library filters/sort are local state | **Adopt.** Put durable library view state in the route; keep transient interaction state local. |
| Frontend seams | [Enforced import rules](/Users/lchui/Desktop/code/fireworks/temper/frontend/biome.json:63) separate presentation, hooks, and pure modules | Helpful directories, but no equivalent frontend import restrictions | **Adopt the rules**, with the current toolchain where practical. A Biome migration is a separate choice. |
| Design system | [Controlled primitives](/Users/lchui/Desktop/code/fireworks/temper/frontend/src/components/ui/button.tsx:1), [shared presence](/Users/lchui/Desktop/code/fireworks/temper/frontend/src/components/ui/presence.tsx:23), documented tokens | Tokens/native controls exist; global CSS holds most presentation; motion is component-specific | **Adapt selectively.** Extract repeated controls and motion while preserving Endorphins' visual identity. |
| Persistence tests | Shared [container helpers](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/testhelpers/postgres.go:26), strict service mocks, repository tests | Strong real-query coverage in one [integration suite](/Users/lchui/.codex/worktrees/3ae1/endorphins/backend/internal/repositories/postgres/postgres_integration_test.go:33) | **Refine.** Reuse isolated fixtures and test the layer responsible for each invariant. |
| Browser verification | [Disposable full-stack harness](/Users/lchui/Desktop/code/fireworks/temper/playwright/harness/stack.ts:43), [behavioral navigation specs](/Users/lchui/Desktop/code/fireworks/temper/playwright/specs/navigation.spec.ts:4), CI artifacts | Unit tests and production HTTP smoke, no checked-in browser suite | **Adopt.** Add actual browser interaction coverage with mobile projects. |
| Health | [Bounded database health check](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/handlers/health.go:40) | `/healthz` checks process liveness; database ping happens at startup | **Adapt.** Keep liveness and add a separate readiness endpoint. |
| Working conventions | Scoped backend/frontend/test instructions and implemented design-system documentation | Architecture/practices docs exist; no root/backend/frontend AGENTS files found | **Adopt concisely.** Point short instructions to maintained docs and executable checks. |

## Proposed changes

### 1. Share query and URL policy

Move the account transport out of `services/workouts.ts`; extract the existing authenticated request/error machinery into a small shared HTTP module. Keep token retrieval tied to the captured Clerk session, keep cancellation/deadlines, and keep generation retries disabled.

Add a key factory for `account(sessionId)`, `profile(sessionId)`, `workoutLists(sessionId)`, `workoutList(sessionId, filters)`, and `workout(sessionId, id)`. Hooks own query policies; pages/routes compose them. All list variants must sit under one list prefix, so generating a workout invalidates every relevant list. Cache clearing must use the same account prefix. After creation, seed the detail cache from the returned saved workout when the originating session is still active.

History and detail routes define queries directly; generation uses a hook. Put those policies in hooks.

Move library `q`, `level`, and `sort` into validated route search. Use links for deliberate navigation; use replacement for typing changes so each keystroke does not create a browser-history entry. Keep focus-mode position, disclosure state, and hover state local. Builder preferences initialize from the URL, but edits remain local. Let URL search own valid preferences.

Verify: filters survive refresh/back; changing filters resets pagination; generation refreshes all list variants; account switching cannot reuse cached data or late results from the previous session.

### 2. Search the entire workout library

The [library component](/Users/lchui/.codex/worktrees/3ae1/endorphins/frontend/app/components/workout/workout-library.tsx:7) searches, sorts, and summarizes only the pages already fetched. It correctly labels this limitation. An older match can remain hidden until the user repeatedly selects “Load more.” Keep the limitation label until search covers the full library.

Add owner-scoped backend filtering and sorting to the collection endpoint, plus a summary read that explicitly defines whether totals describe all saved plans or the active filters. Use a collection-summary subresource. Include normalized filters in query keys. Pagination cursors must match the selected ordering: shortest-first needs duration plus stable tie-breakers, not the existing newest-first cursor reused unchanged.

Keep the full JSONB plan for immutable historical detail. Return a lightweight list DTO when detail payload size justifies it; add indexed scalar projections only for the query paths we actually ship and measure. Keep generated plans distinct from completed sessions. Record completion only after confirmation.

Verify: a match beyond the first page is discoverable; filters and sort operate over the same account-wide dataset; ties paginate without missing/duplicating rows; summaries have the declared scope; another user's records never affect results.

### 3. Make backend transport and use-case seams explicit

Add handler-owned `workoutService` and `accountService` interfaces with only consumed methods. Keep real services in `internal/services/<area>` and repositories in `internal/repositories/<store>`. Do not introduce a root `services` package or global mock catalog.

Add a small `internal/api/v1` package for transport DTOs, with mapping in handlers or adjacent mapping files. Keep `api/openapi.json` authoritative for the public contract and generated TypeScript. Handwritten Go DTOs are sufficient at this scale when their serialized output is checked against the contract; a second generator can be evaluated separately. Endorphins already has generated-file drift checks in CI and OpenAPI-based smoke assertions, so preserve and extend it.

The main reason for DTOs here is independence: `SavedWorkout.WorkoutPlan` currently supplies both the saved JSON and HTTP response. A future API rename should not silently redefine how historical JSON is decoded. The database already has `snapshot_version = 1`, enforced by a constraint. Before introducing version 2, read that column and dispatch an explicit versioned decoder, test old snapshots, and change the constraint through a new migration. This prepares for a later storage version.

Give expected failures stable public codes and central HTTP mapping. Unexpected failures retain wrapped causes for logs and expose safe copy plus a request ID. Extend the existing error response compatibly where possible. Share the same documented envelope across Go, the Bun proxy's unavailable response, and frontend parsing; avoid a whole new generic service/error framework.

Verify: request mapping, statuses, safe internal failures, stored-v1 compatibility, and complete OpenAPI response shape. Service failure tests should fail on unexpected dependency calls; [Temper's function-field mock](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/mocks/customer_repo.go:12) is a useful pattern, but local test doubles suffice here.

### 4. Share controls and styling rules

The inspected `app.css` has 2,470 lines covering tokens, page layouts, controls, responsive variants, motion, and print. Give each concern an owner before adding more screens.

Split tokens/base, shared controls, motion, page-specific styling, and print styling while preserving cascade order. Extract only components that already repeat: button/link presentation, search and field chrome, inline error/retry treatment, loading/empty states, and a controlled presence primitive for repeated transitions. Keep accessible native controls when they meet the interaction requirement. No mandatory table library for a short workout-card list, and no form library just for two builder fields; adopt TanStack Form when preferences or session logging introduce substantial validation.

Temper's controlled primitives, shared motion tokens, and import restrictions are the transferable ideas. Its dense 9–11px typography, small controls, mandatory global toasts, and enterprise sidebar are not the right defaults for this mobile-friendly audience. Keep Sharp Serif/Inter, readable sizing, touch targets, inline actionable errors, and the current studio direction. Maintain a concise implemented design-system document linked to Paper; reconcile tokens when designs change.

Verify: no mobile overflow, usable keyboard/focus behavior, stable loading/error layouts, reduced-motion behavior, and unchanged print output. Use screenshots and a short recording for the changed flows.

### 5. Add isolated browser verification and launch operations

Endorphins' current tests already cover signed JWT verification, account cache isolation, real SQL, constraints, pagination, and an actual production frontend/proxy HTTP path. Start from the [smoke fixture](/Users/lchui/.codex/worktrees/3ae1/endorphins/backend/cmd/smokefixture/main.go:1). The [later test refinement](test-architecture-refinement.md) replaced it with the actual app entry point.

Borrow Temper's fixture ownership, disposable database, real application build, role-based locators, automatic waits, cleanup, and retained traces. Start with generation → saved detail → library → reload, failed shuffle retaining the prior plan, filter/back behavior, and desktop/mobile layouts. Keep tests independent. Endorphins should continue exercising its same-origin proxy rather than copying Temper's cross-origin harness setup.

Authentication needs an explicit testing design: signed JWT fixtures exercise Go authorization but do not automatically emulate the Clerk browser SDK or Start route guard. Keep isolated application tests distinct from a controlled Clerk development-instance login check. Do not introduce a production-accessible auth bypass to make the suite convenient. Temper's inspected configuration runs desktop Chromium only; mobile coverage is an Endorphins addition.

Add `/readyz` with a short database timeout and migration-compatibility policy, keeping `/healthz` as liveness. Request IDs, structured logs, HTTP timeouts, and graceful shutdown already exist. Add a deployment runbook and build metadata for support. Defer Kubernetes, leader election, Redis, and distributed workers.

Before public release, finish the already documented Clerk account-deletion/data lifecycle. Temper’s internal employee access model does not cover this lifecycle. Generation idempotency is another later reliability improvement: today an ambiguous network failure followed by a manual retry can save two different workouts. If added, scope the request key to the owner, bind it to the input, and return the same saved result on replay; the database operation owns the atomic guarantee.

## What to preserve or deliberately avoid copying

- **Per-router QueryClient and session-scoped private caches.** Temper's inspected [provider caches its QueryClient in a module variable](/Users/lchui/Desktop/code/fireworks/temper/frontend/src/integrations/tanstack-query/root-provider.tsx:4). That lifetime is unsuitable to copy into a Clerk-authenticated SSR application. This observation is not a demonstrated Temper data leak.
- **Pure Go domains and consumer-owned interfaces.** Temper's [Customer model](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/domains/customer.go:1) and [persistence error normalization](/Users/lchui/Desktop/code/fireworks/temper/backend/pkg/services/errors.go:1) carry ORM dependencies. Endorphins' current stricter separation is useful.
- **Atomic operations with a clear owner.** Current generation requires one workout INSERT. Future session completion or idempotent writes should use a cohesive repository operation with rollback/concurrency tests. Add a transaction coordinator only when multiple independently useful repositories need to participate in the same use case.
- **Evidence over reference documentation.** Temper's instructions describe an all-in-one supply upload, but the inspected implementation resolves the vendor and uploads to Drive outside the SQL transaction, then compensates failures; only deal/audit/line-item/schedule writes share that transaction. Copy the actual invariant needed, not a claim of universal atomicity.
- **Application-sized infrastructure.** Keep `internal/`, Echo, pgx, slog, manual injection, GORM schema setup, and same-origin API calls. Temper's MCP/agent streams, BigQuery, RBAC/redaction matrix, export workers, repository registry, and deployment machinery serve different demonstrated needs.

## Suggested implementation order

| Slice | Scope | Completion evidence |
|---|---|---|
| 1. Frontend data conventions | HTTP/account separation, canonical session-aware keys, query hooks, URL-backed library state, frontend import rules | Focused cache/navigation tests; lint, typecheck, build; browser evidence when access is available |
| 2. Backend contracts | Handler interfaces, API DTO mapping, consistent error codes/request IDs; short scoped agent instructions | Focused handler/service tests, existing SQL integration suite and OpenAPI smoke remain green |
| 3. Full-library queries | Backend filters/sorts/summary, cursor rules, query-key integration | Real Postgres ownership/pagination/filter/summary tests and a matching UI flow |
| 4. UI system and browser suite | Extract repeated primitives/tokens, isolate production-stack browser fixtures, add desktop/mobile specs and CI artifacts | Generation/save/reload/failure/navigation browser flows, visual comparison, print check |
| 5. Public-release lifecycle | Readiness, deployment/runbook, account deletion; decide whether generation replay semantics are needed at launch | Dependency-failure readiness test, lifecycle replay/deletion checks, release checklist tied to actual behavior |

## Verification performed for this comparison

Read local implementation, tests, CI configuration, and project instructions from both projects. `python3 scripts/check-layers.py` passed. The comparison changed no code and started no app or test stack. Existing coverage was inspected; full tests and browser checks were not run.
