# Booth Studio — the road to a product people pay for

Written 2026-10-20, after Rev 1 (workspaces, looks and the hero set, the
assistant on the welcome) was merged. This is the phase-by-phase plan from
"a strong engine nobody has used yet" to software that show organizers,
galleries and display companies buy and artists rely on every season. It
extends the Claude Doc "Booth Studio — Revision Plan"
(https://claude.ai/artifact/QSXHZbhe2S3P4f51oVCAHV) rather than replacing it:
that doc's Rev 1 is built, its Rev 2 (the hosted Show Hub) is phases 3 and 4
here, and its Rev 3 (exhibitions) is phase 5. Where the two differ, the owner
decides.

**How to use this file.** Work one phase at a time, in order, except where a
phase says it can run alongside another. Before writing code in a phase, give
it its own `<NAME>_PHASE.md` at the root (the repo's habit: `ART_SHOW_PHASE.md`,
`WALLS_PHASE.md`) with the detailed plan, then tick the boxes here as pull
requests land. A phase is finished only when its **gate** passes — a gate is
something people did, not something the code does. Every owner decision is
marked **Owner:** with the default this plan proposes, so a session can see
what it may build and what it must wait for. `HANDOFF.md` stays the record of
what is built; this file is the record of where it is going.

## Where it stands

The engine is broad and unusually deep for one product. What is built and on
`main` today, with no equivalent in any single competitor found:

- Measured booths in inches: canopy tents and indoor pro-panel booths, six
  hangable wall faces, free-standing walls, pedestals, furniture, a light bar
  with aimed heads, HDRI environments, PBR floors, people for scale.
- Paper that works on the day: the hanging guide, elevations to scale, the
  show pack (plan, inventory, checklist), the power and rentals sheet.
- Pictures and film: 4096 px stills, MP4 camera moves and a keyframed
  timeline, the hero set, named looks and Make it beautiful.
- A show floor of up to 1,200 booths and 2,400 pieces, with sales status,
  exhibitor CSV, templates, clearance checks, a full booth design linked to
  each booth number (up to 60), and the assembled show walked in 3D.
- Booths sent as links (the share Worker and R2), studio sign-in and sync
  across devices, and an assistant that builds a booth or a floor from words,
  a sketch or a photo of a show map.
- Local-first: signed out, all of it runs on the device with no network.

What holds it back from being a product:

1. **Nobody has used it.** Almost everything since September is unseen by a
   real person on a real device (`HANDOFF.md` → Next). This is the largest
   risk in the whole plan, and phase 0 exists to retire it.
2. **It is a toolbox, not an outcome.** About 60 tool shortcuts and a long
   tab strip answer "can it do X"; few paths answer "I have a show in three
   weeks — get me ready". People pay
   for finished jobs: a booth set up in half the time, a floor where every
   exhibitor's booth is checked before load-in.
3. **The valuable half is not connected yet.** The organizer's floor and the
   exhibitor's booth both exist, but only as a file or a link passed by hand.
   The link between them is the product (see Positioning).
4. **Trust plumbing is missing.** No installable offline app, no protection
   against the browser deleting saved work, no error reports, no billing, no
   custom domain, no terms or privacy policy, no help pages.
5. **The code has outgrown its shape.** `src/main.js` is 6,961 lines, nearly
   all inside one `boot()` closure; `src/scene.js` is 3,530. The first load
   is one 1,087 KB script (318 KB gzipped). `HANDOFF.md` is 3,208 lines
   (223 KB) and every session reads it first. Tests are strong — 479 Node
   tests and 41 browser suites — and are what make the clean-up below safe.

## The market (as of 2026-10-20)

Prices and features below come from web search results; this sandbox could
not open the vendors' pages, so treat every figure as unverified and check
the vendor's own page before quoting it to anyone. Sources are at the end.

| Product | Who it is for | What it does | Price found |
| --- | --- | --- | --- |
| ArtPlacer — Art Fair Planner | Artists, galleries | Booth walls at real size, artwork placed in proportion, web and mobile; also room mockups, AR, virtual exhibitions | Artists $9–27/mo; galleries $45–169/mo |
| BoothFlow | Artists (iPad) | 2D booth floorplan with presets, ProPanel walls, elevation view, artwork inventory | Free (released Jan 2026) |
| SketchUp Free | Anyone | General 3D modelling in the browser | Free web version |
| Eventeny | Festivals, fairs, markets | Vendor applications, jury, fees; interactive map on its top plan | Basic free; Plus $120/mo yearly; Pro about $240–360/mo |
| ExpoFP | Expos, trade shows | Interactive floor plans; exhibitors pick and pay for a booth on the map | From $149/mo (DIY) |
| ZAPP | Juried art fairs | Applications, jurying, booth payments; booth requests since Jan 2025 | Organizer price not public; artists paid on average $34.70 to apply and $439.58 for a booth in 2024 |
| Cvent Social Tables / Prismm | Event planners | 2D diagrams with a 3D preview; 3D rendering on Enterprise | Free; $49 / $150 / $320 per month |
| Kunstmatrix, Artsteps | Galleries, artists | Virtual 3D exhibitions online | Kunstmatrix from about €10–12/mo; Artsteps free |

What this says:

- **Arranging pictures on a booth wall is already free or cheap.** ArtPlacer,
  BoothFlow and SketchUp cover it. Booth Studio does it better (3D, light,
  measured paper, film), but "better pictures of my booth" alone will be
  priced against $0–27 a month.
- **Organizer tools stop at a 2D box with a name in it.** Eventeny, ExpoFP and
  ZAPP sell applications, jurying, booth sales and maps. None of them knows
  what each exhibitor will build inside their box, whether it fits the
  show's rules, or what the assembled show will look like.
- **Nobody connects the two.** That connection is what Booth Studio already
  half-has: measured booths, and a floor with a design linked to each number.
- **The money is on the organizer side.** An artist pays about $440 for a
  booth and $35 to apply. A 150-booth fair takes in about $66,000 in booth
  fees; a tool that costs it 1% of that is easy to justify if it saves the
  director a week of email and a bad load-in.
- **Name collision.** "Booth Studio" is already a free photo-booth app with a
  Pro in-app purchase on Apple's App Store (released Dec 2024). Settle the
  name before any public launch (phase 0).

## Positioning

**The show's official floor plan, with every exhibitor's real booth in it.**
The organizer publishes the floor; each exhibitor opens their own booth,
already the right size, in the right spot, with the show's rules built in;
they design it in 3D and submit it; the organizer sees the assembled show,
every booth checked, and publishes a map visitors can search. Organizers pay.
Exhibitors come free through their shows, and stay because the artist tools
— plan, buy, set up, sell, learn — make their whole season easier.

Who buys, in the order this plan reaches them:

1. **Art and craft fair organizers** (phase 3–4). Pay per show or per year.
2. **Artists** (phase 2 and 4). A free core that works offline forever; a
   paid plan for services that cost money to run.
3. **Galleries, university galleries and museums** (phase 5). An annual
   licence for exhibition planning: checklist → hang → labels → install.
4. **Display makers and rental companies** (phase 6). A white-label booth
   configurator that turns a design into a parts list and a quote request.

Principles that do not change on the way: local-first (signed out, the app
works with no network); schema 1 forever; extend, don't rebuild; nothing
leaves the device or moves money without a confirm; a rendering is always
labelled as a rendering; a lapsed plan never locks anyone out of their own
work — export always works.

## The phases at a glance

```
Phase 0  Prove it and decide ........ owner-led    ─┐ run together
Phase 1  Foundations ................ agents        ─┘
Phase 2  The artist's season ........ after 1's split of main.js
Phase 3  The show's official floor .. owner: yes to server work      (Rev 2)
Phase 4  Paid ....................... owner: yes to payments          (Rev 2)
Phase 5  Exhibitions & institutions . can move ahead of 3–4          (Rev 3)
Phase 6  Partners and scale ......... after the first paying organizers
Track    Go to market ............... from phase 2 on, owner-led
```

Each phase's gate must pass before the next begins, with two exceptions:
phases 0 and 1 run side by side (one is people, the other is code), and
phase 5 may jump ahead of 3 and 4 if the owner holds off on server work or
payments, as the Revision Plan already allows.

---

## Phase 0 — Prove it and decide

**Goal:** real people have used Rev 1 on their own devices, and the owner
has made the decisions that every later phase waits on.

**Why first:** every later phase is a bet on what people want. Ten
conversations and five watched sessions cost a few days and can save months
of building the wrong thing.

- [ ] **The owner's Rev 1 checklist** (`HANDOFF.md` → Next, item 0) on the
      live site, in a private window, then on a phone.
- [ ] **Five watched sessions** — three artists, one show organizer, one
      gallery or university-gallery person — each on their own device, with
      a real upcoming show or exhibition. Script in the appendix. Measure the
      time to a first export, where they stall, and what they ask for.
      Don't help; write down where you wanted to.
- [ ] **Ten organizer conversations** — directors of art fairs, craft fairs
      and festivals (Art Fair Insiders, NAIA, ZAPP shows, local markets).
      Questions in the appendix. The aim is two shows willing to pilot
      phase 3 in their next season.
- [ ] **Owner decisions**, each logged in `HANDOFF.md` with its date:
  - **Who pays first.** Default: organizers (see Positioning).
  - **Product name and domain.** "Booth Studio" collides with an App Store
    photo-booth app. Default: keep "Booth Studio" inside "Artist OS" until a
    name is chosen, and move to a custom domain in phase 1 (see 1.11 for why
    that is not just a DNS change).
  - **What stays free.** Default: everything that runs on the device stays
    free, including what `src/tier.js` lists as Pro today; money comes from
    services (hosting, sync across devices, AI renders, organizer floors).
    Alternative already on record (`FUTURE_BUILD.md`): a one-time Pro unlock
    for device tools. `LOCKS_ON` is `false` until this is decided.
  - **Error reports and usage counts.** Default: first-party only, through
    this app's own Worker, no third-party trackers, no personal data, and
    off until the owner says so. Server-side, so the owner's call.
  - **Payments provider.** Default: Stripe (Checkout, Customer Portal, Tax),
    decided now, built in phase 4.
  - **Image service for photoreal renders** and its monthly spend cap
    (`AI_EXPORT_PHASE.md`; `provider` in `src/ai-render.js`).
  - **Terms of service and privacy policy.** Needed before phase 3 invites
    the first exhibitor. A lawyer's job, not a session's.

**Gate:** at least 3 of the 5 testers finish a booth or a floor without
help; at least 2 organizers agree to pilot phase 3; the decisions above are
logged. **If the gate fails** — testers stall, or no organizer wants it —
stop and fix what they hit before building anything in phase 2 or 3.

---

## Phase 1 — Foundations

**Goal:** the app is safe to rely on, quick to load, installable for use
offline at a show, and its code can take the next three phases without
slowing every session down. No new features; nothing a user sees changes
except what keeps their work safe.

**Runs alongside phase 0.** All of it is agent work. Each item is one or
more small pull requests, each green on every suite before it merges.

- [ ] **1.1 Make the handoff fast to read.** Split `HANDOFF.md` (3,208 lines)
      into `HANDOFF.md` — what is true now, the rules, Next; aim under 500
      lines — plus `docs/HISTORY.md` (every round, moved verbatim) and
      `docs/DECISIONS.md` (the owner's answers, numbered B-001…, dated, each
      linking to where it was built). Mechanical: nothing deleted, only moved.
      Every session pays for the current length before doing anything.
- [ ] **1.2 Split `src/main.js` along the seams it already has.** Almost all
      of its 6,961 lines are inside `boot()`. Move, without changing
      behaviour: the panel builders (`*Section`, `*HTML`, `*Fields`) into
      `src/panels/<tab>.js`; the `actions` object (from about line 4,080,
      over a thousand lines) into one module per area (`src/actions/`),
      merged back into one table at start; the timeline dialog,
      share and Show Hub, welcome and roles, and the show-floor panel into
      `src/ui/`. Each module receives one context object (`p`, `mutate`,
      `scene`, `toast`, …) instead of reaching into the closure. One seam per
      pull request, every view suite green on each. Target: `main.js` under
      1,500 lines.
- [ ] **1.3 Split `src/scene.js`** the same way: booth build, light rig,
      picking and interaction, export and render passes.
- [ ] **1.4 Type checking without a build step.** `// @ts-check` with JSDoc
      types and `tsc --noEmit --checkJs` in CI, starting with the modules
      `npm run bundle:scene` ships to studio-api (`model.js`, `scene-ops.js`,
      `placement.js`, `quickstart.js`, `arrange.js`), because a mistake there
      breaks the platform as well as the app. Then the other pure modules.
      *(2026-10-20: the first half is in — `npm run typecheck`
      (`tsconfig.json`) checks `src/scene-ops.js` and everything it imports,
      against a Worker's globals, in CI. 2026-10-21: and `tsconfig.app.json`
      every other module in `src/` against a browser's, but three: `main.js`
      and `scene.js` wait for their split (1.2, 1.3) — 493 findings between
      them on the day — and `studio.js` imports the vendored SDK, which has
      no types of its own. Left: those three.)*
- [x] **1.5 A linter in CI.** ESLint's flat config with its recommended
      rules plus `no-undef` and `no-unused-vars`. Fix what it finds in the
      same pull request, or turn the rule off with a reason.
      *(2026-10-20: `npm run lint`, `eslint.config.js`; fourteen findings
      fixed — thirteen unused names and a needless escape. No rule is off;
      two are loosened, with the reasons in the config: an empty `catch {}`,
      and unread parameters, caught errors and `_` names.)*
- [ ] **1.6 A lighter first load.** Load on first use, not at start: video
      export, the timeline and the batch; the show floor and the 3D show;
      the print sheets (hanging guide, elevations, show pack, power, hall
      map); the AI pack. `GLTFLoader`, `GLTFExporter`, the studio and the
      assistant are already split this way. Target: the first script under
      650 KB minified. Measure a phone's first load before and after.
      *(2026-10-20, measured: of the 1.1 MB script, three.js's core is 550
      KB and main.js 245 KB; everything this item names to load later comes
      to about 50 KB, so that alone moves little. Done first: three.js in a
      chunk of its own (`vite.config.js`), whose name and bytes stay the same
      from deploy to deploy — the app's half is now about 525 KB, and a
      returning browser revalidates three.js's 144 KB (gzipped) with a 304
      instead of fetching it again. The rest of the target needs 1.2,
      main.js split.)*
- [x] **1.7 Installable and offline.** A web app manifest and icons; a
      service worker that keeps the app shell for use with no signal and
      caches textures and HDRIs as they are first used, never all 29 MB up
      front; then ask `navigator.storage.persist()` after the first save.
      Safari can delete a site's IndexedDB after seven days of use without a
      visit (WebKit's storage cap, since Safari 13.1), and installed
      home-screen apps are counted separately — an artist who doesn't open
      the app between shows could lose their booth. Test this on a real
      iPad; no session can.
      *(2026-10-20: built — `public/sw.js`, `public/manifest.webmanifest`,
      `public/icons/`; `npm run test:offline` proves it in CI. The persist()
      request is the "Ask the browser to keep it" button of 1.8, never
      automatic, because Firefox answers it with a permission prompt. The
      real iPad is in HANDOFF → Next.)*
- [x] **1.8 Show how safe the work is.** In Export → Keep your work: whether
      storage is persistent, how much is used, when the last backup was
      downloaded, and whether the studio has this project. Remind the artist
      to back up when they have not for 30 days (a toast, never a block).
      *(2026-10-20: built — `src/keep-safe.js`. The persist() request from
      1.7 is the "Ask the browser to keep it" button there, never automatic,
      because Firefox answers it with a permission prompt.)*
- [x] **1.9 Errors you can see.** Catch `error` and `unhandledrejection` into
      a small ring buffer; Help → Report a problem copies the build
      (`window.BOOTH_BUILD`), browser, `window.BOOTH_ASSETS` and the last
      errors, ready to paste. Sending reports to a Worker route waits on the
      owner's decision in phase 0. *(2026-10-20: built — `src/report.js`;
      Export → Something wrong? → Copy a problem report. Nothing is sent.)*
- [ ] **1.10 CI that is quick and checks more.** Run the 41 view suites as
      parallel shards (the CI runner has more cores than this sandbox), so a
      pull request is checked in under 30 minutes. Fix the one known failure:
      `tests/wall-assets.mjs` line 120, a sideways scroll at 820 px on the
      Artwork tab. *(2026-10-20: both done — four view shards and a
      cancelled run for a superseded push; the overflow was every iPad width,
      fixed, and the suite is in CI as `view-wall-assets.mjs`. Left: site-qa
      and Dependabot.)* Add site-qa (`yitzhach/site-qa`, as in art-show-tracker):
      desktop, phone and dark-mode audits for page errors, broken links and
      accessibility, with today's findings as the baseline. Dependabot for
      npm and GitHub Actions.
- [ ] **1.11 A custom domain without losing anyone's work.** Projects saved
      signed-out live in IndexedDB on `booth-studio.bobdylan2000.workers.dev`,
      and a new domain is a new origin that cannot read them. The bridge: the
      old address keeps serving the app and offers "Move my projects to the
      new address", which opens the new address as a top-level window and
      hands the projects over with `postMessage` after the person confirms.
      Not an iframe: browsers partition storage inside third-party frames,
      so a frame of the old origin would see none of it. Signed-in projects
      come over by sync on their own. Keep the Worker name `booth-studio`
      either way. Needs the owner's domain from phase 0.
- [ ] **1.12 Security headers from the Worker.** A Content-Security-Policy
      (scripts from this origin only; images also from `blob:` and `data:`),
      `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`.
      Check video export, the share links and the assistant still work under
      it.

**Gate:** every suite green in CI in under 30 minutes; `main.js` under 1,500
lines; the first script under 650 KB; the app installs to a phone's home
screen and opens a saved booth in airplane mode; site-qa shows no new
accessibility failures; no behaviour changed (the suites' assertions are
untouched; only their imports moved).

---

## Phase 2 — The artist's season

**Goal:** an artist runs a whole season from the app: plan the booth for a
real show, know what to buy, set it up from their phone in less time, record
what sold where, and learn which spots sell. That is what no free tool does.

**Starts after** 1.2 and 1.3 have landed (otherwise every item collides with
the split). Builds on the platform's existing records: `artworks`, `shows`,
`sales` and `placements` (Art-Talk-Back migrations 0001–0006). Items that
need a platform change merge on Art-Talk-Back first, because this app's
`main` talks to production `studio-api`.

- [ ] **2.1 Metric and currency.** Most fairs outside the US measure in
      centimetres. Show lengths in feet and inches or in centimetres and
      metres as a view setting (like the tier: per browser, never in a
      project). The project stays in inches — `units: "inches"` is schema 1
      and stays — so this is display and input only. The print sheets follow
      the setting. Prices format with `Intl.NumberFormat` and an optional
      currency on the hall plan instead of a hard-coded `$`.
- [ ] **2.2 Hang from the inventory.** Signed in, the library shows the
      studio's artworks — one record, with framed size, medium, price and
      status — and hanging one places it at its real size with no upload.
      Signed out, the library works as it does today.
- [ ] **2.3 Plan for a show you are going to.** Pick a show from Show
      Tracker (the ledger, or the catalogue's heart list): the booth takes
      its size, indoor or outdoor, dates and booth number, and the project
      remembers which show it is for. Needs a link from a placement to a
      show on the platform (a migration: platform first).
- [ ] **2.4 What to buy, what to bring.** A parts list from the design:
      panels by size, lights, weights for each tent leg, pedestals, bins,
      tables, cords. The artist marks what they own; the rest is a shopping
      list with their own prices. Vendor-neutral; affiliate links are the
      owner's call. Builds on `src/power.js` and `src/showpack.js`.
- [ ] **2.5 Setup day, on the phone, offline.** Wall by wall, piece by piece:
      where each work goes (inches from the left edge, height to its centre,
      the hook's drop from the top for its wire or D-rings), a box to tick,
      and the next piece. A timer, so the artist can compare with their last
      setup. Builds on `src/guide.js` and `src/elevations.js`; works in
      airplane mode once 1.7 has landed.
- [ ] **2.6 Labels and a price list.** Print wall labels and price tags
      (title, medium, size, price, an optional QR code) on standard label
      sheets, and a price list. Large-print by default, so they read from the
      aisle. Later, the QR code can show the work at true size on a buyer's
      own wall (`FUTURE_BUILD.md` item 3: USDZ for iOS Quick Look, `.glb`
      for Android Scene Viewer). That needs hosting all season, so it is a
      paid service once phase 4 exists.
- [ ] **2.7 Log a sale where it hung.** At the show, offline: tap the work,
      tap Sold. The sale goes to Show Tracker's `sales` with the work's place
      in the booth — wall, height, facing the aisle or not, which light was
      on it.
- [ ] **2.8 Where things sell.** After a few shows: sales by wall, by height,
      facing the aisle or not, lit or not, by price band. Honest about small
      numbers, the tracker's way — "3 shows, 11 sales: too few to call" —
      and never a percentage over a handful.
- [ ] **2.9 Attention map** (`FUTURE_BUILD.md` item 2). Simulated visitors
      walk the aisle both ways; each work is drawn in its own flat colour
      from each eye point (an extension of the AI pack's mask pass,
      `applyPass` in `src/scene.js`); each work scores seconds seen × size
      seen; the walls are shaded by score. "Your strongest piece is on the
      wall people see least." Runs on the device, so it can stay free.
- [ ] **2.10 The real booth photograph.** Juried shows want a photograph of
      the booth, not a picture of a model. So plan the photograph: where to
      stand, at what height, with what lens on a phone, how to light it, a
      shot list. Any rendering the app exports says "rendering" in its file
      name and metadata.
- [ ] **2.11 Photoreal renders** (owner: the image service and its spend
      cap). `AI_EXPORT_PHASE.md` is the plan; the pack is built and
      `provider` in `src/ai-render.js` is the one line to set. The key lives
      behind a studio Worker route, never in this app, and renders are paid
      for with credits once phase 4 exists.

**Gate:** five artists use the app for a real show — setup mode or the
hanging guide on the day — and report their setup time against their
previous show; at least three say what they would pay for it and how much;
no one loses work.

---

## Phase 3 — The show's official floor

**Goal:** a real show runs its floor in Booth Studio. The organizer
publishes the floor; every exhibitor designs their own booth on it, to the
show's rules; the organizer sees and checks the assembled show and publishes
a map visitors can search. No payments yet: booth fees stay wherever the
show collects them today (ZAPP, Eventeny, their own system).

**Owner:** yes to the server work. This is the Revision Plan's Rev 2 without
payments, and the pitch deck's "Show Hub — promoters pay". The file and
share-link versions exist (`src/linked.js`, `src/share.js`,
`worker/index.js`); what is missing is accounts on both sides, a floor that
lives on the platform, and the link between an organizer's studio and an
exhibitor's.

- [ ] **3.1 The platform design, first.** The hard question is tenancy: the
      floor belongs to the organizer's studio and the booth to the
      exhibitor's, and every row carries one `studio_id` from the session
      (Art-Talk-Back's rule). Write the decision on the platform (D-0xx):
      floors, booth records (number, size, status, exhibitor), invitations,
      claims, design submissions (a read-only snapshot of the exhibitor's
      placement handed to the floor) and review states. Tenancy tests:
      neither side reads anything of the other's beyond what was submitted.
- [ ] **3.2 Bring the exhibitors in.** Import the accepted list as CSV from
      ZAPP, Eventeny, EntryThingy or a spreadsheet, with a column matcher.
      Assign booths by drag or automatically; send invitations by email
      through the platform (its phase 4 email, Resend).
- [ ] **3.3 The exhibitor's door.** The invitation opens their booth already
      set: size, number, neighbours, which walls they may use, and the
      show's rules. They design it — Quick start, the assistant, Make it
      beautiful — and press Submit. A free account. The booth stays theirs,
      in their studio, ready for their next show.
- [ ] **3.4 The show's rules as data.** Maximum height, footprint, nothing
      over the aisle line, weights per tent leg, fire-lane clearances, power
      per booth against what was ordered. Every submitted design is checked
      and each failure says why and where. Builds on `src/clearance.js` and
      `src/power.js`.
- [ ] **3.5 Review the assembled show.** Every submitted design on the floor
      in 3D, approve or ask for a change, with comments. Today only the open
      design is drawn in full and the rest are drawn light (`linked.js`,
      `MAX_DESIGNS = 60`); drawing a 150-booth show in full needs shared
      geometry, simpler distant booths and a cap on what is drawn at once.
      Measure on a mid-range laptop.
- [ ] **3.6 Each exhibitor's kit.** One page each: the map with their booth
      marked, their load-in time, the rules, the power they ordered, and
      their own hanging guide.
- [ ] **3.7 Load-in.** Time slots by door and aisle, so vans don't all
      arrive at once; a printable schedule; a change tells the people it
      moves.
- [ ] **3.8 The public map.** A published page: the floor, a searchable list
      of exhibitors (name, medium, booth), a 3D preview, made for phones,
      with a QR code for the entrance and a snippet for the show's own
      website. Served as a static snapshot from the Worker, so it stays fast
      and cheap on show day.
- [ ] **3.9 Price booths from data.** The attention map from 2.9 run over the
      whole floor: footfall and visibility per booth, so the organizer can
      price corners and end caps from evidence.
- [ ] **3.10 Promotion.** A walkthrough film and a hero set of the assembled
      show, for the organizer's marketing, from the engine that already
      exists.

**Gate:** one real show runs its floor in the app — at least 20 exhibitors
claim their booth, at least half submit a design, and the public map is
used on the day — and the organizer can say how many hours it saved. Zero
cross-studio leaks in the tenancy tests.

---

## Phase 4 — Paid

**Goal:** organizers and artists can pay, and the people who pay get what
they paid for on every device, without a single saved project ever being
held hostage.

**Owner:** yes to payments (the project's rules forbid them today). The
platform comes first: billing is shared across Artist OS (Art-Talk-Back's
spec, phase 6: "usage metering, tiers and caps").

- [ ] **4.1 Billing on the platform.** Stripe Checkout and Customer Portal;
      webhooks into an `entitlements` table in studio-api (plan, seats,
      show licences, render credits); Stripe Tax; receipts; cancel, refund
      and failed-payment paths, all tested.
- [ ] **4.2 `can()` reads the entitlement.** `src/tier.js` is already the one
      place every Pro check goes through. Signed in, it reads the studio's
      entitlements instead of a browser switch. Signed out, everything that
      runs on the device stays as phase 0 decided.
- [ ] **4.3 Plans.** Hypotheses to test with the phase 3 pilots, not
      decisions:
  - *Artist Free* — every tool that runs on the device, offline, forever.
  - *Artist Pro* — what costs money to run: hosted links and QR labels,
    AI render credits, season analytics, the bundle with Show Tracker.
    Anchor: ArtPlacer's artist plans at $9–27 a month.
  - *Organizer, per show* — priced by booth count, around 1% of the show's
    booth revenue (for example $3–5 a booth). Anchors: Eventeny Pro about
    $240–360 a month, ExpoFP from $149, Social Tables $49–320.
  - *Organizer, yearly* — for shows that run several events a year.
  - Exhibitors of a licensed show get that show's paid features for free:
    the growth loop that brings artists in.
- [ ] **4.4 A pricing page, a trial, and honest prompts.** An upgrade prompt
      never interrupts a save, never hides a project, and export always
      works for a lapsed plan.
- [ ] **4.5 Not now: collecting booth fees.** Taking an exhibitor's booth
      fee for the organizer means Stripe Connect, chargebacks and more
      legal exposure, and it competes with ZAPP and Eventeny head-on.
      Integrate with them instead; revisit after ten paying organizers.

**Gate:** ten paying customers, at least two of them organizers; one
renewal; refunds and cancellations tested on real money; each churned
customer's reason written down.

---

## Phase 5 — Exhibitions and institutions

**Goal:** a gallery, a university gallery or a small museum plans and
installs a real exhibition in the app, from the works checklist to the wall
labels to the install sheets. This is the Revision Plan's Rev 3, and it can
move ahead of phases 3 and 4 if the owner holds off on server work or
payments.

- [ ] **5.1 Rooms from a floor plan.** The floor-plan underlay scaled by two
      clicks already exists; trace walls on it to make rooms, with doors,
      ceiling heights and lighting tracks.
- [ ] **5.2 The checklist in.** Works from CSV or a spreadsheet: title,
      artist, date, medium, dimensions, weight, lender, credit line,
      insurance value, image. New fields optional, as schema 1 requires.
- [ ] **5.3 Hang by room.** Sight lines, a chosen centre line (57″ to 60″),
      hardware and weight per wall.
- [ ] **5.4 Labels.** Wall labels and extended labels with accessible type
      presets (large print, contrast), printed to templates, with a column
      per language.
- [ ] **5.5 A lighting plan.** Fixtures on tracks, aimed (Make it beautiful's
      `aimLights` already does this for a booth), with a light-level target
      the institution sets per work. The app records the target and shows
      it; it never prescribes conservation levels.
- [ ] **5.6 Install and de-install sheets** per wall; a crate list; a
      schedule; condition photos attached to each work.
- [ ] **5.7 Working as a team.** Comments on a wall or a work, history from
      the platform's activity log, roles (curator, registrar, preparator)
      from the platform's `memberships`, approvals.
- [ ] **5.8 The exhibition online.** A published walkthrough with labels —
      what Kunstmatrix and Artsteps sell on their own — as a static snapshot.
- [ ] **5.9 What institutions need to buy.** Single sign-on through the
      platform, a WCAG 2.1 AA conformance report, a data-processing
      agreement, full export, an audit-log export.

**Gate:** one institution plans and installs a real exhibition in it and
says it replaced SketchUp-plus-spreadsheet (or whatever they used before).

---

## Phase 6 — Partners and scale

**Goal:** others sell and embed it; it runs without the owner watching it.

- [ ] **6.1 A white-label configurator** for panel makers and display rental
      companies: their own catalogue of panels and lights, a design turned
      into a parts list, and a quote request sent to them. An annual
      licence per partner.
- [ ] **6.2 The API and an MCP server** from the platform's registry
      (Art-Talk-Back phase 6), with webhooks such as `design.submitted` and
      `booth.claimed`. The scene ops in `src/scene-ops.js` are already what
      an agent calls.
- [ ] **6.3 Integrations** beyond CSV where the other side offers an API:
      ZAPP, Eventeny, EntryThingy; Square and Shopify sales (Show Tracker
      already imports their CSVs).
- [ ] **6.4 Other languages.** Move the interface's words into one table;
      Spanish, French and German first; metric by default where the locale
      expects it.
- [ ] **6.5 An App Store presence**, only if it proves necessary (BoothFlow
      is iPad-only, so some artists will look there first): a thin wrapper
      around the installed web app.
- [ ] **6.6 Running it.** A status page and uptime alerts, a help centre, a
      support inbox with a reply-time promise, release notes in the app.

**Gate:** one partner contract signed; at least 60% of phase 3–4 organizers
come back for their next show.

---

## Track — Go to market (from phase 2 on, owner-led)

Not code, but nothing above matters without it. Agents can draft; the owner
decides and sends.

- [ ] A landing page on the main domain, with the app on its own path or
      subdomain: what it does, for whom, a demo film made with the app's own
      video export, pricing once phase 4 exists.
- [ ] A help centre: one short page and a 60-second film per job (plan a
      booth, set up from the phone, run a floor, hang an exhibition).
- [ ] One case study from each pilot: the show, the numbers, the director's
      words.
- [ ] Where the buyers are: Art Fair Insiders, NAIA, ZAPP's organizer
      community, festival associations, panel makers' customer lists.
- [ ] Usage numbers to watch, once the owner decides on counting (phase 0):
      first export in the first visit; time to first export; artists who
      come back within 30 days; designs submitted per exhibitor invited;
      floors published; trial to paid.

---

## Risks

- **Nobody wants it in this shape.** Retired only by phase 0 and the pilots.
  If the organizers say no, phase 5 (institutions) or 6.1 (partners) may be
  the better business; the engine serves all three.
- **Scope keeps growing.** About 60 tool shortcuts already. Every phase above adds
  paths through existing tools; a new tool needs a gate's evidence.
- **The browser loses someone's work.** 1.7, 1.8 and sync. Never ship a
  change near storage without the two-device run and a real iPad.
- **3D on low-end devices.** The assembled 150-booth show (3.5) and phones
  at setup (2.5) are the stress points. Measure, don't guess.
- **Renders taken for photographs.** Labelled everywhere, always (2.10).
- **One owner, many sessions.** `HANDOFF.md` and this file are what keep the
  work coherent; 1.1 keeps them readable.
- **A competitor adds 3D.** ArtPlacer is closest. The moat is the floor
  where organizer and exhibitors meet, not the renderer.

## Appendix — scripts for phase 0

**Watched session, artist (30 minutes).** "You're doing [a real show] in a
10×10. Using eight of your own pieces, plan the booth, then print what you
would take to setup." Note the time to the first export; where they stall
for more than 20 seconds; what they look for and don't find; whether they
find More, Make it beautiful and the hanging guide on their own. At the end:
"What would you pay for this, and what would have to be true?"

**Watched session, organizer (30 minutes).** "Here is a photo of last year's
floor map. Lay out the floor, give five booths to exhibitors, and get a map
you'd send to them." Same notes. Then: "If every exhibitor designed their
booth on this floor before load-in, what would change for you?"

**Watched session, gallery (30 minutes).** "Hang these twelve works in this
room." (A CSV and a room's floor plan.) Same notes.

**Organizer conversation (20 minutes).** How do you lay out the floor today,
and with what? What went wrong at load-in last time? How do exhibitors find
out the rules, and how do you know they followed them? What do ZAPP or
Eventeny not do for you? What do you spend on software a year, and who
decides? Would you pilot this at your next show?

## Sources (search results, 2026-10-20; not opened in this sandbox)

- ArtPlacer Art Fair Planner: https://help.artplacer.com/support/solutions/articles/65000185282-art-fair-planner-how-to-create-an-art-fair-booth
- ArtPlacer plans for artists: https://help.artplacer.com/support/solutions/articles/65000185308-plans-for-artists
- ArtPlacer plans for galleries: https://help.artplacer.com/support/solutions/articles/65000190412-plans-for-galleries
- BoothFlow (listing): https://mwm.ai/de/apps/boothflow-art-booth-planner/6757063620
- Eventeny pricing: https://eventeny.com/pricing
- Eventeny booth self-selection: https://help.eventeny.com/en/articles/14743940-picking-booths-after-application-approval
- ExpoFP vs Eventeny (a competitor's page): https://expofp.com/compare/expofp-vs-eventeny
- ExpoFP booth sales: https://expofp.com/best-booth-sales-software
- ZAPP, about: https://sales.zapplication.org/about-zapp/
- ZAPP 2024 averages and features: https://blog.zapplication.org/?p=4320
- Cvent Prismm pricing: https://www.cvent.com/en/event-marketing-management/cvent-event-design-software/prismm-pricing
- Kunstmatrix free and public exhibitions: https://www.kunstmatrix.com/en/info/faqs/what-is-a-public-3d-exhibition-what-does-public-mean
- "Booth Studio" on the App Store: https://apps.apple.com/us/app/booth-studio/id6738711990
- WebKit's 7-day storage cap: https://bugs.webkit.org/show_bug.cgi?id=211775
