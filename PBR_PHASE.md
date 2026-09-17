# Photoreal Phase — HDRI lighting + PBR surfaces

Read this file (and `HANDOFF` only if you need project-wide context) before
starting any photoreal work. It is written so a fresh chat can pick up one
phase without re-reading the codebase.

## Goal
Blender-grade realism in the existing three.js app: image-based lighting from
HDRIs, photoreal backgrounds, and real PBR texture sets for ground/tent/walls.
Artwork colour fidelity must survive it.

## Hard constraints discovered (do not re-derive)
- **Agent sessions cannot download assets.** The egress proxy blocks
  `polyhaven.com`, `api.polyhaven.com` and `ambientcg.com` (CONNECT 403).
  The user downloads and uploads/commits every binary. `registry.npmjs.org`
  *is* reachable, so devDependencies can be installed.
- **No image tooling in the sandbox**: no ffmpeg, ImageMagick, cwebp, oiiotool,
  imageio. Conversion needs a Node script (see Phase 1) or the user's Mac.
- **A 4K `.exr` is ~24 MB and is not shippable.** Split the job:
  - *lighting*: 1K `.hdr` (~1–3 MB) → PMREM → `scene.environment`
  - *visible backdrop*: 2K/4K tonemapped `.jpg`/`.webp` (~0.5–2 MB) →
    `scene.background` as an equirect texture
  One 4K HDR for both is the naive route and costs ~10× the bytes.
- Workers assets cap at 25 MiB per file; the repo should not become an asset
  store. If total assets pass ~50 MB, move them to R2 and load by URL.
- Deployment: only a push to `main` reaches production (see HANDOFF).

## What already exists (reuse, do not rebuild)
- `src/scene.js`: `ACESFilmicToneMapping`, exposure `1.15`, PCFSoft shadows
  with `autoUpdate=false` (call `renderer.shadowMap.needsUpdate = true` after
  any light/material swap).
- `src/scene.js:~194`: `booth.surroundAsset` already sets `scene.background`
  to a user 360 image with `backgroundRotation` from `booth.surroundRotation`.
  **HDRI backdrops should extend this path, not replace it.**
- `src/environment.js`: `groundTexture(kind)` builds procedural canvas ground
  (`grass|concrete|asphalt`) and the seeded city skyline. These stay as the
  zero-download fallback when an asset is absent.
- `src/texture-cache.js`: `TextureCache` is keyed on `(id, edits)` for artwork
  placements. Environment textures need their own small cache/dispose path;
  do not force them through this one.
- Ground is a 180 m plane at `y = -0.045`; booth units are inches (`IN`).

## Phases

### Phase 1 — IBL plumbing, no assets — **DONE**
Shipped in `src/lighting.js` + wiring. What exists now:
- `ENV_PRESETS` (`studio`, `tradeshow`, `artfair`, `home`), `EnvironmentLighting`
  (PMREM, revision-guarded swaps, disposal), `artEnvIntensity`.
- Layout → Surroundings gains **Environment** and **Artwork colour** selects;
  `booth.envPreset` / `booth.artFidelity`, both defaulted, so old backups load.
- Picking a preset also moves `ground` and `horizon` to its defaults.
- `requireAsset()` HEADs every asset first: a missing file is answered with
  index.html and a 200 by both vite and the Worker, and RGBELoader throws from
  inside its own callback on that HTML. Do not remove this guard.
- Artwork fidelity is `envMapIntensity` 0/1, not MeshBasicMaterial: Basic would
  also discard the lighting studio's spotlights.
- Tests: `tests/lighting.test.js` (10 node tests), `tests/view-lighting.mjs`
  (browser; now part of `npm run test:view`).

Original scope, for reference:
- `src/lighting.js` (new): PMREM generator, `applyEnvironment(scene, source)`,
  dispose of the previous env RT on every swap.
- Preset registry `{ id, label, hdri, background, ground, exposure,
  envIntensity }`; a `studio` preset that uses the current procedural look so
  nothing regresses when assets are missing.
- Per-preset `renderer.toneMappingExposure` and `scene.environmentIntensity`.
- **Artwork fidelity toggle**: "accurate colour" (artwork material ignores IBL
  — `MeshBasicMaterial`, or Standard with `envMapIntensity: 0`) vs "scene
  lighting". Default to accurate; this is the product's whole point.
- Tests: preset resolution, fallback when an asset 404s, exposure applied,
  no env leak across swaps. Must pass with zero binary assets present.

### Phase 2 — HDRI backdrops
- User supplies per preset, from polyhaven.com (CC0):
  `light.hdr` at **1K** and `bg.jpg` at **2K or 4K**.
  Sample already uploaded: `industrial_pipe_and_valve_01` (4K EXR) — re-download
  at 1K HDR rather than converting it.
- Layout: `public/assets/hdri/<preset>/light.hdr`, `.../bg.jpg`.
- `RGBELoader` → PMREM → `scene.environment`; separate `TextureLoader` for
  `bg.jpg` with `EquirectangularReflectionMapping` + `SRGBColorSpace` →
  `scene.background`. Keep `backgroundRotation` wired to `surroundRotation`.
- Optional tool `tools/hdri-prep.mjs` if the user wants to convert their own
  EXRs in-repo: three's `EXRLoader` parses the buffer in Node, downsample,
  write RGBE `.hdr` by hand, encode the JPEG with `sharp` (devDependency).
- Presets to start: `tradeshow` (warehouse/studio), `artfair` (park/urban),
  `home` (interior).

### Phase 3 — PBR ground and surfaces
- ambientCG (CC0), 1K or 2K, **NormalGL not NormalDX**, converted to WebP:
  `Concrete034`, `Asphalt026`, `Grass004`, `Carpet013`, `WoodFloor051`,
  `Fabric063`, `Bricks075`.
- `public/assets/textures/<name>/{color,normal,rough,ao}.webp`.
- Material factory: only `map` gets `SRGBColorSpace`; normal/rough/ao stay
  linear. `aoMap` needs a `uv1` attribute or it silently does nothing.
- `repeat` derived from real-world tile size (a 2 m tile on the 180 m plane is
  `repeat.set(90, 90)`) — compute it, do not hardcode per surface.
- Anisotropy from `renderer.capabilities.getMaxAnisotropy()` (already used for
  artwork in `scene.js`).
- Dispose every map on preset swap.

### Phase 4 — Tent, walls, polish
- PBR canvas on the tent fabric (replaces the procedural `fabricWeave` bump),
  brick/plaster options for the `home` preset walls.
- Contact-shadow / shadow-bias tuning under IBL; verify the 2048/4096 export
  path still renders the env and background correctly.

### Phase 5 — Budget and licensing
- Resolution tiers: 1K env + 2K bg on mobile, 2K/4K on desktop; lazy-load
  assets on first use of a preset, never at boot.
- `CREDITS.md` listing every Poly Haven / ambientCG asset pulled (both CC0, no
  attribution required, but keep the record).
- Measure: first-paint bytes must not regress for the default studio preset.

## Working rules for this phase
- One phase per chat. Start by reading this file only.
- Never commit an asset over ~4 MB without saying so in the commit message.
- Keep the procedural fallback working: the app must run with `public/assets`
  empty.
- Do not alter stored original image data (project-wide rule).
