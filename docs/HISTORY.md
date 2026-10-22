# Booth Studio — history

Every round, newest first: what was built, why, how it was tested, and what
the owner said about it. (The order is the old Now's: a few bullets from
2026-09-19 to 2026-09-26 sit out of date order, so go by the date each
bullet starts with.) Moved here verbatim from `HANDOFF.md` → Now on
2026-10-21 (ROADMAP 1.1), with the two notes that had sat in `HANDOFF.md` →
Testing (the linter and the type check, and the iPad tabs) put back in date
order as bullets of their own. `HANDOFF.md` is what is true now; this is how
it got that way. A round adds its bullet at the top. The owner's answers
are also listed, numbered, in `docs/DECISIONS.md`.

Inside these bullets, "Now", "Next", "below" and "above" mean the sections
of `HANDOFF.md` as they stood when the bullet was written. Since the split,
"Studio platform" is `docs/STUDIO-PLATFORM.md`, the two "Diagnosing"
sections are `docs/DIAGNOSING.md`, "Things learned the hard way" is
`docs/LESSONS.md`, and the Next items from before 2026-10-19 are
`docs/OPEN-CHECKS.md`.

- **2026-10-22: `main.js`'s fourth seam (ROADMAP 1.2).** The looks, Make it
  beautiful and the hero set — `looksSection`, `heroSection`, `runHeroSet`,
  `runLook`, `runPolish` and their two notes — moved into
  `src/ui/polish-panel.js`, and the image editor's preview and dialog into
  `src/ui/image-editor.js`. Unchanged but for `ctx.` and `export`, checked
  line for line against the removed code. One node test that reads the
  editor's source text now reads it from the new file. `main.js` is 6,764
  lines (from 6,876). view-polish, view-finish and view-wall-assets green,
  and 527 node tests.
- **2026-10-22: `main.js`'s third seam (ROADMAP 1.2).** Export → Keep your
  work — `keepSafeHTML`, `paintKeepSafe`, `remindBackup` and the browser's
  last answer they share — moved out of `boot()` into
  `src/ui/keep-safe-panel.js`, and the booth and floor templates' read and
  write into `src/ui/templates.js` (plain exports: they read no state of
  boot's). Unchanged but for `ctx.` and `export`, checked line for line
  against the removed code. `main.js` is 6,876 lines (from 6,990); the
  ratchet holds it there. view-keep-safe, view-report, view-quickstart and
  view-floor2 green, and 527 node tests.
- **2026-10-21: `main.js`'s second seam (ROADMAP 1.2).** The welcome and
  Quick start — `openWelcome`, `describeBlock`, `describeToAssistant`,
  `welcomeDismissed`, `chooseRole`, `openQuickStart`, `runQuickStart` —
  moved out of `boot()` into `src/ui/welcome.js` unchanged but for `ctx.`
  (checked line for line against the removed code). `main.js` is 6,990
  lines (from 7,098); the ratchet holds it there. view-roles,
  view-quickstart and view-assistant reach every assignment the module
  makes.
- **2026-10-21: `view-textures`' tent wait, root-caused.** The suite timed
  out three times in CI at the tent canvas (`main`'s run 83, #42, #43), each
  green on re-run. Measured, not guessed: the browser the suites use draws
  with swiftshader on the CPU, a frame of the page at 1440×1000 with shadows
  takes about 0.75 s, and every step of that wait is paced by frames —
  Playwright's checks before the click, the four images' load callbacks
  between renders, `waitForFunction`'s polling. From the click to the maps
  on the tent was about 8 s on a quiet machine and 13 s with the CPU busy,
  against a 15 s budget; reproduced locally 1 run in 6 that way. The maps
  always arrived (the canvas set loaded, was claimed and applied to all five
  panels), so nothing in the app was wrong. The six set-loading waits in
  that suite now share one 60 s budget, `SET_WAIT`, with the measurement in
  a comment; other suites already give heavy loads 30–60 s.
- **2026-10-21: the rest of `src/` type-checked (ROADMAP 1.4), and
  `main.js`'s first seam (ROADMAP 1.2).** `tsconfig.app.json` checks every
  module in `src/` that `tsconfig.json` does not, against a browser's
  globals, but `main.js` and `scene.js` (493 findings between them, waiting
  for their split) and `studio.js` (it imports the vendored SDK, which has
  no types); `npm run typecheck` reports both configs in one run, and what
  it found was fixed with behaviour-preserving coercions and casts
  (booth-studio#42, merged and verified live at `4a4dd3c`). Then seam 1 of
  `MAIN_SPLIT_PHASE.md`: the seven share-link functions moved out of
  `boot()` into `src/ui/share-dialogs.js` unchanged but for `ctx.`, with
  `tests/main-size.test.js` as the ratchet (7,098 lines, from 7,209). The
  modules the split makes wait for the type check with `main.js`, so each
  move stays byte for byte reviewable. On the way: `tests/view-textures.mjs`
  times out now and then in CI waiting for the tent's photographed canvas
  (line 159; once on `main`'s run 83, once on #42, green on re-run and every
  time here) — not yet root-caused.
- **2026-10-21: the handoff split (ROADMAP 1.1).** Every session reads
  `HANDOFF.md` whole before doing anything, and it had grown to 3,496 lines
  because each round appended to it. It is under 500 now — what is true now,
  rewritten as a summary of the app as it stands; Next; deployment, testing,
  the rules and the read map — and the rest moved here verbatim: this file
  (the old Now, every round), `docs/OPEN-CHECKS.md` (the old Next's by-eye
  checks from before 2026-10-19), `docs/STUDIO-PLATFORM.md`,
  `docs/DIAGNOSING.md` and `docs/LESSONS.md`. A script checked that every
  line of the old file is in one of the new ones; the only changes are two
  headings that became titles, pointers to the moved sections, the roadmap
  item in Next brought up to date, and the old "no accounts, sync or AI
  calls" rule, which now says what CLAUDE.md has said since 2026-10-05. New:
  `docs/DECISIONS.md`, the owner's 99 answers as B-001 to B-099, each dated
  and quoted from where it is written, and the 28 calls still open, gathered
  by a subagent and checked against the text. From now on a round adds its
  bullet here at the top, the owner's answers there, and changes `HANDOFF.md`
  only where what is true has changed (the `steward` skill,
  `docs/WORKFLOW.md`). `tests/handoff.test.js` keeps `HANDOFF.md` at 600
  lines or fewer (it was split to under 500) and every pointer in the live files whole: each file named
  in backticks exists, and each "HANDOFF.md → <section>" names a section it
  has.
- **2026-10-20: opens with no signal, and installs (ROADMAP 1.7).** A show
  floor often has no signal, and until now the app opened only with one: a
  tab left open kept working, a new one didn't. `public/sw.js`, a service
  worker, now keeps the page and the build's own files, so once Booth Studio
  has been opened in a browser it opens there again offline, with the
  booths saved on that device, their floors and skies included. Opening the
  app (`/`, a booth link too) asks the network first, so a connected browser
  always gets the deployed app, and follows a redirect; the kept page stands
  in when there is no network, when the network answers with a server error
  (a 5xx from the edge or the Worker), or after 4 seconds of a network too
  slow to answer (one bar at a fair). Anything else is the site's answer and
  is shown, a 403 or a 404 included. Any other page (the pitch deck) is
  never kept. Only
  the install keeps the page and the build's files — every chunk, the ones
  loaded on demand too, from the list `vite.config.js` writes beside it
  (`dist/sw-files.json`) — and it keeps them together, so the kept page
  always names files that are kept: an install that can't keep a file, that
  finds a page and a list from two deploys (one still rolling out), or whose
  page came by a redirect (a sign-in in front of the site) fails whole and
  leaves the worker already there with what it had. Each version keeps its
  own files and the previous version's, for a tab still open on that one,
  and lets older ones go. Textures, HDRIs, the cut-out people and anything
  else in a folder under `/assets/` are kept as they are first used (never
  all 29 MB up front) and across deploys: answered from what is kept, looked
  at again in the background once a day by their ETag (an unchanged file
  costs a 304, not the file again), and let go once the site no longer has
  them, so the app's fallback shows. The app's HEAD check before each one is
  answered from what is kept too. The manifest and the icons come from the
  network first. `/api`, `/v1`, `/assistant` and other sites are never
  touched, and nothing of type text/html is ever kept for a file, because
  the Worker answers a missing file with the page itself and the app's
  texture fallbacks depend on seeing that. It is registered by `src/main.js`
  in a built app only (the dev server the view suites drive never has one),
  after the page has loaded, as `/sw.js?v=<build commit>`, so every deploy
  installs a new worker. **`OFFLINE` in `src/main.js` is the off switch:**
  false, and the page unregisters the worker and deletes what it kept. It
  takes hold at the first open whose page comes from the network (within
  the 4 seconds); a tab already open keeps its worker until it closes, and
  the next open deletes whatever that worker kept meanwhile. For the
  emergency that can't wait for that, Diagnosing has a worker that removes
  itself. `public/manifest.webmanifest` and `public/icons/` (drawn from the favicon
  by `tools/make-icons.mjs`) make it installable: Add to Home Screen on an
  iPad or a phone, Install in Chrome. Two suites prove it.
  `tests/sw.test.js` (in `npm test`) runs the worker in node against a
  pretend browser — its caches, its network and its clock — for the rules
  that take deploys and days to show: what each version keeps and lets go,
  the daily look, the HEAD answer, what is never touched; 24 deliberate
  breaks of `sw.js`, one at a time, each turn it red. `npm run test:offline`
  (`tests/offline.mjs`, in CI after the build) opens the built app in
  Chromium, gives a booth the Outdoor fair look, saves it, cuts the network
  and opens it again — the grass floor, the HDRI and its loader all from the
  worker — then checks a booth link offline, the network first online, a
  day-old texture looked at again by its ETag (a 304; the browser's own
  cache is emptied first, because while it still holds the file it asks
  that by itself), a 503 answered at once with the kept page, a redirect
  followed, and the 4-second stand-in on a 15-second network. Red without
  the worker, without its offline page, without its HEAD answer, with the
  daily look asking without the ETag, with the 503 passed through, with the
  503 waiting out the 4 seconds, and with the redirect covered.
  (Chromium reports every HEAD as aborted after its 200, worker or not: the
  suite ignores those. And it times the 503 from a blank page, because
  putting this WebGL page away takes seconds of its own under swiftshader.)
  Whether Safari on a real iPad keeps it, and how an installed app feels, is
  the owner's to try: HANDOFF → Next.
- **2026-10-20: three.js loads as a file of its own (ROADMAP 1.6).** It was
  half of the one 1.1 MB script, and every merge changed that script's name,
  so every returning browser fetched all of it again. `vite.config.js`
  (`manualChunks`) now puts three.js's core in `assets/three-<hash>.js`,
  preloaded beside `assets/index-<hash>.js` (about 525 KB, the app). Its name
  and bytes change only with three itself, the build tools (vite, rollup,
  esbuild), or the set of three.js parts the app uses (the chunk holds only
  those) — rarely, where the app's half changes with every merge — and the
  Worker serves assets with an ETag and `max-age=0, must-revalidate`, so
  after a deploy a returning browser gets a 304 for three.js (144 KB
  gzipped, with the orbit controls) and fetches only the app's half. The loaders and the exporter
  (three/examples) stay in the chunks they load on demand with; CI's "The
  first load is split" fails if the chunk goes; `tools/verify-deploy.mjs`
  still finds the index script by name. Measured in ROADMAP 1.6: the rest of
  that item's target needs main.js split (1.2). Not done: `immutable` caching
  for the hashed files (they share `/assets/` with the unhashed textures, so
  it needs its own folder first).
  A tab left open across a deploy asks for the old names of the chunks the
  app loads on demand (the studio, the assistant), which the Worker answers
  with the page itself; the import fails, and the app now says so in a toast
  — reload, the work is saved; offline, that the part needs a connection —
  over the error toasts that follow from it, instead of failing in silence
  (Vite's `vite:preloadError`). A studio load that failed is tried again on
  the next click instead of failing for the rest of the tab's life.
- **A linter and a type check since 2026-10-20 (ROADMAP 1.4, 1.5).** `npm run
  lint` is ESLint's recommended rules (`eslint.config.js` says which two are
  loosened and why: an empty `catch {}`; and unread parameters, caught errors
  and names starting with `_`), over
  `src/` (not `src/vendor/`), `tests/`, `tools/` and `worker/`. Its first run
  found thirteen unused names — imports and variables — and a needless escape,
  and no undefined name; they are gone. `npm run typecheck` is TypeScript
  reading the JavaScript as it is (`checkJs`, no emit, not strict) from
  `src/scene-ops.js` and everything it imports — what studio-api runs — with
  the JSDoc as the types and a Worker's globals, not the page's (so a
  `document` in that code fails the check; the canvas half of the image edits
  moved to `src/image-paint.js` for it). Its fifteen findings were all types
  inferred too narrowly — from a default parameter or a destructured `[lo,
  hi]` — fixed in the JSDoc; the scene bundle came out byte for byte the
  same. Both run in CI's `lint` job, beside `core` and the view shards, and
  `booth` needs it green.
- **2026-10-20: the assistant can see the booth (🖼).** Beside the panel's 📷
  is a 🖼, **Attach the booth as it looks now**: the view on screen, rendered
  clean through `scene.export` (no controls or outlines) in the window's own
  shape — not Export's chosen frame — or in Photo mode the photo
  composition, 1568 px on its long side,
  goes with the next message as a picture, so "how does this look?" or "what
  would make it better for a jury photo?" is answered about the booth itself
  and not only its numbers — and the assistant can then change it with the
  ops it already has. It rides the picture path the 📷 already uses (no
  platform change, no new limit), shows only where the app gives the panel
  `viewPicture` (main.js `studioHost`), and is refused, with a note, while
  an export or a previewed move holds the renderer. A message sent while the
  booth is being pictured waits for it. `tests/view-assistant.mjs` sends one and checks it is the
  drawn booth, not an empty canvas. Whether the model's critique is any good
  is the owner's to judge.
- **2026-10-20: Report a problem (ROADMAP 1.9).** Export → Something wrong?
  → **Copy a problem report** copies plain text to paste into a message: the
  build (version, time, commit — compare it with `main` first, as
  "Diagnosing" below says), the page without its query (a booth link's id
  stays out), browser and screen, signed in or not, the project in counts and
  settings only (no names, titles or images), each texture set's state from
  `window.BOOTH_ASSETS`, and the page's last 20 different uncaught errors and
  unhandled rejections, which main.js records from its first line. The same
  error again is counted on one line ("— 500 times since …"), so a broken
  frame loop cannot push out the error that started it; quoted text and a
  link's query are taken out of every message, since an error can quote what
  someone typed. Stacks keep the frame that threw in Firefox and Safari too,
  whose stacks have no message line. Where the clipboard
  is refused it opens in a dialog to copy by hand. Nothing is sent: a Worker
  route for reports is the owner's call (ROADMAP phase 0). `src/report.js`
  (`tests/report.test.js`), `tests/view-report.mjs`. When the owner reports a
  bug, ask for this report first.
- **2026-10-20: Keep your work says how safe the work is (ROADMAP 1.8).**
  Signed out, a booth lives only in this browser's IndexedDB, which a
  browser may clear by itself (low disk; Safari after a week without a
  visit). Export → Keep your work now says whether this browser keeps this
  device's copy (`navigator.storage.persisted()`), the space it uses
  (`estimate()`), when a backup was last downloaded here, and, signed in,
  that the studio keeps it too. Where the browser may clear it, **Ask the
  browser to keep it** calls `persist()` — only from that button, because
  Firefox answers with a permission prompt. A booth holding the artist's own
  images, never backed up or not for 30 days, gets one reminder toast at
  start (12 s), at most once a month per project, never signed in, never
  over the welcome; it counts as given only once it has stayed on screen 8
  seconds, since another toast can cover it. What is remembered is per
  browser and per project (`localStorage["booth.keepSafe"]`, the 50 projects
  touched last), never in a project or a backup, and where site data is
  blocked nothing is remembered and the start goes on. A redraw of the Export
  tab draws the last answer straight back and asks the browser again at most
  every 10 seconds. Sizes are in 1024s, as `share.js` counts them.
  `src/keep-safe.js` is pure (`tests/keep-safe.test.js`);
  `tests/view-keep-safe.mjs` stands in for `navigator.storage`. Whether
  Safari on an iPad grants persistence is for a real iPad: HANDOFF → Next.
- **2026-10-20: the assistant can apply a look and Make it beautiful
  (Art-Talk-Back D-081).** Two booth ops in `src/scene-ops.js`:
  `apply_look` (gallery, hall, fair, evening — `LOOKS` in `src/polish.js`)
  and `make_beautiful` (the venue's look unless one is given, every wall
  hung evenly on the 60″ line, the spotlights aimed at the work), each with
  a card line in the app's words. "Make my booth look good for a jury photo"
  is now one `placement_edit` instead of a pointer at a button. For it,
  `polish.js` joins the scene build that studio-api runs, which meant moving
  the environment presets (`ENV_PRESETS`, `resolvePreset` and the rules that
  go with them) out of `src/lighting.js`, which imports three.js, into a pure
  `src/presets.js`; `lighting.js` re-exports all of it, so no importer
  changed. The build grows from 98 KB to 113 KB, still with no three.js in
  it. Ships as a pair with Art-Talk-Back's branch of the same name (its
  vendored `booth-scene.js`); the assistant Worker reads the op catalog from
  studio-api's tool list, so no "Deploy production assistant" is needed.
  The same pull request lets the assistant see and set the light by hand:
  `describe` (the assistant's `describe_booth`) now carries a `lighting`
  block — the look the booth is in, the environment, the ambient level, each
  spotlight's temperature and brightness and, on an art-show booth, the
  light bar on the Lighting tab's own 0–100 scale; never where a spotlight
  hangs — and `set_lighting` sets those levels as the tab's sliders do
  ("Light it: ambient 0.6; both spotlights at 2700 K"). "Make it warmer" no
  longer has to throw the whole look over. Which look a booth is in is
  `currentLook` in `polish.js`, the inverse of `applyLook` (a field a look
  gains goes in both): a look holds while every value it set still holds,
  floor and horizon included, and the Lighting tab now marks that look's
  button until a value is changed by hand. Whether the model reaches for
  `make_beautiful` or `set_lighting` when asked in plain words is the
  owner's to try in the chat.
- **`tests/view-wall-assets.mjs` (was `tests/wall-assets.mjs`) is green and
  in `npm run test:view` since 2026-10-20.** It had failed at line 120 since
  the sixth round: from 701 to 1200 px — every iPad — the inspector's eight
  tabs pushed the page wider and the app scrolled sideways, Export half off the
  screen (`src/style.css` → "Between a phone and a wide laptop", and
  `keepTabInSight` in `src/main.js`). Nobody saw it because it was never in
  CI. In CI the view suites run as four shards at once (`views` in
  `.github/workflows/ci.yml`); `booth` is green only when every job is.
- **2026-10-20: a permanent way of working — `docs/WORKFLOW.md`.** The owner
  asked for a project-level workflow for cloud sessions (assessment, research,
  roadmap, phased building, review in rounds, tests, a checked deploy, this
  file updated), weighing obra/superpowers and jingzhao-l/iterate-skill. Six
  project skills in `.claude/skills/`: `plan-phase`, `verify-change`,
  `root-cause`, `review-loop`, `steward` (the harness reads it on PR events)
  and `product-strategy`. Four adapt text from the two projects, pinned to
  commits (`.claude/skills/THIRD_PARTY.md`); neither is installed, and none of
  their code was run — WORKFLOW.md says why. A session-start hook runs
  `npm ci` when needed and sets `BOOTH_TEST_CHROMIUM`.
  `tools/verify-deploy.mjs` waits until production serves a commit, then
  opens it in Chromium and checks the app starts: first run, production
  serves `fe7305d` (Rev 1) and starts clean. That also means the sandbox now
  reaches `*.workers.dev`; CLAUDE.md's "what no session can do" is updated.
  `tests/claude-workflow.test.js` keeps the skills loadable (front matter,
  names clear of Claude Code's own `verify`, `debug`, `plan` …), which
  `claude plugin validate` does not check. The skills reach new sessions once
  this is on `main`.
- **2026-10-20: `ROADMAP.md` — the road to a product people pay for.** The
  owner asked what would make this top-tier software that companies buy and
  artists rely on, and for the phase-by-phase plan to get there. The file
  answers both: where the app stands, the market (ArtPlacer, BoothFlow,
  Eventeny, ExpoFP, ZAPP, Social Tables; prices from search, unverified),
  the positioning (the show's official floor with every exhibitor's real
  booth in it; organizers pay, artists come free through their shows), and
  phases 0–6 with a gate each: prove it and decide (owner) alongside
  foundations (code, offline, storage safety, CI), the artist's season, the
  show's official floor (Rev 2 without payments), paid, exhibitions (Rev 3),
  partners. No code changed. Tick its boxes as pull requests land.
- **2026-10-19: Rev 1, part C — describe it to the assistant.** The
  welcome and the Workspace dialog (`describeBlock` in `src/main.js`) offer a
  second door: where the assistant is on (signed in, one connected:
  `body.assistant-on`), a box "Or describe it, and the assistant builds it";
  Ask the assistant closes the dialog, opens the panel and sends the words
  (`describeToAssistant` → the panel's `toggle(true)` and `send`), so it
  arrives as an ordinary message with the booth on screen as its record, and
  the assistant shows its card before anything changes. On a first visit
  with nothing chosen it also picks the Artist workspace. Signed out — which
  is every first visit, since the welcome is not shown to a browser already
  signed in — the dialog says what signing in adds and its Sign in link opens
  Studio account. No change to the assistant or the platform. Tested in
  `tests/view-assistant.mjs` (routed assistant) and `tests/view-roles.mjs`.
- **2026-10-19: Rev 1, part B — looks, Make it beautiful, the hero set.**
  `src/polish.js`, pure (`tests/polish.test.js`), on the same branch as part
  A. **Looks** (Lighting tab, 3D only): Gallery white, Convention hall,
  Outdoor fair, Warm evening — each sets the environment preset (with its
  floor and horizon), the ambient level and the spotlights' colour and power
  in one undo step. The values are the one `LOOKS` table; whether they look
  right is the owner's to judge on his screen. The Environment picker and the
  looks now share one rule, `applyEnvPreset` (the preset's floor, horizon,
  and an art-show booth leaving its white hall for a photographed
  environment), moved out of main.js unchanged. **Make it beautiful**
  (Lighting and Export): the venue's look (`lookFor`: art show and open
  booth → Gallery white, canopy → Outdoor fair), every wall of this booth
  spaced evenly with centres on 60″ (`evenHang`; a wall carrying a sign or
  label, and a neighbouring booth's wall, are left alone), and the spotlights
  aimed at the work (`aimLights`: inside faces of the three perimeter walls,
  up to four targets — one per wall with work, spares to the fullest — each
  light 48″ into the booth in front of its target; lights beyond the targets
  are removed, one work gets two lights crossing on it). One undo puts it all
  back. **Hero set** (Export → Hero set): four 4096 px 16:9 PNGs — Front,
  Three-quarter, Aisle, Close-up of the fullest wall — each from its own
  camera (`heroShots`, fitted to the viewport's shape because the export cuts
  its frame from the viewport), then a 15 s orbit MP4 where video is allowed
  and supported. It runs through the batch renderer (`runClips`), so the
  files are named `<booth>-01-front.png` … `-05-orbit.mp4` and Cancel keeps
  what was written. Every camera stands in front of the open side: the side
  walls run the full depth, and a camera off to the side saw only the back
  of one (found by looking at the first render). `tests/view-polish.mjs`
  drives all three; it cancels the 450-frame orbit, which swiftshader is too
  slow to wait for. Not seen by the owner.
- **2026-10-19: Rev 1, part A — workspaces.** The owner asked for the app to
  serve artists, show promoters and directors, and people running larger
  exhibitions: easy to use, high-quality results. The plan is the Claude Doc
  "Booth Studio — Revision Plan" (https://claude.ai/artifact/QSXHZbhe2S3P4f51oVCAHV):
  keep the engine, and give each kind of user a front door of their own.
  Rev 1 is three small pull requests with no backend or schema change:
  A, workspaces (this one); B, quality defaults (named looks, "Make it
  beautiful", hero-shot export); C, the assistant offered on the welcome.
  Rev 2 is the hosted Show Hub and Rev 3 exhibitions; both wait on the
  owner (payments and more server-side work).
  **What A does.** A first visit — no project saved on this browser, no
  workspace chosen, not signed in, no booth link opening — opens "What are
  you planning?" with three cards: *My booth* (Artist), *A show floor* (Show
  organizer) and *Every tool*. An artist goes straight on to Quick start
  with its backup box unticked (the example booth is not theirs); an
  organizer opens on the Show floor tab; closing it without a choice keeps
  every tool and is not asked again. A workspace shows only its tabs —
  Artist: Artwork, Layout, Walls, Lighting, Export, plus Art show when the
  booth is an art-show booth; Organizer: Layout, Show floor, Export — and a
  **More** button beside them shows every tab (Fewer puts them back). The
  open tab always shows, so tool search, the assistant's "take me to" and
  Open the Walls tool still land on a lit tab. It hides a few toolbar tools
  (Box and Fast edit for both; Show floor for the artist, Photo for the
  organizer). **Workspace** in the header (Layout → Project on a phone,
  where the header has no room) switches at any time. **Every tool is
  today's app, unchanged**, and it is what anyone who already had a project
  gets without being asked. The choice is `localStorage["booth.role"]`, a
  view setting like the tier: never in a project, a backup or the studio.
  `src/roles.js` is the table and is pure (`tests/roles.test.js`);
  `applyRole`, `openWelcome`, `chooseRole` and `welcomeDismissed` in
  `src/main.js` put it on the page; `tests/view-roles.mjs` drives it.
  **Every other browser suite now sets `booth.role` to `all` before the page
  loads** (one `addInitScript` line after each `newPage`), because a fresh
  browser is a first visit and the welcome is modal. A new suite needs the
  same line. Not yet seen by the owner or on a phone.
- **2026-10-08: phone panels tidied, first pass.** Isaac found the iPhone
  sheet cluttered and pointed at Lightroom iOS. Below 700px the section chips
  (`applySectionTabs`) are now one sideways-scrolling line of plain words with
  the chosen one underlined, instead of wrapped rows of pills that took half
  the sheet; the chosen chip is scrolled into sight. While walking
  (`body.walking-on`, set in `setWalking`) the round search and assistant
  buttons hide on a phone, because they sat under the walk pad. CSS at the end
  of `src/style.css`. Checked by screenshot at 390 px; not yet on his phone.
  Second pass the same day: the booth takes 43% of the screen, the tool row
  is 38 px, and the five view buttons became one View menu (`#view-quick`,
  which presses the matching `#view-switch` button and follows the lit one)
  beside the zoom buttons; the statusbar is hidden on a phone (Preview
  quality stays in Export).
  Third pass: the phone toolbar shows Select, Move, Walk and Undo, and a
  "More tools" button (`tools-more`, `body.tools-open`) opens the rest in the
  same row; the header search box is a magnifier that opens across the header
  when tapped, so the project name has the room.
- **2026-10-08: the header says "Sign in".** Isaac couldn't find where to sign
  in: the only way was a grey round "IA" in the header, and below 700px it was
  hidden altogether. Signed out, that button now reads "Sign in" (a light pill,
  on the phone too); signed in it shows the email's initials and its title says
  who is signed in. `accountLabel` in `src/studio-session.js`; `writeSession`
  fires a `studio-session` event and main.js repaints the button. Checked in
  `tests/view-assistant.mjs` at 390 px (booth-studio#27).
- **Optional password (Art-Talk-Back D-080).** Isaac chose "code, then optional
  password". Studio account signed out has "Use my password"; signed in, a
  Password section sets, changes or removes one (`/v1/auth/password*`, read via
  `Me.hasPassword`). The emailed code always still works. Covered by
  `tests/view-password.mjs` (studio routed, no real studio-api). Needs
  Art-Talk-Back#39 deployed to production first.
- Repo: https://github.com/yitzhach/booth-studio
- Production: https://booth-studio.bobdylan2000.workers.dev
- `main` is deployed. Every other branch is preview-only.
- **Studio platform (on `main` since 2026-10-05).**
  The owner approved studio sign-in and sync through `studio-api` (the shared
  backend in `yitzhach/Art-Talk-Back`). The plan, its gate and what still
  needs the owner are in Art-Talk-Back `docs/phase-5-booth.md`; the decisions
  are its D-061…D-067. Read the section **Studio platform** below before
  touching sign-in, sync, `worker/index.js` or `wrangler.jsonc`.
- **The assistant knows where everything is (2026-10-07, Art-Talk-Back
  D-072).** The owner found it saying it "can't see the app's buttons". Now
  each message sends `appMap`: every tab, bar and button the tool search
  indexes (`buildToolIndex` → `appMapText` in `src/main.js`, about 4,400
  characters), so it answers "Export tab → Keep your work → …" and stays in
  step with the app by itself. The booth on screen also carries a sync
  `note` (`SYNC_NOTES` in `src/studio-assistant.js`) when the studio doesn't
  have it as it is, e.g. a project made before signing in that waits for
  Import my existing projects: the owner's "Spring booth" case, where the
  assistant had said the booth doesn't exist.
- **2026-10-07, pictures in the chat (Art-Talk-Back 10a, D-071).** The
  assistant panel has a 📷 button beside the message box: up to three
  pictures (a photo, a sketch, a show's map) go with the next message, or on
  their own. The panel shrinks each to a JPEG 1568 px on its long side
  (`fitPicture`, `shrinkPicture` in `src/studio-assistant.js`) and sends it
  as `images` with the message; studio-assistant shows it to the model for
  that turn only and stores a note in its place, so Past chats show
  "(picture)". The model builds a booth with `placement_build`, changes the
  one on screen with `placement_edit`, or lays out a floor from a map, and
  says what it read. Proven by `tests/view-assistant.mjs` (attach, preview,
  remove, the size sent, a picture alone, the three-picture cap). Whether
  the model reads a real sketch well is the owner's to judge on his phone:
  no session can. Live in production since 2026-10-07: the owner approved
  "Deploy production assistant" run 2 (Sonnet 5.5) after booth-studio#17.
- **"Take me to …" (Art-Talk-Back D-075, step 10c, 2026-10-07).** The owner
  asked the assistant to open the Layout tab and it said it couldn't. The panel
  now sends `commands: ["open"]`; the assistant's `open_in_app` tool streams an
  `open` event with a place and control from the app map, and
  `studioHost.openPlace` finds it in the tool index (`placeHit`) and shows it
  with Find a tool's own `openTool(hit, { press: false })`: the tab opens, the
  section scrolls into view, the control is focused and highlighted, and
  nothing is pressed. On a phone the panel shrinks to its bar (not saved) so
  the control isn't under it. Note: `fold` in main.js is the inspector's
  open/closed helper and hides toolsearch's `fold`; text matching uses
  `foldText` (openTool's re-find by name had silently compared "" to "").
  Needs "Deploy production assistant" for the tool to reach production.
- **The booth on screen goes to the studio by itself (the owner, 2026-10-07).**
  He asked the assistant to add a figure to the booth he was working on and
  it said the booth "didn't open": it had been on his device since before
  he signed in, waiting for Import my existing projects, so the studio (and
  the assistant) had never seen it. Now the project that was open at sign-in
  waits only while it is untouched (`localHash` in the session, a hash of its
  scene at sign-in): changed since, it goes up like any other; asked about
  in the assistant, the panel calls `bridge.adopt()` and it goes up before
  the message is sent. A sign-in from before `localHash` existed sends it at
  once. A fresh device's untouched demo still never goes up by itself.
  `sync()` called while one runs now runs once more after it, so what was
  saved or adopted before the call is in the studio when it resolves.
  Proven by `tests/two-devices.mjs` (untouched waits; renamed goes up) and
  `tests/view-assistant.mjs` (adopt before the message).
- **The assistant panel on a phone — the owner's list (2026-10-07).** Four
  doors and a pop-up, all in `src/studio-assistant.js` unless said:
  - **Backspace types.** A key in the panel's chat box reached `src/main.js`'s
    shortcuts retargeted to `<studio-assistant>`, so Backspace was
    swallowed (and deleted the selected artwork). `typingIn(ev)`
    (`src/typing.js`) reads the event's composed path; `main.js`'s two
    document key handlers and the show floor's Space-to-pan use it.
  - **Dark, with the app.** The panel takes the app's own palette (style.css
    `:root` custom properties, which reach into the shadow root). The app has
    no light theme, so neither does the panel.
  - **Where to open it.** A header button beside Find a tool ("Assistant";
    an icon on a phone), and on a phone a round icon stacked above Find a
    tool's in the viewport (`.assistant-fab`, style.css), in place of the
    floating "Ask the assistant" pill, which stays on a computer. Both show
    only while the panel would (`body.assistant-on`, set by `paint()`) and
    run `actions.assistant`.
  - **A movable pop-up.** Drag the title bar to move it, the corner grip to
    resize it, – to shrink it to its title bar (or double-click the bar).
    On a phone it opens as the lower half above the tab bar, not 80% of the
    screen. Its place is kept per device (`booth.assistantPlace`) and
    clamped back on screen (`clampPlace`).
  Checked at 390 × 844 and 1280 × 900 by `tests/view-assistant.mjs`
  (Backspace fails there on the old code). Signed out nothing shows, as
  before. Not judged by eye on a real phone: the owner's to try.
- **Last deploy: 2026-10-05, seventeenth round — booths and show floors by
  name, for the studio assistant and agents.** The owner approved
  scene-level actions (Art-Talk-Back D-070) with a wider aim: a booth or a
  show floor made from words, a photo or a show's map, and the app driven by
  asking. `src/scene-ops.js` is the scene logic (booth ops and show-floor
  ops); `npm run bundle:scene` builds it and studio-api runs that build for
  `placement.edit`, `placement.build` and `describe_booth`, so an agent's
  change opens here like one made by hand. Nothing in the app's screens
  changed. Also shipped that day: a rename made outside the app now reaches
  the screen, and a booth deleted from the studio stays on the device
  instead of looping (#11). Shipped as pairs: Art-Talk-Back#19 then #13;
  Art-Talk-Back#20 then #14.
  **The chat window (the owner asked where it is):** built in this round
  (Art-Talk-Back `phase-5-booth.md` 9c) as "Ask the assistant", bottom
  right, `src/studio-assistant.js`. It shows only while signed in to the
  studio *and* where this copy of Booth Studio has an assistant connected:
  staging (`studio-booth-studio-staging`) and, since 2026-10-06,
  production: the owner approved "Deploy production assistant" and the
  `ASSISTANT` line to `studio-assistant` is in `wrangler.jsonc`'s
  top-level services (see Studio platform). On a phone it is the same
  button, bottom right, and opens as a sheet from the bottom. The
  Show Tracker's chat is likewise on its staging Worker only
  (https://studio-show-tracker-staging.bobdylan2000.workers.dev, main page
  and Expenses), never on its production address.
  Before it, **2026-10-05, sixteenth round — studio sign-in and sync.**
  Booth Studio is an app on the studio platform: Studio account (the avatar,
  or Export → Keep your work) signs in with the studio's emailed code, and a
  signed-in browser keeps its booth projects and their images in the studio
  and opens them on other devices. Signed out, nothing changed. Shipped in
  the order the platform needs: Art-Talk-Back#17 first (migration 0006 and
  `/v1/placements` live in production `studio-api`), then
  booth-studio#9 (`04d694f`). CI now runs on every pull request
  (`.github/workflows/ci.yml`), the view suites included, on Chromium build
  1194. Read **Studio platform** below; what the owner should try first is
  Next item 1.
  Before it, **2026-09-28, fifteenth round — a double-clicked figure's card is shown whichever section chip was open.**
  The owner reported that double-clicking the man did not open his card.
  The pick itself was fine, from every view and orbit (a sweep of 24 orbits
  and 4 facings in the sandbox missed only where an opaque wall stood in
  front, which is right). The card was the problem: on a real browser the
  panels have section chips, and when Layout's open chip was not People for
  scale the card was in a hidden section, and `scrollIntoView` on a hidden
  element does nothing. The suites never saw it because they run with the
  chips off (`navigator.webdriver`). Now `reveal()` in `src/main.js`
  chooses the element's chip through `showSection` before scrolling, and
  the same helper serves a double-clicked pedestal and a clicked
  free-standing wall, which had the same gap. `tests/view-round13.mjs`
  turns the chips on, opens another chip and double-clicks the man; it
  fails without the fix. Plan view still cannot pick a figure: from
  straight overhead a cut-out is edge-on (see Next, the cut-out people).
  Before it, **2026-09-26, fourteenth round — Auto pan recorded to MP4, queued in the batch, and eased in and out**
  (the bullet after the next). Before it, the thirteenth round the same
  day — **double-clicking a figure works from any side again, and Auto
  pan** (the bullet after that). Before it, the twelfth round the same day — **the owner's Q&A answers:
  Flip for a figure, Add booths growing the floor, floor templates in
  backups, left-behind sales listed to move** (the bullet after that).
  Before it, **2026-09-25, eleventh round — Next items 3 and 4: the show
  floor grows to fit pieces laid off its edge, a floor is saved as a
  template, and the drape colour is a floor setting** (the first bullet
  below). Item 3 had nothing to build without the owner's answers. Before
  it, the tenth round — Next items 1 and 2: the share
  links hardened (rate limits, an upload window, a per-link ceiling, a daily
  sweep of lapsed links), a sent link updated or deleted by the browser that
  sent it, and a design file dropped straight on a floor booth** (the second
  bullet below). Before it, the ninth round — **Show Hub phase 1: a booth
  sent as a link, not a file. The app's first backend** — a Worker on
  `/api/*` and an R2 bucket (the third bullet below). Before it, the eighth
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
- **2026-09-26, fourteenth round: Auto pan recorded to MP4 (the owner's
  "yes"). Merged to `main` and deployed.** The Auto pan menu has **Record
  it as MP4**. It does not film the viewport: `autoPanTimeline` in
  `src/timeline.js` turns the pan into a two-key timeline — the view now,
  and the same view slid the set distance along the camera's level right
  (`scene.panRight`), both keys linear, no holds or fades — and hands it to
  the same `runClips` → `recordVideo` path as every clip, at the Video tab's
  size, frame rate, frame and Careful rendering. The view is left where it
  was. A clip is 2–60 s (`MIN_SECONDS`/`MAX_SECONDS`), so a pan set longer
  or shorter is rendered at the nearest limit — the same distance, faster
  or slower — and a toast says so. The file is `<project>-auto-pan.mp4`
  (`fileTag` on the job; batch names are unchanged). **Queued in the batch**
  too (the owner's ask, same round): **Add to the batch** in the Auto pan
  menu, and **Auto pan from this view** under Add to the batch in the
  Video tab, queue the same timeline as a clip frozen at the panel's
  settings (like "Clip · as set now"), named "Auto pan · <distance>
  <direction>". It is an ordinary custom-timeline job, so the batch's
  existing rules (rename, reorder, general settings, file names from the
  job's name) all apply; no new batch field.
  **Ease in and out** (the owner's ask, same round): the menu's **Motion**
  — Ease in and out (the default), Steady, Ease in, Ease out — the
  timeline's own EASES, used by the live pan (`scene.autoPan`'s `ease`),
  by Record it as MP4 and by the batch (both keys of the timeline carry
  it). With an ease the speed field is the average speed; the distance
  and the time are exact. Settings saved before this round load as
  Steady, so nobody's pan changes under them. In this
  sandbox the encoder is VP9; the test accepts either codec.
- **2026-09-26, thirteenth round: the owner's report after the twelfth.
  Merged to `main` and deployed.**
  - **"Can't double-click on people any more."** A cut-out figure is a flat
    card that turns to the camera only as it is drawn (`onBeforeRender` in
    `src/people.js`); the pick in `pickPerson` (`src/scene.js`) raycast the
    card laid along the figure's own facing. Seen from the side — the Left
    or Right view, or any orbit well round — a figure facing the aisle (the
    default) or turned by the new Flip was a card edge-on, and the
    double-click found nothing. Reproduced here (Left view, facing 180° and
    0°: no pick; Perspective: picks). `pickPerson` now turns every cut-out
    to the picking camera before the raycast. Mannequins were never
    affected.
  - **Auto pan.** A caret beside the toolbar's hand opens a small menu over
    the viewport: Direction (left to right, right to left), Distance (ft),
    Speed (ft/s) and Time (s). Time is distance over speed, so editing
    speed or time works out the other. Start slides the camera and its
    target together along the camera's own right, kept level, at a steady
    speed (`scene.autoPan`); any press, wheel or key in the viewport stops
    it. The settings are remembered per browser (`booth.autoPan` in
    localStorage), never in a project. The 3D view only: the flat show
    floor editor does not auto pan. Not wired into video export — the
    timeline's keyframes remain the way to record a camera move; if the
    owner wants Auto pan recorded to MP4, that is the next step.
  Tests: `tests/view-round13.mjs` (in `test:view`).
- **2026-09-26, twelfth round: the owner's answers (Q&A before the round).
  Merged to `main` and deployed.** Asked first,
  answered by the owner the same day:
  - **Flip for a cut-out person.** "Mirror" meant a one-click Flip so the
    Facing field need not be typed. Each figure's row in People for scale
    has **Flip**: it turns the figure round (`flipFacing` in
    `src/people.js`, kept in Facing's -180…180 range). The picture mirrors
    with its facing already, so no new field; schema unchanged.
  - **Add booths grows the floor by itself.** A block laid below the rest
    that runs past the floor's edge grows the floor (`growToFit`) in the
    same `mutate`, so one Undo takes both back; the toast gives the new
    size. The Grow the floor to fit warning stays for pieces dragged off.
  - **Floor templates travel in a backup.** `backup()` adds the browser's
    list as an optional top-level `floorTemplates`; opening a backup takes
    the key off before `validateProject`, and `mergeFloorTemplates` adds the
    valid ones whose id is new, up to 12. The key never enters the project,
    so schema 1 is untouched and older backups load as before.
  - **A template never drops a sale.** Sales were already kept by number;
    now the ones left on numbers no longer on the floor (`orphanSales` in
    `src/hall.js`) are listed under Sales with **Move to booth** (only
    floor booths with no sale of their own; `moveSale` refuses to
    overwrite) and **Forget**. Applying a template says how many were left.
    Not moved with them: "your booth" (`h.mine`) and linked designs, which
    stay on their number.
  - **Kept as is, by the owner's answer:** the share-link limits; the Show
    Hub file carrying originals; the 3D show drawing only the open booth in
    full; the eight top tabs.
  Tests: `tests/round12.test.js` (node) and `tests/view-round12.mjs`
  (browser, in `test:view`).
- **2026-09-25, eleventh round: Next items 3 and 4. Pushed to `main` and
  deployed.** Asked for as "continue with 3 and 4". Both items are mostly
  looking on the real machine and questions for the owner; this round built
  the parts that answer a question by adding an option, and changed nothing
  anyone was already using. Not seen on the real machine.
  1. **Item 3 (the seventh round's feel) — nothing built.** Every point in
     it is either a feel check (the right-drag box, ⌘ right-drag on a
     trackpad, the chips, H for the hand) or a choice that is the owner's:
     whether "mirror" meant flipping a booth's whole design or a cut-out
     person, whether the eight top tabs should be regrouped, whether Layout's
     twelve chips should be fewer, whether the hand stays on across modes.
     Building any of them would be guessing. They stay in Next, asked
     plainly.
  2. **Grow the floor to fit** (item 4, phase 1: "a block added below the
     rest can land outside the floor's size … should the floor grow to
     fit?"). Answered as an offer, not an automatic resize: when any piece
     lies off the floor, the Floor section says how many and offers **Grow
     the floor to fit** (`offFloor` / `growToFit` in `src/show.js`). It
     never shrinks; pieces above or left of the floor move down or right all
     together, so nothing changes place against anything else; 5′ to spare;
     one undo step. Add booths still lands a block below the rest.
  3. **Save this floor as a template** (item 4, phase 3). Under Start from a
     template: the floor's size and every piece, booth numbers and all — not
     its sales, "my booth" or linked designs, which belong to that show
     (`floorTemplateOf`). Kept on this browser, up to 12, in
     `localStorage["booth.floorTemplates"]`, like Quick start's booth
     templates; each checked by `validFloorTemplate` (the floor's own
     `validShow`) when read. Offered as **Mine · <name>** beside the built-in
     three with a Remove; applying one goes through the built-ins' confirm
     and is one undo step (`startFrom` in `src/main.js`, which the built-ins
     now use too). Not answered: whether applying a template should drop
     the sales of numbers no longer on the floor — still kept, as before.
  4. **Drape colour is a floor setting** (item 4, phase 2: "should drape
     colour be a floor setting?"). Floor → Drape colour: slate blue (the
     `#465469` every floor had, and still the default), black, white,
     burgundy, forest green, grey (`DRAPES`). Stored as optional
     `p.hall.venue.drape`, a hex colour checked by `validShow`; every older
     plan has none and draws as before. It colours the 8′ back drape and 3′
     side rails in See it in 3D (`showParts`); the 2D plan is unchanged.
  **Tests:** `tests/floor-extras.test.js` (4: off-floor found and grown,
  pieces moved together, a template's copy and its checks, the drape
  optional, checked and drawn); `tests/view-floor2.mjs`, a new browser suite
  in `test:view` (warning, grow, undo, drape chosen, a floor saved, a
  built-in applied over it, mine applied back exactly, removed, the drape
  surviving a reload).
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
