## Goal
- Continue Artist OS Booth Studio. Preserve implementation; never rebuild.
## Now
- Repo: https://github.com/yitzhach/booth-studio ; production: main.
- Live: https://booth-studio.bobdylan2000.workers.dev
- Exterior wall/assets update merged to main at fdae8a63e04a51aeb02e88e210b4470afe99c797.
- Cloudflare production build succeeded; live URL verified with all six wall locations.
- Cloudflare builds main: npm run build ; npx wrangler deploy.
- Reusable originals/direct editing work is on work/reusable-panels-image-editor; not merged yet.
## Done
- Existing: measured original art, lighting, photo overlays, backups, guides, exports.
- Existing: four canopy shapes, procedural environments, zoom +/-.
- Live: inline/corner-left/corner-right/island; side and rear spacing, rear-booth toggle.
- Live: outside back/left/right wall faces, exterior camera view, face-specific guides.
- Live: library drag/drop to picked wall face; touch Place on wall fallback.
- Live: double-click proportional corner handles; scale buttons; click-off deselect.
- Live: editable artist signs and small title/medium/price labels.
- Live: tent fabric weave/sheen, ground bump, urban facade details.
- Live: optional uploaded 2:1 panorama and seamless ground photo; rotation/tile controls.
- Live: larger zoom targets, desktop Zoom label.
- 11 model/guide tests passed in JS isolate using UUID/clone shims.
- 24 inspector template smoke cases passed with mock DOM; syntax checks passed.
- Cloudflare production build passed.
- Live DOM verified Back/Left/Right Interior and Exterior choices; all three exterior selections update correctly.
- Cloud browser lacked WebGL; physical rendering, drag handles and export remain to verify.
- Draft: Original panels catalog is separate from placements; every click/drop adds a copy.
- Draft: double-click/double-tap activates direct body drag + proportional corner scaling.
- Draft: removed Place on wall tool.
- Draft: non-destructive flip/90° rotate/exposure/contrast/saturation/temperature/tint.
- Draft: project-persisted copy/paste adjustment recipe; new catalog copies start unedited.
- Draft: source assets retain roles; deleting last placement keeps the original catalog item.
- 13 model/guide/image-edit tests passed in JS isolate; production/browser tests pending.
## Decisions (keep)
- Original artwork untouched; measured geometry determines perspective.
- No paid APIs, backend, accounts, cloud sync, or AI-generated artwork.
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
1. Run Cloudflare/Vite production build on review branch.
2. Verify Original panels catalog, repeated drops, double-tap move/scale and image editor in browser.
3. Run npm test plus wall-assets/environment/e2e browser tests where WebGL works.
4. Inspect edited orientation, exterior faces, clean 2048/4096 export and physical Mac/iPhone.
5. Merge only after fixing concrete findings; update this handoff.
## Files
- src/model.js: validation, neighbor placement, proportional scaling, edit data.
- src/image-edit.js: adjustment defaults, validation and Canvas processing.
- src/scene.js: exterior frames, wall picking, resize handles, photo maps.
- src/main.js: reusable catalog, copy-on-drop, direct editing modal and edit clipboard.
- src/signage.js: editable sign/label canvas textures.
- src/environment.js: tent materials, procedural floor/scenery, neighbors.
- src/guide.js: separate inside/outside hanging guides.
- src/style.css: assets, drag states and zoom targets.
- tests/model.test.js: 11 data/geometry/guide tests.
- tests/wall-assets.mjs: new browser regression script (unrun).
- tests/environment.mjs: existing environment/zoom browser checks.
