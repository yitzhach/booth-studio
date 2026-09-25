// The AI-render hook (src/ai-render.js): the scene in words, the pack's
// shape, the mask's legend, and an adapter that does nothing until a
// provider is chosen — and then does exactly what the provider does.
import test from "node:test";
import assert from "node:assert/strict";
import { demoProject } from "../src/model.js";
import { newHall } from "../src/hall.js";
import { FLOOR_TEMPLATES } from "../src/show.js";
import { SURFACES, TAG_SURFACE, describeBooth, describeScene, describeShow, isPack, provider, render, renderPack } from "../src/ai-render.js";
import { TAGS } from "../src/views.js";

test("the booth is described from the project: size, walls, every work, the rest", () => {
  const p = demoProject();
  const text = describeBooth(p);
  assert.match(text, /^A 10 ft × 10 ft /);
  assert.match(text, /walls on three sides 8 ft high/);
  assert.match(text, /6 works on the walls/);
  for (const a of p.art) assert.ok(text.includes(`“${a.title}” (${a.w} × ${a.h} in`), a.title);
  assert.match(text, /2 spotlights/);
  // A hidden work is not in the picture, so not in the words.
  p.art[0].hidden = true;
  assert.match(describeBooth(p), /5 works/);
  p.art = [];
  assert.match(describeBooth(p), /No artwork is hung/);
});

test("the show is described from its pieces, and names the booth drawn in full", () => {
  const street = { ...newHall(), ...FLOOR_TEMPLATES.street.build(101) };
  street.booths[101] = { status: "sold" };
  const text = describeShow(street, 105);
  assert.match(text, /^An outdoor fair, 160 ft × 50 ft, with 24 booths \(24 canopy tent; 1 sold\)/);
  assert.match(text, /walkway/);
  assert.match(text, /Booth 105 is shown in full detail/);
  const scene = describeScene(demoProject(), { show: street, openNumber: 105 });
  assert.equal(scene.split("\n\n").length, 3, "the show, the open booth, and the instruction");
  assert.match(scene, /Booth 105: A 10 ft/);
  assert.equal(describeScene(demoProject()).split("\n\n").length, 2, "a booth alone: the booth and the instruction");
  assert.doesNotMatch(describeScene(demoProject(), { show: street }), /shown in full detail/, "no booth open, none named");
});

test("the mask's colours are distinct, and every view tag has a surface", () => {
  const colours = Object.values(SURFACES).map((s) => s.color.toLowerCase());
  assert.equal(new Set(colours).size, colours.length);
  assert.ok(!colours.includes("#000000"), "black is the backdrop");
  // Far apart: no two within 60 of each other in every channel.
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (let i = 0; i < colours.length; i++)
    for (let j = i + 1; j < colours.length; j++) {
      const a = rgb(colours[i]),
        b = rgb(colours[j]);
      assert.ok(a.some((v, k) => Math.abs(v - b[k]) > 60), `${colours[i]} and ${colours[j]} are too close`);
    }
  for (const tag of Object.keys(TAGS)) assert.ok(SURFACES[TAG_SURFACE[tag]], tag);
});

test("a pack carries the three images, the camera, the words and the legend", () => {
  const pack = renderPack({ images: { beauty: "data:a", depth: "data:b", mask: "data:c" }, width: 1536, height: 864, camera: { position: [1, 2, 3], target: [0, 1, 0], near: 0.5, far: 9 }, description: "x", project: "Spring" });
  assert.ok(isPack(pack));
  assert.equal(pack.legend.artwork.color, SURFACES.artwork.color);
  assert.deepEqual([pack.depth.near, pack.depth.far], [0.5, 9]);
  assert.deepEqual(JSON.parse(JSON.stringify(pack)), pack, "plain JSON");
  assert.equal(isPack({ ...pack, version: 99 }), false);
});

test("the adapter does nothing without a provider, and hands a provider the pack", async () => {
  assert.equal(provider, null, "no provider is chosen: local-first");
  const pack = renderPack({ images: { beauty: "data:a", depth: "data:b", mask: "data:c" }, width: 2, height: 1, camera: {}, description: "" });
  await assert.rejects(render(pack), /No AI provider is set up/);
  await assert.rejects(render(null), /No AI provider/, "says why before looking at the frame");
  let seen = null;
  const fake = { name: "Test", render: async (f) => ((seen = f), "image") };
  assert.equal(await render(pack, fake), "image");
  assert.equal(seen, pack);
  await assert.rejects(render({ nope: 1 }, fake), /not an AI render pack/);
});
