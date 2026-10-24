# Splitting scene.js (ROADMAP 1.3)

**Goal:** `src/scene.js` under 1,000 lines, its code moved, not rewritten,
into modules along the seams ROADMAP 1.3 names (booth build, light rig,
picking and interaction, export and render passes), with nothing a person
sees changed. Today it is 3,531 lines: about 330 of module-level helpers and
constants, then `class BoothScene` (3,199 lines, 103 methods, the largest
`update` at 409, `bind` at 279 and the constructor at 142). Phase 2 starts
after this has landed.

**Gate:** `src/scene.js` at 1,000 lines or fewer (`tests/scene-size.test.js`);
every suite green in CI on every pull request. No suite's assertions change.
The only test edits allowed are where a test reads the source of a method
that has moved (see Review focus).

## Constraints

- Schema 1 only gains optional fields. Nothing here touches the schema.
- Local-first: signed out, the app works with no network, as it always has.
- The app runs with `public/assets` empty.
- One seam per pull request, every view suite green on each (CI runs all 44
  in four shards). The seam's own suites run here first, one at a time, never
  two browser suites at once (and no `/code-review` subagent running suites
  beside them).
- No behaviour change, and no rename a person could see: a moved method
  keeps its name, its words and its order of effects.
- `npm run bundle:scene` is untouched. It ships `scene-ops.js` and its
  imports, and `scene.js` is not among them, so no seam needs an
  Art-Talk-Back pull request.

## Decisions (all the agent's; the owner has none to make here)

- **Methods move as mixins, not as helper classes or free functions.** A
  module exports an object literal of methods, e.g.
  `export const lightRig = { buildLightBar(p) { … }, setBarShadows(on) { … } };`.
  `scene.js` installs it on the class's prototype after the class:
  `mixin(BoothScene, lightRig);`. Method shorthand in an object literal is
  the same text as in a class body, at the same two-space indent, and `this`
  is the same scene. So a moved method is byte for byte what it was, every
  call site (`this.x()` inside, `scene.x()` from `main.js` and `src/ui/`)
  stays as it is, and `git diff --color-moved` shows the whole seam as one
  move. *My call.* The alternatives each rewrite every moved line:
  `new LightRig(this)` turns each `this.` into `this.scene.`, and free
  functions turn it into `scene.` and leave a delegating stub per method.
  `main.js` needed a `ctx` because its code was closures over `boot()`;
  here `this` is the context already, so there is no `ctx`.
- **`mixin()` defines, never assigns** (`src/scene/mixin.js`, ~10 lines).
  For each key it calls `Object.defineProperty(Class.prototype, key, { value,
  writable: true, configurable: true, enumerable: false })`, matching what a
  class body makes. It throws if the prototype already has that name, so a
  method left behind in the class and also moved fails at load (and so in
  every view suite), never silently shadowed. `Object.assign` would make the
  methods enumerable and overwrite without a word. No mixin may hold a getter
  or setter: none exist in the class today, and `mixin()` copies values only.
- **Where things go:** `src/scene/<area>.js`, one object per area. Module-level
  helpers and constants move with their only users. The few that two
  areas share (`FLOOR`, `placePanelFrame`) go to `src/scene/shared.js`.
  Anything `scene.js` exports today (`frameKey`, `ART_TEXTURE_MAX`,
  `MAX_TAPES`, `FOV`, `BACKDROP_*`, `safeBackdropFov`, `lockedPitch`,
  `backdropFov`, `isPanorama`, `renderScale`, `temperature`) stays exported
  from `scene.js`, re-exported if it moves, so `src/ui/scene-wiring.js`,
  `src/actions/booth.js`, `src/panels/layout.js` and the tests import as
  before.
- **No mixin imports `scene.js`.** Imports point only from `scene.js` to its
  modules, never back, so there is no import cycle. A JSDoc type import
  (`import("../scene.js").BoothScene`) for the typing pass is fine, because
  it is erased.
- **Smallest and most separate first; the booth build last,** because
  `update` calls 15 other methods and draws on 40 imports.
- **A ratchet:** `tests/scene-size.test.js`, a copy of
  `tests/main-size.test.js` pointed at `scene.js`, gate 1,000. Each seam
  lowers its number first (red), then moves the code (green). The 1,000 is my
  call: what the seams below leave behind (the constructor, `mixin` calls,
  the exported pure helpers) comes to roughly 550. *Cost if wrong:* none to a
  person; the ratchet records the true number after the last seam either way.
- **The new modules wait for the type check with `scene.js`.**
  `tsconfig.app.json` adds `src/scene/**` to its `exclude`, as the main split
  did for `src/ui/**`, so each seam is a pure move. In the typing pass
  (ROADMAP 1.4), each object gets `/** @satisfies {ThisType<BoothScene> & …} */`
  (or a `@this` per method), so `this.` is checked against the class.

## Seams, in order

Names, not line numbers, because the numbers move with every seam. Each row is
one pull request, and its suites run here before pushing. Line counts are
today's.

| # | Moves | To | Lines | Suites |
| - | - | - | - | - |
| 1 | `buildLightBar`, `setBarShadows`; `temperature` (re-exported) | `src/scene/light-rig.js` (+ `mixin.js`, the ratchet) | ~110 | view-artshow, view-lighting, view-finish, view-polish |
| 2 | export and render passes: `exportGLB`, `showRenderRect`, `clearRenderRect`, `frameRect`, `renderPasses`, `surfaceOf`, `applyPass`, `export`; `FRAMES_WITH_SHAPE` | `src/scene/export.js` | ~310 | view-ai, view-frame, view-round13, view-tier, e2e |
| 3 | video: `previewMove`, `recordVideo`, `pose`, `showMoment`, `clearMoment`, `applyPose` | `src/scene/video.js` | ~290 | view-video, view-timeline, view-batch, view-frame, view-show3d |
| 4 | camera, views and walking: `setView`, `setShowView`, `clampToGround`, `zoom`, `focusWall`, `autoPan`, `panRight`, `stopAutoPan`, `setPanTool`, `walkKey`, `startWalk`, `walk`, `stopWalk`; `MIN_CAMERA_Y`, `MAX_POLAR` | `src/scene/camera.js` | ~240 | view-views, view-show3d, view-hdri, view-responsive, view-city |
| 5 | people, pedestals and free-standing panels: `buildPedestals`, `movePerson`, `rebuildFigure`, `cutoutFor`, `loadCutout`, `movePedestal`, `pickPedestal`, `pickPerson`, `pedestalDragTarget`, `pickPanel`, `panelDragTarget`, `movePanel` (+ `shared.js`) | `src/scene/props.js` | ~240 | view-people, view-panels, view-furniture, view-artshow, view-arrange |
| 6 | measuring, guides and the box tool: `refreshGuides`, `setDrawingBox`, `boxFrom`, `showBoxPreview`, `showSnap`, `placeAnnotations`, `setMeasuring`, `setKeepTapes`, `keepTape`, `clearTapes`, `measurePoint`; `MAX_TAPES` (re-exported) | `src/scene/measure-tools.js` | ~230 | view-measure, view-guides, view-box, view-plan, view-row |
| 7 | picking and interaction: `bind`, `point`, `artFrame`, `pickArt`, `wallDrop` | `src/scene/interaction.js` | ~320 | the whole chain |
| 8 | the render loop, the draft and shadows: `setDraft`, `setDraftPolicy`, `letGoOfArt`, `armDraft`, `releaseDraft`, `setQuality`, `previewScale`, `touchShadows`, `dragShadowMaps`, `flushDrag`, `invalidate`, `watchForChanges`, `startLoop`, `stopLoop`, `tick`, `adapt`, `renderFrame`, `renderOverlay`, `overlayParts`, `flareState`, `resize`, `artShadows`, `updateShadows`, `disposeGroup`, `releaseRetired`; the shadow helpers, `disposeTree`, `radialTexture` and the timing constants | `src/scene/render-loop.js` | ~640 | the whole chain |
| 9 | the booth build: `box`, `wallFrame`, `texture`, `update`, `setShow`, `stageShow`, `setSelection`, `applySelection`, `updateArtwork`, `buildUnderlay`, `buildModels`, `loadingModel`, `applyTags`, `setHiddenTags`; `WALL_SLAB_OFFSET`, `parseModel`, `placePedestal` | `src/scene/build.js` | ~760 | the whole chain |

What stays in `scene.js`: the imports the constructor needs, the exported
pure helpers, `class BoothScene` with its constructor, and the nine `mixin`
calls.

## Each seam, step by step

`tools/main-split/` assumes `boot()`'s statements and `ctx`, so most of it
does not fit a class. What carries over: `prune.mjs` (generic), `views.sh`
(generic), and `imports.mjs` once it also writes namespace imports
(`import * as T`), which every mixin needs. New, in `tools/scene-split/`,
each with its usage on its first lines, needing only `espree` and
`eslint-scope`:

- `members.mjs <scene.js>`: the class's members, each with its lines and the
  module-level names it reads.
- `cut.mjs <scene.js> <name,...> <export name> <out module> <out scene>`: cuts
  those members, each with the comment lines directly above it, out of the
  class as whole lines and in source order, into
  `export const <export name> = { … };`. It prints the module-level names the
  cut code reads, sorted into imports, helpers that are used only here (to
  move) and helpers that are shared (to `shared.js` or re-export).

1. Lower `MAX` in `tests/scene-size.test.js` to what `scene.js` will be;
   `node --test tests/scene-size.test.js` is red. (Seam 1 adds the test at
   that number: red on `main`.)
2. `node tools/scene-split/cut.mjs …`, then move the helpers it names. Add
   the module's imports (`tools/main-split/imports.mjs`), `import { <name> }
   from "./scene/<area>.js"` and `mixin(BoothScene, <name>)` in `scene.js`,
   and `tools/main-split/prune.mjs` the imports `scene.js` no longer uses.
3. `npm run lint` (an undefined name is a missed import), `npm run typecheck`,
   `npm test` (the ratchet is green), `npm run build`.
4. The seam's suites, one at a time (`tools/main-split/views.sh <dir>
   <suites…>`), each exit status read. Seams 7–9 run the whole chain in a
   snapshot worktree (HANDOFF → Testing).
5. `git diff --color-moved=dimmed-zebra main` shows nothing but the move,
   the imports and the `mixin` line. Then `/code-review` on the diff, then the
   pull request, which names the seam and its suites. CI runs everything.

## Review focus

- **A test that reads a method's source.** `tests/image-regression.test.js`
  cuts `texture` out of `scene.js` up to `  update(p,`, and `updateArtwork`
  up to `  setView(`, and runs them. Seam 4 moves `setView` away from
  `updateArtwork`, so that slice would run to the end of the file. Seam 4
  changes only the end marker (to the member that then follows
  `updateArtwork`), and seam 9 points both reads at `src/scene/build.js`. The
  slices still parse, because a method in an object literal is the same text.
  Each of those seams runs `node --test tests/image-regression.test.js` red
  first.
- **A method left in both places.** `mixin()` throws on a name the prototype
  already has, so the page fails to load in every view suite.
- **A method missed by the move.** The class no longer has it and nothing
  installs it, so `this.x is not a function` is thrown the first time it is
  called. Lint cannot see `this.` calls, so `cut.mjs` also lists every
  `this.<name>(` the moved code calls and every caller of the moved names
  across `src/`, and the step-5 check is that each one resolves to the class
  or to a mixin.
- **`this` inside a callback.** A moved method's arrow functions keep the
  method's `this`, exactly as before. A `function () {}` inside a method had
  its own `this` before and keeps it. Nothing in the move changes either.
- **Load order.** The `mixin` calls sit right after the class, before
  `scene.js` finishes evaluating, so they run before `main.js` constructs a
  scene. The constructor itself calls methods (`this.resize()`,
  `this.bind()`, …), and that works because those calls happen at `new`,
  which is after the module has loaded.
- **A phone, an old backup, no network.** None of these changes, because no
  logic does. The view suites already run at 390 px (view-responsive) and
  offline (`test:offline` after the build).

## For the owner

Nothing to check: no behaviour changes. If anything looks different after a
seam lands, that is a bug — Export → Something wrong? → Copy a problem report.

## Rulings

(Each judgement call made on the way: what was decided, why, and its cost if
wrong.)

- **2026-10-24, the plan: no questions for the owner.** It is a move, like
  1.2, so every decision above is the agent's, and the defaults are taken.
- **2026-10-24, seam 1: a method's last line gains a comma, and nothing else
  changes.** An object literal needs `},` where a class body has `}`, so
  `cut.mjs` writes that and checks each method ends on a line of its own.
  A script compared the 120 lines taken out of `scene.js` with the new
  module: every one is there, the two closing braces as `},`. The ratchet is
  3,418 (red on `main`'s 3,531). *Cost if wrong:* none; a class used as a
  holder would have kept the brace, but `this` in it would type as the
  holder, not the scene, in the typing pass.
- **2026-10-24, seam 1: a helper the build still reads moves with the rig
  and is imported back.** `temperature` colours the bar's heads and the
  spotlights `update` builds. No mixin imports `scene.js`, so it lives in
  `src/scene/light-rig.js`, `scene.js` imports it from there and still
  exports it. When seam 9 moves `update`, `build.js` imports it from the rig
  too.
- **2026-10-24, seam 1: `mixin` has a node test of its own.**
  `tests/scene-mixin.test.js`: a moved method is defined as the class
  defines one (same descriptor, nothing enumerable on the instance, `this`
  is the instance), and a name the class still has throws.
- **2026-10-24, seam 1: HANDOFF's code map is redone once, at the last
  seam.** Its pointers name methods (`placeShadow` / `updateShadows` in
  `src/scene.js`), and every name stays the same, so a search still finds
  each one meanwhile. The light rig had no pointer.
- **2026-10-24, seam 1: `tools/main-split/imports.mjs` writes namespace
  imports** (`import * as T from "three"`), which every scene module needs,
  and took `scene.js` as its source for this seam's imports unchanged.
