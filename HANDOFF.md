## Goal
- Continue Artist OS Booth Studio without rebuilding it.
- Keep measured artwork faithful, reusable and responsive on desktop/mobile.

## Now
- Repo: https://github.com/yitzhach/booth-studio
- Production: https://booth-studio.bobdylan2000.workers.dev
- Active branch: `claude/stoic-goodall-26lt81`, carrying the photoreal phase
  (`PBR_PHASE.md`): Phase 1 (image-based lighting plumbing) and Phase 2 (HDRI
  backdrops) are done in code. PR #3 has merged.
- **Nothing here is live until this branch merges to `main`.**
- The environment presets still show the procedural sky, because no HDRI files
  are committed yet. That is the outstanding user task — see `docs/HDRI-ASSETS.md`.
- Verification on this branch: `npm test` 49/49, `npm run build` clean,
  `npm run test:view` 3/3 passing (see Testing for the browser flag).

## How deployment actually works
Read this before debugging any "my change isn't live" report. It cost hours once.

| Push target | Cloudflare result |
| - | - |
| `main` | **production** → `booth-studio.bobdylan2000.workers.dev` |
| any other branch | **preview only** → separate URL, production untouched |

- Branch preview: https://claude-youthful-euler-42nv82-booth-studio.bobdylan2000.workers.dev
- Workers Builds runs on **every** push and posts a bot comment on the PR carrying the preview URLs. A successful branch build does **not** change production.
- A worker's `modified_on` timestamp bumps for preview deployments too, so it **cannot** distinguish production from preview. Do not use it as evidence. Use the footer version stamp or the bot comment.
- A manual dashboard upload is overwritten by the next `main` build. Merge instead.
- There is no GitHub Actions workflow. Workers Builds is a Cloudflare-side Git integration and appears only as a GitHub *check*, which is why `actions_list` shows zero runs. The pipeline is not broken.

## Telling what is live
- Footer, bottom-left: `v0.1.0 · <build time> UTC · <commit>`.
- Any device/console: `window.BOOTH_BUILD` → `{version, commit, time, short}`.
- `window.__booth` is DEV-only; `window.BOOTH_BUILD` exists in production.
- Values are injected by `vite.config.js` at build time: commit from `WORKERS_CI_COMMIT_SHA` in CI, else `git`, else `"local"`.
- The footer is `display: none` under the mobile breakpoint, so use `window.BOOTH_BUILD` on a phone.

## Done
- Measured booth geometry, lighting, photo mode, guides, backups and high-res PNG export.
- Tents, ground/horizon options, neighbor layouts and spacing.
- Artwork on all three inside and outside wall faces.
- Reusable Original Panels: each click/drop creates a copy; sources remain.
- Double-click/tap selection, direct wall movement and click-off deselection.
- Corner handles scale proportionally; middle-edge handles stretch width/height.
- Live scale slider with 1% arrow-key increments.
- Artwork thickness plus colored plain/concrete/wood/metal edges.
- Live non-destructive image editor; copy/paste edits.
- Artist signs and artwork labels.
- Edited textures cached across selection rebuilds; no white flash.
- Orbit reaches ground level for low looking-up views (`clampToGround` in `src/scene.js`): the limit is the floor plane at the camera's current distance, not a fixed angle. Closer in permits lower angles.
- Urban horizon is a seeded three-ring skyline at 40/56/72 m: varied footprints, setbacks, cornices, storefront bases, rooftop tanks/HVAC/antennae. One shared tiled canvas facade texture with an emissive map for lit windows; per-face UV scaling keeps window spacing constant in metres, so it costs no more draw calls than the nine boxes it replaced. Backdrop is excluded from shadow passes.
- Gradient sky on all outdoor horizons, fog colour matched to the horizon band so the skyline and ground-plane edge dissolve into haze.
- Environment presets (studio / trade show / art fair / home): image-based lighting from an HDRI, a photographed backdrop, per-preset exposure, and an artwork-colour toggle that keeps uploaded art out of the environment's shading by default. With `public/assets` empty every preset falls back to the procedural sky, so the app never depends on a binary being there.
- `tools/hdri-prep.mjs` converts an HDRI into the 1K `light.hdr` + `bg.jpg` + `meta.json` a preset wants, with no native image tooling.
- Footer build stamp (see above).

## Keep
- Preserve existing implementation and schema-1 backup compatibility.
- Never alter stored original image data; edits belong to placements.
- The city skyline must stay **seeded**, never `Math.random`: it rebuilds on every `update()` and would reshuffle on each edit. `tests/view-city.mjs` guards this.
- Commission repo remains untouched.
- Current app is local-first: no accounts, backend, payments, sync or active AI API.
- AI export is future paid work; read `AI_EXPORT_PHASE.md` only for that phase.
- BFL AI output must preserve art via protected compositing, not prompt promises.
- Tent/environment photography remains approximate unless user supplies images.

## Testing
```sh
npm ci
npm test                 # 49 Node tests, all passing
npm run build            # clean
npm run test:view        # browser: camera range, city backdrop, env presets, HDRI
```
- The cloud sandbox **does** have WebGL via swiftshader. Earlier notes claiming otherwise were wrong. Pass the preinstalled browser explicitly, because the pinned Playwright expects a newer build than is present:
  ```sh
  BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium npm run test:view
  ```
- **`tests/e2e.mjs` and `tests/wall-assets.mjs` are broken on `main`**, unrelated to any current work (verified by reverting and re-running):
  - `e2e.mjs:136` selects label `"Artwork wall"`, renamed to `"Wall location"` (values are now `<wall>-<face>`, e.g. `left-inside`); then `:179` expects `24`, gets `23.59`.
  - `wall-assets.mjs:38` expects 4 resize handles, now 8 since edge-stretch shipped; then it clicks a `"Scale +10%"` button that no longer exists.
  - Repairing them means reconstructing intent across several shipped features. Do not treat their failure as a regression. Ask before taking it on.
- `README.md`'s verification section still references `node tests/environment.mjs`, which does not exist.

## Known limits
- 4096 export depends on device GPU/canvas limits.
- Image editor is Canvas adjustment, not RAW development.
- Local browser data can be evicted; keep downloadable backups.
- The sandbox egress proxy blocks `*.workers.dev`, so no agent session can load the live or preview site. Screenshots must come from a local `vite` server driven by Playwright.
- `wrangler deploy` with no credentials falls into an **interactive browser login and hangs forever** in a headless session. `wrangler login` state lives on the user's own machine, not in a container. For non-interactive deploys set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, and `CI=true` so it errors instead of blocking.
- Account ID: `8e38cda861b39784706d53545a0a435f`. Worker: `booth-studio`.

## Next
1. Supply the HDRI files (`docs/HDRI-ASSETS.md`) — download on your own machine,
   the sandbox cannot reach Poly Haven. Everything else in Phase 2 is shipped.
2. Merge this branch so the environment work reaches production, then confirm on
   the user's Mac/iPhone/iPad: low looking-up orbit, the city backdrop, the
   environment presets, and the footer stamp showing the merged commit.
3. Test stretch handles, scale slider keyboard steps and live editor preview on touch.
4. Test interior/exterior edited artwork and clean 2048/4096 exports.
5. Optional, ask first: repair the two stale browser suites; surface the build stamp on mobile.
6. When requested, begin paid AI export from `AI_EXPORT_PHASE.md`.

## Read map
- Start every new chat with this file only.
- Read `README.md` for commands, architecture or stable behavior.
- Read `PBR_PHASE.md` for HDRI lighting and PBR surfaces; it is self-contained.
- Read `AI_EXPORT_PHASE.md` only for AI-export implementation.
- Ignore `docs/ORIGINAL-HANDOFF.md` unless historical requirements are needed.
