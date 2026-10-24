# Configuration & Environment

## Environment variables

| Variable | Used by | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `proxy.ts` | Supabase project URL, e.g. `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | Supabase anon (publishable) key |
| `GEMINI_API_KEY` | `app/api/ai-chat/route.ts` | Google Gemini API key for the AI chat feature (**server-only**) |
| `GEMINI_MODEL` | `app/api/ai-chat/route.ts` | Optional Gemini model override; defaults to `gemini-2.5-flash` |

The two `NEXT_PUBLIC_SUPABASE_*` vars are `NEXT_PUBLIC_`-prefixed because
`@supabase/ssr` uses them in the browser client too. `GEMINI_API_KEY` must
**not** be `NEXT_PUBLIC_` — it is used only in the AI-chat route handler and must
never reach the browser.

There is **no committed `.env.example`**, and `.env*` is git-ignored. Locally,
create a `.env.local`; in production set them as **Vercel environment
variables**.

## Where secrets come from

- **`NEXT_PUBLIC_*` values are not secret.** The anon key is safe to expose in
  the browser *only because RLS protects the data* (see [database.md](database.md)).
- **`GEMINI_API_KEY` is secret** — keep it server-only (no `NEXT_PUBLIC_`) and
  set it only in `.env.local` / Vercel.
- **Local:** `.env.local` (never committed).
- **Production:** Vercel project → Settings → Environment Variables. Redeploy
  after changing them (`NEXT_PUBLIC_*` values are inlined at build time).
- **Service-role key:** must **never** ship to the browser or the extension. If
  a server-only workflow needs it, keep it in a server-only env var and use it
  only in Route Handlers / Server Actions.
- **Extension credentials:** the extension does **not** read these env vars at
  runtime — it hardcodes its Supabase URL/anon key and injects the app origin
  (`OERHUB_URL`) at build time. See [extension.md](extension.md).

## Local development

### Web app

```bash
npm install
# create .env.local with NEXT_PUBLIC_SUPABASE_* (+ GEMINI_API_KEY for AI chat)
npm run dev        # Next.js dev server (http://localhost:3000)
```

Full script set (`package.json`):

| Script | Does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev / production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Vitest (`vitest run`) — tests under `features/ai-chat/__tests__/` |
| `npm run build:ext` | Build the extension into `extension/dist/` (production `OERHUB_URL`) |
| `npm run build:ext:dev` | Same, with `OERHUB_URL=http://localhost:3000` |
| `npm run watch:ext` / `watch:ext:dev` | Rebuild the extension on change |
| `npm run package:ext` | Build + zip the extension to `extension/dist.zip` |

### Local Supabase setup

The project points at a **hosted** Supabase project by default; there is no
top-level `supabase/` directory or `config.toml` checked in, so a local stack is
optional. A Supabase **MCP server** is configured in `.mcp.json` for
tool-driven access to the hosted project.

To run Supabase locally:

```bash
npx supabase init      # creates supabase/ + config.toml (currently absent)
npx supabase start     # local Postgres/Auth/Storage via Docker
npx supabase status    # prints the local API URL + anon key
```

Then point `.env.local` at the printed local URL and anon key. Because there is
no committed migration history, a fresh local database will be **empty** — you
must apply the schema and RLS manually (dashboard SQL export or, ideally, after
adopting `supabase/migrations/`). See the migration section in
[database.md](database.md).

For most work, developing against a Supabase **branch** of the hosted project
(via the Supabase CLI or MCP) is simpler than a full local stack.

## Type regeneration

`types/database.types.ts` is **generated, never hand-edited**. Whenever the
schema changes, regenerate it:

```bash
npx supabase gen types typescript --project-id <project-ref> > types/database.types.ts
```

(or `--local` when running the local stack). Commit the regenerated file with the
schema change. Code imports the `Database` type from `@/types/database.types`;
`lib/supabase/types.ts` re-exports it and adds hand-written domain types. See
[database.md](database.md).
