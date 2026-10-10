# Endorphins design system

Use Sharp Serif for headings, Inter for controls and instructions, cool neutral surfaces, and orange for actions. Keep home exercise photos, generous spacing, and a mobile reading order. The intended audience is adults 28–50; use readable text and large touch targets.

The application is the current source of truth. The [Paper design file](https://app.paper.design/file/01M3TVV9XXTXF2N7ZD43K3WH3V) stores visual explorations; reconcile it with the implemented tokens when updating a design. The previous green/Instrument Serif specification has been retired.

## Inspect the real components

Start the development app and open `/design-system`. The development gallery renders shared controls on light and dark surfaces: fields, radios, disabled/pending buttons, validation, retry feedback, loading/empty states, and transitions. Resize to 390px and use the keyboard to inspect the same controls.

The gallery is `frontend/app/components/design-system.tsx`. It owns demonstration state. Primitives in `frontend/app/components/ui` never import application routes, account state, services, or query hooks.

## Foundations

| Role            | Light     | Dark      |
| --------------- | --------- | --------- |
| Background      | `#F2F3F3` | `#151819` |
| Surface         | `#FAFAFA` | `#1D2123` |
| Raised surface  | `#FEFEFE` | `#252B2E` |
| Text            | `#181A1B` | `#F2F3F3` |
| Supporting text | `#5B6265` | `#ADB5B9` |
| Border          | `#D5D9DA` | `#3B4448` |
| Control border  | `#7E898F` | `#6E7B81` |
| Action          | `#EC5633` | `#EC5633` |
| Action text     | `#181A1B` | `#181A1B` |
| Keyboard focus  | `#A93116` | `#FF8B6D` |
| Error text      | `#A72B24` | `#FFB4A8` |
| Error surface   | `#FCEAE7` | `#3C2423` |

`app.css` defines semantic colors with scoped `light-dark()` variables and exposes them through Tailwind `@theme inline`. `color-scheme` chooses system, explicit light, or explicit dark. The gallery redeclares semantic tokens at `[data-theme]` scopes so `light-dark()` resolves locally. Use semantic colors, not raw hex values in new product components.

- **Type:** Sharp Serif Text PDF Preview regular for editorial headings; Inter Variable for body, controls, numbers, and metadata. Body/form inputs are 16px, control labels 14px, supporting metadata at least 12px on screen. Headings use responsive `clamp()` sizing. The brand wordmark remains Inter.
- **Font asset:** the current Sharp Serif preview was recovered from the supplied PDF. It lacks the original kerning/OpenType tables. Replace it with the licensed original font package before public release.
- **Spacing:** Use Tailwind’s 4px scale: `gap-2` is 8px, `p-6` is 24px. Keep the current larger layout values only where the design needs them.
- **Shape:** 8px controls, 12px panels. Avoid adding a new radius for each component.
- **Targets:** shared inputs, selects, and default buttons are 48px tall. Small buttons and navigation targets remain at least 44px. Inputs use 16px text to avoid mobile auto-zoom.
- **Layout:** 1,320px maximum content width, fluid gutters with 20px on mobile. Existing responsive transitions are at 1,150px, 900px, 600px, and 360px; add breakpoints only for a demonstrated layout failure.
- **Motion:** 120ms quick feedback, 180ms state changes, 650ms landing arrival; shared easing `cubic-bezier(0.2, 0.65, 0.3, 1)`. Reduced motion removes CSS transitions/animations and zeroes Presence transitions. Use motion to show a state change; keep actions immediate.

## Component catalog

| Component          | Contract                                                                                                                                                                             | Existing product consumers                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `Button`           | Native button props, `variant="primary\|secondary\|ghost"`, `size="default\|small\|icon"`, `pending`. Defaults to `type="button"`. Pending disables and adds one decorative spinner. | Builder submit, shuffle, print, exercise navigation, retry    |
| `buttonClassName`  | Presentation helper for native anchors and typed TanStack `Link`; accepts the same visual variants. Retains router types and link behavior.                                          | Landing calls to action, saved library navigation             |
| `Field`            | Persistent label linked through explicit `htmlFor`, optional hint/error, arbitrary control children. Hint/error IDs are `${htmlFor}-hint` and `${htmlFor}-error`.                    | Custom workout duration; gallery validation examples          |
| `Input` / `Select` | Native element props and shared chrome. Caller owns value, label, validity, and described-by relationships.                                                                          | Duration, library sorting/level, theme selector               |
| `SearchInput`      | Native input props except type (always search), decorative icon, optional `wrapperClassName` for layout. Caller provides visible label or `aria-label`.                              | Full-library exercise/body-area search                        |
| `RadioOption`      | Native radio props inside its label. Checked, disabled, and focus states derive from the input itself. Group with a native `fieldset`/`legend`.                                      | Workout duration and level choices                            |
| `Feedback`         | Error/info tone, optional title, children, optional retry callback/label and id. Errors announce as alerts; information as status.                                                   | Generation/query failures and completion recovery      |
| `EmptyState`       | Title, explanatory children, optional action. No data fetching or embedded routing policy.                                                                                           | Saved library and unmatched filters                           |
| `LoadingState`     | Status region with descriptive children and a decorative spinner. Retains useful vertical space.                                                                                     | Library/detail loading, lazy exercise view                    |
| `Presence`         | Controlled `present`, `identity`, `direction`, className, and children. Uses one motion policy with reduced-motion support.                                                          | Custom-duration disclosure and changing exercise instructions |

Import the component’s file directly. Add a shared control when product views need the same behavior.

```tsx
import { Button, buttonClassName } from '~/components/ui/button'
import { Field, Input } from '~/components/ui/field'

<Button type="submit" variant="primary" pending={saving}>
  {saving ? 'Saving…' : 'Save workout'}
</Button>

<Link to="/app/workouts" className={buttonClassName({ variant: 'secondary' })}>
  Your workouts
</Link>

<Field label="Duration" htmlFor="duration" hint="30–120 minutes">
  <Input id="duration" type="number" min={30} max={120}
    aria-describedby="duration-hint" value={minutes}
    onChange={(event) => setMinutes(event.target.valueAsNumber)} />
</Field>
```

For an invalid field, pass `error` to `Field` and `aria-invalid` plus `aria-describedby="duration-error"` to the input. Keep label and hint/error associations explicit.

## Styling ownership

`app.css` is the only application stylesheet. It imports Tailwind and defines fonts, semantic theme values, base browser rules, shared keyframes, reduced motion, and the print page setup. It does not hold page selectors or control variants.

- `components/ui` owns reusable control appearance and states with Tailwind utilities. Use `Button`, `Field`, `Input`, `Select`, `RadioOption`, and feedback primitives instead of restyling native controls on each page.
- Pages and product components own layout with Tailwind utilities. Keep responsive and `print:` variants beside the affected markup.
- Use named tokens such as `bg-surface`, `text-muted`, `border-line`, `rounded-control`, and `font-display`. Do not repeat palette hex values in product layouts.
- `cn` uses `tailwind-merge` so caller layout overrides replace conflicting utility classes. Keep interaction states in the primitive; do not override them from a page.
- `PageHeading` shares the title/description/action layout. `SkipLink` owns hidden and focused skip navigation.
- Direct Motion imports stay in `components/ui`; product components use `Presence`.

Do not add page stylesheets or wrap old selectors in `@apply`. Keep unique layout in its page. Import checks enforce dependencies from product UI to primitives. Exercise disclosures stay workout-specific. See [frontend ownership](architecture.md#frontend-ownership) for URL state and input drafts.

## Accessibility and visual verification

Use native semantics before adding ARIA. Every input has a label, radio groups retain their legend and keyboard behavior, pending actions cannot be resubmitted, and icon-only controls need an accessible name. Keep one appropriate announcement for a failure; do not add a global toast announcing the same error again. A failed shuffle retains the previous plan and puts recovery feedback beside the action.

Verify at 390px and 1,440px in light/dark modes. Inspect keyboard focus, form errors, loading/empty states, long workout names, and reduced motion. Confirm no horizontal overflow and no clipped controls. Print a workout while exercise view is active: the complete plan and expanded notes must remain available, with screen-only controls hidden.

The [refinement report](architecture-refinement.md) records the change from 14 CSS files to one Tailwind theme, plus config and DTO changes. Its before/after captures are in `output/playwright/temper-improvements`; the baseline predates primitive extraction. The [Paper UI library](https://app.paper.design/file/01M3TVV9XXTXF2N7ZD43K3WH3V/p-3-0) keeps those studies and the light/dark control contracts. Gallery labels use the same 12px minimum as product metadata.

## App flow references

The signup redesign keeps Sharp Serif, Inter, and the existing orange tokens. Public and app layouts are separate. The app uses direct page labels, a compact navigation bar, one primary action in the initial empty dashboard, native level radios, weekly activity bars, and a separate confirmation/success screen. Generated plans and completed workouts have separate counts.

Mobbin references informed the state structure: [Hevy's weekly activity](https://mobbin.com/screens/79a622bd-392f-4ab4-9eb7-18e3a85fcc5c), [Peloton's active days](https://mobbin.com/screens/821d8083-b310-488e-be2e-e0afc024398e), [Bevel's level descriptions](https://mobbin.com/screens/ca012035-d801-42fb-bf6b-89954314cfe6), and [Laravel Cloud's empty state](https://mobbin.com/screens/5a0b71b3-f06f-4b14-af43-b862c1550a8f). Browser verification captures the implemented welcome, levels, setup, saved plan, completion, and dashboard states in `output/playwright/redesign`.

## Home workout refinement

The landing page uses an asymmetric photo and text layout, followed by a compact explanation of the workout journey. New photos show a casual stretch in a living room and clear floor space beside a wall. They replace gym cues and are locally served WebP files with responsive sizes and fingerprinted URLs. The built-in image generation tool created the assets; prompts are in the [October 5 review](signup-onboarding-review-2026-10-05.md). The landing design dials are variance 6, motion 3, and density 3.

Onboarding introduces the app before the level choice. Desktop uses a photo beside four short feature descriptions; mobile keeps the descriptions and next action together. The dashboard gives completed workouts the strongest numerical emphasis, then active days and milestones. The four-week chart uses recorded counts; zero counts have no filled track. Reached milestones have explicit screen-reader text.

Themes apply before first paint and keep the browser theme color in sync with manual and system changes. Font files are preloaded. Layouts use balanced headings, touch-safe controls, and explicit mobile grids. Navigation uses links. Completion actions are composed into the saved plan and optional exercise view. The builder has one authenticated setup mode. Long saved-plan lists defer off-screen rendering with native CSS.
