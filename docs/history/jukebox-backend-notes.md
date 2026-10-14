# Jukebox backend practices for Endorphins

Inspected October 1, 2026 in `/Users/lchui/Desktop/code/jukebox`, branch `codex/project-foundation`, commit `13a4b3c6ffc84efae1ae41a4e1b39397ade647bf`. The checkout was clean when inspected. I read repository instructions and selected implementation/test paths. I did not run Jukebox tests or audit the whole app.

The application calls itself Lukebox in its documentation; the repository is named Jukebox. Endorphins' resulting decisions live in [architecture](../architecture.md) and [engineering practices](../engineering-practices.md). Source links point to the inspected local checkout. Endorphins does not depend on that checkout.

## Practices to carry forward

| Observed practice | Evidence | Endorphins application |
| --- | --- | --- |
| Construction is explicit: repositories, services, provider clients, then routers | [Server entry point](/Users/lchui/Desktop/code/jukebox/backend/cmd/server/main.go) | Keep a small executable entry point and put wiring/lifecycle in `internal/app`; pass required dependencies through constructors. |
| Services coordinate a use case and consume replaceable dependencies | [MusicService and TrackSearcher](/Users/lchui/Desktop/code/jukebox/backend/internal/services/music.go) | Each service area has its own package and small interfaces beside the consumer. Providers return application/domain values. |
| HTTP requests and responses have named transport types and explicit mappings | [Link router](/Users/lchui/Desktop/code/jukebox/backend/internal/server/v1/links.go) | Bind/validate in handlers, map to service inputs, and map results to public API DTOs. Keep HTTP errors at the boundary. |
| Account ownership is checked for each protected operation | [Link service](/Users/lchui/Desktop/code/jukebox/backend/internal/services/links.go), [owner-isolation tests](/Users/lchui/Desktop/code/jukebox/backend/internal/services/links_test.go) | Scope plan/session reads and writes to the internal account ID. Test that another account cannot read, complete, or alter them. |
| Required authentication checks both invalid tokens and missing claims | [Clerk middleware](/Users/lchui/Desktop/code/jukebox/backend/internal/auth/clerk_middleware.go) | Return a consistent safe 401; resolve provider identity at the authentication/account boundary. |
| Repositories use request context, bounded operations, and stable pagination ordering | [Link target repository](/Users/lchui/Desktop/code/jukebox/backend/internal/repositories/link_targets.go) | Propagate cancellation; paginate with a stable `(timestamp, ID)` ordering and bounded limits. |
| Transactions protect a business outcome under concurrency | [Link resolution](/Users/lchui/Desktop/code/jukebox/backend/internal/services/links.go), [concurrent scan-limit test](/Users/lchui/Desktop/code/jukebox/backend/internal/repositories/links_concurrency_test.go) | Concurrent completion or webhook requests must create exactly one intended durable result. Put the atomic implementation behind a repository operation. |
| Applied migration files are immutable and tracked with checksums | [Database workflow](/Users/lchui/Desktop/code/jukebox/docs/database.md), [migration runner](/Users/lchui/Desktop/code/jukebox/backend/internal/migrations/migrator.go) | Preserve forward SQL migrations, verify content drift, and serialize migration application. Check the chosen runner's actual guarantees. |
| Database tests apply real migrations and exercise failure paths | [Migration tests](/Users/lchui/Desktop/code/jukebox/backend/internal/migrations/migrator_integration_test.go), [PostgreSQL test helper](/Users/lchui/Desktop/code/jukebox/backend/internal/testhelpers/postgres.go) | Test fresh/upgrade/repeated apply, rollback, constraints, and concurrency in disposable PostgreSQL. |
| External identifiers are distinguished from internal record IDs | [Database and identifiers](/Users/lchui/Desktop/code/jukebox/docs/database.md), [account synchronization](/Users/lchui/Desktop/code/jukebox/backend/internal/services/users.go) | Keep Clerk and Stripe identifiers provider-owned; choose one internal account identity for all ownership checks. Handle concurrent account creation explicitly. |
| Verification separates unit, database, HTTP, browser, and live-provider evidence | [Verification guide](/Users/lchui/Desktop/code/jukebox/docs/verification.md) | Report what each check proves; mock-provider success does not establish a real purchase flow. |

The concurrency test launches 20 resolutions against a link limited to five accepted scans, then checks five successes, the stored count, and analytics totals. Use the same outcome checks for Endorphins completion replay and webhook retries.

## Service package refinement requested for Endorphins

Jukebox puts `music.go`, `links.go`, and `users.go` in one `package services`. The initial proposal split Endorphins into `services/workout`, `services/session`, `services/billing`, and `services/account`. The app now uses workout, library, and account packages. Session and billing packages are deferred.

Each package can contain `service.go`, operation files, `ports.go`, `errors.go`, and colocated tests as needed. All files in a service directory share that package. Use `workout.Service` and `workout.New(...)`; methods such as `Generate` and `Substitute` remain together. `services/` itself is a grouping directory with no Go files.

Use Jukebox's direct control flow as a starting point: validate inputs, return early on failure, call the required dependencies in order, and wrap errors with operation context. Make dependencies visible in constructors and business inputs visible in method signatures. Group related inputs into a named struct when a long parameter list obscures meaning. Tests should control time, randomness, and external outcomes.

## Deliberate differences

- **GORM boundaries:** Jukebox's services and store interfaces expose `GetDB`/`WithTx`, and its domain structs contain GORM fields and hooks. Endorphins now uses GORM but keeps its models and transactions in repositories/PostgreSQL code. Domain structs stay independent of GORM; services express atomic operations through interfaces.
- **Interface ownership:** Jukebox collects persistence contracts in `internal/stores`. Endorphins declares the small interface where the service consumes it. Implementations satisfy it structurally through domain/standard types; adding a central stores layer is unnecessary for this plan.
- **Identity consistency:** Jukebox's database guide records Clerk IDs as link owners and internal user IDs for other records. Endorphins consistently uses internal account IDs after resolving Clerk identity.
- **Not-found behavior:** Some Jukebox repositories return `(nil, nil)`. Endorphins returns a shared domain error and tests that contract. Handlers should never infer not-found from a dereference failure.
- **Migration implementation:** Jukebox has an Atlas-compatible custom runner with directory and per-file checksums and batch transaction semantics. The initial proposal named Goose. Endorphins now follows Temper's separate GORM `AutoMigrate` command with repeatable data fixes; see [migrations](../accounts-and-workouts.md#migrations). It does not copy Jukebox’s custom runner or claim equivalent checksum behavior.
- **Test isolation:** Some Jukebox service tests use SQLite AutoMigrate fixtures; its PostgreSQL integration tests are separately tagged. Endorphins uses dependency fakes for isolated service tests and real PostgreSQL for persistence guarantees. The mandatory backend CI gate includes database tests even if a separate fast local command is offered.
- **Dependencies and helpers:** Jukebox uses Redis for OAuth attempts and QR images, plus broad utility packages. Endorphins adds dependencies and shared helpers for its own demonstrated needs. Pure helpers remain close to their owning domain or service.

## Applying the notes

During foundation work, implement one request through handler, service package, repository, and database; validate constructor wiring and the allowed import graph. Add a short backend `AGENTS.md` pointing to the actual Endorphins rules and commands. Use the Jukebox examples as reference. Keep Endorphins docs current.
