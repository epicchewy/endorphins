# Endorphins design system

The implemented system is an editorial workout studio: Sharp Serif for expressive headings, Inter for clear controls and workout instructions, cool neutral surfaces, and one orange action color. Keep the existing brand, photography, generous spacing, and mobile-first reading order. The intended audience is adults 28–50, so compact enterprise typography and tiny targets are inappropriate.

The application is the current source of truth. The [Paper design file](https://app.paper.design/file/01M3TVV9XXTXF2N7ZD43K3WH3V) stores visual explorations; reconcile it with the implemented tokens when updating a design. The previous green/Instrument Serif specification has been retired.

## Inspect the real components

Start the development app and open `/design-system`. This development-only gallery shows the actual production primitives in light and dark surfaces, including controlled fields and radio choices, disabled/pending buttons, validation, errors with retry, loading/empty states, and transitions. It is not a second implementation or a mock screenshot. Resize to 390px and use the keyboard to inspect the same controls.

The gallery is `frontend/app/components/design-system.tsx`. It owns demonstration state. Primitives in `frontend/app/components/ui` never import application routes, account state, services, or query hooks.

## Foundations

| Role            | Light     | Dark      |
| --------------- | --------- | --------- |
| Background      | `#F2F3F3` | `#151819` |
| Surface         | `#FAFAFA` | `#1D2123` |
| Raised surface  | `#FFFFFF` | `#252B2E` |
| Text            | `#181A1B` | `#F2F3F3` |
| Supporting text | `#5B6265` | `#ADB5B9` |
| Border          | `#D5D9DA` | `#3B4448` |
| Control border  | `#7E898F` | `#6E7B81` |
| Action          | `#EC5633` | `#EC5633` |
| Action text     | `#181A1B` | `#181A1B` |
| Keyboard focus  | `#A93116` | `#FF8B6D` |
| Error text      | `#A72B24` | `#FFB4A8` |
| Error surface   | `#FCEAE7` | `#3C2423` |

`app.css` defines semantic colors with scoped `light-dark()` variables and exposes them through Tailwind `@theme inline`. `color-scheme` chooses system, explicit light, or explicit dark. The gallery can scope each theme without duplicating palettes. Use semantic colors, not raw hex values in new product components.

- **Type:** Sharp Serif Text PDF Preview regular for editorial headings; Inter Variable for body, controls, numbers, and metadata. Body/form inputs are 16px, control labels 14px, supporting metadata at least 12px on screen. Headings use responsive `clamp()` sizing. The brand wordmark remains Inter.
- **Font asset:** the current Sharp Serif preview was recovered from the supplied PDF. It lacks the original kerning/OpenType tables. Replace it with the licensed original font package before public release.
- **Spacing:** Use Tailwind’s 4px scale: `gap-2` is 8px, `p-6` is 24px. Keep the current larger layout values only where the design needs them.
- **Shape:** 8px controls, 12px panels. Avoid adding a new radius for each component.
- **Targets:** shared inputs, selects, and default buttons are 48px tall. Small buttons and navigation targets remain at least 44px. Inputs use 16px text to avoid mobile auto-zoom.
- **Layout:** 1,320px maximum content width, fluid gutters with 20px on mobile. Existing responsive transitions are at 1,150px, 900px, 600px, and 360px; add breakpoints only for a demonstrated layout failure.
- **Motion:** 120ms quick feedback, 180ms state changes, 650ms landing arrival; shared easing `cubic-bezier(0.2, 0.65, 0.3, 1)`. Reduced motion removes CSS transitions/animations and zeroes Presence transitions. Motion marks a change rather than delaying an action.

## Component catalog

| Component          | Contract                                                                                                                                                                             | Existing product consumers                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `Button`           | Native button props, `variant="primary\|secondary\|ghost"`, `size="default\|small\|icon"`, `pending`. Defaults to `type="button"`. Pending disables and adds one decorative spinner. | Builder submit, shuffle, print, exercise navigation, retry    |
| `buttonClassName`  | Presentation helper for native anchors and typed TanStack `Link`; accepts the same visual variants. Retains router types and link behavior.                                          | Landing calls to action, saved library navigation             |
| `Field`            | Persistent label linked through explicit `htmlFor`, optional hint/error, arbitrary control children. Hint/error IDs are `${htmlFor}-hint` and `${htmlFor}-error`.                    | Custom workout duration; gallery validation examples          |
| `Input` / `Select` | Native element props and shared chrome. Caller owns value, label, validity, and described-by relationships.                                                                          | Duration, library sorting/level, theme selector               |
| `SearchInput`      | Native input props except type (always search), decorative icon, optional `wrapperClassName` for layout. Caller provides visible label or `aria-label`.                              | Full-library exercise/body-area search                        |
| `RadioOption`      | Native radio props inside its label. Checked, disabled, and focus states derive from the input itself. Group with a native `fieldset`/`legend`.                                      | Workout duration and level choices                            |
| `Feedback`         | Error/info tone, optional title, children, optional retry callback/label and id. Errors announce as alerts; information as status.                                                   | Generation failures, query failures, changed preferences      |
| `EmptyState`       | Title, explanatory children, optional action. No data fetching or embedded routing policy.                                                                                           | Saved library and unmatched filters                           |
| `LoadingState`     | Status region with descriptive children and a decorative spinner. Retains useful vertical space.                                                                                     | Library/detail loading, lazy exercise view                    |
| `Presence`         | Controlled `present`, `identity`, `direction`, className, and children. Uses one motion policy with reduced-motion support.                                                          | Custom-duration disclosure and changing exercise instructions |

Import the exact component file rather than a barrel. There is no polymorphic button framework, portal registry, global toast service, or separate state system in this library. Add a primitive when real product consumers share the same behavior.

```tsx
import { Button, buttonClassName } from '~/components/ui/button'
import { Field, Input } from '~/components/ui/field'

<Button type="submit" variant="primary" pending={saving}>
  {saving ? 'Saving…' : 'Save workout'}
</Button>

<Link to="/workouts" className={buttonClassName({ variant: 'secondary' })}>
  Your workouts
</Link>

<Field label="Duration" htmlFor="duration" hint="30–120 minutes">
  <Input id="duration" type="number" min={30} max={120}
    aria-describedby="duration-hint" value={minutes}
    onChange={(event) => setMinutes(event.target.valueAsNumber)} />
</Field>
```

For an invalid field, pass `error` to Field and `aria-invalid` plus `aria-describedby="duration-error"` to its input. Associations stay explicit; Field does not clone children or inject hidden state.

## Styling ownership

`app.css` is the only application stylesheet. It imports Tailwind and defines fonts, semantic theme values, base browser rules, shared keyframes, reduced motion, and the print page setup. It does not hold page selectors or control variants.

- `components/ui` owns reusable control appearance and states with Tailwind utilities. Use `Button`, `Field`, `Input`, `Select`, `RadioOption`, and feedback primitives instead of restyling native controls on each page.
- Pages and product components own layout with Tailwind utilities. Keep responsive and `print:` variants beside the affected markup.
- Use named tokens such as `bg-surface`, `text-muted`, `border-line`, `rounded-control`, and `font-display`. Do not repeat palette hex values in product layouts.
- `cn` uses `tailwind-merge` so caller layout overrides replace conflicting utility classes. Keep interaction states in the primitive; do not override them from a page.
- `PageHeading` shares the title/description/action layout. `SkipLink` owns hidden and focused skip navigation.
- Direct Motion imports stay in `components/ui`; product components use `Presence`.

Do not add page stylesheets or wrap old selector rules in `@apply`. Extract a shared component when the same control or behavior has real consumers. Keep unique page layout in its page. Import checks enforce the direction from product UI to primitives.

Native exercise disclosures remain domain components because they display workout-specific prescriptions. Their open/closed state and the exercise view stay local to the page. URL search owns shareable library filters and validated builder preferences, not hover, disclosure, or focus position. The custom-duration input retains a raw local editing draft so an intermediate empty/short value can be typed; only valid 30–120 minute integers update the URL, and native validation prevents invalid submission. External duration changes synchronize the draft.

## Accessibility and visual verification

Use native semantics before adding ARIA. Every input has a label, radio groups retain their legend and keyboard behavior, pending actions cannot be resubmitted, and icon-only controls need an accessible name. Keep one appropriate announcement for a failure; do not add a global toast announcing the same error again. A failed shuffle retains the previous plan and puts recovery feedback beside the action.

Verify at 390px and 1,440px in light/dark modes. Inspect keyboard focus, form errors, loading/empty states, long workout names, and reduced motion. Confirm no horizontal overflow and no clipped controls. Print a workout while exercise view is active: the complete plan and expanded notes must remain available, with screen-only controls hidden.

The architecture-improvement browser artifacts under `output/playwright/temper-improvements` hold the before/after product screenshots and recordings for this consolidation. Baseline captures were taken before the primitive extraction. The root task records fresh verification results in the implementation report; this document describes the system contract rather than claiming an unperformed browser check.

## Before and after

The first cleanup split a large stylesheet into 14 files. Most styles still lived outside Tailwind, and primitive components were mostly class-name wrappers. This made file ownership clearer but kept two competing styling systems.

The corrected structure uses one Tailwind theme stylesheet. Primitives own their utility variants; pages own local layout. The light/dark gallery renders those same components. See [the refinement report](architecture-refinement.md) for the config, DTO, and styling changes and verification.

## Implemented reference

The live development gallery is `/design-system`. Its [Paper UI library](https://app.paper.design/file/01M3TVV9XXTXF2N7ZD43K3WH3V/p-3-0) preserves earlier design pages and records the current light/dark control and feedback contracts. Semantic color tokens are redeclared at explicit `[data-theme]` scopes so compiled `light-dark()` values resolve locally. Gallery labels use the same 12px minimum as product metadata.
