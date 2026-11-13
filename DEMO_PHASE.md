# The demo build — ready to show to artists and to show directors

Written 2026-11-13, after two days of discovery with the owner
(`docs/HISTORY.md`, the bullet of that date). This is the phase every session
works from until its three stages are ticked. It comes before ROADMAP.md's
phase 2 and pulls forward the parts of phase 3 that need no server.

## Goal

A product the owner can demonstrate, on his own phone and laptop, to an artist
in five minutes and to a show director in ten — and that each of them can then
use alone. Two jobs, finished:

- **An artist** goes from nothing to "my work hung in my booth, lit, and a
  picture of it" by answering five small questions, never meeting the full
  toolbox unless they ask for it. Free, signed out, offline.
- **A show director** brings the accepted list in as a spreadsheet, has every
  artist placed on the floor by the show's own rules, fixes the few
  exceptions by hand, and leaves with a packet for each artist and a map for
  the public. On the device, no account.

**Gate** (people, not code): the owner runs both demonstrations from
`docs/DEMO.md` without a stumble; then three artists and two show directors
each do their job without help, on their own devices. The owner knows about
five directors (B-101) and those conversations are his half of this phase.

**The owner's goal for six months** (B-100): a few paying artists and shows,
and a hundred or more people signed up from the free version. The arithmetic
that follows from it: a hundred free users make a handful of paying artists,
so artist subscriptions are not the income at this size; one show at a few
dollars a booth is worth more than all of them. The free tool is how artists
arrive and what a director is shown as proof; shows are where the money is.

## How this runs without the owner (B-102)

The owner asked for a hands-off build: no GitHub, no approvals, "only very
important checks". So:

- **Sessions decide.** Product, design, wording, order, code. Take the plan's
  default, write the call in Rulings below, keep going. Do not ask the owner
  to choose between options a session can weigh itself.
- **Sessions ship.** Each task is a pull request the session opens, reviews
  (`review-loop`), verifies (`verify-change`), merges when CI is green and
  checks live (`steward`). The owner is never asked to look at a pull request.
- **The owner is asked only at the three checkpoints below**, each a short
  list of things to try on the live site, written into `HANDOFF.md` → Next
  when its stage lands. Work does not wait on a checkpoint: the next stage
  starts, and what the owner reports is fixed when it arrives.
- **Still the owner's, always asked first, in one batch:** spending money; a
  secret; payments; any server-side work beyond the two backends CLAUDE.md
  lists; deleting data or a Worker; a new Worker's first deploy; the
  product's name and domain. The owner said "nothing off the table now"
  (B-101); this plan reads that as open to being asked, not as asked and
  answered — a session's reading, recorded as one.
- **The report** at the end of a session is one short chat message, in the
  style CLAUDE.md sets: what shipped, what failed, what the owner should try.

## Constraints (copied; none is relaxed here)

- Schema 1 is forever: every new field optional, every older backup loads.
- Local-first: signed out, with no network, everything in stages A–C works.
- The app runs with `public/assets` empty; nothing new ships as an image file.
- `main` is production; merging is deploying.
- `src/main.js` stays under 1,500 lines and `HANDOFF.md` under 600
  (`tests/main-size.test.js`, `tests/handoff.test.js`): new work goes in new
  modules.
- `src/scene-ops.js` and what it imports (`model.js`, `hall.js`, `show.js`,
  `quickstart.js`, `arrange.js`, `placement.js`, `polish.js`, `presets.js`,
  `linked.js`, `people-kinds.js`) are bundled for the platform and compared
  byte for byte by both repositories' CI. A task that changes one of them is
  a paired change with Art-Talk-Back's branch of the same name (`steward`).
  **Keep new logic in new modules so only task B1 pays this.**
- A rendering is labelled a rendering. Nothing leaves the device without a
  confirm. Private fields of a show (prices, notes, jury scores, sale status)
  never appear in anything made for artists or the public.
- No names of real people or real shows in examples; no maker's product
  names for panels or lights until the owner has that maker's word.

## Decisions

The owner's, with their numbers in `docs/DECISIONS.md`: B-100 (the six-month
goal; no adverts in the free tool; a community of artists later), B-101 (only
the owner has used it; five directors he can ask; nothing off the table),
B-102 (sessions decide and ship; the owner sees only important checks).

This plan's own calls, each a session's to revisit with evidence:

1. **Artists free, shows pay, and the first shows are served by hand.** The
   first director gets the job done for them from their map and accepted
   list; the tool becomes self-serve after three shows have paid. Nothing is
   built for payments in this phase.
2. **No server work in stages A–C.** Packets and the visitor map are files
   the director sends and hosts. The hosted show (invitations, artists
   submitting designs, an assistant answering artists) is stage D and waits
   for the directors' reactions and the owner's yes.
3. **The guided path is a face on the same app**, not a second app: same
   project, same file, one tap to every tool.
4. **Parked, on evidence:** the fly-in from the sky to a booth, a trade-show
   edition, AI renders, a forum. Reasons in ROADMAP.md → The order from here.
5. **Locks stay off** (`LOCKS_ON` in `src/tier.js`): everything is free until
   the directors' conversations say what is worth a price.
6. **The name stays "Booth Studio" on the present address for demonstrations.**
   A public launch needs the owner's name and domain (checkpoint 3).

## Files

Created (all pure unless marked UI):

| File | Responsible for |
| --- | --- |
| `src/guided.js` | The five steps: order, words, which controls each shows, when each is done |
| `src/ui/guided-panel.js` (UI) | Draws the steps in the inspector; Next, Back, All tools |
| `src/wall-layouts.js` | Wall layouts (U, L, U with wings, U with a centre wall) and the panel colour list, written with fields schema 1 already has |
| `src/examples.js` | Three finished example booths, built in code |
| `src/roster.js` | The accepted list: CSV reading, column guessing, the records |
| `src/floor-graph.js` | Which booths are neighbours, face each other, are corners, are doubles |
| `src/assign.js` | Placing every exhibitor by rule, with a reason for each exception |
| `src/loadin.js` | Load-in slots by aisle |
| `src/packet.js` | One printable page per exhibitor |
| `src/public-map.js` | The visitor map as one self-contained HTML file |
| `src/example-show.js` | A 120-booth example show with an invented accepted list |
| `src/ui/roster-panel.js` (UI) | Show floor → Exhibitors: import, list, place, exceptions |
| `docs/DEMO.md` | The two demonstrations click by click, and the director conversation |
| `public/about/index.html` | What it is, for artists and for shows; opens the app |

Changed: `src/hall.js` (B1 only: validation of the new optional fields),
`src/roles.js`, `src/ui/welcome.js`, `src/ui/render.js`,
`src/ui/show-floor-panel.js`, `src/actions/show.js`, `src/style.css`,
`public/sw.js` (C1: the new page in the shell), `HANDOFF.md` → Read map.

## Tasks

Each is one pull request. Every task: write the named test first and run it
to see it fail; make the change; run it to see it pass; then `npm run lint`,
`npm run typecheck`, `npm test`, `npm run build`, the view suites it touches,
and the whole `npm run test:view` before merging. Never through a pipe.
Commit messages in the repository's voice: what changed and why.

### Stage A — the artist's guided booth

- [ ] **A1. The steps, as data.** `src/guided.js`: `STEPS` — `booth`,
  `walls`, `light`, `hang`, `share` — each with a title, one line of help,
  the list of controls it shows (eight at most), and `done(p)`.
  `GUIDED_KEY = "booth.guided"`, a view setting per browser like the
  workspace, never in a project. Test `tests/guided.test.js`: five steps in
  that order; none lists more than eight controls; `done` is false on a
  quick-started booth for `hang` and true once a work is on a wall; a
  project is byte-identical before and after reading its steps.
  `node --test tests/guided.test.js`.
- [ ] **A2. The steps on screen.** `src/ui/guided-panel.js`, wired in
  `src/ui/render.js`: in the Artist workspace, after Quick start, the
  inspector shows the current step in place of the tab strip, with Back,
  Next and **All tools** (which shows the tabs as today, and **Guided**
  beside More returns). Quick start opens step 1 instead of the Layout tab.
  Someone with a saved project, or in Every tool or Show organizer, never
  sees it. Test `tests/view-guided.mjs`, at 1440 and at 390 px wide: first
  visit → My booth → Start this booth shows step 1; the inspector holds at
  most twelve visible controls on every step (it holds 106 on Layout
  today); Next reaches step 5; All tools brings the five tabs back; a
  reload returns to the same step; no sideways scroll.
  `node tests/run-views.mjs guided roles quickstart`.
- [ ] **A3. Walls and colour.** `src/wall-layouts.js`: `LAYOUTS` and
  `applyWallLayout(p, key)` for both booth kinds and both sizes the step
  offers (10 × 10, 10 × 20), using only what schema 1 has (`booth.walls`,
  `booth.panels`, `booth.color`); read `wallSpec`, `constrainPanel` and
  `applyVenue` in `src/model.js` first. `PANEL_COLORS`: plain names (black,
  charcoal, grey, white, tan, navy), no maker's. Test
  `tests/wall-layouts.test.js`: every layout × kind × size passes
  `validateProject`; applying one twice changes nothing the second time;
  work hung on a wall the layout removes moves to the nearest wall that
  remains and none is lost; a September backup with no `panels` takes each
  layout. Step 2 shows the layouts as four small plan drawings and the
  colours as swatches; `tests/view-guided.mjs` gains: choosing U with a
  centre wall puts a free-standing wall in the booth.
- [ ] **A4. Hang.** Step 4: **Add my pictures** takes several files at once
  (`src/ui/upload.js`), asks each one's width in inches once (the height
  follows the picture's shape), places each in the first open spot
  (`openSpot`) and offers **Space them evenly** (`evenHang` in
  `src/polish.js`). Test in `tests/view-guided.mjs`: three fixture images
  in, three works on walls, none overlapping, none out of bounds, each the
  width typed; cancelling the size leaves the library unchanged.
- [ ] **A5. Light.** Step 3: the four looks as cards and **Make it
  beautiful** — the existing actions, nothing new behind them. Test in
  `tests/view-guided.mjs`: choosing a look marks it as the booth's look
  (`currentLook`); undo restores the one before.
- [ ] **A6. Share.** Step 5: **Save a picture** (the hero set's front
  shot), **Hanging guide**, **Send a link** (the share link as it is), and
  **Open it on my phone** (Studio account, as it is — the reason to sign
  up). Read `docs/STUDIO-PLATFORM.md` first; if a stranger cannot create an
  account in production today, say so in Rulings and in checkpoint 1
  rather than building around it. Test: the picture downloads and its name
  says it is a rendering; signed out and offline, the first two still work.
- [ ] **A7. Examples.** `src/examples.js`: three finished booths — a
  painter's 10 × 10 tent, a photographer's indoor panel booth, a 10 × 20
  with pedestals — whose pictures are drawn in the browser on first open (a
  canvas of colour fields), never files. The welcome and Quick start gain
  **See an example**. Test `tests/examples.test.js`: each passes
  `validateProject` and hangs eight works or more inside its walls; view:
  an example opens with `public/assets` empty.
- [ ] **A8. The artist's demonstration is a test.** `docs/DEMO.md` → "An
  artist, five minutes": the clicks and what to say. `tests/view-demo-artist.mjs`
  walks exactly those clicks at 390 px and at 1440 px, from a first visit
  to a saved picture, in 25 clicks or fewer, signed out, and again with the
  network off after the first load. It joins CI's view shards. From here a
  change that breaks the demonstration cannot merge.

**Checkpoint 1 — the owner, on his phone, about ten minutes.** Into
`HANDOFF.md` → Next: do the artist demonstration from `docs/DEMO.md` with
five of his own pictures. Did any step make him stop and think? Are the six
panel colours the ones artists own? Is the saved picture one he would send?

### Stage B — the show director's job

- [ ] **B1. The accepted list, on the floor.** Optional
  `p.hall.roster` (1,200 at most): `{ id, name, medium?, score?, corner?,
  double?, note? }`, and optional `who` (a roster id) on a booth's record.
  Placing someone writes the booth's `name` too, so every sheet, map and
  CSV that exists keeps working untouched. Optional `p.hall.info`:
  `{ dates?, place?, contact?, rules?, loadIn? }`. Validation in
  `validHall` (`src/hall.js`) — **the one paired change with Art-Talk-Back
  in this phase**: rebuild `npm run bundle:scene`, update the platform's
  copy on its branch of the same name, merge back to back. Test
  `tests/roster.test.js`: a backup without either field loads; 1,201
  records, a duplicate id, a 121-character name and a `who` naming nobody
  are each refused; `tests/model.test.js` still passes unchanged.
- [ ] **B2. Bring the list in.** `src/roster.js`: `parseCSV(text)` (quoted
  commas and line breaks, a byte-order mark, CRLF), `guessColumns(header)`
  (Name, Artist, Business, First and Last joined; Medium, Category; Score;
  Corner, Booth type), `rosterFromRows`. Show floor → Exhibitors → **Import
  the accepted list** opens a matcher with the first five rows shown, and
  says how many came in and how many were skipped and why. Exporting:
  `hallCSV` cells that begin with `=`, `+`, `-` or `@` get a leading
  apostrophe, so a spreadsheet never runs an artist's name as a formula.
  Tests in `tests/roster.test.js`: each case above; 1,200 rows in under
  200 ms; importing twice does not double the list.
- [ ] **B3. The floor as neighbours.** `src/floor-graph.js`:
  `neighbours(h)` (side by side within 6″; facing across a walkway of 16 ft
  or less), `corners(h)` (two open sides), `doubles(h)` (20 ft wide or
  more). Test `tests/floor-graph.test.js` on the grid plan and on every
  `FLOOR_TEMPLATES` floor: a back-to-back pair are not neighbours through
  their shared back; an end booth is a corner; counts are stated in the
  test.
- [ ] **B4. Place everyone.** `src/assign.js`: `assign(h, { seed })` →
  `{ placed, unplaced, why }`. Never moves a booth that already has a
  `who` (the director's own placements are kept). Then, in order: doubles to
  those who asked; corners to those who asked, highest score first; then
  everyone else so that no two of one medium stand side by side, and as few
  as possible face each other. Deterministic for a seed. Every unmet
  request and every remaining clash is in `why`, in words a director would
  use. Test `tests/assign.test.js`: 150 booths, 150 artists, 12 mediums —
  no same-medium neighbours, everyone placed, same result twice; 20 corner
  requests for 12 corners — the top 12 by score get them and the other 8
  are named; 160 artists for 150 booths — 10 unplaced, named; pinned
  booths untouched; 300 booths in under one second.
- [ ] **B5. The Exhibitors panel.** `src/ui/roster-panel.js` in the Show
  floor tab: the list (search, filter by medium, unplaced first), **Place
  everyone**, the exceptions with their reasons, drag a name onto a booth,
  swap two booths, one Undo for the whole placement, and the map coloured
  by medium with a legend (the status colours stay one tap away). Test
  `tests/view-roster.mjs` at 1440 and 390 px: import the fixture CSV, place
  everyone, the count on the map equals the list, an exception is listed,
  a swap moves both names, Undo empties the floor again.
- [ ] **B6. Show details and load-in.** `src/loadin.js`: `slots(h)` gives
  each placed booth one of the director's load-in windows, by aisle, the
  far end first, the windows evenly filled. The panel's **Show details**
  holds the dates, the place, a contact and the rules as text. Test
  `tests/loadin.test.js`: every placed booth has one slot; no window holds
  more than its share plus one; a floor with no windows gives none and
  says so.
- [ ] **B7. A packet for each artist.** `src/packet.js`:
  `packetsHTML(h, name)` — one page each: the show, dates and place; the
  booth's number and size; the map with that booth marked; the neighbours'
  names; the load-in window; the rules; the contact. Print or save as PDF,
  all or one. Test `tests/packet.test.js`: one page per placed exhibitor; a
  name containing `<script>` is text on the page; no price, score, note or
  sale status anywhere in it; no address outside the file.
- [ ] **B8. The visitor map.** `src/public-map.js`:
  `publicMapHTML(h, name)` — one HTML file the show puts on its own site:
  the map, a list searched by name, medium or booth number, a tap on either
  marking the other, readable at 360 px, working with no network, carrying
  no price, score, note or status. Test `tests/public-map.test.js` for the
  private fields and for requests; `tests/view-roster.mjs` opens the file,
  types a name and finds its booth marked.
- [ ] **B9. An example show.** `src/example-show.js`: 120 booths on an
  outdoor floor template and 110 accepted exhibitors named by number
  ("Exhibitor 014") across twelve mediums, with scores and twenty corner
  requests. The welcome's A show floor gains **See an example show**. Test:
  it passes `validateProject`; `assign` places all 110.
- [ ] **B10. The director's demonstration is a test.** `docs/DEMO.md` → "A
  show director, ten minutes", and → "The conversation" (the questions
  below). `tests/view-demo-director.mjs`: example show → Place everyone →
  move one artist by hand → packets → visitor map → walk the show in 3D,
  signed out. It joins CI's view shards.

**Checkpoint 2 — the owner, on his laptop, about fifteen minutes.** Into
`HANDOFF.md` → Next: do the director demonstration. Is "no two of one
medium side by side" how the directors he knows think, and what rule is
missing? Would he hand a director this packet? Then the five conversations.

### Stage C — ready to show people

- [ ] **C1. A front page.** `public/about/index.html`, linked from Help and
  the welcome: what it does for an artist, what it does for a show, two
  pictures each made by the app's own export (`tools/about-shots.mjs`
  drives the examples and writes them), one button into the app. Plain HTML
  and CSS, no script but the service worker's registration; added to the
  offline shell. Test: `npm run test:offline` opens it with no network; the
  site-wide checks in `tests/view-responsive.mjs` cover it at 390 px.
- [ ] **C2. The pitch deck tells the truth.** `public/pitchdeck/index.html`
  promises what stages A and B built and nothing else; what is planned is
  under a heading that says planned.
- [ ] **C3. A phone and keyboard pass over both demonstrations.** Every
  control in the guided steps and the Exhibitors panel reachable and
  labelled from the keyboard and to a screen reader; every empty, loading
  and error state has words. Each gap found gets a check in the suite that
  owns it.
- [ ] **C4. Hand off.** `HANDOFF.md` → Now, Next and Read map;
  `docs/HISTORY.md`; ROADMAP.md's boxes for what this delivered (3.2, 3.6,
  3.7 and 3.8's on-device versions).

**Checkpoint 3 — the owner, once, before anyone outside is sent a link.**
The name and the domain (a purchase, so his); what the directors said; and
from that, a yes or no to stage D's server work and to payments.

### Stage D — after directors have seen it (not planned here)

Each needs the owner's yes and its own phase document, and each should wait
for something a director or an artist actually said: the hosted show
(ROADMAP.md phase 3: invitations, each artist's own door, submitted designs
checked against the show's rules); an assistant that answers artists'
questions from the show's own details and knows each artist's booth; a
gallery of booths artists choose to publish, as the seed of a community; a
site plan with aisle and fire-lane widths for a city permit; payments
(phase 4).

## The owner's half: five conversations

Twenty minutes each, after checkpoint 2, with the example show on screen.
Ask, then listen: How do you place artists today, with what, and how long
does it take? What went wrong at the last load-in? How many emails from
artists in the month before the show, and about what? What do you pay for
applications and jurying now? If I took your map and your accepted list and
gave you back the layout, a packet for each artist and a map for the public
in two days, what would that be worth? **What decides stage D:** two of
five saying they would pay to have it done is a yes to the hosted show; none
is a signal to look at panel makers and artists instead, and to say so.

## Review focus

What no single task's test covers, each owned by the task named:

- A backup from September opened after B1 (B1); a floor with booths and no
  roster (B5); a roster and no floor (B5).
- A 1,200-row list with accents, emoji and a 300-character note (B2).
- A phone held upright in the sun: the guided steps and the visitor map at
  360 px with large text (A2, B8).
- No network from the first minute at the show: the packets and the map
  open from a file (B7, B8).
- A director's private numbers reaching an artist: prices, scores, notes
  and statuses are searched for in every artist-facing and public output
  (B7, B8).
- An artist who never wanted the steps: All tools is one tap, and stays
  chosen (A2).

## For the owner

Only the three checkpoints above. Everything else in `HANDOFF.md` → Next
stays as it is and none of it blocks this phase.

## Rulings

Judgement calls made while building: what was decided, why, and what it
costs if wrong. Newest first.

- 2026-11-13 · CI's `core` and `views` jobs are pinned to `ubuntu-24.04`
  (`.github/workflows/ci.yml`), because `ubuntu-latest` became 26.04 and
  Playwright 1.56.1 will not install Chromium build 1194 there. Cheap and
  safe now; the cost if left is an image that one day goes away. Moving on
  is its own small task for a quiet moment: a Playwright that supports the
  new image, its Chromium build in `BOOTH_TEST_CHROMIUM`, and all view
  suites green on it before the pin is lifted.
- 2026-11-13 · This plan was written from the code's structure, the live
  site seen in a headless browser, and web search results; no competitor's
  page could be opened and no artist or director has been asked. Every rule
  in B4 is a guess from two trade articles. If the directors' rules differ,
  `assign`'s order is one table to change.
