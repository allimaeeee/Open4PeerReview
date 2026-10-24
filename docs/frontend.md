# Frontend & Design System Reference

> For the OLI development team inheriting the Open 4 Peer Review Hub (O4PR) codebase. This document describes the frontend architecture as it actually exists — read from source files, not inferred from general Next.js/Tailwind conventions. Sections marked **⚠️ Confirm:** are inferences the design lead should verify before treating as settled.

---

## 1. Design Tokens

**Single source of truth: `app/globals.css`.**

> **Staleness caveat:** The token values documented below reflect the state of `globals.css` as of 2026-07-24. The design system has been revised multiple times over the project's history — if any doubt exists about whether a specific value here is current, read `globals.css` directly rather than relying on this doc.

Any future changes to colors, spacing, typography, or other design values must be made in `globals.css` and only there. Do not hardcode hex values, pixel values, or font names directly in component files.

Tokens are defined in a Tailwind v4 `@theme` block, which exposes them simultaneously as CSS custom properties (e.g. `var(--color-primary)`) and as Tailwind utility classes (e.g. `bg-primary`, `text-text-primary`). Both forms are used in the codebase — inline `style` props tend to use `var(--color-*)`, Tailwind class strings use the utility name.

---

### Color Tokens

#### Surfaces
A family of warm/cream tones for layered container backgrounds, plus a white card surface.

| Token | Value |
|---|---|
| `--color-surface` | `#f4f1ea` |
| `--color-surface-container` | `#f1eee7` |
| `--color-surface-container-low` | `#f6f3ec` |
| `--color-surface-container-high` | `#ebe8e1` |
| `--color-surface-bright` | `#fcf9f2` |
| `--color-surface-card` | `#ffffff` |
| `--color-surface-warm` | `#fefaf0` |

#### Text

| Token | Value |
|---|---|
| `--color-text-primary` | `#1c1c18` |
| `--color-text-secondary` | `#44474c` |
| `--color-text-muted` | `#74777d` |
| `--color-text-on-brand` | `#ffffff` |

#### Borders

| Token | Value |
|---|---|
| `--color-border` | `#c4c6cd` |
| `--color-border-strong` | `#74777d` |

#### Brand

| Token | Value |
|---|---|
| `--color-primary` | `#041627` (near-black navy) |
| `--color-primary-hover` | `#1a2b3c` |
| `--color-on-primary` | `#ffffff` (text on top of primary) |
| `--color-secondary` | `#735c00` (dark mustard/gold) |
| `--color-secondary-container` | `#fed65b` (bright yellow) |
| `--color-on-secondary-container` | `#735c00` |

#### Feedback

| Token | Value |
|---|---|
| `--color-error` | `#ba1a1a` |
| `--color-on-error` | `#ffffff` |
| `--color-error-hover` | `#b71c1c` |
| `--color-error-container` | `#ffdad6` |
| `--color-on-error-container` | `#93000a` |
| `--color-success` | `#1a5c1a` |
| `--color-success-container` | `#d4f0d4` |
| `--color-info` | `#242d64` |
| `--color-info-container` | `#fef5de` |

#### Rating Level
These alias Brand and Feedback tokens via `var()` references — do not add new standalone hex values here.

| Token | Resolves to |
|---|---|
| `--color-rating-exceeds-bg` | `var(--color-secondary-container)` — bright yellow |
| `--color-rating-exceeds-text` | `var(--color-on-secondary-container)` — dark gold |
| `--color-rating-exceeds-border` | `var(--color-secondary)` |
| `--color-rating-exemplifies-bg` | `var(--color-primary)` — dark navy |
| `--color-rating-exemplifies-text` | `var(--color-on-primary)` — white |
| `--color-rating-dnm-bg` | `var(--color-error-container)` — light pink |
| `--color-rating-dnm-text` | `var(--color-on-error-container)` — dark red |
| `--color-rating-dnm-border` | `var(--color-error)` |

**Important:** `--color-rating-exemplifies-text` resolves to white. It is designed for text rendered on the dark navy rating badge background, not for text on light cream surfaces. When using the exemplifies rating color as foreground text on a light background, use `var(--color-primary)` directly.

#### Selection / Annotation

| Token | Value |
|---|---|
| `--color-selected` | `#fefaf0` |
| `--color-annotation` | `rgba(254, 214, 91, 0.45)` |
| `--color-annotation-active` | `rgba(254, 214, 91, 0.75)` |

#### Status (Pipeline)
Used for status pills across dashboards. CSS token names follow the pattern `--color-status-{name}-bg` / `--color-status-{name}-text`.

| Status | Background | Text |
|---|---|---|
| `draft` | `#ebe8e1` | `#44474c` |
| `unassigned` | `#f1eee7` | `#44474c` |
| `assigned` | `rgba(210, 228, 251, 0.4)` | `#041627` |
| `under-review` | `rgba(254, 214, 91, 0.6)` | `#735c00` |
| `review-submitted` | `rgba(0, 148, 133, 0.18)` | `#004a42` |
| `feedback-ready` | `#d4f0d4` | `#1a5c1a` |
| `published` | `rgba(108, 76, 179, 0.15)` | `#3d1a85` |
| `certified` | `#d4f0d4` | `#1a5c1a` |
| `not-started` | `rgba(210, 228, 251, 0.4)` | `#041627` |
| `in-progress` | `rgba(254, 214, 91, 0.6)` | `#735c00` |
| `completed` | `#d4f0d4` | `#1a5c1a` |

#### Decision / Revision Banners

| Token | Value |
|---|---|
| `--color-banner-bg` | `#cce0f2` |
| `--color-banner-border` | `#8bb5d4` |
| `--color-banner-text` | `#123653` |

#### Role Accents

| Token | Value |
|---|---|
| `--color-role-author` | `#0c3b1a` |
| `--color-role-reviewer` | `#242d64` |
| `--color-role-coordinator` | `#5e0831` |

---

### Typography Tokens

Font families are referenced via Tailwind utilities `font-display`, `font-heading`, `font-body`, `font-label`, `font-code`:

| Token | Font stack |
|---|---|
| `--font-display` | `var(--font-newsreader)`, Georgia, Iowan Old Style, serif |
| `--font-heading` | `var(--font-newsreader)`, Georgia, Iowan Old Style, serif |
| `--font-body` | `var(--font-lato)`, system-ui, -apple-system, sans-serif |
| `--font-label` | `var(--font-lato)`, system-ui, -apple-system, sans-serif |
| `--font-code` | JetBrains Mono, ui-monospace, monospace |

Font sizes — referenced as Tailwind utilities like `text-heading-md`, `text-body-sm`:

| Token | Value |
|---|---|
| `--text-display-lg` | 3.5rem |
| `--text-display-md` | 2.75rem |
| `--text-heading-lg` | 2rem |
| `--text-heading-md` | 1.75rem |
| `--text-heading-sm` | 1.5rem |
| `--text-title-lg` | 1.25rem |
| `--text-title-md` | 1rem |
| `--text-title-sm` | 0.875rem |
| `--text-body-lg` | 1rem |
| `--text-body-md` | 0.875rem |
| `--text-body-sm` | 0.75rem |
| `--text-label-md` | 0.75rem |
| `--text-label-sm` | 0.6875rem |

Font weights:

| Token | Value |
|---|---|
| `--font-weight-regular` | 400 |
| `--font-weight-medium` | 500 |
| `--font-weight-semibold` | 600 |

Line heights (`leading-*`): `tight` 1.2 / `snug` 1.35 / `normal` 1.5 / `relaxed` 1.6

Letter spacing (`tracking-*`): `tight` -0.01em / `normal` 0em / `wide` 0.1em

---

### Spacing

The spacing scale is **not** a 1:1 px-per-step scheme. Several steps are skipped (7, 9, 11, 13, 14, 15). Check `globals.css` rather than assuming a Tailwind default scale.

| Token | Value |
|---|---|
| `--spacing-1` | 4px |
| `--spacing-2` | 8px |
| `--spacing-3` | 12px |
| `--spacing-4` | 16px |
| `--spacing-5` | 20px |
| `--spacing-6` | 24px |
| `--spacing-8` | 32px |
| `--spacing-10` | 40px |
| `--spacing-12` | 48px |
| `--spacing-16` | 64px |

---

### Other Tokens

**Border radius** (`rounded-*`): `none` 0 / `sm` 2px / `md` 6px / `lg` 10px / `xl` 16px / `full` 9999px

**Elevation** — four shadow levels using a warm-black tint, not cool gray:

| Token | Value |
|---|---|
| `--shadow-1` | `0 2px 8px rgba(28, 28, 24, 0.05)` |
| `--shadow-2` | `0 4px 16px rgba(28, 28, 24, 0.04)` |
| `--shadow-3` | `0 12px 40px rgba(28, 28, 24, 0.06)` |
| `--shadow-4` | `0 20px 56px rgba(28, 28, 24, 0.08)` |

**Z-index** (`z-*`): `base` 0 / `popover` 30 / `sticky` 50 / `modal` 80 / `overlay` 100 / `tooltip` 9999

**Motion:**

| Token | Value |
|---|---|
| `--transition-duration-fast` | 120ms |
| `--transition-duration-base` | 200ms |
| `--transition-duration-slow` | 320ms |
| `--transition-timing-function-brand` | `cubic-bezier(0.2, 0, 0, 1)` |

---

## 2. Typography

Two typefaces are in use: **Lato** (sans-serif, body and labels) and **Newsreader** (serif, headings and display text).

**Loading mechanism:** Both fonts are loaded via `next/font/google` at the root layout in `app/layout.tsx`:

```ts
const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-lato',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-newsreader',
})
```

`next/font` injects `--font-lato` and `--font-newsreader` as CSS custom properties scoped to the `<html>` element via generated class names. The `@theme` block in `globals.css` then aliases them into the semantic font-family tokens (`--font-body`, `--font-heading`, etc.) documented above.

**Usage in components:** Apply the semantic tokens as Tailwind utility classes — e.g. `font-heading text-heading-md font-semibold` or `font-label text-label-sm`. Do not use Tailwind's built-in `font-sans` or `font-serif` — those map to Tailwind's defaults, not the project fonts.

---

## 3. Component Architecture

Components are organized into three folders under `components/`. Understanding the distinction between them is important for knowing where a new component belongs.

```
components/
  ui/          — Primitives: single-purpose, no business logic
  patterns/    — Compositions: ui/ primitives assembled for a product context
  layout/      — Structural shells: page-level containers
  auth/        — Auth-specific UI (outside the three-tier system)
  SaveStatusIndicator.tsx  — One loose component at the root level
```

**Rule of thumb:**
- `ui/` — could ship in a generic component library. No knowledge of rubrics, reviews, or OER. No data fetching, no routing.
- `patterns/` — composes `ui/` primitives and knows about product-specific data shapes (documents, reviewers, rubric status). Still no direct data fetching — receives data as props.
- `layout/` — provides structural shells that other components render inside (top nav, split-pane wrapper).

If a new component is product-specific but not a page shell, it belongs in `patterns/`. If it's a reusable input, button variant, or display primitive, it belongs in `ui/`.

---

### `components/ui/` — Primitives

| File | Purpose |
|---|---|
| `Accordion.tsx` | Expand/collapse section with animated chevron |
| `AddressStatusControl.tsx` | Inline toggle for marking a piece of feedback as Addressed / Not Addressed |
| `Alert.tsx` | Informational, success, warning, or error banner |
| `AuthorCommentField.tsx` | Controlled text field for author revision comments attached to feedback |
| `Button.tsx` | Multi-variant button: `primary`, `secondary`, `toggle`, `icon`, `text`, `destructive` |
| `Card.tsx` | Generic surface container with optional shadow |
| `Checkbox.tsx` | Labeled checkbox input |
| `Chip.tsx` | Pill-shaped tag, optionally dismissible |
| `ChipGroup.tsx` | Renders a row of `Chip` elements with shared overflow handling |
| `ConfirmationDialog.tsx` | Modal with confirm and cancel actions, used before destructive operations |
| `CoordinatorDecisionBar.tsx` | Action bar with approve/reject controls for the coordinator review workflow |
| `CriterionReportCard.tsx` | Accordion card for one rubric criterion: score badges, reviewer comments, evidence annotations, optional author status controls |
| `DropdownMenu.tsx` | Trigger + floating menu with keyboard navigation |
| `EmptyState.tsx` | Centered empty-state display with optional icon, heading, and CTA |
| `EvidenceCard.tsx` | Single annotation card: anchored text or hotspot, comment body, optional tag |
| `FilterPill.tsx` | Toggle pill for active/inactive filter state |
| `Input.tsx` | Text input with label, helper text, and error state |
| `Modal.tsx` | Overlay dialog with focus trap and backdrop |
| `MultiSelect.tsx` | Searchable multi-value select with chip display for selected items |
| `ProgressBar.tsx` | Horizontal progress indicator |
| `Radio.tsx` | Labeled radio input |
| `ReportDecisionBar.tsx` | Action bar for report-level decisions (publish, keep private, request revision) |
| `RevisionNotes.tsx` | Read-only display block for existing revision notes on a submission |
| `ReviewSummaryPanel.tsx` | Summary panel showing rubric completion status across all criteria |
| `RubricTag.tsx` | Small label chip identifying a rubric criterion |
| `RubricTagList.tsx` | Renders a list of `RubricTag` elements |
| `Select.tsx` | Single-value select with custom styling |
| `SelectionCard.tsx` | Icon + label radio-card for mutually exclusive option selection (used in OER submission flow) |
| `StatCard.tsx` | Metric display tile with a number and label |
| `StatusBadge.tsx` | Coloured pill for pipeline status values (maps to the status color tokens) |
| `StepIndicator.tsx` | Step progress dots for multi-step flows |
| `TabBar.tsx` | Horizontal tab navigation with active indicator and optional badge counts |
| `Textarea.tsx` | Multi-line text area with label and error state |

---

### `components/patterns/` — Compositions

| File | Purpose |
|---|---|
| `CompletedReviewCard.tsx` | Card for a completed review entry in the reviewer dashboard |
| `DashboardShell.tsx` | Wrapper providing the standard dashboard page layout (sidebar + scrollable content area) |
| `DashboardSidebar.tsx` | Left navigation sidebar with role-aware links and active state |
| `DocumentCard.tsx` | Card for an author submission: status badge, rubric step indicators, and action buttons |
| `DraftCard.tsx` | Card variant for an unsaved or in-progress submission |
| `FilterPillGroup.tsx` | Horizontal group of `FilterPill` elements wired to shared filter state |
| `NavRoleSwitcher.tsx` | Navbar dropdown for switching between Author, Reviewer, and Coordinator contexts |
| `NotificationBell.tsx` | Navbar bell icon with unread count badge and notification popover |
| `ReviewerCard.tsx` | Card displaying a reviewer's name, institution, and assignment actions |
| `SettingsModal.tsx` | Full settings dialog (profile, preferences) mounted at the root layout level |
| `TaskPoolCard.tsx` | Card for an available unassigned review task in the task pool |
| `UnlinkedAnnotationsCard.tsx` | Card surfacing annotations not linked to any rubric criterion |
| `UserMenu.tsx` | Navbar user avatar with dropdown menu (settings, sign out) |

---

### `components/layout/` — Layout Shells

| File | Purpose |
|---|---|
| `Navbar.tsx` | Top application navigation bar: logo, role switcher, notification bell, user menu |
| `ResizablePanelLayout.tsx` | Horizontal split-pane with a draggable divider — used by the reviewer console and review report |

---

## 4. The `cx()` Utility

**Read this section before modifying component files.**

Throughout the codebase, conditional class names are merged using a small helper named `cx`. It is **defined locally inside each component file** — it is not imported from a shared utility, and there is no `clsx`, `classnames`, or `tailwind-merge` package in `package.json`.

The definition is always one of these two equivalent forms:

```ts
function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ')
}
```

This local definition appears in **35 component files** across `components/ui/` and `components/patterns/`, confirmed by searching the entire codebase. Zero files import `cx` from any shared path.

---

## 5. Icons

**There is no icon library in this codebase.** `lucide-react` is not listed in `package.json` and has no imports anywhere in the project. No other icon library (`@heroicons/react`, `react-icons`, `phosphor-react`, etc.) appears in dependencies or imports either.

All icons are **inline `<svg>` elements** written directly in the component or page file that uses them. There is no centralized icon component or icon registry. When adding a component that needs an icon, follow the existing pattern and inline the SVG at the point of use.

---

## 6. Tailwind Conventions

**Version:** Tailwind CSS v4 (`"tailwindcss": "^4"` in `package.json`).

**Key v4 differences from earlier versions:**
- No `tailwind.config.js` or `tailwind.config.ts`. All configuration is CSS-first, via the `@theme` block in `globals.css`.
- Entry point is `@import "tailwindcss"` (not `@tailwind base/components/utilities` directives).
- Tokens defined in `@theme` automatically become Tailwind utility classes — no separate `extend` configuration needed.

**Project conventions:**
- Use semantic token names as Tailwind utilities — `bg-surface`, `text-text-primary`, `font-heading`, `shadow-2`, `rounded-lg` — not Tailwind's built-in defaults like `bg-white`, `text-gray-900`, or `font-sans`.
- Inline `style` props use `var(--color-*)` syntax when a value needs to be computed or passed dynamically; static class-based styling always uses Tailwind utilities.
- Responsive breakpoint variants (`sm:`, `md:`, `lg:`) appear in only a handful of pattern components and are not a primary layout strategy. The app is built for desktop/tablet and largely uses fixed/flex layout rather than grid-responsive layout.
- No custom `@layer utilities` blocks. The only custom CSS beyond `@theme` is two animation keyframes (`highlight-pulse`, `card-highlight-pulse`) and three classes (`.annotation-highlight`, `.annotation-highlight.active`, `.card-highlight.active`) used by the annotation engine.

---

## 7. File and Folder Conventions

**Component files:** PascalCase (`Button.tsx`, `DocumentCard.tsx`). One primary exported component per file. Sub-components and helpers used only within the file are defined in the same file rather than extracted — this is the consistent pattern throughout `components/`.

**Utility and hook files:** camelCase (`formatRubric.ts`, `useReviewAutoSave.ts`).

**Types:** Colocated with the module that owns them. Shared Supabase database types are in `types/database.types.ts` (Supabase-generated — do not hand-edit) and `types/index.ts`. Product-specific enums and shared interfaces live in `types/index.ts`.

**App Router structure:** Route groups mirror product surfaces:

```
app/
  author/       — Author dashboard, submission flow, feedback view
  reviewer/     — Reviewer dashboard
  coordinator/  — Coordinator dashboard
  review/       — Reviewer console (annotation + rubric workspace)
  dashboard/    — Shared dashboard entry point
  login/        — Auth pages
  onboard/      — Onboarding flow
  api/          — Server routes (AI chat, snapshot capture)
```

Page-specific components are co-located in a `components/` subfolder within the relevant route directory (e.g. `app/author/components/`). These are distinct from the shared `components/` tree at the repo root — the shared tree is for components used across multiple surfaces.

**Feature modules:** Self-contained features with their own client components, server logic, and data subdirectories live under `features/` (currently: `features/ai-chat/`).

**`'use client'` directive:** Present at the top of all interactive component files. Server Components are the Next.js App Router default; the directive is added only where React state, effects, or browser APIs are required.
