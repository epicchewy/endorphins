<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `bunx --no-install --package @tanstack/intent intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `bunx --no-install --package @tanstack/intent intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# Frontend

- Routes own URL state and guards. Pages compose the UI. Hooks own Query behavior; services own transport and pure policies. Private keys come from `services/query-keys.ts` and include session identity.
- Use `useState` for independent local values, reducers for related draft fields, Query for remote state, and refs for retry keys. Use subscriptions or callback refs with cleanup for browser lifecycles. Lint rejects `useEffect` across application code, scripts, and test adapters. Do not replace them with layout effects or global UI stores.
- Merge URL edits with functional navigation updates; controls send changed fields only. Transient invalid input drafts stay local until valid.
- Capture the specific Clerk session for each request. Guard late mutation results against the live session and location. Clear/remount on session changes; never retain account exports in the cache.
- Use `components/ui` for buttons, labelled fields, feedback and loading/empty states. Add shadcn components with `npx shadcn@latest add` and follow the steps in `docs/design-system.md`; restyle through theme tokens, not page overrides. These primitives cannot import application services/hooks/routes. Hover changes color only; do not add movement or bespoke animation.
- Follow `docs/design-system.md`. Keep Sharp Serif/Inter, global tokens and fonts in `app.css`, shared control styles in `components/ui`, and layout beside its markup. Use Tailwind utilities and responsive/print variants. Do not add page stylesheets or copy old selectors into `@apply`. Preview controls at `/design-system` in development.
- Sentry starts only in `router.tsx` (browser), `server.ts` (Bun SSR) and `start.ts` (global middleware), and stays off without `VITE_SENTRY_DSN`. Keep `sendDefaultPii` off; never attach request bodies, tokens or account data. Report expected API errors in the UI, not to Sentry.
- Import Clerk through `auth/client.ts` or `auth/server.ts`. The test adapter is selected only by the explicit e2e build mode; `scripts/check-release.ts` rejects its presence in release bundles.
- Test user journeys in `../e2e`; retain focused policy tests for cache isolation, URL normalization and transport errors. Do not assert serialized HTML attribute order.
- Run typegen, typecheck and lint. Lint includes the full React Doctor scan and fails on errors or warnings. Verify UI changes in real browsers at desktop and mobile sizes, including reduced motion and keyboard use.
