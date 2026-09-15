## Goal
- Continue Artist OS Booth Studio. Preserve implementation; never rebuild.
## Now
- Repo: https://github.com/yitzhach/booth-studio ; production: main.
- Live: https://booth-studio.bobdylan2000.workers.dev
- Exterior wall/assets update merged to main at fdae8a63e04a51aeb02e88e210b4470afe99c797.
- Cloudflare production build succeeded; live URL verified with all six wall locations.
- Cloudflare builds main: npm run build ; npx wrangler deploy.
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
1. Read README and current main; do not restart.
2. Verify physical Mac/iPhone WebGL rendering and exterior Back/Left/Right placement.
3. Run npm test, npm run build, npm run test:browser, node tests/environment.mjs, node tests/wall-assets.mjs when terminal/browser runtime is available.
4. Inspect proportional handles, exterior text orientation, photo materials and 2048/4096 exports.
5. Fix only concrete findings; keep HANDOFF.md current.
## Files
- src/model.js: validation, neighbor placement, proportional scaling.
- src/scene.js: exterior frames, wall picking, resize handles, photo maps.
- src/main.js: UI, asset actions, drop/tap placement, material upload.
- src/signage.js: editable sign/label canvas textures.
- src/environment.js: tent materials, procedural floor/scenery, neighbors.
- src/guide.js: separate inside/outside hanging guides.
- src/style.css: assets, drag states and zoom targets.
- tests/model.test.js: 11 data/geometry/guide tests.
- tests/wall-assets.mjs: new browser regression script (unrun).
- tests/environment.mjs: existing environment/zoom browser checks.
