## Goal
- Continue Artist OS Booth Studio; existing app, not a rebuild.
## Now
- Repo: https://github.com/yitzhach/booth-studio ; production branch main.
- Live: https://booth-studio.bobdylan2000.workers.dev
- Cloudflare builds main: npm run build ; npx wrangler deploy.
## Done
- Measured artwork placement, lighting, photo overlays, backups, exports.
- Four canopy styles: classic, high peak, barrel (TrimLine-inspired), soft dome.
- Deeper ~12-inch fabric valances, hems, frame braces, roof ribs.
- Ground: studio, grass, concrete, asphalt. Horizon: studio, open sky, park, urban.
- Optional neighboring booths. Settings autosave, undo and backup with project.
- Visible zoom +/- for perspective and orthographic views; reset restores overview.
## Decisions (keep)
- Original artwork images preserved; geometry determines perspective.
- No AI artwork generation; no paid APIs, backend, accounts or cloud sync.
- Tent shapes are inspired approximations, not exact branded equipment models.
- Procedural grounds and simplified scenery; not photographic environments.
- Photo mode uses overlays; existing photographed objects remain baked in.
- New optional booth fields remain compatible with schema-1 older backups.
- Commission repository is separate and must remain untouched.
## Dead ends (do not retry)
- Terminal GitHub authentication previously failed; use connected GitHub tools.
- Browser binary may require fresh extraction from retained Chromium archive in this environment.
## Next (numbered)
1. Ask for the user's next specific edits; do not add unrequested features.
2. Inspect README.md and relevant source only.
3. Verify actual artwork and physical Mac/iPhone during real-world trial.
4. Test changes; push authorized updates; confirm Cloudflare build status.
## Files
- src/environment.js: canopy geometry, procedural ground and scenery.
- src/scene.js: Three.js scene, camera zoom, lighting, export.
- src/main.js: UI and project actions; src/model.js: project validation.
- tests/environment.mjs: new styles, settings, zoom, persistence, export, responsive checks.
- tests/model.test.js: data, geometry and backward compatibility.
- docs/CONTINUE.md and docs/VERIFICATION.md: earlier implementation notes.
