# Endorphins frontend review — October 1, 2026

All six findings were fixed on October 1, 2026. This record retains the original evidence and line references. Colors, test totals, and access limits describe that version. See [the October 5 review](signup-onboarding-review-2026-10-05.md) for current results.

| Finding | Resolution |
| --- | --- |
| Offline pending state | Generation uses `networkMode: 'always'`, allowing the existing fetch timeout and connection-error path to run. No automatic retry was added. |
| Failed-shuffle feedback | The retained sheet shows the error beside Shuffle and identifies it through `aria-describedby`. The message explains that the previous workout is unchanged. The builder remains the single error-announcement owner. A shared status component outside the busy result region announces success only when the current mutation succeeds. |
| Selected-level contrast | Selected levels use green ink with white text and a checkmark. Calculated contrast is 11.42:1. Native radio semantics and focus treatment remain intact. |
| Uncompressed assets | The Bun server caches gzip versions of built JavaScript/CSS at startup. It negotiates encoding preferences, sends `Vary: Accept-Encoding`, preserves content types/cache headers, and supports matching HEAD metadata. The largest initial asset now transfers 117,256 bytes instead of 368,498 bytes, 68% smaller. |
| Home-logo reload | The brand uses TanStack `Link` for navigation. |
| Broad CSS transition | Radio controls transition only background color, border color, and text color. |

Post-fix verification: `make check` passed, including eight frontend tests with 39 assertions, and `make smoke` passed. New regressions exercise offline failure/retry and pending, failed, recovered, and reset status with an existing workout. HTTP smoke coverage now verifies gzip round-trips, preference weights, explicit exclusions, wildcard negotiation, identity fallback, cache headers, and HEAD responses. No dependencies were added. Browser, device, and print checks were not run because browser access was restricted.

The source review found no critical or high-severity issue. It identified failures in offline requests, shuffle feedback, selection contrast, navigation, and asset delivery. It did not include browser or screen-reader checks.

The initial review read the working tree, including uncommitted implementation files: routes, page composition, components, hooks, API client, styles, generated contract, Vite configuration, Bun server, tests, and the documented design system. The initial review changed no application code.

## Original findings

1. **P2 — Offline generation can leave all generation controls disabled indefinitely.** [use-generate-workout.ts:4](/Users/lchui/.codex/worktrees/3ae1/endorphins/frontend/app/hooks/use-generate-workout.ts:4) uses the default mutation network mode. After TanStack observes an offline event, a new mutation pauses before invoking the fetch function. The page treats `isPending` as active work and disables both fieldsets, Generate, and Shuffle. Consequently, the timeout inside `generateWorkout` never starts. An isolated probe using the installed Query implementation and actual API helper still reported `status: pending`, `isPaused: true`, and zero fetch calls after 16 seconds. Restoring online state resumed the mutation and produced the expected network error. Handle the paused state explicitly, or use `networkMode: 'always'` so the request can fail through the existing error path. This does not require implementing offline workout generation. [TanStack network-mode documentation](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode).

2. **P2 — A failed shuffle returns the result status to “Your workout is ready.”** [workout-page.tsx:96](/Users/lchui/.codex/worktrees/3ae1/endorphins/frontend/app/pages/workout-page.tsx:96) checks pending state and the existence of the previous workout, but never checks mutation failure. After a successful generation followed by a failed shuffle, the old plan remains and the live status returns to success wording. The actual error is rendered only in the builder above the results; the successful mobile flow has already scrolled the reader to the result column. Render the failure near the Shuffle action and make the live status distinguish an unchanged previous plan from a newly generated plan. Evidence is the source control flow; actual screen-reader announcement order was not tested.

3. **P2 — The selected level has insufficient visual contrast.** [app.css:357](/Users/lchui/.codex/worktrees/3ae1/endorphins/frontend/app/app.css:357) indicates selection with a pale border and fill while the native radio is fully transparent. The selected border `#9DAE98` measures 2.349:1 against the surrounding white and 1.972:1 against its fill; the sage fill is only 1.191:1 against white. There is no checkmark or other distinct high-contrast selection indicator. Add a dark checked marker or a sufficiently contrasting selected treatment. The required contrast for visual information identifying control states is 3:1. Native checked semantics already exist and should be retained. [WCAG 2.2 non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

4. **P2 before public use of the standalone server — Static JavaScript is delivered uncompressed.** [server.ts:38](/Users/lchui/.codex/worktrees/3ae1/endorphins/frontend/server.ts:38) serves the raw asset. Against the built production preview, requests advertising `Accept-Encoding: gzip, br` received no `Content-Encoding`. The main bundle transferred 368,485 bytes; compressing those same bytes with gzip produced 115,739 bytes, about 69% less. The route bundle transferred 23,964 bytes versus 8,341 bytes gzipped. Configure compression at the serving layer or a documented reverse proxy/CDN, then verify the actual public response. This finding applies to the included Bun serving path; it makes no claim about an uninspected future hosting platform.

5. **P3 — The home logo reloads the document and discards the current plan.** [brand.tsx:16](/Users/lchui/.codex/worktrees/3ae1/endorphins/frontend/app/components/brand.tsx:16) uses a plain link to `/`. Clicking it while already on the workout page performs document navigation, resetting the page's in-memory workout and preferences. Use a TanStack `Link` for app navigation. This is a small navigation fix within the current ephemeral-session scope, not a request for accounts or persistent history.

6. **P3 — Narrow the radio control transition properties.** [app.css:248](/Users/lchui/.codex/worktrees/3ae1/endorphins/frontend/app/app.css:248) uses `transition: all`. Specify the intended color, border, and background properties so future layout changes do not animate unintentionally. No current layout-jank measurement is claimed. This is a direct rule from the current [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).

## Review scope

I used the listed skills for source review and ran the checks below.

| Skill | Scope applied and result |
| --- | --- |
| `vercel-react-best-practices` | Reviewed waterfalls, bundle imports/splitting, SSR state isolation, render-time work, effects, listeners, hydration, and resource loading. Asset compression is the measurable delivery issue above. No evidence warrants a memoization or state-library refactor. |
| `vercel-composition-patterns` | Reviewed component responsibilities, state ownership, boolean modes, composition, and React 19 usage. The page is a reasonable shared owner for builder/result state; pending flags do not justify introducing compound components or context. |
| `web-design-guidelines` | Fetched the current Vercel checklist and reviewed semantics, labels, keyboard/focus CSS, errors, selected states, motion, forms, responsive rules, and navigation. Findings 2, 3, 5, and 6. |
| `frontend-design` | Compared the implementation against the documented training-journal direction, audience, typography, hierarchy, copy, and interaction purpose. Preserve the established design; strengthen functional states. Visual rendering remains unverified. |
| `tailwind-design-system` | Reviewed Tailwind v4 configuration, semantic tokens, component states, responsive layout, and accessibility. The CSS-first setup is correct; selected-state contrast needs improvement. |
| `postmaker-tanstack` | Applied the transferable architecture and query/form guidance requested earlier: routes compose pages, HTTP lives in services, hooks own mutations, and Go owns generation. Postmaker-specific persistence and form-library requirements were not imposed on this two-field MVP. |
| `postmaker-ui` — source-review portion | Applied transferable token, native-control, focus, pending/error, mobile, and motion checks. Preserved Endorphins' own design rather than imposing Graphite styling. The required rendered-interaction checks remain unrun. |
| `start-core` | Checked Vite plugin order, router factory, document shell, metadata, generated routes, TypeScript configuration, and SSR entry behavior. No additional defect found. |
| `execution-model` | Checked browser APIs, secrets/config, server-only entry code, and relative API requests. Browser APIs occur in events/effects; no relative self-fetch occurs during SSR. |
| `deployment` | Reviewed the existing Bun/React 19 serving path, SSR/static assets, proxy, cache headers, and metadata. Finding 4. No deployment was performed. |
| `router-core` | Checked route construction, context, registration, and ownership. No additional defect found. |
| `router-query` | Checked per-router QueryClient creation, SSR integration, preload freshness, and mutation behavior. Integration is sound; finding 1 concerns the mutation's offline state. |
| `navigation` | Checked anchors, application links, scroll restoration, and ephemeral page state. Finding 5. |
| `code-splitting` | Checked route exports, imports, and actual build output. A separate route chunk is emitted. No heavy feature requires extra lazy wrappers. |
| `type-safety` | Checked Router registration, inference, casts, generated API types, and real HTTP contract checks. Current Go responses pass runtime contract validation. The browser helper trusts successful JSON; runtime response validation remains a resilience improvement, not an observed current contract failure. |
| `not-found-and-errors` | Checked root 404/error fallbacks and mutation failure paths. Finding 2. No loaders exist that would require replacing `reset()` with loader invalidation. |

The applicable TanStack guidance was compared with the skills shipped in `node_modules`; the compared portable and installed guidance differed in metadata formatting, not implementation rules. Installed types, successful production builds, and runtime probes provided the compatibility evidence.

## Skills screened for use

- `vercel-optimize`: no Vercel production metrics audit was run. This project currently documents a Bun serving path, and no intended Vercel project or production telemetry was established. Its [SKILL.md](/Users/lchui/.agents/skills/vercel-optimize/SKILL.md) explicitly says, “Recommendations start from Vercel production signals, not repo-wide grep.” The local performance findings above come from the React/code review and direct HTTP measurements, not that metrics workflow.
- `vercel-react-view-transitions`: screened; the app uses CSS transitions and does not use React's ViewTransition API. No migration or React release-channel change is warranted for this review.
- `vercel-react-native-skills`: not applicable to this web app; mobile web was reviewed under the web/UX guidance.
- `design-taste-frontend`: screened, not applied as a full audit. Its [SKILL.md](/Users/lchui/.codex/skills/design-taste-frontend/SKILL.md) scopes itself to “Landing pages, portfolios, and redesigns.” This request concerns a working workout generator, and its marketing-layout prescriptions should not replace the established product design.
- TanStack auth, dynamic/search parameters, server functions, middleware, tables, virtualization, and hotkeys: these features are absent. Loader-specific caching and standalone Router SSR setup were not separate audits; the actual Start SSR/Query integration was reviewed above. shadcn/Base UI migration and Vercel deployment tools do not apply to the existing native-control implementation or this review request.

## Original verification

- `make check` passed: backend layer check, formatting, Go lint, Go race/integration test command, frontend lint/format checks, six frontend tests with 19 assertions, generated API/route types, TypeScript, and both production builds. Go reported cached successes. Route generation emitted a non-blocking circular-dependency warning about `replaceRouteChunk`; generation and compilation completed successfully.
- `make smoke` passed against production builds: SSR, static assets, 15 real-catalogue generation requests, OpenAPI response validation, API errors, proxy failure, and static path isolation.
- An isolated 16-second TanStack offline probe reproduced finding 1 and verified resumption into the expected network-error path.
- CSS contrast calculations reproduced finding 3. The regular muted text on sage measured 4.582:1; the focus ring on white measured 3.832:1.
- Production HTTP probes measured raw/gzipped asset sizes and response headers. The temporary production server was stopped afterward.
- The existing development UI at `http://127.0.0.1:3100/` and API health endpoint on port 8088 both returned HTTP 200.

## Limits at the time

Browser access was previously declined, so no browser automation, screenshots, Lighthouse, measured Core Web Vitals, screen-reader pass, responsive rendering check, or print/PDF inspection was performed. The [Postmaker UI skill](/Users/lchui/.codex/skills/postmaker-ui/SKILL.md) states, “Class assertions cannot verify rendered geometry.” Source-level mobile and focus checks therefore cannot establish that the app renders and behaves correctly on a device. Those checks still needed browser access at the time.

The existing automated tests exercise server rendering and the fetch helper, but do not cover the actual interactive offline/shuffle/error flow. Add focused behavior coverage when fixing those findings. The review did not audit all Go business rules or security behavior.
