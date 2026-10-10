# Signup, onboarding, and workout flow review

Reviewed on October 5, 2026, on `codex/signup-onboarding-dashboard`. The branch was rebased onto `origin/master` at `5daa827`. The remote default branch is `master`.

## Implemented flow

The public landing page stays at `/`. The private app starts at `/app`, with its own navigation and layout. New accounts see a home workout welcome, choose a default level, and open workout setup. The five levels are Light, Steady, Lively, Tough, and Fiery. New plans use floor and wall exercises. The original exercise files and Python reference are unchanged.

Generation saves a plan. It does not count a completed workout. A saved plan has an optional exercise view and a separate finish route. Each confirmed workout adds a completion record. Retrying the same confirmation adds no extra record. A new confirmation can record another workout with the same plan. Undo removes that event from activity totals and keeps the plan.

The dashboard has three states: no plans, a saved plan with no completed workouts, and completed activity. Completed activity shows the total, active days this week, four Monday-start weeks, five recent workouts, and milestones at 1, 5, 10, 25, and 50. The library reports generated plans separately. Confirmation time is not a measured workout duration.

## Review and fixes

The design review used `design-taste-frontend` for the landing page, `frontend-design` for app views, and `web-design-guidelines` for interaction and accessibility. `vercel-react-best-practices` covered requests, caching, code loading, and assets. `vercel-composition-patterns` covered state and action composition. `ponytail` kept native controls and existing modules; `imagegen` created the two local photos. No runtime dependencies were added.

The landing design uses Sharp Serif, Inter, orange, and cool neutrals. Its design dials are variance 6, motion 3, and density 3. The dashboard uses its own product layout.

Source review followed the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Browser checks covered desktop, mobile, keyboard use, motion, themes, and print. Automated accessibility scores do not replace a screen-reader review.

Mobbin references: [Runna activity](https://mobbin.com/screens/17c9ee53-dcd9-4985-8540-63070c9787f2), [Hevy weekly activity](https://mobbin.com/screens/79a622bd-392f-4ab4-9eb7-18e3a85fcc5c), and [Withings progress](https://mobbin.com/screens/4f910ac9-dadf-443e-a79c-9bfc293ee5af).

Resolved findings:

- Database: migrations 1 and 3 create no foreign keys. Migration 4 removes legacy constraints without restoring them on rollback. Child writes lock the owner with `FOR KEY SHARE`; erasure uses `FOR UPDATE` and explicit deletes. Real Postgres tests cover upgrades without data loss, concurrent writes, stale sessions, and rollback after a failed user delete. Primary keys, unique retry keys, checks, and indexes remain. Legacy foreign keys exist only in upgrade-test setup.
- Landing/onboarding: home photos and direct copy replace gym cues and repeated features. The landing has one signup CTA. Welcome keeps copy and the next action together on mobile. Step changes focus the new heading.
- Setup/plan: URL edits merge field patches. The builder has one setup form with native duration validation. The plan and exercise view share a completion link. Workout headings use the correct hierarchy; decorative icons are hidden from assistive tools.
- Dashboard/account: fetch one latest plan with a page-size-aware key. Give completed activity priority, show zero chart counts without filled tracks, and announce reached milestones. The markers fit at 320px. A native route blocker protects unsaved level edits.
- Delivery/theme: preload the correct Inter file. Responsive WebP assets use Vite fingerprints and one-year cache lifetimes. Saved-plan rows defer off-screen rendering. The saved theme applies before first paint; React owns one theme-color tag and follows system changes.
- Deployment: readiness requires schema 4. Stop cascade-dependent binaries before migration 4, then run the matching cleanup code.

## Quality follow-up

A second pass used `thermo-nuclear-code-quality-review`, `codebase-design`, `deslop`, the React/composition skills, and `no-ai-slop`.

- One completion hook now owns confirmation, Undo, retry keys, and recovery. The page no longer coordinates two mutations. A saved completion appears before analytics refresh; stale totals stay hidden during that refresh.
- Onboarding redirects from the saved account state. It no longer repeats session guards and navigation in the save callback. The app-entry guard still runs after navigation commits, which preserves return URLs and workout settings.
- Milestones have one list. Generation and completion share retry-key validation. Completion saving reads plan metadata in the same SQL statement as the write.
- `e2e/harness/page-audits.ts` owns the audit browser, process, and temporary profile cleanup. The journey spec focuses on product behavior.
- All 20 repository Markdown files were reviewed and edited. Repeated setup, ownership, and verification sections were removed. Current route and catalogue descriptions were corrected. Historical reports identify their dates and point to current docs; research prices, evidence, and limits remain dated to September 30.

No authored Go, TypeScript, CSS, or SQL file reaches 1,000 lines. The 1,055-line API type file is generated from OpenAPI; splitting that output would add manual upkeep.

## Verification and recordings

- `make check` passed. This includes both Go lint modes, layer checks, race/integration tests with real Postgres, frontend lint and formatting, 21 frontend tests with 81 assertions, both TypeScript checks, type generation, and release builds. The release identity check passed for 84 bundles.
- `E2E_AUDIT=1 make e2e` passed: 40 tests and 6 intentional mobile skips. The skips cover duplicate API contracts, pointer hover, and print checks. Those checks run in the desktop project.
- Browser coverage includes slow/failed analytics, signup, onboarding, default level persistence, saved plans, exercise view, finish, repeat workouts, Undo, lost responses, account switching, query errors, external-return rejection, exports, library filters, keyboard radios, unsaved changes, dark theme reload, reduced motion, 320px overflow checks, and print/PDF behavior.
- `git diff --check` passed. The exercise catalogue files and Python reference have no changes.

The recordings use real Postgres, Go API/JWT verification, and the Bun frontend/proxy in disposable containers. The external Clerk UI/session adapter uses a signed test identity. Actual Clerk signup and profile UI were not tested.

Desktop (1440 × 1000) and mobile (390 × 844) videos show signup through completion, repeat use, and Undo in about 30 seconds. Still captures include every flow state and dark layouts. MP4 frames were inspected.

- [Desktop walkthrough](../output/playwright/redesign/e2e-desktop.mp4)
- [Mobile walkthrough](../output/playwright/redesign/e2e-mobile.mp4)
- [Desktop landing](../output/playwright/redesign/landing-desktop.png)
- [Mobile welcome](../output/playwright/redesign/welcome-mobile.png)
- [Returning dashboard](../output/playwright/redesign/dashboard-returning-desktop.png)
- [Dark landing](../output/playwright/redesign/landing-dark-desktop.png)
- [Dark setup at 320px](../output/playwright/redesign/setup-dark-320-mobile.png)

These captures record the October 5 review. The October 9 cleanup removed review recording and optional Lighthouse scripts. `make e2e` keeps screenshots, traces, and videos for failed tests.

## Lighthouse results

Lighthouse 13.5.0 ran against the local stack on October 5. Both audits use its mobile simulation. The browser cache is cleared before each audit; only the dashboard's test-session cookie is retained. The final dashboard URL and screenshot confirm the authenticated view. Dashboard SEO is excluded because private routes use `noindex`.

| Page      | Performance | Accessibility | Best practices | SEO | FCP   | LCP   | CLS    | Blocking time |
| --------- | ----------- | ------------- | -------------- | --- | ----- | ----- | ------ | ------------- |
| Landing   | 89          | 100           | 100            | 100 | 2.4 s | 3.4 s | 0.0003 | 0 ms          |
| Dashboard | 88          | 100           | 100            | N/A | 2.3 s | 3.5 s | 0      | 0 ms          |

The first landing audit scored 75 with a 5.8 s LCP. Correct font preloads and responsive WebP delivery reduced that to 3.4 s. The final audits report no image-delivery or cache-lifetime failures and no run warnings. Remaining lab findings include unused framework JavaScript and render-blocking CSS. Cold LCP remains above the 2.5 s target. The existing display-font preview also has a load cost; replacing it needs the licensed source font package. These local lab results do not establish public production performance or real Clerk load cost.

- [Landing audit](../output/playwright/redesign/lighthouse-landing.report.html)
- [Dashboard audit](../output/playwright/redesign/lighthouse-dashboard.report.html)
- [Landing audit before image/font fixes](../output/playwright/redesign/lighthouse-landing-before.report.html)

## Generated photo assets

The built-in tool generated two opaque images. Both were inspected, then resized and converted to WebP with `cwebp -q 80`. Conversion did not change the scenes.

Home exercise prompt brief: A candid editorial photo of an adult woman doing a simple standing side stretch in a real living room. Charcoal T-shirt, muted orange shorts, bare feet, relaxed expression, and natural daylight. Cool gray walls, wooden floor, and a sofa. Show the full body with clear hands and feet. Keep the scene ordinary and inviting. No weights, chair exercise, mat, fitness studio, text, or logo. Use a vertical composition for the landing hero and welcome screen.

Room prompt brief: A natural editorial photo of clear wooden floor space beside a cool gray living room wall. Soft daylight, a sofa at the edge, a small plant, and a folded orange towel. Leave the center open. Make it a calm, lived-in home with space to move. No person, workout equipment, mat, text, or logo. Use a horizontal composition for supporting copy and the empty dashboard.

Final assets in `frontend/app/assets/images`:

| Asset                    | Bytes  |
| ------------------------ | ------ |
| `home-workout-768.webp`  | 44,944 |
| `home-workout-1122.webp` | 80,006 |
| `room-to-move-768.webp`  | 26,300 |
| `room-to-move-1448.webp` | 77,250 |

The PNG sources remain under the task's Codex generated-images directory. The app serves only repository assets. It has no remote image dependency.
