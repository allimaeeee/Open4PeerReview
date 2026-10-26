# Technical Requirements: What It Takes to Run This Platform

Open 4 Peer Review (O4PR), also called the OER Certification Hub, was built by Team Mask'd (METALS Capstone) with CMU's Open Learning Initiative (OLI) and Maricopa Community Colleges.

This is a plain-language summary for the larger development team that will be taking this on. It covers what the platform needs from its technology, what the system has to do, and where we know there's work left. It's about the *requirements*, not a tour of today's tool choices. For the "how it's built right now" details, see `CLAUDE.md` and the files in `docs/`.

> **Heads up:** Numbers and settings below are a snapshot (last checked 2026-10-24) and drift quickly. Anything marked **[VERIFY]** should be re-confirmed during handoff.

---

## 1. The Short Version

OER authors submit their materials, reviewers score them against standardized rubrics and leave annotations, and authors get structured feedback to improve and eventually earn a certification stamp. Interactive content that can't be loaded into the platform (OLI Torus today) is reviewed on the live page through a browser extension.

To support that, the platform has to do five things well:

1. **Keep people's work safe.** Reviews are long sessions and lost work is the worst failure.
2. **Keep the right people in, and everyone else out.** Submissions are unpublished drafts and reviews are sensitive.
3. **Handle many kinds of content** (PDFs, web pages, interactive lessons) without breaking annotations when content changes.
4. **Stay consistent across two clients:** the web app and the browser extension both write to the same records.
5. **Be operable by a team.** That means versioned changes, automated checks, monitoring, and clear ownership.

Status: Author, Reviewer, and the Torus extension paths are built. The Coordinator experience is partial. The Adopter-facing surface and the read-only discovery extension haven't been started.

---

## 2. What the Platform Needs to Do (Functional Requirements)

| Capability | What it has to support |
| --- | --- |
| **Accounts and roles** | Sign-in, plus people who hold several roles at once (an author who also reviews someone else's work). Roles are author, reviewer, and coordinator; students were recently added. |
| **Submissions** | Upload files or submit a public web link. Multi-page submissions. Track status from submitted through under review, in revision, and certified. |
| **Review workspace** | Side-by-side view: content on the left, rubric on the right. Text highlights, plus "hotspot" annotations for things that aren't text. Annotations can be tagged (action item, quick fix) and linked to rubric criteria. |
| **Rubric scoring** | Six standard rubrics, each scored per criterion as Does Not Meet / Exemplifies / Exceeds. Scoring is independent per rubric, so one reviewer on one document can have several separate reviews in flight. |
| **Submission rules** | A review can't be submitted until every criterion is scored. Anything other than "Exemplifies" needs supporting evidence. Once submitted, scores and annotations are locked. |
| **Autosave** | Every rating and annotation is saved as it happens, and notes are saved on navigation and submit. |
| **Author feedback** | Authors see a read-only version of the reviewer's workspace with the scores and annotations. |
| **Interactive OER review** | For content that can't be embedded, reviewers use a browser extension on the live page. Each annotation captures a screenshot, and those screenshots show up back in the web review workspace. |
| **External content snapshots** | For web-based OER (OpenStax, Pressbooks, and similar), the platform saves a fixed copy of the page at submission time so reviewers always annotate the same thing. |
| **AI assistant** | An in-app assistant that helps with rubric-aware moderation. It's isolated from the review core so it can change or be removed without affecting reviews. |
| **Task assignment** | Reviewers see a task list; accepting one assignment automatically declines their other offers for the same work. |

**Not built, so please don't promise it to partners:** audio, image, and PowerPoint review (the data model leaves room for them, but nothing is implemented), the Coordinator dashboard in full, the public certification surface for educators, and the read-only discovery extension.

---

## 3. What the Platform Needs from Its Technology (Non-Functional Requirements)

### 3.1 Security and privacy

- **Access control has to live at the data layer,** not just in the screens. The web app, the server, and the extension all talk to the same data, so the data layer is the one place that can enforce who sees what. All 21 data tables currently have row-level security turned on.
- **Secrets stay server-side.** The AI key and any admin-level database key must never reach a browser or the extension.
- **Review data is sensitive.** It includes unpublished author content, reviewer judgments, screenshots, activity telemetry, and AI chat logs. Retention and deletion rules need to be set (see Section 7).
- **Server-side fetching of user-supplied URLs needs a guard.** The platform downloads pages from links people submit. We have a protective layer (public https only, DNS and redirect checks); it needs an independent security review and rate limiting.
- **Feedback is licensed CC BY-ND.** Keep that attribution intact wherever feedback is shown.

**Known security items to resolve** (from a read-only audit of the live backend, 2026-10-24; none are errors, all are warnings):

| Item | Why it matters | Priority |
| --- | --- | --- |
| Some backend functions can be called by signed-out users | Should be limited to internal use | High |
| File storage for submissions and reviewer screenshots is set to public-by-link | Unpublished drafts and screenshots are readable by anyone with the URL. Decide whether that's intended; if not, switch to private with time-limited links. | High |
| Any signed-in user can read all documents and all user profiles (including emails) | Fine for a small pilot; probably not for a larger rollout. Scope reads to authors, assigned reviewers, and same-institution coordinators. | High |
| Two sources of "what role is this person" (an older single-role field and the newer multi-role list) | They can disagree, and access rules may follow the wrong one | Medium |
| Functions without a pinned search path; leaked-password protection is off | Standard hardening | Medium |
| The data-query (GraphQL) endpoint exposes the table list | Disable if unused | Medium |
| Anyone signed in can create an institution record | Allows junk or duplicate rows | Low |

### 3.2 Data integrity and consistency

- **A review is one reviewer × one document × one rubric.** Anything that reads or writes scores must resolve the right rubric's record. This is where most recent bugs have lived (scores landing on the wrong rubric, state bleeding between tabs). It needs one shared lookup and real test coverage.
- **Business rules belong in the database as a backstop,** not only in the UI. Today the DB blocks submission with unscored criteria, locks submitted work, protects preset rubrics, and auto-declines competing assignments. Confirm these remain the real safety net.
- **Two clients, one schema.** The web app and the browser extension ship on different schedules (the extension goes through store review). Schema changes must be backward compatible so older extension versions keep working.
- **Annotation anchors must survive content changes.** Content is fingerprinted and snapshotted. Anchor formats (text range, DOM range, bounding box, timestamp) are only enforced in application code today, not in the database.
- **Rubric content has one source of truth: the database.** A copy used by the AI prompts can drift, so something should keep the two in sync.

### 3.3 Availability and reliability

- Reviewers work in long sessions, so autosave and flush-on-leave paths must be dependable.
- Backups need a defined plan: what tier of backup we have, whether point-in-time recovery is available **[VERIFY]**, and a *tested* restore.
- Pilot users are real people mid-review. There needs to be a support contact and an incident path for them.

### 3.4 Performance and scale

- Row-level-security rules currently re-evaluate per row (44 flagged) and overlap in places (56 flagged). Fine today, worth consolidating before data grows.
- 19 foreign-key relationships lack supporting indexes (for example, annotations by review). Add them as volume increases.
- Screenshots (one per annotation) and web snapshots accumulate. Plan for storage growth and a retention policy.

### 3.5 Cost control

- Three usage-based costs to watch: database and storage, hosting, and AI calls.
- The AI and snapshot endpoints need rate limiting and spend caps, and there should be budget alerts.

### 3.6 Compliance

- The privacy policy has unresolved placeholders and dates from mid-2025. Re-confirm it matches what's actually collected (annotations, screenshots, review activity, AI chat logs) before any public release.
- Funding from the U.S. Dept. of Education carries data-handling expectations that need to transfer with the system. Student-privacy (FERPA) applicability for review telemetry and AI logs is an open question for Maricopa.

---

## 4. Integration Requirements

How this platform has to plug into a larger organization and its ecosystem.

| Area | Requirement |
| --- | --- |
| **Identity** | Sign-in that supports multi-role users and email-based onboarding today. A larger org may want single sign-on; confirm early since roles drive routing and data access. |
| **Backend as code** | The live database is the schema of record, and **none of its 65 migrations are in the repo**. Before anyone else can safely change the backend, it needs to be captured as versioned migrations (tables, access rules, functions, storage rules, seed data). A reference export of policies, functions, and triggers is in `supabase/exports/`, but it's a snapshot, not a replacement. |
| **Environments** | Separate dev, staging, and production, each with its own data and keys. Right now, day-to-day development points at the hosted project because a local copy can't be rebuilt from the repo. |
| **Browser extension distribution** | Needs an owning publisher account, a store listing (not yet public), and a plan for narrowing its broad permissions, since they slow store review. |
| **External content sources** | OLI Torus and public OER sites (OpenStax, Pressbooks). Moving hosts or domains means coordinated edits in several places (see Section 6). |
| **AI provider** | Swappable. The provider call and prompt-building are contained in one module. |
| **Design system** | One set of design tokens drives the web app. The extension keeps a hand-synced copy, which should be generated automatically. |

---

## 5. What a Bigger Team Will Want in Place

The project moved fast with a two-person dev/design pair: direct-to-code, no pull request requirement, preview deployments as the main check. That was the right call for a 7-month capstone. It also means the safety nets a larger team expects are missing:

| Need | Where we are |
| --- | --- |
| **Code review** | No PR requirement or branch protection |
| **Automated checks on every change** | None evident **[VERIFY]**; the hosting build is the only gate. Should include lint, tests, type checks, and the extension build. |
| **Test coverage** | Only the AI module is tested. The review workspace, autosave, and multi-rubric flows (where the recent regressions were) have none. Add component and end-to-end tests. |
| **Versioned backend changes** | Not in the repo (see Section 4) |
| **Environment template** | No example config file; a quick win for onboarding |
| **Monitoring and error tracking** | None evident **[VERIFY]**, for either the web app or the extension |
| **Secrets management** | A shared secret store and a record of who holds what |
| **Runbook** | No on-call or incident documentation |

---

## 6. Things That Break Quietly If Infrastructure Moves

If the app's domain, the database project, or the Torus host changes, several values are hardcoded and need to change together:

| If this changes | Update these |
| --- | --- |
| App domain | Extension build setting, the cookie-source origin in the extension's background script, the extension manifest permissions, and the dashboard script's allowed-hostname list |
| Database project | Environment variables in the app, plus the URL, key, and project reference hardcoded in the extension (better: inject at build time), and regenerated types |
| Torus host | Extension manifest, navigation filters, and URL checks |
| Auth redirect URLs | The allowed-redirect list in the auth provider settings |

Production currently runs at `https://annotation-platform-seven.vercel.app` with no custom domain planned. `CLAUDE.md` still lists an older prototype URL that should be corrected.

---

## 7. Open Decisions

**For the incoming team**

1. Who owns the code repository, hosting, database project, AI key, and the extension publisher account? Today several sit under personal accounts. Decide the owning account for the store listing *before* publishing, because ownership of a published listing can't be casually moved. Rotate all keys at handoff.
2. Are the public storage buckets and the broad document and profile read access acceptable for the next phase?
3. Is single sign-on needed?
4. Scope and timing for the Coordinator and Adopter roles, checked against the current PRD.
5. Is the "scores revert when switching tabs" issue actually fixed? The team expects so (a related fix landed), but no test confirms it. Check manually: score two rubrics, switch tabs, reload.

**For Maricopa Community Colleges to answer**

The system stores reviewer annotations and scores, extension screenshots, web-page snapshots, review activity data, and AI chat logs. None of it has a retention job or a deletion flow today.

1. How long may each kind of data be kept, and does that differ for reviewers' work versus authors' submitted OER?
2. Who can request deletion (reviewers, authors, Maricopa), and what happens to their data when they leave?
3. Who may access and who owns the data after the capstone ends?
4. Which agreements or funder terms apply, and do they transfer to a new owner?
5. Are there FERPA or institutional review requirements for AI chat logs and review telemetry?

---

## 8. Suggested First 30 Days

| Week | Focus |
| --- | --- |
| 1 | Transfer accounts and rotate keys. Confirm domain and database project. Get the app running against a non-production database. |
| 2 | Capture the backend as versioned migrations. Add an environment template. Review the URL-fetching guard. |
| 3 | Stand up automated checks. Run the access-control audit and fix the high-priority items. Add error tracking and rate limits. |
| 4 | Write tests for multi-rubric review state and autosave. Narrow the extension's permissions. Decide Coordinator and Adopter scope. |
