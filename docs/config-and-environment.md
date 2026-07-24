# Configuration & Environment

## Environment variables

The web app needs only the Supabase connection details. Both are
`NEXT_PUBLIC_`-prefixed because `@supabase/ssr` uses them in the browser client
too.

| Variable | Used by | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `proxy.ts` | Supabase project URL, e.g. `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | Supabase anon (publishable) key |

Locally these live in `.env.local` (git-ignored — `.gitignore` ignores `.env*`).
In production they are set as **Vercel environment variables**.

> ⚠️ **Two project refs are floating around.** `.env.local` has historically
> contained *both* `nkcyjfuzmmkuavhmqyvu` and `lbmyfqeqkpmohlumlkdg` (one
> commented out), and the extension hardcodes each in different files. Pin one
> project ref as production and make the web app, the extension, and Vercel all
> agree. See [extension.md](extension.md).

The extension does **not** read these env vars at runtime — it currently
hardcodes the Supabase URL and anon key, and injects the app origin
(`OERHUB_URL`) at build time. See [extension.md](extension.md).

## Where secrets come from

- **`NEXT_PUBLIC_*` values are not secret.** The anon key is safe to expose in
  the browser *only because RLS protects the data* (see [database.md](database.md)).
- **Local:** `.env.local` (never committed).
- **Production:** Vercel project → Settings → Environment Variables. Redeploy
  after changing them (build-time inlining).
- **Service-role key:** must **never** ship to the browser or the extension. If
  a server-only workflow needs it, keep it in a server-only env var (no
  `NEXT_PUBLIC_` prefix) and use it only in Route Handlers / Server Actions.
- **Anon key committed in the extension source is a known issue** — see
  [extension.md](extension.md). It is low-severity (anon keys are public by
  design) but should still be sourced from a build-time define, not committed.

## Local development

### Web app

```bash
npm install
# create .env.local with the two NEXT_PUBLIC_SUPABASE_* vars
npm run dev        # Next.js dev server (http://localhost:3000)
```

Other scripts: `npm run build`, `npm run start`, `npm run lint`. That's the full
set — there are intentionally no db/migration scripts.

### Local Supabase setup

The project points at a **hosted** Supabase project by default; there is no
`supabase/` directory or `config.toml` checked in, so a local stack is optional.

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
schema change. New code should import the `Database` type from
`@/types/database.types`; the older hand-written `lib/supabase/types.ts` stub is
being retired. See [database.md](database.md).
