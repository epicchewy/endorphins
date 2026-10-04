# Endorphins

A full-body workout generator built with TanStack Start, React, and Go/Echo. Choose 30–120 minutes and one of five levels to create a workout from the original exercise catalogue.

The app includes Clerk sign-in/sign-up, a responsive workout studio, saved-plan analytics and filters, an exercise-by-exercise guide, shuffle, exercise notes, and printable workout sheets. Light, dark, and system appearances share an athletic visual system. Every generated plan belongs to an account and persists in Postgres. Billing and cloud media storage remain outside this pass.

## Run locally

Prerequisites: Docker (running), Node.js 26.10.0 (`nvm use`), Bun 1.4.2, Python 3 for repository checks, and Go with automatic toolchain downloads enabled. The backend and Go linter use Go **1.27.1**; the project does not replace your global Go installation.

```sh
make setup
npm install -g clerk
clerk auth login
cd frontend
clerk init --app app_3K5z4w8PFdIMSXl1sR7bXIDV6EV
clerk doctor
cd ..
make dev
```

Open [Endorphins](http://127.0.0.1:3100). The Go API listens on `127.0.0.1:8088`. The frontend proxies `/api` to Go, keeping browser requests on the same origin. The exercise files are loaded and validated when Go starts.

The Clerk setup only needs to be done once per checkout. It writes ignored development keys to `frontend/.env.local`. `make dev` starts Postgres on loopback port 5548, applies migrations, and starts both servers. The Make targets use Bun’s CLI to load `.env.example` defaults and `frontend/.env.local`, then run Go directly. Exported variables take precedence.

For separate terminals, run `make db-up`, `make migrate`, then `make api` and `make web`. Export `DATABASE_URL` to use a different database. Set `APP_ORIGINS` to comma-separated frontend origins when changing the frontend address; if changing `API_ADDRESS`, update `API_ORIGIN` too. `make db-stop` preserves your local database volume.

Open **Get started** to create your first app account. Signing in to the Clerk CLI only authenticates the CLI; it does not sign you into Endorphins. Your account menu provides profile and sign-out controls, and **My workouts** reopens saved plans.

### Codex local environment

The checked-in [Codex environment](.codex/environments/environment.toml) installs Go/Bun dependencies and Playwright Chromium when Codex sets up a new worktree. Its toolbar actions call the root Make targets: **Run app**, **API**, **Frontend**, **Start Postgres**, **Migrate**, **Stop Postgres**, **Check**, and **E2E**.

Actions that need Node use `npx` to select the version in `.nvmrc`. This caches the project version without changing your global Node default. npm/npx, Bun, Go, Python 3, and Docker must already be installed; Docker must run for the app and database tests.

Complete the Clerk CLI setup above in each new checkout before starting the app. Keys stay in ignored `frontend/.env.local`; setup does not copy credentials or start services. **Run app** uses ports 3100, 8088, and 5548, so run one local development stack at a time. **E2E** uses disposable services on random ports and needs no Clerk credentials.

## Verify and build

```sh
make check       # formatting, layer boundaries, lint, race tests, frontend tests,
                 # API types, TypeScript, and both production builds
make browsers    # install pinned Chromium once
make e2e         # hermetic desktop/mobile browser tests on dynamic ports
make format      # apply Go and frontend formatting
```

`make test` includes real Postgres Testcontainers tests; Docker must be running. `make e2e` builds and starts Postgres, the actual Go API, and the production Bun server in Testcontainers. Playwright runs on the host, as in Temper. The stack uses a private network, random ports, fresh data and ephemeral signing keys; a build-time adapter replaces the external Clerk UI. It verifies generation, saved history, full-library search, retries, session isolation, data export, mobile/keyboard interactions, PDF output, API contracts, signed deletion webhooks, and proxy failure. It needs no real Clerk credentials. Real Clerk sign-up and production webhook delivery remain separate integration checks.

For a production-mode local preview, run these in separate terminals after `make check`:

```sh
make api
cd frontend && bun run start
```

The second command also serves on port 3100. Run `make db-up` and `make migrate` first. Run the API from `backend/`, or set `EXERCISE_DIR` to the catalogue’s absolute path. Deployment must include the `exercises/` directory beside the backend; it is not embedded in the binary.

The Bun server compresses built JavaScript and CSS once at startup and serves cached gzip variants to clients that accept them. Responses include `Vary: Accept-Encoding`; clients can still request uncompressed assets. Restart the production server after rebuilding assets.

## Design and architecture

- [Paper design system and desktop/mobile studies](https://app.paper.design/file/01M3TVV9XXTXF2N7ZD43K3WH3V)
- [Design decisions and Mobbin references](docs/design-system.md)
- [Accounts, sessions, and workout data model](docs/accounts-and-workouts.md)
- [Architecture](docs/architecture.md)
- [Engineering practices](docs/engineering-practices.md)
- [Implementation status](docs/implementation-plan.md)
- [Jukebox reference notes](docs/jukebox-backend-notes.md)
- [OpenAPI contract](api/openapi.json)

Go uses explicit constructor injection and layers for domains, services, repositories, handlers, and server setup. `services/workout` owns generation, `services/library` owns saved workouts, and `services/account` maps Clerk identities to internal users. Concrete stores live under `repositories/catalogue` and `repositories/postgres`. Frontend routes compose pages and components independently of the backend packages.

The generator retains the script’s difficulty-based time estimates, three body-area blocks, and repetition/interval prescriptions. It fixes the accepted level range, duration overshoot, duplicated exercise selection, and lost warm-up accounting. Times remain estimates. The existing exercise catalogue has been preserved; this pass does not reclassify its movements or provide demonstrations.

## Original Python script

`main.py`, the JSON exercise files, sample PDFs, and the original Make targets remain available. The Python path is separate from the web app:

```sh
python3 -m pip install -r requirements.txt
mkdir -p workouts
python3 main.py 45 2 0
```

This creates a workout PDF using the original algorithm. The existing `make workout` target also runs the original repository update script before generation.

The [design system](docs/design-system.md) documents the current typography, tokens, and shared controls.

### Architecture and verification

The UI primitive gallery is available at `/design-system` in development. Shared native controls, feedback, tokens and motion are documented in [the design system](docs/design-system.md). Library filters persist in the URL and search the full saved history. `/account` provides an authenticated JSON data export.

Run `make browsers` once, then `make e2e` with Docker running. The hermetic browser suite runs Postgres, the real Go API and the production frontend/proxy in containers on dynamic ports; it requires no Clerk credentials. Release builds use the actual Clerk SDK and reject fixture code. `make smoke` remains an alias for `make e2e`. See [the test harness](e2e/README.md), [the before/after report](docs/temper-improvements.md) and [deployment runbook](docs/deployment.md).
