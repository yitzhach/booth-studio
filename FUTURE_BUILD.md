# Future build — requested, deliberately not started

Ideas that have been asked for and are worth doing, but which are not the next
phase. Each entry says enough to be picked up cold. Nothing here is in
progress; if you start one, give it its own phase document first.

The one earlier entry — two ground-texture sets, presets and a user library —
is built; `GROUND_LIBRARY_PHASE.md` is the record of it. `HANDOFF.md` → Next
is where the open work is.

## Pro monthly-plan ideas (proposed 2026-09-25)

Asked for as "original ideas that might constitute a premium monthly fee for
Pro members". The pitch deck at `/pitchdeck/` (`public/pitchdeck/index.html`)
presents them. The honest constraint first: the app is local-first — no
accounts, backend, payments, sync or live AI — so a feature that runs on the
device suits a one-time Pro unlock, and a monthly fee is justified only by
something that keeps running (hosting, sync, compute, a network of people).
Every idea marked *server* needs the owner to lift the local-first rule.

1. **Show Hub — promoters pay** (*server*; a no-server v0 exists). The
   promoter publishes the floor as a link; exhibitors claim and pay for a
   booth and design it in 3D, and the design lands on their booth number;
   the promoter walks the assembled show, each booth is checked against the
   show's rules (height, aisles, weights) and the walkthrough exports. Most
   of it exists: designs keyed by booth number (`src/linked.js`), sale and
   exhibitor fields, clearance checks, the 3D show and walkthrough. Limits:
   `MAX_DESIGNS = 60` (`src/linked.js`), and parked designs are drawn light.
   **The v0 needs no server:** "Send my booth to the promoter" writes one
   booth design as a file, and "Import into booth #N" on the floor parks it
   on that number — a test of demand that breaks no rule.
   **v0 is built (2026-09-25, eighth round — see `HANDOFF.md` → Now);**
   the hosted Hub is what is left here.
2. **Attention map** (*device*). Simulate passersby walking the aisle both
   ways; render every work in its own flat ID colour from each eye point (an
   extension of the AI pack's mask pass, `applyPass` in `src/scene.js`);
   score each work by seconds visible times apparent size and shade the
   walls. On the floor, the same gives footfall per booth, so promoters can
   price corners and end caps from data.
3. **"Take it home" AR labels** (*server*: hosting). The show pack's labels
   carry a QR code per work; a buyer scans it and sees the work at true size
   on their own wall (iOS Quick Look USDZ with vertical anchoring — three's
   USDZExporter supports it — or Android Scene Viewer with the .glb). Monthly
   for the hosting all season and scan counts per show.
4. **Sales-by-position log and sync** (*server*: sync). Mark a work sold on
   the phone at the show; the app already knows its wall, height, light and
   whether it faces the aisle, so after a few shows it can say which
   positions sell.
5. **AI photoreal renders on credits** (*server*). Already planned in
   `AI_EXPORT_PHASE.md`; the pack is built and `provider` in
   `src/ai-render.js` is the one line to set. Juried shows usually want a
   real booth photograph, so renders must be labelled as renders.

Also: a **sun-path study** for outdoor fairs (show city and date → which
wall takes the afternoon sun and glare) — local arithmetic, a Pro feature
rather than a monthly one.
