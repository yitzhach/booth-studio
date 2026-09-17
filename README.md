# Artist OS · Booth Studio

Measured 3D art-show booth planning in the browser. Artists can arrange original artwork on interior or exterior booth walls, edit presentation details, add lighting and surroundings, and export booth images or hanging guides.

- Repository: https://github.com/yitzhach/booth-studio
- Live app: https://booth-studio.bobdylan2000.workers.dev
- Production branch: `main`
- Separate project: do not modify `yitzhach/commission`.

## Local development

Requires Node 22+.

```sh
npm ci
npm test
npm run build
npm run dev
```

Cloudflare builds from `main` using `npm run build` and `npx wrangler deploy`. Non-production branch builds are enabled. Cloudflare Access is off.

## Current behavior

- Booth sizes, back/left/right walls, four tent forms, lighting and procedural/photo surroundings.
- Environment presets light the booth from an HDRI and can supply a photographed backdrop; without those files a preset keeps the procedural surroundings. See `docs/HDRI-ASSETS.md`.
- Perspective orbit reaches ground level for low looking-up views; the floor plane, not a fixed angle, is the limit.
- Urban horizon builds a seeded three-ring skyline with textured facades, lit windows, setbacks and rooftop clutter.
- Neighbor layouts: inline, either corner, or island, with side/rear spacing.
- Original Panels is a reusable source library. Clicking or dropping creates another placement; the original remains.
- Artwork can hang on all six back/left/right interior and exterior faces.
- Double-click/tap artwork to adjust it. Drag the body to move it.
- Corner handles scale proportionally; middle-edge handles stretch width or height.
- Scale slider responds live; keyboard arrows change it in 1% steps.
- Artwork thickness, wall gap, and plain/concrete/wood/metal edge finishes with color.
- Non-destructive rotate, flip, exposure, contrast, saturation, temperature and tint.
- Image-edit preview is live; edits can be copied and pasted between placements.
- Artist signs and small artwork labels use the same wall-placement system.
- PNG exports at 2048/4096 px and printable measured hanging guides.
- Projects autosave locally in IndexedDB; downloadable backups include original images.

## Important constraints

- Preserve the implementation; extend it rather than rebuilding.
- Original artwork data must remain unchanged. Edits are stored per placement.
- Keep optional schema-1 fields backward-compatible with existing backups.
- No backend, accounts, sync, payments or AI calls are active.
- WebGL2/hardware acceleration is required for the 3D canvas.
- Local browser storage can be cleared or evicted; users should download backups.
- Preview artwork textures are capped at 2048 px for device stability.
- 4096 export depends on the device GPU/canvas limit.
- Tent and environment models are visual approximations, not certified products.
- Photo panoramas are backdrops, not reconstructed geometry. Environment presets do light the booth from an HDRI, when its files are present.
- Limits: 200 placements, 250 assets, 25 MB/image, 200 MB imported backup.

## Architecture

- `src/main.js`: interface, actions, inspector and undo/redo.
- `src/model.js`: schema validation, geometry and wall constraints.
- `src/scene.js`: Three.js booth, artwork interaction, lighting and export.
- `src/lighting.js`: environment presets, HDRI image-based lighting and backdrops.
- `src/texture-cache.js`: source/edit-keyed GPU texture reuse.
- `src/image-edit.js`: non-destructive Canvas adjustments.
- `src/edge-material.js`: procedural artwork-edge finishes.
- `src/environment.js`: tents, ground, sky, city backdrop and neighboring booths.
- `src/photo.js`: 2D booth-photo composition.
- `src/storage.js`: IndexedDB, image loading and downloads.
- `src/signage.js`: sign/label textures.
- `src/guide.js`: printable inside/outside hanging guides.
- `tools/hdri-prep.mjs`: converts an HDRI into a preset's `light.hdr`/`bg.jpg`.
- `tests/`: Node and browser regression checks.

## Verification

Run `npm test` and `npm run build` for every change. When a WebGL-capable browser is available, also run `npm run test:browser`, `npm run test:view`, and `node tests/wall-assets.mjs`. Test desktop plus iPhone/iPad interaction and a 4096 export.

For a new development chat, read only `HANDOFF.md` first. Read this file when commands or architecture are needed. Read `PBR_PHASE.md` when working on HDRI lighting or PBR surfaces, and `AI_EXPORT_PHASE.md` only when implementing the paid AI export phase. `docs/ORIGINAL-HANDOFF.md` is historical reference, not current instructions.
