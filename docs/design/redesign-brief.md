# Endorphins frontend overhaul

Date: 2026-10-03

## Existing state

- Palette: warm plaster #F7F6F1, green ink #243F36, sage #E7EDE4, tan #D8C9AD.
- Typography: Instrument Serif display, Manrope body; 10px controls and 24px panels.
- Identity: Endorphins wordmark and sun mark. Preserve name and mark.
- Routes: `/` with `#builder` and `#how-it-works`, `/sign-in/*`, `/sign-up/*`, `/workouts`, `/workouts/:workoutId`.
- Primary labels: Build a workout, How it works, My workouts, Sign in, Get started.
- Functionality: 30-120 minute duration, five levels, authenticated generation, shuffle, saved history, exercise disclosures, print/PDF.
- SEO: root title/description and favicon; no structured data, social cards, established ranking evidence, or analytics instrumentation found.
- Preserve: native controls, focus handling, error retention, authenticated ownership, session cache isolation, print behavior, canonical routes and anchor IDs.
- Retire: repeated small-caps labels, decorative status dot, vague feel-good copy, equal feature list, box-heavy treatment.
- Existing dials: variance 5, motion 2, density 4.

## New direction

Athletic studio. Variance 8, motion 6, density 4 for marketing. Product views prioritize clarity. Keep TanStack Start, Query and owned Tailwind/CSS; no imitation Nike or Strava component library.

Cool neutral surfaces, near-black type, a single signal-orange accent. Daylight editorial fitness photography. Sharp Serif Text Regular (PDF recovery for preview) in sentence case, Inter for body copy, controls, and tabular numbers. Sharp media geometry, 8px controls, 12px panels, circles only for icon controls. System light/dark modes with shared semantic tokens. Reduced-motion variants.

## Flows

1. Discover: concise image-led landing -> Build a workout anchor.
2. Configure: duration -> level -> generation. Remember selected settings through sign-in via validated URL search parameters.
3. Review: actual plan, time allocation and prescriptions -> exercise focus view or print. Shuffle creates a new saved plan.
4. Return: My workouts -> filter loaded plans -> see clear summary statistics -> reopen a saved plan.
5. Authenticate: Clerk routes styled within the same visual system; consistent return destination and visible error states.

Analytics describe generated plans, never completed training, calories, progress or streaks we do not track. Loaded-history scope is explicit. No invented social proof or performance claims.

## Research

- Nike Training Club website: https://www.nike.com/ntc-app
- Nike browsing flow: https://mobbin.com/flows/ad3f32a4-c218-4765-aa0f-3fe40525e176
- Strava summary: https://mobbin.com/screens/8dc137a4-09f0-4a04-adfd-1f4c6719c712
- Strava activities/calendar: https://mobbin.com/screens/02f8ff4a-0d9d-492b-8be8-08fb9e9fe486
- Recent.design gallery and RYVN identity: https://recent.design/i/p4boljm-ryvn-brand-identity (inspected in the in-app browser). Precise geometry, typographic hierarchy and cool grey surfaces informed the composition; the Endorphins identity stays its own.

Design-taste applies to the landing/brand surfaces; product analytics use actual data, labeled controls and accessible tabular alternatives.


## Delivered system

Paper: https://app.paper.design/file/01M3TVV9XXTXF2N7ZD43K3WH3V/p-2-0

Six editable artboards: desktop landing, mobile landing, workout studio, foundations, mobile dark exercise view, and workout-history analytics. The sample data in design boards is labeled; the application calculates its numbers from the API.

The implementation uses self-hosted Sharp Serif Text PDF Preview Regular 400 for editorial headings, Inter 400–800 for body copy and controls, Lucide, and owned Tailwind v4/native CSS. Barlow Condensed and Manrope dependencies are removed. Optical sizing is enabled; data uses Inter with tabular numerals. The serif is intentionally smaller than the previous condensed display face, with more line height and sentence-case copy.

Confirmed typography direction: [Sharp Serif Text](https://www.sharptype.co/typefaces/sharp-serif-omni) by Sharp Type, paired with Inter. The supplied PDF contains embedded Regular outlines. A clearly named preview reconstruction now replaces Bodoni in the app; see [recovery notes](font-recovery/README.md). All 1,385 outlines and advance widths match the PDF, and 919 Unicode mappings are recovered. Original kerning and OpenType layout tables are unavailable. Paper uses vector outlines for its ten display headings because it has not detected the locally installed font. App text remains live. Use the original licensed font package for public release. Earlier videos remain available for comparison.

| Role | Light | Dark |
| --- | --- | --- |
| Background | #F2F3F3 | #151819 |
| Surface | #FAFAFA | #1D2123 |
| Text | #181A1B | #F2F3F3 |
| Secondary text | #5B6265 | #ADB5B9 |
| Separator | #D5D9DA | #3B4448 |
| Input outline | #7E898F | #6E7B81 |
| Accent | #EC5633 | #EC5633 |
| Accent text | #181A1B | #181A1B |

Light/dark/system appearance is persisted as a browser preference. On mobile, the appearance control moves to the footer to leave room for the account navigation. Clerk's colors use the same semantic variables, including text on primary buttons and input foregrounds.

Generation still requires a Clerk session. Selecting a custom duration and level then using the builder's sign-in action creates a local return URL such as `/?minutes=75&level=4#builder`. The route validates those values and restores the form. Authentication never accepts a client-supplied user ID. Session cleanup and owner-scoped query keys remain intact.

Exercise view visits the warm-up, when present, then all exercises in each prescribed set before advancing to the next block. Timed rounds remain within an exercise prescription. It is a plan guide, not a completed-workout tracker. No completion records or training streaks are fabricated.

History filtering/sorting happens over loaded pages. The statistics panel discloses that scope while more pages are available. Loading more expands both the analytics and filter results. All time metrics describe planned minutes.

## Verification and remaining visual review

- `make check` passed: formatting, layer rules, Go lint/race/integration suite, 16 frontend tests (77 assertions), type generation, TypeScript, and production builds. Existing unchanged Go test results were cached; production smoke uses a fresh Postgres Testcontainer.
- `make smoke` passed using a fresh Postgres Testcontainer and production frontend: server-rendered landing/auth pages, restored custom preferences, JPEG delivery/HEAD, static path isolation, gzip negotiation, 15 authenticated generations, saved history, owner isolation, errors, and proxy failure.
- Regression coverage preserves fresh token acquisition, session cache isolation, previous plans after failed shuffles, interval prescriptions, print markup, and accessible form labels.
- Added tests verify warm-up/set ordering, filtering/sorting without mutating query-cache arrays, empty statistics, and constrained return URL settings.
- Measured token contrast: accent button text 4.94:1; muted text 5.95:1 light / 7.79:1 dark; input outlines 3.43:1 light / 3.72:1 dark. These are computed color ratios, not a full browser accessibility audit.
- Reviewed Paper desktop/mobile compositions and corrected dark text contrast in the design boards.
- Live application browser review, browser interaction checks, and Lighthouse/Core Web Vitals measurement remain unverified. Browser navigation to the local app was rejected by a saved user permission; no alternate browser or automation route was used to bypass it.
- A local dev frontend and API were already listening on ports 3100 and 8088. Refresh the running application to see the redesign.

Responsive rules cover 320px and up, collapse product controls at 900px, and stack marketing sections at 600px. These rules require visual confirmation in the live app once browser access is allowed. The Paper layouts are design previews, not application screenshots.

## Earlier Bodoni / Inter preview

The earlier [video](video/endorphins-serif-inter-walkthrough.mp4) uses updated Paper exports, labeled as a design preview, with Bodoni Moda / Inter captions. It is not a live-app interaction recording.

Typography-pass validation: frontend lint, TypeScript, 16 tests (77 assertions), production build, and production smoke with a fresh Postgres Testcontainer passed. Paper desktop landing, mobile landing, studio, library, dark exercise, and foundation boards were visually reviewed for fit, spacing, alignment, and contrast. Live-browser verification remains subject to the limitation above.

## Sharp Serif Text / Inter recovery preview

[Updated video](video/endorphins-sharp-serif-inter-walkthrough.mp4). Regular headlines use recovered original outlines; body and control text use Inter. Reviewed all six Paper boards. Frontend formatting, lint, TypeScript, and production build passed. Live browser validation remains blocked by the saved permission described above.
