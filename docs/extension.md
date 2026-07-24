# Chrome Extension — OER Review Console

The extension injects the O4PR review console directly into OER content shown in
the [OLI Torus](https://oli.cmu.edu) authoring environment, so reviewers can
annotate and score in place. It is a **Chrome MV3** extension and a fully
separate build from the Next.js app, but it shares the same Supabase backend
(see [architecture.md](architecture.md)).

Source layout:

```
extension/
  build.mjs              ← esbuild build script
  extensioninstall.txt   ← dev load instructions
  src/
    background.ts        ← MV3 service worker (auth, Supabase REST, screenshots)
    content.ts           ← injected review UI + text anchoring (large)
    dashboard.ts         ← runs on the OER Hub dashboard; syncs the session
    types.ts             ← shared message-protocol types
    (manifest.json, popup.html, popup.ts) ← referenced by build; keep in sync
```

---

## Shadow DOM isolation

The content script renders its entire review console inside a **Shadow DOM** so
that Torus's page CSS cannot leak into the panel and the panel's CSS cannot leak
out onto the page.

- A host element `#oer-review-host` is appended to the page with
  `position: fixed !important` and `z-index: 2147483647` so it survives whatever
  CSS the host page applies.
- `host.attachShadow({ mode: 'open' })` creates the shadow root; the panel
  markup plus a full scoped `<style>` block live entirely inside it (`:host`
  styling, its own fonts and colors).
- All internal DOM lookups go through the shadow root (`shadow.getElementById`,
  `shadow.querySelector`), never `document`.

It's a **hybrid** model: the console *chrome* lives in the shadow root, but the
in-text artifacts it must position over the real content — `<mark>` highlights,
hotspot markers, the annotation tooltip/popup — are injected into the **page
DOM**. Click handlers explicitly ignore the extension's own nodes
(`#oer-review-host`, `#oer-ann-popup`, `.oer-hotspot-marker`) so page clicks and
panel clicks don't cross-fire.

---

## Separate build pipeline

The extension is bundled with **esbuild** via `extension/build.mjs` — completely
independent of `next build`.

- Four entry points, all output to `extension/dist/`:
  `background.ts` → `background.js` (ESM service worker),
  `content.ts` → `content.js` (IIFE),
  `popup.ts` → `popup.js` (IIFE),
  `dashboard.ts` → `dashboard.js` (IIFE).
- `target: 'chrome120'`, `sourcemap: true`, `minify: false`.
- `manifest.json` and `popup.html` are copied into `dist/` as-is.
- The app origin the console links back to is injected at **build time** via an
  esbuild `define` for `__OERHUB_URL__` (see the console-redirect section). The
  dev build points it at `localhost`; the production build must point it at the
  deployed app.

Load for local dev (from `extensioninstall.txt`):

```
npm run build:ext:dev     # dev build — sets OERHUB_URL to localhost
npm run build:ext         # production build
# then: chrome://extensions → enable Developer mode
#       → "Load unpacked" → select extension/dist
```

> ⚠️ **Build wiring is incomplete in the repo.** The `build:ext` /
> `build:ext:dev` scripts referenced above are **not** in `package.json`
> (which only has `dev/build/start/lint`), `esbuild` is not listed as a
> dependency, and `build.mjs` in the tree has no `define` block for
> `__OERHUB_URL__` even though `content.ts` requires it. Before publishing:
> add the npm scripts, add `esbuild` to devDependencies, and wire the
> `define: { __OERHUB_URL__: JSON.stringify(<origin>) }` into `build.mjs`.

---

## Packaging & publishing

Distribution is via the **Chrome Web Store** (the extension already has a
published privacy policy referencing its Web Store listing and data
declarations). There is currently **no** zip-packaging or version-bump script in
the repo — the only documented flow is "Load unpacked" for development.

To publish:

1. Bump the `version` in `manifest.json`.
2. Run the production build (`npm run build:ext`) → `extension/dist/`.
3. Zip the **contents** of `extension/dist/` (not the folder itself).
4. Upload the zip in the Chrome Web Store Developer Dashboard, update the store
   listing / data-privacy declarations if collection changed, and submit for
   review.

> 📌 **Chrome Web Store account note.** Publishing requires access to the
> project's Chrome Web Store **developer account** (the one that owns the
> existing OER Review Console listing). This is a shared team credential, not a
> personal account — coordinate with the project owner before submitting, and
> keep the account/ownership details in the team's secret store rather than in
> this repo.

---

## `<all_urls>` host permission — worth narrowing

The manifest requests the `<all_urls>` host permission. This is broad: it grants
the content script access to **every** site the user visits, which enlarges the
review surface, can slow the Chrome Web Store review, and triggers the scariest
install-time permission warning.

The extension only actually needs to run on:

- **OLI Torus** hosts — `proton.oli.cmu.edu` (and the broader
  `*.oli.cmu.edu` / `torus.oli.cmu.edu` / `course-author.oli` detection), and
- the **OER Hub app** origin (`oerhub.vercel.app`) for the dashboard content
  script + cookie-based auth sync.

**Recommendation:** replace `<all_urls>` with an explicit `host_permissions`
list scoped to those origins (e.g. `https://*.oli.cmu.edu/*` and
`https://oerhub.vercel.app/*`), and match `content_scripts[].matches`
accordingly. If arbitrary third-party OER platforms must be supported later,
prefer `activeTab` + optional host permissions requested on demand over a
blanket `<all_urls>`.

---

## Console-redirect allowed URLs — update when the production domain changes

Two places hardcode the production domain and **must be changed together** if the
app is ever moved off `oerhub.vercel.app` (custom domain, new Vercel project,
etc.):

1. **The console-redirect target (`OERHUB_URL`).** The injected panel's
   "Open Console" link is built as
   `${OERHUB_URL}/review?document=<id>&review=<id>`, where `OERHUB_URL` comes
   from the build-time `__OERHUB_URL__` define. This is *the* value the install
   note calls "essential for correct console redirect." Change it in the esbuild
   `define` (per environment) and rebuild — the dev build points it at
   `localhost`.

2. **The cookie-source domain in `background.ts`.** Auth is synced by reading the
   Supabase session cookies from a hardcoded origin:

   ```ts
   const cookies = await chrome.cookies.getAll({ url: 'https://oerhub.vercel.app' });
   ```

   If the app domain changes, this URL (and the matching `host_permissions` /
   `content_scripts` entries for the dashboard sync) must change too, or the
   extension will silently fail to pick up the reviewer's session.

Also domain-coupled: the Torus navigation filters and detection regexes
(`{ hostContains: 'proton.oli.cmu.edu' }`, `/torus|oli\.cmu\.edu|course-author\.oli|torus\.oli/`)
must track wherever Torus content is actually served (e.g. staging vs. prod
Torus hosts).

---

## Other caveats to reconcile before shipping

- **Two Supabase project refs.** `background.ts` targets project
  `nkcyjfuzmmkuavhmqyvu` (and hardcodes its URL + anon key), while `dashboard.ts`
  reads cookies for a **different** ref `lbmyfqeqkpmohlumlkdg`. These must point
  at the same project or auth sync breaks. See
  [config-and-environment.md](config-and-environment.md).
- **Anon key committed in source.** `background.ts` embeds the Supabase anon JWT
  as a literal. Anon keys are public by design (RLS is the real guard), so this
  is low-severity, but prefer injecting it via a build-time `define` alongside
  `__OERHUB_URL__` so key rotation doesn't require editing source.
