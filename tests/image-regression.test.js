import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeImageEdits, hasImageEdits, DEFAULT_IMAGE_EDITS } from "../src/image-edit.js";

test("null and omitted edits preserve unedited images", () => {
  for (const edits of [null, undefined, {}]) {
    assert.deepEqual(normalizeImageEdits(edits), DEFAULT_IMAGE_EDITS);
    assert.equal(hasImageEdits(edits), false);
  }
});

test("unedited image texture loads with the default null adjustment argument", async () => {
  const source = readFileSync(new URL("../src/scene.js", import.meta.url), "utf8");
  const method = source.slice(source.indexOf("  async texture("), source.indexOf("  update(p,"));
  class ImageStub {
    width = 32; height = 32;
    set src(value) { this.data = value; queueMicrotask(() => this.onload()); }
  }
  class TextureStub { constructor(image) { this.image = image; } }
  const make = new Function("Image", "T", "hasImageEdits",
    "return {" + method.replace("async texture", "async texture") + "};");
  const scene = make(ImageStub, { Texture: TextureStub, SRGBColorSpace: "srgb" }, hasImageEdits);
  scene.tex = new Map();
  scene.p = { assets: { original: { data: "data:image/png;base64,test" } } };
  scene.renderer = { capabilities: { getMaxAnisotropy: () => 8 } };
  const texture = await scene.texture("original");
  assert.equal(texture.image.data, scene.p.assets.original.data);
  assert.equal(texture.needsUpdate, true);
  assert.equal(await scene.texture("original"), texture);
});

test("artwork transforms reuse scene objects without disposing textures", () => {
  const source = readFileSync(new URL("../src/scene.js", import.meta.url), "utf8");
  const method = source.slice(source.indexOf("  updateArtwork("), source.indexOf("  setView("));
  const scene = new Function("IN", "return {" + method + "};")(0.0254);
  let position, scale;
  const group = { position: { set: (...v) => position = v }, scale: { set: (...v) => scale = v } };
  scene.artGroups = new Map([["art", { group, initial: { w: 20, h: 30, thickness: 1 } }]]);
  scene.renderer = { shadowMap: {} };
  scene.updateArtwork({ id: "art", x: 10, y: 20, w: 40, h: 60, thickness: 1, offset: 1 });
  assert.deepEqual(scale, [2, 2, 1]);
  assert.equal(position[0], 30 * 0.0254);
  assert.equal(scene.artGroups.get("art").group, group);
});
