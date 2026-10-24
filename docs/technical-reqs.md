# Technical Requirements: Takeover & Design Decisions

Open 4 Peer Review (O4PR) / OER Certification Hub, built by Team Mask'd (METALS Capstone) with CMU OLI and Maricopa Community Colleges.

This document has two parts:

1. **Takeover requirements** — what a new owner or team needs (access, accounts, knowledge, tooling) to run, deploy, and evolve the system.
2. **Technical design decisions** — what was chosen, why, and what the tradeoffs and known debts are.

It complements, and does not replace, `CLAUDE.md` (project conventions), `docs/` (`architecture.md`, `database.md`, `extension.md`, `config-and-environment.md`, `frontend.md`, `design-system.md`), and `PRIVACY.md`. Where those files go deeper, this one links to them rather than repeating them.

> **Verify before trusting.** Several values here (domains, project refs, bucket names) were true at the time of writing and are known to drift. Items marked **[VERIFY]** are things the previous team should confirm during handoff.

---

## 1. System Summary

Two clients share one backend:

```
 Next.js 16 web app (Vercel) ──┐
                               ├──► Supabase (Postgres + RLS, Auth, Storage, Realtime)
 Chrome MV3 extension ─────────┘
 (OLI Torus review)
                      Next.js route handlers ──► Google Gemini (AI chat)
                                             ──► external OER sites (snapshot fetch)
```

| Concern | Choice |
| --- | --- |
| Web framework | Next.js 16.2.3 (App Router), React 19.2.4, TypeScript 5 |
| Styling | Tailwind CSS v4, tokens in `app/globals.css` |
| Data / auth / files | Supabase (Postgres, Auth, Storage, Realtime) via `@supabase/ssr` and `supabase-js` |
| AI | Google Gemini (`@google/generative-ai`), default model `gemini-2.5-flash` |
| PDF | `pdfjs-dist` + `react-pdf` |
| Hosting | Vercel (default settings, no `vercel.json`, empty `next.config.ts`) |
| Extension | Vanilla TypeScript, Chrome MV3, Shadow DOM, esbuild |
| Tests | Vitest, `features/ai-chat/__tests__/` only |

Product status and roles are in `CLAUDE.md`. Author, Reviewer, and the Torus extension path are built. The Coordinator dashboard exists in part, and the Adopter surface and the read-only discovery extension are not started.

---

## 2. Takeover Requirements

### 2.1 Accounts and access to transfer

None of these live in the repo. Without them the system cannot be deployed or changed.

| Asset | Why it's needed | Notes |
| --- | --- | --- |
| **GitHub repo** `allimaeeee/Open4PeerReview` | Source of truth for code | Currently under a personal account. Transfer ownership, or move to an org the owner controls. |
| **Supabase project** | Database, Auth, Storage, RLS policies | **The live project is the schema of record** (see 2.3). Need Owner role, not just API keys. Project ref is hardcoded in the extension **[VERIFY]**. |
| **Vercel project** | Production + preview hosting, env vars | Preview URLs currently sit under a personal Vercel scope. Transfer or re-create under the new team. |
| **Chrome Web Store developer account** | Will publish the "OER Review Console" extension | Held by Allison Dayton (allisondayton@gmail.com). The listing is **not yet public**: for now users install the extension manually (load unpacked from a build or `dist.zip`). Posting the listing is a next step. Ownership of a published listing cannot be casually moved, so decide the owning account before publishing. |
| **Google AI (Gemini) API key** | AI chat feature | Server-only. Rotate on handoff. |
| **Figma** (Design System file) | Token foundations, logos and icons | Read access is enough for most work. |
| **Domain / DNS** | Currently `*.vercel.app` | No custom domain exists. If one is added, see 2.6. |
| **OLI Torus access** (`proton.oli.cmu.edu`) | Testing the extension against real content | Needs a CMU/OLI-provided test account **[VERIFY]**. |
| **Partner agreements** | Maricopa/OLI data and pilot terms | Funded by the U.S. Dept. of Education per `PRIVACY.md`. Confirm data-handling obligations transfer with the system. |

**Rotate on transfer:** Supabase anon and service keys, the Gemini key, and any Vercel tokens. Remove departing members from all of the above.

### 2.2 Local environment

- Node 20+ (types are `@types/node@20`), npm. There is no lockfile alternative, so use npm.
- `.env.local` with:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser, server, and `proxy.ts`)
  - `GEMINI_API_KEY` (server-only, never `NEXT_PUBLIC_`); optional `GEMINI_MODEL`
- There is **no `.env.example`**. Adding one is a cheap first task.
- Commands: `npm run dev`, `build`, `lint`, `test`. Extension: `npm run build:ext[:dev]`, `watch:ext[:dev]`, `package:ext`.
- A local Supabase stack **cannot be reproduced from the repo** (no committed `supabase/migrations/`, no migrations for core tables). Day-to-day development runs against the hosted project or a Supabase branch.

### 2.3 Knowledge a new owner needs

1. **Next.js 16 is not the Next.js most people know.** Middleware is now `proxy.ts`. `AGENTS.md` requires reading `node_modules/next/dist/docs/` before relying on older conventions.
2. **RLS is the authorization layer.** Clients use the anon key. Server Components, the extension, and the browser all depend on Postgres policies. `proxy.ts` is only an optimistic gate, and it matches just `/`, `/login`, and `/review/*`.
3. **The schema of record is the hosted Supabase project.** `schema.sql` is a 0-byte placeholder. Only the AI-chat migration (`features/ai-chat/supabase/migrations/20260706_ai_chat_history.sql`) is committed. `types/database.types.ts` is generated and must never be hand-edited.
4. **The extension is a separate codebase.** It has its own build, its own Supabase REST client (raw `fetch` via a background service worker), and a mirror of the design tokens.
5. **Multi-rubric reviews.** A `reviews` row is reviewer × document × **rubric**. Recent commits fixed several bugs where reads and writes resolved the wrong rubric's row ("anchor row" bugs), and one known issue, scores reverting on tab switch, was noted as in progress. Anyone touching `useReviewAutoSave`, `review-save-context`, or `app/review/` should read those commits first.
6. **Tailwind v4 tokens.** Colors, type, spacing, and radii are semantic tokens in `app/globals.css`. Hardcoded values are a convention violation.

### 2.4 Supabase backend audit and gaps (not in the repo)

**Audit method and date.** Read-only catalog queries against the linked production project (`supabase db query --linked`, `supabase db advisors --linked`) on 2026-10-24. Nothing was modified. Counts below are a snapshot and will drift, so re-run before relying on them.

**What the live project contains**

| Area | Finding |
| --- | --- |
| Tables (`public`) | 21, **all with RLS enabled**, none with `FORCE` RLS. 66 policies in `public` and `storage` combined; every table has at least one. Busiest: `annotations`, `reviews`, `review_scores` (6 each), `documents`, `users`, `review_rubric_submissions` (5 each). |
| Functions | 17 in `public`. Security-definer: `auto_decline_other_assignments`, `current_user_role`, `handle_new_user`, `is_org_coordinator_for_document`, `review_approved_for_author`, `review_has_submission`, `rls_auto_enable`, `rubric_submitted_for_review`, `update_torus_document_pages`. |
| Triggers (DB-level business rules) | `enforce_all_criteria_scored` (blocks submitting a review with unscored criteria), `lock_submitted_annotations` and `lock_submitted_scores` (submitted reviews become read-only), `guard_preset_rubrics`, `auto_decline_other_assignments` (accepting one assignment declines the others), `set_review_score_document_id`, and `updated_at` / `submitted_at` / `last_saved_at` maintenance. |
| Storage buckets | `documents` (**public**), `screenshots` (**public**), `openstax-snapshots` (private, `text/html` only, 10 MB limit). Storage policies: authenticated read and upload on each; `documents` also has owner-only update and delete, scoped by the first path folder equalling `auth.uid()`. |
| Rubric seed data | 6 preset rubrics in the DB with 8, 10, 8, 7, 9, and 8 criteria. These match the criteria counts in `CLAUDE.md` (Copyright is titled "Copyright Review" in the DB). |
| Migration history | **65 migrations** recorded remotely, `20260527150705` to `20260714032524`, applied through the dashboard or MCP. **None are in the repo**: there is no `supabase/migrations/`. A local `supabase/` folder exists only as gitignored CLI link state (`supabase/.temp/`). |

**Advisor findings (all WARN, no ERROR)**

| Finding | Count | What it means / action |
| --- | --- | --- |
| `anon_security_definer_function_executable` and `authenticated_...` | 9 each | Security-definer functions are callable through the REST API by the `anon` role. Review each; `revoke execute ... from anon` where the function is only used by policies or triggers. Highest priority. |
| `function_search_path_mutable` | 10 | Functions without a pinned `search_path` (including `current_user_role`, `handle_new_user`, and the lock/enforce triggers). Add `set search_path = ''` or `public`. |
| `pg_graphql_anon_table_exposed` and `..._authenticated_...` | 21 each | Tables are visible in the GraphQL schema. RLS still applies. If GraphQL is unused, disable the `pg_graphql` extension or revoke privileges. |
| `auth_leaked_password_protection` | 1 | Disabled. Enable in Auth settings. |
| `auth_rls_initplan` | 44 | Policies call `auth.uid()` per row. Wrap as `(select auth.uid())` for performance. |
| `multiple_permissive_policies` | 56 | Overlapping permissive policies on the same table/action. Consolidate for performance and readability. |
| `unindexed_foreign_keys` (INFO) | 19 | Foreign keys with no covering index (e.g. `annotations.review_id`, `ai_chat_sessions.user_id`). Add indexes as tables grow. |
| `unused_index` (INFO) | 12 | Indexes never used so far. Low priority; confirm against real traffic before dropping. |

**Things to decide, not just fix**

1. **Public buckets.** `documents` and `screenshots` are flagged `public`, which means objects are readable by anyone who has the URL, regardless of the authenticated-only read policies. Submitted OER drafts and reviewer screenshots (which may show unpublished author content) are the affected data. Decide whether that is intended; if not, make them private and serve signed URLs.
2. **`institutions` write access.** Any authenticated user can insert (`with check (true)`). Probably fine for onboarding, but it allows junk or duplicate rows.
3. **Two sources of role truth.** `current_user_role()` is security-definer and reads the role enum, while routing uses `users.roles[]`. Confirm policies that use the function agree with the array (see 3.3).
4. **Broad read access.** From `supabase/exports/policies.sql`: `documents: authenticated read` and `users: authenticated read profile` let **any signed-in user read every document row and every user profile** (including email). Confirm this is intended for the pilot; if not, scope reads to authors, assigned reviewers, and same-institution coordinators.
5. **Rubric content source of truth.** The **DB is canonical** (team decision). `features/ai-chat/rubric-data/` is a copy used in AI prompts. Counts match today, but nothing enforces it, so update the copy whenever DB rubrics change.

**Interim export (in the repo).** Until a real baseline exists, the policies, functions, and triggers are exported as reference SQL in `supabase/exports/` (`policies.sql`, `functions.sql`, `triggers.sql`), generated on 2026-10-24 from `pg_policies`, `pg_get_functiondef()`, and `pg_get_triggerdef()` via the read-only MCP. They are snapshots for review and diffing, **not migrations**, and they omit table DDL, the `auth.users` signup trigger, and the `rls_auto_enable` event trigger. Re-export after any policy change.

**Why the CLI can't baseline this yet.** `supabase db pull` fails with `DbPullMigrationConflictError`, because the remote history has 65 versions and the local `supabase/migrations/` is empty. The error suggests running `migration repair --status reverted` for each; **do not do that** — it edits the production migration-history table and does not recover the SQL. Instead:

1. Install Docker Desktop (the CLI needs it for `db dump` and `db pull`).
2. `npx supabase db dump --linked -f supabase/migrations/<timestamp>_baseline.sql` for the `public` schema. Storage bucket rows and `storage.objects` policies live in the `storage` schema, so check they are captured, and add them by hand if not.
3. Then either mark that baseline as applied on the remote with `migration repair --status applied <timestamp>`, or start with an empty history on a **new** Supabase branch and compare. Try it on a branch first.

**Other gaps outside Supabase**

| Gap | Impact | Suggested action |
| --- | --- | --- |
| Auth config (providers, redirect URLs, email templates) | Not queryable from SQL; dashboard-only | Screenshot or document it in the handoff |
| `.env.example` | Onboarding friction | Add one (names only, no values) |
| Test coverage | Only `features/ai-chat/` is tested | See 2.7 |
| CI | No GitHub Actions or equivalent is evident **[VERIFY]**; Vercel build is the only gate | Add lint + test + typecheck + extension build |
| Runbook / on-call info | None | See 2.8 |

### 2.5 Deployment and release process

**Web app.** Push-based deploys on Vercel.
- `main` deploys to production; `testing` is the backend-complete staging branch; `design/*` are feature branches (see `CLAUDE.md`). There is no PR requirement today. A larger team should add branch protection and PRs.
- `NEXT_PUBLIC_*` values are inlined at **build time**, so changing them requires a redeploy.

**Schema.** Changes are applied manually via the Supabase SQL editor, then types are regenerated. The Supabase MCP server in `.mcp.json` is read-only (inspect schema, RLS policies, advisors); it is not used to apply changes. To bring the backend under version control, run `npx supabase init && npx supabase link --project-ref <ref> && npx supabase db pull`, which writes the baseline to `supabase/migrations/`.
```bash
npx supabase gen types typescript --project-id <ref> > types/database.types.ts
```
Backend changes must land **before** frontend work that depends on them.

**Extension.** Currently distributed manually: users import the built extension themselves (run `npm run package:ext`, then load it in Chrome developer mode). The Chrome Web Store listing is not public yet; posting it is a planned next step.
1. Bump `version` in `extension/manifest.json`.
2. `npm run package:ext` produces `extension/dist.zip` (gitignored, regenerated each time).
3. Once the listing exists, upload in the Web Store dashboard and update the data-use disclosures if collection changed. Until then, hand the zip to users.

The production app URL is baked in at build time (`OERHUB_ENV` selects dev or prod), so build the extension for the environment it will talk to.

### 2.6 Coupling that breaks silently when infrastructure changes

Moving off the current Vercel domain, changing Supabase projects, or moving Torus hosts requires coordinated edits:

| Change | Places to update |
| --- | --- |
| App domain | `OERHUB_URL` in `extension/build.mjs`; hardcoded cookie-source origin in `extension/src/background.ts`; manifest `host_permissions` and `content_scripts`; dashboard script's allowed-hostname list in `extension/src/dashboard.ts` |
| Supabase project | `NEXT_PUBLIC_SUPABASE_*` env vars; **hardcoded** `SUPABASE_URL`, anon key, and `SUPABASE_REF` in `background.ts`; regenerated types |
| Torus host | `proton.oli.cmu.edu` in the manifest, `webNavigation` filters, and URL checks in `background.ts` |
| Auth redirect URLs | Supabase Auth allowed redirect list (for `auth/callback`) |

**Production domain:** `https://annotation-platform-seven.vercel.app` (confirmed by the team; no custom domain is planned). `CLAUDE.md` still cites `oerhub.vercel.app` as the prototype URL, which is out of date and should be corrected.

### 2.7 Quality, security, and maintenance baseline

Recommended work for a new owner, roughly in priority order:

1. **Capture the backend in version control** (schema, RLS, functions, storage policies, seed). Highest-leverage item; nothing else is safely changeable without it.
2. **Security review of RLS** using Supabase advisors (`get_advisors`) and a policy audit, especially for `documents`, `reviews`, `annotations`, and the author-feedback tables. Review events and AI-chat logs also contain user behavior data.
3. **Narrow the extension's permissions.** `host_permissions` includes `<all_urls>` and `https://*.vercel.app/*`. Both are broader than needed (see `docs/extension.md`), and they slow Web Store review. `cookies`, `tabs`, and `webNavigation` should each be re-justified.
4. **Inject the extension's Supabase URL/anon key at build time** (like `__OERHUB_URL__`) rather than hardcoding.
5. **Test layers.** Add component and E2E tests (Playwright or similar) for the review console, autosave, and multi-rubric flows, which is where the recent regressions were. Extend Vitest beyond `features/ai-chat/`.
6. **CI** on every push: `npm run lint`, `npm test`, `next build` (which typechecks), and `npm run build:ext`. `tsconfig.json` excludes `extension/`, so typecheck it separately.
7. **Dependency hygiene.** Next 16 and React 19 are recent; pin and review upgrades deliberately.
8. **Privacy and compliance.** `PRIVACY.md` carries unresolved placeholders (e.g. `[CHECK LATER — confirm public release date]`) and dates from June 2025. Re-confirm it matches current data collection (annotations, screenshots, review telemetry, AI chat logs) before any public release. Feedback is licensed CC BY-ND.
9. **Review the SSRF guard and open-URL submissions.** `lib/url-safety.ts` (an SSRF guard for fetching submitted URLs) and the snapshot routes now accept any public https OER URL (commit `b3a341f`). Since arbitrary URLs are fetched server-side, review the guard (private IP ranges, redirects, DNS rebinding) and rate-limit `/api/snapshot`. Also, at the time of writing the working tree has uncommitted edits to `.mcp.json` (adds the read-only Supabase MCP server) and two `docs/` files; commit or discard them before handoff.

### 2.8 Operational requirements

| Area | Current state | Needed |
| --- | --- | --- |
| Monitoring / error tracking | None evident **[VERIFY]** | Add Vercel analytics plus an error tracker (e.g. Sentry) for web and the extension |
| Backups | Whatever the Supabase plan provides | Confirm plan tier, PITR, and a tested restore procedure |
| Storage growth | Screenshots (one per annotation) and HTML snapshots accumulate | Retention policy and size monitoring |
| Cost | Supabase, Vercel, and Gemini usage | Budget alerts; rate limiting on `/api/ai-chat` and `/api/snapshot` |
| Secrets | `.env.local` + Vercel env vars | A team secret store; document who holds what |
| Support | Pilot users at Maricopa | A support contact and an incident path for reviewers mid-review |

---

## 3. Technical Design Decisions

Each entry gives the decision, the rationale, and the consequences a maintainer should know.

### 3.1 Supabase as the single backend, with RLS as the authorization boundary

- **Decision:** Browser, server, and extension all use the anon key plus the user's JWT. There is no custom API layer for data.
- **Why:** A small team could ship fast. Auth, Postgres, Storage, and Realtime come as one product, and the extension can talk to the same rows as the web app.
- **Consequences:** Security depends entirely on RLS correctness. All 21 public tables have RLS enabled (audited 2026-10-24), but the policies are not under version control (see 2.4). The service-role key must never reach the browser or extension. Business rules that can't be expressed in policies live in DB functions or client code.

### 3.2 Cookie-based sessions via `@supabase/ssr`, refreshed in `proxy.ts`

- **Decision:** `proxy.ts` calls `supabase.auth.getUser()` on matched requests, which validates the JWT and writes refreshed cookies. It also redirects logged-in users from `/` and `/login` to a role-based dashboard, and unauthenticated users from `/review*` to `/login?next=…`.
- **Why:** Server Components need the session, and `getUser()` is safer than `getSession()` (which doesn't validate).
- **Consequences:** The matcher is deliberately narrow, so other pages enforce access in their own server components and RLS. The `next` parameter is sanitized to same-origin relative paths only, which is an open-redirect guard. Preserve it.

### 3.3 Multi-role users via `users.roles text[]`

- **Decision:** One person can be author, reviewer, and coordinator at once. Roles are an array; the legacy `user_role` enum (`reviewer`, `author`, `admin`) lacks `coordinator`.
- **Why:** Matches the real domain (an author reviews others' work).
- **Consequences:** Two sources of role truth exist (`role` enum and `roles[]`). `proxy.ts` and routing use `roles[]`. Policies using `current_user_role()` read the enum, so confirm they agree before relying on either. A student role was also added recently in onboarding and attribution.

### 3.4 Review model: one `reviews` row per reviewer × document × rubric

- **Decision:** Scores, annotations, and comments hang off a rubric-specific review row. `review_rubric_submissions` records per-rubric submission.
- **Why:** Rubrics are independent instruments (6 templates) that may be assigned, saved, and submitted separately.
- **Consequences:** This is the most bug-prone area. Reads and writes must always resolve the row for the **active rubric**. Recent fixes addressed anchor-row, tab-bleed, and relink bugs. Keep one resolver function for "the review row for this rubric" and test it. A migration (`review_scores.document_id` FK plus trigger) was added after orphaned score rows were found in production.

### 3.5 Annotations: JSONB anchors with a type discriminator

- **Decision:** `annotations.anchor` is JSONB, tagged by `anchor_type` (`text-range`, `dom-range`, `bbox`, `timestamp`). Linked criteria are intended as `criterion_ids[]`; current schema still has a nullable `rubric_item_id`, and multi-criteria linking is tabled pending a junction-table change.
- **Why:** Different formats (PDF, HTML, image, audio, Torus screenshots) anchor differently, and one flexible column avoids a table per format.
- **Consequences:** Anchor shapes are enforced only in TypeScript (`lib/supabase/types.ts`, `lib/anchoring/html.ts`, `lib/pdf-coords.ts`), not in the DB. Anchoring HTML against content that later changes can drift, so content is fingerprinted (SHA-256) and snapshotted.

### 3.6 Immutable HTML snapshots for external OER (OpenStax, Pressbooks, etc.)

- **Decision:** On submission the server fetches the URL, stores the HTML in Supabase Storage (`openstax-snapshots`) under its SHA-256 fingerprint, and records `source_url` and `content_fingerprint` on the document.
- **Why:** Reviewers annotate a stable artifact even if the live page changes; content-addressed storage de-duplicates.
- **Consequences:** The server fetches arbitrary user-supplied URLs, an SSRF risk. Mitigations are `isValidOerUrl` (public https only) and `lib/url-safety.ts` (`safeFetch`: DNS resolution check plus manual per-hop redirect validation, max 5). Keep all outbound fetches routed through it. Snapshots only capture server-rendered HTML, so JS-heavy pages are the reason Torus takes a different path (3.7).

### 3.7 Torus (interactive OER) reviewed through a browser extension plus screenshots

- **Decision:** Torus content can't be ingested or rendered in-platform, so a Chrome extension injects the rubric panel into the live page and captures a screenshot per annotation. The web console's left panel shows the screenshot stack. Reviewers choose either path from the Begin/Continue Review modal.
- **Why:** The only way to review interactive content faithfully is to review it where it runs.
- **Consequences:**
  - Annotation types include text highlights and **hotspots** for non-text elements.
  - The extension reads and writes the same `reviews`, `review_scores`, `annotations`, and `score_comments` rows as the web console, so any schema change affects two clients that ship on different cycles. The Web Store review delay means old extension versions will talk to new schemas, so make schema changes backward compatible.
  - Auth handoff uses three paths: a base64 `oer_token` query parameter, reading the app's Supabase cookies from the deployed origin, and a dashboard content script that forwards a `localStorage` session. This is functional but fragile, and the `oer_token` in a URL is a token-in-URL risk. Consider replacing it with `chrome.runtime` messaging from the dashboard script only.
  - Screenshots are stored in the `screenshots` bucket.

### 3.8 Extension as separate vanilla-TypeScript codebase (Shadow DOM, esbuild)

- **Decision:** No framework, no shared components. Shadow DOM isolates styles from the host Torus page. Network calls go through the background service worker using raw `fetch`, not the Supabase SDK.
- **Why:** Small bundle, no CSS bleed into or out of a third-party page, and no build coupling to Next.js. Adopting a framework (e.g. Plasmo) was judged larger than the benefit for this phase and was deliberately deferred.
- **Consequences:** UI is implemented twice (rubric panel in React and in DOM code), so behavior can diverge. Design tokens are mirrored by hand in `lib/design-system/token-values.ts` and bundled fonts are copied into the extension. Bringing the extension in line with platform tokens is in progress.

### 3.9 Design system via Tailwind v4 `@theme` tokens

- **Decision:** `app/globals.css` is the single source of truth. Components reference semantic tokens (`bg-surface`, `text-text-primary`, `font-heading`). Rating-level colors derive from brand and feedback tokens via `var()`.
- **Why:** The brand palette changed several times; semantic tokens made those changes cheap.
- **Consequences:** `token-values.ts` for the extension must be synced manually (no generator yet). A build step that emits it from `globals.css` would remove that failure mode. Fonts: Newsreader (headings), Lato (body), JetBrains Mono (code), loaded with `next/font`. Each component defines a local `cx()` rather than importing a shared helper, which is an intentional convention here, so match it.

### 3.10 Component organization

- **Decision:** `components/ui` (primitives), `components/patterns` (compositions), `components/layout`, `components/auth`; route-specific pieces live in `app/<route>/components`. Server Components by default; `'use client'` for the console, dashboards, AI chat, and hooks.
- **Why:** Keeps shared pieces reusable without over-abstracting page-specific UI. The Review Report reuses the console's OER panel in a read-only mode.

### 3.11 Autosave and review tracking

- **Decision:** Rating and annotation changes trigger saves (`hooks/useReviewAutoSave.ts`); General Comments use a dedicated debounced pattern; `hooks/useReviewTracking.ts` writes `review_events` telemetry. Submission requires full rubric completion, and ratings other than "Exemplifies" require linked evidence (annotation or note).
- **Why:** Reviews are long sessions, so lost work is the worst failure. Evidence rules enforce rubric rigor.
- **Consequences:** Flush-on-navigation and on-submit paths matter (a prior bug lost notes). Validation currently runs in the client plus submission guard functions in the DB; confirm the DB guards are the real backstop.

### 3.12 AI assistant isolated in `features/ai-chat/`

- **Decision:** A self-contained module with client UI, `server/promptBuilder.ts` and `outputSpecs.ts`, rubric data, and its own Supabase migration and RLS. The route `app/api/ai-chat/route.ts` is auth-gated. Chats, messages, and events are persisted per user.
- **Why:** The AI-assisted moderation goal from the Hunt Statement is experimental. Isolation lets it change or be removed without touching the review core. It is the one area with tests (`promptBuilder` etc.).
- **Consequences:** Provider is Google Gemini, chosen by the team; swapping providers is contained to the route and prompt builder. Prompts embed rubric content from `rubric-data/`, which can drift from the DB rubrics (see 2.4). Chat logs are user data and belong in the privacy review. Add rate limiting and a spend cap.

### 3.13 Content rendering strategy by format

- **Decision:** Per-format rendering: PDF via PDF.js, HTML via sanitized iframe/shadow DOM, Torus via screenshots.
- **Consequences:** Audio and image annotation appear in the data model (`anchor_type` includes `timestamp` and `bbox`; `file_type` includes `audio`, `image`, `pptx`), but **audio, image, and pptx review are not implemented** (confirmed by the team). Don't promise them to partners.

### 3.14 Lean process, no PR gate, Figma only where needed

- **Decision:** Direct-to-code iteration against Vercel previews; Figma reserved for foundations, graphics, and complex novel pages; backend-before-frontend for schema changes; "Track A / Track B" build splits.
- **Why:** A two-person dev/design pair on a 7-month timeline optimizes for iteration speed.
- **Consequences:** Fast, but the safety nets a larger team needs (PRs, CI, tests, migrations) are absent. Section 2.7 lists what to add.

---

## 4. Suggested First 30 Days for a New Owner

| Week | Focus |
| --- | --- |
| 1 | Transfer accounts (2.1); rotate keys; confirm production domain and Supabase ref; get the app running locally against a Supabase branch |
| 2 | Dump schema, RLS, functions, storage policies, and seed data into `supabase/migrations/`; add `.env.example`; review the SSRF guard and snapshot routes (now committed) |
| 3 | Stand up CI (lint, test, build, extension build); RLS and permissions audit; add error tracking and rate limits |
| 4 | Write tests around multi-rubric review state and autosave; resolve the known tab-switch score-revert issue; narrow extension permissions; decide Coordinator and Adopter scope against the current PRD |

---

## 5. Open Questions

**Answered by the team**

1. **Production domain:** `https://annotation-platform-seven.vercel.app`. No custom domain is planned.
2. **Policies exported outside Supabase?** Not before 2026-10-24. Reference exports now live in `supabase/exports/` (see 2.4); the live project remains the source of truth until a baseline migration is created.
3. **Canonical rubric source:** the database.
4. **Audio, image, pptx review:** not implemented.
5. **Chrome Web Store listing:** owned by Allison Dayton (allisondayton@gmail.com). Not yet public; users import the extension manually. Posting it is the next step.
6. **Is the "scores revert on tab switch" issue (noted in `57ef2e6`) resolved?** The team expects so. `834f03f` fixed score writes landing on the console's anchor row instead of the owning rubric's row, which fits the symptom. No commit or test states it is fixed, so confirm against GitHub history and a manual check (score two rubrics, switch tabs, reload).

**For Maricopa Community Colleges to answer**

The system stores reviewer annotations and scores, extension screenshots, OpenStax/Pressbooks HTML snapshots, review telemetry (`review_events`), and AI chat logs. None of it has a retention job or a deletion flow today.

1. How long may each kind of data be kept, and does that differ for reviewers' work versus authors' submitted OER?
2. Who can request deletion (reviewers, authors, Maricopa), and what must happen to their data when they leave or close an account?
3. Who may access the data, and who owns it, after the capstone project ends?
4. Which agreements or funder terms (see `PRIVACY.md`, U.S. Dept. of Education) apply to this data, and do they transfer to a new owner?
5. Are there student-privacy (FERPA) or institutional review requirements for AI chat logs and review telemetry?
