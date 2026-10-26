# Things learned the hard way

Moved verbatim from `HANDOFF.md` on 2026-10-21 (ROADMAP 1.1). Each is a
mistake made once, or nearly, in this code, and the reason the code is the
way it is. Read the ones near what you are changing; the rules they became
are in `HANDOFF.md` → Rules that are easy to break.

- **The browser suites run with the section chips off** (`navigator.webdriver`
  starts every panel on All). Anything that scrolls to or focuses a panel
  control after a viewport pick must go through `reveal()` / `showSection`,
  and its test must turn the chips on (`booth.sectionTabs` = `on` in
  localStorage, then reload — a second page kills the `--single-process`
  browser) or it will pass while the real app fails.
- **The whole `npm run test:view` chain now runs past ten minutes in the
  sandbox**, longer than one shell call may take, so a timeout there is a
  timeout, not a failure. Run the chain with the longest timeout, see which
  suite it stopped in, and run that one and the rest one by one, reading each
  exit status. And the test Chromium is launched `--single-process`, which
  allows one browser context: a probe that wants several viewport widths
  resizes one page (`setViewportSize`) rather than opening a context per size.

- **three leaves `shadowMap.needsUpdate` up when it does not draw a map** —
  with `shadowMap.enabled` false (fast edit), or with no light casting.
  Anything that reads the flag as "a frame is owed" then draws forever;
  `tick()` did, from the day on-demand drawing landed until 2026-09-23, and
  only in fast edit, which is why nobody saw it. It is cleared after every
  frame now. Test for this class of bug by counting
  `renderer.info.render.frame` over a quiet window, not by timing.
- **The idle-frames check in view-responsive failed two runs in three on an
  unchanged `main`.** `render()` in main.js resizes the viewport one
  animation frame after every edit, swiftshader can take over a second to
  hand out that frame, and its `invalidate` started the 15 s heartbeat inside
  the measured window. The check now lets it land first. If an idle check
  flakes, find the late invalidate (wrap `invalidate` and log a stack) before
  touching the loop.
- **`half` is a reserved word in GLSL ES.** A uniform or argument named
  `half` compiles on some drivers and not others; the drop-shadow shader says
  `extent`, and a node test refuses the word.

- **Headless Chromium hands an idle page about three animation frames a
  second.** Once the loop stopped drawing continuously, a change could wait
  ~400 ms for its frame here, and a camera preview's first frame could miss
  a one-second move entirely. Real browsers fire rAF at the display rate, but
  the loop now has a 50 ms timer behind every asked-for frame and a preview
  draws its first frame immediately. A test that reads a label or a pixel
  straight after a change still wants a short wait.
- **`this.frames` in scene.js is the map of wall frames** (`frameKey`), not a
  counter. The on-demand loop's counter is `framesOwed`; naming it `frames`
  broke every drag and was only caught by the e2e suite.
- **`tests/image-regression.test.js` slices scene.js from `updateArtwork(` to
  `setView(`** and evaluates the text. A method added between those two
  breaks it with a SyntaxError; put new methods elsewhere.

- **`tests/e2e.mjs` fails in this sandbox at the 4096 px PNG, and it fails on
  `main` too.** It waits 30 seconds for the download; a 4096 px render under
  swiftshader was measured at 27-31 seconds on `main` and 27-29 on the branch
  that added the export frames, so the suite is a coin flip on this machine
  and neither number is a regression. The other fifteen checks pass before
  it. **Measure both sides before believing this one** — a worktree at
  `origin/main` and the same probe is ten minutes and settles it — and raise
  that one wait if it becomes tiresome. It is the same class of flake
  `tests/view-environment.mjs` (then `tests/environment.mjs`) already carries, for the same reason.
- **A readback flushes the GPU; a captured video frame does not.** A still
  drawn twice "to be safe" cost a second 28-second render for nothing,
  because `canvas.toBlob` reads the pixels back and a readback waits for
  everything the GPU still owed. A video frame handed to `VideoEncoder` has
  no such barrier, which is why careful rendering belongs to the recorder and
  not to the PNG. Knowing which operation synchronises is the difference
  between a fix and a doubled bill.
- **An export that inherits the window's shape is not an export size.** Both
  the PNG and the MP4 read their aspect ratio off the canvas, and the code
  said so plainly — "height follows width, from the viewport" — which reads
  like fidelity to what was composed and is actually the browser window
  deciding what a delivered file is. The fix is not a resize afterwards: a
  16:9 file cropped to 9:16 has the booth cut out of it. The frame has to be
  chosen before the frame is drawn, and the camera set up for it.
- **A frame that is not the canvas's needs the camera told.** `setSize` alone
  stretches the picture, because `camera.aspect` still describes the old
  shape. It is set beside the size and restored in the same `finally`, which
  is the same rule the draft mode and the pixel ratio already follow there.
- **What is on the GPU when you read the canvas is not what you asked for one
  line earlier.** Rendering is asynchronous, so a frame captured immediately
  after its draw call can still carry the previous frame's backdrop pass,
  shadow map or a texture that finished uploading a moment too late. That is
  what "glitches on export" was. Drawing it twice with a yield between is the
  cheap, honest fix; it costs double and it is a setting for that reason.
- **A shadow that is lit is not a shadow you control.** The wall gap was
  invisible head-on because the thing that would cast it — a raking spotlight
  — is often diffused into a wash with no direction left in it, and because
  nine shadow maps cannot be spent on one batten. Drawing it as a card on the
  wall makes it three sliders instead of a lighting setup, puts it in every
  export, and costs one transparent plane per work.
- **Hiding is not deleting, and the difference is the aim.** A spotlight's
  position and target are the slowest thing in the app to get right, and
  deleting was the only way to take one out of a picture. One optional
  boolean, absent meaning showing, buys the whole feature and keeps every
  older backup.
- **A universal setting should be a rule, not a rewrite.** Painting every
  work's `edgeColor` on the way in would be a one-way door: switching the
  option off afterwards could not put back what each work carried. So the
  booth's colour answers for every work while the switch is on, each
  placement keeps its own, and the rewrite is a separate button that says
  what it does.
- **The system colour picker is a closed window.** Nothing can be added
  inside `<input type="color">`'s panel, so "save a colour in the picker"
  becomes a row of swatches under it. Worth knowing before designing around
  the native control.
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
- **`tests/view-environment.mjs` (then `tests/environment.mjs`) is still flaky in this sandbox**, and it is not a
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
