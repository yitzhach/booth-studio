# Booth Studio — handoff

Start a new chat with **this file only**. It is written to be enough on its own.

Artist OS Booth Studio: measured 3D art-show booth planning in the browser.
Extend it; do not rebuild it.

## Now

- Repo: https://github.com/yitzhach/booth-studio
- Production: https://booth-studio.bobdylan2000.workers.dev
- `main` is deployed. Every branch is preview-only.
- The photoreal phase (`PBR_PHASE.md`) is done through Phase 4's tent canvas
  and fabric walls. Assets are committed and live: HDRIs for trade show and
  art fair, ground textures for concrete, asphalt, grass, carpet and wood, a
  tent canvas and a fabric wall finish. `public/assets` is 28 MB of a ~50 MB
  budget.
- **Video export is built.** Four eased camera moves, rendered offline and
  encoded with WebCodecs into an MP4. `src/camera-path.js` is the moves,
  `src/video.js` is the muxer and encoder, `scene.recordVideo()` drives them.

## Next

1. **`WALLS_PHASE.md`** — free-standing interior walls you can place and hang
   art on. Requested, planned, not built. Read that file; it explains the
   schema-1 compatibility constraint that shapes the whole design.
2. **Unverified on real hardware** — three things shipped that no one has
   confirmed by eye, because no agent session can load the live site (the
   workers.dev host is refused by the egress proxy, same as polyhaven.com):
   - Are the four ground tile sizes really 2 m? They were recorded at the
     tool's default, not read off the ambientCG pages. Wrong tile size makes a
     floor read as a picture of a floor.
   - Does the wall weave look right? It tiles at the carpet's real size, about
     1.5 repeats across a 10 ft panel, which may be coarse for a pro-panel.
     `WALL_SET` in `src/surfaces.js` points at `carpet`; pointing it at
     `canvas` is a one-line change to a finer weave.
   - Is the tent weave visible now? Its relief is exaggerated 3x (`TENT_WEAVE`)
     because a true-depth weave on a white roof washes out.
3. **A `home` HDRI** is still missing — an interior with windows on one side.
   That preset falls back procedurally until someone downloads one;
   `docs/HDRI-ASSETS.md` is step by step.
4. **The two shipped backdrops are 1024x512 and read soft.** Both were prepped
   from Poly Haven's *1K* HDRI, and `tools/hdri-prep.mjs` will not stretch a
   backdrop past its source — it now warns loudly rather than capping in
   silence. Re-prep from the **4K** download and the softness goes. This needs
   network access: polyhaven.com is refused by the sandbox egress proxy, so no
   agent session can do it.
5. **H.264 encoding is untested on real hardware.** Open Chromium builds ship
   without an H.264 *encoder*, so the sandbox exercises the VP9-in-MP4 fallback
   instead — which does prove the whole encoder-to-muxer pipeline, and the
   container was independently validated with mp4box.js. What no one has
   confirmed is an `avc1`/`avcC` file out of Chrome or Safari. If a clip will
   not play, that is the first thing to look at, and `muxMp4` takes the
   encoder's own `decoderConfig.description` verbatim.

## Diagnosing "the texture isn't showing"

This came up twice and was guessed at twice. Do not guess a third time.

**`window.BOOTH_ASSETS`** works in production and records, per texture set,
whether it loaded and what it found. `window.BOOTH_BUILD` gives the deployed
commit. `window.__booth` is dev-only.

Two real causes found so far, both of which look like "the dropdown is broken":

- **An uploaded ground photograph outranks the Ground kind entirely.** The
  panel now says so while it is happening. Layout → Surroundings → Remove
  ground texture.
- **A ground kind whose files are missing** falls back to the procedural
  surface silently. That is by design; `BOOTH_ASSETS` is how you tell that
  apart from a bug.

Ruled out, so do not re-investigate: Cloudflare Workers serves the assets
correctly. `wrangler dev --local` was used to check — HEAD returns
`image/jpeg`, and a missing path returns the SPA fallback that `requireAsset()`
already detects. The build output contains all 37 asset files.

## Deployment

| Push target | Cloudflare result |
| - | - |
| `main` | **production** |
| any other branch | preview only |

- Merging to `main` is the deploy. There is no other step.
- **The dashboard uploader cannot deploy this project** and will say so: it is
  a Vite app with a `wrangler.jsonc`, so it needs a build. Do not fight it.
- `wrangler deploy` with no credentials opens a browser login and hangs forever
  in a headless session. Needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
  and `CI=true`. Merging is easier.
- Account `8e38cda861b39784706d53545a0a435f`, worker `booth-studio`.
- The footer reads `v0.1.0 · <time> UTC · <commit>`, hidden under the mobile
  breakpoint — use `window.BOOTH_BUILD` on a phone.

## Testing

```sh
npm ci
npm test                 # 124 Node tests
npm run build
npm run test:view        # camera, city, env presets, HDRI, ground, tent, walls, video
npm run test:browser     # 18 end-to-end checks
node tests/wall-assets.mjs
```

The sandbox has WebGL via swiftshader, but the pinned Playwright expects a
newer Chromium than is installed, so pass the browser explicitly:

```sh
BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium npm run test:view
```

**Never verify through a pipe.** A pipeline's exit status is the last command's,
so `npm test | grep PASS` exits 0 even when the suite fails. This has already
hidden a failure once. Run each suite directly.

## Rules that are easy to break

- Preserve schema-1 backup compatibility. Optional fields and widened enums are
  fine; changed meaning is not. `WALLS_PHASE.md` turns on this.
- **Never alter stored original image data.** Edits belong to placements.
- The city skyline must stay **seeded**, never `Math.random`: it rebuilds on
  every `update()` and would reshuffle on each edit. `tests/view-city.mjs`
  guards this.
- The app must run with `public/assets` empty. Every path falls back to
  procedural; keep it that way.
- Local-first: no accounts, backend, payments, sync or live AI calls.
- Do not modify the separate `yitzhach/commission` repo.

## Things learned the hard way

- **UVs on tent panels are in metres, not 0..1.** A roof is ~3 m across and a
  valance 12 inches deep; with 0..1 UVs one weave is stretched ten times
  further on the valance. `repeatFor(tileMetres, 1)` is then the whole
  conversion. Walls use the same idea per axis, since a panel is wider than it
  is tall.
- **`SurfaceTextures` caches per id and clones per consumer.** `repeat` lives on
  the texture, so two surfaces sharing one texture object fight over scale.
  Clones share their image source, so a second consumer is a few objects, not a
  second upload. Loading claims a set; `release(consumer)` is how one leaves.
- **Quality is a supersampling factor, not a ceiling.** `min(devicePixelRatio,
  quality)` renders at 1x on the 1x monitor most desktops have, and edges
  stair-step however high the setting. `tests/render-scale.test.js` pins it.
- **Field of view is the only thing that frames an equirectangular backdrop.**
  Moving the camera cannot pull it back. It is 62 degrees for that reason.
- **A spherical backdrop is framed by field of view alone.** Moving the camera
  cannot pull it back, because the background is a lookup by view direction. So
  "the backdrop is too zoomed in" and "the backdrop is blurry" are one bug: a
  62 degree view of a 1024px equirectangular image puts about 176 source pixels
  across the whole canvas. The backdrop is now drawn in a pass of its own,
  through a wider lens, so it can be pulled back without putting a wide-angle
  lens on the booth. That pass borrows `scene.background` into an empty scene
  rather than using a hand-written fullscreen shader, which is what keeps the
  tone mapping and colour space identical to a one-pass render — and it puts
  `scene.background` back in a `finally`, because the live loop and `export()`
  both read it.
- **Never capture video from a live canvas.** `MediaRecorder` timestamps frames
  by wall clock, so a clip is only correct if every frame renders inside its
  33 ms. This booth does not, and the file comes out stuttering or in slow
  motion — the machine's performance baked into the artwork. Frames are
  rendered offline and given exact presentation times instead.
- **Chromium is not Chrome for codecs.** H.264 is licensed, so open Chromium
  builds have no H.264 encoder and `VideoEncoder.isConfigSupported` says so.
  That is why there is a VP9-in-MP4 fallback, and why the browser suite can
  test the real pipeline at all.
- **A muxer is right or it produces a file nothing opens, with no middle
  ground.** `tests/video.test.js` parses its own output back and requires every
  box's children to fill it exactly. mp4box.js then caught what that missed: a
  `vpcC` three bytes short, because the colour description is not optional.
  Validate against a parser you did not write.
- **The tent weave is exaggerated 3x** over its literal depth. A true-depth
  weave on a white, brightly lit, tone-mapped roof is invisible. That is a
  rendering choice, not a measurement, and it is commented as one.

## Read map

- `README.md` — commands, architecture, stable behavior.
- `PBR_PHASE.md` — HDRI lighting and PBR surfaces, and what each phase found.
- `src/camera-path.js`, `src/video.js` — the camera moves and the MP4 writer.
  Both carry their reasoning in comments; neither needs a phase document.
- `WALLS_PHASE.md` — the next feature, planned in full.
- `docs/HDRI-ASSETS.md`, `docs/TEXTURE-ASSETS.md` — adding asset files.
- `AI_EXPORT_PHASE.md` — only for AI-export implementation.
- `docs/ORIGINAL-HANDOFF.md` — historical; ignore unless you need old
  requirements.
