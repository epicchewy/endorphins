# Frontend

- Routes own URL state and guards. Pages compose the UI. Hooks own Query behavior; services own transport and pure policies. Private keys come from `services/query-keys.ts` and include session identity.
- Use reducers for local transitions, Query for remote state, and refs for retry keys. Use subscriptions or callback refs with cleanup for browser lifecycles. Lint rejects `useState` and `useEffect` across application code, scripts, and test adapters. Do not replace them with layout effects or global UI stores.
- Merge URL edits with functional navigation updates; controls send changed fields only. Transient invalid input drafts stay local until valid.
- Capture the specific Clerk session for each request. Guard late mutation results against the live session and location. Clear/remount on session changes; never retain account exports in the cache.
- Use `components/ui` for buttons, labelled fields, feedback, loading/empty states and transitions. These primitives cannot import application services/hooks/routes. Only `ui/presence.tsx` imports Motion.
- Follow `docs/design-system.md`. Keep Sharp Serif/Inter, global tokens and fonts in `app.css`, shared control styles in `components/ui`, and layout beside its markup. Use Tailwind utilities and responsive/print variants. Do not add page stylesheets or copy old selectors into `@apply`. Preview controls at `/design-system` in development.
- Import Clerk through `auth/client.ts` or `auth/server.ts`. The test adapter is selected only by the explicit e2e build mode; `scripts/check-release.ts` rejects its presence in release bundles.
- Test user journeys in `../e2e`; retain focused policy tests for cache isolation, URL normalization and transport errors. Do not assert serialized HTML attribute order.
- Run typegen, typecheck and lint. Lint includes the full React Doctor scan and fails on errors or warnings. Verify UI changes in real browsers at desktop and mobile sizes, including reduced motion and keyboard use.
