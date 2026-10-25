# Endorphins

Before editing, read `docs/architecture.md` for ownership, `docs/engineering-practices.md` for workflow, and the `AGENTS.md` of each area you touch: `backend/`, `frontend/`, `e2e/`.

- Preserve the Python reference and `exercises/*.json`; the full-stack app lives in `frontend/` and `backend/`.
- Keep Go/Echo with manual constructor wiring and one package per service area. Keep TanStack Start/Router/Query, Clerk identity and Postgres application data.
- Start the app with `make dev`; in the desktop app, start the `endorphins` server from `.claude/launch.json`. It installs dependencies, pulls missing Clerk keys, starts Postgres and migrates. Get Clerk keys only through `clerk env pull`; `clerk init` rewrites app code. `make seed` gives local accounts a realistic history to verify against.
- Railway `production` and PR previews, reachable only over Tailscale, come from `.railway/railway.ts`. Before changing it or operating them, read `docs/preview-environments.md`. Apply only a plan you have read and the user has approved.
- Use `make check` for lint, boundaries, real-Postgres race tests, TypeScript and release builds. Use `make e2e` for product journeys. Install browsers once with `make browsers`. Docker must run. Make targets use nvm's `.nvmrc` Node when it is installed; outside Make, `node` must match `.nvmrc`.
- Test behavior in the owning packages and full-stack journeys.
- Put behavior in the module that owns it. Do not add wrappers, generic repositories, global service locators or duplicate UI test suites.
- Never edit generated route/API types; update inputs and run `cd frontend && bun run typegen`.
- Use GORM for application queries and fixtures. Raw SQL is a breakglass for what GORM cannot express. Before you add any raw SQL (a SQL string, `Raw`, `Exec`, `gorm.Expr` or `clause.Expr`, SQL in a model tag, or a `.sql` file), stop and flag it to the user with the reason.
- Update the relevant docs when architecture changes. `docs/history/` records past states; it is not current guidance.
