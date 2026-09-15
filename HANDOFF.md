## Goal
- Continue Artist OS Booth Studio. Preserve the implementation; never rebuild.

## Now
- Repo: https://github.com/yitzhach/booth-studio ; production: main.
- Live: https://booth-studio.bobdylan2000.workers.dev
- Reusable originals/direct image editing merged through PR #2 at d8dc7fb9ecd2553a4b8354cb1552963e2b1d8df9.
- Cloudflare builds main with npm run build ; npx wrangler deploy.

## Done
- Fixed edited artwork flashing white on selection: cache textures by source + normalized edits and bind ready maps synchronously.
- Shared artwork textures survive scene rebuilds; obsolete/replaced textures are released and failed loads can retry.
- 21 Node tests pass, including edited texture reuse, invalidation and pending-load cleanup.
- New: middle-edge stretch handles and stretch-to-panel checkbox; corners remain proportional.
- New: live scale slider with native 1% keyboard steps, no full scene rebuild during input.
- New: plain/concrete/wood grain/metal edge materials with color picker.
- Fixed image-editor preview: Lucide Image icon aliased so browser Image constructor loads art.
- 18 Node regression tests pass; AI_EXPORT_PHASE.md records the proposed paid BFL integration.
- Hotfix: null image edits no longer break original texture loading (white panels).
- Hotfix: drag/scale update artwork transforms in place; no full scene/sidebar rebuild per movement.
- Hotfix: free movement by default; optional Snap 1″ remains available.
- Hotfix: image-editor preview caches resized sources and coalesces slider input per animation frame; booth updates on Save.
- 16 Node tests pass, including null texture loading and in-place transform regression tests.
- Existing: measured original art, lighting, photo overlays, backups, guides, exports.
- Existing: four canopy shapes, procedural environments, zoom +/-.
- Live: inline/corner-left/corner-right/island; side and rear spacing, rear-booth toggle.
- Live: artwork on all six back/left/right interior and exterior wall faces, exterior camera view, face-specific guides.
- Live: editable artist signs and small title/medium/price labels.
- Live: tent fabric weave/sheen, ground bump, urban facade details.
- Live: optional uploaded 2:1 panorama and seamless ground photo; rotation/tile controls.
- Live: Original panels catalog is separate from placements; every click/drop creates another copy and deleting a placement keeps the original.
- Live: double-click/double-tap activates direct body drag and proportional blue-corner scaling; click-off deselects.
- Live: old Place on wall tool removed.
- Live: non-destructive horizontal/vertical flip, 90° rotation, exposure, contrast, saturation, temperature and tint editor.
- Live: project-persisted copy/paste adjustment recipe; new catalog copies start unedited.
- Source assets retain artwork/photo/surround/ground roles.
- 13 model/guide/image-edit tests passed in the JS isolate; modified JavaScript syntax checks passed.
- Cloudflare branch preview succeeded.
- Preview DOM confirmed repeated catalog clicks create copies while the original remains; all six wall locations present.
- Cloud browser lacks WebGL, so physical 3D gestures and rendering still need a WebGL-capable device check.

## Decisions (keep)
- Original artwork stays untouched; edits are per-placement and non-destructive.
- Measured geometry determines perspective.
- Current editor remains local; paid BFL AI export authorized for planning as a future phase only.
- AI_EXPORT_PHASE.md: backend/credits, protected artwork compositing, 1K–4K output plan.
- Tent styles are inspired approximations, not certified brand models.
- Photo surround is a backdrop, not reconstructed 3D or HDR lighting.
- User supplies panorama/ground photography; no stock/photo assets bundled.
- Signs/labels are 3D-only; labels independent, not live-linked.
- Neighbor gaps use nominal footprint edges; overhang/art can intrude into gaps.
- Optional schema-1 fields preserve existing backup compatibility.
- Commission repository must remain untouched.

## Dead ends (do not retry)
- Terminal GitHub auth previously failed: use connected GitHub tools.
- Cloud browser may lack WebGL; do not treat DOM checks as full 3D rendering verification.

## Next (numbered)
1. Verify newest production build; test edge stretches, scale slider and image preview on devices.
2. On a WebGL-capable Mac/iPhone, verify repeated inside/outside drops and direct double-tap move/scale.
3. Check edited orientation and adjustment preview on all wall faces.
4. Inspect clean 2048/4096 export after rotated/flipped/color-adjusted placements.
5. Continue with the next requested Booth Studio feature without rebuilding.

## Files
- src/model.js: validation, neighbor placement, proportional scaling and edit data.
- src/image-edit.js: adjustment defaults, validation and Canvas processing.
- src/scene.js: exterior frames, wall picking, direct resize/drag and edited textures.
- src/main.js: reusable catalog, copy-on-drop, image editor and edit clipboard.
- src/signage.js: editable sign/label canvas textures.
- src/environment.js: tent materials, procedural floor/scenery and neighbors.
- src/guide.js: separate inside/outside hanging guides.
- src/style.css: assets, drag states, image editor and zoom targets.
- tests/model.test.js: 13 data/geometry/guide/edit tests.
- tests/wall-assets.mjs: browser regression script prepared for WebGL-capable environment.
- tests/environment.mjs: environment/zoom browser checks.
