# Frontend

- Routes own URL state and guards; pages compose; hooks own Query behavior; services own transport and pure policies. Private keys come from `services/query-keys.ts` and include session identity.
- Merge URL edits with functional navigation updates; controls send changed fields only. Transient invalid input drafts stay local until valid.
- Capture the specific Clerk session for each request. Guard late mutation results against the live session. Clear/remount on session changes; never retain account exports in the cache.
- Use `components/ui` for buttons, labelled fields, feedback, loading/empty states and transitions. These primitives cannot import application services/hooks/routes. Only `ui/presence.tsx` imports Motion.
- Keep Sharp Serif/Inter. Define semantic Tailwind tokens, font loading, base rules, and keyframes in `app.css`. Put component styles and states in shared primitives with Tailwind utilities. Put layout and responsive/print variants beside the markup. Do not add page stylesheets or move old selectors into `@apply`. Preview variants at `/design-system` in development. Follow `docs/design-system.md`.
- Import Clerk through `auth/client.ts` or `auth/server.ts`. The test adapter is selected only by the explicit e2e build mode; `scripts/check-release.ts` rejects its presence in release bundles.
- Test user journeys in `../e2e`; retain focused policy tests for cache isolation, URL normalization and transport errors. Do not assert serialized HTML attribute order.
- Run typegen, typecheck and lint; verify UI changes in real browsers at desktop and mobile sizes, including reduced motion and keyboard use.
