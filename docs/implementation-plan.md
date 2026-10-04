# First-pass implementation status

Updated October 1, 2026. The user narrowed this pass to a polished mobile-friendly workout generator based on the Python script. The follow-up adds Clerk accounts and Postgres workout history. Billing, media storage, and offline-player milestones remain deferred.

## Delivered

- TanStack Start/Router/Query frontend using Postmaker migration conventions.
- Independent Endorphins visual system: Instrument Serif, Manrope, plaster, ink, and sage.
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

`make check` and `make smoke` passed on October 1, 2026. Checks covered Go lint and race tests (including the real catalogue), frontend client/render/session tests, strict TypeScript, generated API types, both production builds, and production HTTP integration. The current smoke test verifies 15 authenticated generations through the production proxy, real Postgres history, owner isolation, OpenAPI response shapes, auth pages, SSR, assets, errors, and API unavailability. Clerk doctor confirmed that the CLI is authenticated and linked to the development app; the local database migrations and development servers are running. Interactive signup is awaiting the first human check. The development lifecycle was also checked: both servers start and stop together.

The Paper mobile design was visually checked and its controls resized to fit. Browser access to the local app was denied by the browser approval policy during implementation, so actual browser interaction, viewport, keyboard, and print-dialog QA are not recorded as passed. Code and HTTP checks are independent of that limitation.

## Deliberate limits

- Clerk account deletion is not yet synchronized to application-data deletion; see the account lifecycle notes.
- No billing, Backblaze, offline mode, or deployment.
- No media demonstrations or clinical review of catalogue difficulty labels.
- No timer or in-workout progress tracking.

## Next product decisions

Try the generator on a real phone, review the existing exercise descriptions and levels, and decide which constraint matters most next: equipment, available space, or movement exclusions. Add a guided player only after the catalogue and generation experience are agreed.
