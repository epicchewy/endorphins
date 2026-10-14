# Endorphins

Home workouts built with TanStack Start, React, and Go/Echo. Choose 30–120 minutes and one of five levels. New plans need only floor space and a wall.

The landing page is `/`; the signed-in app is `/app`. Signup leads through a welcome, default level choice, and workout setup. Plans save to Postgres. You can search, follow, shuffle, and print them. After you work out, confirm completion to update your dashboard. It shows completed workouts, active days, four weeks of activity, and milestones. Light, dark, and system themes are available. Billing and cloud media storage are deferred.

## Run locally

Prerequisites: Docker (running), Node.js 26.10.0 (`nvm use`), Bun 1.4.2, Python 3 for repository checks, and Go with automatic toolchain downloads enabled. The backend and Go linter use Go 1.27.1 without changing your global Go installation.

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

Select **Get started** to create your first app account. Signing in to the Clerk CLI only authenticates the CLI; it does not sign you into Endorphins. Your account menu provides profile and sign-out controls, and **Saved workouts** reopens saved plans. After working out, use **I finished** and confirm completion. A repeat of the same plan counts as another workout.

### Codex local environment

The checked-in [Codex environment](.codex/environments/environment.toml) installs Go/Bun dependencies and Playwright Chromium when Codex sets up a new worktree. Its toolbar actions call the root Make targets: **Run app**, **API**, **Frontend**, **Start Postgres**, **Migrate**, **Stop Postgres**, **Check**, and **E2E**.

Actions that need Node use `npx` to select the version in `.nvmrc`. This caches the project version without changing your global Node default. npm/npx, Bun, Go, Python 3, and Docker must already be installed; Docker must run for the app and database tests.

Complete the Clerk CLI setup above in each new checkout before starting the app. Keys stay in ignored `frontend/.env.local`; setup does not copy credentials or start services. **Run app** uses ports 3100, 8088, and 5548, so run one local development stack at a time. **E2E** uses disposable services on random ports and needs no Clerk credentials.

## Verify and build

```sh
make check       # formatting, boundaries, lint, React Doctor, race and frontend tests,
                 # API types, TypeScript, and both production builds
make browsers    # install pinned Chromium once
make e2e         # hermetic desktop/mobile browser tests on dynamic ports
make format      # apply Go and frontend formatting
cd frontend && bun run doctor # full React Doctor scan; errors and warnings fail
```

`make test` runs real Postgres tests and needs Docker. `make e2e` runs desktop/mobile journeys against disposable Postgres, Go API, and Bun frontend containers. Only the external Clerk UI/session adapter is replaced. Real Clerk signup and webhook delivery need separate integration checks. See [browser tests and artifacts](e2e/README.md). `make smoke` is an alias for `make e2e`. Do not run a frontend build while E2E images are building; both use `frontend/build`.

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
- [OpenAPI contract](api/openapi.json)
- [Deployment runbook](docs/deployment.md)
- [History: dated reviews, research, and decision records](docs/history/)

Open `/design-system` in development to inspect the shared controls. `/app/account` provides an authenticated JSON data export.

Go uses explicit constructor injection and layers for domains, services, repositories, handlers, and server setup. `services/workout` owns generation, `services/library` owns saved workouts, and `services/account` maps Clerk identities to internal users. Concrete stores live under `repositories/catalogue` and `repositories/postgres`. Frontend routes compose pages and components independently of the backend packages.

The generator retains the script’s difficulty-based time estimates, three body-area blocks, and repetition/interval prescriptions. It fixes the level range, duration overshoot, duplicate choices, and lost warm-up time. The Go catalogue filters out weights, chair dips, and handstands at levels 1–2. It leaves the original exercise files intact. Times remain estimates; exercise demonstrations are not included.

## Original Python script

`main.py`, the JSON exercise files, sample PDFs, and the original Make targets remain available. The Python path is separate from the web app:

```sh
python3 -m pip install -r requirements.txt
mkdir -p workouts
python3 main.py 45 2 0
```

This creates a workout PDF using the original algorithm. The existing `make workout` target also runs the original repository update script before generation.
