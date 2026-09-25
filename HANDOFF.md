# Booth Studio — handoff

Start a new chat with **this file only**. It is written to be enough on its own.

Artist OS Booth Studio: measured 3D art-show booth planning in the browser.
Extend it; do not rebuild it.

## Now

- `CLAUDE.md` is loaded automatically at the start of every session. It holds
  the owner's standing instruction — **reports in chat are extremely concise,
  grammar sacrificed for concision, abbreviations and symbols welcome** — and
  the rules that bite. It does not need to be asked for again. That rule is
  about chat only: code comments, commit messages and this file stay in full
  prose, because a cold session has nothing else to read.
- Repo: https://github.com/yitzhach/booth-studio
- Production: https://booth-studio.bobdylan2000.workers.dev
- `main` is deployed. Every other branch is preview-only.
- **Last deploy: 2026-09-25, tenth round — Next items 1 and 2: the share
  links hardened (rate limits, an upload window, a per-link ceiling, a daily
  sweep of lapsed links), a sent link updated or deleted by the browser that
  sent it, and a design file dropped straight on a floor booth** (the first
  bullet below). Before it, the ninth round — **Show Hub phase 1: a booth
  sent as a link, not a file. The app's first backend** — a Worker on
  `/api/*` and an R2 bucket (the second bullet below). Before it, the eighth
  round — Show Hub v0: a booth design
  sent as a file from an exhibitor and imported onto a floor booth by the
  promoter, plus the Pro pitch deck at `/pitchdeck/`** (the first bullet
  below). Before it, the seventh round — the owner's first look at the
  show floor: a right-drag selection box that is drawn, ⌘/Ctrl right-drag to
  pan, Flip horizontal / vertical, the Pan tool, a walk that takes up where it
  stopped, several tapes kept at once and sub-tabs in the panels** (the first
  bullet below). Before it, the sixth round — **the show floor, phases 2, 3
  and 4: the show in 3D, walked and recorded; one booth opened as a full
  design, and floor templates; the AI-render hook** (the second bullet
  below). Before that, the fifth round — **the show floor, phase 1 of the trade-show /
  art-fair layout mode** (the second bullet below). Before that, the
  fourth round — icons on the keyframe arrows,
  Export MP4 at the top of the timeline, and the right framing on screen
  while a file renders; after the third round the same day — a keyframed
  frame, sliding end keys, previous / next keyframe and a batch of clips and
  stills** (the first two bullets below). Before them, the second round — a movable, resizable export
  frame, Play / Pause in the timeline, Edit timeline always offered, a click
  on nothing opening Layout, and the build stamp in New York time and on a
  phone** (the first bullet below). Before it the same day: the frame guide,
  figures lowered as well as raised and picked by double-click, and the
  timeline's glide, auto timing and scrubbed fades. Before that, 2026-09-24:
  locked floor pieces, raised figures and the visual camera timeline; and the
  same day before that: tool shortcuts, three more people, the smaller drag shadow and Pro
  unlocked; and before that roadmap batch E, the last of the roadmap
  (the hall planner and the power and rentals sheet — the first bullet
  below), after batches C and D, A and B, the roadmap's base and the cut-out
  people, all the same day. **The roadmap proposed on 2026-09-24 is built.**
  Before that, **2026-09-23, three times.** First the ten speed-and-planning
  improvements, then — the same day, after the owner's first look on the real
  machine — the second round: the drag shadow, the fast-edit redraw leak, the
  cheaper click, Photoshop drop shadows, hide instead of delete, and the
  Preview menu under the viewport (both bullets below). Then the third round:
  the owner's answers to that round, and tool search (the bullet below). **Nothing is sitting
  unmerged.** Before that, 2026-09-19 — the art-show booth and its neutral defaults,
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
- **2026-09-25, tenth round: Next items 1 and 2. Pushed to `main` and
  deployed.** Asked for as "continue in order — start with 1 and 2". Both
  items were mostly looking on the real machine, which no session can do;
  this round did the parts that are code and left the rest in Next.
  1. **The ninth round's deploy is confirmed.** Through the Cloudflare
     connector: the live Worker `booth-studio` is exactly `worker/index.js`
     as the ninth round left it, and the bucket `booth-studio-shares` exists
     (created 2026-09-25, ENAM). Not checked: a real share between two real
     browsers, and `/pitchdeck/` by eye.
  2. **The bucket is no longer open-ended public-write** (Next 1(b)). All in
     `worker/index.js` and `wrangler.jsonc`, not dashboard settings, so they
     are in the repo and reviewable. This is hardening of the one approved
     backend — the same Worker and bucket, nothing new server-side — but it
     is the owner's to undo if unwanted:
     - **Rate limits per address, per minute** — Workers Rate Limiting
       bindings `LINK_RATE` (6 links made or updated) and `IMAGE_RATE` (120
       images). Over it: 429, "Too many uploads from here just now". Both
       are skipped when the binding is absent (Node tests, `vite dev`). The
       period can only be 10 or 60 seconds; a per-day cap would need KV or a
       Durable Object.
     - **An upload window.** A link's images may be uploaded only within
       `UPLOAD_HOURS` (24) of its manifest being sent or updated — a link is
       no longer a place to keep adding files to for 180 days.
     - **A ceiling per link**: `MAX_SHARE_BYTES`, 200 MB of originals in
       all — the same ceiling the app puts on a backup it opens. Before it,
       one link could hold 250 × 40 MB. The browser checks first
       (`checkSize` in `src/share.js`) and says so before sending anything;
       the Worker checks again on each image (summing the link's objects).
     - **The daily sweep** (`sweep`, the Worker's `scheduled` handler, cron
       `17 4 * * *` UTC): every link past `SHARE_DAYS` and anything left
       under a link with no manifest is deleted, so a lapsed link stops
       costing storage as well as stops opening. It lists every link before
       deleting any — deleting while paging skipped links in the tests. This
       replaces the R2 lifecycle rule Next suggested; that rule can still be
       added in the dashboard as a backstop (prefix `shares/`, 190 days).
     `npx wrangler deploy --dry-run` lists the four bindings (SHARES,
     LINK_RATE, IMAGE_RATE, ASSETS), and the live Worker's code, read back
     through the Cloudflare connector after the push, is this round's — so
     Cloudflare took the bindings.
  3. **A sent link can be updated or deleted by the browser that sent it**
     (Next 1(c); the owner had not answered, and both are additive — a link
     nobody touches behaves exactly as before). Making a link now also makes
     a **key**: 48 random characters returned once, kept in this browser's
     `localStorage["booth.sentLinks"]` with the link's id and the booth's
     name — deliberately not in the project, so a backup handed to someone
     does not hand them the link. The bucket stores only its SHA-256
     (`keyHash` in the manifest's custom metadata). Routes, both needing the
     key in `x-share-key` (403 otherwise):
     - `PUT /api/share/<id>` — a new manifest under the same link →
       `{ have }`. Images the new manifest still names stay (an image's data
       never changes under its id — a new picture is a new id, which
       `importDesign` relies on too) and are not sent again; images it no
       longer names are deleted. The link's 180 days and its upload window
       start again.
     - `DELETE /api/share/<id>` — the link and every object under it.
     Export → Send to the show lists **Links you have sent** (name, date),
     each with **Copy link**, **Send this booth to it** (the booth open now
     replaces what the link opens) and **Delete link** (confirm first; a link
     already lapsed is just forgotten). A promoter who already put the booth
     on their floor keeps what they put there — an update reaches only the
     next open. Clearing site data loses the keys: the links still open
     until they lapse, but can no longer be changed.
  4. **Drop a design file on a floor booth** (Next 2: "should the floor
     take a design file dropped on a booth?"). Dragging a
     `.booth-design.json` over the 2D floor outlines the booth under the
     pointer in pink (`.sf-drop`); letting go imports it there exactly as
     Import a booth design does (`importDesignFile` in `src/main.js`, shared
     by both — confirm on replace, one undo step). Dropped on empty floor, it
     says to drop it on a booth. Import a booth design stays.
  5. **Not done from Next 2:** the lighter file (previews instead of
     originals). The link answers the "too big to email" problem it was
     for, so it waits on the owner saying the file is still used.
  **Tests:** `tests/share.test.js` (12, from 5: update keeps / drops /
  uploads the right images and restarts the days; only the key updates or
  deletes; the upload window; the per-link ceiling, client and Worker; the
  rate limiter; the sweep across pages; the remembered links, including a
  blocked `localStorage`); `tests/helpers/fake-r2.js` gains `list` (paging
  two at a time, so paging is exercised) and `delete`. In a real browser:
  `view-share` updates the link from the Export list and checks the bucket,
  deletes it and sees it dead; `view-hub` drops the file on booth 106 and on
  empty floor.
- **2026-09-25, ninth round: Show Hub phase 1 — a booth as a link. Pushed
  to `main` and deployed. The local-first rule is lifted for this one thing,
  at the owner's word** ("can they just send the promoter a link … we do it
  on the backend … assuming the promoter has the Pro account — otherwise it
  will give them limited access to files"). Nothing below has been seen on
  the real machine or against the real bucket; it is tested in a real
  browser here with `/api/*` routed through the real Worker code over an
  in-memory bucket (`tests/view-share.mjs`, `tests/helpers/fake-r2.js`).
  1. **The backend** (`worker/index.js`, read its header first).
     `wrangler.jsonc` now has `main` and `run_worker_first: ["/api/*"]`, so
     the Worker sees only `/api/*`; every other path is the static app
     exactly as before (`env.ASSETS`), `/pitchdeck/` included. Storage is the
     **R2 bucket `booth-studio-shares`** (binding `SHARES`), created
     2026-09-25 in the owner's Cloudflare account alongside `iaa-files`.
     **If that bucket is ever deleted or renamed, the deploy fails** — the
     binding must name a bucket that exists. Routes: `POST /api/share`
     (manifest → `{ id }`), `PUT /api/share/<id>/assets/<asset>` (one
     original, once), `GET` of either. A manifest is the booth design file
     (src/booth-file.js) with every image's `data` lifted out — width,
     height, role and the small `thumb` stay. Ids are 24 random base-36
     characters; a manifest over 4 MB, an image over 40 MB, an image the
     manifest does not name, anything that is not a PNG/JPEG data URL (or a
     .glb for a model), and a second upload of the same image are refused;
     a link lapses after `SHARE_DAYS` (180), checked on read.
  2. **Send my booth to the promoter** (Export → Send to the show) now
     uploads and shows the link in a dialog with **Copy link**:
     `<site>/?booth=<id>`. Every image gets its thumbnail made first, so the
     preview exists. **Download it as a file instead** is the v0 file, kept.
  3. **Opening a link** (`openShareLink` in `src/main.js`; the browser half
     is `src/share.js`). The `?booth=` is taken off the address at once, so
     a reload does not offer it again. **Pro** (`allowed("hall")`) fetches
     every original; with a show floor it offers **Put it on my show floor**
     with a booth-number picker (the link's own number when that booth
     exists), landing it exactly as an imported file does (confirm on
     replace, one undo step). **Lite** gets the manifest only: each image is
     its thumbnail, a 3D model (no thumbnail) drops out with what uses it,
     and the dialog says Pro opens it in full. Either tier can **Look at
     it**, which downloads the current project as a backup and opens the
     booth as its own project, named "… · shared".
  4. **What "Pro" means here is honour-system.** There are no accounts, so
     the Worker cannot know who is Pro; the tier is the browser's own
     (`src/tier.js`), and anyone can fetch an original by its URL. Real
     gating needs identity — see Next.
  5. **Found on the way:** `history` inside `main.js` is the undo history,
     not the browser's — `window.history.replaceState` it must be.
  **Tests:** `tests/share.test.js` (5: the Worker's routes and refusals,
  Pro and Lite opens, a lapsed link, non-API paths reaching the assets);
  `tests/view-share.mjs`.
- **2026-09-25, eighth round: Show Hub v0, and the pitch deck. Pushed to
  `main` and deployed.** The owner asked for original ideas that could carry
  a Pro monthly fee; five were proposed and are recorded in
  `FUTURE_BUILD.md` (Show Hub, attention map, "take it home" AR labels, a
  sales-by-position log, AI renders on credits), and presented as a deck at
  **`/pitchdeck/`** (`public/pitchdeck/index.html` — a static page Vite
  copies into the build; it touches nothing in the app). The owner then chose
  the lightest of them to build: **Show Hub v0**, the version of "the show
  assembles itself" that needs no server. Nothing below has been seen on the
  real machine; it is tested in a real browser here (`tests/view-hub.mjs`).
  1. **Send my booth to the promoter** (Export → Send to the show; not in
     Photo mode, not gated — it is for exhibitors, who may well be Lite).
     Downloads `<name>.booth-design.json`: `{ kind:
     "booth-studio/booth-design", version: 1, name, number?, design, assets
     }`, where `design` is the live design exactly as `takeDesign` lifts it
     (`booth`, `art`, `lights`, `ambient`, `views`) and `assets` holds only
     the images that design names (`namedAssets`, the same string search
     `assetInDesigns` uses). Not the photo composition, the export kit, the
     show floor or unused library images. It is **not a backup** and is
     not schema 1's to describe: the file has its own `kind`.
  2. **Import a booth design** on a selected floor booth (its Design
     section, under Open this booth). The file is validated by exactly the
     rules a backup's live design is (`readDesignFile` calls
     `validateProject`), and a whole backup handed in by mistake is named as
     one. The design is **parked on that booth number in `p.hall.designs`**
     — phase 3's storage, unchanged — so Open this booth, the 3D show,
     renumbering and deleting all work on it with no new code. On the booth
     open in the editor it replaces the live design instead. A booth that
     already has a design asks first (Replace booth N's design?). One undo
     step. Refused past `MAX_DESIGNS` (60) and past 250 assets.
  3. **Image ids.** Asset ids are UUIDs, so a clash is unlikely, but a
     promoter importing the same exhibitor twice is not: an id already in
     the project **with the same data** is shared; one with *different* data
     is given a new id and the design's references are rewritten to match,
     so the promoter's own image is never overwritten (`importDesign` in
     `src/booth-file.js`).
  **Tests:** `tests/booth-file.test.js` (5), `tests/view-hub.mjs` (send,
  import with images, confirm on replace, open, undo, a backup refused).
- **2026-09-25, seventh round: the owner's first look at the show floor.
  Pushed to `main` and deployed.** Asked for in one message, after the
  owner used the floor; one commit. Nothing below has been seen on the real
  machine; all of it is tested in a real browser here (`tests/view-tools2.mjs`).
  1. **The selection box is drawn now — it never was.** The floor's box
     (`.sf-marquee` in `src/show-editor.js`) is an SVG `rect`, and the code
     set `marquee.hidden = false` to show it. An SVG element has no `hidden`
     property, so that only made a JavaScript expando; the `hidden`
     attribute stayed and the page's `[hidden] {display:none}` rule kept the
     box invisible through every drag since phase 1. The selection still
     worked, which is why no test caught it: the tests read the selection,
     not the box. It is now shown and hidden by its attribute
     (`showMarquee`), dashed and a little stronger, and `view-tools2` checks
     it is visible and the size of the drag. **Rule: never set `.hidden` on
     an SVG element; toggle the attribute.**
  2. **Right-drag draws the box, anywhere** — over booths or empty floor, so
     a box can start on a booth, which a left-drag cannot (that moves the
     booth). **⌘ right-drag (Ctrl on Windows) pans**, and the status bar says
     so by name (`PAN_KEY` in `src/main.js`: ⌘ where the platform is a Mac,
     iPhone or iPad, else Ctrl), as the owner asked; the Show floor panel's
     help line says it too. Space-drag and the middle button still pan. A
     right-click that draws nothing leaves the selection alone; Shift adds
     to it as with the left button.
  3. **Flip horizontal / Flip vertical** on the floor — the buttons under
     Turn 90° for one piece or several (`mirrorPieces` in `src/show.js`,
     pinned in `tests/show.test.js`). The selection is mirrored about its
     own middle; each piece's centre is reflected and its turn with it
     (r → −r across a vertical line, r → 180 − r across a horizontal one),
     so a row facing right comes back facing left. One undo step. What the
     owner meant by "mirror so people can flip horizontally" was read as
     flipping a layout; flipping a single booth's design, or a cut-out
     person, was not built — see Next.
  4. **The Pan tool** — SketchUp's hand, from the owner's screenshot of
     SketchUp's orbit and pan icons. In the toolbar beside Move (and alone
     beside Undo on the show floor, where the booth's tools are hidden), key
     **H**, as in SketchUp. On, a left-drag or one finger slides the view
     across the screen instead of orbiting (`BoothScene.setPanTool`, which
     sets OrbitControls' `mouseButtons.LEFT` / `touches.ONE` to pan) and a
     click picks nothing; on the 2D floor a left-drag pans even over a booth
     and moves nothing (`panTool` option of `createShowEditor`). Select (V),
     Move, the tape, and Box each put the hand down. A walk looks round with
     the left button whatever the tool, so walking puts orbit back for its
     length and stopping puts the hand back. The orbit icon in the owner's
     screenshot was not added as a tool: orbit is what a drag already does
     with Select.
  5. **A walk takes up where it stopped.** Walk used to jump to the fixed
     start (`walkStart` / `showWalkStart`) every time. Now `stopWalk`
     remembers the pose (`BoothScene.lastWalk`, one for the booth and one
     for the show — `walkKey`) and `startWalk` goes back to it; only the
     first walk of a session starts at the entrance. Done also comes back to
     the orbit view the walk left, rather than the default view. Not saved
     in the project — a view, not the booth — so a reload starts fresh, and
     a booth made much smaller can leave a remembered walk outside it (press
     Reset view, or walk back in).
  6. **Keep every tape.** While the tape is out, a bar over the viewport
     offers **Keep every tape** and **Clear tapes**. With Keep on, a
     finished tape stays, reading and all, when the next is started — up to
     `MAX_TAPES` (24), oldest dropped first — and kept tapes stay on screen
     after the tape is put away (Esc), to be read. Clear tapes takes them
     all off; turning Keep off does too. Off (the default) is the old one-
     tape behaviour. Kept tapes are editor-only lines and DOM labels like
     the single tape, so they never reach an export, and nothing is written
     to the project. The underlay's Scale plan still reads the tape being
     laid (`measure.points`).
  7. **Sub-tabs in the panels** ("there are too many tools in the current
     tabs — tabs run way too long"). A panel with three or more sections
     gets a row of chips under its heading, one per section by its own
     heading (a section with none is named by its first sub-heading or
     label — Lighting's ambient section reads "Ambient illumination"), plus
     **All**, and shows the chosen section alone. The choice is remembered
     per tab for the session. **A section that was not there on the last
     draw of the same tab is chosen for you** — select a booth and its
     piece section opens; click a work and its properties do — so a
     selection is never hidden behind a chip. Tool search opens the chip a
     found control lives under (`showSection`). The chips are built after
     the panel is drawn (`applySectionTabs` in `renderInspector`), from the
     top-level `<section>`s, so no panel's HTML changed and a new section
     gets a chip by existing. **Under automation (`navigator.webdriver`) the
     panels start on All** so the 30-odd browser suites keep seeing every
     control; `localStorage["booth.sectionTabs"]` = `"on"` / `"off"`
     overrides that either way, and `view-tools2` sets it on to test the
     chips as a person sees them. The inspector's eight top tabs are
     unchanged — see Next for regrouping them.
- **2026-09-25, sixth round: the show floor, phases 2–4. Merged to `main`
  and deployed.** Asked for as "build P2–P4 — test each, then move to the
  next phase", in one session, one commit per phase (`72407bd`, `62ef37f`,
  `caff211`, then the protected-artwork pass). Nothing below has been seen
  on the real machine; every piece is tested in a real browser here.
  **Phase 2 — the show in 3D, walked, recorded.**
  1. **See it in 3D** at the top of the Show floor panel stands the plan up
     in the booth's own viewport (Back to the plan, or Esc, returns). The
     plan's pieces become parts (`src/show-scene.js` `showParts`: a booth's
     carpet tile in its sale colour and its 8′ back drape and 3′ side rails,
     or hard walls, or a canopy tent's legs, roof and back wall; open floor
     is the tile alone; walkways, pavilion tents with poles every 20′, walls,
     columns, entrances, stages, tables, desks, food counters and restrooms)
     drawn as **one InstancedMesh per shape and finish** — a thousand booths
     is under a dozen draw calls, pinned in Node. Indoors the hall's four
     walls are inward-facing planes, a dollhouse cut-away: from outside the
     near walls vanish, walking inside all four are there. Booth numbers
     (and exhibitors) are a pool of 40 sprites handed to the booths nearest
     the camera, moved only when the camera has moved half a metre.
  2. **The open booth is drawn in full** — the real booth, by the code that
     always drew it — and the show is placed round it (`worldFrame`,
     `planToWorld`): its piece's centre is the world origin and its turn is
     undone, so the booth's lights, shadow cameras and pickers see the
     coordinates they always saw. The booth's surroundings, its own ground,
     its row neighbours and its underlay go into an invisible `offstage`
     group (disposed with the booth); with no booth open on the floor the
     whole booth goes offstage except its hemisphere and fill lights, which
     light the hall. `BoothScene.setShow(hall)` / `stageShow` /
     `setShowView`: Perspective looks down from over the entrance side at
     everything on the floor (including pieces laid past its edge), Plan
     from straight above; Back, Left and Right are hidden. The far plane and
     the orbit's reach grow with the floor. In 3D the booth is not picked,
     dragged or edited.
  3. **Walk the show** (or W): walk mode's own rules and pad, starting in
     the aisle nearest the way in (the first Entrance piece, else the middle
     of the front edge), looking down it. Esc stops walking; Esc again goes
     back to the plan.
  4. **Make a walkthrough** lays a camera timeline down the aisles
     (`showWalkthrough`): walkway pieces if the floor has them, otherwise
     the gaps of 3′ or more between rows of booths, plus the front and back
     walkways; from the entrance, nearest aisle first, each key at eye
     height looking where the walk goes next, a glide at 1.1 m/s, at most
     12 keys, faded in and out. It opens in the ordinary timeline dialog, so
     Play, keys, Export MP4 and the batch all work on it. **The booth and
     the floor each keep their own timeline** (`otherTimeline`, swapped by
     `setShow3d`), because a booth's keys are poses round a booth. PNG
     export works from the same panel.
  5. **Fixed on the way — a phase-1 bug the 3D view made obvious:**
     back-to-back pairs faced *each other*, fronts meeting at the shared
     line and backs to the aisles, in both the grid's conversion
     (`hallLayout` `faces`) and Add booths (`boothBlock`). Both now put the
     backs together. Plans already turned into pieces keep the turns they
     were saved with — select a row and Turn 90° twice to flip it.
  **Phase 3 — open one booth, and floor templates.** The storage shape was
  decided here (`src/linked.js` says why at length):
  1. **The live design stays where it always was** — `p.booth`, `p.art`,
     `p.lights`, `p.ambient`, `p.views` — and the whole editor goes on
     reading only those. Opening a booth swaps which design is live.
     **`p.hall.open`** (optional integer) is the floor booth the live design
     belongs to; absent, it is `p.hall.mine`'s, which is what every older
     plan meant; `0` is "your own booth, on no floor booth".
     **`p.hall.designs`** (optional, at most 60) holds the parked designs
     keyed by booth number exactly as sales are, so a renumber, a typed
     number and a delete carry a design the way they carry a sale; key `0`
     is your own booth, parked when the first floor booth was opened. A
     parked design is validated by exactly the live one's rules
     (`validateProject` calls itself), its images stay in `p.assets`, and
     **nothing may delete an asset a parked design names**
     (`assetInDesigns`; the four delete sites and `removeGroundUpload`
     check it).
  2. **Open this booth** on a selected floor booth (its Design section):
     a booth with no design opens as a new one sized from its piece (4′–30′,
     the booth's own limits) and built as the floor says — canopy tent is the
     outdoor booth with its tent up, open floor has no walls, pipe and drape
     and hard wall are the art-show booth. The one open before is parked
     with its booth. The editor opens on it; the title reads "· Booth N".
     **Open my own booth** (Floor → Booth designs) brings back key `0`.
     One undo step each.
  3. **"This is my booth" never moves a design off a booth** (`setMine`): a
     live design already on a floor booth stays there when mine moves or is
     cleared. A live design on no booth yet *does* move into the booth
     marked mine — that is how "see my booth on the floor" works — unless
     that booth has a parked design of its own. Deleting a booth takes its parked design with it (undo
     brings both back); deleting the open booth makes its design your own
     booth's — refused only when your own is already parked.
  4. **The 3D show draws whichever booth is open in full.** Parked designs
     are drawn light, like every other booth.
  5. **Start from a template** (`FLOOR_TEMPLATES` in `src/show.js`): Art
     fair street (outdoors, two rows of twelve 10 × 10 tents across a 20′
     street), Convention hall, perimeter booths (indoors 150′ × 100′,
     booths round three walls facing in, four island rows, entrance, info
     desk, food, restrooms), Market under a pavilion (outdoors, a 60′ × 40′
     tent over twelve 8 × 10s). Replaces the floor's pieces and size in one
     undoable step after a confirm; sales, mine and designs stay with their
     numbers. Built-in only — see Next.
  **Phase 4 — the AI-render hook** (`src/ai-render.js`; read with
  `AI_EXPORT_PHASE.md`, whose client-side half this is).
  1. **Export → AI render → Download AI render pack** (and the same button
     in the 3D show's panel): one .json with four PNGs of one frame, one
     camera, one size (1024 / 1536 / 2048 px long side): `beauty` (the
     frame as rendered), `depth` (linear between the nearest and farthest
     thing in view, near white — the grounds are left out of that range or
     a booth would be the first few greys), `mask` (every mesh one flat
     colour by what it is, `SURFACES` — artwork, walls, floor, booth
     structure, drape, tent canvas, other booths, furniture, people,
     fixtures, surroundings, signs; black is nothing) and `protect` (the
     artwork and signs alone, cut by the mask so what stands in front of a
     work cuts it, transparent elsewhere); plus the camera, the depth range,
     the legend and **the scene in plain words** (`describeScene`: the
     booth, its walls and every work by title and size; on the show, the
     floor, its booths by how they are built, and which is drawn in full).
  2. **`render(frame) → image`** takes exactly a pack. `provider` is `null`
     on purpose: with none, it rejects saying so (Render with AI shows
     that message). With one — `{ name, render: async (pack) => Blob }` set
     in that file — the provider's image comes back with `protect` laid
     over it (`restoreArtwork`), per AI_EXPORT_PHASE.md's rule that a model
     never repaints the visible artwork, and an image of the wrong size is
     refused rather than misaligned.
  3. `BoothScene.renderPasses` renders the passes through `export()`, which
     gains a `pass` option; `applyPass` swaps in the depth shader or the
     flat materials (instance colours off) for that one render and puts
     everything back — view-ai checks the materials and background after.
  **Tests:** `tests/show-scene.test.js` (9), `tests/linked.test.js` (8),
  `tests/ai-render.test.js` (7); `tests/view-show3d.mjs`,
  `tests/view-linked.mjs`, `tests/view-ai.mjs` in a real browser, the
  walkthrough recorded to MP4 where the sandbox encodes.
- **2026-09-25, fifth round: the show floor, phase 1. Merged to `main` and
  deployed.** The owner asked for a trade-show / art-fair layout mode "beyond
  what we have": type how many booths and a standard size, then customise
  sizes, drag booths, standard spacing that can be broken, walkways, tents or
  none, simple or complex halls, Lucid-floor-plan-style drag-and-drop; then
  walk the show in perspective, edit single booths and record a walkthrough
  as MP4; fast, small, desktop and phone; and room for AI rendering later.
  **The owner's answers (2026-09-25), which set the plan:**
  - *Booths are light, with "open one":* every booth on the floor carries its
    size, how it is built (pipe and drape, hard wall, canopy tent, open
    floor), a number and its sale; any one of them can later be opened as a
    full Booth Studio design linked to it. Not every booth a full design —
    that would make files huge and the walk slow.
  - *The 2D editor fills the viewport,* not the Hall tab's small SVG map.
  - *Venues:* indoor hall, outdoor fair, and a pavilion tent over a group.
  - *Pro, and it absorbs the Hall tab* — one tool, not two.
  **The phases, one per session:** (1) the model and the 2D editor — built
  here; (2) the show in 3D, walking it and recording the walk to MP4;
  (3) opening one booth as a full design, and saved floor templates; (4) the
  AI-render hook. See Next.
  **What phase 1 built:**
  1. **A third mode, Show floor**, beside 3D booth and Photo (toolbar, and
     **Open the show floor** at the top of the Hall tab, now labelled **Show
     floor**). Pro, through the existing `hall` feature. Entering it with no
     plan starts the usual 16-booth plan; entering it with a grid plan turns
     the grid into pieces in place (one undo step). While it is open the
     booth's own tools, the other inspector tabs, the Export button and the
     frame guide are hidden, and **the booth's 3D scene is not rebuilt on
     each edit** — a floor edit is not a booth edit, and rebuilding it was
     going to be the whole cost of every drag. `showFloor` is view state:
     a reload opens the booth, as before.
  2. **The drawing board** (`src/show-editor.js`) is an SVG in real inches,
     panned and zoomed through its `viewBox`. Chosen over drawing the plan
     in the WebGL scene because the browser hit-tests a thousand SVG groups
     for free, the booth numbers stay crisp at any zoom, and it is ~450
     lines. During a gesture only the moving groups' `transform`s change;
     the plan is written once, on release, through `mutate()` — one undo
     step per drag. Gestures: drag a piece to move the selection (snapping
     to the other pieces' edges and centres within 8 px on screen, then to
     the grid, with a pink line showing what it snapped to; Alt places
     freely); eight handles on a lone piece resize it in its own turned
     frame, the opposite side staying put; a mouse drag on empty floor draws
     a selection box (Shift adds); a finger drag on empty floor pans; two
     fingers pinch; the wheel zooms about the pointer (a trackpad's
     sideways scroll pans); Space, the middle or the right button pans.
  3. **The library** replaces the artwork list in the left sidebar (and sits
     in the panel under 950 px, where the sidebar is hidden): 10 × 10,
     10 × 20, 8 × 10, 20 × 20 island, 10 × 10 canopy tent; walkway,
     pavilion tent, wall, entrance, column; stage, table, info desk, food and
     drink, restrooms, text. Drag one onto the floor and it lands where it is
     let go, top-left on the grid; tap one and it lands mid-view. `SHAPES`
     and `KINDS` in `src/show.js` are the one list to add to.
  4. **The panel:** a lone piece's width, depth, position, turn and — for a
     booth — its number (unique; its sale follows it) and how it is built,
     or a piece's text, then the booth's sale (status, exhibitor, price,
     note, "This is my booth"), exactly the hall planner's. Several pieces:
     turn 90°, duplicate, delete, line up tops or lefts, **Space them
     evenly** at a typed gap (along the way they run; the first stays put —
     "standard spacing that can be broken" is this plus a single drag), and
     renumber. **Add booths:** how many, per row, width, depth, the gap in a
     row, the aisle, back-to-back pairs and how they are built — placed an
     aisle below everything already on the floor (so a block never lands on
     booths already sold), numbered on from the highest, selected. **Floor:**
     venue (indoor hall / outdoor fair — grass-green on the map), width and
     depth in feet, the snap grid (off, 1″, 6″, 1′, 2′, 5′; 1′ by default),
     and **Renumber every booth** row by row from the back, left to right.
     The totals, the default price, the printable hall map and the CSV are
     the hall planner's and now read the floor's pieces.
  5. **Keys:** Delete, Ctrl+D duplicate (laid right beside the selection),
     Ctrl+C / Ctrl+V, Ctrl+A, R turns 90° (Shift the other way), arrows
     nudge by the grid (Shift 10×), Esc lets go, 0 fits, +/− zoom, Ctrl+Z.
     The booth's own shortcuts are off while the floor is open.
  6. **Schema 1:** `p.hall` gains two optional keys. `items` — every piece,
     `{ id, kind, x, y, w, d, rot?, number? (booths, unique), style?
     (booths: tent / hardwall / open; pipe and drape is the default),
     text? }`, centred, inches, `rot` clockwise degrees — and `venue` —
     `{ kind: "indoor" | "outdoor", width, depth }`. `validShow` checks both
     and `validHall` calls it. The grid keys stay required and keep their
     meaning: on a floor they are the defaults the old Hall layout typed,
     no longer read for positions. Sales stay in `p.hall.booths` keyed by
     number, which is why a renumber, a number typed and a delete all go
     through `renumberBooths` / `showDelete` so a sale never lands on the
     wrong booth. A plan without `items` still draws, counts and prints
     exactly as before (`showBooths`, `hallHTML`).
  7. Tests: `tests/show.test.js` (8 — pieces, validation, snapping, blocks,
     spacing, renumbering, map/CSV) and `tests/view-show.mjs` (the whole
     editor in a real browser, desktop and a 390 px phone).
  **Phases 2–4 were built the same day** — see the sixth round above.
- **2026-09-25, fourth round: the owner's first look at the third. Merged to
  `main` and deployed.**
  1. **Blank buttons fixed.** The previous / next keyframe arrows (and the
     batch's crop, move-up and "every keyframe" buttons) drew empty: their
     icons — `skip-back`, `skip-forward`, `crop`, `arrow-up`, `images` —
     were never imported from lucide or put in `icons`, and an unregistered
     name draws nothing without an error. They are registered now, and
     `tests/icons.test.js` reads every `btn(…, "name")` and `icon("name")`
     out of main.js and fails on any name not registered — it lists exactly
     those five against the previous commit.
  2. **Export MP4 at the top of the timeline** as well, in the bar beside
     Add keyframe (Cancel export while one runs), "so you don't have to
     always scroll to the bottom".
  3. **The framing shown while exporting.** Reported: the viewport "doesn't
     show the proper framing when exporting", though the file was right.
     During a render the canvas's drawing buffer holds only the frame's
     rectangle of the view, and the browser stretched it over the whole
     viewport. `showRenderRect` in scene.js now scales the canvas (a CSS
     transform) into that rectangle for the render, so the picture sits
     exactly inside the guide, and `onRenderRect` tells main.js where, so
     the guide is drawn round the rectangle being rendered — frame by frame
     for a keyframed frame. `clearRenderRect` undoes both in the finally.
     The still export does the same for its moment. view-batch checks the
     rendering picture and the guide agree within 3 px and that the canvas
     is back to normal afterwards.
- **2026-09-25, third round: a keyframed frame, sliding end keys, previous /
  next keyframe, and a batch of clips and stills. Merged to `main` and
  deployed.**
  Asked for as "add 'frame up down' slider also in timeline … and make it a
  keyframeable feature so the frame can move too; allow sliding of end key
  frames — if they slide, after them the framing remains unchanged; have a
  next or prev keyframe arrows; can we create a batch export function …".
  The owner answered four questions first: keyframe all three placement
  sliders, not only up / down; hold the pose past a slid end key rather than
  trim the clip; stills join the batch, and the export and batch tools are in
  the timeline window too; the queue and presets are kept on this browser
  *and* in the backup.
  1. **The frame in the timeline, keyframed.** The timeline dialog has a
     Frame section: the same Frame menu and Frame size / left-right / up-down
     sliders as the Video tab, and **Keyframe the frame**. Off (the default,
     and every timeline before this), the frame holds for the whole clip as
     it always did. On, every keyframe carries its own `place` (the same
     scale plus −1..1 offsets as `framePlace`), starting from the frame as it
     was; the sliders — in the dialog *and* the Video tab — and the guide's
     handles then set the **selected** keyframe's, and move the camera and
     playhead to it so the frame is judged against its shot. Between keys the
     frame travels on the same ease as the camera (`poseBetween` lerps
     `place` when both keys have one), so it arrives with the shot. Scrubbing
     and Play move the guide with it (`livePlace`, sampled at the playhead;
     `getPlace` / `setPlace` in main.js route every read and write). The
     recorder sets the camera's view offset per frame from the sampled place
     (`recordVideo`'s `drawFrame`). `frameKeys` and `place` are optional
     fields of the timeline, which is view state and never in schema 1.
  2. **End keys slide.** `normalizeTimeline` no longer pins the first key to
     0 and the last to 1; it keeps them in 0..1 and in order. Before the first
     key and after the last, the camera (and a keyframed frame) holds that
     key's shot, and the track draws the held stretch as a paler hold
     (`.tl-end`). Every diamond drags now, and the ends' At (s) field is
     editable. The keys-flow sampler was rewritten to walk the same
     arrive / leave schedule the track draws; the glide got explicit holds at
     both ends. Auto timing spreads the middle keys between wherever the two
     ends sit. A timeline saved before this has its ends at exactly 0 and 1,
     so it samples as it always did (the old timeline tests all pass
     unchanged but one, which asserted the old pinning and now asserts the
     new rule). A retimed key takes the playhead with it.
  3. **Previous / next keyframe** arrows either side of Play
     (`neighbourKey` in timeline.js): the nearest key arriving strictly
     before or after the playhead, selected, with its camera and frame.
  4. **The batch, for clips and stills** (`src/batch.js`, pure). One queue,
     three ways in, as asked:
     - *Add each one individually*: **Clip · as set now** / **Still · as set
       now** freeze every setting, which is the old batch list exactly (the
       clip from the Video tab, the still from the Export tab's frame and
       size, and the view it was queued from).
     - *A general export setting, tweaked per item*: **General export
       settings** (frame rate, clip size, still size, frame, and "Use the
       Video tab's frame and placement", careful rendering), and
       **Clip / Still · general settings**, which add an item that follows
       them. Each row's **Tweak** panel overrides any one setting — a menu's
       first option, "General · …", hands it back — and says how many it
       owns. A job stores only its overrides in `set`; `resolveJob` merges.
     - *A timeline preset copied across many files*: **Timeline presets** —
       Save timeline as preset, Load into timeline, Save the timeline over
       it, **Use for every clip**, Delete. A clip on a preset *links* to it,
       so one move sent out as 16:9, 9:16 and square follows every later
       edit. Deleting a preset leaves each linked clip a copy, so nothing
       queued changes. A clip's Move menu also picks a fixed move, its own
       timeline or any preset.
     Also: **A still of every keyframe** (each from its key's view, and its
     own frame when the frame is keyframed), Move up, Show this view for a
     still. Files are numbered in queue order and named after the item's
     name, its preset, or what it is (`Spring-booth-01-rise.mp4`,
     `…-02-still.png`). A still renders through `scene.export` with a new
     optional `pose`, restored in the finally.
     **Where it lives:** the optional `p.exportKit` (`defaults`, `presets`,
     `queue`), validated by `validKit` in `validateProject` — so it
     autosaves with the booth (survives a reload on this browser) and
     travels in a backup; every older backup has none and loads. It is not
     the booth, so a change to it is saved without an undo step, and
     undo / redo carry the current kit across (`keepKit`) rather than
     un-queueing things.
  5. **Export and the batch in the timeline window.** The dialog ends with
     an Export section (Export MP4, with its progress) and the whole batch
     section, so a clip can be built, queued and rendered without leaving
     it. The dialog's contents are emptied on close so the shared controls
     are never in the page twice.
  The batch's folding sections remember whether they are open across the
  redraw every change causes (`openFolds`; recorded on the summary's click
  as well as on `toggle`, because a redraw can beat the queued toggle event).
  Tests: `tests/timeline.test.js` (slid ends hold before and after, in both
  flows; the keyframed frame sampled, dropped when off, filled and clamped;
  previous / next; auto timing keeping slid ends), `tests/batch.test.js`
  (general settings and tweaks, presets linked and deleted, stills, the
  backup validator, file names), and a new browser suite
  `tests/view-batch.mjs` — prev / next, a slid end key and its drawn hold,
  a keyframed frame the guide follows between two keys and while scrubbed,
  a preset used by a clip, general settings reaching an item and a tweak
  surviving them, undo leaving the queue alone, a batch of a clip and a
  still downloading both files, and the queue and preset surviving a
  reload.
  Not checked by eye: whether the moving frame reads as intended in an
  exported clip, and whether the batch panel is too long in the timeline
  window on a phone.
- **2026-09-25, second round: the owner's asks after seeing the frame
  guide. Merged to `main` and deployed.**
  1. **The export frame can be moved, resized and reshaped.** Asked for as
     "the export frame size with the option to manually drag or move the
     export window or change the shape manually (with handles, or sliders)".
     On the guide over the viewport: the **label** (top left, "16:9" or the
     custom size) drags the frame; the four **corners** resize it and keep
     its shape; the four **edges** change its shape, which switches the frame
     to Custom at the new ratio (the long side keeps the custom size's, at
     least 1080). The same placement has three sliders under Frame in Video
     and in Export — **Frame size** (20–100% of the largest fit), **Frame
     left / right** and **Frame up / down** (−100..100% of the room left
     over) — and **Reset frame to fit**. The clip and the still each have
     their own placement (`framePlace.video` / `.export`), remembered in
     `booth.view` with the other export choices and never in the booth. A
     queued clip keeps the placement it was queued with. Only the label and
     the handles take the pointer, so orbiting inside the frame still works.
     `placeRect` / `placeFromRect` / `normalPlace` in `src/framing.js` hold
     the placement as scale plus −1..1 offsets rather than pixels, so it
     survives a window resize.
     **How the export matches it:** both `recordVideo` and the still
     `export` now keep the viewport's own projection and call
     `camera.setViewOffset` with the frame's rectangle (`frameRect` in
     scene.js), so the file is exactly that rectangle of the viewport, off
     centre or not. The backdrop pass copies the same offset onto the
     backdrop camera. This replaced the morning's `frameLens` (which could
     only do a centred frame), and as a side effect a Plan or wall view
     exported at a shape other than the window's no longer stretches.
  2. **The dimming outside the frame is darker**: 80% black, from 55% —
     "about 50% darker", as asked.
  3. **Play and Pause in the timeline dialog** (replacing its Preview /
     Stop). Play runs the clip from the playhead — "Play from here" when the
     playhead is part-way — and Pause stops it where it is: the camera, the
     playhead and the fade are all left on that moment (`previewMove` takes
     `from`, and `stopPreview({ keep: true })` skips putting the camera
     back). The Video tab's own "Preview the move" is unchanged.
  4. **Edit timeline… is always there** in the Video section, not only once
     Custom is picked from the Camera move menu; pressing it on a fixed move
     switches the move to Custom and opens the dialog.
  5. **A click on nothing opens Layout.** A click on empty space used to open
     Artwork, whose empty state is "Make room for your work"; asked to land
     on Layout instead. Precisely: a click on nothing while Artwork is open
     moves to Layout, and on any other tab stays put, so orbiting from Video
     or Lighting does not throw the panel away. A click on a work still opens
     Artwork.
  6. **The build stamp, in New York time, and on a phone.** The footer's
     time is now month, day, hour and minute run together in New York time
     — 24 September at 10:36 is `9241036` — labelled EST as asked (it is
     EDT in summer; `BUILD.stamp` in main.js). On a phone, where the footer
     is hidden, the same stamp and the commit sit under the booth's name in
     the viewport's top-left label (`.mobile-stamp`).
  The owner also asked what **Show this view** does, on a keyframe's card:
  it moves the viewport's camera to that keyframe's view, so the shot can be
  looked at (and, with Replace with current view, adjusted and put back). It
  changes nothing in the timeline.
  Tests: `tests/framing.test.js` (placement round trip, clamping);
  `tests/view-frame.mjs`, a new suite — the stamp's format, a click on
  nothing opening Layout, Edit timeline from a fixed move, a corner resize
  that keeps 16:9, a label drag, an edge drag that makes the frame custom,
  the sliders and reset, a placed square export at 1080 with the view offset
  cleared afterwards, the placement surviving a reload, and the stamp
  visible at phone width; `view-timeline` pauses a playing clip part-way.
- **2026-09-25, the owner's answers to the lock/lift/timeline round. Merged
  to `main` and deployed.** The owner also reported the 2014 iMac's speed as
  good now, and approved the tool shortcuts as drafted (see 5).
  1. **The frame guide, and exports that match it.** Reported: "video export
     seems to export the same dimensions the preview window is at, not the
     preset size … if it's set at 16:9, I need to see this aspect ratio in the
     preview so changes can be made before export." Three changes:
     - **A clip now starts in widescreen 16:9** (`DEFAULT_CLIP_FRAME` in
       `src/framing.js`). "This window" is still in the Frame menu for anyone
       who wants the window's shape — both are options, as asked. Every
       browser that had saved "This window" had it only because it was the
       default, so view prefs saved before this (no `clipFrame: 2` in
       `booth.view`) are not read for the clip frame; a choice made since is
       kept. The still keeps "This window" as its default.
     - **The frame guide**: while the Video or Export tab is open, the
       timeline dialog is up, or a move is previewing, the chosen frame is
       outlined over the viewport, labelled, with everything outside it
       dimmed (`updateFrameGuide` in main.js, `guideRect` in framing.js; a
       `.frame-guide` div that takes no pointer events). Hidden when the
       frame is "This window", because then the viewport is the frame.
     - **The file is exactly what is inside the guide.** A frame narrower
       than the window was already that (the camera keeps its height). A
       frame wider than the window used to keep the height too and so showed
       more at the sides than anyone had seen. This was first done by
       narrowing the lens (`frameLens`); the second round replaced that with
       a camera view offset, which also handles a frame moved off centre —
       see the bullet above.
       The keyframe pictures in the timeline strip are cropped to the frame
       as well. The old note — "a frame that is not the window's shape shows
       more or less at the sides" — is gone, because it is no longer true.
  2. **Figures: 0 is the middle, and half inches.** Raised off the floor now
     runs **−120″ to +120″** (`MIN_LIFT`, `MAX_LIFT`, `LIFT_STEP = 0.5` in
     `src/people.js`), so the slider starts at its centre and lowers as far
     as it raises — into a stepped-down floor or a pit. `validateProject`
     accepts −120..120; everything saved before was 0..120, so every older
     backup still loads.
  3. **Double-click a figure to select it.** The figure's card in Layout →
     People for scale opens, scrolls into view and is outlined blue with a
     Selected badge (`pickPerson` in scene.js — recursive, because a figure
     is a group, and walls, artwork and pedestals in front of it win; the
     scene's `onSelectPerson` is set by main.js after construction rather
     than added to the constructor's positional callbacks). A figure is
     still placed by its sliders, not dragged in the viewport; dragging is
     the obvious next step if it is wanted.
  4. **The timeline, three steps up — kept small.**
     - **Scrubbing shows the fade** (and the flare): `scene.showMoment(tl,
       t)` poses the camera and sets the overlay the recorder would. The
       fade stays on the viewport while the scrub is left there, and goes
       the moment the camera is moved by hand (the controls' `start` event
       calls `clearMoment`), a keyframe is shown, or the dialog closes.
     - **Camera flow: one continuous glide.** A new Motion section with a
       Camera flow menu — *Ease at every keyframe* (what it always did: with
       the default ramp the camera settles on every key) or *One continuous
       glide*: eases in once, travels at a steady speed through every
       keyframe without stopping, eases out at the end, like a slider or a
       gimbal. A hold still stops it; the glide eases into and out of each
       hold. `flow` on the timeline (`FLOWS`, `glideEase` — 20% ramp up and
       down, peak speed 1.25× the average — and `sampleGlide` in
       `src/timeline.js`). In a glide the per-key Ramp menu is hidden and
       the track draws each segment straight.
     - **Auto timing · even speed**: respaces the middle keyframes so the
       camera covers the same distance every second (`autoTime`: each
       segment's arc length along the orbit, plus half its aim's swing so a
       pan on the spot gets time too). Ends, holds and length are kept.
       **Put the timing back** undoes it — the timeline is view state
       outside the project's undo history, so it needs its own.
     The timeline is not part of the project, so none of this touches the
     schema.
  5. **Tool shortcuts approved.** The draft names in `SHORTCUTS` stand. One
     added: `frm`, the Video tab's Frame menu. Voice search is still not
     built (see the shortcuts bullet below for why).
  Tests: `tests/framing.test.js` (the clip default, `guideRect`,
  `frameLens`), `tests/timeline.test.js` (flow, the glide ease, a glide not
  stopping at a middle key while per-key easing does, holds in a glide, auto
  timing), `tests/people.test.js` (negative and half-inch lifts);
  `view-timeline` scrubs into a fade, switches to the glide, runs and undoes
  auto timing and measures the 16:9 guide; `view-people` checks the lift
  slider's −120..120 / 0.5 and double-clicks a figure.
- **2026-09-24, the owner's next three: lock a box, raise a figure, a
  visual timeline. Merged to `main` and deployed.**
  1. **Lock a floor piece.** Every pedestal, piece of furniture and drawn box
     has a padlock beside its eye in Walls → Pedestals and furniture. Locked
     (`locked: true`, optional, on the pedestal record) it is still drawn, in
     every export too, but it is left out of `pedestalObjects`, the scene's
     pick list — so a click on it passes through to orbit or to whatever is
     behind it, and it cannot be selected or dragged in the viewport. Its
     fields in the panel still work; that and the padlock are the only way to
     change it. Asked for so a box laid down as a stage or a floor stops
     getting picked up. Locking lets go of it if it was selected.
  2. **Raise or lower a figure.** People for scale → each figure has
     **Raised off the floor** (a typed number and a Raise / lower slider),
     0–120″, stored as optional `lift` on the person. For standing someone on
     a pedestal, a box used as a stage, or a riser. `placePerson` puts it in
     the group's y, so the cut-out's face-the-camera turn and its shadow come
     along without change.
  3. **The camera timeline, drawn as a timeline.** Asked for as "more visual,
     so I can see the keyframes — easier to use, more intuitive". The dialog
     (Video → Custom → Edit timeline) is now, top to bottom: three numbered
     steps; Add keyframe, Preview and Length on one bar; a **track** with a
     seconds ruler, each keyframe a numbered diamond at the second the camera
     arrives there, each move a blue band carrying a drawing of its ramp
     (ease-in visibly starts flat), each hold a striped block, the fades as
     shading at the ends, and a pink playhead; a **strip of pictures**, one
     per keyframe, taken from the viewport when the key is added or
     replaced (and drawn once for any key without one when the dialog opens);
     and one card for the selected keyframe — its time, hold, ramp, Show this
     view, Replace with current view, Delete. **Drag a middle diamond to
     retime it; press or drag anywhere else on the track to scrub the camera
     through the move; click a picture to select that keyframe and see its
     view.** Preview moves the playhead as it plays. The pictures and the
     selection are view state, never saved. `keySchedule` / `keyTAt` in
     `src/timeline.js` convert between a key's `t` and clip seconds with
     holds counted — the old "At" field ignored holds, so with a hold in the
     clip it showed and set the wrong second; it now uses them too.
  Not checked by eye on the real machine: whether the diamonds are big
  enough to grab on a phone (28 px there, 22 on a desktop), and whether a
  12-keyframe clip crowds the track.
- **2026-09-24, after the roadmap: tool shortcuts, three more people, a
  smaller drag shadow, and Pro unlocked. Merged to `main` and deployed.**
  The owner's list from Next, built together while they tested the live site.
  1. **Tool shortcuts.** `SHORTCUTS` in `src/toolsearch.js` gives about sixty
     tools a short name (`amb` ambient, `wh` wall height, `png` export PNG,
     `pack` the show pack …). Typed exactly into the search box, a shortcut
     puts its tool first; everything else the words match follows, so a
     shortcut that is also a word (`gap`) hides nothing. The result list shows
     each tool's shortcut beside it, and Help lists them all, grouped. **The
     names are a first draft for the owner to edit** — change the table, and
     view-toolsearch fails if a name no longer finds a real control. `/` and
     Ctrl/⌘ K already jumped to the box; the tooltip now says so. On a phone
     the header box is out of thumb's reach, so a round search button sits in
     the viewport's lower right (phones only) and focuses it. **Voice was not
     built:** the browser's speech recognition is missing in some browsers and
     in Chrome sends the audio to Google, which the local-first rule forbids
     without the owner's say-so. The phone keyboard's own dictation key
     already types into the box.
  2. **People: child (4′0″), pair (5′10″) and wheelchair user (4′4″
     seated).** Layout → People for scale → Add child / Add pair / Add
     wheelchair user. Their pictures are plain black silhouettes drawn for the
     app in the man's style (`tools/people/*.svg`, rendered to
     `public/assets/people/*.png`, boxes measured off the alpha), standing in
     until the owner supplies better ones. Without the pictures a child is the
     mannequin with a larger head, the pair is two mannequins, and the
     wheelchair user is a seated mannequin in a chair. `validateProject`
     accepts the three new kinds; an older backup is unaffected.
  3. **Shadow maps are 512 during a drag** (`dragShadowMaps` in scene.js,
     called from the loop when a drag starts or ends): a quarter of the depth
     pass on the maps that are 1024. The shadow is softer while a piece
     moves and sharp again when it is let go. This was the lever named in
     Next for any stutter still left.
  4. **Pro is unlocked for everyone** (`LOCKS_ON = false` in `src/tier.js`):
     every page load starts on Pro even in a browser that once chose Lite.
     The Plan switch still shows Lite for the rest of that visit. Turning the
     lock on later is that one line.
- **2026-09-24, roadmap batch E: the hall planner, and the power and
  rentals sheet. Pushed to `main`.** Both Pro (`hall`, `power`).
  1. **The hall planner** — for a promoter or an event company selling a
     whole show. A new inspector tab, **Hall** (the eighth; they scroll on a
     phone). **Start a hall plan** makes two back-to-back rows of eight
     10 × 10s on 10′ aisles, numbered from 101; the Layout section types rows,
     booths per row, booth width and depth, aisle width, back-to-back pairs,
     the first number and a default price, up to 1,200 booths (whichever of
     rows and booths-per-row was just typed wins). The map is an SVG in the
     panel: tap a booth — or focus it and press Enter — to set its status
     (open / held / sold, coloured), exhibitor, price and note, or mark it as
     **your** booth (outlined pink). Totals count sold, held and open and add
     up sold and held money. **Download hall map** is a printable page with
     the map, a legend, the totals and every booth; **Exhibitor list (CSV)**
     opens in any spreadsheet. The plan is the whole show, not this booth, so
     it is saved beside it as the optional **`p.hall`** — `{ rows, perRow,
     boothWidth, boothDepth, aisle, backToBack, start, price, mine?, booths:
     { "<number>": { status?, name?, price?, note? } } }` — validated by
     `validHall`. Deleting it asks first and is one undo step. `src/hall.js`,
     pure. Not done: booths of mixed sizes, corner/island blocks, and linking
     a hall booth to its own 3D booth — the obvious next steps if promoters
     use it.
  2. **Power and rentals** — Export → Power and rentals says what to order
     from the show's service desk (**watts, amps at 120 V, circuits of 15 A
     at the 80% continuous rule**) and downloads a printable sheet: every
     load (visible spotlights at 15 W, light-bar heads at 12 W, screens at
     120 W, and the typed number of general outlets at 150 W), then every
     floor piece to rent by kind with carpet for the booth's area, price
     columns left blank. The wattages are typical LED figures, printed beside
     each line and said to be assumptions. `src/power.js`, pure; `WATTS` is
     where they live.
  `tests/hall-power.test.js`; `tests/view-hall.mjs` sells a booth, grows the
  hall against its ceiling, downloads the map and the CSV, reloads, reads
  the power total and the sheet, checks both are Pro and undoes a delete.
- **2026-09-24, roadmap batch D: draw-a-box, and 3D models in and out.
  Pushed to `main`.** All Pro (`box`, `glb`).
  1. **Draw a box.** Toolbar → **Box**: press on the floor, drag out a
     footprint (a pink outline with its size follows the pointer, whole
     inches with Snap on), let go. It becomes a floor piece of the new
     furniture kind **`box`** — a plain block at exactly its measurements,
     12″ high to start, selected, with a **Pull up** slider beside its Height
     in the Walls tool. A riser, a plinth, a stage, a custom counter. Esc puts
     the tool away; a click without a drag draws nothing. A box is a pedestal
     record like any other furniture (`booth.pedestals`, `kind: "box"`), so it
     drags, turns, hides, nudges, lands in the show pack and is checked for
     clearance with no new code; its limits are wider than furniture's
     (`BOX_LIMITS`: up to 360″ across, 144″ high) so it can be a stage.
     `setDrawingBox` / `boxFrom` / `showBoxPreview` in scene.js.
  2. **Export the booth as `.glb`.** Export → 3D model: the booth, the work
     with its images, the furniture, the figures and any imported models, in
     metres, through three's GLTFExporter (loaded on first use). Left out:
     surroundings, the ground, lights, the drawn drop shadows, the underlay,
     anything editor-only and anything a hidden tag has taken out
     (`exportGLB` hides them for the write and puts them back). Opens in
     Blender and AR viewers; SketchUp needs its glTF importer. A cut-out
     figure is a flat picture there, facing the way its rotation says.
  3. **Import a `.glb` model.** Walls → 3D models → **Import .glb model**: a
     sculpture, a custom display, a scan. It is checked for the `glTF` magic
     bytes, kept in the booth as an asset of the new role **`model`**
     (`data:model/gltf-binary;base64,…`, up to 28 MB) and placed through the
     new optional **`booth.models`** list — `{ id, asset, name, height, x, z,
     rotation, hidden? }`, up to 8 (`MAX_MODELS`). It is scaled uniformly so
     its tallest point is the typed height (36″ to start), centred on its X/Z
     and stood on the floor, so the file's own units never matter. Sliders
     and typed numbers place it; it has an eye and a remove, and removing the
     last placement of a file removes the file. It is not draggable in the
     viewport yet. `buildModels` / `parseModel` in scene.js; GLTFLoader loads
     on first use.
  `tests/box-model.test.js`; `tests/view-box.mjs` draws a box with the mouse,
  pulls it up and reads the geometry back, exports the booth, checks the
  bytes are glTF with meshes and no lights, then imports that same file as a
  model and checks it stands on the floor at 36″ and survives a reload.
- **2026-09-24, roadmap batch C: floor plan underlay, clearance checks,
  elevations to scale. Pushed to `main`.** All Pro (`underlay`, `clearance`,
  `elevations`).
  1. **Floor plan underlay.** Layout → Floor plan underlay → **Add floor
     plan image** (JPG or PNG — a screenshot of a PDF plan is fine; PDFs
     themselves would need pdf.js and were not taken on). It lies on the
     floor under everything, half see-through, editor-only so it never
     reaches an export, and the view switches to Plan. **Scaling it**: pick
     up the tape (T), measure something on the plan whose real length is
     known, type that length and press **Scale plan** — the plan is scaled
     about the tape's start, so the measured point stays put. Then opacity,
     X/Z, rotation and on/off place it. Stored as the optional
     **`booth.underlay`** `{ asset, width, x, z, rotation, opacity, on }`,
     its image an asset of the new role **`underlay`** that never shows in
     the artwork library; removing the plan removes the image.
     `buildUnderlay` in scene.js. **Found and fixed on the way:** the
     backup validator only knew four asset roles, so a booth with a plan
     would have failed to reopen — `underlay` and `model` are now allowed,
     and `tests/clearance.test.js` pins a round trip.
  2. **Clearance checks.** Layout → Clearance checks lists, worst first:
     floor pieces standing in each other or in a wall, a piece poking out of
     the footprint, works hung over each other, and every gap narrower than
     **36″ (the accessible route width)** between two pieces or a piece and a
     wall. Gaps under 4″ are taken as a piece pushed against something on
     purpose. **Show** selects the piece and switches to Plan view, where
     each tight gap is a red line with its width. `src/clearance.js` is the
     geometry, pure — rectangles turned the way three turns a group,
     separating-axis overlap, exact polygon gaps — and `scene.clearance`
     carries the tight gaps to `refreshGuides`. Lite draws none.
  3. **Elevations to scale.** Export → Elevations to scale downloads one
     printable page: a floor plan and every wall face with work on it (every
     enabled inside face regardless), each at the largest standard
     architectural scale that fits a landscape Letter sheet — 1″, ¾″, ½″ or
     ¼″ to the foot (`fitScale`) — with the chain of gaps along the floor,
     overall width and height, each work numbered with its centre line, a 1′
     scale bar, and the plan's tight gaps in dashed red. SVGs are sized in
     physical inches, so a print at 100% measures true. `src/elevations.js`,
     pure. The hanging guide is unchanged: it is the table of numbers, this
     is the drawing.
  `tests/clearance.test.js`; `tests/view-plan.mjs` uploads a plan, scales it
  from a taped metre, reloads, lists and draws a tight gap, downloads the
  elevations and checks all three are locked in Lite.
- **2026-09-24, roadmap batch B: saved views, tags, walk mode. Pushed to
  `main`.** All three are Lite. `src/views.js` holds the rules, pure.
  1. **Saved views** — SketchUp's Scenes. Layout → Saved views: **Save this
     view** keeps the camera as a named pose (up to 12, `MAX_VIEWS`); each row
     renames in place, goes back to it, replaces it with the current camera
     or deletes it. A **View** menu appears under the booth, beside Zoom, as
     soon as there is one. **Export all as PNG** renders every view at the
     Export tab's size and frame, one file each, named after the view, and
     puts the camera back. Views belong to the booth, so they are saved in it
     as the optional `p.views`, validated by `validViews` from
     `validateProject`; every older backup simply has none.
  2. **Tags** — visibility groups: Artwork, Pedestals and furniture,
     Free-standing walls, People, Light fixtures, Surroundings. Layout → Tags
     unticks a group out of the viewport, every export and the pick. The
     scene marks each built object's `userData.tag` and `applyTags()` moves a
     hidden one's meshes to **layer 1**, which the camera, the shadow cameras
     and the raycaster all ignore — so a hidden work casts nothing and cannot
     be clicked. Lights are never moved: Light fixtures hides housings and the
     bar, not the light. **Not saved** — a booth reopening with its art
     switched off by a forgotten tick is the wrong failure — and kept through
     rebuilds (`update()` ends in `applyTags()`).
  3. **Walk mode** — toolbar **Walk** (or W). The camera stands in the aisle
     at a 5′6″ visitor's eye height (62″, `EYE_HEIGHT`) looking in; W/S or
     ↑/↓ step forward and back, A/D or ←/→ sideways, 6″ a press and 2′ with
     Shift, always along the floor whatever the head is doing; drag to look
     round. On touch a four-arrow pad appears in the viewport with **Done**.
     Esc, Done, any fixed view or a saved view ends it and hands the orbit
     controls back exactly as they were. The trick is the orbit controls
     orbiting a target a centimetre ahead (`startWalk` / `walk` / `stopWalk`
     in scene.js), so there is no second camera controller to keep in step.
  `tests/views.test.js`, `tests/view-views.mjs` (which also checks the one
  PNG per view and that a hidden work cannot be picked). **Not seen on real
  hardware**: whether 6″ steps feel right, whether drag-to-look wants to be
  inverted (it is set to feel like turning your head, `rotateSpeed` −0.35).
- **2026-09-24, roadmap batch A: smart guides, and several works at once.
  Pushed to `main`.**
  1. **Smart guides** — SketchUp's inference, for a work dragged along its
     wall. With Snap on, an edge or centre that comes within 2″
     (`SNAP_RANGE`) of another work's edge or centre on the same face of the
     same wall, the wall's centre or edges, or — for a centre only — the 60″
     hang line jumps to it, and a pink line is drawn through what it
     matched. Between two neighbours it also finds the spot that leaves
     **equal gaps** either side and labels both gaps in inches. Alt holds the
     guides off for that drag and leaves the plain 1″ grid. `src/guides.js`
     is the arithmetic, pure; `scene.showSnap()` draws it in the wall's own
     frame (editor-only lines, DOM labels in `snapNotes`, so neither reaches
     an export) and clears it on pointer-up. Lite, like the rest of Snap.
  2. **A multiple selection.** Shift-click adds a work to the selection or
     takes it out; on a phone, Artwork → Placement → **Select several** makes
     every tap do that until **Done selecting**. `picked` in main.js is the
     set, including the primary `selected` work, which keeps the handles and
     the inspector; the others are outlined in violet (`scene.also`). View
     state only: never saved, never in the history. Arrow keys move the lot
     together, Delete removes the lot, the status bar counts them.
  3. **Align and distribute (Pro).** The Artwork panel shows **N works
     selected** with Align left edges / centres / right edges / tops /
     middles / bottoms and Distribute across / up — the Illustrator and
     SketchUp rule: aligned to the box the works make together, and
     distributing keeps the two outermost where they are. Only the works on
     the same face of the same wall as the primary one move; the rest are
     named in the toast. `src/align.js`, pure. In Lite the buttons are the
     Pro lock; the selection itself is everyone's.
  Not done, and the obvious next refinements: a box-drag (marquee)
  selection, which fights orbiting for the same gesture; guides for floor
  pieces dragged across the floor; and a saved group ("my triptych") that
  moves as one. `tests/guides.test.js`, `tests/view-guides.mjs`.
- **2026-09-24: the roadmap, agreed, and its base — Lite / Pro and the phone
  layout. Pushed straight to `main` at the owner's word.** The owner's
  instruction: "go ahead with the base first (pro version up and going —
  will make it a separate plan later). If this tests green, move to A–E.
  Test each tool. If green continue. Update handoff after each new tool."
  The roadmap is item 2 of Next, and **its tools land in batches A–E, one
  commit and one push to `main` each, with this file updated every time**, so
  a session that stops mid-roadmap leaves `main` green and this file true.
  1. **`src/tier.js` is the whole of Lite and Pro.** `PRO_FEATURES` is the one
     table of what is Pro (booth row, show pack, hanging guide, video export,
     templates, and the roadmap's align/distribute, floor plan underlay,
     clearance checks, elevations, draw-a-box, 3D model import/export, hall
     planner and power sheet); anything not in it is everyone's. `can(tier,
     feature)` is the only question asked. `PRO_ACTIONS` maps `data-action`
     names to features, and the click handler in main.js refuses a Pro action
     in Lite at that one gate with a toast, whatever drew the button.
  2. **Pro is the default**, at the owner's word. The tier is a view setting
     in `localStorage["booth.tier"]`, switched at Layout → Project → Plan —
     never in a backup, never in schema 1. **How Pro is unlocked is not
     decided**: there is no backend to check a purchase against, so it will
     be an honour-system switch or a signed key checked in the browser, and
     that is the owner's "separate plan". A Lite browser opening a Pro booth
     draws all of it; it only cannot add to or export the Pro parts.
  3. **In Lite a Pro section is replaced by its lock** (`proLock` / `gated`
     in main.js): the name, a gold Pro badge and **Switch to Pro**. The
     section's controls are not drawn at all, so nothing is half-usable.
     Every roadmap tool is gated through `gated()` and `PRO_ACTIONS` from the
     day it lands.
  4. **The phone layout.** At 390 px the toolbar and the seven inspector tabs
     overflowed — Photo, Export and the Export tab were cut off. Both now
     scroll sideways (scrollbars hidden), tabs stack icon over label, and the
     inspector's inputs, selects and buttons are at least 40 px tall. A
     **sheet handle** above the panel folds it down to its tab bar so the
     booth gets the screen; choosing any tab unfolds it (`setSheet`). Not
     remembered — it is a gesture of the moment. The tool-search input is
     16 px on a phone, which stops iOS zooming the page when it is focused.
  5. The icons `video`, `user-round` and `sliders-horizontal` were used and
     never imported, so the Video tab, Add woman / Add man and Edit timeline
     showed no icon. They are imported now, with the ones the roadmap tools
     will need.
  `tests/tier.test.js` holds the table; `tests/view-tier.mjs` switches to
  Lite and back, smuggles a Pro button into the page to prove the gate, and
  checks the phone layout: no sideways scroll, every tab reachable, the fold
  giving the viewport its height.
- **2026-09-24: people are the owner's cut-out pictures. Pushed straight to
  `main` at the owner's word.** Two PNGs with transparent backgrounds, supplied
  in chat — a black silhouette of a man, and a posterised woman in colour
  ("the female one is for woman") — are `public/assets/people/man.png` and
  `woman.png`, and Layout → People → Add woman / Add man now draws them.
  - **A figure is one plane that turns to face the camera**, the way
    SketchUp's face-me people and architects' entourage work, so it never
    shows its edge. The turn is written into `matrixWorld` in the mesh's
    `onBeforeRender` (`makeCutout` in `src/people.js`), so it follows every
    camera that draws it — the viewport, exports, video, and each light's
    shadow camera, which is why the shadow is always the whole silhouette.
    Nothing else sees the turn: the figure's position, `rotation` and every
    test reading them are untouched.
  - **The typed height is still the height.** The picture's own box (the
    figure inside its transparent margin, measured off the alpha channel) is
    in `PEOPLE[kind].cutout` and mapped onto the plane's UVs, so the top of
    the hair is the typed height and the soles are on the floor.
    `tests/view-people.mjs` reads both heights back in metres and checks each
    plane faces the camera.
  - **A figure's facing now only mirrors the picture.** Both pictures look to
    the viewer's left; when a figure's rotation points to the viewer's right
    the picture flips, so two figures turned to face each other do. The
    rotation field is otherwise inert for a cut-out — a picture cannot show
    its back.
  - **Alpha test, not blending**, so the figures need no sorting against the
    artwork and cast a correct shadow. Lit like everything else
    (MeshStandardMaterial, roughness 1), so a dim booth dims them too.
  - **The mannequin is the fallback.** The app must run with `public/assets`
    empty: a missing picture leaves the grey mannequin, silently. The scene
    loads each kind's picture once (`cutoutFor` / `loadCutout`), shares it
    across figures and rebuilds, and swaps mannequins for pictures when it
    lands; the test reloads with the pictures refused and checks for the
    mannequin. Schema untouched — the pictures are assets, not data.
  - **Where the pictures came from is the owner's to know.** They arrived in
    chat with no source; `public/third-party-licenses.txt` says nothing about
    them.
- **2026-09-23, third round: the owner's answers, and tool search. Pushed
  straight to `main` at the owner's word.** The answers to Next item 1, as a
  quick question sheet: a drag with fast edit off is a "slight stutter, but
  decent"; the drop-shadow mapping and the second shadow's defaults are both
  right; the angle dial feels like Photoshop's; hidden and switched-off walls'
  art should leave the inventory; the Preview readout should say sharp /
  softer; Auto settles sensibly; nothing waits for the mouse; the light bar's
  shadows are not missed in the preview. What changed:
  1. **A drag refreshes the shadow maps every other drawn frame.**
     `touchShadows` alternates while `this.drag` is set; a skipped refresh is
     owed (`shadowsOwed`) and paid by the next frame without a move and by
     pointer-up, so the shadow is at most one frame behind and a drag always
     ends on true shadows. This is the lever the previous round named, not a
     return to holding the maps until release.
  2. **The inventory leaves out work on a switched-off perimeter wall, a
     hidden free-standing wall, or a panel that no longer exists**
     (`onShownWall` in `src/showpack.js`), which is what the booth shows.
  3. **The readout beside the Preview menu says sharpest / sharp / softer /
     softest** instead of "drawing at 2×"; the factor moved to its tooltip.
     The menu's own options still name their rungs ("Balanced, 2×").
  4. **Tool search, in the header** — asked for as "a search box: you can
     search a tool name and it opens the tool or gives a list of options".
     Type a name; the list shows each match with the tab and section it lives
     in; Enter or a click opens that tab, scrolls to the control, focuses it
     and flashes it. A toolbar or view button found is pressed, because it is
     a tool in itself; a button in the inspector is only focused, because
     "Remove" found is not "Remove" meant. `/` or Ctrl/⌘-K jumps to the box.
     The index is read from `inspectorHTML()` for every tab at the moment the
     box is focused — `renderInspector()` was split so the markup can be built
     without drawing it — so a control added to a panel is findable without
     touching a list, and one the current booth does not show is not offered.
     `src/toolsearch.js` is the ranking, pure; `tests/view-toolsearch.mjs`
     drives it.
- **2026-09-23, second round: the first report from the real machine, and
  what it asked for. Merged and deployed 2026-09-23** from
  `claude/gifted-ramanujan-jgr1cy`, at the owner's word. The report, in order:
  "Speed — much better. If there is still room to improve, keep improving";
  "what preview quality are we looking at, and where is it visible?"; a hide
  button for furniture and anything added; the drop shadow lingering in the
  old place during a drag; the drop shadow to work like Photoshop's (a
  screenshot of its dialog: Opacity 31%, Angle 125° with Use Global Light,
  Distance 10 px, Spread 4%, Size 16 px); and a second, stronger shadow under
  and to the side, both with an eye. One commit each:
  1. **A dragged work's cast shadow follows it.** `touchShadows` held the
     shadow maps still for the whole of a drag and refreshed them on release
     — from when every pointer event re-rendered nine casting heads. With
     fast edit off that left the work's real cast shadow on the wall where it
     had been. A drag is applied once per drawn frame now, and the bar casts
     only at High detail, so a drag simply refreshes the maps every frame.
     `settleShadows` and `shadowsStale` are gone.
  2. **Fast edit no longer draws flat out.** Found on the way: three clears
     `shadowMap.needsUpdate` only when it actually redraws a map, so with the
     maps off (fast edit) or no light casting, one moved piece left the flag
     up and `tick()` read it as a frame owed on every turn — continuous
     drawing, in the mode meant for a slow machine, until fast edit ended.
     This was on `main`. `tick()` now drops the flag after each frame.
  3. **A click no longer draws the booth inside its handler.**
     `applySelection()` ended in `renderFrame()`, from before on-demand
     drawing: three renders per click, the first blocking the inspector.
     Frames per selection 3.3 → 2.4, per edit 3.5 → 3.1, an edit's
     synchronous handler 78 → 10 ms (swiftshader; ratios, not milliseconds).
  4. **Photoshop's drop shadow, twice.** Lighting → **Drop shadow · behind
     the work** and **Second shadow · under & to the side**, each Opacity,
     Angle (a dial you drag, the degrees typed, and **Use global light**),
     Distance, Spread and Size, slider plus typed number, with an eye in the
     heading. Distance and Size are **inches on the wall**; the defaults are
     the screenshot's numbers at 20 px to the inch (31%, 125°, 0.5″, 4%,
     0.8″). The second defaults to 55%, 1.5″, 10%, 2.5″ and is **off** until
     its eye is on, so no existing booth changes unasked. The shape is exact
     — a Gaussian-blurred rectangle is the product of two error functions —
     and drawn in a MeshBasicMaterial hook (`SHADOW_GLSL`, `shadowMaterial`),
     so there are no canvases, it is crisp at 4096 px, and every shadow
     shares one program. Sliders move the shadows live with no rebuild and
     one undo step per gesture (`setShadowLive`, `scene.updateShadows`).
     **The shadow no longer scales with each work's wall gap** — Photoshop's
     are absolute, and that is what was asked for; the Artwork panel says so.
  5. **Hide instead of delete.** An eye beside every pedestal or piece of
     furniture, free-standing wall and figure. `hidden: true` on the record,
     read through `isShown()` in model.js: not built, not in exports, not
     pickable, not on the show pack's plan or packing list or the hanging
     guide's pedestal table. A hidden panel reads as a switched-off wall
     (`wallSpec().enabled`), so its art goes with it.
  6. **Preview quality is visible where the picture is.** The status bar
     under the viewport has the same menu Export always had, Auto's option
     names its rung ("Auto · now Balanced, 2×"), and beside it is the factor
     actually drawn at — not always the setting: fast edit draws 1× with no
     shadows, and on a Retina display Efficient still draws at the display's
     own 2×. **The answer to the question as asked:** when not editing and
     not in fast edit, the preview is whatever that menu says — Auto by
     default, starting at Balanced (2× supersampling) and stepping down
     3 → 2 → 1.5 → 1 only if frames are measured slow, remembered per display.
- **Merged and deployed 2026-09-23: speed on a slow machine, then the
  planning tools.** Asked for as "top 10 improvements — it lags, especially on
  a slower PC; make it usable for trade shows, art shows and artists, with
  some SketchUp functionality but easier". Ten items, each tested before the
  next, one commit each on `claude/magical-hopper-xmabcm`, merged together:
  1. **The viewport draws on demand.** `startLoop` used to render every
     animation frame forever; an idle booth kept a 2014 GPU pinned and the
     inspector sluggish. `tick()` now draws only when `invalidate()` has been
     called, the controls are still moving, a shadow map is stale, or — as a
     net — once a second for 15 s after the last change. `watchForChanges()`
     is the whole list of what invalidates: any input event on the page, the
     scene methods that change the picture (wrapped once, by name), every
     asynchronous load (`texture`, `surfaces.load`, `lighting.apply`) on
     settling, and the controls' change event. **If something changes the
     picture and does not show until you move the mouse, it is missing from
     that list.** A 50 ms timer (`KICK_MS`) draws an asked-for frame if the
     browser has not handed out an animation frame by then; see Things
     learned.
  2. **Preview quality → Auto**, the new default, remembered per browser in
     `booth.view` (`quality`, `autoScale`). It starts at Balanced's
     supersampling and steps down a rung (3 → 2 → 1.5 → 1) each time 30
     back-to-back frames have a median over 28 ms, says so once in a toast,
     and remembers the rung for that display (keyed on devicePixelRatio). It
     never steps back up by itself; picking Auto again restarts it.
     `src/adaptive.js` is the rule, pure. Preview quality was not remembered
     at all before this.
  3. **A rebuild keeps its shaders.** `disposeGroup()` used to dispose the
     old booth before the new one drew, and three deletes a program when its
     last material goes — so every edit recompiled every shader. Profiled:
     385 ms → 70–85 ms per edit for the default booth, 365 ms → 9 ms for the
     art-show booth. The old group now waits in `this.retired` until the new
     one has drawn and every load it started has settled (`this.loading`),
     at most three groups, at most 10 s. `tools/perf-probe.mjs` prints the
     numbers; view-responsive pins that a rebuild compiles nothing.
  4. **A click is cheaper.** Icons are finished SVG strings (`icon()` in
     main.js), not lucide placeholders rebuilt after every redraw; `render()`
     no longer forces a page layout by resizing the canvas mid-edit (it waits
     a frame), and `resize()` skips `setSize` when nothing changed, because
     writing a canvas size reallocates its buffer even when it is the same.
  5. **The light bar's nine heads cast shadows live only at High detail.**
     Exports and recordings turn them on (`setBarShadows`), the way they
     already undo fast edit — so a delivered file is exactly what it was.
     The fill light still grounds every pedestal in the preview.
  6. **Measuring.** Plan view draws the booth's width and depth and, for a
     selected pedestal or free-standing wall, its clear floor to the left,
     right and back walls. Toolbar → **Measure** (or T) is a tape: click,
     click, read feet-and-inches on the tape and in the status bar; Esc puts
     it away. `src/measure.js` is the arithmetic; lines are editor-only
     LineSegments and labels are DOM (`.scene-labels`), so neither reaches a
     file.
  7. **Furniture.** A pedestal may carry an optional `kind`: 6′ and 8′
     tables in cloths, counter, chair, stool, print bin, gridwall, banner
     stand, screen. Same list, drag, sliders and rotation as a pedestal;
     the Walls tool adds any of them. `MAX_PEDESTALS` 8 → 24. Shapes in
     `src/furniture.js`, stylised like the figures.
  8. **Keyboard and whole-wall arranging.** Arrows nudge 1″ (Shift 1′) —
     art along its wall, floor pieces across the floor; R / Shift+R turn
     15°; Ctrl/⌘+D duplicates; V/M/T pick Select/Move/Measure. Artwork →
     Placement gains **Space this wall evenly** and **Hang this wall at
     60″** (every work on that face of that wall). `src/arrange.js`.
  9. **Quick start** (Layout → Project): show type, size, starter furniture
     and a name build a booth through `applyVenue`; **Save this booth as a
     template** keeps booth, lights and furniture without art or images in
     `localStorage["booth.templates"]` (12 max) and Quick start offers them.
     `src/quickstart.js`.
  10. **Show pack** (Export): one printable HTML with a numbered floor plan
     and clearances, the inventory of work with size, medium and price, and
     a packing/load-in checklist derived from the booth (a canopy brings its
     weights, a table its cloth, each work two hooks). Artwork gains Medium
     and Price fields for it — `price` and `medium` were already optional
     strings in schema 1, used by wall labels. `src/showpack.js`.
- **Merged and deployed 2026-09-22:** exports in a frame
  you choose, careful rendering for video, the drawn drop shadow that finally
  makes a wall gap visible, an eye beside every spotlight, a universal edge
  colour, a seven-colour palette with a Previous button, and the edge finish
  the next work inherits. The bullets below are that work.
- **An export has a shape now, and it is not the browser window's.** Both the
  PNG and the MP4 took their aspect ratio from the viewport, so a file came
  out whatever size the window happened to be — reported as "it exports at the
  same dimensions I have the viewing window at". Export → Frame and Video →
  Frame now offer **This window** (the default, and bit-identical to the old
  behaviour), **Desktop · widescreen 16:9**, **Phone · vertical 9:16**,
  **Instagram · square 1:1**, **Instagram · portrait 4:5** and **Custom size**,
  with the still's size now given as pixels **on the long side** so a vertical
  frame is 1080 × 1920 rather than 1920 × 3413.
  - `src/framing.js` is the whole of it and is pure: `frameSize(id, {long,
    viewport, custom})` answers for a still and for a clip alike, which is what
    keeps the two from drifting apart. Both sides always come out even, because
    H.264 encodes in macroblocks.
  - A frame that is not the window's shape shows more or less at the sides:
    the camera keeps its vertical field of view and the width follows the
    ratio. `export()` sets `camera.aspect` and restores it in the same
    `finally` as everything else — a camera left disagreeing with the canvas is
    what a stretched export looks like.
  - The frame is a **view setting**, remembered per browser in `booth.view`
    beside the fast-edit lock. It says where a file is going, not anything
    about the booth, so it is not in the backup and not in schema 1. A queued
    batch clip keeps the frame it was queued with, the way it already kept its
    own timeline.
  - Photo mode keeps taking a width: a photograph has a shape of its own and a
    frame there would crop or letterbox someone's own picture.
- **Careful rendering, for the glitches on export.** Video → **Careful
  rendering** (on by default) draws each frame a second time after yielding to
  the browser, then captures it. A frame read straight after the draw call that
  produced it can still carry the previous frame's backdrop, shadow map or a
  texture that had not finished uploading, which is exactly what a glitched
  clip looks like. It roughly doubles the encode; off is the setting for a
  machine that keeps up. `settleFrame` in `recordMp4` is the mechanism, and a
  still is now drawn twice for the same reason — one frame with no second
  chance.
- **Hung work throws a shadow, and a wall gap is finally visible.**
  *(Superseded by the second 2026-09-23 round above: the three sliders became
  Photoshop's five, the canvas became a shader, and the shadow stopped
  scaling with the gap. `booth.dropShadow` is still validated and read — at
  its defaults it takes the new look, moved sliders carry over through
  `fromLegacy`. What follows is the first version, kept as the record.)* The gap
  could only be seen by putting your eye along the wall and looking down it,
  because nothing in the picture said the work was floating — and the light
  that would cast that shadow is often a diffused wash with no direction left
  in it. So the shadow is **drawn, not lit**: a soft dark card on the wall
  behind each work, sized from that work's own wall gap.
  - Lighting → **Drop shadow**: darker/lighter, further/closer, softer/harder,
    each 0..100, and an on/off. `src/dropshadow.js` is pure and holds all the
    arithmetic; `scene.artShadow()` turns a plan into one plane whose canvas is
    cached by shape, so twenty works do not build twenty textures.
  - `booth.dropShadow` is optional, so an older backup opens with the defaults
    — the picture it was saved as, plus the shadow it would have had.
  - It is scenery, like the light bar's housings, so it is in every export.
- **A spotlight can be hidden instead of deleted.** An eye beside each light in
  Lighting → Spotlights. Deleting was the only way to take a light out of a
  composition and it threw away the aim that took longest to set. `l.on` is
  optional and absent means showing, which is what every light in every older
  backup means; a hidden light is not built at all, and a lens flare will not
  come from one.
- **One edge colour for the whole booth, if you want it.** Artwork →
  **Universal edge colour for every work** switches `booth.edgeUniversal` on
  and `booth.edgeColor` answers for every placement. It is a rule, not a
  rewrite: each work keeps its own `edgeColor` and gets it back when the switch
  goes off. **Paint every work this colour** is the other thing someone might
  mean, and writes the colour into the works themselves. `edgeColorOf()` in
  `src/model.js` is the one place that decides which of the two is showing, and
  the hanging guide prints it.
- **The last edge finish is what the next work starts with.** The edge colour,
  the edge material and the thickness of the last work you set are carried to
  the next original hung on a wall — per browser, like the palette, and only
  ever a starting value.
- **Seven saved colours and a Previous button, under every colour swatch.** The
  operating system's own colour window cannot be added to, so the palette sits
  in the panel directly beneath the swatch: up to seven saved colours (`+`
  saves, shift-click forgets), and **Previous**, which is the colour that
  control held before the one it holds now. `src/swatches.js` is the list
  arithmetic; both the palette and the per-control history are per browser and
  never enter a backup.
- **Merged and deployed 2026-09-21:** fast edit mode, the light bar's two
  widened ranges, trade show as a white hall with the warehouse split out as
  its own preset, a hide switch and placement/scale sliders for the figures,
  and neighbouring booths that match this booth's size and face the right way.
  All five came from looking at the live site. Every suite was green before
  the merge: 218 Node tests, all eleven view suites, the browser suite and
  `wall-assets`.
- **Merged and deployed 2026-09-21, later the same day:** the booth row,
  fast edit's auto/on/off lock, and the fix for uploaded photographs hanging
  upside down. All three are the four bullets immediately below.
- **Uploaded photographs are the right way up again.** Decoding an original
  through `createImageBitmap` — which is what made a booth full of uploads
  affordable — hung every one of them upside down, because WebGL does not
  apply `texture.flipY` to an ImageBitmap the way it does to an `<img>` or a
  canvas. The decoder is asked for the flip instead:
  `decodeAt(..., { upload: true })` passes `imageOrientation: "flipY"` and
  records the result in a WeakSet, and `isPreflipped(src)` is what tells
  `scene.texture()` to leave `flipY` off so it is not flipped twice. An
  **edited** image is decoded the ordinary way up and flipped by the texture
  as before: rotating a pre-flipped image turns the wrong way, and the edits
  are applied on a canvas. `tests/image-source.test.js` and
  `tests/image-regression.test.js` pin both halves.
- **Fast edit has a lock, and otherwise follows the gesture.** Auto — the
  default — arms fast edit when a work's handles are armed and drops it again
  the moment you click away from that work, which is the behaviour that was
  asked for: it lasts exactly as long as the arranging. The button beside
  Fast edit in the toolbar cycles **Auto → On → Off**; On and Off hold it
  there and no gesture moves it. `scene.setDraftPolicy`, `armDraft`,
  `releaseDraft` and `letGoOfArt` in `src/scene.js` are the whole mechanism;
  the policy is remembered in `localStorage` per browser, because it is a
  judgement about a machine rather than about a booth. It is also a dropdown
  in Layout → Drawing speed. Still a view setting: not in the backup, not in
  the undo history, not in schema 1.
- **A booth is one of a row now.** Layout → **Booth row**: `+1 booth` either
  side, a typed number and `Add typed number` for ten at once, `+ space` for a
  gap in the aisle with its own width, a gap setting between slots, and a
  list of the slots with what is hung in each. **Pick a booth under “Hang new
  artwork in” and the next original goes into that booth** — or drag one
  straight onto its wall, which says which booth as well as which wall.
  Selecting a work that hangs in another booth moves the picker to it, and
  Artwork → Placement → Booth moves a work between booths.
  - `src/row.js` is the model: a row is a list of slots, each a booth or a
    space, exactly one of them home, and `rowLayout()` is the one place that
    answers where each one stands — in inches along X from the centre of the
    home booth, which is the origin the scene already draws around.
  - **Every booth in a row is this booth's size**, deliberately. The walls,
    their heights and the panel module are one set of measurements in this
    project, so a work hung in a row booth is measured against the same
    `booth.walls` as one hung at home and needs no new arithmetic and no new
    validation. A row of differently-sized booths would need a booth to be a
    document of its own, and that is a different feature.
  - `booth.row` and `art.booth` are both optional, so every older backup
    loads as the single booth it described. Removing a booth removes the
    artwork hung in it — the alternative is works on walls nobody draws.
  - The decorative booths either side (Surroundings → Surround with other
    booths) are left out while a row is drawn, so the aisle is only the one
    that was laid out. The one *behind* stays: a row says nothing about what
    backs onto it.
  - The hanging guide is this booth's build sheet and excludes the rest of
    the row, which is why `hangingGuide` filters on `!a.booth`.
- **Merged and deployed 2026-09-21, earlier the same day:** uploading files an
  original instead of hanging it, fixture brightness as a percentage, fast
  edit arming itself on a double-tap, and the four things that made a booth
  full of uploaded photographs slow. All four came from a 2014 iMac in Chrome
  and from a phone; the four bullets below are that work. **Nothing is sitting
  unmerged on a branch.**
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

1. **Show Hub links (ninth and tenth rounds), live.** Both deploys were
   confirmed through the Cloudflare connector: the live Worker's code is the
   tenth round's `worker/index.js` (`sweep`, the key routes), so the build
   with the two rate-limit bindings and the cron went through. Not seen: the
   Worker's Triggers tab showing `17 4 * * *`, and the first sweep's run
   (Workers → booth-studio → Logs, 04:17 UTC). Then, by hand: share a booth from one browser and
   open the link in another; change the booth and **Send this booth to it**;
   reopen the link; **Delete link**; reopen it (it should say it could not
   be opened). Still the owner's:
   (a) **real Pro gating** needs accounts — until then a Lite user is only
   *shown* previews, and anyone can fetch an original by its URL;
   (b) the limits chosen (6 links and 120 images a minute per address, 200
   MB a link, 24 h to upload, 180 days) — each is one constant in
   `worker/index.js` or `wrangler.jsonc`;
   (c) whether the keys should live somewhere that survives clearing site
   data — that needs accounts too.
1. **Show Hub v0 (eighth round), on the real machine — and with a real
   promoter.** Send a booth from one browser, import it in another (or a
   private window) onto a floor booth — by Import and by dropping the file on
   a booth. Is Export → Send to the show where an exhibitor would look? Is
   the file still wanted now that there is the link? If it is, and a booth
   with twenty full-size photographs (100 MB+) bites, the file could carry
   the 2048 px preview instead of the original — the owner's choice: the
   promoter then has a lighter, softer booth. The real question is demand:
   do promoters want exhibitors' designs on their floor? Also open: the
   pitch deck at `/pitchdeck/`, by eye.
1. **The seventh round (2026-09-25), on the real machine.** Build `main`'s
   tip first (`window.BOOTH_BUILD`). Does the right-drag box feel right, and
   is ⌘ right-drag a comfortable pan on a Mac trackpad (two-finger click and
   drag with ⌘ held)? On a trackpad a two-finger scroll already pans the
   floor. Do the sub-tabs make the panels quicker to use, or should some
   panels group several small sections under one chip (Layout has twelve
   chips)? Is choosing the new section on a selection right, or does it jump
   when you did not want it to? Should the eight top tabs themselves be
   regrouped (say Design · Light & camera · Show floor · Export) — not done:
   the owner's words were about the tabs running long, which the chips
   answer without moving any tool. "Mirror so people can flip horizontally"
   was built as Flip horizontal / vertical for pieces on the show floor; if
   it meant flipping a booth's whole design left for right (walls, work,
   pedestals), or a cut-out person, that is a separate build — say which.
   Pan tool: is H the right key, and should the hand stay on after
   switching mode?
1. **The show floor, all four phases, by eye on the real machine.** Built
   2026-09-25 (see Now); none of it has been seen outside this sandbox.
   - **Phase 2, the 3D show:** does the overview frame the floor well, and
     is the dollhouse cut-away (near hall walls vanishing from outside) the
     right read? Are 8′ drapes and 3′ rails in `#465469` the right default
     look, or should drape colour be a floor setting? Is the walk's start
     (the aisle nearest the entrance) right, and does a walkthrough on a
     real plan go where a visitor would? 1.1 m/s — too slow? Labels: 40
     nearest, 22″ tall — right? And the frame rate on a big floor (a 1,000-
     booth block is under a dozen draw calls here, but swiftshader is not a
     laptop): if it stutters, the sprite pool and the booth's own shadow
     maps are the first suspects.
   - **Phase 3:** is "Open this booth" in the right place (the selected
     booth's Design section), and should the 3D show draw every *parked*
     design in full too, not only the open one? It would cost a booth build
     per linked design; today they are drawn light. Should templates also
     be savable from a floor ("Save this floor as a template", kept on the
     device like Quick start's templates)? Should applying a template drop
     the sales of numbers that are no longer on the floor?
   - **Phase 4:** the owner decides the provider (AI_EXPORT_PHASE.md weighs
     FLUX.2 pro) and how its key is held — which, by that document, means a
     Worker, identity and credits first; none of that is started. The pack
     is ready for it: `provider` in `src/ai-render.js` is the one line to
     set, and the protected pass is already laid back over what it returns.
     By eye: are the mask's classes the right ones for the model chosen,
     and is linear depth what it wants (some want inverse depth)?
   - **Phase 1, by eye, on the real machine:** does the drag feel like Lucid's?
     Is 8 px the right snap pull and 1′ the right default grid? Does a block
     of booths belong below the rest, or where the view is? Is Space them
     evenly the right answer to "standard spacing that can be broken", or is
     a per-aisle spacing setting wanted? Do promoters want corner and
     end-cap booths to show their open sides (today a booth's open front is
     only the side it faces)? On a phone, is the library in the panel
     reachable enough, or does it want a floating "+" over the floor?
     A block added below the rest can land outside the floor's size; the
     3D view shows it standing outside the hall. Should the floor grow to
     fit?
1. **The 2026-09-25 third and fourth rounds, on the real machine.** Check
   the arrows draw and that an export now shows the picture inside the
   frame while it renders. Keyframe the frame, give Start and End different frames, and
   export: does the frame's move read as intended, and should it have its
   own ramp rather than the camera's? Slide an end key in: is a held tail
   the right answer, or should the clip be trimmed? Is the batch panel too
   long inside the timeline window, especially on a phone? Is "link to the
   preset" the right behaviour, or should Use for every clip copy it?
1. **The cut-out people, by eye.** Do they read right in the booth — size
   against the walls, the woman's colours under the booth's light, the black
   silhouette against a dark wall? Is mirroring on facing welcome, or should
   the picture never flip? A cut-out seen from high overhead (Plan view) is a
   picture lying at an angle; if that reads wrong, Plan could draw a floor
   marker instead. The child, the pair and the wheelchair user (see Now)
   are silhouettes drawn here: do they read, and does the owner have better
   pictures? A new picture needs its box re-measured in `PEOPLE`.
1. **The roadmap, built 2026-09-24 — now it wants eyes.** Base, A, B, C, D
   and E are all on `main` (see Now). Every tool is tested in a real
   browser here; none has been used on the real machine or a real phone.
   In rough order of what to look at:
   - **The phone**: the scrolling toolbar and tabs, the fold handle, the
     walk pad, Select several. Is anything still out of thumb's reach?
   - **Smart guides**: is 2″ the right pull? Too sticky → lower
     `SNAP_RANGE`; too weak → raise it.
   - **Walk mode**: step size (6″, 2′ with Shift) and whether drag-to-look
     should be inverted.
   - **Clearance**: is 36″ the right line for art shows, or noisy? Are the
     outside-the-footprint and 4″ "pushed against" rules right?
   - **Elevations**: print one at 100% and check the 1′ bar with a ruler.
   - **.glb**: open an export in Blender or an AR viewer, and bring in a
     real model; the scale-to-height rule assumes the model stands upright.
   - **Hall planner and power sheet**: do promoters want mixed booth sizes,
     islands and corner booths? Are the wattages what shows ask for?
   **The Pro unlock itself is the owner's separate plan** — see the base
   bullet in Now; `src/tier.js` is the one place it plugs in. What was
   proposed, for the record: The tool
   ideas, in priority order: snap and smart guides; a floor-plan underlay
   scaled by two clicks; saved views; multi-select with align and
   distribute; tags (visibility groups); walk mode; a draw-a-box / pull-up
   tool; elevations printed to scale; a hall planner of numbered booths;
   clearance checks; a power and rentals sheet; `.glb` import and export.
   Proposed route: first a small capability layer (`src/tier.js`: one
   `can(feature)` check, a lite/pro switch stored per browser, a lock badge
   on pro controls) and a mobile pass over the existing panels, then the
   tools in batches of two or three per session, each gated through `can()`
   from the day it lands. Local-first rules out real licensing: without a
   backend, pro can only be an honour-system unlock or a signed key checked
   in the browser, and that decision is the owner's.
1. **Tool search and the third round, on the real machine.** Does the
   search find what you type, by the name you would type? Its words come from
   the panels' own headings, labels and buttons, so a tool called something
   other than what people call it is a label worth renaming, or a synonym
   worth adding in `rankTools`. Is a slight stutter still there with shadows
   refreshed every other frame? The smaller shadow map during a drag is now built
   (see Now); past it, fast edit is the answer. Three labels are shared by several controls in one
   section (each perimeter wall's Width and Height, under Display walls): the
   search lists one of each and opens the first.
1. **The second 2026-09-25 round, on the real machine.** Do the frame's
   handles grab easily (14 px, 24 px on touch) and does an edge drag
   switching the frame to Custom surprise anyone? The custom size is one
   size shared by the still and the clip — reshaping the clip's frame
   reshapes a still set to Custom too; if that bites, give each its own.
   Is Play from the playhead right, or should Play always start from 0?
   Is the stamp readable on a phone at 10 px?
1. **The 2026-09-25 round, on the real machine.** Build `main`'s tip first
   (`window.BOOTH_BUILD`). Then: does the frame guide read as "this is the
   shot" — the dimming is now 80% (see Now) — and should it show on every tab rather
   than only Video / Export / the timeline? Export a 16:9 clip from a narrow
   window and check the file matches the guide. Is the glide the look that
   was meant, and is a 20% ramp (`GLIDE_RAMP`) too quick or too slow? Does
   Auto timing feel even? Does a figure pick on double-click where you
   expect — a cut-out's pick is its whole picture rectangle, transparent
   corners included? Should a figure drag in the viewport like a pedestal?
1. **Lock, lift and the timeline, on the real machine.** Is the padlock
   where you would look for it? Should free-standing walls lock too (not
   built: only floor pieces)? Does the timeline read at a glance, and are
   the diamonds easy to grab with a thumb? (Lift and the timeline were
   answered 2026-09-25 — see Now; the lock is still open.)
1. **Tool shortcuts.** *Approved as drafted 2026-09-25.* Rename in
   `SHORTCUTS` whenever a name does not stick. Voice search is undecided
   (see Now for why it was not built).
1. **The 2026-09-23 work on the real machine, and the round that answered
   it.** *Answered 2026-09-23 — see the third-round bullet in Now; kept here
   for its reasoning.* The first report is in: **speed "much better"**, and five asks,
   all answered and **deployed the same day** (see Now). **Check
   `window.BOOTH_BUILD` shows `main`'s tip before judging any of it** — a
   Cloudflare build takes a few minutes. Then, on the real machine:
   - **Is a drag with fast edit off still smooth?** It is the one cost this
     round added: the shadow maps now refresh every drawn frame of a drag so
     the cast shadow follows the work (1024² per spotlight and the fill, 512²
     per bar head at High detail). If it stutters, fast edit is still the
     answer, and the next lever is refreshing every other frame, not holding
     them until release again — that is the bug that was reported.
   - **The drop shadows, by eye.** Is the Photoshop mapping right — 20 px to
     the inch, so the screenshot's 10 px / 16 px became 0.5″ / 0.8″? At
     whole-booth zoom that shadow is subtle; up close it reads. Are the second
     shadow's defaults (55%, 1.5″, 10%, 2.5″) "stronger" in the way that was
     meant? Every number is a slider; `SHADOWS` in `src/dropshadow.js` is
     where the defaults live, and a booth nobody has tuned follows them.
   - **Does the angle dial feel like Photoshop's?** Drag round it, or focus it
     and use the arrows (Shift for 15°). Use Global Light ties both shadows to
     `booth.shadowAngle`; switching it off keeps the current angle as the
     shadow's own, which is Photoshop's rule.
   - **Hide.** A hidden free-standing wall takes its art out of the picture,
     and the show pack's **inventory still lists that art** — the same as a
     switched-off perimeter wall always has. If a hidden wall's work should
     drop out of the inventory too, that is a one-line filter in
     `inventory()`, and it should probably apply to switched-off walls as
     well. Artwork itself has no eye yet; it was not asked for, and hiding a
     work raises the same inventory question.
   - **The Preview menu in the status bar**: is it where you would look, and
     does "drawing at 2×" mean anything to someone who is not a graphics
     programmer? It could say "sharp / softer" instead.
   - Still open from the first round: **does Auto settle somewhere
     sensible?** (raise `SLOW_FRAME_MS` if it lands on 1 where Balanced looked
     fine; the menu now shows the rung, so this is readable at a glance);
     **does anything fail to appear until the mouse moves?** (missing from
     `watchForChanges()`; look after a 15 s pause); **are the light bar's
     shadows missed in the preview?**; and **the furniture shapes, sizes,
     `STARTER_PLACES` and the show pack's checklist** — all judgement.
1. **Nobody has looked at any of the 2026-09-21 finishing work.** All of it is
   on `main`. Judgements that need a browser and a pair of eyes:
   - ~~The drop shadow's three defaults~~ — answered on the real machine:
     it was asked to work like Photoshop's, and now does. See item 1.
   - ~~Whether a vertical or square export frames the booth usefully.~~
     Answered 2026-09-25 by the frame guide: the viewport now outlines the
     frame and the file is exactly what is inside it, so a vertical clip is
     composed to its own shape (a zoom out gives it more aisle).
   - **Whether careful rendering actually fixes the glitches**, and whether
     doubling the render is a price worth paying by default on a 2014 iMac.
     It is a checkbox; off is one click.
   - Whether seven swatches and Previous are the right two controls, and
     whether shift-click is discoverable enough for forgetting one. The
     tooltip says so and nothing else does.
   - Whether the edge finish being inherited by the next work is welcome or
     surprising. It is the last one *set*, which is not the same as the last
     one hung.
2. **Look at the art-show booth on the live site and set Diffusion.** This is
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
3. **Two reports could not be reproduced, and need numbers from the machine
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
4. **The two shipped backdrops are 1024×512 and read soft.** This is the one
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
5. **H.264 output is unverified on real hardware.** Open Chromium builds ship no
   H.264 *encoder*, so every sandbox run exercises the VP9 fallback instead.
   That does prove the whole encoder-to-muxer pipeline with real encoder bytes,
   and mp4box.js validated the container — but nobody has opened an
   `avc1`/`avcC` file from Chrome or Safari in QuickTime. If a clip will not
   play, start here.
6. **Unverified on real hardware** — things no one has confirmed by eye,
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
   - **Nobody has looked at an art-show booth.** See item 2 — it is the whole
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
7. **A `home` HDRI** is still missing — an interior with windows on one side.
   That preset falls back procedurally until someone downloads one.
8. **Nobody has looked at the four things in the earlier 2026-09-21 merge.**
   All of them are answers to reports from a real browser; none has been seen
   there since:
   - Whether uploading and then tapping reads as obviously as it should. The
     upload toast says the files went to the library and the card says "Tap to
     hang it", but the gesture is new and the old one hung things for you.
   - Whether 50 is right for fixture brightness now that the slider means
     something different, and whether the `Set brightness to 50` note under an
     old booth's stretched slider reads as an offer rather than a warning.
   - Whether fast edit arming itself on a double-tap is welcome or startling.
     It is the start of a drag, so it should be invisible — but the shadows go
     as it comes on, and that is a visible change nobody asked for in that
     moment.
   - ~~Whether any of the speed work is enough on the 2014 iMac.~~ Answered
     2026-09-25: "imac speed seems good". See item 10.
9. **Nobody has looked at the ground picker or the artwork sliders.**
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
10. **Is it actually faster now?** *Answered 2026-09-25: yes, "imac speed
   seems good". Kept for the levers below if it ever regresses.* Reported still slow on a 2014 iMac in
   Chrome — and, tellingly, **fast with the sample panels and slow with
   uploaded photographs**. That last part was the diagnosis: four separate
   places treated a 25 MB base64 original as free. The undo history and every
   save stringified all of them on every edit, every re-render of the library
   and the inspector pointed `<img>` tags at them, textures decoded them whole
   before shrinking them, and IndexedDB was handed the lot 350 ms after each
   edit. All four are fixed on the branch — see Now — and **Fast edit** is
   still there on top of that, now arming itself on a double-tap and no longer
   costing a full re-render to switch on.

   What is **not** yet known is whether it is enough on that iMac, or on a
   phone. If a drag still stutters with fast edit on, the remaining candidates,
   in order: the backdrop's second pass (deliberately left alone, because
   skipping it reframes the hall mid-gesture and a picture that moves under
   your hand is worse than a slow one), then the figures, then dropping
   `castShadow` on the light-bar washers permanently rather than only in fast
   edit. Below that: a click still rebuilds the library and the inspector as
   HTML strings, which is now cheap but not free, and `Export → Preview
   quality → Efficient` is worth trying on a 2014 machine.
11. **Nobody has looked at a booth row, at the fast edit lock, or at an
   uploaded photograph the right way up.** All three are on `main`. Judgements
   waiting on a live site:
   - Whether a row of booths reads as an aisle at the default 24″ gap, and
     whether `+1 booth` / a typed ten / `+ space` is the right set of three
     controls or one too many.
   - Whether picking the booth under “Hang new artwork in” is obvious enough,
     given the artwork lands somewhere the camera may not be pointing. The
     toast names the booth; the camera does not move to it, deliberately —
     but moving it there is the obvious next refinement if it reads as
     nothing having happened.
   - Whether auto fast edit is welcome. It now goes off as well as on, so the
     shadows come back the moment you click away from a work — a visible
     change nobody asked for in that moment, which is exactly what the lock
     is for.
   - **Whether uploaded photographs are the right way up.** The fix is pinned
     by tests at both ends, but the bug itself was invisible to every test in
     this repository until it was reported, and only a real browser sampling
     a real JPEG can say it is gone. This is the first thing to check.
   - A row booth is drawn plain: three walls, this booth's colour, no light
     bar, no seam posts, no fabric weave. Whether that reads as a neighbour
     or as an unfinished version of your own booth is a judgement.
12. **Figures are stylised mannequins.** No faces, no clothing, mid-grey. If
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
- **Since 2026-09-25 the Worker has code** (`worker/index.js`, `/api/*` only)
  and an **R2 binding to `booth-studio-shares`**, which must exist or the
  deploy fails. `npx wrangler deploy --dry-run --outdir /tmp/wd` after a
  build checks the config without credentials and lists both bindings.
- The footer reads `v0.1.0 · <time> UTC · <commit>`, hidden under the mobile
  breakpoint — use `window.BOOTH_BUILD` on a phone. **Check it before
  believing a fix did not ship**: a merge was reported as not working twice,
  and both times the build simply had not finished.

## Testing

```sh
npm ci
npm test                 # 413 Node tests
npm run build
npm run test:view        # 34 suites (tools2, hub and share included): city, lighting, HDRI, textures, ground library, video, timeline, people, panels, responsiveness, art show, booth row, finishing, measuring, furniture, arranging, quick start, show pack, tool search, tier, guides, views, plan, box, hall, frame, batch, show floor, show in 3D, linked booths, AI render, first-look tools, Show Hub, share links
BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium node tools/perf-probe.mjs   # what an edit costs, before/after numbers
npm run test:browser     # 25 end-to-end checks
BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium node tests/wall-assets.mjs
```

**`tests/wall-assets.mjs` fails at line 120 (sideways scroll at 820 px on
the Artwork tab), and did before the sixth round** — checked on `2f84454`,
the commit before it. Not caused by the show floor; not yet looked into.

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

**And do not run two browser suites at once.** The sandbox has four cores and
swiftshader draws on all of them: with a second suite running, a 4096 px PNG
export or a 3× frame passes Playwright's 30 s timeout and the suite fails
with a `TimeoutError` that is not a bug — found on 2026-09-24, where
view-responsive and e2e both failed that way and both passed alone. The way
to keep working while the whole chain runs (it takes about 25 minutes now) is
a snapshot: `git worktree add ../bs-test HEAD`, `cp -al node_modules
../bs-test/` (hard links — a symlink puts the fonts outside vite's allow
list), run the chain there in the background, and edit here without running
anything else in a browser until it is done.

## Rules that are easy to break

- **Never set `.hidden` on an SVG element.** Only HTML elements have the
  property; on SVG it is a silent expando and the attribute stays. Toggle
  the attribute (`toggleAttribute("hidden", …)`). The show floor's selection
  box was invisible for a whole round because of this.
- **A test that clicks inside a panel sees every section only because
  automation starts the sub-tabs on All** (`navigator.webdriver`). A test
  that sets `booth.sectionTabs` to `"on"` must pick the chip before
  clicking a control in another section.
- **The live loop draws on demand.** Anything new that changes the picture
  must reach `invalidate()` — through a wrapped scene method, an input event,
  or a load `watchForChanges()` knows about. Otherwise it shows up late.
  And do not draw synchronously to make up for it: `applySelection()` did,
  and it was a third render per click.
- **A piece someone adds is hidden with `hidden: true`, never a new list.**
  Pedestals, furniture, free-standing walls and figures all carry it and are
  read through `isShown()`. Anything new that draws, packs, measures or lists
  them filters on it; a panel gets it for free through `wallSpec().enabled`.
- **Do not dispose a material in the booth group before its replacement has
  drawn.** That is what `this.retired` is for; disposing early recompiles
  every shader and was most of what an edit cost.
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
- **An asset may belong to a design that is not open.** Since phase 3 of
  the show floor, `p.hall.designs` holds whole booth designs that name
  images in `p.assets`. Anything that deletes an asset because "nothing
  uses it any more" must also ask `assetInDesigns(p, id)` (src/linked.js);
  the five places that do so today already do. And nothing may copy a
  design's keys (`DESIGN_KEYS`) out of `p` without putting them back: the
  live design is simply whichever one is in `p.booth` / `p.art` / …
- **The 3D show is placed round the open booth, not the other way round.**
  The booth is built at the world origin exactly as always and the show's
  group is turned and moved so the open booth's piece lands there
  (`worldFrame`). Moving the booth into the show instead would move its
  lights, its shadow cameras (fitted to ±5 m) and every picker's
  coordinates.
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
  `tests/environment.mjs` already carries, for the same reason.
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
- `src/framing.js` — the shape of a delivered file: one pure function that
  answers for a still and a clip alike, and why the camera is told about it.
- `src/dropshadow.js` — the two drawn drop shadows on Photoshop's five
  controls, the exact blurred-rectangle maths (and its GLSL twin), and how
  the first version's `booth.dropShadow` is still read. `shadowMaterial` /
  `placeShadow` / `updateShadows` in `src/scene.js` draw them.
- `src/swatches.js` — the seven saved colours and the Previous button.
- `src/adaptive.js` — Auto preview quality's rule. `startLoop` / `tick` /
  `invalidate` / `watchForChanges` in `src/scene.js` are the on-demand loop;
  `disposeGroup` / `releaseRetired` keep shaders across a rebuild.
- `src/measure.js` — tape and plan-dimension arithmetic; `refreshGuides` and
  `placeAnnotations` in `src/scene.js` draw them.
- `src/furniture.js` — the furniture shapes; `FURNITURE` in `src/model.js`
  is the list and its default sizes.
- `src/arrange.js` — even spacing, the 60″ hang line, arrow nudges.
- `src/quickstart.js` — Quick start and user templates.
- `src/showpack.js` — the show pack: floor plan, inventory, checklist.
- `src/toolsearch.js` — tool search's ranking; the index is built in main.js
  from each tab's `inspectorHTML()`.
- `src/tier.js` — Lite and Pro: the one table of Pro features and `can()`.
  `gated` / `proLock` and the action gate in `src/main.js` use it.
- `src/hall.js` — the hall planner (layout, totals, map, CSV);
  `src/show.js` — the show floor's pieces: kinds, the library, validation,
  snapping, blocks of booths, spacing, renumbering, the map's SVG;
  `src/show-editor.js` — the show floor's drawing board (gestures only);
  `src/show-scene.js` — the show in 3D: the plan as instanced parts, the
  world placed round the open booth, the walk's start and the walkthrough
  (`setShow` / `stageShow` / `setShowView` in `src/scene.js` draw it);
  `src/linked.js` — opening one floor booth as a full design, and why the
  storage is shaped as it is; `FLOOR_TEMPLATES` in `src/show.js`;
  `worker/index.js` — the one backend: booth share links on `/api/*`, R2
  `booth-studio-shares`; `src/share.js` — its browser half;
  `src/booth-file.js` — Show Hub v0: one booth design as a file, sent by
  an exhibitor and imported onto a floor booth by the promoter;
  `public/pitchdeck/index.html` — the Pro pitch deck, served at
  `/pitchdeck/`;
  `src/ai-render.js` — the AI-render hook: the scene in words, the pack,
  the mask's legend, the protected pass and the provider-less adapter
  (`renderPasses` / `applyPass` in `src/scene.js` render the passes);
  `src/power.js` — the power and rentals sheet.
- `src/clearance.js` — clearance geometry; `src/elevations.js` — the
  to-scale drawings. `buildUnderlay`, `buildModels`, `exportGLB` and the Box
  tool (`setDrawingBox`) are in `src/scene.js`.
- `src/views.js` — saved views, tags and walk mode's rules; `applyTags` and
  `startWalk` / `walk` / `stopWalk` in `src/scene.js` do the work.
- `src/guides.js` — smart guides' snapping arithmetic; `showSnap` in
  `src/scene.js` draws it. `src/align.js` — align and distribute.
- `FUTURE_BUILD.md` — requested, deliberately not started. Currently empty.
- `docs/HDRI-ASSETS.md`, `docs/TEXTURE-ASSETS.md` — adding asset files.
- `AI_EXPORT_PHASE.md` — the paid AI export's server side, still design
  only; its client half (the passes, the protected artwork) is
  `src/ai-render.js`. Read both before choosing a provider.
- `docs/ORIGINAL-HANDOFF.md` — historical; ignore unless you need old
  requirements.
