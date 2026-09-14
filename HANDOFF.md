## Goal
- Continue Artist OS Booth Studio. Preserve implementation; never rebuild.
## Now
- Repo: https://github.com/yitzhach/booth-studio ; production: main.
- Live: https://booth-studio.bobdylan2000.workers.dev
- New features prepared on work/wall-assets-surroundings; NOT merged/deployed.
- Main remains at 2eb798c5c0958fde57a7768074b4a3b4ad07a61f.
- Cloudflare builds main: npm run build ; npx wrangler deploy.
## Done
- Existing: measured original art, lighting, photo overlays, backups, guides, exports.
- Existing: four canopy shapes, procedural environments, zoom +/-.
- Draft: inline/corner-left/corner-right/island; side and rear spacing, rear-booth toggle.
- Draft: outside back/left/right wall faces, exterior camera view, face-specific guides.
- Draft: library drag/drop to picked wall face; touch Place on wall fallback.
- Draft: double-click proportional corner handles; scale buttons; click-off deselect.
- Draft: editable artist signs and small title/medium/price labels.
- Draft: tent fabric weave/sheen, ground bump, urban facade details.
- Draft: optional uploaded 2:1 panorama and seamless ground photo; rotation/tile controls.
- Draft: larger zoom targets, desktop Zoom label.
- 11 model/guide tests passed in JS isolate using UUID/clone shims.
- 24 inspector template smoke cases passed with mock DOM; syntax checks passed.
- NO npm build or browser/WebGL tests run for this update.
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
- This session exposes no terminal/browser tools; do not claim runtime verification.
## Next (numbered)
1. Read README and review branch diff, do not restart.
2. Run npm ci, npm test, npm run build.
3. Run npm run test:browser, node tests/environment.mjs, node tests/wall-assets.mjs.
4. Verify actual 3D picking, proportional handles, exterior text orientation and exports.
5. Verify photographic materials and mobile/tablet overflow; physical Mac/iPhone trial.
6. Fix findings, then merge authorized changes and confirm Cloudflare status.
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
