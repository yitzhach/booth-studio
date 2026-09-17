import * as T from "three";

// Physically-based ground surfaces.
//
// Each ground kind can be backed by a texture set on disk. When the files are
// absent — which is the shipped state — environment.js keeps its procedural
// canvas ground and nothing here runs. That fallback is the rule for the whole
// photoreal phase: the app must never need a binary to start.
//
// Sets are named after the ground kind, not after the asset they came from, so
// swapping Concrete034 for something better later is a file move rather than a
// code change. `tileMetres` is the real-world size of one tile, which is what
// turns into `repeat` on a 180 m plane; ambientCG publishes it per asset and
// tools/texture-prep.mjs records it in meta.json.

export const GROUND_METRES = 180;

export const SURFACE_SETS = {
  grass: { label: "Grass", tileMetres: 2 },
  concrete: { label: "Concrete", tileMetres: 2 },
  asphalt: { label: "Asphalt", tileMetres: 2 },
  carpet: { label: "Carpet", tileMetres: 2 },
  wood: { label: "Wood floor", tileMetres: 2 },
};

// meta.json may rename these; these are the defaults tools/texture-prep.mjs
// writes and the names to use when placing files by hand.
export const MAP_FILES = {
  map: "color.jpg",
  normalMap: "normal.jpg",
  roughnessMap: "rough.jpg",
  aoMap: "ao.jpg",
};

export const surfacePaths = (id, files = MAP_FILES) => {
  if (!SURFACE_SETS[id]) return null;
  const paths = { meta: `assets/textures/${id}/meta.json` };
  for (const [slot, file] of Object.entries(files)) paths[slot] = `assets/textures/${id}/${file}`;
  return paths;
};

// One tile of `tileMetres` repeated across a plane of `planeMetres`. Deriving
// it rather than hardcoding a number per surface is what keeps a concrete slab
// and a blade of grass the same size as each other on the same floor.
export const repeatFor = (tileMetres, planeMetres = GROUND_METRES) =>
  planeMetres / (tileMetres > 0 ? tileMetres : SURFACE_SETS.concrete.tileMetres);

// Both the dev server and the deployed Worker answer a missing file with
// index.html and a 200, so a plain load cannot tell "absent" from "present".
async function requireAsset(url) {
  const res = await fetch(url, { method: "HEAD" });
  if (!res.ok) throw new Error(`missing asset: ${url}`);
  if ((res.headers.get("content-type") || "").includes("text/html"))
    throw new Error(`missing asset (fell through to the app shell): ${url}`);
}
async function loadTexture(url) {
  await requireAsset(url);
  return new T.TextureLoader().loadAsync(url);
}
async function loadMeta(url) {
  await requireAsset(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`missing asset: ${url}`);
  return res.json();
}

export class SurfaceTextures {
  // `loaders` is injected so the rules below can be tested without a GPU or a
  // single byte of texture on disk.
  constructor(renderer, loaders = {}) {
    this.renderer = renderer;
    this.loadTexture = loaders.loadTexture || loadTexture;
    this.loadMeta = loaders.loadMeta || loadMeta;
    this.revision = 0;
    this.loaded = null;
  }
  anisotropy() {
    // Ground tiles are viewed at grazing angles almost all the time, which is
    // exactly where anisotropic filtering earns its cost. 8 matches artwork.
    const max = this.renderer?.capabilities?.getMaxAnisotropy?.() ?? 1;
    return Math.min(8, max || 1);
  }
  // Resolves to a set of maps, or null when the files are not there. Only the
  // colour map is required: a set that is colour-only still beats procedural
  // noise, and a missing normal or roughness map simply is not applied.
  async load(id) {
    if (!SURFACE_SETS[id]) {
      // The studio floor is deliberately texture-free; releasing here keeps a
      // set the user has navigated away from off the GPU.
      this.revision++;
      this.dispose();
      return null;
    }
    if (this.loaded?.id === id) return this.loaded;
    const rev = ++this.revision;
    const base = surfacePaths(id);
    const meta = await this.loadMeta(base.meta).catch(() => null);
    const paths = surfacePaths(id, { ...MAP_FILES, ...(meta?.files || {}) });
    const slots = Object.keys(MAP_FILES);
    const textures = await Promise.all(slots.map((slot) => this.loadTexture(paths[slot]).catch(() => null)));
    const maps = {};
    slots.forEach((slot, i) => {
      if (textures[i]) maps[slot] = textures[i];
    });
    if (this.revision !== rev || !maps.map) {
      Object.values(maps).forEach((texture) => texture.dispose());
      return null;
    }
    // Colour is the only map carrying sRGB data. Normals, roughness and
    // occlusion are measurements, and decoding them through a gamma curve
    // quietly wrecks the shading.
    maps.map.colorSpace = T.SRGBColorSpace;
    for (const [slot, texture] of Object.entries(maps)) {
      if (slot !== "map") texture.colorSpace = T.NoColorSpace;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.anisotropy = this.anisotropy();
    }
    this.dispose();
    this.loaded = {
      id,
      maps,
      tileMetres: Number(meta?.tileMetres) > 0 ? Number(meta.tileMetres) : SURFACE_SETS[id].tileMetres,
      // ambientCG ships both conventions and the difference is invisible until
      // the light moves the wrong way. Flipping normalScale.y is the whole of
      // the DX→GL conversion, so a mislabelled download costs nothing to fix.
      normalConvention: meta?.normalMap === "DX" ? "DX" : "GL",
      credit: meta?.credit || "",
    };
    return this.loaded;
  }
  // Puts a loaded set onto a mesh. The mesh is rebuilt on every update() and
  // its material with it, so this re-applies cached maps rather than reloading.
  applyTo(mesh, set, { planeMetres = GROUND_METRES } = {}) {
    if (!mesh?.material || !set?.maps?.map) return false;
    const material = mesh.material;
    const repeat = repeatFor(set.tileMetres, planeMetres);
    for (const [slot, texture] of Object.entries(set.maps)) {
      texture.repeat.setScalar(repeat);
      texture.needsUpdate = true;
      material[slot] = texture;
    }
    // The procedural ground tints a grey plane; a photographed one must not be
    // tinted at all, and its own bump map would fight the real normal map.
    material.color.set("#ffffff");
    material.bumpMap = null;
    if (material.normalMap) material.normalScale.set(1, set.normalConvention === "DX" ? -1 : 1);
    if (material.aoMap) {
      material.aoMapIntensity = 1;
      // aoMap reads UV channel 1, which a PlaneGeometry does not have: without
      // this the map is bound, costs memory, and changes nothing on screen.
      const geometry = mesh.geometry;
      if (geometry?.attributes?.uv && !geometry.attributes.uv1)
        geometry.setAttribute("uv1", geometry.attributes.uv);
    }
    // The maps belong to this cache, not to the mesh: disposeGroup() in
    // scene.js only disposes a material's map when it is told the material
    // owns it, and these outlive every rebuild.
    material.userData.ownedMap = false;
    material.needsUpdate = true;
    return true;
  }
  dispose() {
    if (!this.loaded) return;
    Object.values(this.loaded.maps).forEach((texture) => texture.dispose());
    this.loaded = null;
  }
}
