# Booth Studio — open checks from earlier rounds

The owner's by-eye checks from the rounds before 2026-10-19 — what to look
at on the real machine or a phone, and what to change if it reads wrong —
moved here verbatim from `HANDOFF.md` → Next on 2026-10-21 (ROADMAP 1.1).
Some carry the owner's answer in italics and are kept for their reasoning.
None needs a session: each is a judgement only a person can make. The
current list, with the items from these rounds that need a human with a
browser (the soft backdrops, H.264 on real hardware, a `home` HDRI), is
`HANDOFF.md` → Next. The item numbers are the ones these had there — items
4, 5 and 7 (the soft backdrops, H.264, a `home` HDRI) are the ones that
stayed behind — and "see Now" means `docs/HISTORY.md`.

0. **Looks and the hero set (Rev 1 part B, 2026-10-19): the owner's to
   judge.** Do the four looks look right, and is Make it beautiful's hang
   and aim what you would have done by hand? Are the four hero pictures the
   ones a jury or a promoter wants? Every value is in `LOOKS` and
   `heroShots` in `src/polish.js`.
0. **Workspaces (Rev 1 part A, 2026-10-19): the owner's to try.** On a
   fresh browser (a private window): does "What are you planning?" read
   right, and are the artist's five tabs and the organizer's three the right
   ones? Is More, beside the tabs, findable? Then parts B and C of Rev 1
   (see Now and the Revision Plan doc).

1. **The thirteenth round, on the real machine.** Double-click a figure
   from the Left and Right views and from an orbit round the side: does
   its card open every time? *Reported 2026-09-28: the man's did not —
   fixed in the fifteenth round (the chip hid it). Check again, with
   Layout left on some other chip.* Auto pan: is the caret beside the hand where
   you would look for it; are 10′ at 1 ft/s sensible defaults; should it
   also go back and forth (a loop) or pan up and down? Record it as MP4
   (fourteenth round): does the clip match what Start showed, and does a
   eased start and stop (now the default; Motion in the menu) feel
   right, and is the default ease too slow to get going on a short pan?
   *Answered 2026-10-05: all good as built — keep the defaults, no loop or
   vertical pan wanted.*
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
   `worker/index.js` or `wrangler.jsonc` — *answered 2026-09-26: keep them*;
   (c) whether the keys should live somewhere that survives clearing site
   data — that needs accounts too.
1. **Show Hub v0 (eighth round), on the real machine — and with a real
   promoter.** Send a booth from one browser, import it in another (or a
   private window) onto a floor booth — by Import and by dropping the file on
   a booth. Is Export → Send to the show where an exhibitor would look? Is
   the file still wanted now that there is the link? If it is, and a booth
   with twenty full-size photographs (100 MB+) bites, the file could carry
   the 2048 px preview instead of the original — the owner's choice: the
   promoter then has a lighter, softer booth. *Answered 2026-09-26: keep the originals.* The real question is demand:
   do promoters want exhibitors' designs on their floor? Also open: the
   pitch deck at `/pitchdeck/`, by eye.
1. **The seventh round (2026-09-25), on the real machine.** *Looked at
   2026-09-25 (eleventh round): nothing here can be built without the
   owner's answers — the choices below are the questions.* Build `main`'s
   tip first (`window.BOOTH_BUILD`). Does the right-drag box feel right, and
   is ⌘ right-drag a comfortable pan on a Mac trackpad (two-finger click and
   drag with ⌘ held)? On a trackpad a two-finger scroll already pans the
   floor. Do the sub-tabs make the panels quicker to use, or should some
   panels group several small sections under one chip (Layout has twelve
   chips)? Is choosing the new section on a selection right, or does it jump
   when you did not want it to? Should the eight top tabs themselves be
   regrouped (say Design · Light & camera · Show floor · Export)? *Answered
   2026-09-26: leave them.* "Mirror so people can flip horizontally":
   *answered 2026-09-26 — a one-click Flip for a cut-out person, built in
   the twelfth round.*
   Pan tool: is H the right key, and should the hand stay on after
   switching mode?
1. **The show floor, all four phases, by eye on the real machine.** Built
   2026-09-25 (see Now); none of it has been seen outside this sandbox.
   - **Phase 2, the 3D show:** does the overview frame the floor well, and
     is the dollhouse cut-away (near hall walls vanishing from outside) the
     right read? Drape colour is now a floor setting (eleventh round): are
     the six colours in `DRAPES` the ones shows actually offer? Is the walk's start
     (the aisle nearest the entrance) right, and does a walkthrough on a
     real plan go where a visitor would? 1.1 m/s — too slow? Labels: 40
     nearest, 22″ tall — right? And the frame rate on a big floor (a 1,000-
     booth block is under a dozen draw calls here, but swiftshader is not a
     laptop): if it stutters, the sprite pool and the booth's own shadow
     maps are the first suspects.
   - **Phase 3:** is "Open this booth" in the right place (the selected
     booth's Design section), and should the 3D show draw every *parked*
     design in full too, not only the open one? It would cost a booth build
     per linked design; today they are drawn light. *Answered 2026-09-26:
     only the open one.* Templates in a backup, and sales kept when a
     template drops their number: *answered and built, twelfth round.*
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
     Add booths now grows the floor by itself (twelfth round, the owner's
     answer).
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
   the first thing to do and it needs a human, not a session: a session can
   load production now (2026-10-20) but cannot judge a render by eye. Open Art
   show, and judge in this order —
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
6. **Unverified on real hardware** — things no one has confirmed by eye,
   because no agent session can judge them by eye:
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
