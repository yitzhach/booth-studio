import test from "node:test";
import assert from "node:assert/strict";
import {
  ENV_PRESETS,
  DEFAULT_PRESET,
  DEFAULT_FIDELITY,
  EnvironmentLighting,
  artEnvIntensity,
  presetPaths,
  resolvePreset,
} from "../src/lighting.js";

const fakeScene = () => ({ environment: null, background: "procedural", fog: {}, environmentIntensity: 1 });
const fakeRenderer = () => ({ toneMappingExposure: 0 });
const disposable = (name) => ({ name, disposed: false, dispose() { this.disposed = true; } });
const fakePMREM = () => ({
  disposed: false,
  fromEquirectangular(source) { return { texture: { source: source.name }, disposed: false, dispose() { this.disposed = true; } }; },
  dispose() { this.disposed = true; },
});

// The app must run with public/assets empty, so an unknown or asset-free
// preset has to degrade to the procedural environment rather than fail.
test("unknown presets fall back to the default", () => {
  assert.equal(resolvePreset("nonsense").id, DEFAULT_PRESET);
  assert.equal(resolvePreset(undefined).id, DEFAULT_PRESET);
  assert.equal(resolvePreset("artfair").id, "artfair");
});

test("every preset declares a ground, horizon and exposure", () => {
  for (const [id, preset] of Object.entries(ENV_PRESETS)) {
    assert.ok(preset.label, `${id} label`);
    assert.ok(preset.ground && preset.horizon, `${id} surroundings`);
    assert.ok(preset.exposure > 0 && preset.exposure < 3, `${id} exposure`);
  }
  assert.equal(ENV_PRESETS[DEFAULT_PRESET].hdri, null, "default preset needs no assets");
});

test("preset paths split lighting from the visible backdrop", () => {
  assert.equal(presetPaths(resolvePreset(DEFAULT_PRESET)), null);
  const paths = presetPaths(resolvePreset("tradeshow"));
  assert.match(paths.light, /\.hdr$/);
  assert.match(paths.background, /\.jpg$/);
  assert.notEqual(paths.light, paths.background);
});

test("accurate colour keeps the environment out of artwork shading", () => {
  assert.equal(artEnvIntensity(DEFAULT_FIDELITY), 0);
  assert.equal(artEnvIntensity("accurate"), 0);
  assert.equal(artEnvIntensity("scene"), 1);
});

test("an asset-free preset applies exposure and leaves the backdrop alone", async () => {
  const scene = fakeScene(), renderer = fakeRenderer();
  const lighting = new EnvironmentLighting(renderer, { makePMREM: fakePMREM });
  const result = await lighting.apply(scene, DEFAULT_PRESET);
  assert.equal(result.environment, false);
  assert.equal(scene.environment, null);
  assert.equal(scene.background, "procedural");
  assert.equal(renderer.toneMappingExposure, ENV_PRESETS[DEFAULT_PRESET].exposure);
});

test("a failed asset load leaves the procedural environment intact", async () => {
  const scene = fakeScene(), renderer = fakeRenderer();
  const lighting = new EnvironmentLighting(renderer, {
    makePMREM: fakePMREM,
    loadHDR: () => Promise.reject(new Error("404")),
    loadBackground: () => Promise.reject(new Error("404")),
  });
  const result = await lighting.apply(scene, "tradeshow");
  assert.equal(result.environment, false);
  assert.equal(scene.environment, null);
  assert.equal(scene.background, "procedural");
  assert.equal(renderer.toneMappingExposure, ENV_PRESETS.tradeshow.exposure);
});

test("a loaded preset sets environment and background", async () => {
  const scene = fakeScene(), renderer = fakeRenderer();
  const lighting = new EnvironmentLighting(renderer, {
    makePMREM: fakePMREM,
    loadHDR: () => Promise.resolve(disposable("hdr")),
    loadBackground: () => Promise.resolve(disposable("bg")),
  });
  const result = await lighting.apply(scene, "artfair");
  assert.equal(result.environment, true);
  assert.equal(scene.environment.source, "hdr");
  assert.equal(scene.background.name, "bg");
  assert.equal(scene.fog, null);
  assert.equal(scene.environmentIntensity, ENV_PRESETS.artfair.envIntensity);
});

test("a user panorama outranks the preset backdrop", async () => {
  const scene = fakeScene(), renderer = fakeRenderer();
  const lighting = new EnvironmentLighting(renderer, {
    makePMREM: fakePMREM,
    loadHDR: () => Promise.resolve(disposable("hdr")),
    loadBackground: () => { throw new Error("must not load a backdrop"); },
  });
  const result = await lighting.apply(scene, "artfair", { background: false });
  assert.equal(result.environment, true);
  assert.equal(scene.background, "procedural");
});

// Every update() rebuilds the scene, so swapping presets repeatedly must not
// accumulate render targets on the GPU.
test("swapping presets disposes the previous environment", async () => {
  const scene = fakeScene(), renderer = fakeRenderer();
  const lighting = new EnvironmentLighting(renderer, {
    makePMREM: fakePMREM,
    loadHDR: () => Promise.resolve(disposable("hdr")),
    loadBackground: () => Promise.resolve(disposable("bg")),
  });
  await lighting.apply(scene, "artfair");
  const first = lighting.target, firstBackdrop = lighting.backdrop;
  await lighting.apply(scene, "home");
  assert.equal(first.disposed, true);
  assert.equal(firstBackdrop.disposed, true);
  assert.equal(lighting.target.disposed, false);
  lighting.dispose();
  assert.equal(scene.environment.source, "hdr");
  assert.equal(lighting.pmrem, null);
});

test("a superseded load is discarded rather than applied late", async () => {
  const scene = fakeScene(), renderer = fakeRenderer();
  let release;
  const slow = new Promise((resolve) => (release = resolve));
  let call = 0;
  const lighting = new EnvironmentLighting(renderer, {
    makePMREM: fakePMREM,
    loadHDR: () => (++call === 1 ? slow.then(() => disposable("stale")) : Promise.resolve(disposable("fresh"))),
    loadBackground: () => Promise.resolve(disposable("bg")),
  });
  const first = lighting.apply(scene, "artfair");
  await lighting.apply(scene, "home");
  release();
  const stale = await first;
  assert.equal(stale.stale, true);
  assert.equal(scene.environment.source, "fresh");
});
