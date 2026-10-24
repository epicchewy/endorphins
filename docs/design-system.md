# Endorphins design system

Use Sharp Serif for headings, Inter for controls and instructions, cool neutral surfaces, and orange for actions. Keep home exercise photos, generous spacing, and a mobile reading order. The intended audience is adults 28–50; use readable text and large touch targets.

The application is the current source of truth. The [Paper design file](https://app.paper.design/file/01M3TVV9XXTXF2N7ZD43K3WH3V) stores visual explorations; reconcile it with the implemented tokens when updating a design. The previous green/Instrument Serif specification has been retired.

## Inspect the real components

Start the development app and open `/design-system`. The development gallery renders shared controls on light and dark surfaces: fields, radios, disabled/pending buttons, validation, retry feedback, and loading/empty states. Resize to 390px and use the keyboard to inspect the same controls.

The gallery is `frontend/app/components/design-system.tsx`. It owns demonstration state. Primitives in `frontend/app/components/ui` never import application routes, account state, services, or query hooks.

## Foundations

Token names follow [shadcn/ui](https://ui.shadcn.com/docs/theming), so its components work without edits. The values are ours.

| Role                         | Token                               | Light     | Dark      |
| ---------------------------- | ----------------------------------- | --------- | --------- |
| Page                         | `background`                        | `#F2F3F3` | `#151819` |
| Panel                        | `card`                              | `#FAFAFA` | `#1D2123` |
| Raised surface               | `popover`                           | `#FEFEFE` | `#252B2E` |
| Text                         | `foreground`                        | `#181A1B` | `#F2F3F3` |
| Supporting text              | `muted-foreground`                  | `#5B6265` | `#ADB5B9` |
| Hover and subtle fill        | `muted`, `accent`, `secondary`      | `#E9EBEC` | `#2A3134` |
| Border                       | `border`                            | `#D5D9DA` | `#3B4448` |
| Control border               | `input`                             | `#7E898F` | `#6E7B81` |
| Action fill                  | `primary`                           | `#EC5633` | `#EC5633` |
| Action text                  | `primary-foreground`                | `#181A1B` | `#181A1B` |
| Orange text and icons; focus | `emphasis` (ours), `ring`           | `#A93116` | `#FF8B6D` |
| Error text                   | `destructive`                       | `#A72B24` | `#FFB4A8` |

`primary` orange is for fills. It is too light for small text, so orange text and icons use `emphasis`, which meets AA contrast. For a soft orange fill, use `bg-primary/15`.

`app.css` defines the values with scoped `light-dark()` and exposes them through Tailwind `@theme inline`. `color-scheme` chooses system, explicit light, or explicit dark. A custom `dark` variant follows the page's `data-theme`, so shadcn's `dark:` classes match the chosen theme, not only the OS. The gallery redeclares tokens at `[data-theme]` scopes so each preview resolves locally. Use tokens, not raw hex values, in product components.

- **Type:** Sharp Serif Text PDF Preview regular for editorial headings; Inter Variable for body, controls, numbers, and metadata. Body/form inputs are 16px, control labels 14px, supporting metadata at least 12px on screen. Headings use responsive `clamp()` sizing. The brand wordmark remains Inter.
- **Font asset:** the current Sharp Serif preview was recovered from the supplied PDF. It lacks the original kerning/OpenType tables. Replace it with the licensed original font package before public release.
- **Spacing:** Use Tailwind’s 4px scale: `gap-2` is 8px, `p-6` is 24px. Keep the current larger layout values only where the design needs them.
- **Shape:** `--radius` is 8px. Controls use `rounded-lg` (8px) and panels `rounded-xl` (12px). Avoid adding a new radius for each component.
- **Targets:** shared inputs, selects, and default buttons are 48px tall. Small buttons and navigation targets remain at least 44px. Inputs use 16px text to avoid mobile auto-zoom.
- **Layout:** 1,320px maximum content width, fluid gutters with 20px on mobile. Existing responsive transitions are at 1,150px, 900px, 600px, and 360px; add breakpoints only for a demonstrated layout failure.
- **Motion:** Hover and focus change color, border, or ring only. Nothing moves on hover. Buttons keep shadcn's 1px press. The pending spinner is the only animation. Content changes, such as the next exercise step, swap at once. Reduced motion removes every transition and animation.

## Component catalog

`components/ui` holds shadcn components (`base-nova` style, built on [Base UI](https://base-ui.com)) and a few of our own. Import each file directly.

| Component                               | Source | Contract                                                                                                                                       |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                                | shadcn | `variant="default\|outline\|ghost\|secondary\|destructive\|link"`, `size="default\|sm\|lg\|icon"`. Ours: 48/44/56px heights and `pending`, which disables the button and adds a spinner. |
| `buttonVariants`                        | shadcn | Classes for a typed TanStack `Link` that looks like a button: `cn(buttonVariants({ variant: 'outline' }), 'mt-6')`. In `button-variants.ts`.    |
| `Field`, `FieldLabel`, `FieldDescription`, `FieldError`, `FieldSet`, `FieldLegend` | shadcn | Label, hint, error and group layout. The caller owns `htmlFor`, `id` and `aria-describedby`.                         |
| `Input`, `NativeSelect`                 | shadcn | Native elements with shared chrome, 48px tall, 16px text.                                                                                      |
| `Alert`, `Empty`, `Spinner`, `Label`, `Separator` | shadcn | Used through the field and feedback components.                                                                                   |
| `RadioOption`                           | ours   | A native radio drawn as a choice chip. shadcn has no native radio card, and the native input keeps arrow-key selection and form validation.   |
| `Feedback`                              | ours   | Error or info tone on `Alert`, optional title, retry callback and label. Errors announce as alerts, information as status.                     |
| `EmptyState`, `LoadingState`            | ours   | Built on `Empty` and `Spinner`. The empty title stays an `h3`.                                                                                 |
| `PageHeading`, `SkipLink`, `LocalDate`  | ours   | Page title row, skip navigation, and dates in the reader's locale.                                                                             |

```tsx
import { Button } from '~/components/ui/button'
import { buttonVariants } from '~/components/ui/button-variants'
import { Field, FieldDescription, FieldLabel } from '~/components/ui/field'
import { Input } from '~/components/ui/input'

<Button type="submit" pending={saving}>
  {saving ? 'Saving…' : 'Save workout'}
</Button>

<Link to="/app/workouts" className={buttonVariants({ variant: 'outline' })}>
  Your workouts
</Link>

<Field>
  <FieldLabel htmlFor="duration">Duration</FieldLabel>
  <Input id="duration" type="number" min={30} max={120}
    aria-describedby="duration-hint" value={minutes}
    onChange={(event) => setMinutes(event.target.valueAsNumber)} />
  <FieldDescription id="duration-hint">30–120 minutes</FieldDescription>
</Field>
```

For an invalid field, set `data-invalid="true"` on `Field`, `aria-invalid` and `aria-describedby="duration-error"` on the input, and render `<FieldError id="duration-error">`.

### Adding a shadcn component

Run `npx shadcn@latest add <name>` in `frontend/`. Then:

1. Run `bun run format` and `bun run lint`. Remove `import * as React from 'react'`; type-only `React.` references work without it.
2. Raise control heights to the 48px targets above. Keep shadcn's colors, states and focus ring.
3. The CLI may add the `cn` package. Remove it; `~/lib/utils` already provides `cn`.
4. Overlay components (dialogs, menus) need `tw-animate-css` and `@import 'shadcn/tailwind.css'`. Add them with the first one.

## Styling ownership

`app.css` is the only application stylesheet. It imports Tailwind and defines fonts, theme tokens, the `dark` variant, base browser rules, reduced motion, and the print page setup. It does not hold page selectors or control variants.

- `components/ui` owns reusable control appearance and states with Tailwind utilities. Use `Button`, `Field`, `Input`, `NativeSelect`, `RadioOption`, and feedback primitives instead of restyling native controls on each page.
- Pages and product components own layout with Tailwind utilities. Keep responsive and `print:` variants beside the affected markup.
- Use tokens such as `bg-card`, `text-muted-foreground`, `border-border`, `rounded-lg`, and `font-display`. Do not repeat palette hex values in product layouts.
- `cn` in `~/lib/utils` is shadcn's `clsx` and `tailwind-merge` helper, so caller layout overrides replace conflicting utility classes. Keep interaction states in the primitive; do not override them from a page.
- `PageHeading` shares the title/description/action layout. `SkipLink` owns hidden and focused skip navigation.

Do not add page stylesheets or wrap old selectors in `@apply`. Keep unique layout in its page. Import checks enforce dependencies from product UI to primitives. See [frontend ownership](architecture.md#frontend-ownership) for URL state and input drafts.

## Accessibility and visual verification

Use native semantics before adding ARIA. Every input has a label, radio groups retain their legend and keyboard behavior, pending actions cannot be resubmitted, and icon-only controls need an accessible name. Keep one appropriate announcement for a failure; do not add a global toast announcing the same error again. A failed completion keeps the plan to do and puts recovery feedback beside **Mark complete**.

Verify at 390px and 1,440px in light/dark modes. Inspect keyboard focus, form errors, loading/empty states, long workout names, and reduced motion. Confirm no horizontal overflow and no clipped controls. Print a workout while exercise view is active: the complete plan and every note must remain available, with screen-only controls hidden.

The [refinement report](history/architecture-refinement.md) records the change from 14 CSS files to one Tailwind theme, plus config and DTO changes. Its before/after captures are in `output/playwright/temper-improvements`; the baseline predates primitive extraction. The [Paper UI library](https://app.paper.design/file/01M3TVV9XXTXF2N7ZD43K3WH3V/p-3-0) keeps those studies and the light/dark control contracts. Gallery labels use the same 12px minimum as product metadata.

## App flow references

The signup redesign keeps Sharp Serif, Inter, and the existing orange tokens. Public and app layouts are separate. The app uses direct page labels, a compact navigation bar, one primary action in the initial empty dashboard, native level radios, weekly activity bars, and a completion result on the plan page. Generated plans and completed workouts have separate counts.

Mobbin references informed the state structure: [Hevy's weekly activity](https://mobbin.com/screens/79a622bd-392f-4ab4-9eb7-18e3a85fcc5c), [Peloton's active days](https://mobbin.com/screens/821d8083-b310-488e-be2e-e0afc024398e), [Bevel's level descriptions](https://mobbin.com/screens/ca012035-d801-42fb-bf6b-89954314cfe6), and [Laravel Cloud's empty state](https://mobbin.com/screens/5a0b71b3-f06f-4b14-af43-b862c1550a8f). Browser tests verify welcome, levels, setup, saved plans, completion, and dashboard states. Failure captures are in `output/playwright/test-results`.

## Home workout refinement

The landing page uses an asymmetric photo and text layout, followed by a compact explanation of the workout journey. New photos show a casual stretch in a living room and clear floor space beside a wall. They replace gym cues and are locally served WebP files with responsive sizes and fingerprinted URLs. The built-in image generation tool created the assets; prompts are in the [October 5 review](history/signup-onboarding-review-2026-10-05.md). The landing design dials are variance 6, motion 3, and density 3.

Onboarding introduces the app before the level choice. Desktop uses a photo beside four short feature descriptions; mobile keeps the descriptions and next action together. The dashboard gives completed workouts the strongest numerical emphasis, then active days and milestones. The four-week chart uses recorded counts; zero counts have no filled track. Reached milestones have explicit screen-reader text.

Themes apply before first paint and keep the browser theme color in sync with manual and system changes. Font files are preloaded. Layouts use balanced headings, touch-safe controls, and explicit mobile grids. Navigation uses links. **Mark complete** ends a plan that is still to do and the optional exercise view. The builder has one authenticated setup mode. Long saved-plan lists defer off-screen rendering with native CSS.

## Saved workout plan

The saved plan answers one question: what do I do next, and how many? A person reads it from the floor, so the exercises take the most space and the summary takes one line.

- The title row has the title, one line of level, estimated time, exercise count, and saved date, and the Start workout and Print actions. A completed plan adds a line with a check and its last completion date, and Start workout becomes Start again. There is no back link; the app navigation leads to the library.
- To get a different plan, use **New workout**. The plan page does not generate plans.
- Blocks sit in three columns from 900px and in one column, at most 720px wide, below that. Each row shows the name, the always-visible note, and the count right-aligned beside it. A block with more than one set marks its set count in `text-emphasis` with a repeat icon.
- Orange appears on the set count and on **Mark complete**, which ends a plan that is still to do and the last exercise step. A completed plan has no Mark complete below it. Start workout swaps in the exercise view and becomes Back to plan.
- After Mark complete, a result panel appears above the plan. It takes focus and shows progress, any milestone, Back to dashboard and Undo.
- Print shows one compact column and hides the actions and the exercise view.
