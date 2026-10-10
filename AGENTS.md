# Endorphins

Before editing, read `docs/architecture.md` for ownership, `docs/engineering-practices.md` for workflow, and the `AGENTS.md` of each area you touch: `backend/`, `frontend/`, `e2e/`.

- Preserve the Python reference and `exercises/*.json`; the full-stack app lives in `frontend/` and `backend/`.
- Keep Go/Echo with manual constructor wiring and one package per service area. Keep TanStack Start/Router/Query, Clerk identity and Postgres application data.
- Use `make check` for lint, boundaries, real-Postgres race tests, TypeScript and release builds. Use `make e2e` for product journeys. Install browsers once with `make browsers`. Docker must run, and `node` must match `.nvmrc`.
- Test behavior in the owning packages and full-stack journeys.
- Put behavior in the module that owns it. Do not add wrappers, generic repositories, global service locators or duplicate UI test suites.
- Never edit generated route/API types; update inputs and run `cd frontend && bun run typegen`.
- Update the relevant docs when architecture changes. `docs/history/` records past states; it is not current guidance.
