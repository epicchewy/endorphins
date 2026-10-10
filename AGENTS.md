# Endorphins

Read `docs/architecture.md` for ownership, `docs/engineering-practices.md` for workflow, and the scoped instructions below before editing.

- Preserve the Python reference and `exercises/*.json`; the full-stack app lives in `frontend/` and `backend/`.
- Keep Go/Echo with manual constructor wiring and one package per service area. Keep TanStack Start/Router/Query, Clerk identity and Postgres application data.
- Use `make check` for lint, boundaries, real-Postgres race tests, TypeScript and release builds. Use `make e2e` for product journeys. Install browsers once with `make browsers`; Docker must run.
- Never add `main_test.go` files or tests for command entrypoints. Test behavior in the owning packages and full-stack journeys.
- Put behavior in the module that owns it. Do not add wrappers, generic repositories, global service locators or duplicate UI test suites.
- Never edit generated route/API types; update inputs and run `cd frontend && bun run typegen`.
- Add migrations; never rewrite applied SQL. Keep account ownership in every private query and stable application UUIDs in relationships.
- Never add foreign key constraints, including in rollback migrations. Enforce ownership, parent existence, and account cleanup in repository transactions. The removal of legacy foreign keys is the authorized exception to preserving applied SQL.
- Update the relevant docs when architecture changes.
