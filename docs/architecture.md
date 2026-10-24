# Architecture

Open 4 Peer Review (O4PR) — internally the "OLI Annotation Platform" — is a
rubric-based peer-review tool for Open Educational Resources (OER). It has two
clients over one shared backend:

1. A **Next.js web app** (per-role dashboards + a full review console, plus an
   in-app AI chat assistant), and
2. A **Chrome extension** that injects the same review console directly into
   OER content hosted in the [OLI Torus](https://oli.cmu.edu) authoring
   environment.

Both talk to the same **Supabase** project. The web app is deployed to
**Vercel** (production: `annotation-platform-seven.vercel.app`).

---

## Stack / layers

| Layer | Technology |
| --- | --- |
| Framework | Next.js **16.2.3** (App Router), React **19.2.4** |
| Language | TypeScript 5 (path alias `@/* → ./*`) |
| Styling | Tailwind CSS **v4** via `@tailwindcss/postcss` (see [design-system.md](design-system.md)) |
| Backend | Supabase — Postgres + Auth + Storage + Realtime |
| Auth/session | `@supabase/ssr` (browser, server, and proxy cookie bridges) |
| AI | Google Gemini via `@google/generative-ai` (AI chat feature) |
| PDF | `pdfjs-dist` + `react-pdf` (PDF review viewer) |
| Testing | Vitest (`vitest.config.ts`; tests under `features/ai-chat/__tests__/`) |
| Hosting | Vercel (production: `https://annotation-platform-seven.vercel.app`) |
| Extension | Chrome MV3, bundled separately with esbuild (see [extension.md](extension.md)) |

> ⚠️ **This is not the Next.js in your training data.** Per the repo's
> `AGENTS.md`, this Next.js version has breaking API/convention changes. Read
> the relevant guide under `node_modules/next/dist/docs/` before writing code.
> The most visible change is that **Middleware is now called Proxy** (see
> below).

### Routing surface

App Router segments under `app/`:

- Auth / entry: `login/`, `onboard/`, `auth/callback/` (route handler)
- Per-role dashboards: `reviewer/`, `coordinator/`, `author/`, plus `dashboard/`
- The review console: `review/`
- Route handlers under `api/`: `api/ai-chat/`, `api/snapshot/`,
  `api/snapshot/page/`, `api/snapshot/[fingerprint]/`

### Logical layers of the web app

```
Request
  │
  ▼
proxy.ts  ──────────────► session refresh + auth-gate redirects (edge)
  │
  ▼
App Router (app/)
  ├─ Server Components (default)        ── read data via lib/supabase/server.ts
  ├─ Route Handlers (app/**/route.ts)   ── auth/callback, api/snapshot/*, api/ai-chat
  ├─ Server Actions (app/**/actions.ts) ── dashboard/role mutations
  └─ Client Components ('use client')   ── review console, dashboards, AI chat, hooks
       │
       ▼
Data access
  ├─ lib/supabase/queries.ts   ── typed query helpers (take a Supabase client)
  ├─ lib/supabase/{client,server}.ts
  └─ Supabase Realtime (postgres_changes) for live updates
```

- **Server Components** are the default and read with the server client
  (`lib/supabase/server.ts`), which bridges Supabase auth cookies through
  `next/headers`.
- **Client Components** use the browser client (`lib/supabase/client.ts`) and
  hooks such as `useReviewAutoSave` and `useReviewTracking`.
- **Route Handlers** currently in the app:
  - `app/auth/callback/route.ts` — OAuth / magic-link callback; exchanges the
    code for a session and routes based on onboarding state.
  - `app/api/ai-chat/route.ts` — the AI chat endpoint; calls Google Gemini
    (`GEMINI_API_KEY`, model `GEMINI_MODEL` default `gemini-2.5-flash`).
  - `app/api/snapshot/route.ts` — authenticated `POST`; validates a submitted
    OER URL against the allow-list in `lib/oer-platform.ts` and snapshots the
    page via `lib/snapshot-utils.ts` (`fetchAndSnapshot`).
  - `app/api/snapshot/page/route.ts` and `app/api/snapshot/[fingerprint]/route.ts`
    — serve stored snapshot content back to the app.
- **AI chat** lives in `features/ai-chat/` (widget/panel/context components,
  `server/promptBuilder.ts`, rubric data under `rubric-data/`, and tests). Its
  Postgres tables are `ai_chat_sessions` / `ai_chat_messages` / `ai_chat_events`
  (see [database.md](database.md)).

---

## Vercel / Supabase / Next.js relationship

```
        ┌────────────────────────────────────────────┐
        │              Vercel (CDN/SSR)              │
        │   annotation-platform-seven.vercel.app     │
        │  ┌──────────────────────────────────────┐  │
        │  │  Next.js 16 app                      │  │
        │  │  proxy.ts (auth gate)                │  │
        │  └──────────────┬───────────────────────┘  │
        └─────────────────┼──────────────────────────┘
                          │  @supabase/ssr (JWT in cookies)
                          ▼
        ┌────────────────────────────────────────────┐
        │                 Supabase                   │
        │  Postgres + RLS                            │◄── Chrome extension
        │  Auth (GoTrue)                             │    (REST/Auth/Storage,
        │  Storage (documents, screenshots, …)       │     talks to Supabase
        │  Realtime                                  │     directly)
        └────────────────────────────────────────────┘
```

- **Next.js** is the application framework. It renders server-side on Vercel and
  hydrates client components in the browser.
- **Vercel** hosts and serves the Next.js app. Deployment is push-based;
  `.vercel` and `.env*` are git-ignored and there is no `vercel.json` (default
  settings). `next.config.ts` is empty. Preview deploys use
  `open4peerreview-<hash>-allimaeeees-projects.vercel.app`.
- **Supabase** is the single source of truth for auth and data. The web app
  never uses a service-role key in the browser — everything runs through the
  **anon key + Row Level Security** (see [database.md](database.md)). Auth is
  cookie-based via `@supabase/ssr`, which is what lets `proxy.ts` refresh
  sessions at the edge.

Storage buckets in use include `documents` (uploaded submissions) and
`screenshots` (extension captures), plus snapshot storage for imported OER
pages.

---

## proxy.ts's role

`proxy.ts` (repo root) is **the Next.js middleware**. As of Next.js 16 the
middleware entrypoint is named `proxy` instead of `middleware` — see
`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`:

> "Starting with Next.js 16, Middleware is now called Proxy to better reflect
> its purpose. The functionality remains the same."

It runs on every matched request and does two jobs:

1. **Session refresh.** It builds a `createServerClient` wired to the request /
   response cookies and calls `supabase.auth.getUser()`. This validates the JWT
   against the Supabase Auth server (unlike `getSession()`, which only reads
   cookies) and writes refreshed tokens back onto the response cookies. A
   `redirectWithCookies()` helper copies those refreshed cookies onto redirect
   responses so the browser still receives the new token when the proxy
   redirects.
2. **Auth-gate redirects.**
   - A logged-in user hitting `/` or `/login` → redirected to the sanitized
     `?next=` path if present, otherwise to their **role-based dashboard**:
     `/coordinator` or `/author` if their `users.roles` array contains that
     role, else `/reviewer`.
   - An unauthenticated user hitting `/review*` → redirected to
     `/login?next=<path+query>` (the full path and query, e.g.
     `?document=&review=`, is preserved so login can return them to the exact
     review — this is what the extension's "Open Console" deep link relies on).

Its matcher scopes it narrowly:

```ts
export const config = {
  matcher: ['/', '/login', '/review/:path*'],
}
```

> Only `/review` is gated by the proxy; the dashboards (`/reviewer`,
> `/coordinator`, `/author`, `/dashboard`) and `/onboard` are **not** in the
> matcher and enforce access in their own server components + RLS. Proxy is an
> *optimistic* auth gate, not the authorization layer — actual authorization is
> enforced by Postgres **RLS** on every query. Never rely on `proxy.ts` alone.

---

## How the extension talks to the main app

The extension and the web app are **two clients over one Supabase backend**,
loosely coupled. The extension does **not** call the Next.js app's API for data
— it talks to Supabase directly and reuses the web app only for auth handoff and
deep links. Three channels connect them:

1. **Extension → Supabase (direct REST/Auth/Storage).** The extension's
   background service worker calls Supabase PostgREST, Auth (`/auth/v1/token`),
   and Storage (`screenshots` bucket) using the anon key + the reviewer's access
   token. It reads and writes the **same `reviews` / `review_scores` /
   `annotations` / `score_comments` rows** the web review console uses.

2. **Web app → extension (auth handoff).** The extension picks up the reviewer's
   Supabase session from the web app in two ways: a base64 `oer_token` query
   param appended when the app opens a Torus page, and by reading the app's
   Supabase auth cookies from the deployed origin
   (`annotation-platform-seven.vercel.app`). A dashboard content script
   (`dashboard.js`) also scans `localStorage` for the Supabase session and
   forwards it to the background worker.

3. **Extension → web app (deep link).** From the injected review panel, an
   "Open Console" link points back at the app's `/review` route
   (`${OERHUB_URL}/review?document=...&review=...`), which lands on the one
   prefix `proxy.ts` guards. `OERHUB_URL` is injected at extension build time.

See [extension.md](extension.md) for the full extension architecture, the
build-time `OERHUB_URL` injection, and the domain-coupling caveats.

---

## Known cross-cutting notes

- **Domain coupling.** The production domain
  (`annotation-platform-seven.vercel.app`) is referenced in the extension build
  and background worker. If the app moves domains, update those together — see
  [extension.md](extension.md). (Note: the repo's `CLAUDE.md` still mentions an
  older `oerhub.vercel.app` origin — that is stale.)
- **Type source.** The typed clients import `Database` from
  `@/types/database.types` (the Supabase-generated file);
  `lib/supabase/types.ts` now only re-exports that plus hand-written domain
  types (anchor shapes). See [database.md](database.md).
