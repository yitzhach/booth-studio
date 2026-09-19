# Booth Studio — handoff

Start a new chat with **this file only**. It is written to be enough on its own.

Artist OS Booth Studio: measured 3D art-show booth planning in the browser.
Extend it; do not rebuild it.

## Now

- Repo: https://github.com/yitzhach/booth-studio
- Production: https://booth-studio.bobdylan2000.workers.dev
- `main` is deployed. Every other branch is preview-only.
- The photoreal phase (`PBR_PHASE.md`) is done through Phase 4: HDRI lighting,
  PBR ground surfaces, the tent canvas and a fabric wall finish. Assets are
  committed and live. `public/assets` is 28 MB of a ~50 MB budget.
- **Video export is done.** Four eased camera moves, a live preview, and an MP4
  written by hand. `src/camera-path.js`, `src/video.js`,
  `scene.previewMove()` and `scene.recordVideo()`.
- **The backdrop is drawn in its own pass**, through a lens wider than the
  camera's, so the surroundings can be pulled back without a wide-angle booth.
- **Five fixed camera moves**, including **Ken Burns · slow drift** — a very
  slow push with a touch of drift, for framing one piece rather than the room.
- **Custom video mode is done.** Export → Video → Camera move → **Custom** opens
  a non-modal timeline: compose a shot in the viewport, press Add keyframe,
  orbit, repeat. Per-keyframe time, hold and ramp, fade in/out, and an optional
  lens flare that tracks the camera. `src/timeline.js`, `src/flare.js`, the
  overlay pass in `scene.js`, and `CUSTOM_VIDEO_PHASE.md` for the reasoning.
  The recorder, the encoder and the muxer are unchanged: a timeline is another
  implementation of the same `samplePath(move, base, t)` contract.
- **The backdrop is locked to the horizon**, on by default, with an on/off in
  Layout → Surroundings → Backdrop. The backdrop's wider lens compresses the
  same pitch, so the photographed horizon used to slide against the floor as
  the camera tilted; `lockedPitch` in `src/scene.js` over-rotates the backdrop
  camera by the ratio of the two lenses' tangents. Pitch only — scaling yaw the
  same way would spin the backdrop nearly twice in a full orbit.
- **The backdrop lens is bounded by the pole, not by the framing slider.**
  `BACKDROP_EDGE_LIMIT` (52°) caps how far from the horizon the backdrop's
  frame edge may land, and `safeBackdropFov()` narrows the lens per frame to
  respect it. This was a real reported artifact: at 25% framing and a 12°
  tilt the lens reached 135°, the top of the frame sampled the equirectangular
  pole, and the render came back as radial smear across the upper half. Tilt
  far enough and the backdrop stops widening and falls back to the camera's own
  lens, which never shears. The lens and the horizon lock settle together in
  two passes, so the limit cannot silently switch the lock off.
- **Spotlight housings hide themselves indoors.** Under `tradeshow` or `home`
  the hall's own track lighting is already in frame, so the booth's fixtures
  are clutter hanging in mid-air. Lighting → Spotlight fixtures: Auto (the
  default), Always show, Never show. The rail above the booth always stays;
  only the housings go, and the light itself is unchanged.
- **People for scale.** Layout → People: add a woman (5′6″) or a man (6′0″),
  up to six, each with editable height, position and facing. `src/people.js`
  builds them; they are stylised on purpose, and excluded from the hanging
  guide.
- **The backdrop is aimed from the Layout panel.** Layout → Surroundings →
  Backdrop: a zoom slider with -/+/reset buttons, plus pan (horizontal) and
  tilt (vertical). `+`/`-` on the keyboard zoom the viewport camera.

## Next

1. **`WALLS_PHASE.md`** — free-standing interior walls you can place and hang
   art on. Requested, planned, not built. Read that file; it explains the
   schema-1 compatibility constraint that shapes the whole design.
2. **The two shipped backdrops are 1024×512 and read soft.** This is the one
   open bug with a known fix. Both were prepped from Poly Haven's **1K** HDRI,
   and `tools/hdri-prep.mjs` will not stretch a backdrop past its source. Re-prep
   from the **4K** download and the softness goes:
   ```sh
   node tools/hdri-prep.mjs ~/Downloads/burnt_warehouse_4k.exr tradeshow \
     --credit "Burnt Warehouse (Poly Haven)"
   ```
   **No agent session can do this** — polyhaven.com is refused by the sandbox
   egress proxy, as is the workers.dev production host. It needs a human with a
   browser. `docs/HDRI-ASSETS.md` is step by step.
3. **H.264 output is unverified on real hardware.** Open Chromium builds ship no
   H.264 *encoder*, so every sandbox run exercises the VP9 fallback instead.
   That does prove the whole encoder-to-muxer pipeline with real encoder bytes,
   and mp4box.js validated the container — but nobody has opened an
   `avc1`/`avcC` file from Chrome or Safari in QuickTime. If a clip will not
   play, start here.
4. **Unverified on real hardware, older** — things no one has confirmed by
   eye, because no agent session can load the live site:
   - The custom timeline and the lens flare are covered by tests in a real
     browser, but nobody has *looked* at a keyframed clip. The flare's ghost
     spacing, its warmth ramp and the fade lengths are judgement calls made
     without a render; they are the first things to adjust if it reads wrong.
   - Whether the backdrop horizon lock looks right through a full orbit. The
     arithmetic is exact at the centre of frame and approximate across it, and
     approximate is a thing you see, not a thing a test catches.
   - Are the four ground tile sizes really 2 m? They were recorded at the
     tool's default, not read off the ambientCG pages. Wrong tile size makes a
     floor read as a picture of a floor.
   - Does the wall weave look right? It tiles at the carpet's real size, about
     1.5 repeats across a 10 ft panel, which may be coarse for a pro-panel.
     `WALL_SET` in `src/surfaces.js` points at `carpet`; pointing it at
     `canvas` is a one-line change to a finer weave.
   - Is the tent weave visible? Its relief is exaggerated 3x (`TENT_WEAVE`)
     because a true-depth weave on a white roof washes out.
5. **A `home` HDRI** is still missing — an interior with windows on one side.
   That preset falls back procedurally until someone downloads one.
6. **Two ground-texture sets — presets and a user-uploaded library.** Requested
   after an upload was found to override the preset picker, which is today's
   design and reads as a broken dropdown. Planned in `FUTURE_BUILD.md`; not
   started. **This is the most likely explanation of any "the ground texture
   does nothing" report** — check `booth.groundAsset` before the loader.
7. **Figures are stylised mannequins.** No faces, no clothing, mid-grey. If
   they need to read as a crowd rather than as scale references, that is a
   different asset and a different phase.

Custom video mode is **done** and is no longer on this list; see Now.

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
correctly, checked with `wrangler dev --local`. The build output contains all
37 asset files.

**Also ruled out, 2026-09-18.** "Grass does nothing, the floor stays cement"
was reported again and chased to the end this time. On `main`, against the
committed assets, all six ground kinds load, claim, bind and **render
distinctly** — grass comes out green in a screenshot. `BOOTH_ASSETS` reported
every set `loaded` with all four maps at a 2 m tile, and HEAD on every
`color.jpg` returned 200 `image/jpeg`. The selector, the loader and the
renderer are not the bug. If it recurs it is state or staleness on that
browser, so get **`window.BOOTH_ASSETS` and `window.BOOTH_BUILD` from the
machine seeing it** before touching code — the two known causes (an uploaded
ground photo outranking the kind, and a stale deploy) both look exactly like
this and neither is visible from the repository.

## Diagnosing "the video won't play"

- **Ask which codec it used.** The export panel states it before rendering and
  the toast repeats it afterwards. VP9 in MP4 is the fallback for a browser
  with no H.264 encoder; it plays in Chrome, Edge and VLC and **QuickTime
  Player cannot open it at all**. That is the most likely answer, and the app
  now warns rather than handing over a file that looks broken.
- **If it says H.264 and still will not play**, the container is the suspect.
  `muxMp4` takes the encoder's own `decoderConfig.description` verbatim as the
  `avcC` payload, and the H.264 branch has never been produced on real
  hardware here. `tests/video.test.js` parses the file back; use mp4box.js for
  an opinion this repository did not write.
- **The H.264 level is computed from the frame size and rate** (`h264Level`).
  It used to be hard-coded at 4.0, which cannot carry 1440p at any rate or
  1080p at 60 — a stream that exceeds its declared level is out of spec and a
  strict decoder may refuse it. If you add a size or a frame rate, the test
  "every offered size and frame rate declares a level it does not exceed"
  covers you.

## Deployment

| Push target | Cloudflare result |
| - | - |
| `main` | **production** |
| any other branch | preview only |

- Merging to `main` is the deploy. There is no other step, and **there is no
  GitHub Actions workflow** — it is Cloudflare's Git integration alone.
- **The dashboard uploader cannot deploy this project** and will say so: it is
  a Vite app with a `wrangler.jsonc`, so it needs a build. Do not fight it.
- `wrangler deploy` with no credentials opens a browser login and hangs forever
  in a headless session. Needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
  and `CI=true`. Merging is easier.
- Account `8e38cda861b39784706d53545a0a435f`, worker `booth-studio`.
- The footer reads `v0.1.0 · <time> UTC · <commit>`, hidden under the mobile
  breakpoint — use `window.BOOTH_BUILD` on a phone. **Check it before
  believing a fix did not ship**: a merge was reported as not working twice,
  and both times the build simply had not finished.

## Testing

```sh
npm ci
npm test                 # 171 Node tests
npm run build
npm run test:view        # camera, city, env presets, HDRI, ground, tent, walls, video, timeline, people
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

- **A spherical backdrop is framed by field of view alone.** Moving the camera
  cannot pull it back, because the background is a lookup by view direction. So
  "the backdrop is too zoomed in" and "the backdrop is blurry" are one bug: a
  62 degree view of a 1024px equirectangular image puts about 176 source pixels
  across the whole canvas. It is now drawn in a pass of its own through a wider
  lens. That pass borrows `scene.background` into an empty scene rather than
  using a hand-written fullscreen shader, which is what keeps tone mapping and
  colour space identical to a one-pass render — and it puts `scene.background`
  back in a `finally`, because the live loop and `export()` both read it.
- **Never capture video from a live canvas.** `MediaRecorder` timestamps frames
  by wall clock, so a clip is only correct if every frame renders inside its
  33 ms. This booth does not, and the file comes out stuttering or in slow
  motion — the machine's performance baked into the artwork. Frames are
  rendered offline and given exact presentation times instead. The *preview*
  is deliberately the opposite: driven by wall clock, because a preview should
  take the seconds it claims even if it drops frames doing it.
- **Chromium is not Chrome for codecs.** H.264 is licensed, so open Chromium
  builds have no H.264 encoder. That is why there is a VP9-in-MP4 fallback, and
  why the browser suite can test the real pipeline at all.
- **A muxer is right or it produces a file nothing opens, with no middle
  ground.** `tests/video.test.js` parses its own output back and requires every
  box's children to fill it exactly. mp4box.js then caught what that missed: a
  `vpcC` three bytes short, because VP9's colour description is not optional.
  Validate against a parser you did not write.
- **`isConfigSupported` can hand back a config with fields dropped.** Losing
  `avc.format` would silently produce Annex B samples the muxer cannot wrap, so
  the returned config is merged over ours, never substituted for it.
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
- **What shears an equirectangular backdrop is the frame edge, not the lens.**
  The zoom floor was judged on a level camera, which is half the rule: the edge
  sits at |pitch| + fov/2, so a 135 degree backdrop lens is fine looking
  straight out and catastrophic tilted 12 degrees down — the top of the frame
  lands in the pole, where a whole row of pixels is one point, and the render
  comes back as radial smear. `BACKDROP_EDGE_LIMIT` states the rule where it
  lives, as an angle from the horizon, and the lens is narrowed per frame to
  respect it. A framing percentage on its own cannot prevent this, because it
  does not know the tilt.
- **The backdrop zoom floor is 25%, and 15% was tried and rejected.** Lower
  framing means a wider lens, and past about 25 an equirectangular lookup
  shears: the hall ceiling smears into radial streaks. The floor is a judgement
  made by looking at a render, which is exactly the kind of thing a later diff
  will "clean up" — `BACKDROP_FRAMING_MIN` carries the reason.
- **`backgroundRotation` is a YXZ Euler on purpose.** Pan and tilt are two
  axes of one tripod head; under three's default XYZ order a pan applied after
  a tilt rolls the image, and a rolled panorama reads as the entire hall
  leaning over. `tests/view-hdri.mjs` pins the order and asserts roll stays 0.
- **Figures are lit by the same spotlights as the artwork, so they were made
  darker than the walls.** A figure lighter than the panels blows out under a
  spotlight into a white post, and a white post beside a painting competes with
  it. Mid-grey, flattened front to back, with daylight between the legs: that
  gap is the whole difference between a person and a bollard at any distance.
- **The tent weave is exaggerated 3x** over its literal depth. A true-depth
  weave on a white, brightly lit, tone-mapped roof is invisible. That is a
  rendering choice, not a measurement, and it is commented as one.

## Read map

- `README.md` — commands, architecture, stable behavior.
- `PBR_PHASE.md` — HDRI lighting and PBR surfaces, and what each phase found.
- `WALLS_PHASE.md` — the next feature, planned in full.
- `src/camera-path.js`, `src/video.js` — the camera moves and the MP4 writer.
  Both carry their reasoning in comments; neither needs a phase document.
- `CUSTOM_VIDEO_PHASE.md` — custom video mode: the keyframe model, why speed is
  expressed as time, and why the fade is drawn rather than exposed.
- `src/timeline.js`, `src/flare.js` — the keyframe sampler and the flare's
  arithmetic. Both pure, both covered in Node.
- `src/people.js` — the figures, their canon proportions and their defaults.
- `FUTURE_BUILD.md` — requested, deliberately not started.
- `docs/HDRI-ASSETS.md`, `docs/TEXTURE-ASSETS.md` — adding asset files.
- `AI_EXPORT_PHASE.md` — only for AI-export implementation.
- `docs/ORIGINAL-HANDOFF.md` — historical; ignore unless you need old
  requirements.
