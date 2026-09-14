# Artist OS · Booth Studio

A browser-based prototype for measured art-show booth layouts and photo compositions. Only Booth Studio is active. This is a new, independent project; Commission Studio is untouched.

## Run locally

Requires Node 22 or newer (Node 24 used during development).

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. For a production build: `npm run build`, then `npm run preview`. Run core tests with `npm test`.

## Cloudflare Workers Builds

Connect **yitzhach/booth-studio**, production branch **main**, project name **booth-studio**.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Non-production branch builds: enabled per owner preference.
- Cloudflare Access: off per owner preference.
- Root directory: repository root.
- `wrangler.jsonc` serves the generated `dist` static assets, including a single-page fallback. No bindings, backend, secrets, paid AI APIs, or database setup are required.
- Wrangler and the lockfile are included so the deploy command uses the project's installed CLI.

For Cloudflare's separate non-production deploy command, use the preview-version command in Cloudflare's Workers Builds interface rather than redirecting a branch to production. Do not configure a custom branch job to run a production deploy against this same Worker.

## Using the prototype

1. **Layout:** choose 10 × 10 or 10 × 20 ft, enable display walls, edit individual widths/heights and neutral finishes, and optionally show the canopy.
2. **Artwork:** upload multiple original PNG/JPG files (25 MB/file limit). Select each panel and enter actual width/height, thickness, and wall gap in inches. The starting six panels are clearly labeled dimension placeholders; remove them or attach your original images using **Add original image**.
3. **Place:** choose Back, Left, or Right wall. Left edge and bottom edge are measured from the wall's bottom-left corner when facing it from inside. **Move** drags on that wall's plane; **Snap 1″** controls grid snapping. Numeric fields are also available on phones. Center horizontally or set the artwork center to 60″ above floor. Duplicate, remove, undo, and redo are supported.
4. **Navigate:** orbit, pan and zoom. Perspective, straight-on Back/Left/Right, and overhead Plan views are available. One-finger orbit and two-finger pan/zoom use Three.js OrbitControls. Select mode is the default; Move mode separates object manipulation from camera movement.
5. **Lighting:** ambient plus up to four movable, aimable spotlights, each with brightness and color temperature. Coordinates use the center of the floor: +X right, +Z toward the entrance, +Y upward.
6. **Photo:** upload a booth photograph, click an uploaded library work to add a separate layer, then drag the layer or its four corner handles. Numeric corner positions use percentages of the photo. Add up to eight adjustable light overlays. Source photo remains separate from added layers; replace-photo workflow backs up the old project first.
7. **Save:** changes autosave to IndexedDB on this browser/device. Download an all-in-one JSON backup containing original data URLs and all project settings. Import restores it. New/alternative/import actions download the prior project as a backup before switching. Browsers may restrict automatic downloads: confirm that the backup actually reaches your Downloads folder before relying on it.
8. **Export:** PNG at 2048 or 4096 pixels wide, preserving the current camera/photo aspect ratio. 3D selection outlines and photo corner handles are omitted. Download the measured HTML hanging guide, open it in a browser, then Print / Save PDF. Guide coordinates describe panel edges, not hanging-hook locations.

Keyboard: Ctrl/Command Z undo; Ctrl/Command Shift Z redo; Delete/Backspace removes selected art outside text inputs.

## Fidelity and limits

- Original PNG/JPG content remains unchanged in storage and backup. 3D artwork is rendered on measured panels. If entered dimensions mismatch the source image ratio, the entire image fits within the panel with visible margins and a warning. **Match height to image** is an explicit correction.
- Internal geometry uses metres; the project format stores explicit inches and converts using 0.0254 m/in. Source format has `schema: 1`.
- Wall-plane dragging clamps to a wall's bounds. Numeric out-of-bounds edits remain possible with a visible warning. There is no full collision solver between adjacent panels or between perpendicular wall artworks.
- Geometry casts shadows; thickness and wall gap affect them. A single artwork photo has no actual relief data. Baked-in source lighting cannot be undone. Exact color fidelity, material photorealism, and surface-ridge shadow accuracy are not promised.
- 3D preview/export textures are limited to 2048 px per artwork for memory stability; source images remain full resolution in backups. High-res export increases output dimensions, not source-image detail. The renderer is real-time rasterization, not an offline path tracer.
- Photo mode is a 2D projective composition with light/shadow overlays. It does not reconstruct a measured 3D booth, remove or move baked-in artwork, perform automatic perspective calibration, or physically relight a photograph. Corner fitting must be done by the artist. Warp subdivision approximates a projective transform.
- Export size is limited by device GPU/canvas capability. Use 2048 px when 4096 fails. No claims of testing on a physical iPhone or older iMac; use Efficient quality on older devices. WebGL2/hardware acceleration is needed for 3D. Photo editing, backups, and guides remain available if WebGL fails.
- No server uploads, accounts, sync, AI, payments, inventory integration, or multi-project cloud browser. Local storage can be evicted by browser clearing or private-mode policies. Keep downloadable backups. The UI is cached by normal browser mechanisms only; offline app loading is not guaranteed.
- Prototype guardrails: 200 panels, 250 image assets, 200 MB imported backup, 25 MB per uploaded image. Undo retains up to 35 complete project snapshots in memory; unusually large source files can exhaust device memory.

## Architecture

- `src/model.js`: versioned project model, units, wall bounds, fidelity validation, homography.
- `src/scene.js`: Three.js renderer, modular booth geometry, textures, lighting, wall-plane picking/dragging, camera controls, clean export.
- `src/photo.js`: original image composition, projective artwork warping, corner editing, overlay lighting and export.
- `src/storage.js`: atomic IndexedDB project saves, original image loading, downloads.
- `src/main.js`: UI and undoable project actions.
- `src/guide.js`: escaped, dimensioned, printable wall guide.
- `tests/model.test.js`: geometry, boundaries, validation, fidelity, perspective mapping, and guide escaping.
- `docs/ORIGINAL-HANDOFF.md`: original requirements. Primary design references were inspected from the owner-supplied ZIP.

The project does not need the reference PNGs at runtime. Do not replace the scene with the generated concept images.
