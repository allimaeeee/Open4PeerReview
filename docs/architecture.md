# Architecture

Open 4 Peer Review (O4PR) — internally the "OLI Annotation Platform" — is a
rubric-based peer-review tool for Open Educational Resources (OER). It has two
clients over one shared backend:

1. A **Next.js web app** (author / coordinator / reviewer dashboards + a
   full-page review console), and
2. A **Chrome extension** that injects the same review console directly into
   OER content hosted in the [OLI Torus](https://oli.cmu.edu) authoring
   environment.

Both talk to the same **Supabase** project. The web app is deployed to
**Vercel**.

---

## Stack / layers

| Layer | Technology |
| --- | --- |
| Framework | Next.js **16.2.3** (App Router), React **19.2.4** |
| Language | TypeScript 5 (path alias `@/* → ./*`) |
| Styling | Tailwind CSS **v4** via `@tailwindcss/postcss` (see [design-system.md](design-system.md)) |
| Backend | Supabase — Postgres + Auth + Storage + Realtime |
| Auth/session | `@supabase/ssr` (browser, server, and proxy cookie bridges) |
| Hosting | Vercel (production: `https://oerhub.vercel.app`) |
| Extension | Chrome MV3, bundled separately with esbuild (see [extension.md](extension.md)) |

> ⚠️ **This is not the Next.js in your training data.** Per the repo's
> `AGENTS.md`, this Next.js version has breaking API/convention changes. Read
> the relevant guide under `node_modules/next/dist/docs/` before writing code.
> The most visible change is that **Middleware is now called Proxy** (see
> below).

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
  ├─ Route Handlers (app/**/route.ts)   ── app/auth/callback, app/api/snapshot/*
  ├─ Server Actions (app/**/actions.ts) ── dashboard/coordinator mutations
  └─ Client Components ('use client')   ── review console, dashboards, hooks
       │
       ▼
Data access
  ├─ lib/supabase/queries.ts   ── typed query helpers (take a Supabase client)
  ├─ lib/supabase/{client,server}.ts
  └─ Supabase Realtime (postgres_changes) for live comments
```

- **Server Components** are the default and do their reads with the server
  client (`lib/supabase/server.ts`), which bridges Supabase auth cookies through
  `next/headers`.
- **Client Components** use the browser client (`lib/supabase/client.ts`) and
  hooks such as `useRealtimeComments`, `useReviewAutoSave`, `useReviewTracking`.
- **Route Handlers** currently in the app:
  - `app/auth/callback/route.ts` — OAuth / magic-link callback; exchanges the
    code for a session and routes to `/onboard` or `/dashboard` based on
    `users.onboarding_completed`.
  - `app/api/snapshot/route.ts` — authenticated `POST`; validates a submitted
    OER URL against the allow-list in `lib/oer-platform.ts`, snapshots the page,
    and writes document rows.
  - `app/api/snapshot/[fingerprint]/route.ts` — authenticated `GET`; serves a
    stored HTML snapshot from Supabase Storage, sanitized and served with
    `Content-Security-Policy: frame-ancestors 'self'` so only the app can iframe
    it.

---

## Vercel / Supabase / Next.js relationship

```
        ┌─────────────────────────────┐
        │        Vercel (CDN/SSR)     │
        │   oerhub.vercel.app         │
        │  ┌───────────────────────┐  │
        │  │  Next.js 16 app       │  │
        │  │  proxy.ts (auth gate) │  │
        │  └──────────┬────────────┘  │
        └─────────────┼───────────────┘
                      │  @supabase/ssr (JWT in cookies)
                      ▼
        ┌─────────────────────────────┐
        │          Supabase           │
        │  Postgres + RLS             │◄──── Chrome extension (REST/Auth/Storage,
        │  Auth (GoTrue)              │      talks to Supabase directly)
        │  Storage (documents,        │
        │    openstax-snapshots,      │
        │    screenshots)             │
        │  Realtime (comments)        │
        └─────────────────────────────┘
```

- **Next.js** is the application framework. It renders server-side on Vercel and
  hydrates client components in the browser.
- **Vercel** hosts and serves the Next.js app. Deployment is push-based;
  `.vercel` is git-ignored and there is no `vercel.json` (default settings).
  `next.config.ts` is empty.
- **Supabase** is the single source of truth for auth and data. The web app
  never uses a service-role key in the browser — everything runs through the
  **anon key + Row Level Security** (see [database.md](database.md)). Auth is
  cookie-based via `@supabase/ssr`, which is what makes `proxy.ts` able to
  refresh sessions at the edge.

Storage buckets in use: `documents`, `openstax-snapshots`, `screenshots`.

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
   cookies) and writes refreshed tokens back onto the response cookies, keeping
   the session valid for downstream server code.
2. **Auth-gate redirects.**
   - A logged-in user hitting `/` or `/login` → redirected to `/dashboard`.
   - An unauthenticated user hitting a protected prefix (`/dashboard`,
     `/onboard`, `/review`) → redirected to `/login?next=<pathname>`.

Its matcher scopes it to the routes that matter:

```ts
export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/onboard', '/review/:path*'],
}
```

> Proxy is an *optimistic* auth gate, not the authorization layer. Actual
> authorization is enforced by Postgres **RLS** on every query. Never rely on
> `proxy.ts` alone to protect data.

---

## How the extension talks to the main app

The extension and the web app are **two clients over one Supabase backend**,
loosely coupled. The extension does **not** call the Next.js app's API for data
— it talks to Supabase directly and reuses the web app only for auth handoff and
deep links. Three channels connect them:

1. **Extension → Supabase (direct REST/Auth/Storage).** The extension's
   background service worker calls Supabase PostgREST
   (`/rest/v1/annotations`, `/review_scores`, `/reviews`, `/rubric_items`, RPC
   `update_torus_document_pages`), Auth (`/auth/v1/token`), and Storage
   (`screenshots` bucket) using the anon key + the reviewer's access token. It
   reads and writes the **same `reviews` / `review_scores` / `annotations` /
   `score_comments` rows** the web review console uses.

2. **Web app → extension (auth handoff).** The extension picks up the reviewer's
   Supabase session from the web app in two ways: a base64 `oer_token` query
   param appended when the OER Hub dashboard opens a Torus page, and by reading
   the app's Supabase auth cookies from `oerhub.vercel.app`. A dashboard content
   script also re-syncs the session periodically.

3. **Extension → web app (deep link).** From the injected review panel, an
   "Open Console" link points back at the app's `/review` route
   (`${OERHUB_URL}/review?document=...&review=...`), which lands on the same
   protected prefix `proxy.ts` guards.

See [extension.md](extension.md) for the full extension architecture, the
build-time `OERHUB_URL` injection, and the hardcoded-domain caveats.

---

## Known cross-cutting caveats

- **Two Supabase project refs are in play.** The extension background worker
  targets project `nkcyjfuzmmkuavhmqyvu`, while the dashboard content script
  reads cookies for `lbmyfqeqkpmohlumlkdg`. Confirm which is production and
  reconcile them (see [config-and-environment.md](config-and-environment.md)).
- **Type-source drift.** `lib/supabase/types.ts` is a small hand-written
  `Database` type (older schema, includes a `comments` table); the fuller,
  Supabase-generated `types/database.types.ts` is the current truth (uses
  `annotations`). See [database.md](database.md).
