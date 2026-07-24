# Documentation

Developer documentation for **Open 4 Peer Review (O4PR)** — internally the "OLI
Annotation Platform" — a rubric-based peer-review tool for Open Educational
Resources (OER). It has two clients over one Supabase backend: a Next.js web app
(deployed to Vercel at `annotation-platform-seven.vercel.app`) and a Chrome
extension that injects the review console into OLI Torus content.

## Contents

| Doc | What's inside |
| --- | --- |
| [architecture.md](architecture.md) | Stack and layers, routing surface, the Vercel / Supabase / Next.js relationship, `proxy.ts`'s role (the Next 16 middleware), and how the extension talks to the app. |
| [database.md](database.md) | Schema and ERD with key tables and enums, RLS policy overview, the generated `database.types.ts`, and the migration process. |
| [config-and-environment.md](config-and-environment.md) | Environment variables (Supabase + Gemini), where secrets come from, npm scripts, local Supabase setup, and type regeneration. |
| [design-system.md](design-system.md) | Design tokens, the `ui/` / `patterns/` / `layout/` component structure, the `cx()` convention, and Tailwind v4 usage. |
| [extension.md](extension.md) | The MV3 manifest, Shadow DOM isolation, the separate esbuild pipeline, packaging/publishing, and the `<all_urls>` and domain-coupling caveats. |

## Where to start

- **New to the codebase?** Read [architecture.md](architecture.md) first, then
  [database.md](database.md).
- **Setting up locally?** [config-and-environment.md](config-and-environment.md).
- **Working on UI?** [design-system.md](design-system.md).
- **Working on the extension?** [extension.md](extension.md).

## Open issues these docs flag

- **`<all_urls>` host permission** is broader than needed — narrow to
  `proton.oli.cmu.edu` and the app origin. See [extension.md](extension.md).
- **Anon key hardcoded** in the extension's `background.ts` — move to a
  build-time define. See [extension.md](extension.md).
- **No top-level migrations** — schema and RLS live only in the hosted Supabase
  project (`schema.sql` is an empty placeholder). See [database.md](database.md).
- **`cx()` is copy-pasted** across ~28 components — extract to a shared util.
  See [design-system.md](design-system.md).
- **Domain coupling** — the production domain is hardcoded in the extension
  build and background worker; update both together on any domain change. See
  [extension.md](extension.md).
