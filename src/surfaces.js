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
//
// A set is loaded once per id and then handed to consumers — the ground today,
// the tent fabric and walls in the next phase — as a clone each. That matters
// because `repeat` lives on the texture, not on the material: a floor tiling
// every 2 m and a tent panel tiling every 0.5 m sharing one texture object
// would overwrite each other's scale on every rebuild. Clones share their
// image `source`, so the second consumer costs a few objects, not a second
// upload. A set lives while at least one consumer claims it and is released
// the moment none does, which keeps the GPU cost the same as when only the
// ground could ask for one.

export const GROUND_METRES = 180;

// Consumers are named, not counted, so a release can name the one it means.
export const GROUND_CONSUMER = "ground";

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
    // id → loaded set, consumer → the id it is holding, and id → in-flight
    // load, so two consumers asking for the same set at once fetch it once.
    this.sets = new Map();
    this.claims = new Map();
    this.pending = new Map();
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
  //
  // Loading is what claims a set for a consumer, rather than applyTo: a load
  // that finishes after the user has moved on would otherwise leave a set
  // cached that nobody ever binds. Claiming here means the consumer holds at
  // most one set at a time whether or not the mesh it was for still exists.
  async load(id, consumer = GROUND_CONSUMER) {
    if (!SURFACE_SETS[id]) {
      // The studio floor is deliberately texture-free; releasing here keeps a
      // set the user has navigated away from off the GPU.
      this.release(consumer);
      return null;
    }
    const cached = this.sets.get(id);
    if (cached) {
      this.claim(consumer, id);
      return cached;
    }
    let inFlight = this.pending.get(id);
    if (!inFlight) {
      inFlight = this.fetchSet(id).finally(() => this.pending.delete(id));
      this.pending.set(id, inFlight);
    }
    const set = await inFlight;
    if (!set) return null;
    this.sets.set(id, set);
    this.claim(consumer, id);
    return set;
  }
  async fetchSet(id) {
    const base = surfacePaths(id);
    const meta = await this.loadMeta(base.meta).catch(() => null);
    const paths = surfacePaths(id, { ...MAP_FILES, ...(meta?.files || {}) });
    const slots = Object.keys(MAP_FILES);
    const textures = await Promise.all(slots.map((slot) => this.loadTexture(paths[slot]).catch(() => null)));
    const maps = {};
    slots.forEach((slot, i) => {
      if (textures[i]) maps[slot] = textures[i];
    });
    if (!maps.map) {
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
    return {
      id,
      maps,
      // Per-consumer clones, built on first use. The base maps above are never
      // bound to a material; they are what the clones share a source with.
      views: new Map(),
      tileMetres: Number(meta?.tileMetres) > 0 ? Number(meta.tileMetres) : SURFACE_SETS[id].tileMetres,
      // ambientCG ships both conventions and the difference is invisible until
      // the light moves the wrong way. Flipping normalScale.y is the whole of
      // the DX→GL conversion, so a mislabelled download costs nothing to fix.
      normalConvention: meta?.normalMap === "DX" ? "DX" : "GL",
      credit: meta?.credit || "",
    };
  }
  // The clones one consumer binds. Built once per consumer and reused across
  // rebuilds, so the repeat set below survives an update() and no consumer can
  // rescale another's copy.
  viewFor(set, consumer) {
    let maps = set.views.get(consumer);
    if (maps) return maps;
    maps = {};
    for (const [slot, texture] of Object.entries(set.maps)) {
      const copy = texture.clone();
      // A clone is a new Texture over an already-uploaded source, so it needs
      // this once to be bound; repeat is a uniform and needs nothing after.
      copy.needsUpdate = true;
      maps[slot] = copy;
    }
    set.views.set(consumer, maps);
    return maps;
  }
  // Puts a loaded set onto a mesh. The mesh is rebuilt on every update() and
  // its material with it, so this re-applies cached maps rather than reloading.
  applyTo(mesh, set, { planeMetres = GROUND_METRES, consumer = GROUND_CONSUMER } = {}) {
    if (!mesh?.material || !set?.maps?.map) return false;
    const material = mesh.material;
    this.claim(consumer, set.id);
    const repeat = repeatFor(set.tileMetres, planeMetres);
    for (const [slot, texture] of Object.entries(this.viewFor(set, consumer))) {
      texture.repeat.setScalar(repeat);
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
  // A consumer holds one set at a time. Taking a new one hands the old one
  // back, which is what frees it when nobody else is using it.
  claim(consumer, id) {
    const previous = this.claims.get(consumer);
    if (previous === id) return;
    // The new claim goes in first, so the check inside drop() sees the truth
    // about who is holding the old set rather than counting this consumer.
    this.claims.set(consumer, id);
    if (previous !== undefined) this.drop(consumer, previous);
  }
  // Hands back whatever a consumer is holding: the ground calls this when the
  // user picks the studio floor or their own photograph.
  release(consumer) {
    const id = this.claims.get(consumer);
    if (id === undefined) return;
    this.claims.delete(consumer);
    this.drop(consumer, id);
  }
  // Disposes one consumer's clones, and the set itself once the last consumer
  // has let go of it.
  drop(consumer, id) {
    const set = this.sets.get(id);
    if (!set) return;
    const view = set.views.get(consumer);
    if (view) {
      Object.values(view).forEach((texture) => texture.dispose());
      set.views.delete(consumer);
    }
    for (const held of this.claims.values()) if (held === id) return;
    Object.values(set.maps).forEach((texture) => texture.dispose());
    this.sets.delete(id);
  }
  dispose() {
    for (const set of this.sets.values()) {
      for (const view of set.views.values()) Object.values(view).forEach((t) => t.dispose());
      Object.values(set.maps).forEach((texture) => texture.dispose());
    }
    this.sets.clear();
    this.claims.clear();
  }
}
