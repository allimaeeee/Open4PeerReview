# Design System

The UI is built on **Tailwind CSS v4** with a token layer defined in
`app/globals.css`. There is no component library dependency (no shadcn, no MUI);
components are plain React + Tailwind utility classes.

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
| **Feedback** | `--color-error`, `--color-error-container`, `--color-success`, `--color-info` (+ `on-*` / `-hover` variants) |
| **Ratings** | `--color-rating-exceeds-*`, `--color-rating-exemplifies-*`, `--color-rating-dnm-*` (map to the `criterion_score` enum) |
| **Annotation** | `--color-selected`, `--color-annotation: rgba(254,214,91,0.45)`, `--color-annotation-active` |
| **Status (pipeline)** | draft / unassigned / assigned / under-review / feedback-ready / certified / in-progress / completed, each with `-bg` and `-text` |
| **Role accents** | `--color-role-author`, `--color-role-reviewer`, `--color-role-coordinator` |
| **Typography** | families `--font-display/heading/body/label/code`; sizes `--text-display-lg: 3.5rem` … `--text-label-sm: 0.6875rem`; weights 400/500/600; line-heights `--leading-tight: 1.2` … `--leading-relaxed: 1.6`; tracking tokens |
| **Spacing** | 4px scale, `--spacing-1: 4px` … `--spacing-16: 64px` |
| **Radius** | `--radius-none: 0` … `--radius-xl: 16px`, `--radius-full: 9999px` |
| **Elevation** | `--shadow-1` … `--shadow-4` |
| **Z-index** | `--z-base: 0`, `--z-popover: 30`, `--z-sticky: 50`, `--z-modal: 80`, `--z-overlay: 100`, `--z-tooltip: 9999` |
| **Motion** | `--transition-duration-fast: 120ms` / `-base: 200ms` / `-slow: 320ms`, `--transition-timing-function-brand: cubic-bezier(0.2,0,0,1)` |

Fonts are wired through `next/font/google` in `app/layout.tsx` (Newsreader for
display/serif, Lato for body) and exposed to the `@theme` font-family tokens as
CSS variables.

> **Adoption is partial.** Many components still use raw hex arbitrary values
> (`bg-[#1e3a5f]`, `hover:bg-[#162d4a]`) or Tailwind's stock palette
> (`bg-slate-200`) instead of tokens. When touching a component, prefer the
> token utility (`bg-primary`, `text-text-muted`) so the system converges.

---

## Primitives / patterns / layout — component structure

There is **no `ui/` or `primitives/` atoms directory** and no `Button`/`Input`
base component; each component styles Tailwind inline. The structure that does
exist:

```
components/
  Navbar.tsx               ← layout / chrome (shared across pages)
  SaveStatusIndicator.tsx  ← shared status widget
  auth/                    ← feature primitives (auth forms)
    ProfileForm.tsx
    SignupForm.tsx
  patterns/                ← composed, reusable cards/patterns
    ReviewerCard.tsx
```

Most components are **co-located with their route** under `app/*/components/`
rather than globalized:

- `app/review/components/` — the review console: `ReviewerApp`,
  `ReviewerConsole`, `AnnotationPanel`, `AnnotationListCard`,
  `AnnotationHoverCard`, `RubricPicker`, `SubmitButton`, `PDFViewer`,
  `PDFViewerCanvas`, `HtmlViewerCanvas`, `TorusAnnotationViewer`.
- `app/dashboard/components/` — `AuthorDashboard`, `CoordinatorDashboard`,
  `ReviewerDashboard`, `RoleToggle`, `UploadDocumentForm`, `EditDraftForm`, …
- `app/author/components/`, `app/coordinator/components/`,
  `app/reviewer/components/`, plus `app/onboard/OnboardingForm.tsx` and
  `app/dashboard/settings/SettingsForm.tsx`.

Guideline: shared chrome and cross-route patterns go in top-level
`components/{,auth/,patterns/}`; anything specific to one route stays under that
route's `components/`.

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

> **Current state:** `cx()` is defined **locally in a single component**
> (`SubmissionModal.tsx`) rather than shared, and most other components
> concatenate class strings with template literals / ternaries inline. If you
> reach for conditional classes in more than one place, promote `cx()` to a
> shared util (e.g. `lib/cx.ts`) and import it — do not copy-paste the
> definition, and do not add a `clsx`-style dependency without discussion.

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
  --color-primary: #041627;
  /* …all tokens above… */
}

/* keyframes + utility classes: highlight-pulse, card-highlight-pulse,
   .annotation-highlight, etc. */
```

Key v4 differences to keep in mind:

- **CSS-first config.** Customize via `@theme` in CSS, not a JS config object.
- **Single `@import "tailwindcss";`** replaces the v3 `@tailwind base/components/utilities` triple. (If you see the three `@tailwind` directives anywhere, that's a v3-era stub to clean up.)
- **Tokens auto-generate utilities.** Adding `--color-foo` to `@theme` gives you
  `bg-foo`, `text-foo`, `border-foo`, etc. for free — add tokens there rather
  than hardcoding hex in components.
