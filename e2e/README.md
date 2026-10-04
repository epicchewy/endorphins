# Browser tests

Run `make browsers` once, then `make e2e`. Docker must run. Use Node 26.10.0 (`nvm use`) and Bun 1.4.2. The Testcontainers dependencies require at least Node 22.19.0.

```text
Host: Playwright (desktop + mobile Chromium)
  → random published frontend port
    → Bun SSR / static files / API proxy     [container]
      → Go cmd/api                          [container]
        → Postgres 17                       [container]
        → ephemeral Clerk JWKS              [inside API container]
```

`setup.ts` starts the stack before the tests and closes it afterward. `harness/images.ts` builds both app images in Docker. `harness/stack.ts` owns one private network, fresh Postgres, readiness checks, random ports and cleanup. It also cleans up after partial startup failures; Testcontainers' reaper is the final backstop. No local app process, named volume, `.env` file or provider account is used.

As in Temper, the browser runner stays on the host. All app services run in containers. The frontend uses the same `server.ts` as a release. The backend runs the real migration command, then `cmd/api` with the `e2e` build tag. Only the external Clerk provider and frontend identity adapters change. JWT authorization, signed deletion webhooks, owner-scoped queries and application wiring remain real.

The Go `internal/testfixtures` package provides ephemeral signing keys and fixture routes. It can issue a signed session, sign an account-deletion event, and seed older workouts. Release builds cannot import this package. Each test gets a unique subject through `fixtures.ts`, and browser requests outside this run's origin are blocked.

Teardown stops the actual API container and checks that the production proxy returns a safe 503 response. It then removes the remaining containers and network. Failure in one cleanup step does not prevent later steps from running.

Tests cover generation, saved history, search, retries, account isolation, export, deletion, print/PDF, keyboard and mobile interactions. Repository tests cover SQL constraints, races and transaction rollback. Keep these test responsibilities separate.

Artifacts:

- `../output/playwright/stack.log`: Postgres, API and frontend logs.
- `../output/playwright/test-results`: failure screenshots, traces and videos.
- `playwright-report/index.html`: browser report.

Use `DEBUG=testcontainers:build make e2e` for image build diagnostics. The first run pulls pinned runtime images and installs locked dependencies; later runs reuse Docker build layers. Builds need registry access. The test journeys need no live Clerk service.
