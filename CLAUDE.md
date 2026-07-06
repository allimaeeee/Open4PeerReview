# CLAUDE.md — Open4PeerReview / OER Certification Hub (Team Mask'd)

## Project Overview

The OER Certification Hub is a peer review platform for Open Educational Resources (OER), built in partnership with CMU's Open Learning Initiative (OLI) and Maricopa Community Colleges. It replaces a slow, email-based review process with an automated "Certification Hub" using standardized rubrics and digital stamps.

**Repository:** github.com/allimaeeee/Open4PeerReview
**Prototype (Vercel):** https://oerhub.vercel.app/author
**Status:** Active development. Core review workflows are built and functional — author/reviewer dashboards, the reviewer console, the review report (author feedback view), the OER submission flow, onboarding, and settings. Current focus: a new browser-extension-based review workflow for interactive OER (starting with OLI Torus) that can't be ingested and rendered directly into the platform, plus bringing that extension's visual design in line with the platform's design tokens.
**Program:** METALS Capstone (7-month project, spring + summer 2026)
**Process:** Lean development with iterative Build–Measure–Learn cycles across multiple MVP releases (Discover → Ideate → Release → Rediscover)

### Hunt Statement
Our team, in partnership with Maricopa County Community Colleges and the Open Learning Initiative (OLI), will standardize the evaluation of Open Educational Resources (OER) through the development of a structured peer-review platform integrated with AI-assisted moderation, which empowers content creators to iteratively refine their materials.

For the full functional spec, feature roadmap, and rationale behind product decisions, see the team's PRD (revised frequently — check you have the current version rather than trusting a cached one). This file intentionally stays lean and describes only what's actually implemented and how the repo works today.

---

## User Roles

A single person may hold multiple roles simultaneously (e.g., an author for their own work and a reviewer for someone else's).

- **Author (Sarah):** Submits OER, tracks review progress, receives structured feedback, performs revisions. *Built.*
- **Reviewer (James):** Evaluates OER using a side-by-side workspace with rubric-based annotation tools. *Built* — including a separate browser-extension path for OER that can't be rendered inside the platform (see below).
- **Coordinator (Mark):** Manages the review pipeline, assigns reviewers, mediates feedback quality. *Not yet built* — waiting on a dedicated design/discovery pass.
- **Adopter (Educator):** Discovers certified/peer-reviewed OER through some public-facing surface — exact form isn't finalized yet (could be a public listing/landing page of certified resources, or similar). *Not yet built.* The underlying digital-stamp/certification concept is in the PRD; a separate, lower-priority read-only browser extension for surfacing certification info on external OER sites (OpenStax, Pressbooks) is also scoped but backlogged.

---

## Platform Structure (Current Implementation)

Rather than a fixed set of lettered "blocks," here's what actually exists today, organized by surface:

- **Author Dashboard** — submissions list with status tracking (Submitted, Under Review, In Revision, Certified).
- **Reviewer Dashboard** — task list (My Reviews / Completed / Task Pool). For interactive OER submissions (OLI Torus), starting or resuming a review opens a "Begin/Continue Review" modal that lets the reviewer choose between reviewing via the browser extension (on the live OER page) or via the platform's review console (viewing captured screenshots).
- **Reviewer Console** — the core annotation + rubric interface. Horizontal split: OER content on the left, rubric panel on the right. For most formats the left panel renders the actual document; for OLI Torus specifically, the left panel instead shows screenshots captured by the browser extension (see below), since that content can't be ingested/rendered directly.
- **Review Report** — read-only split-screen feedback view for authors, reusing the same OER-panel component from the Reviewer Console in a disabled/read-only mode.
- **OER Submission flow** — icon radio cards for format/scope selection, multi-page upload support.
- **Onboarding, navbar, settings modal** — built. Note: this is a simpler flow than the more elaborate multi-role/multi-stage onboarding described in the current PRD — that fuller version has not been implemented yet.
- **Coordinator Dashboard** — not yet built.
- **Browser extension (`extension/` folder)** — a write-capable extension purpose-built for reviewing OLI Torus content. Injects a floating Shadow-DOM panel into the live Torus page, mirroring the platform's rubric interface; supports text highlights and hotspot annotations (for non-text elements); captures a screenshot on every annotation. Currently built in vanilla TypeScript with esbuild — it does not share components, build pipeline, or CSS with the Next.js app. Bringing it into visual alignment with the platform is in progress (see Design System below).
- **Read-only discovery extension** (separate from the above) — scoped in the PRD for surfacing certification badges on external OER sites, for the Adopter role. Backlogged, not started.

---

## Figma Files

### Design System
https://www.figma.com/design/Xjl43yYOIUTQ6QA1Q3dVxy/%F0%9F%8E%A8-Design-System?node-id=1-2

Figma's role is now limited to: (1) this design system foundations file, (2) specific graphics (logos, icons), and (3) occasional full design passes for pages that are complex/novel enough to benefit from designing before building (e.g. the reviewer console). Everything else is restyled directly in code.

### Product Views (legacy — not part of the active workflow)
These were used earlier in the project for Figma-first page design and are largely superseded by direct-to-code work. Kept for historical reference only:
- Block A — Submission & Dashboard: https://www.figma.com/design/VCISA1y1N5ziQt36n84hJV/%E2%9C%8D%EF%B8%8F-Author-View?node-id=0-1
- Block B — Reviewer Console: https://www.figma.com/design/Ka66r49YYnJVtF51VPN62H/%F0%9F%94%8D-Reviewer-View?node-id=0-1
- Block C — Feedback & Revision: https://www.figma.com/design/OKG2utxwz6zA28MiskYX7D/%F0%9F%8C%90-Consumer-View?node-id=0-1

---

## Design System

### Source of Truth
Tokens are defined as CSS custom properties in **`app/globals.css`**'s Tailwind v4 `@theme` block. This is the only source of truth for exact values — **never hardcode a hex code, spacing value, or font name in a component or a prompt.** Reference the semantic token name instead (e.g. `bg-surface`, `text-text-primary`, `font-heading`).

The brand palette has changed more than once during this project. If you (or a prompt) need to know "what's the current primary color," read `globals.css` directly — don't trust a value from a previous conversation, an old doc, or this file.

For non-Tailwind consumers that can't read CSS custom properties (currently: the browser extension), a flat-value mirror exists at **`lib/design-system/token-values.ts`**. This must be manually kept in sync with `globals.css` — there's no automated generation step yet, so a token change in one place doesn't propagate to the other.

### Colors — categories (see `globals.css` for exact values)
- **Surfaces** — a family of warm/cream background tones at different container levels, plus a white card surface
- **Text** — primary, secondary, muted, on-brand
- **Borders** — default and strong
- **Brand** — primary (a near-black navy) and secondary (a dark mustard/gold, with a bright yellow "container" variant)
- **Feedback** — error, success, info, each with a lighter "container" variant
- **Rating level** — exceeds / exemplifies / does-not-meet, each derived from the Brand/Feedback tokens above via `var()` reference rather than defined independently — don't add new standalone hex values here, reference the existing brand/feedback tokens
- **Selection/annotation** — amber highlight tints, used for annotation highlighting
- **Status (pipeline)** — draft, unassigned, assigned, under-review, feedback-ready, certified, not-started, in-progress, completed — used for status pills across dashboards
- **Role accents** — a distinct accent color per Author / Reviewer / Coordinator role

### Typography
- **Heading/display:** Newsreader (serif), loaded via `next/font`, with Georgia/Iowan Old Style fallback
- **Body/label:** Lato (sans-serif), loaded via `next/font`, with system-ui fallback
- **Code:** JetBrains Mono
- Scale is defined via `--text-*` tokens (display, heading, title, body, label — each with size steps), not a fixed h1–h4 scheme
- The browser extension bundles its own font files directly (since it can't use `next/font`): Lato Regular (400) and Bold (700) as static files, Newsreader as a single variable font (weight range 200–800)

### Spacing
`--spacing-1` through `--spacing-16`, defined in `globals.css` — not a 1:1 "number equals pixel value" scheme. Check the file for the current step list rather than assuming an unmodified Tailwind default scale.

### Border Radius
Five steps, `--radius-none` (0) through `--radius-full` (9999px), with sm/md/lg/xl in between.

### Elevation
Four shadow levels (`--shadow-1` through `--shadow-4`), all using a soft warm-black tint rather than a cool gray, increasing in blur/spread.

### Motion
`--transition-duration-fast/base/slow` plus a named brand easing curve (`--transition-timing-function-brand`). Used sparingly; check `globals.css` before introducing a new one-off duration or easing curve.

### Z-index
A defined scale (`--z-base` through `--z-tooltip`) — use these rather than arbitrary z-index values when layering new UI (modals, popovers, tooltips).

---

## Rubric Templates

The platform supports 6 standardized rubric templates. Each is loaded dynamically as JSON based on the reviewer's assigned task:

1. **Accessibility** (8 criteria: text structure, color contrast, alt text, multimedia, interactive elements, tables, links, technical format)
2. **Copy Editing** (10 criteria: grammar, spelling, punctuation, style guide, consistency, clarity, formatting, citations, cross-references, inclusive language)
3. **Copyright** (8 criteria: licensing, third-party content, attribution, fair use, license compatibility, public domain, status communication, permissions)
4. **Disciplinary Appropriateness** (7 criteria: accuracy, currency, completeness, scholarly rigor, college-level appropriateness, source quality, assessment quality)
5. **eLearning Review** (9 criteria: usability, technical support, mobile accessibility, LMS integration, data privacy, cost/sustainability, accessibility integration, pedagogical effectiveness, learning analytics)
6. **Universal Design for Learning** (8 criteria: representation, expression, engagement, expectations/feedback, collaboration, metacognition, equity/bias, OER-specific UDL)

---

## Design-to-Code Workflow

Figma-first page design is no longer the default — there's no static-UI phase and no mock-data layer. Pages and components are restyled/built directly in code, iterated against the live Vercel preview.

Three working modes, chosen based on how much is already known:

1. **Direct to Claude Code** — for small, targeted changes (single prop values, token swaps, element removal). No design discussion needed first.
2. **Design chat → Claude Code prompt** — for changes involving a design decision (new component behavior, layout tradeoffs). Talk through the decision first, then write a scoped prompt.
3. **Discovery → chat → build** — for features with meaningful unknowns in the existing codebase. Run a read-only discovery pass first (no code changes), discuss findings, then write build prompts.

Other conventions:
- Backend coordination before frontend when a feature involves schema changes — don't build UI around a schema that still needs to move.
- Work on a feature is often split into Track A (build an isolated component) and Track B (wire it into the actual page/flow) as separate, smaller prompts.
- Figma is only used up front for pages complex/novel enough to benefit from a design pass before building (see Figma Files above) — most work skips it entirely.

---

## Code Conventions

### General Rules
- Never hardcode color, spacing, or typography values — reference the semantic tokens in `app/globals.css` (or `lib/design-system/token-values.ts` for the extension). See Design System above.
- Match existing component organization: `components/ui/` for primitives, `components/patterns/` for compositions, `components/layout/` for layout components.
- The `cx()` class-merging utility is defined locally per component file, not imported from a shared `lib/utils.ts`.
- All components should handle the states relevant to their context: default, hover, focus, disabled, error, loading, empty — as applicable.

### Tech Stack
Next.js, TypeScript, Tailwind CSS v4, Supabase (database, auth, storage), Vercel (hosting/deploy).

The browser extension (`extension/`) is a separate codebase: vanilla TypeScript bundled with esbuild, Shadow DOM for style isolation, raw `fetch` calls routed through a background service worker rather than the Supabase JS SDK. It does not currently share components or a build pipeline with the Next.js app — that would require adopting a UI framework inside the extension (e.g. via Plasmo) and is a larger, deliberately deferred effort, not near-term work.

### Naming Conventions
- Component files: PascalCase (e.g., `ReviewerConsole.tsx`)
- Utility files: camelCase (e.g., `formatRubric.ts`)
- Token/CSS references: kebab-case matching the custom property names in `globals.css`

---

## Git Workflow

### Branching Strategy
- `main` — always stable and deployable; Vercel production deploys from this branch.
- `testing` — backend-complete, stable branch (Alli's working branch for wiring pages to Supabase).
- `design/[feature-name]` — active frontend work in progress (Sara's branches), pulled from `testing`, merged forward once complete.

No pull-request requirement — this is a two-person dev/design pair, so review happens through direct conversation and Vercel preview checks rather than formal PRs.

### Commit Messages
- Start with a verb: "Add author dashboard layout", "Fix rubric accordion state", "Update spacing tokens"
- Reference the relevant page or feature area when it helps clarify scope

---

## Key Technical Concepts

### Reviewer Console — The Core Feature
- **Horizontal split-pane:** OER content left, rubric panel right. Supports manual resizing; for the live reviewer flow the left panel stays visible by default, while the read-only author-facing feedback view defaults to collapsed.
- **Annotation engine:** contextual menu on text selection, plus a hotspot annotation type for non-text elements (used specifically for the Torus/extension workflow). Annotations carry an optional tag — Action Item or Quick Fix — and can link to zero, one, or multiple rubric criteria (multi-criteria linking is currently tabled on the frontend, pending a junction-table backend change).
- **Rubric scoring:** per-criterion accordion with three rating states — Does Not Meet / Exemplifies / Exceeds — each with its own comment field where required.
- **Auto-save:** rating selections and annotations trigger a save; there's also a dedicated autosave pattern for the free-form General Comments field.
- **Validation:** full rubric completion is required before submission; ratings outside "Exemplifies" require at least one linked annotation or note as evidence.

### Content Rendering
- Format-specific rendering per file type is the intended architecture (PDF via PDF.js, HTML via a sanitized iframe/shadow DOM). Audio and image annotation support (waveform-based and canvas-overlay, respectively, per the original tech spec) — verify current implementation status before relying on it, as this hasn't come up in recent build work.
- For OLI Torus (interactive, non-ingestable OER), there's no live in-platform rendering at all — the reviewer console instead displays a stack of screenshots captured via the browser extension.

### Data Integrity
- Annotations are stored with a JSONB anchor (shape varies by format, tagged with an `anchor_type` discriminator) plus a `criterion_ids[]` array supporting 0, 1, or multiple links.
- Feedback is licensed under CC BY-ND (Attribution-NoDerivs).

---

## Team

**Team Mask'd** — METALS Capstone project team

| Team Member | Primary Role | Secondary Role |
|---|---|---|
| Dimple Lin | Project Lead | Product |
| Kang Tan | Product Lead | Development |
| Monica Xu | Research Lead | Design |
| Sara Liang | Design Lead | Project |
| Allison Dayton | Development Lead | Research |

Partners: CMU Open Learning Initiative (OLI), Maricopa Community Colleges

---

## Current Project Phase

Core review workflows are built and functional: author and reviewer dashboards, the reviewer console (annotation + rubric scoring), the review report (author-facing feedback view), the OER submission flow, and a simple onboarding/settings/navbar layer.

Active focus: the interactive-OER (OLI Torus) review workflow, spanning three pieces — the reviewer dashboard's Begin/Continue Review entry point, the write-capable browser extension for annotating live Torus pages, and a screenshot-based left panel in the review console for reviewing those annotations back in the platform. Alongside this, the extension is being brought into visual alignment with the platform's actual design tokens (colors, typography), since it was originally built with its own independent, hardcoded styling.

Not yet started: the Coordinator dashboard/role, the Adopter-facing certification surface, and the read-only OER-discovery browser extension (a separate, lower-priority extension from the one described above).