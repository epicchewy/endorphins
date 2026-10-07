# First-pass implementation status

This records the first pass on October 1, 2026: a mobile workout generator based on the Python script, followed by Clerk accounts and Postgres history. See [architecture](architecture.md) for the current app and [the October 5 review](signup-onboarding-review-2026-10-05.md) for the signup redesign.

## Delivered

- TanStack Start/Router/Query frontend using Postmaker migration conventions.
- Initial visual system: Instrument Serif, Manrope, plaster, ink, and sage. Later design work replaced it with Sharp Serif/Inter and orange; see [the design system](design-system.md).
- Mobbin references reviewed; design tokens, foundations, desktop builder, and mobile builder saved and iterated in Paper.
- Responsive duration/level controls, actual generated plan, shuffle, notes, loading/error states, and print styling.
- Go 1.27.1 / Echo v5 API with explicit startup wiring and conventional layers.
- Validated filesystem catalogue repository using the original five exercise files.
- Generation preserves three body areas and prescriptions, with corrected budget, warm-up, and duplicate-selection behavior.
- OpenAPI contract and generated frontend types.
- Development entry point, production server, layer checks, lint, race tests, render/client tests, and CI workflow.
- Clerk CLI setup, Start middleware/provider, sign-in/sign-up, and account controls.
- Postgres users and immutable, owner-scoped workout snapshots with versioned migrations.
- Workout journal and saved-plan detail pages, session-scoped caches, and account data documentation.
- Real-query Testcontainers tests and signed-JWT authentication tests.

## Validation

`make check` and `make smoke` passed on October 1, 2026. Checks covered Go lint and race tests (including the real catalogue), frontend client/render/session tests, strict TypeScript, generated API types, both production builds, and production HTTP integration. The October 1 smoke test verified 15 authenticated generations through the production proxy, real Postgres history, owner isolation, OpenAPI response shapes, auth pages, SSR, assets, errors, and API unavailability. Clerk doctor confirmed that the CLI is authenticated and linked to the development app; local migrations and development servers ran. Interactive signup still needed a human check. The development lifecycle was also checked: both servers start and stop together.

The Paper mobile design was visually checked and its controls resized to fit. Browser access to the local app was denied by the browser approval policy during implementation, so browser interaction, viewport, keyboard, and print-dialog checks were not run. Code and HTTP checks are independent of that limitation.

## Limits at the time

- Clerk account deletion was not yet synchronized to application-data deletion; see the account lifecycle notes.
- No billing, Backblaze, offline mode, or deployment.
- No media demonstrations or clinical review of catalogue difficulty labels.
- No timer or in-workout progress tracking.

## Proposed next steps

The proposed next steps were to try the app on a phone and choose equipment, space, or movement limits. The October 5 flow now uses floor/wall exercises and an optional exercise view. Guided timers remain deferred.
