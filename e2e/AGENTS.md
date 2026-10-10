# Hermetic browser tests

- `setup.ts` owns the test run. `harness/stack.ts` starts Postgres, the actual Go API and the production Bun SSR/static/proxy server with Testcontainers on one private network. Playwright runs on the host, as it does in Temper. Use random published ports and fresh data.
- `harness/images.ts` uses `../backend/Dockerfile` and `../frontend/Dockerfile` with explicit E2E build arguments. The same Dockerfiles default to production; do not add separate test Dockerfiles. Build in containers from the source allowlist in the root `.dockerignore`; never copy local `.env` files, credentials or `node_modules`.
- Replace only the external Clerk provider/UI. The Go `e2e` build uses `internal/testfixtures`; the frontend uses its explicit `e2e` adapter. Keep app wiring, real JWT/webhook verification, the migration command and stores. Never add a production auth bypass.
- Use `fixtures.ts`; each test gets a unique subject. Block browser requests outside the run's origin. Use fixture endpoints to seed old data when a journey needs it.
- Use accessible roles and assert visible outcomes. Test retries by losing a real saved response. Keep SQL races, JWT edge cases, snapshot compatibility and pure cache policy in focused package tests.
- Stop containers and the network on success and partial startup failure. Keep the real upstream-outage check in teardown. Docker failures must fail the run; never fall back to local app processes.
- `make e2e` runs desktop and mobile projects. Traces, videos, screenshots and service logs go to ignored `output/playwright`; reports go to `e2e/playwright-report`.
