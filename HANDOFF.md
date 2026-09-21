# Booth Studio — handoff

Start a new chat with **this file only**. It is written to be enough on its own.

Artist OS Booth Studio: measured 3D art-show booth planning in the browser.
Extend it; do not rebuild it.

## Now

- Repo: https://github.com/yitzhach/booth-studio
- Production: https://booth-studio.bobdylan2000.workers.dev
- `main` is deployed. Every other branch is preview-only.
- **Last deploy: 2026-09-19** — the art-show booth and its neutral defaults,
  the pedestals, the Walls tool, the light-bar diffusion slider, the backdrop
  pole limit, people for scale, indoor fixture hiding, the Ken Burns move, the
  Video tab with its batch list and the overhead lens flare are all on `main`
  and live.
- **Merged and deployed 2026-09-19, later the same day:** the ground library,
  selection without a rebuild, the drag smoothing, the artwork position
  sliders, the hall switching off in a photographed environment, and the
  light bar's controls repeated in Lighting. Nothing is sitting unmerged on a
  branch. **Check `window.BOOTH_BUILD` against the commit before believing a
  fix did not ship** — a Cloudflare build takes a few minutes, and a merge has
  twice been reported as not working while the build was still running.
- **Merged and deployed 2026-09-21:** fast edit mode, the light bar's two
  widened ranges, trade show as a white hall with the warehouse split out as
  its own preset, a hide switch and placement/scale sliders for the figures,
  and neighbouring booths that match this booth's size and face the right way.
  All five came from looking at the live site. Every suite was green before
  the merge: 218 Node tests, all eleven view suites, the browser suite and
  `wall-assets`.
- **Merged and deployed 2026-09-21 (later):** uploading files an original
  instead of hanging it, fixture brightness as a percentage, fast edit arming
  itself on a double-tap, and the four things that made a booth full of uploaded
  photographs slow. All four came from a 2014 iMac in Chrome and from a phone.
  `claude/nice-hawking-dynrum` is now on `main`.
- **Uploading files an original; tapping one hangs it.** Choosing several
  images at once used to hang every one of them on the back wall at the same
  x and y. Coplanar artwork has no depth order, so the wall flashed through
  all of them — and nothing had been asked for. `upload()` now adds assets and
  no placements; the library already listed an original with no placement, so
  this was a deletion rather than a mode. Tapping a library card hangs it
  (`addCatalogPlacement`, which was already wired), dragging one onto a wall
  still drops it where you point, and `openSpot()` in `src/model.js` keeps a
  new placement off one that is already there: right along the row, then down
  a row, then up, and an honest overlap rather than a refusal if the wall is
  genuinely full.
- **Fixture brightness is a percentage, 0..100, default 50.** The stored unit
  is still the light's own power and the schema still accepts 0..300 — the
  slider carries a scale instead. `LIGHT_BAR_POWER_STEP` (0.16) is how many
  stored units one slider point is worth, `range()` takes it as its ninth
  argument and writes `data-scale`, and the change handler multiplies by it in
  the one place a control's value becomes a number. 50 is 8 stored units,
  which is where the bar was judged to read right; the old default of 60 was
  called much too hot. A booth carrying 60 reads 375 here and widens its own
  slider to reach it, and offers `Set brightness to 50` rather than having its
  stored value rewritten behind its owner's back.
- **Fast edit arms itself, and costs nothing to reach.** Double-tapping
  artwork arms its move-and-scale handles, and handles are the start of a
  drag, so that gesture now turns fast edit on (`activateTransform` in
  `src/scene.js`). It is also a switch in Layout → Drawing speed, where
  someone arranging a booth is already looking. Toggling it no longer calls
  `render()`: that rebuilt every wall, texture and light and redrew the
  library and the whole inspector, so the control whose job is to make the app
  faster cost a pause of its own on the way in. `setDraft()` and `syncTools()`
  in `src/main.js`; `tests/view-responsive.mjs` pins that a toggle leaves
  `scene.revision` alone.
- **An uploaded original costs what it should now.** Four separate things, all
  of them the same mistake — treating a 25 MB base64 string as though it were
  free:
  - **The undo history and every save stringified them.** `checkpoint()` ran
    `JSON.stringify(p)` on each edit, and thirty-five of those are kept. A
    booth with a dozen 20-megapixel photographs carries fifty-odd megabytes of
    base64, so each nudge of a slider built a fifty-megabyte string. `snapshot()`
    / `fromSnapshot()` in `src/main.js` stringify the layout and carry the
    assets by reference — a shallow copy of the map, which is a few string
    references whatever the strings weigh. An original is never edited, which
    is what makes sharing them safe.
  - **Every re-render pointed a dozen `<img>` tags at the originals.** A click
    redraws the library and the inspector. Each asset now carries an optional
    `thumb`, a ~15 KB JPEG made at import (`thumbnailOf` in `src/storage.js`),
    and `artThumb()` shows that. Assets from before it existed are backfilled
    one at a time after the first frame — derived data, so no checkpoint and
    nothing in the undo history.
  - **Textures decoded the whole original and then shrank it on a canvas.**
    `decodeAt()` in the new `src/image-source.js` hands `createImageBitmap`
    the target size, so the browser's own decoder does it off the main thread;
    the old path is still there for anything that will not. The image editor's
    720 px preview goes through it too. No `imageOrientation` is asked for, so
    the result is the way up an `<img>` gave and `flipY` stays at three's
    default — `tests/e2e.mjs` samples the four quadrants of the fixture to
    hold that.
  - **IndexedDB was handed the whole project 350 ms after every edit.**
    `src/storage.js` now keeps the layout and the images in two object stores:
    the layout is one small record, each original is a row written when it
    arrives and not again. A stamp of role, thumbnail length and data length
    is what decides "changed" without comparing megabytes. Backups are
    untouched — a `.booth.json` is still one document with its images inside,
    which is what makes it portable and what schema 1 promises.
- The photoreal phase (`PBR_PHASE.md`) is done through Phase 4: HDRI lighting,
  PBR ground surfaces, the tent canvas and a fabric wall finish. Assets are
  committed and live. `public/assets` is 28 MB of a ~50 MB budget.
- **The ground is one list with two groups.** Layout → Surroundings → Ground
  now holds **Preset grounds** (the six shipped PBR kinds) and **Your
  photographs** (uploads, each named) in one picker, and selecting either
  switches the floor. This removes the upload-outranks-preset behaviour that
  was reported three times as a broken dropdown: there is no override and
  nothing to remove before a preset works. `booth.ground` holds a kind or
  `"upload:<asset id>"`; an older backup's `booth.groundAsset` is read as the
  first entry of the library and never dropped. `GROUND_LIBRARY_PHASE.md`.
- **Selecting a work rebuilds nothing.** It used to go through `render()`,
  which disposes and rebuilds the whole scene — every wall, every texture, the
  HDRI — to draw one blue outline, which is why the handles were slow to
  appear on a double-click. `applySelection()` in `src/scene.js` draws the
  outline and the eight handles, and is the one path both the rebuild and a
  plain click use; `renderSelection()` in `src/main.js` is what a click costs
  now. `tests/view-responsive.mjs` pins it against `scene.revision`, the
  rebuild counter — if a future change makes selecting rebuild again, that
  test fails rather than the app merely feeling slow.
- **A drag is one move per frame, and shadows wait for the end of it.** Nine
  shadow-casting heads over an art-show booth were re-rendered on every
  pointer event, several times per displayed frame. Moves are now applied once
  per frame from the render loop (`flushDrag`) and shadows are refreshed when
  the gesture ends (`touchShadows` / `settleShadows`). Shadows are therefore
  frozen mid-drag, deliberately.
- **Artwork can be placed with a slider.** Artwork → Placement: Slide
  left / right and Slide up / down beside the two edge fields. The travel is
  the wall less the work's own size, so the end of the slider is the work
  flush with the edge. One undo step per gesture, through `constrain()` and
  `updateArtwork()` — the same edit as typing the number.
- **An art-show booth no longer stands in its own hall in a photographed
  environment.** The hall's white walls used to cut across the photograph as
  a band at mid-height. Choosing any environment but the neutral studio now
  switches the hall off, and the toggle is repeated in Layout beside the
  environment picker. The booth, its walls, its light bar and the panel
  module are untouched: this is the room, not the booth. It is a default, not
  a lock — tick it again and the hall comes back.
- **The light bar is adjustable from the Lighting tool too.** Brightness,
  temperature and diffusion are mirrored there, because that is where someone
  looks for lighting; they are the same settings as in Art show, not a second
  set. How many heads and how high stay in Art show.
- **Video export is done.** Four eased camera moves, a live preview, and an MP4
  written by hand. `src/camera-path.js`, `src/video.js`,
  `scene.previewMove()` and `scene.recordVideo()`.
- **The backdrop is drawn in its own pass**, through a lens wider than the
  camera's, so the surroundings can be pulled back without a wide-angle booth.
- **Five fixed camera moves**, including **Ken Burns · slow drift** — a very
  slow push with a touch of drift, for framing one piece rather than the room.
- **Video has its own tab.** Inspector → **Video**: the move, the clip length,
  the frame rate, the resolution, the preview, the MP4 button, the timeline and
  a **batch list** — queue several clips and render them in one go, each
  keeping the settings it was queued with (including a frozen copy of its
  timeline). The Export tab still carries the same video controls beside the
  PNG and the guide; they are the same settings, not a second set. A single
  export and a batch run through one loop, `runClips()`, so they cannot drift
  apart.
- **The lens flare can come from an unseen overhead light.** Timeline → Lens
  flare → Comes from: **Overhead** (the default) is an imaginary source 20 ft
  over the centre of the booth, standing in for the sun or a hall's high bay —
  nothing is drawn there and nothing is lit by it, so it works in a booth with
  no spotlights at all. **Brightest spotlight** is the old behaviour, and is
  offered but disabled when there are no spotlights. `OVERHEAD` and
  `flareOrigin()` in `src/flare.js`.
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
- **An art-show booth opens neutral.** The venue switch now also sets the
  environment preset to the neutral studio, alongside the studio floor and
  horizon it already set: a photographed warehouse behind a seamless white
  indoor booth is one venue's light on another's walls. All three stay
  editable afterwards — it is a default, not a lock.
- **Spotlight housings hide themselves indoors.** Under `tradeshow`,
  `warehouse` or `home`
  the hall's own track lighting is already in frame, so the booth's fixtures
  are clutter hanging in mid-air. Lighting → Spotlight fixtures: Auto (the
  default), Always show, Never show. The rail above the booth always stays;
  only the housings go, and the light itself is unchanged. An art-show booth
  counts as indoors whatever the environment picker says, because it has its
  own light bar overhead.
- **People for scale.** Layout → People: add a woman (5′6″) or a man (6′0″),
  up to six, each with editable height, position and facing. `src/people.js`
  builds them; they are stylised on purpose, and excluded from the hanging
  guide.
- **The backdrop is aimed from the Layout panel.** Layout → Surroundings →
  Backdrop: a zoom slider with -/+/reset buttons, plus pan (horizontal) and
  tilt (vertical). `+`/`-` on the keyboard zoom the viewport camera.
- **The indoor art-show booth is done.** Two new inspector tabs. **Art show**
  switches `booth.venue` to `"artshow"`: seamless white walls (144″ back, 120″
  sides, 144″ tall), no canopy, a light bar across the front with nine
  directional heads spotting the three walls, and a white exhibition hall with
  30 ft ceilings around it. Booth dimensions, wall dimensions and the
  individual display panel (38″ default) are all typed in inches; `Rebuild
  walls from this panel` snaps the walls to whole panels. **Walls** holds the
  free-standing walls — moved out of Layout — and the new pedestals (44 × 12 ×
  12 by default, solid top, double-click in the booth to pick one up and drag
  it). `src/lightbar.js` derives the nine fixtures from the booth's own
  measurements; `ART_SHOW_PHASE.md` is the record of what was decided.
- **The light bar is diffused**, after the first look reported it as harsh.
  Art show → Light bar → **Diffusion** (0..1, default 0.7) opens the beams
  until they overlap into a wash, fades their rims, fills their shadows
  instead of stacking nine hard ones, trims the fixtures back as they widen,
  and adds a bounce fill standing in for the white hall. `lightBarOptics()`
  and `lightBarBounce()` in `src/lightbar.js` are the whole of it, both pure.
  **Diffusion 0 reproduces the old lighting exactly** — it is a setting, not
  a replacement — and the browser test asserts that after dragging it to zero.
- **Free-standing interior walls are done.** Layout → Free-standing walls: add
  a panel, type its width, height, X/Z position and rotation in inches, and
  hang art on either face through the usual Location dropdown. `booth.panels`
  is a separate optional list beside `booth.walls`, so every older backup still
  loads; `wallSpec()` in `src/model.js` is the one place that answers "what am
  I measuring against" for a perimeter wall and a panel alike.
  `WALLS_PHASE.md` is now the record of what was decided.

## Next

1. **Look at the art-show booth on the live site and set Diffusion.** This is
   the first thing to do and it needs a human, not a session: no agent can
   load production. Open Art show, and judge in this order —
   - **Diffusion** (Light bar, default 1.5 on a 0..3 scale) is the one number
     in the softening pass that was chosen rather than derived. It was 0.7 on
     a 0..1 scale, was judged still harsh at its old maximum, and the scale
     was widened rather than moved: **0..1 is bit-identical to what it always
     was**, so a booth composed against 0.7 lights exactly as it did. Past 1
     the hall takes over — cones opened until they stop reading as cones, and
     the bounce off white walls doing the lighting. Still harsh at 1.5? Drag
     it up; 3 is the top. Flat and washed out? Drag it down. 0 restores the
     original hard lighting exactly, so the slider is safe to explore. If 3 is
     still not enough, the next lever is the bounce cap in `lightBarBounce`,
     not more cone.
   - **Fixture brightness** is the next judgement call, and it has been
     recalibrated twice. 70 was reported as "beyond bright" and 60 — the old
     default — was then reported as much too hot, so the slider is now a
     percentage: 0..100 in steps of 1, where 50 is the default and is 8 stored
     units, and 100 is twice that. The schema still accepts 0..300 and always
     will. A booth composed before this reads 375 and widens its own slider;
     `Set brightness to 50` under the slider is the one drag back. **3500K**
     is the other judgement call.
   - Whether nine shadow-casting spots are affordable on your machine. If not,
     the honest fix is dropping `castShadow` on the washers, not cutting their
     number — with diffusion up, their shadows are mostly fill anyway.
   - Whether the hall reads as a hall, and whether a seamless white wall wants
     the fabric finish on (`wallFinish: "fabric"` works on an art-show booth).
   `ART_SHOW_PHASE.md` says which knob to turn first for each.
2. **Two reports could not be reproduced, and need numbers from the machine
   that saw them.** "Ground textures — grass, concrete — do not show up, just
   the background" and "the tent frame showed but not the fabric". On `main`,
   in a real browser here, all six ground kinds load, bind and render
   distinctly (grass comes out green in a screenshot) and every tent style
   draws its canvas. The third report from the same round — the backdrop
   filling the top of the frame as a smear — **was** reproduced and is fixed;
   see the pole limit above. For the other two, get `window.BOOTH_ASSETS` and
   `window.BOOTH_BUILD` from the browser seeing it before touching code. Of
   the two known causes, an uploaded ground photograph outranking the ground
   kind **can no longer happen** — presets and uploads are one list now. That
   leaves a stale deploy, which is not visible from the repository and looks
   exactly like a broken dropdown.
3. **The two shipped backdrops are 1024×512 and read soft.** This is the one
   open bug with a known fix. Both were prepped from Poly Haven's **1K** HDRI,
   and `tools/hdri-prep.mjs` will not stretch a backdrop past its source. Re-prep
   from the **4K** download and the softness goes:
   ```sh
   node tools/hdri-prep.mjs ~/Downloads/burnt_warehouse_4k.exr warehouse \
     --credit "Burnt Warehouse (Poly Haven)"
   ```
   **No agent session can do this** — polyhaven.com is refused by the sandbox
   egress proxy, as is the workers.dev production host. It needs a human with a
   browser. `docs/HDRI-ASSETS.md` is step by step.
4. **H.264 output is unverified on real hardware.** Open Chromium builds ship no
   H.264 *encoder*, so every sandbox run exercises the VP9 fallback instead.
   That does prove the whole encoder-to-muxer pipeline with real encoder bytes,
   and mp4box.js validated the container — but nobody has opened an
   `avc1`/`avcC` file from Chrome or Safari in QuickTime. If a clip will not
   play, start here.
5. **Unverified on real hardware** — things no one has confirmed by eye,
   because no agent session can load the live site:
   - **Nobody has looked at the Video tab, a batch export or the overhead
     lens flare.** The batch list is covered in a real browser (queue two
     clips, check each keeps its own settings, remove one, clear the list) and
     the overhead flare is checked to throw in a booth with no spotlights, but
     where the flare's ghosts fall over a real render, and whether a batch of
     four 1080p clips is a reasonable wait on a real machine, are judgements.
   - **Nobody has looked at a figure standing in a booth**, at the backdrop
     zoomed wide after the pole limit landed, or at a Ken Burns clip. The
     figures' heights are pinned in metres by a test that reads the meshes
     back, and the pole limit is pinned against the arithmetic it comes from,
     so those are not guesses; how a stylised mannequin reads beside real
     artwork, and whether 52° is the right place to stop widening, are
     judgements made on renders in a sandbox.
   - **Nobody has looked at an art-show booth.** See item 1 — it is the whole
     of that item. The measurements are pinned by tests that read the meshes
     back and the nine spotlights are checked against the arithmetic that
     placed them, so nothing there is a guess; what is left is all judgement.
   - **Nobody has looked at a booth with free-standing walls in it.** Where a
     panel stands is pinned by a test that reads the mesh's world matrix back,
     so that is not a guess, and a click-and-drag in a real browser is covered
     by `tests/view-panels.mjs`. Whether a 72″ divider at the centre of a
     10 × 10 booth reads as useful, whether the fabric weave looks right at a
     panel's width, and whether dragging a wall *feels* right — the
     select-then-drag rule, the floor-plane grab, the 1″ snap — are judgements
     that need a hand on a mouse. Rotating a panel by dragging is the obvious
     next refinement and was deliberately left out: it needs a handle of its
     own, and a wall that spins when you meant to slide it is worse than a
     typed angle.
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
6. **A `home` HDRI** is still missing — an interior with windows on one side.
   That preset falls back procedurally until someone downloads one.
7. **Nobody has looked at the ground picker or the artwork sliders.**
   Both are on `main` and live. Whether two labelled groups in one dropdown
   read as obviously as intended; whether "Delete this ground photograph"
   sounds like a delete rather than a deselect; and whether the placement
   sliders have useful travel on a 10 ft wall. All judgements on a live site.

   **Nor at anything in the 2026-09-21 merge** — see Now. Specifically: whether trade
   show now reads as the white hall it is meant to be; whether the warehouse
   is worth keeping as its own preset at 1024px (see item 3 — it is the soft
   one); whether the figures' new sliders have useful travel, given they reach
   four feet past the booth on purpose so a visitor can stand in the aisle;
   whether a row of same-size neighbours reads better than the old fixed
   10 x 10 ones; and whether the fast edit toggle is worth its place in the
   toolbar. That last one is half answered: it is now automatic on a
   double-tap and also a switch in Layout, and the toolbar button stays.

   **Also newly on `main` (2026-09-21 later):** whether uploading and then
   tapping reads as obvious, whether 50 is right for fixture brightness with
   the percentage slider, and whether fast edit arming itself on a double-tap
   is welcome or startling. **Whether the speed fixes are enough on a 2014
   iMac** — see item 8 below.
8. **Is it actually faster now?** Reported still slow on a 2014 iMac in
   Chrome — and, tellingly, **fast with the sample panels and slow with
   uploaded photographs**. That last part was the diagnosis: four separate
   places treated a 25 MB base64 original as free. All four are fixed on `main`
   now, and **Fast edit** is still there on top of that, now arming itself on a
   double-tap and no longer costing a full re-render to switch on.

   What is **not** yet known is whether it is enough on that iMac, or on a
   phone. If a drag still stutters with fast edit on, the remaining candidates,
   in order: the backdrop's second pass (deliberately left alone, because
   skipping it reframes the hall mid-gesture and a picture that moves under
   your hand is worse than a slow one), then the figures, then dropping
   `castShadow` on the light-bar washers permanently rather than only in fast
   edit. Below that: a click still rebuilds the library and the inspector as
   HTML strings, which is now cheap but not free, and `Export → Preview
   quality → Efficient` is worth trying on a 2014 machine.
9. **Figures are stylised mannequins.** No faces, no clothing, mid-grey. If
   they need to read as a crowd rather than as scale references, that is a
   different asset and a different phase.

Free-standing walls — placement, art on both faces, and now click-and-drag
with sliders — custom video mode with its keyframe timeline, fades and
tracking lens flare, the Ken Burns move, people for scale, and the indoor
art-show booth are **done** and are no longer on this list; see Now.

## Diagnosing "the texture isn't showing"

This came up twice and was guessed at twice. Do not guess a third time.

**`window.BOOTH_ASSETS`** works in production and records, per texture set,
whether it loaded and what it found. `window.BOOTH_BUILD` gives the deployed
commit. `window.__booth` is dev-only.

Two real causes were found, and one of them no longer exists:

- ~~**An uploaded ground photograph outranks the Ground kind entirely.**~~
  **Fixed.** Presets and uploads are two groups of one picker, so a preset
  always switches the floor and there is nothing to remove first. An older
  backup's upload opens as the first entry of the library. If a report from
  before this shipped mentions Remove ground texture, that is why.
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
machine seeing it** before touching code. The remaining known cause is a stale
deploy, which looks exactly like this and is not visible from the repository;
the other one, an uploaded ground photo outranking the kind, was removed when
the picker became one list.

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
npm test                 # 224 Node tests
npm run build
npm run test:view        # camera, city, env presets, HDRI, ground, ground library, tent, walls, video, timeline, people, panels, responsiveness, art show
npm run test:browser     # 25 end-to-end checks
BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium node tests/wall-assets.mjs
```

The sandbox has WebGL via swiftshader, but the pinned Playwright expects a
newer Chromium than is installed, so pass the browser explicitly:

```sh
BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium npm run test:view
```

**Never verify through a pipe.** A pipeline's exit status is the last command's,
so `npm test | grep PASS` exits 0 even when the suite fails. This has already
hidden a failure once. Run each suite directly.

The same trap wears a second costume, and it has now caught someone too:
`npm run test:view > log; echo $?; grep PASS log` reports the **grep's** exit
status, not the suite's, so a run that died halfway reads as a pass because
the log it left behind still had PASS lines in it from the suites that ran
before the failure. Print the suite's own `$?` immediately after it and read
*that* number. Count the PASS lines as well: eleven suites means eleven.

**Do not edit `src/` while a view suite is running.** The suites drive a live
vite dev server, so saving a module hot-reloads the page mid-assertion and the
run dies on `window.__booth` being undefined. That is not a flake and not a
regression — it is the editor and the test sharing one server.

## Rules that are easy to break

- Preserve schema-1 backup compatibility. Optional fields and widened enums are
  fine; changed meaning is not. `booth.panels` and the widened `a.wall` are the
  worked example; `WALLS_PHASE.md` explains how it was kept. The art-show
  booth added five more optional keys — `venue`, `artShow`, `lightBar`, `hall`
  and `pedestals` — the same way, and `lightBar.diffusion` later became a
  sixth, nested inside one of them. `artShowPanel()` / `lightBarSpec()` /
  `hallSpec()` are the only things that read any of them, so `undefined` means
  the defaults everywhere. The ground library then widened `booth.ground` from
  an enum of kinds to "a kind **or** `upload:<asset id>`" and added one
  optional key, `groundPreset` — a widened enum and an optional field, the two
  moves that are allowed. `booth.groundAsset` still opens and still shows its
  floor; `adoptGroundAsset()` reads it as the first library entry rather than
  dropping it.
- **Never narrow a stored range; widen the slider instead.** The schema is a
  promise to backups already on disk, so `finite(l.power, 0, 300)` stays 0..300
  even though the Fixture brightness slider now offers 0..70. A value past what
  the slider offers widens that slider for the one booth carrying it, rather
  than being clamped the moment the panel is drawn. `panelSlider`, `artSlider`,
  `personSlider` and `lightBarLevels` all make this move; it is the pattern.
  Widening a stored range — `diffusion` from 0..1 to 0..3 — is allowed, and is
  only safe because the old stretch of the curve was left bit-identical.
- **A view setting must never reach an export.** Fast edit, preview quality and
  the selection outlines are all about this machine, not about the booth.
  `export()` and `recordMp4()` each put full quality back before they draw a
  frame and restore it in a `finally`. A PNG with the shadows missing because
  of how someone's laptop felt that afternoon is not a booth drawing.
- **Never alter stored original image data.** Edits belong to placements.
  `asset.thumb` is the one derived thing an asset carries, and it is optional,
  regenerable and never read in place of `asset.data` by an export, a backup
  or the hanging guide. It is also what makes sharing assets by reference
  between undo snapshots safe: if an original could be edited in place, a
  snapshot naming it would not describe the project it came from.
- **Keep the images out of anything that runs per edit.** The undo history,
  the debounced save and the IndexedDB write all used to copy every uploaded
  original. `snapshot()` / `fromSnapshot()` in `src/main.js` and the two
  object stores in `src/storage.js` are how each of them stopped. A new
  per-edit copy of `p` should go through `snapshot()` rather than
  `JSON.stringify` or `structuredClone`.
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
- **A drag and a typed number must be one edit, through one function.** A
  panel's frame placement is three lines of trigonometry; having the drag
  carry its own copy would mean a dragged wall landing somewhere a typed wall
  would not. `placePanelFrame()` is called by the scene build and by
  `movePanel()`, and `tests/view-panels.mjs` drags a panel and then reads the
  mesh's world matrix against the number the drag stored.
- **Rebuilding the scene per pixel of a drag is not an option.** `update()`
  disposes and rebuilds everything. Artwork already had `updateArtwork()` for
  this; a panel got `movePanel()`, which is cheap only because everything a
  panel carries — its exterior frame, its posts, the art on both faces — is a
  child of the panel's own frame group.
- **A click target that big needs a first click that does nothing.** Selecting
  on the first click and dragging only once selected is what keeps a free-
  standing wall from being shoved across the floor by someone reaching for an
  orbit. The Move tool is the deliberate exception.
- **One lookup function is cheaper than six generalisations.** Three fixed
  walls were assumed in six places. Rather than teach each about panels,
  `wallSpec(p, key)` answers "what am I measuring against" for either kind and
  returns `null` for a wall that is gone — which every caller already knew how
  to treat, because it looks like a hidden wall.
- **A per-consumer texture cache leaks when a consumer can be deleted.** Walls
  claim their set under `wall:<key>`, and the three perimeter walls are
  forever. A panel is not, so `surfaces.releaseMatching()` now hands back every
  `wall:` claim that is not in the current wall list on each rebuild.
- **A test that passes because the app was slow will fail when it gets
  faster.** `tests/view-textures.mjs` asserted that the grass floor keeps its
  procedural canvas "without files" — but grass ships files, and the
  assertion only held because the real set had not finished loading inside a
  300 ms wait. Making selection stop rebuilding the scene freed the main
  thread and the load landed in time, so a correctness improvement read as a
  regression. It now asserts that grass binds its own set. Before believing a
  browser failure, check whether the assertion was true for the reason it
  claims.
- **That suite's temporary `publicDir` is not served.** Its header said
  fixtures came from a temp directory and the repository's `public/assets`
  was untouched. The second half is true; the first is not — this vite server
  ignores the inline `publicDir` and serves the committed assets, so the sets
  those tests exercise are the real ones. Harmless, now written down, and the
  reason the grass case could not simply be "delete the files".
- **The video suites' preview flakiness was fixed, not re-run.** They read the
  camera 220-250 ms after starting a preview and asserted it had moved; under
  swiftshader the first frame can take most of a second, so the read landed
  before the move began. They now sample from inside the preview's own
  progress callback, which only fires once a frame is drawn. If you write a
  browser assertion timed against wall clock in this repo, expect it to fail
  here at random — time it against something the renderer did instead.
- **`tests/environment.mjs` is still flaky in this sandbox**, and it is not a
  regression to chase. All three
  Its assertions are timed against wall clock — a 4096px export must finish
  inside 30s — and swiftshader is slow enough to miss that at random. Re-run
  before believing it.
- **Figures are in the exports, whatever `people.js` used to say.** Its comment
  claimed they were hidden from the PNG and the video "the way the grid and
  handles are", but `export()` and `recordMp4()` hide `isLineSegments` and
  `userData.editorOnly`, and a figure is neither — it carries `userData.person`
  and nothing reads it. That is the right behaviour, since a scale reference
  earns its keep in a render, but it means **Layout -> People -> Show the
  figures is the only way to take one out of an export**. The comment now says
  so. A comment describing behaviour is worth checking against the code that
  implements it before you rely on it.
- **Toggling `shadowMap.enabled` under a built scene does nothing on its own.**
  Whether a material samples a shadow map is compiled into its program, so the
  booth goes on drawing the shadows it was compiled with, and switching them
  back on leaves them missing. Every material needs `needsUpdate` on the way in
  and on the way out. One recompile on a button press is a hitch nobody minds;
  the bug is thinking it is free, and doing it per frame.
- **A preset id is not a preset property.** The rule switching an art-show
  booth's hall off in a photographed environment was written `value !==
  "studio"`, which was correct for exactly as long as studio was the only
  preset without an HDRI. The moment trade show became a white hall of its own,
  a booth standing in a white hall had its white hall switched off. Ask the
  preset what it *is* — `preset.hdri` — not which one it happens to be.
- **The folder name was the only thing that said "trade show".** The
  burnt-warehouse HDRI lived in `assets/hdri/tradeshow/` and its own
  `meta.json` had said *Burnt Warehouse* since the day it was generated. Brick
  and girders behind seamless white art-show walls was reported as a bug in the
  booth; it was a bug in a directory name. If an asset carries provenance, read
  it before trusting the path it sits at.
- **A neighbour booth is this booth's size.** Three hardcoded 120-inch shells
  meant a 10 x 20 stand was measured against 10 x 10 neighbours, and — because
  the gap is measured to the neighbour's centre — a booth of any other depth
  also put them at the wrong distance. The one behind is turned 180 degrees:
  it opens onto the next aisle, so what you see over your own back wall is the
  back of a booth, not the inside of one.
- **A test literal must come from the old code, not from your head.** The
  piecewise diffusion curve is pinned by writing out the values the 0..1 table
  produced *before* it was widened. Two of those were computed by hand and one
  was wrong by 0.02 radians, which the test caught on its first run — which is
  the point: checking a curve against itself would have passed whatever the
  curve became.
- **A 25 MB string is not free, and `JSON.stringify` will not say so.** The
  undo history stringified the whole project on every edit, `p.assets` holds
  every uploaded original as base64, and thirty-five entries are kept. Nothing
  about that is visible in the line that does it — `history.push(JSON.stringify(p))`
  reads like bookkeeping. It was the most expensive thing the app did, it cost
  exactly what someone's own artwork weighed, and it is why a booth of sample
  panels always felt quick while a booth of photographs did not. When a
  structure holds both a layout and its payload, say which one you are
  copying.
- **Decode to the size you are about to draw.** An `<img>` handed a data URL
  unpacks the whole thing — 100 megapixels, if that is what was uploaded —
  and shrinking it afterwards on a 2D canvas has already paid for the bitmap
  you threw away. `createImageBitmap(blob, { resizeWidth, resizeHeight })`
  does it inside the decoder and off the main thread. The catch is
  orientation: ask for `imageOrientation` and you must also set
  `texture.flipY`, and getting that pair wrong turns every artwork upside
  down. Ask for neither and it matches what an `<img>` gave.
- **An asset store is not a schema change; an asset *order* is.** Splitting
  IndexedDB into a layout record and one row per image made a reload
  reassemble `p.assets` in the store's key order rather than the order they
  were added — and the ground picker lists uploaded floors in exactly that
  order. The test that caught it compares `JSON.stringify(project)` across a
  reload, which is worth keeping for that reason alone: it fails on things
  nobody thought were observable. The order is stored beside the layout and
  spent on the way in, so the project itself never carries a key schema 1 has
  not heard of.
- **A slider does not have to be the number underneath it.** Fixture
  brightness is a percentage where 50 is a bar that reads right; the stored
  unit is a light's power and the schema still accepts 0..300. `data-scale`
  on the input is the whole mechanism, converted where a control's value
  becomes a number — one place, so nothing downstream ever sees a slider
  point. The temptation is to rescale the stored values instead, which would
  be a changed meaning and would relight every booth already saved.
- **The tent weave is exaggerated 3x** over its literal depth. A true-depth
  weave on a white, brightly lit, tone-mapped roof is invisible. That is a
  rendering choice, not a measurement, and it is commented as one.

## Read map

- `README.md` — commands, architecture, stable behavior.
- `PBR_PHASE.md` — HDRI lighting and PBR surfaces, and what each phase found.
- `WALLS_PHASE.md` — free-standing interior walls: the schema-compatibility
  problem and every decision taken around it.
- `ART_SHOW_PHASE.md` — the indoor art-show booth: the venue switch, why the
  light bar is scenery rather than spotlights, why the panel module does not
  own the walls, and what still needs eyes.
- `src/camera-path.js`, `src/video.js` — the camera moves and the MP4 writer.
  Both carry their reasoning in comments; neither needs a phase document.
- `CUSTOM_VIDEO_PHASE.md` — custom video mode: the keyframe model, why speed is
  expressed as time, and why the fade is drawn rather than exposed.
- `src/timeline.js`, `src/flare.js` — the keyframe sampler and the flare's
  arithmetic. Both pure, both covered in Node.
- `src/people.js` — the figures, their canon proportions and their defaults.
- `applySelection()` / `renderSelection()` — what a click costs, in
  `src/scene.js` and `src/main.js`. Read both before making selection do
  anything more; they exist to keep a rebuild out of a click.
- `GROUND_LIBRARY_PHASE.md` — presets and uploaded grounds as one list: the
  widened `booth.ground`, why the library is a filter over the assets rather
  than a second list, and how an older backup's override is adopted.
- `FUTURE_BUILD.md` — requested, deliberately not started. Currently empty.
- `docs/HDRI-ASSETS.md`, `docs/TEXTURE-ASSETS.md` — adding asset files.
- `AI_EXPORT_PHASE.md` — only for AI-export implementation.
- `docs/ORIGINAL-HANDOFF.md` — historical; ignore unless you need old
  requirements.
