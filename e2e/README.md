# Browser tests

Run `make browsers` once, then `make e2e`. Docker must run. Use Node 26.10.0 (`nvm use`) and Bun 1.4.2. Testcontainers needs Node 22.19.0 or newer. Do not run a frontend build while E2E images are building; both use `frontend/build`.

```text
Host: Playwright (desktop + mobile Chromium)
  → random published frontend port
    → Bun SSR / static files / API proxy     [container]
      → Go cmd/api                          [container]
        → Postgres 17                       [container]
        → ephemeral Clerk JWKS              [inside API container]
```

`setup.ts` starts and closes the stack. `harness/images.ts` builds the application Dockerfiles with `GO_BUILD_TAGS=e2e` and `BUILD_MODE=e2e`; both default to production. `harness/stack.ts` owns the private network, fresh Postgres, readiness checks, random ports, and cleanup after success or partial startup failure. Testcontainers' reaper is the final backstop. The run needs no local app process, named volume, `.env`, or provider account.

The runner stays on the host, as in Temper. The frontend runs the release `server.ts`. The backend runs the migration command, then `cmd/api` with the `e2e` tag. Only external Clerk adapters change. JWT authorization, webhook signatures, owner-scoped queries, and app wiring remain real.

The Go `internal/testfixtures` package provides ephemeral signing keys and fixture routes. It can issue a signed session, sign an account-deletion event, and seed older workouts. Release builds cannot import this package. Each test gets a unique subject through `fixtures.ts`, and browser requests outside this run's origin are blocked.

Teardown stops the actual API container and checks that the production proxy returns a safe 503 response. It then removes the remaining containers and network. Failure in one cleanup step does not prevent later steps from running.

Browser tests cover signup, onboarding, saved plans, completion/Undo, activity, search, retries, account isolation, export, deletion, print/PDF, keyboard use, and mobile layouts. Repository tests cover SQL constraints, races, and rollback.

Artifacts:

- `../output/playwright/stack.log`: Postgres, API and frontend logs.
- `../output/playwright/test-results`: failure screenshots, traces and videos.
- `../output/playwright/test-results`: the print test's PDF.
- `playwright-report/index.html`: browser report.

Use `DEBUG=testcontainers:build make e2e` for image build diagnostics. The first run pulls pinned runtime images and installs locked dependencies; later runs reuse Docker build layers. Builds need registry access. The test journeys need no live Clerk service.
