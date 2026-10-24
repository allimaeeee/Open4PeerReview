# Chrome Extension — OER Review Console

The extension injects the O4PR review console directly into OER content shown in
the [OLI Torus](https://oli.cmu.edu) authoring environment, so reviewers can
annotate and score in place. It is a **Chrome MV3** extension and a fully
separate build from the Next.js app, but it shares the same Supabase backend
(see [architecture.md](architecture.md)).

Source layout:

```
extension/
  manifest.json          ← MV3 manifest
  build.mjs              ← esbuild build script (also injects OERHUB_URL)
  package.mjs            ← zips dist/ → dist.zip (uses `archiver`)
  extensioninstall.txt   ← dev load notes
  src/
    background.ts        ← MV3 service worker (auth, Supabase REST, screenshots)
    content.ts           ← injected review UI + text anchoring (large)
    dashboard.ts         ← runs on the web app; forwards the session to background
    popup.ts / popup.html← toolbar popup
    types.ts             ← shared message-protocol types
    fonts/               ← Lato + Newsreader woff2 (inlined into content build)
```

---

## The manifest (MV3)

`extension/manifest.json` (`manifest_version: 3`, name "OER Review Console"):

```json
{
  "permissions": ["activeTab", "tabs", "storage", "scripting", "webNavigation", "cookies"],
  "host_permissions": [
    "https://proton.oli.cmu.edu/*",
    "https://annotation-platform-seven.vercel.app/*",
    "https://*.vercel.app/*",
    "http://localhost:3000/*",
    "<all_urls>"
  ],
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [
    { "matches": ["https://proton.oli.cmu.edu/*"], "js": ["content.js"], "run_at": "document_idle" },
    { "matches": ["https://annotation-platform-seven.vercel.app/*", "https://*.vercel.app/*", "http://localhost:3000/*"],
      "js": ["dashboard.js"], "run_at": "document_idle" }
  ],
  "action": { "default_popup": "popup.html", "default_title": "OER Review Console" }
}
```

- `content.js` runs on Torus (`proton.oli.cmu.edu`); `dashboard.js` runs on the
  web app origins (to sync auth).
- There is no `web_accessible_resources` key.

---

## Shadow DOM isolation

The content script renders its entire review console inside a **Shadow DOM** so
that Torus's page CSS cannot leak into the panel and the panel's CSS cannot leak
out onto the page.

- A host element `#oer-review-host` is appended to the page
  (`content.ts` ~L2737) with `position: fixed` and a very high `z-index` so it
  survives whatever CSS the host page applies.
- `host.attachShadow({ mode: 'open' })` (`content.ts` ~L2766) creates the shadow
  root; the panel markup plus a scoped `<style>` block (including `@font-face`
  rules for the bundled woff2 fonts) live entirely inside it.
- All internal DOM lookups go through the shadow root, never `document`.

It's a **hybrid** model: the console *chrome* lives in the shadow root, but the
in-text artifacts it must position over the real content — highlight `<mark>`s,
hotspot markers, the annotation tooltip/popup — are injected into the **page
DOM**. Click handlers explicitly ignore the extension's own nodes
(`#oer-review-host`, `#oer-ann-popup`, `#oer-ann-tooltip`, `#oer-toast`,
`#oer-hotspot-banner`) so page clicks and panel clicks don't cross-fire.

---

## Separate build pipeline

The extension is bundled with **esbuild** via `extension/build.mjs` — completely
independent of `next build`. `esbuild` is a devDependency.

- Four entry points, all output to `extension/dist/`:
  `background.ts` → `background.js` (ESM service worker),
  `content.ts` → `content.js` (IIFE),
  `popup.ts` → `popup.js` (IIFE),
  `dashboard.ts` → `dashboard.js` (IIFE).
- `target: 'chrome120'`, `sourcemap: true`, `minify: false`.
- `manifest.json` and `popup.html` are copied into `dist/`; woff2 fonts are
  inlined via esbuild's `dataurl` loader on the `content`/`popup` builds.
- **`OERHUB_URL` is injected at build time** via an esbuild `define`, applied to
  the `content.ts` build:
  ```js
  const isDev = process.env.OERHUB_ENV === 'dev';
  const OERHUB_URL = isDev ? 'http://localhost:3000'
                           : 'https://annotation-platform-seven.vercel.app';
  // …
  define: { __OERHUB_URL__: JSON.stringify(OERHUB_URL) }
  ```
  `content.ts` consumes it as `declare const __OERHUB_URL__` /
  `const OERHUB_URL = __OERHUB_URL__`.

  > Note: the `define` is applied only to the `content` bundle. If
  > `background.ts`/`dashboard.ts` ever need `OERHUB_URL`, add the `define` to
  > their builds too.

Build/load for local dev:

```bash
npm run build:ext:dev   # OERHUB_ENV=dev → OERHUB_URL=http://localhost:3000
# chrome://extensions → enable Developer mode → "Load unpacked" → extension/dist
```

`npm run watch:ext` / `watch:ext:dev` rebuild on change.

---

## Packaging & publishing

Distribution is via the **Chrome Web Store** (the extension has a published
privacy policy referencing its Web Store listing and data declarations).

Packaging is scripted:

```bash
npm run package:ext     # build.mjs + package.mjs → extension/dist.zip
```

`extension/package.mjs` uses `archiver` to zip the **contents** of
`extension/dist/` (entries at the archive root, not nested under `dist/`) into
`extension/dist.zip`. Per the README, `dist.zip` is **not committed** — it is
regenerated fresh each time and shared directly (e.g. via Slack) with anyone who
needs to install it.

To publish a new version:

1. Bump `version` in `extension/manifest.json`.
2. `npm run package:ext` → `extension/dist.zip`.
3. Upload the zip in the Chrome Web Store Developer Dashboard, update the store
   listing / data-privacy declarations if data collection changed, and submit
   for review.

> 📌 **Chrome Web Store account note.** Publishing requires access to the
> project's Chrome Web Store **developer account** (the one that owns the
> existing OER Review Console listing). This is a shared team credential, not a
> personal account — coordinate with the project owner before submitting, and
> keep the account/ownership details in the team's secret store rather than in
> this repo.

---

## `<all_urls>` host permission — worth narrowing

The manifest's `host_permissions` list already scopes the content scripts to the
hosts that matter (`proton.oli.cmu.edu`, the app's Vercel origins, localhost) —
but it **also** includes `<all_urls>` (and a broad `https://*.vercel.app/*`).
`<all_urls>` grants access to every site the user visits, enlarges the review
surface, slows Chrome Web Store review, and triggers the scariest install-time
permission warning.

The extension only actually needs to run on:

- **OLI Torus** — `proton.oli.cmu.edu` (content script), and
- the **web app** origin (`annotation-platform-seven.vercel.app`, plus localhost
  for dev) for the dashboard content script + cookie-based auth sync.

**Recommendation:** drop `<all_urls>` (and ideally the wildcard
`https://*.vercel.app/*`) from `host_permissions`, keeping only the explicit
origins. The `content_scripts[].matches` entries are already scoped, so the
`<all_urls>` grant is effectively redundant. The dashboard script already
compensates for the `*.vercel.app` breadth with a runtime allow-list
(`ALLOWED_PLATFORM_HOSTNAMES = ['annotation-platform-seven.vercel.app',
'localhost']` plus a preview-deploy regex) — that guard is a good sign the
manifest permission can be tightened to match.

---

## Console-redirect / domain coupling — update when the production domain changes

Two places hardcode the production domain and **must be changed together** if the
app is ever moved off `annotation-platform-seven.vercel.app` (custom domain, new
Vercel project, etc.):

1. **The console-redirect target (`OERHUB_URL`).** The injected panel's
   "Open Console" link is built as
   `${OERHUB_URL}/review?document=<id>&review=<id>`, where `OERHUB_URL` comes
   from the build-time `__OERHUB_URL__` define. Change the production value in
   `extension/build.mjs` (the `OERHUB_URL` constant) and rebuild. The dev build
   points it at `http://localhost:3000`.

2. **The cookie-source domain in `background.ts`.** The auth sync reads the
   Supabase session cookies from a hardcoded fallback origin
   (`readSessionFromCookies('https://annotation-platform-seven.vercel.app')`,
   ~L321). If the app domain changes, this URL — and the manifest
   `host_permissions` / `content_scripts` entries for the dashboard sync — must
   change too, or the extension will silently fail to pick up the reviewer's
   session.

Also domain-coupled: the Torus navigation filters and detection
(`{ hostContains: 'proton.oli.cmu.edu' }`, `if (!url.includes('proton.oli.cmu.edu'))`)
must track wherever Torus content is actually served.

---

## Other caveats

- **Single Supabase project ref.** `background.ts` targets project
  `nkcyjfuzmmkuavhmqyvu` (hardcoded `SUPABASE_URL` + anon key + `SUPABASE_REF`).
  `dashboard.ts` does **not** hardcode any project ref — it scans `localStorage`
  for any `sb-*-auth-token` key and forwards the session. (An earlier
  conflicting second ref no longer exists.)
- **Anon key committed in source.** `background.ts` embeds the Supabase anon JWT
  as a literal. Anon keys are public by design (RLS is the real guard), so this
  is low-severity, but prefer injecting it via a build-time `define` alongside
  `__OERHUB_URL__` so key rotation doesn't require editing source.
