# Documentation

Developer documentation for **Open 4 Peer Review (O4PR)** — internally the "OLI
Annotation Platform" — a rubric-based peer-review tool for Open Educational
Resources (OER). It has two clients over one Supabase backend: a Next.js web app
(deployed to Vercel) and a Chrome extension that injects the review console into
OLI Torus content.

## Contents

| Doc | What's inside |
| --- | --- |
| [architecture.md](architecture.md) | Stack and layers, the Vercel / Supabase / Next.js relationship, `proxy.ts`'s role (the Next 16 middleware), and how the extension talks to the app. |
| [database.md](database.md) | Schema and ERD with key tables and enums, RLS policy overview, the generated `database.types.ts`, and the migration process. |
| [config-and-environment.md](config-and-environment.md) | Environment variables, where secrets come from, local Supabase setup, and type regeneration. |
| [design-system.md](design-system.md) | Design tokens, component structure, the `cx()` convention, and Tailwind v4 usage. |
| [extension.md](extension.md) | Shadow DOM isolation, the separate esbuild pipeline, packaging/publishing, and the `<all_urls>` and console-redirect caveats. |

## Where to start

- **New to the codebase?** Read [architecture.md](architecture.md) first, then
  [database.md](database.md).
- **Setting up locally?** [config-and-environment.md](config-and-environment.md).
- **Working on UI?** [design-system.md](design-system.md).
- **Working on the extension?** [extension.md](extension.md).

## Heads-up: source layout

The full implementation currently lives in a git-ignored snapshot
(`.archiver_shadow/`), while the committed tree is largely stubs (only
`lib/supabase/` has real committed code). These docs use **canonical repo
paths** (`proxy.ts`, `extension/src/…`, `types/database.types.ts`) — where the
files belong — so a fresh clone won't match the docs until that source is
committed.

## Open issues these docs flag

- **Two Supabase project refs** in use (`nkcyjfuzmmkuavhmqyvu` vs
  `lbmyfqeqkpmohlumlkdg`) — reconcile to one. See
  [config-and-environment.md](config-and-environment.md) and
  [extension.md](extension.md).
- **Anon key hardcoded** in the extension's `background.ts` — move to a
  build-time define. See [extension.md](extension.md).
- **`<all_urls>` host permission** is broader than needed — narrow to
  `*.oli.cmu.edu` and the app origin. See [extension.md](extension.md).
- **No in-repo migrations** — schema and RLS live only in the hosted Supabase
  project. See [database.md](database.md).
- **Type-source drift** — retire the hand-written `lib/supabase/types.ts` in
  favor of the generated `types/database.types.ts`. See [database.md](database.md).
