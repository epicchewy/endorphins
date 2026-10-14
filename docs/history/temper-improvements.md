# Temper-inspired improvements

This records the October 4, 2026 changes from the approved [comparison](temper-architecture-comparison.md). Endorphins keeps Go/Echo layers, manual constructors, TanStack and the Sharp Serif/Inter identity.

| Area | Before | After |
| --- | --- | --- |
| Frontend data | Mixed transport, repeated query keys, local filter state | Separate account/workout clients, safe HTTP transport, session-scoped keys, query hooks and validated URL state |
| Backend contracts | Concrete handler dependencies and shared transport/storage shapes | Handler-owned interfaces, resource DTOs, safe API errors and versioned storage snapshots |
| Saved library | Search, sorting and summaries used loaded pages | Owner-scoped SQL searches the full library, with stable pagination and summaries over all matches |
| Account lifecycle | Ambiguous retries could duplicate plans; no deletion receiver or export | Idempotent saves, verified deletion webhooks, atomic erasure with stale-session tombstones, and authenticated export |
| UI system | Large global stylesheet and bespoke controls | Shared Tailwind primitives, one theme stylesheet, common focus/motion rules and a development component gallery |
| Verification | Separate HTTP orchestration and shallow markup assertions | Desktop/mobile Playwright against the actual app stack; focused SQL, JWT, snapshot and cache tests |

The initial CSS split was replaced by the [Tailwind refinement](architecture-refinement.md). The initial browser fixture was replaced by the [test architecture refinement](test-architecture-refinement.md). Both application Dockerfiles now serve production and E2E builds.

Inspect `/design-system` in development for the implemented primitives. The [design system](../design-system.md) documents their contracts; the [Paper library](https://app.paper.design/file/01M3TVV9XXTXF2N7ZD43K3WH3V/p-3-0) holds the design studies.

Useful entry points:

- [Frontend session/cache tests](../../frontend/test/session-cache.test.ts)
- [Workout query tests](../../backend/internal/repositories/postgres/workouts_test.go)
- [Account lifecycle tests](../../backend/internal/repositories/postgres/users_test.go)
- [HTTP contract journeys](../../e2e/specs/contracts.spec.ts)
- [Browser harness](../../e2e/README.md)
- [Deployment runbook](../deployment.md)

Billing, cloud media storage, and timers are deferred. Hosted Clerk signup and external webhook delivery need separate provider checks.
