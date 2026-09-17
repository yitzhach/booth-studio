# Booth Studio — handoff

Start a new chat with **this file only**. It is written to be enough on its own.

Artist OS Booth Studio: measured 3D art-show booth planning in the browser.
Extend it; do not rebuild it.

## Now

- Repo: https://github.com/yitzhach/booth-studio
- Production: https://booth-studio.bobdylan2000.workers.dev
- Branch: `claude/stoic-goodall-26lt81`, ahead of `main`. **Nothing on it is
  live until it merges.**
- The photoreal phase (`PBR_PHASE.md`) is **done in code through Phase 3**:
  image-based lighting, HDRI backdrops, PBR ground surfaces. Phase 4 is tent
  fabric and wall materials.
- Presets still show the procedural sky and floor because **no asset files are
  committed yet**. That is the one outstanding user task, and only the user can
  do it: the sandbox proxy blocks polyhaven.com and ambientcg.com.
  `docs/HDRI-ASSETS.md` and `docs/TEXTURE-ASSETS.md` are step-by-step.
- Green on this branch: `npm test` 80/80, `npm run build`, `npm run test:view`
  4/4, `npm run test:browser`, `node tests/wall-assets.mjs`.

## Next

1. **User:** download the HDRIs and ground textures (the two docs above).
   Nothing else in Phases 1–3 is outstanding.
2. Merge to `main` so the environment work reaches production. Then confirm on
   Mac/iPhone/iPad: low looking-up orbit, city backdrop, environment presets,
   ground surfaces, footer stamp showing the merged commit.
3. Touch testing: stretch handles, scale-slider keyboard steps, live editor
   preview. Interior/exterior edited artwork and clean 2048/4096 exports.
4. Phase 4 of `PBR_PHASE.md`, once assets are in and you can see what still
   looks wrong. That file says where to start and what to change first.
5. On request only: paid AI export, from `AI_EXPORT_PHASE.md`.

## Deployment — read before debugging "my change isn't live"

| Push target | Cloudflare result |
| - | - |
| `main` | **production** → `booth-studio.bobdylan2000.workers.dev` |
| any other branch | **preview only** → separate URL, production untouched |

- Workers Builds runs on every push and comments the preview URL on the PR.
  Preview URLs follow `claude-<branch-with-dashes>-booth-studio.…workers.dev`.
- A worker's `modified_on` bumps for previews too, so it **cannot** tell
  production from preview. Use the footer stamp or the bot comment instead.
- A manual dashboard upload is overwritten by the next `main` build. Merge.
- There is no GitHub Actions workflow — Workers Builds is a Cloudflare-side Git
  integration that appears only as a GitHub *check*. `actions_list` showing zero
  runs is not a broken pipeline.
- `wrangler deploy` without credentials opens an **interactive browser login and
  hangs forever** in a headless session. For non-interactive deploys set
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` and `CI=true`.
- Account `8e38cda861b39784706d53545a0a435f`, worker `booth-studio`.

**Telling what is live:** footer bottom-left reads `v0.1.0 · <time> UTC ·
<commit>`; `window.BOOTH_BUILD` works anywhere including production
(`window.__booth` is dev-only). The footer is hidden under the mobile
breakpoint, so use `window.BOOTH_BUILD` on a phone.

## Testing

```sh
npm ci
npm test                 # 80 Node tests
npm run build
npm run test:view        # browser: camera, city, env presets, HDRI, PBR ground
npm run test:browser     # browser: full editor end-to-end
node tests/wall-assets.mjs
```

The cloud sandbox **does** have WebGL via swiftshader, but the pinned Playwright
expects a newer Chromium than is installed, so pass the browser explicitly:

```sh
BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium npm run test:view
```

All five suites are green. If one fails, it is a regression — the two that were
long-abandoned were repaired in Phase 3.

## Rules that are easy to break

- Preserve the implementation and schema-1 backup compatibility. Adding optional
  fields and widening enums is fine; changing meaning is not.
- **Never alter stored original image data.** Edits belong to placements.
- The city skyline must stay **seeded**, never `Math.random`: it rebuilds on
  every `update()` and would reshuffle on each edit. `tests/view-city.mjs`
  guards this.
- The app must run with `public/assets` empty. Every HDRI and texture path falls
  back to procedural; keep it that way.
- Local-first: no accounts, backend, payments, sync or live AI calls.
- Do not modify the separate `yitzhach/commission` repo.

## Recently landed, worth knowing

- Environment presets (studio / trade show / art fair / home): HDRI lighting, a
  photographed backdrop with rotation, per-preset exposure, and an artwork-colour
  toggle that keeps uploaded art out of the environment's shading by default.
- PBR ground per kind (now including carpet and wood), tiled from the surface's
  real-world size so every floor stays the same scale.
- `tools/hdri-prep.mjs` and `tools/texture-prep.mjs` build those asset sets with
  no native image tooling.
- **Drag snapping now defaults to 1 inch.** The toolbar button had always
  rendered as active while snapping was off, so drags landed at 23.59″ in a
  measured tool. Behaviour change worth eyeballing.

## Known limits

- 4096 export depends on device GPU/canvas limits.
- Image editor is Canvas adjustment, not RAW development.
- Local browser storage can be evicted; keep downloadable backups.
- The sandbox proxy blocks `*.workers.dev`, so no agent session can load the
  live or preview site. Screenshots must come from a local `vite` server driven
  by Playwright.
- Tent and environment models are visual approximations, not certified products.

## Read map

- `README.md` — commands, architecture, stable behavior.
- `PBR_PHASE.md` — HDRI lighting and PBR surfaces. Self-contained, and records
  what each phase discovered, so a fresh chat can take Phase 4 without reading
  the codebase first.
- `docs/HDRI-ASSETS.md`, `docs/TEXTURE-ASSETS.md` — only to add asset files.
- `AI_EXPORT_PHASE.md` — only for AI-export implementation.
- `docs/ORIGINAL-HANDOFF.md` — historical; ignore unless you need old
  requirements.
