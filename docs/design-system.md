# Design System

The UI is built on **Tailwind CSS v4** with a token layer defined in
`app/globals.css`. There is no third-party component library (no shadcn, no MUI);
the project ships its own primitives under `components/ui/`, styled with Tailwind
utility classes.

---

## Tokens

Design tokens are declared as CSS custom properties inside a Tailwind v4
`@theme { … }` block in `app/globals.css`. Because they live in `@theme`,
Tailwind generates matching utilities automatically (e.g. `--color-primary`
→ `bg-primary` / `text-primary`), so tokens are consumed as normal Tailwind
classes rather than raw `var(--…)`.

Token groups (representative values):

| Group | Examples |
| --- | --- |
| **Surfaces** | `--color-surface: #f4f1ea`, `--color-surface-card: #ffffff`, `--color-surface-bright: #fcf9f2`, `--color-surface-warm: #fefaf0` |
| **Text** | `--color-text-primary: #1c1c18`, `--color-text-secondary: #44474c`, `--color-text-muted: #74777d`, `--color-text-on-brand: #ffffff` |
| **Borders** | `--color-border: #c4c6cd`, `--color-border-strong: #74777d` |
| **Brand** | `--color-primary: #041627`, `--color-primary-hover: #1a2b3c`, `--color-secondary: #735c00`, `--color-secondary-container: #fed65b` |
| **Feedback** | `--color-error`, `--color-success`, `--color-info` (+ `on-*` / `-container` variants) |
| **Ratings** | `--color-rating-*` (map to the `criterion_score` enum; some reference brand tokens, e.g. `--color-rating-exemplifies-bg: var(--color-primary)`) |
| **Annotation** | `--color-selected`, `--color-annotation`, `--color-annotation-active` |
| **Status (pipeline)** | draft / unassigned / assigned / under-review / etc., each with `-bg` and `-text` |
| **Role accents** | `--color-role-author`, `--color-role-reviewer`, `--color-role-coordinator` |
| **Typography** | families `--font-display/heading/body/label/code` (Newsreader / Lato / JetBrains Mono); size, weight (400/500/600), line-height, tracking scales |
| **Spacing / radius / shadow / z-index / motion** | 4px spacing scale, radius, elevation, z-index, and transition tokens |

Fonts are wired through `next/font/google` in `app/layout.tsx` (Newsreader for
display/serif, Lato for body) and exposed to the `@theme` font-family tokens as
CSS variables.

### `lib/design-system/token-values.ts`

Because the Chrome extension cannot use Tailwind or the Next.js font runtime,
the token values are mirrored in a **plain-TS constant map**,
`lib/design-system/token-values.ts` (`export const tokens = { … }`). Its header
notes the values are *"verified against `app/globals.css` @theme block"* and that
the extension declares matching `@font-face` rules inside its Shadow DOM
`<style>` block. When you change a token in `globals.css`, update this file too
so the extension UI stays in sync.

---

## Primitives / patterns / layout — component structure

Shared components are organized by altitude:

```
components/
  SaveStatusIndicator.tsx    ← misc shared widget
  ui/         ← PRIMITIVES (37 files): Button, Input, Textarea, Select,
                 Checkbox, Radio, Card, Modal, Alert, Accordion, Chip/ChipGroup,
                 ProgressBar, StatusBadge, StepIndicator, TabBar, DropdownMenu,
                 MultiSelect, ConfirmationDialog, RubricTag/RubricTagList,
                 EvidenceCard, CriterionReportCard, ReviewSummaryPanel,
                 RevisionNotes, SelectionCard, FilterPill, AddressStatusControl, …
  patterns/   ← COMPOSED patterns: DashboardShell, DashboardSidebar, DocumentCard,
                 TaskPoolCard, CompletedReviewCard, ReviewerCard, UserMenu,
                 NotificationBell, NavRoleSwitcher, FilterPillGroup,
                 UnlinkedAnnotationsCard, SettingsModal
  layout/     ← LAYOUT: Navbar, ResizablePanelLayout
  auth/       ← FEATURE forms: SignupForm
```

Guideline on where a component goes:

- **`ui/`** — reusable, presentational primitives with no app/domain knowledge.
- **`patterns/`** — composed, domain-aware building blocks (cards, shells,
  menus) assembled from primitives.
- **`layout/`** — page chrome and layout scaffolding.
- **Route-specific** components stay co-located under their route:
  `app/review/components/`, `app/reviewer/components/`,
  `app/coordinator/components/`, `app/author/components/`. The AI-chat UI lives
  in `features/ai-chat/`.

---

## The `cx()` convention

`cx()` is the conditional-className helper: variadic args, falsy values dropped,
space-joined.

```ts
function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}

// usage
<div className={cx('panel', isActive && 'panel--active', error && 'panel--error')} />
```

It is the project's stand-in for `clsx`/`classnames` — there is **no** `clsx`,
`classnames`, `tailwind-merge`, or central `cn()` dependency.

> **Current state / cleanup opportunity:** `cx()` is **not** a shared util — the
> same ~5-line function is copy-pasted locally into ~28 component files (across
> `components/ui/` and `components/patterns/`). Consider extracting it once to a
> shared module (e.g. `lib/cx.ts`) and importing it everywhere, rather than
> re-declaring it per file. Do not add a `clsx`-style dependency without
> discussion — the local helper is intentional.

---

## Tailwind v4 usage

Tailwind v4 is configured through **PostCSS only** — there is no
`tailwind.config.js`. Configuration and tokens live in CSS.

`postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

`app/globals.css` starts by importing Tailwind and then declares the theme:

```css
@import "tailwindcss";

@theme {
  --color-surface: #f4f1ea;
  --color-primary: #041627;
  /* …all tokens above… */
}

/* keyframes + utility classes for highlights/annotations follow */
```

Key v4 differences to keep in mind:

- **CSS-first config.** Customize via `@theme` in CSS, not a JS config object;
  there is no `tailwind.config.*` file.
- **Single `@import "tailwindcss";`** replaces the v3 `@tailwind
  base/components/utilities` triple.
- **Tokens auto-generate utilities.** Adding `--color-foo` to `@theme` gives you
  `bg-foo`, `text-foo`, `border-foo`, etc. for free — prefer adding a token
  there over hardcoding hex in components, and mirror it into
  `lib/design-system/token-values.ts` for the extension.
