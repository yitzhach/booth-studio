## Goal
- Continue Artist OS Booth Studio without rebuilding it.
- Keep measured artwork faithful, reusable and responsive on desktop/mobile.

## Now
- Repo: https://github.com/yitzhach/booth-studio
- Live: https://booth-studio.bobdylan2000.workers.dev
- Production branch: `main`; Cloudflare auto-deploys main.
- Latest functional commit: `64631dd`; white-flash texture-cache fix deployed successfully.
- Current verification: 21 Node tests pass; Cloudflare production build passed.
- Working tree is remote GitHub; use connected GitHub tools. Terminal GitHub auth previously failed.

## Done
- Measured booth geometry, lighting, photo mode, guides, backups and high-res PNG export.
- Tents, ground/horizon options, neighbor layouts and spacing.
- Artwork on all three inside and outside wall faces.
- Reusable Original Panels: each click/drop creates a copy; sources remain.
- Double-click/tap selection, direct wall movement and click-off deselection.
- Corner handles scale proportionally; middle-edge handles stretch width/height.
- Live scale slider with 1% arrow-key increments.
- Artwork thickness plus colored plain/concrete/wood/metal edges.
- Live non-destructive image editor; copy/paste edits.
- Artist signs and artwork labels.
- Edited textures cached across selection rebuilds; no white flash.

## Keep
- Preserve existing implementation and schema-1 backup compatibility.
- Never alter stored original image data; edits belong to placements.
- Commission repo remains untouched.
- Current app is local-first: no accounts, backend, payments, sync or active AI API.
- AI export is future paid work; read `AI_EXPORT_PHASE.md` only for that phase.
- BFL AI output must preserve art via protected compositing, not prompt promises.
- Tent/environment photography remains approximate unless user supplies images.

## Known limits
- Cloud test browser lacks WebGL; real 3D gestures need Mac/iPhone/iPad checks.
- 4096 export depends on device GPU/canvas limits.
- Image editor is Canvas adjustment, not RAW development.
- Local browser data can be evicted; keep downloadable backups.

## Next
1. Confirm on the user’s Mac that edited images no longer flash white.
2. Test stretch handles, scale slider keyboard steps and live editor preview on touch.
3. Test interior/exterior edited artwork and clean 2048/4096 exports.
4. Fix concrete findings; run `npm test` and `npm run build`; deploy through main.
5. When requested, begin paid AI export from `AI_EXPORT_PHASE.md`.

## Read map
- Start every new chat with this file only.
- Read `README.md` for commands, architecture or stable behavior.
- Read `AI_EXPORT_PHASE.md` only for AI-export implementation.
- Ignore `docs/ORIGINAL-HANDOFF.md` unless historical requirements are needed.
