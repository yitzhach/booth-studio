# Booth Studio — handoff

Start a new chat with **this file**. It is enough to start from: what is
true now, what is next, the rules, and which file in `docs/` to read before
touching what it covers.

Artist OS Booth Studio: measured 3D art-show booth planning in the browser.
Extend it; do not rebuild it.

This file is what is true now, what is next, and the rules. Since 2026-10-21
(ROADMAP 1.1) everything else it used to hold lives beside it in `docs/`,
moved there verbatim: `docs/HISTORY.md` is every round, newest first — what
was built, why, and how it was tested; `docs/DECISIONS.md` is the owner's
answers, numbered and dated; `docs/OPEN-CHECKS.md` is the by-eye checks from
earlier rounds; `docs/STUDIO-PLATFORM.md`, `docs/DIAGNOSING.md` and
`docs/LESSONS.md` are the reference sections that used to close this file.
A round adds its bullet at the top of `docs/HISTORY.md`, any answer the
owner gave to `docs/DECISIONS.md`, and changes **Now** here only where what
is true has changed.

## Now

- `CLAUDE.md` is loaded automatically at the start of every session. It holds
  the owner's standing instruction — **reports in chat are extremely concise,
  grammar sacrificed for concision, abbreviations and symbols welcome** — and
  the rules that bite. It does not need to be asked for again. That rule is
  about chat only: code comments, commit messages and this file stay in full
  prose, because a cold session has nothing else to read.
- **Where it is.** Repository https://github.com/yitzhach/booth-studio;
  production https://booth-studio.bobdylan2000.workers.dev, built and
  deployed by Cloudflare's Git integration from `main` — merging is the
  deploy, and every other branch gets a preview (Deployment, below).
  `window.BOOTH_BUILD`, and the footer on a computer, name the deployed
  commit. The latest round is the top bullet of `docs/HISTORY.md`.
- **What it is.** One project open at a time: a booth's footprint, its
  walls and free-standing walls, the artwork hung on them to the inch (with
  frames, edges and drop shadows), furniture, pedestals and people for
  scale, its light (spotlights, an art-show light bar, HDRI environments and
  four looks), and pictures of it — PNG, MP4 camera moves and a keyframed
  timeline, the hero set, a hanging guide, elevations to scale, the show
  pack, `.glb`. Three modes in the toolbar: 3D booth; Photo, which places
  the artwork on a photograph of a real booth; and Show floor. Eight
  inspector tabs: Artwork, Layout, Art show, Walls, Lighting, Video, Show
  floor, Export.
- **Who it is for (Rev 1, 2026-10-19).** A first visit asks "What are you
  planning?": *My booth* (the Artist workspace: Artwork, Layout, Walls,
  Lighting, Export, and Art show for an art-show booth), *A show floor* (Show
  organizer: Show floor, Layout, Export) or *Every tool* — the app as it
  always was, and what anyone who already had a project gets without being
  asked. **More** beside the tabs shows the rest; Workspace in the header
  switches (`src/roles.js`). Lighting → the four looks and **Make it
  beautiful** (an even hang on the 60″ line, the lights aimed at the work),
  and Export → **Hero set** (four 4096 px pictures and a 15 s orbit), are
  `src/polish.js`.
- **The show floor.** An organizer's plan of numbered booths, drawn and
  snapped like Lucid: blocks of booths, aisles, exhibitors and sales, floor
  templates, the hall map and the power and rentals sheet (`src/show.js`,
  `src/show-editor.js`, `src/hall.js`, `src/power.js`); the whole show in 3D,
  walked and recorded (`src/show-scene.js`); any floor booth opened as a
  full design (`src/linked.js`).
- **Local-first, and two backends.** Signed out, a project lives in this
  browser's IndexedDB (`src/storage.js`), a backup is a file, and the app
  works with no network, as it always has. Two server parts, both approved
  by the owner: **booth share links** (2026-09-25: `worker/index.js` on
  `/api/*`, the R2 bucket `booth-studio-shares`, `src/share.js` in the
  browser) and **studio sign-in and sync** (2026-10-05: `/v1/*` forwarded by
  service binding to `studio-api`, which lives in `yitzhach/Art-Talk-Back`).
  Signed in, a project is kept in the studio as a *placement* and opens on
  any signed-in device. How that works, and its rules: `docs/STUDIO-PLATFORM.md`.
- **The assistant, signed in.** `src/studio-assistant.js` is the studio
  assistant's panel: chat, pictures (📷) and the booth as it looks now (🖼).
  It builds and changes booths and show floors through `src/scene-ops.js`,
  which studio-api runs as this app's own code (`npm run bundle:scene`,
  vendored in Art-Talk-Back and compared byte for byte by both repositories'
  CI) — the looks, Make it beautiful and the light levels included
  (Art-Talk-Back D-081). It knows the app's map and takes you to any
  control (D-072, D-075), and the welcome offers "describe it, and the
  assistant builds it". A card comes before any change; Undo after it.
- **Offline, and installable (2026-10-20).** `public/sw.js` keeps the page,
  the build's files and each texture as it is used, so once opened the app
  opens again with no signal; `public/manifest.webmanifest` makes it
  installable. `OFFLINE` in `src/main.js` is the off switch;
  `docs/DIAGNOSING.md` says how to rule the worker out, and how to remove it
  at once.
- **Keeping the work safe.** Export → Keep your work (`src/keep-safe.js`):
  whether the browser keeps this device's copy, the space it uses, the last
  backup, the studio's copy, and a reminder after 30 days without a backup.
  Export → Something wrong? → **Copy a problem report** (`src/report.js`):
  when the owner reports a bug, ask for it first.
- **Lite and Pro.** `src/tier.js` is the one table of Pro features and
  `can()` the one question; every browser starts on Pro, at the owner's
  word, until a lock is decided. There are no payments anywhere. **Render
  with AI** (`src/ai-render.js`) downloads its pack; its provider is `null`
  until the owner picks the service and its spend (Next).
- **How it is built and checked.** Vite and three.js, no framework.
  `src/main.js` (about 7,200 lines, most of it inside `boot()`) builds the
  panels and their actions; `src/scene.js` (3,500) draws the booth. Schema 1
  is forever: `validateProject` in `src/model.js` opens every backup ever
  written. CI (`.github/workflows/ci.yml`) runs `core` (the node suites, the
  build, the vendored SDK and scene checks, two devices against studio-api,
  the end-to-end checks, offline), `lint` (ESLint and the type check) and
  `views` (44 suites in four shards); `booth`, the required check, needs all
  three. Claude merges its own pull requests once they are green, and
  `node tools/verify-deploy.mjs` then checks production. How sessions work:
  `docs/WORKFLOW.md` and the skills in `.claude/skills/`. Where the product
  is going: `ROADMAP.md`.

## Next

What waits on the owner, or on a person with a device, newest first. The
by-eye checks from the rounds before 2026-10-19 — the art-show booth's
Diffusion first, then the show floor, the Video tab, the roadmap's tools,
the speed levers, Show Hub's limits and Pro gating — are in
`docs/OPEN-CHECKS.md`, verbatim: none needs a session, and each says what to
look at and what to change if it reads wrong.
1. **2026-10-20: the owner's to try, on real devices (no session can).**
   - On an iPad, portrait and landscape: the inspector's tabs scroll
     sideways inside the right-hand panel now, instead of the whole page
     (booth-studio#34). Is that findable, or should the labels go and leave
     icons only?
   - On the iPad, signed out, with a booth holding your own images: Export →
     Keep your work. Does Safari grant **Ask the browser to keep it**, and is
     the booth still there after a week without a visit? Does the backup
     reminder come at a sensible moment?
   - Signed in, in the assistant: "make my booth look good for a jury photo"
     and "make it a bit warmer". Does it reach for `make_beautiful` and
     `set_lighting` (Art-Talk-Back D-081), and do the cards read right?
   - Lighting: the look the booth is in is now marked until a value is
     changed by hand. Clear enough?
   - In the assistant, the 🖼 beside the 📷: attach the booth and ask "how
     does this look for a jury photo?" Is the critique useful, and does it
     offer to make the changes it suggests?
   - When anything goes wrong: Export → Something wrong? → **Copy a problem
     report**, and paste it into the message. It names the build first.
   - Offline: open the live site once on the iPad (and on a phone), then
     turn on airplane mode and open it again — does it come up with your
     booths? Then Share → Add to Home Screen, and open it from there.
2. **Rev 1 (parts A, B and C) is merged and live (2026-10-19), untested by
   a person.** The owner said merge now and test later. This and item 1
   are where the next session with the owner starts. His checklist, on the live site in a private window (a
   fresh browser is a first visit):
   - The welcome: do the three cards read right? Pick My booth: does Quick
     start follow, and are Artwork, Layout, Walls, Lighting, Export the right
     five tabs? Does More beside the tabs find the rest?
   - Pick A show floor (Workspace in the header): Layout, Show floor, Export.
   - Lighting → Make it beautiful on the example booth: hang and aim as you
     would have done them? Try each of the four looks.
   - Export → Hero set: are Front, Three-quarter, Aisle and Close-up the
     pictures a jury or a promoter wants, and does the 15 s orbit play?
   - On the phone: the welcome, the tabs and More, Layout → Project →
     Workspace.
   - Signed in: Workspace → describe a booth → does the assistant build it?
   Anything wrong is one table to change: `ROLES` in `src/roles.js`,
   `LOOKS` and `heroShots` in `src/polish.js`. If the welcome itself proves
   unwelcome, `needsWelcome` returning false turns it off without touching
   anything else. Then the Rev 1 gate: three artists and one promoter use it
   on their own devices; after that, Rev 2 (hosted Show Hub) needs the
   owner's yes on payments and server work.
3. **`ROADMAP.md` (2026-10-20) is the plan from here.** Its phase 0 is the
   checklist above plus five watched sessions, ten organizer conversations
   and the owner's decisions (who pays first, the name — "Booth Studio" is
   taken on the App Store — what stays free, error reports, payments, the
   image service). Its phase 1 (foundations) needs none of those. Done: 1.1
   (this file's split), 1.5, 1.7, 1.8 and 1.9; half done: 1.4 (every module
   in `src/` is type-checked but `main.js`, `scene.js`, `studio.js` and what
   the split moves out of `main.js`) and 1.6; begun: 1.2 (seams 1–5 of
   `MAIN_SPLIT_PHASE.md`: the share dialogs, the welcome, Keep your work
   and the templates, the looks and the image editor, the timeline dialog
   and the batch; seam 6, the show-floor panel, is next). Left for sessions: the rest of
   1.2 and 1.3 (split `main.js` and `scene.js`, which phase 2 waits on, seam
   by seam as that plan lists them) and the rest of 1.4, after them. 1.10's site-qa and Dependabot, 1.11 (the
   custom domain) and 1.12 (security headers, which change what the Worker
   sends) want the owner's yes first.
4. **The assistant panel on a phone (2026-10-07): built — see `docs/HISTORY.md`.** The
   owner's to try on his phone: Backspace, the two new doors, dragging,
   resizing and shrinking the panel. The Show Tracker's panel
   (art-show-tracker `tracker/studio-assistant.js`) got the same changes
   (art-show-tracker#5), and "take me to …" too (art-show-tracker#7). Both
   apps' take-me-to waits on the owner's "Deploy production assistant" run.
5. **Render with AI needs a provider (asked 2026-10-07).** `provider` is
   `null` in `src/ai-render.js`; the pack download works. Plugging one in
   needs an image model (not Claude) whose key sits behind a studio Worker
   route, never in this app: the owner picks the service and OKs the
   spend first.
6. **The studio, by hand (2026-10-05).** Everything in
   `docs/STUDIO-PLATFORM.md` is tested here with two browser contexts against a local
   studio-api; none of it has been used by a person. On
   `studio-booth-studio-staging` first, then production: sign in from
   Studio account on the Mac, Import my existing projects, then sign in on
   the phone and open the booth from Studio account. Is the avatar the
   right door (it is hidden on a phone; Export → Keep your work → Studio
   account & sync is the phone's)? Does "the project from before signing
   in stays here until you import it" read right? With a real booth of
   full-size photographs, how long does the import's upload take, and is
   "uploading images 3 of 40" in the footer enough to watch? The assistant
   panel (stage 2 of the plan, step 9c) waits on the first production
   deploy of `studio-assistant`, which is the owner's. Without it, an agent
   can already build and change booths and show floors through the studio
   API (seventeenth round); the panel adds the chat.
7. **The two shipped backdrops are 1024×512 and read soft.** This is the one
   open bug with a known fix. Both were prepped from Poly Haven's **1K** HDRI,
   and `tools/hdri-prep.mjs` will not stretch a backdrop past its source. Re-prep
   from the **4K** download and the softness goes:
   ```sh
   node tools/hdri-prep.mjs ~/Downloads/burnt_warehouse_4k.exr warehouse \
     --credit "Burnt Warehouse (Poly Haven)"
   ```
   **No agent session can do this** — polyhaven.com is refused by the sandbox
   egress proxy (the workers.dev hosts, refused before, are reachable since
   2026-10-20). It needs a human with a browser. `docs/HDRI-ASSETS.md` is step by step.
8. **H.264 output is unverified on real hardware.** Open Chromium builds ship no
   H.264 *encoder*, so every sandbox run exercises the VP9 fallback instead.
   That does prove the whole encoder-to-muxer pipeline with real encoder bytes,
   and mp4box.js validated the container — but nobody has opened an
   `avc1`/`avcC` file from Chrome or Safari in QuickTime. If a clip will not
   play, start here.
9. **A `home` HDRI** is still missing — an interior with windows on one side.
   That preset falls back procedurally until someone downloads one.

## Deployment

| Push target | Cloudflare result |
| - | - |
| `main` | **production** |
| any other branch | preview only (no service bindings: `/v1` answers 503) |
| Art-Talk-Back "Deploy staging" (`booth_ref`) | `studio-booth-studio-staging` |

- Merging to `main` is the deploy. There is no other step. **GitHub Actions
  runs CI only** (`.github/workflows/ci.yml`, job `booth`, since 2026-10-05);
  it never deploys — production is Cloudflare's Git integration alone.
- **Staging** is a separate Worker, `studio-booth-studio-staging`
  (`env.staging` in `wrangler.jsonc`), bound to `studio-api-staging`. Only
  Art-Talk-Back's manual "Deploy staging" workflow deploys it (input
  `booth_ref`: the branch). It has no share-links bucket, so `/api/*`
  answers 503 there. Test studio sign-in on staging, never on a branch
  preview.
- **The dashboard uploader cannot deploy this project** and will say so: it is
  a Vite app with a `wrangler.jsonc`, so it needs a build. Do not fight it.
- `wrangler deploy` with no credentials opens a browser login and hangs forever
  in a headless session. Needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
  and `CI=true`. Merging is easier.
- Account `8e38cda861b39784706d53545a0a435f`, worker `booth-studio`.
- **Since 2026-09-25 the Worker has code** (`worker/index.js`) and an **R2
  binding to `booth-studio-shares`**, which must exist or the deploy fails.
  **Since 2026-10-05 it also has a service binding `API` → `studio-api`**,
  which must exist too (it does: the platform's production API). `npx
  wrangler deploy --dry-run --outdir /tmp/wd` after a build checks the config
  without credentials and lists the bindings; add `--env staging` for
  staging's.
- The footer reads `v0.1.0 · <time> UTC · <commit>`, hidden under the mobile
  breakpoint — use `window.BOOTH_BUILD` on a phone. **Check it before
  believing a fix did not ship**: a merge was reported as not working twice,
  and both times the build simply had not finished.

## Testing

```sh
npm ci
npm run lint             # ESLint, eslint.config.js: seconds; CI runs it first
npm run typecheck        # TypeScript reading the JSDoc: the scene bundle (tsconfig.json), the page (tsconfig.app.json)
npm test                 # 526 Node tests
npm run build
npm run test:view        # 44 suites (tools2, hub, share, roles, polish and wall-assets included): city, lighting, HDRI, textures, ground library, video, timeline, people, panels, responsiveness, art show, booth row, finishing, measuring, furniture, arranging, quick start, show pack, tool search, tier, guides, views, plan, box, hall, frame, batch, show floor, show in 3D, linked booths, AI render, first-look tools, Show Hub, share links
BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium node tools/perf-probe.mjs   # what an edit costs, before/after numbers
npm run test:browser     # 25 end-to-end checks
npm run test:offline     # the built app opens with the network cut (after npm run build)
STUDIO_PLATFORM=../Art-Talk-Back BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium node tests/two-devices.mjs   # 52 checks; after npm run build (see `docs/STUDIO-PLATFORM.md`)
node tools/verify-deploy.mjs   # after a merge: waits for production to serve the commit, then checks the page starts
```

`npm run lint` is ESLint's recommended rules over `src/` (not `src/vendor/`),
`tests/`, `tools/` and `worker/`; `eslint.config.js` says which two are
loosened and why. `npm run typecheck` is TypeScript reading the JavaScript
as it is (`checkJs`, no emit, not strict) from `src/scene-ops.js` and
everything it imports — what studio-api runs — with the JSDoc as the types
and a Worker's globals, so a `document` in that code fails it; then, with
`tsconfig.app.json`, every other module in `src/` against a browser's
globals, but `main.js` and `scene.js` (until their split, ROADMAP 1.2 and
1.3) and `studio.js` (it imports the vendored SDK, which has no types). One
run reports both configs' findings. Both run in
CI's `lint` job. The view suites run in CI as four shards at once (`views`),
`tests/view-wall-assets.mjs` among them; `booth` is green only when every
job is. How each came to be is in `docs/HISTORY.md`, 2026-10-20.

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
- Local-first: signed out, the app works with no network, as it always has.
  No payments, and no AI calls except through the studio platform. (Until
  2026-10-05 this read "no accounts, backend, payments, sync or live AI
  calls"; the owner replaced it when they approved the studio — CLAUDE.md.)
- Do not modify the separate `yitzhach/commission` repo.

## Read map

- `docs/HISTORY.md` — every round, newest first: what was built, why, how it
  was tested and what the owner said. Search it by date or by a file's name.
- `docs/DECISIONS.md` — the owner's answers, B-001 onwards, dated, each with
  where it was built.
- `docs/OPEN-CHECKS.md` — the by-eye checks from the rounds before 2026-10-19.
- `docs/STUDIO-PLATFORM.md` — sign-in and sync through studio-api: where each
  part lives, the rules that bite, and the two-device test.
- `docs/DIAGNOSING.md` — "the texture isn't showing" and "the video won't
  play": what was ruled out, and what to ask for first.
- `docs/LESSONS.md` — things learned the hard way, and why the code is the
  way it is.
- `ROADMAP.md` — the phases to a product people pay for, ticked as work lands.
- `docs/WORKFLOW.md` — how a session works here, and the skills in
  `.claude/skills/`.
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
- `src/polish.js` — looks, Make it beautiful (even hang, aimed lights) and
  the hero set's cameras; `applyEnvPreset` is the Environment picker's rule.
- `src/roles.js` — workspaces: which tabs and toolbar tools each shows, and
  whether the first visit's welcome is due. `applyRole` in `src/main.js`.
- `src/hall.js` — the hall planner (layout, totals, map, CSV);
  `src/show.js` — the show floor's pieces: kinds, the library, validation,
  snapping, blocks of booths, spacing, renumbering, the map's SVG;
  `src/show-editor.js` — the show floor's drawing board (gestures only);
  `src/show-scene.js` — the show in 3D: the plan as instanced parts, the
  world placed round the open booth, the walk's start and the walkthrough
  (`setShow` / `stageShow` / `setShowView` in `src/scene.js` draw it);
  `src/linked.js` — opening one floor booth as a full design, and why the
  storage is shaped as it is; `FLOOR_TEMPLATES` in `src/show.js`;
  `worker/index.js` — the Worker: booth share links on `/api/*` (R2
  `booth-studio-shares`; `src/share.js` is their browser half), and `/v1/*`
  and `/assistant/*` forwarded to the studio (`docs/STUDIO-PLATFORM.md`);
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
- `FUTURE_BUILD.md` — ideas asked for and deliberately not started, each now
  placed in `ROADMAP.md`; Show Hub's v0 and phase 1 came from it and are built.
- `docs/HDRI-ASSETS.md`, `docs/TEXTURE-ASSETS.md` — adding asset files.
- `AI_EXPORT_PHASE.md` — the paid AI export's server side, still design
  only; its client half (the passes, the protected artwork) is
  `src/ai-render.js`. Read both before choosing a provider.
- `src/studio.js`, `src/placement.js`, `src/studio-session.js` — the studio
  platform: sign-in and sync (see `docs/STUDIO-PLATFORM.md`); `tests/two-devices.mjs`
  — its gate. The platform itself is in `yitzhach/Art-Talk-Back`.
- `docs/ORIGINAL-HANDOFF.md` — historical; ignore unless you need old
  requirements.
