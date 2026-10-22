# Splitting main.js (ROADMAP 1.2)

**Goal:** `src/main.js` under 1,500 lines, its code moved — not rewritten —
into modules along the seams it already has, with nothing a person sees
changed. It is 7,209 lines today, almost all of them inside `boot()`, and
every later phase (ROADMAP phase 2 starts after 1.2 and 1.3) would otherwise
collide in it.

**Gate:** `src/main.js` at 1,500 lines or fewer (`tests/main-size.test.js`);
every suite green in CI on every pull request; no suite's assertions changed
— only an import, where a helper a test reads moves.

## Constraints

- Schema 1 only gains optional fields. Nothing here touches the schema.
- Local-first: signed out, the app works with no network, as it always has.
- The app runs with `public/assets` empty.
- One seam per pull request; every view suite green on each (CI runs all 44
  in four shards); the seam's own suites run here first, one at a time.
- No behaviour change, and no rename a person could see: a moved function
  keeps its name, its words and its order of effects.

## Decisions (all the agent's; the owner has none to make here)

- **One context object, `ctx`,** made once in `boot()` right after the state
  is declared. For each piece of state a moved module uses it has a getter
  and, where the module assigns it, a setter (`get p() { return p; }, set
  p(v) { p = v; }`); for each helper it calls, the function itself. So
  `main.js` keeps its variables and every line outside the moved code stays
  as it is, and a module that assigns state with no setter throws at once
  (modules are strict), never fails quietly. *Cost if wrong:* a getter per
  name is verbose; if `ctx` passes ~60 names, collapse the state into one
  object then, in a pull request of its own.
- **A module is a factory:** `export function createShareDialogs(ctx)`
  returns its functions, and `main.js` takes them under the same names
  (`const { shareFile, openShareLink, … } = createShareDialogs(ctx);`), so
  no call site changes. The call goes before the first render, because a
  function declaration was hoisted and a `const` is not.
- **Where things go:** `src/ui/` for a dialog or a panel's behaviour (share,
  welcome, the timeline, the show-floor panel, the image editor, keep-safe);
  `src/panels/<tab>.js` for a tab's HTML builders (`*Section`, `*HTML`,
  `*Fields`); `src/actions/<area>.js` for the action table, merged back into
  one `actions` with `Object.assign` at start.
- **Smallest and most separate first,** so the pattern settles on 140 lines
  before it meets 1,250; the action table last, as everything calls it.
- **A ratchet:** `tests/main-size.test.js` holds `main.js` at its count after
  the last seam. Each seam lowers the number first (the test goes red), then
  moves the code (green). It can never grow back unnoticed.
- **The new modules wait for the type check with `main.js`.**
  `tsconfig.app.json` (ROADMAP 1.4) leaves out `src/ui/`, `src/panels/` and
  `src/actions/` while the split runs, so each seam moves its code exactly as
  it was and a reviewer reads it with `git diff --color-moved`. The typing
  pass comes after the split, over the new modules and what is left of
  `main.js` together (see Rulings).

## Seams, in order

Names, not line numbers: the numbers move with every seam. Each row is one
pull request; the suites are the ones that drive that code, run here before
pushing.

| # | Moves | To | Lines | Suites |
| - | - | - | - | - |
| 1 | `shareFile`, `sentLinksHTML`, `copyLink`, `sendToLink`, `removeLink`, `showShareLink`, `openShareLink` | `src/ui/share-dialogs.js` | ~140 | view-share, view-hub, e2e |
| 2 | `openWelcome`, `describeBlock`, `describeToAssistant`, `welcomeDismissed`, `chooseRole`, `openQuickStart`, `runQuickStart` | `src/ui/welcome.js` | ~120 | view-roles, view-quickstart, view-assistant |
| 3 | `keepSafeHTML`, `paintKeepSafe`, `remindBackup`, the templates' read and write | `src/ui/keep-safe-panel.js`, `src/ui/templates.js` | ~160 | view-keep-safe, view-report, view-quickstart, view-floor2 |
| 4 | `looksSection`, `heroSection`, `runHeroSet`, `runLook`, `runPolish`; the image editor | `src/ui/polish-panel.js`, `src/ui/image-editor.js` | ~130 | view-polish, view-finish, view-wall-assets |
| 5 | the timeline dialog and the batch | `src/ui/timeline-dialog.js`, `src/ui/batch.js` | ~580 | view-timeline, view-batch, view-video, view-frame, view-polish |
| 6 | the show-floor panel | `src/ui/show-floor-panel.js` | ~380 | view-show, view-show3d, view-hall, view-linked, view-floor2 |
| 7 | Find a tool and the app map | `src/ui/find-tool.js` | ~150 | view-toolsearch, view-assistant |
| 8 | upload and import | `src/ui/upload.js` | ~210 | view-wall-assets, view-textures, e2e |
| 9 | the Walls, Lighting and Art show tabs' builders | `src/panels/walls.js`, `src/panels/lighting.js`, `src/panels/art-show.js` | ~150 | view-panels, view-furniture, view-box, view-artshow, view-finish, view-lighting, view-responsive, view-tier, view-polish |
| 10 | the Layout and Artwork tabs' builders | `src/panels/layout.js`, `src/panels/artwork.js` | ~250 | each tab's suites |
| 11 | the Video, Export and Show floor tabs' builders | `src/panels/*.js` | ~130 | each tab's suites |
| 12–15 | the action table, by area | `src/actions/*.js` | ~1,250 | the whole chain |
| 16 | what is left over 1,500 | — | — | the whole chain |

## Each seam, step by step

1. Lower the number in `tests/main-size.test.js` to what `main.js` will be;
   `node --test tests/main-size.test.js` is red.
2. Cut the functions out unchanged into the new module's factory. Every name
   the moved code took from `boot()` becomes `ctx.<name>`; add those to
   `ctx` in `main.js`, a getter for state and a setter only where the code
   assigns it.
3. `npm run lint` (an undefined name is a missed `ctx.`), `npm run
   typecheck`, `npm test` (the ratchet is green), `npm run build`.
4. The seam's suites, one at a time, each exit status read.
5. `/code-review` on the diff; then the pull request, which says the seam
   and its suites. CI runs everything.

## Review focus

- **A function used before its `const`.** A moved function used during
  `boot()` before the factory call throws a ReferenceError at load. Every
  view suite loads the page, so this cannot pass CI; the factory call also
  sits right after `ctx`.
- **State read once and kept.** `const { p } = ctx` freezes the project at
  that moment; after an undo or a new project the module would edit a stale
  one. Moved code always reads `ctx.p`. Grep the module for destructured
  state before each pull request.
- **An assignment that misses.** `selected = null` in moved code becomes
  `ctx.selected = null`, and needs a setter; without one it throws (strict
  mode) the first time that line runs. The seam's suites must reach every
  assignment; where they don't, the pull request says which.
- **A phone, an old backup, no network.** None of these changes, because no
  logic does; the view suites already run at 390 px and the share and studio
  paths without a network.

## For the owner

Nothing to check: no behaviour changes. If anything looks different after a
seam lands, that is a bug — Export → Something wrong? → Copy a problem report.

## Rulings

(Each judgement call made on the way: what was decided, why, and its cost if
wrong.)

- **2026-10-21, seam 1: the moved code is not typed on arrival.** Type-checked,
  `src/ui/share-dialogs.js` has 13 findings, every one a `querySelector`
  typed `Element` where the code uses a dialog, a button or an input — the
  same kind as `main.js`'s own hundreds. Fixing them would change ten of the
  140 moved lines, and a move that is byte for byte the old code (but for
  `ctx.`) is what makes each seam safe to review. So `tsconfig.app.json`
  excludes `src/ui/**`, `src/panels/**` and `src/actions/**` until the split
  is done. *Cost if wrong:* a type error in a moved module goes unseen until
  the typing pass; no worse than today, when the same code sat in `main.js`,
  which is not checked either.
- **2026-10-21, seam 1: the ratchet is added with it.** `tests/main-size.test.js`
  holds `main.js` at 7,098 lines: red on `main` (7,209), green with the seam.
- **2026-10-21, seam 2: a moved function only the module calls stays inside
  it.** `describeBlock` is called only by `openWelcome`, so `createWelcome`
  does not return it; `main.js` takes back the six it calls. The ratchet is
  6,990 (red on `main`'s 7,098). `ctx` gains `role`, `welcomeFirst`,
  `tabsMore`, `selectedPanel` and `selectedPedestal`, each with a setter
  (the module assigns them all), and `applyRole`, `icon`, `readTemplates`
  and `refreshIcons`.
- **2026-10-22, seam 3: code that reads none of boot's state is plain
  exports, not a factory.** The templates' read and write (the booth
  templates and the floor templates, with their keys and limits, and
  `mergeFloorTemplates`) touch only `localStorage`, so `src/ui/templates.js`
  exports them and `main.js` imports them at the top like any module; `ctx`
  keeps passing `readTemplates` to the welcome unchanged. Keep your work's
  own state (`keepSafeAnswer`, `keepSafeAsking`) was read by nothing else,
  so it moved inside `createKeepSafePanel`. `ctx` gains `deviceStore`,
  wrapped, because its `const` is declared after `ctx`. The ratchet is
  6,876 (red on `main`'s 6,990). The module assigns no state of boot's, so
  there is no setter to reach. *Cost if wrong:* none found; a later seam
  whose code needs state turns its plain module into a factory.
- **2026-10-22, seam 4: a node test that reads moved source follows it.**
  `tests/image-regression.test.js` slices `drawImageEditorPreview` out of
  the source text and runs it; it now reads `src/ui/image-editor.js` and
  hands the fixture project in as `ctx.p` instead of `p`. Its assertions
  are unchanged. The image editor's own buttons (`edit-image`,
  `editor-save`, the rotations) are in the action table and stay there
  until seams 12–15; `currentArtwork`, which the table calls everywhere,
  stays in `main.js` and reaches the editor through `ctx`. `editRange` is
  only the editor's, so it is not returned (seam 2's ruling).
  `POLISH_NOTE` moved with its only user; `HALL_OFF_NOTE` moved too and is
  exported, because the environment menu in `main.js` says it as well.
  The editor's preview names its canvas context `ctx`, as it always did:
  that shadows the module's `ctx` inside `paint` only, which reads nothing
  of boot's. view-wall-assets is the suite that drives the editor, so it
  joins the row. `ctx` gains `busy`, `busyVideo`, `editingStart` (getters
  only: nothing here assigns them), `currentArtwork`, `runClips` and
  `kit` (wrapped: its `const` comes after `ctx`). The ratchet is 6,764
  (red on `main`'s 6,876).
- **2026-10-22, seam 5: state the rest of `main.js` assigns stays declared
  there.** `tlSelected` and `tlPlayhead` sat in the middle of the timeline's
  code, but the action table and the preview set them too, so their `let`
  (and `keyThumbs`, which the table fills) stays in `main.js` between the
  two factory calls, with its comment; the timeline reads and sets them
  through `ctx`. Every other name the two modules declare and `main.js`
  uses is returned. The two modules call each other (the timeline draws
  `batchSection` and calls `refreshPanels`; the batch reads `timeline`),
  so each reaches the other through `ctx`, wrapped, as do `progressHTML`
  and the rest declared after `ctx`; none of them is called with
  arguments. `runClips`, the render loop, stays in `main.js`: the hero
  set and the Video tab call it too, and it is the export, not the
  queue. The `ctx.` rewrite was done with a parser (`eslint-scope`'s
  unresolved references), not by hand or by pattern, because this seam
  reads 21 pieces of boot's state; `ctx` gains a getter for each and a
  setter for the four the timeline assigns (`videoTimeline`, `livePlace`,
  `tlSelected`, `tlPlayhead`). One comment line, a bare `//` that had
  separated the dialog's description from the state left behind, is
  dropped. view-polish joins the row, because the hero set renders
  through the batch's `kit`. The ratchet is 6,348 (red on `main`'s 6,764).
- **2026-10-22, seam 6: the show floor's banner stays where it was.** The
  `// ---- The show floor ----` line still marks the place in `main.js`,
  now over the one factory call; the module's header says the rest. The
  code from it down to `showFloorPanel` moved (`hallPanel` above it is the
  Art show tab's builder and waits for seams 9–11; `setShow3d` and the
  walk below it are the viewport's). Rewritten with the same parser as
  seam 5. `ctx` gains getters for `show3d`, `showBlock`, `showEditor`,
  `panTool`, `walking` and `PAN_KEY`, getters and setters for
  `showClipboard`, `showGap` and `showGrid` (the module assigns them, as
  it does `hallSelected`, which had both already), and `field`, `gated`
  (wrapped, a `const` after `ctx`, passing its arguments on), `setPanTool`,
  `setShow3d` and `setWalking`. The ratchet is 6,008 (red on `main`'s
  6,348).
- **2026-10-22, seam 7: the tool index's cache stays declared in
  `main.js`.** The assistant's `appMap` in `window.__booth` reads and fills
  `toolIndex` itself, so the `let` with `toolHits` and `toolAt` stays in
  `main.js` (seam 5's ruling), with a two-line comment where the section's
  long one was; the long one moved with the code. `ctx` gains getters and
  setters for all three, and `inspectorHTML` and `showSection`. The import
  of `src/toolsearch.js` moved too, with its note on why `fold` comes in
  as `foldText`, reworded for its new file. The ratchet is 5,816 (red on
  `main`'s 6,008).
- **2026-10-22, seam 8: a module nothing calls returns nothing.** Upload and
  import only wire the file inputs and the 2D floor's drop; no line left in
  `main.js` calls `upload` or `importDesignFile`, so `createUpload(ctx)` is
  called for its effect and returns nothing. It runs where the code stood,
  so the inputs are wired in the same order as before. `ctx` gains getters
  and setters for `designTarget`, `lightIndex`, `photoLightIndex` and
  `photoSelected` (it assigns them all), and `backfillThumbnails` and
  `tagAssetRoles`. view-linked joins the suites run here, because a design
  dropped on a floor booth comes through this code. The ratchet is 5,657
  (red on `main`'s 5,816).
- **2026-10-22, seam 9: the panel builders are three seams, grouped by
  what they share.** Seam 9 takes Walls, Lighting and Art show into
  `src/panels/walls.js`, `src/panels/lighting.js` and
  `src/panels/art-show.js`: `lightBarLevels` is drawn in both the Art show
  and the Lighting tab, so those two go together, and Walls is the smallest
  and most separate. Seam 10 is Layout and Artwork, seam 11 Video, Export
  and the Show floor's `hallPanel` (the table above now says so, each row's
  lines counted from the code as it stands). Only the builders move: what their
  controls do (`syncPanelInputs`, `revealPanelFields`, `syncShadowInputs`,
  `setShadowLive` and the rest) belongs to the action table and the
  viewport, and goes with them in seams 12–15. `inspectorHTML`, which
  composes every tab, and the field builders every tab shares (`field`,
  `range`, `colorField`, `hideEye`, `gated`) stay in `main.js` and reach the
  panels through `ctx`, since the action table and `src/ui/` use them too;
  seam 16 decides where they end up. Each panel is a factory (seam 2's
  rule): Walls reads `selectedPanel`, `selectedPedestal` and
  `furnitureChoice` (a new getter); none of the three assigns state, so
  nothing gains a setter. `dialSVG` and `lightBarLevels` are returned
  because `main.js` still calls them (`syncShadowInputs`, and the Lighting
  branch of `inspectorHTML`); `fxRow`, `angleRow`, `panelSlider` and
  `pedestalSlider` are not. Walls' factory call stands where `panelFields`
  did; Lighting's and then Art show's where `artShowHTML` and
  `lightBarLevels` did, Lighting first, so the function Art show draws
  with exists before it does. A stale "in main.js" in `src/model.js`'s
  note on `LIGHT_BAR_POWER_SLIDER_MAX` now names `src/panels/lighting.js`
  (a comment: the scene bundle drops it, so studio-api's copy is
  unchanged). `ctx`
  gains `colorField`, `hideEye` and `lightBarLevels` (wrapped: its `const`
  comes after `ctx`). One comment changed with its move: `shadowSection`'s
  "(`shadowGesture`, below)" now says "in main.js". The ratchet is 5,509
  (red on `main`'s 5,657). `ctx` now carries 51 pieces of state and 38
  helpers; the decision above collapses the state into one object at about
  60, so seam 10 or 11 is where that pull request is weighed.
- **2026-10-22, seam 9: the icon test reads the moved modules too.**
  `tests/icons.test.js` took the icon names only from `main.js`'s source,
  so each seam had quietly taken its buttons out of the check. None was
  missing (seams 1–8's modules were checked when this was found). It now
  also reads every module in `src/ui/`, `src/panels/` and `src/actions/`;
  its assertions are unchanged, and a made-up icon name in
  `src/panels/art-show.js` turns it red.
