# Test architecture refinement

Implemented on 4 October 2026, using Temper's repository tests and Playwright harness as the reference.

| Area | Before | After |
| --- | --- | --- |
| Command tests | Two `main_test.go` files; injectable writers used by those tests | Both files removed; command-only injection removed. Root and backend `AGENTS.md` ban entrypoint tests. The layer check rejects `main_test.go`. |
| Browser fixture | `cmd/smokefixture` started Postgres and wired another copy of the API | `internal/testfixtures` holds signed identity, deletion-event and seed helpers. The `e2e` build runs the actual `cmd/api` and `app.Run`. |
| Browser stack | Postgres container; API and Bun server ran as host processes | Testcontainers starts Postgres, API and frontend containers on one private network. Images build in Docker from an allowlist; ports and data are disposable. |
| Repository setup | A new container for each top-level test | One migrated container in `repositories_test.go`; serial tests reset rows. Schema tests use separate databases within that container. |
| Repository cases | Large tests mixed generation, services, SQL and HTTP orchestration | Resource files cover users, workouts, idempotency, readiness and migrations. Query tests call the actual stores. Playwright covers HTTP journeys. |
| Service policy | Cursor/filter/key validation mixed into SQL tests | Four focused library-service tests cover those policies without copying database behavior. |
| API package docs | A `doc.go` file containing only a package comment | Removed. Resource DTO files remain the API contract. |
| Proxy outage | The 10-second idle timeout could close a request before the 15-second upstream deadline | A 30-second idle timeout lets the production proxy return its safe 503 response. The container outage check caught this. |

## Boundaries

As in Temper, Playwright runs on the host. All application services run in containers. Only the external Clerk provider and frontend identity adapters are replaced; JWT checks, webhook signatures, migrations, owner-scoped queries and application wiring remain real. Fixture code requires `-tags=e2e` and cannot enter a normal release build.

The harness needs no local `.env`, live provider account or persistent database. Image builds need registry access. Test journeys block external browser requests. See [the harness guide](../e2e/README.md) for commands and artifacts.

Node 26.10.0 is pinned in `.nvmrc` and CI. Testcontainers' dependencies require Node 22.19.0 or newer; the previous Node 22.17.1 pin was too old.

## Verification

- `make check` passed: Go race tests against real Postgres, frontend policy tests, type generation, type checks, lint and release builds.
- Both normal and `integration,e2e` Go lint configurations passed with zero issues.
- Shuffled repository and library race tests passed: 55 cases including subtests.
- `make e2e` passed: 27 desktop/mobile journeys; five intentional mobile skips. The actual API shutdown returned a safe 503 through the production proxy.
- A separate startup-failure probe deliberately removed the API's Clerk key. Postgres and the frontend started first; the API then failed. The harness removed all app containers and the new network before the runner exited. The temporary probe files were removed.
- The local frontend and API readiness endpoint still returned HTTP 200 after the isolated test runs.

The Bun timeout behavior is documented in [Bun's server reference](https://bun.com/docs/runtime/http/server#idletimeout). The before/after behavior above was also observed in the real container stack.
