// A booth changed by name (src/scene-ops.js): what the studio assistant and
// any agent do through studio-api, which runs this same code from the
// `npm run bundle:scene` build (Art-Talk-Back D-070). Every result must be a
// project today's app opens.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { blankProject, demoProject, validateProject } from "../src/model.js";
import { manifestOf, projectFrom, sceneOf } from "../src/placement.js";
import {
  FORMAT, MAX_OPS, OPS, OP_NAMES, SceneOpError, applyOps, build, describe, fieldsOf, inches,
} from "../src/scene-ops.js";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
/** A synced booth: demo art, one with an image, as a scene and its manifest. */
function synced() {
  const p = demoProject();
  p.name = "Winter Park";
  p.assets.heron = { width: 1000, height: 800, role: "artwork", name: "heron.png", data: PNG };
  p.art[0].asset = "heron";
  p.art[0].title = "Heron";
  p.booth.pedestals = [];
  return { p, scene: sceneOf(p), images: manifestOf(p, { heron: "01J000000000000000000000FF" }) };
}
/** The scene back as the app would open it, with its real images. */
const opens = (scene, p) => validateProject(projectFrom({ scene, images: manifestOf(p) }, p.assets));

test("describe: the booth, its walls, each work and piece with its id and place — never the images", () => {
  const { scene, images } = synced();
  const d = describe(scene, images);
  assert.equal(d.format, FORMAT);
  assert.equal(d.name, "Winter Park");
  assert.deepEqual(d.booth, { width: 120, depth: 120, height: 96, venue: "outdoor", tent: false, color: "#45474a" });
  assert.deepEqual(d.walls.map((w) => w.wall), ["back", "left", "right"]);
  assert.equal(d.art.length, 6);
  assert.deepEqual(d.art[0], { id: scene.art[0].id, title: "Heron", wall: "back", x: 12, y: 32, w: 36, h: 48, hasImage: true });
  assert.equal(d.art[1].hasImage, false);
  assert.match(d.frame, /x across from the booth's centre/);
  assert.equal(JSON.stringify(d).includes("base64"), false);
  assert.ok(JSON.stringify(d).length < 4000, "small enough to hand a model");
});

test("every op is in the catalog with a JSON Schema whose op is its own name", () => {
  assert.deepEqual(OP_NAMES, ["rename", "set_booth", "add_furniture", "change_furniture", "remove_furniture", "add_wall", "change_wall", "remove_wall", "change_art", "remove_art", "arrange_wall"]);
  for (const o of OPS) {
    assert.equal(o.schema.properties.op.const, o.name);
    assert.ok(o.schema.required.includes("op"));
    assert.equal(o.schema.additionalProperties, false);
    assert.ok(o.description.length > 10);
  }
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(OPS)));
});

test("furniture: added by kind at its real size, moved, turned, resized and removed, by id or by ref", () => {
  const { p, scene, images } = synced();
  const { scene: s1, lines } = applyOps(scene, [
    { op: "add_furniture", kind: "table6", x: 0, z: 30, ref: "t" },
    { op: "add_furniture", kind: "chair", x: 0, z: 10, rotation: 180, ref: "c" },
    { op: "change_furniture", id: "@t", x: -24, rotation: 90 },
    { op: "change_furniture", id: "@c", width: 20, name: "Artist's chair" },
  ], images);
  assert.equal(lines.length, 4);
  assert.match(lines[0], /^Add Table 6′ with cloth \(6′ × 2′ 6″\), centred, 2′ 6″ toward the front$/);
  assert.match(lines[2], /Table 6′ with cloth: to 2′ left of centre, 2′ 6″ toward the front, turned to 90°/);
  const [table, chair] = s1.booth.pedestals;
  assert.deepEqual([table.kind, table.width, table.depth, table.height, table.x, table.z, table.rotation], ["table6", 72, 30, 30, -24, 30, 90]);
  assert.deepEqual([chair.name, chair.width, chair.rotation], ["Artist's chair", 20, 180]);
  assert.doesNotThrow(() => opens(s1, p));
  const { scene: s2, lines: l2 } = applyOps(s1, [{ op: "remove_furniture", id: table.id }], images);
  assert.deepEqual(s2.booth.pedestals.map((x) => x.id), [chair.id]);
  assert.equal(l2[0], "Remove Table 6′ with cloth");
  // A piece past the booth is pulled back to its edge, as a drag would be.
  const { scene: s3 } = applyOps(s1, [{ op: "change_furniture", id: chair.id, x: 500 }], images);
  assert.equal(s3.booth.pedestals[1].x, 60);
});

test("the booth: venue, size, height, canopy and colour; what no longer fits is pulled inside", () => {
  const { p, scene, images } = synced();
  const { scene: s1, lines } = applyOps(scene, [{ op: "set_booth", width: 180, depth: 96, tent: true, color: "#FFFFFF" }], images);
  assert.deepEqual([s1.booth.width, s1.booth.depth, s1.booth.tent, s1.booth.color], [180, 96, true, "#ffffff"]);
  assert.deepEqual([s1.booth.walls.back.width, s1.booth.walls.left.width, s1.booth.walls.right.width], [180, 96, 96]);
  assert.equal(lines[0], "Make the booth 15′ wide × 8′ deep, with a canopy, walls #ffffff");
  // Side walls of 60″: the works at x 73 and 80 no longer fit where they were.
  const { scene: s2 } = applyOps(scene, [{ op: "set_booth", depth: 60 }], images);
  for (const a of s2.art.filter((a) => a.wall !== "back")) assert.ok(a.x + a.w <= 60.001, `${a.title} inside the 60″ wall`);
  assert.doesNotThrow(() => opens(s2, p));
  const { scene: s3, lines: l3 } = applyOps(scene, [{ op: "set_booth", venue: "artshow", height: 120 }], images);
  assert.equal(s3.booth.venue, "artshow");
  assert.equal(s3.booth.tent, false);
  assert.equal(s3.booth.walls.back.height, 120);
  assert.equal(l3[0], "Make the booth an indoor art-show booth, walls 10′ tall");
  assert.doesNotThrow(() => opens(s3, p));
  assert.throws(() => applyOps(s3, [{ op: "set_booth", tent: true }], images), /art-show booth has no canopy/);
});

test("art: moved along and between walls, resized keeping its shape, retitled, taken down; a wall hung at 60″ and spaced", () => {
  const { p, scene, images } = synced();
  const heron = scene.art[0].id;
  const { scene: s1, lines } = applyOps(scene, [
    { op: "change_art", id: heron, w: 45 },
    { op: "change_art", id: heron, wall: "left", x: 30, y: 40, title: "Great Blue Heron" },
  ], images);
  const a = s1.art.find((x) => x.id === heron);
  // 60″ tall on a 96″ wall: asked for 40″ up, pulled back to 36″, and the card says where it went.
  assert.deepEqual([a.wall, a.x, a.y, a.w, a.h, a.title], ["left", 30, 36, 45, 60, "Great Blue Heron"]);
  assert.equal(lines[0], "“Heron”: 3′ 9″ × 5′");
  assert.match(lines[1], /^“Heron”: to Left wall, 2′ 6″ from the wall's left end, bottom 3′ off the floor, titled “Great Blue Heron”$/);
  assert.doesNotThrow(() => opens(s1, p));
  assert.throws(() => applyOps(scene, [{ op: "change_art", id: heron, w: 200 }], images), /bigger than Back wall/);

  const { scene: s2, lines: l2 } = applyOps(scene, [{ op: "arrange_wall", wall: "back" }], images);
  const back = s2.art.filter((x) => x.wall === "back").sort((x, y) => x.x - y.x);
  for (const w of back) assert.equal(w.y + w.h / 2, 60, `${w.title} centred at 60″`);
  const gaps = [back[0].x, back[1].x - (back[0].x + back[0].w), 120 - (back[1].x + back[1].w)];
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.02, `even gaps ${gaps}`);
  assert.equal(l2[0], "Back wall: 2 works centred 5′ off the floor, evenly spaced");

  const { scene: s3, lines: l3 } = applyOps(scene, [{ op: "remove_art", id: heron }], images);
  assert.equal(s3.art.length, 5);
  assert.equal(l3[0], "Take “Heron” off the wall");
  // Its image stays in the manifest the caller keeps; the scene just no longer hangs it.
  assert.doesNotThrow(() => opens(s3, p));
});

test("free-standing walls: added, hung on (by ref), moved, and only removed once empty; perimeter walls hide", () => {
  const { p, scene, images } = synced();
  const heron = scene.art[0].id;
  const { scene: s1, lines } = applyOps(scene, [
    { op: "add_wall", x: 0, z: 0, width: 60, name: "Divider", ref: "d" },
    { op: "change_art", id: heron, wall: "panel:@d", x: 10, y: 30 },
    { op: "change_wall", wall: "panel:@d", rotation: 45, x: 20 },
    { op: "change_wall", wall: "right", hidden: true },
  ], images);
  const panel = s1.booth.panels[0];
  assert.deepEqual([panel.name, panel.width, panel.x, panel.rotation], ["Divider", 60, 20, 45]);
  assert.equal(s1.art.find((x) => x.id === heron).wall, `panel:${panel.id}`);
  assert.equal(s1.booth.walls.right.enabled, false);
  assert.equal(lines[3], "Right wall: hidden");
  assert.doesNotThrow(() => opens(s1, p));
  assert.throws(() => applyOps(s1, [{ op: "remove_wall", wall: `panel:${panel.id}` }], images), /1 work hangs on Divider; move or remove it first/);
  const { scene: s2 } = applyOps(s1, [{ op: "remove_art", id: heron }, { op: "remove_wall", wall: `panel:${panel.id}` }], images);
  assert.deepEqual(s2.booth.panels, []);
  assert.throws(() => applyOps(scene, [{ op: "remove_wall", wall: "back" }], images), /hidden .* but not removed/);
  assert.throws(() => applyOps(scene, [{ op: "change_wall", wall: "back", width: 200 }], images), /at most 10′ wide/);
});

test("nothing is half-done: a bad op anywhere refuses the whole list, and says which and why", () => {
  const { scene, images } = synced();
  const before = JSON.stringify(scene);
  const cases = [
    [[{ op: "fly" }], /Op 1: there is no op "fly"/],
    [[{ op: "rename", name: "A", colour: "red" }], /Op 1 \(rename\): unknown field "colour"/],
    [[{ op: "add_furniture" }], /Op 1 \(add_furniture\) needs kind/],
    [[{ op: "add_furniture", kind: "sofa" }], /kind must be one of/],
    [[{ op: "add_furniture", kind: "chair", x: "left" }], /x must be a number/],
    [[{ op: "rename", name: "ok" }, { op: "change_furniture", id: "nope", x: 1 }], /Op 2: this booth has no furniture with id nope/],
    [[{ op: "change_furniture", id: "@t", x: 1 }], /nothing earlier in this list was given ref "t"/],
    [[{ op: "add_furniture", kind: "chair", width: 200 }], /a Chair is 4–96″ wide/],
    [[{ op: "set_booth", width: 20 }], /width must be at least 48/],
    [[{ op: "set_booth" }], /say what to change/],
    [[{ op: "change_art", id: scene.art[0].id, wall: "ceiling" }], /no wall "ceiling"/],
    [Array.from({ length: MAX_OPS + 1 }, () => ({ op: "rename", name: "x" })), /At most 50 ops/],
    [[], /at least one op/],
  ];
  for (const [ops, re] of cases) {
    const err = (() => { try { applyOps(scene, ops, images); } catch (e) { return e; } })();
    assert.ok(err instanceof SceneOpError, `${JSON.stringify(ops).slice(0, 80)} → SceneOpError`);
    assert.match(err.message, re);
  }
  assert.equal(JSON.stringify(scene), before, "the scene passed in is never changed");
  const err = (() => { try { applyOps(scene, [{ op: "rename", name: "x" }, { op: "fly" }], images); } catch (e) { return e; } })();
  assert.equal(err.index, 1);
});

test("too many pieces is refused in words, not by the validator", () => {
  const { scene, images } = synced();
  const ops = Array.from({ length: 25 }, (_, i) => ({ op: "add_furniture", kind: "stool", x: i - 12 }));
  assert.throws(() => applyOps(scene, ops, images), /at most 24 pieces of furniture/);
});

test("build: a new booth from a show, a size and ops, with columns for its placement", () => {
  const { scene, lines } = build({
    name: "Spring Fling",
    show: "artshow",
    size: "10x15",
    ops: [
      { op: "add_furniture", kind: "table6", x: 0, z: 40, ref: "t" },
      { op: "add_furniture", kind: "chair", x: 0, z: 15, rotation: 180 },
      { op: "change_furniture", id: "@t", x: -30 },
    ],
  });
  assert.equal(lines[0], "New 10 × 15 ft booth for indoor art show · panel walls and light bar, named “Spring Fling”");
  assert.equal(lines.length, 4);
  assert.equal(scene.assets, undefined);
  assert.equal(scene.booth.venue, "artshow");
  assert.equal(scene.booth.pedestals.length, 2);
  assert.deepEqual(fieldsOf(scene), { kind: "booth", name: "Spring Fling", format: FORMAT, width: 180, depth: 120, height: scene.booth.height, sizeUnit: "in" });
  assert.doesNotThrow(() => validateProject({ ...scene, assets: {} }));
  const plain = build();
  assert.equal(plain.scene.booth.width, 120);
  assert.throws(() => build({ show: "circus" }), /show must be one of/);
  assert.throws(() => build({ size: "9x9" }), /size must be one of/);
});

test("inches reads like a tape: feet and inches", () => {
  assert.deepEqual([inches(66), inches(8), inches(24), inches(0), inches(-30), inches(30.25)], ["5′ 6″", "8″", "2′", "0″", "−2′ 6″", "2′ 6.3″"]);
});

test("the bundle studio-api vendors runs on its own: no DOM, the same ops, the same results", async () => {
  execFileSync("npm", ["run", "-s", "bundle:scene"], { stdio: "pipe" });
  const bundle = await import(`../dist-scene/booth-scene.js?${Date.now()}`);
  assert.deepEqual(bundle.OP_NAMES, OP_NAMES);
  const { scene, images } = synced();
  const ops = [{ op: "set_booth", width: 180 }, { op: "arrange_wall", wall: "back", line: 58 }];
  const strip = (s) => JSON.stringify(s);
  assert.equal(strip(bundle.applyOps(scene, ops, images).scene), strip(applyOps(scene, ops, images).scene));
  assert.ok(new bundle.SceneOpError("x") instanceof Error);
});

test("a blank booth (no art, no furniture list) takes ops too", () => {
  const p = blankProject();
  delete p.booth.pedestals;
  const { scene } = applyOps(sceneOf(p), [{ op: "add_furniture", kind: "pedestal" }]);
  assert.equal(scene.booth.pedestals.length, 1);
  assert.equal(scene.booth.pedestals[0].kind, undefined, "a pedestal is stored the way the app stores one");
});
