# Architecture refinement

This records the October 4, 2026 refinement of the Temper-inspired cleanup. Splitting CSS by page left styling outside Tailwind. Generic DTO and mapping files also put unrelated resources together.

| Area       | Before                                                                                   | After                                                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI styling | 14 application CSS files with 2,856 lines; React primitives mostly supplied class names. | One 175-line Tailwind entrypoint for theme, fonts, base rules, keyframes, and print setup. Shared React primitives own their styles and states. Page layout uses local utilities. |
| Config     | A flat config struct and manual environment parsing.                                     | `go-flags` groups for HTTP, Catalogue, Postgres, and Clerk. Owner packages define option tags and validation. The migration command loads only Postgres options.                  |
| API DTOs   | All resources in `api/v1/models.go`; conversions in `handlers/mapping.go`.               | `workout_requests.go`, `workout_responses.go`, and `account_responses.go` own their request/response types and conversions. `errors.go` owns the error envelope.                  |
| Handlers   | Transport code also assembled nested response objects.                                   | Decode HTTP input, call a service, set status/headers, return `New…Response`. `POST /api/v1/workouts` calls `Create`; resource paths and JSON stay the same.                      |

## Ownership

```text
backend/internal/
  config/                     # Compose tagged options and parse each command
  integrations/clerk/options.go
  repositories/catalogue/options.go
  repositories/postgres/options.go
  api/v1/
    workout_requests.go       # Create/list/filter DTOs and ToInput
    workout_responses.go      # Workout/page/summary DTOs and constructors
    account_responses.go      # User/export DTOs and constructors
    errors.go                 # Public error envelope
  handlers/                   # HTTP orchestration
  services/                   # Use cases and consumer-owned interfaces
  domains/                    # Business values and rules
  repositories/postgres/      # SQL, migrations, versioned stored snapshots

frontend/app/
  app.css                     # Tailwind theme and global browser concerns
  components/ui/              # Shared utility-styled primitives
  components/workout/         # Workout views and their local layout
  pages/, routes/             # Page composition and URL state
```

API DTOs own transport mapping. The domain remains independent of HTTP, config, and storage. Services own use cases. API DTOs translate inward to service inputs and outward from domain results. Stored workout snapshots retain their own versioned codec.

These patterns follow Temper’s `backend/pkg/config/config.go`, owner `Opts` structs, and resource DTOs such as `deployment_responses.go` and `demand_requests.go`. Endorphins keeps its application-private code under `internal`.

## Config use

Environment variable names are unchanged. CLI options override environment values; environment values override tag defaults. Use environment variables for credentials. Run `go run ./cmd/api --help` or `go run ./cmd/migrate --help` from `backend` to inspect options without connecting to services. Help exits with code 0; invalid config exits with code 2. Commands own output and process exit; the config library does not call `os.Exit`.

## Verification

- `make check` passed: Go/frontend lint, import rules, formatting, real-Postgres race tests, 20 focused frontend tests, generated API types, TypeScript, release builds, and release identity isolation.
- `make e2e` at the time: 27 passed, 5 skipped. Skips are three viewport-independent HTTP checks, desktop-only PDF output, and pointer hover feedback on mobile. The full run uses disposable Postgres and the real API/proxy; only the external Clerk identity adapter is replaced.
- Checked desktop/mobile screenshots, nested light/dark controls, link hover/press, keyboard navigation, and a rendered PDF page. Screenshot capture finishes animations to avoid partial arrival frames.
- The restarted local API returned HTTP 200 from `/readyz`.

Authored frontend application code changed from 5,399 to 3,204 lines across TS, TSX, and CSS under `frontend/app`, excluding generated files. CSS alone changed from 2,856 to 175 lines. These source counts do not measure bundle size or performance.

Inspect the current primitives in the development-only `/design-system` gallery. Their contracts are documented in [the design system](../design-system.md).

The Tailwind setup follows the official [theme variable guidance](https://tailwindcss.com/docs/theme). Shared primitive overrides use [tailwind-merge](https://github.com/dcastil/tailwind-merge).
