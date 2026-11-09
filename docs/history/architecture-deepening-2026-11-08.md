# Architecture deepening

This records the November 8, 2026 review of `frontend/` and `backend/` for deep modules: a small interface over much behavior, tested through that interface. Each candidate had to pass the deletion test. If you delete a module and its complexity reappears in its callers, the module earns its place.

## Changes

| Area | Before | After |
| --- | --- | --- |
| Saved-plan queries | `GET /workouts` accepted `q`, `level` and `sort`; the summary returned planned and average minutes and a level breakdown. A `workout_search_terms` table, an `estimated_minutes` column and its sort index supported them. PR #15 removed every caller. | `List` takes an owner, cursor and limit. `/workouts/summary` returns `{count}`. `postgres.Migrate` drops the table and column. |
| Activity calendar | Monday weeks, the padded UTC window, local dates and skipped-midnight handling lived inside a Postgres transaction. Only Testcontainers tests reached them. The service loaded the time zone and the store loaded it again. | `domains.ActivityCalendar` has `Window` and `Fold`, with pure tests. The store reads facts in one snapshot. The service passes the loaded `*time.Location`. |
| Error copy | `server/errors.go` and the frontend's `errorMessage` both mapped codes to copy. The frontend ignored the server message, and its copy had drifted to name a finish screen and filters that no longer exist. | The Go map owns copy for request errors. `services/http.ts` shows a 4xx envelope's message and keeps generic copy for no session, no connection, and server or upstream failures. |
| Query policy | Five queries repeated `retry: retryAccountQuery`; five mutations repeated `retry: false` and `networkMode: 'always'`. | The per-router `QueryClient` sets both defaults. Hooks set keys, functions and stale times. |

Together the changes remove about 250 net lines of code and tests.

## Rollout

The migration drops a table and a column that the previous API still writes. Railway runs `/app/migrate` before the new API is ready, and the old API keeps serving until then. In that interval, workout generation and the library count fail with a server error, and a retry succeeds when the new API is live. The previous binary cannot run against the new schema, so a rollback needs a forward fix.

## Considered and kept

- **Validation in services and repositories.** Seed and test fixtures call repositories directly, so repository checks guard invariants. Go cannot enforce value types, so one shared parser would add an interface without removing a check.
- **Setup shared by `app.Run` and `app.Seed`.** About ten lines open the catalogue and database. A helper would save little and hide the two lifecycles.
- **Splitting `services/library`.** Saved plans and completions share one store and owner checks. A second package would add wiring and no depth.
- **Thin transport functions in `services/`.** Each is one URL and method, but together they are the typed seam that the transport tests use. The layering rules keep HTTP out of hooks.
- **Moving navigation into `useGenerateWorkout`.** Routes own navigation.

## Verification

`make check`, `make migration-check` from `c0688db`, and `make e2e` passed.
