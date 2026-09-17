import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  GROUND_METRES,
  MAP_FILES,
  SURFACE_SETS,
  SurfaceTextures,
  repeatFor,
  surfacePaths,
} from "../src/surfaces.js";

const fakeRenderer = () => ({ capabilities: { getMaxAnisotropy: () => 16 } });
const fakeTexture = (name) => ({
  name,
  colorSpace: T.SRGBColorSpace,
  wrapS: T.ClampToEdgeWrapping,
  wrapT: T.ClampToEdgeWrapping,
  anisotropy: 1,
  repeat: { value: 1, setScalar(v) { this.value = v; } },
  disposed: false,
  dispose() { this.disposed = true; },
});
// A stand-in for the rebuilt ground mesh: a real material would work, but the
// rules under test are about which slots get set, not about shading.
const fakeMesh = () => ({
  geometry: { attributes: { uv: { name: "uv" } }, setAttribute(key, value) { this.attributes[key] = value; } },
  material: {
    color: { value: null, set(v) { this.value = v; } },
    normalScale: { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } },
    bumpMap: { name: "procedural" },
    userData: {},
    needsUpdate: false,
  },
});
const loaders = (present = Object.keys(MAP_FILES), meta = null) => ({
  loadTexture: (url) => {
    const slot = Object.keys(MAP_FILES).find((key) => url.endsWith(MAP_FILES[key]));
    return present.includes(slot) ? Promise.resolve(fakeTexture(slot)) : Promise.reject(new Error("404"));
  },
  loadMeta: () => (meta ? Promise.resolve(meta) : Promise.reject(new Error("404"))),
});

test("every surface set declares a real-world tile size", () => {
  for (const [id, set] of Object.entries(SURFACE_SETS)) {
    assert.ok(set.label, `${id} label`);
    assert.ok(set.tileMetres > 0 && set.tileMetres < 20, `${id} tile size`);
  }
});

// The whole point of deriving repeat: a 2 m tile is 2 m whatever it is a
// picture of, so surfaces stay the same scale as each other.
test("repeat is derived from the tile size, not hardcoded", () => {
  assert.equal(repeatFor(2), 90);
  assert.equal(repeatFor(1), 180);
  assert.equal(repeatFor(4), 45);
  assert.equal(repeatFor(2, 360), 180);
  // A missing or nonsense tile size must not divide by zero and blank the floor.
  assert.ok(Number.isFinite(repeatFor(0)));
  assert.ok(Number.isFinite(repeatFor(undefined)));
});

test("paths are named after the ground kind and include metadata", () => {
  assert.equal(surfacePaths("studio"), null);
  const paths = surfacePaths("concrete");
  assert.equal(paths.map, "assets/textures/concrete/color.jpg");
  assert.equal(paths.normalMap, "assets/textures/concrete/normal.jpg");
  assert.match(paths.meta, /meta\.json$/);
  // meta.json may rename the files; the app must follow it.
  const renamed = surfacePaths("concrete", { ...MAP_FILES, map: "color.webp" });
  assert.equal(renamed.map, "assets/textures/concrete/color.webp");
});

test("a ground kind with no files falls back rather than failing", async () => {
  const surfaces = new SurfaceTextures(fakeRenderer(), loaders([]));
  assert.equal(await surfaces.load("concrete"), null);
  assert.equal(await surfaces.load("studio"), null);
  assert.equal(surfaces.loaded, null);
});

test("a colour map alone is enough; the rest are optional", async () => {
  const surfaces = new SurfaceTextures(fakeRenderer(), loaders(["map"]));
  const set = await surfaces.load("grass");
  assert.ok(set.maps.map);
  assert.equal(set.maps.normalMap, undefined);
  assert.equal(set.maps.roughnessMap, undefined);
});

// Decoding a normal or roughness map through a gamma curve is the classic
// silent PBR bug: it looks "nearly right" and every angle is wrong.
test("only the colour map is sRGB", async () => {
  const surfaces = new SurfaceTextures(fakeRenderer(), loaders());
  const set = await surfaces.load("concrete");
  assert.equal(set.maps.map.colorSpace, T.SRGBColorSpace);
  for (const slot of ["normalMap", "roughnessMap", "aoMap"])
    assert.equal(set.maps[slot].colorSpace, T.NoColorSpace, `${slot} must stay linear`);
});

test("every map repeats and filters the same way", async () => {
  const surfaces = new SurfaceTextures(fakeRenderer(), loaders());
  const set = await surfaces.load("concrete");
  const mesh = fakeMesh();
  assert.equal(surfaces.applyTo(mesh, set), true);
  for (const [slot, texture] of Object.entries(set.maps)) {
    assert.equal(texture.wrapS, T.RepeatWrapping, `${slot} wrapS`);
    assert.equal(texture.wrapT, T.RepeatWrapping, `${slot} wrapT`);
    assert.equal(texture.anisotropy, 8, `${slot} anisotropy`);
    assert.equal(texture.repeat.value, repeatFor(set.tileMetres), `${slot} repeat`);
    assert.equal(mesh.material[slot], texture, `${slot} is bound to the material`);
  }
});

test("meta.json can override the tile size", async () => {
  const surfaces = new SurfaceTextures(fakeRenderer(), loaders(undefined, { tileMetres: 4 }));
  const set = await surfaces.load("wood");
  assert.equal(set.tileMetres, 4);
  const mesh = fakeMesh();
  surfaces.applyTo(mesh, set);
  assert.equal(set.maps.map.repeat.value, 45);
});

test("applying a set drops the procedural tint and bump", async () => {
  const surfaces = new SurfaceTextures(fakeRenderer(), loaders());
  const mesh = fakeMesh();
  surfaces.applyTo(mesh, await surfaces.load("asphalt"));
  assert.equal(mesh.material.color.value, "#ffffff", "a photograph must not be tinted");
  assert.equal(mesh.material.bumpMap, null, "the procedural bump would fight the normal map");
  assert.equal(mesh.material.userData.ownedMap, false, "the cache owns these maps, not the mesh");
});

// aoMap reads UV channel 1, which PlaneGeometry does not have.
test("an occlusion map gets the second UV channel it reads from", async () => {
  const surfaces = new SurfaceTextures(fakeRenderer(), loaders());
  const mesh = fakeMesh();
  surfaces.applyTo(mesh, await surfaces.load("carpet"));
  assert.equal(mesh.geometry.attributes.uv1, mesh.geometry.attributes.uv);
});

test("a DirectX normal map is flipped rather than refused", async () => {
  const gl = new SurfaceTextures(fakeRenderer(), loaders(undefined, { normalMap: "GL" }));
  const glMesh = fakeMesh();
  gl.applyTo(glMesh, await gl.load("concrete"));
  assert.deepEqual([glMesh.material.normalScale.x, glMesh.material.normalScale.y], [1, 1]);

  const dx = new SurfaceTextures(fakeRenderer(), loaders(undefined, { normalMap: "DX" }));
  const dxMesh = fakeMesh();
  dx.applyTo(dxMesh, await dx.load("concrete"));
  assert.deepEqual([dxMesh.material.normalScale.x, dxMesh.material.normalScale.y], [1, -1]);
});

// update() runs on every edit and rebuilds the ground mesh each time.
test("an unchanged ground kind reuses its maps", async () => {
  let loads = 0;
  const base = loaders();
  const surfaces = new SurfaceTextures(fakeRenderer(), {
    ...base,
    loadTexture: (url) => { loads++; return base.loadTexture(url); },
  });
  const first = await surfaces.load("grass");
  const again = await surfaces.load("grass");
  assert.equal(again, first);
  assert.equal(loads, 4, "one fetch per map, once");
  // A new material on the rebuilt mesh still gets the cached maps.
  const mesh = fakeMesh();
  assert.equal(surfaces.applyTo(mesh, again), true);
  assert.equal(mesh.material.map, first.maps.map);
});

test("swapping ground kinds releases the previous maps", async () => {
  const surfaces = new SurfaceTextures(fakeRenderer(), loaders());
  const grass = await surfaces.load("grass");
  await surfaces.load("concrete");
  assert.ok(Object.values(grass.maps).every((t) => t.disposed), "grass maps released");
  assert.ok(Object.values(surfaces.loaded.maps).every((t) => !t.disposed), "concrete maps kept");
  // The studio floor has no set at all, and must not leave one on the GPU.
  const concrete = surfaces.loaded;
  await surfaces.load("studio");
  assert.equal(surfaces.loaded, null);
  assert.ok(Object.values(concrete.maps).every((t) => t.disposed), "concrete maps released");
});

test("applying nothing is a no-op, not a crash", async () => {
  const surfaces = new SurfaceTextures(fakeRenderer(), loaders([]));
  assert.equal(surfaces.applyTo(fakeMesh(), null), false);
  assert.equal(surfaces.applyTo(null, { maps: { map: fakeTexture("map") } }), false);
});

test("the ground plane the app builds is the one repeat assumes", () => {
  assert.equal(GROUND_METRES, 180);
});
