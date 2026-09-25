// The show floor's later additions: growing the floor to fit its pieces,
// floors saved as templates, and the drape colour.
import test from "node:test";
import assert from "node:assert/strict";
import { newHall } from "../src/hall.js";
import { DEFAULT_DRAPE, DRAPES, FLOOR_TEMPLATES, boothBlock, boundsOf, floorTemplateOf, growToFit, offFloor, toFloor, validFloorTemplate, validShow } from "../src/show.js";
import { showParts } from "../src/show-scene.js";
import { blankProject, validateProject } from "../src/model.js";

test("a block laid past the floor's edge is found, and the floor grows to hold it", () => {
  const h = toFloor(newHall());
  assert.deepEqual(offFloor(h), []);
  assert.equal(growToFit(h), false, "nothing off the floor, nothing changes");
  const block = boothBlock(h.items, { count: 4, perRow: 4, w: 120, d: 120, x: 0, y: h.venue.depth + 200 });
  h.items.push(...block);
  assert.equal(offFloor(h).length, 4);
  const before = h.venue.width;
  assert.equal(growToFit(h), true);
  assert.deepEqual(offFloor(h), []);
  assert.ok(h.venue.width >= before, "never shrinks");
  assert.equal(h.venue.depth, boundsOf(h.items).b + 60);
});

test("a piece above and left of the floor moves everything with it", () => {
  const h = toFloor(newHall());
  const a = h.items[0];
  const gap = h.items[1].x - a.x;
  a.x = -500;
  a.y = -300;
  const rel = h.items[1].x - a.x;
  growToFit(h);
  assert.deepEqual(offFloor(h), []);
  assert.equal(h.items[1].x - a.x, rel, "nothing moves against anything else");
  assert.equal(boundsOf(h.items).l, 60);
  assert.equal(boundsOf(h.items).t, 60);
  assert.ok(gap);
});

test("a floor saved as a template keeps its size and pieces, not its sales", () => {
  const h = toFloor(newHall());
  h.booths[101] = { status: "sold", name: "Jane" };
  h.mine = 101;
  const t = floorTemplateOf(h, "Spring fair");
  assert.ok(validFloorTemplate(t));
  assert.deepEqual(t.venue, h.venue);
  assert.equal(t.items.length, h.items.length);
  assert.ok(!("booths" in t) && !("mine" in t) && !("designs" in t));
  t.items[0].x += 1;
  assert.notEqual(t.items[0].x, h.items[0].x, "a copy, not the floor's own pieces");
  assert.ok(validFloorTemplate(JSON.parse(JSON.stringify(t))), "survives storage");
  assert.equal(validFloorTemplate({ ...t, items: [{ kind: "nope" }] }), false);
  assert.equal(validFloorTemplate(null), false);
  // Each built-in template still builds a valid floor.
  for (const b of Object.values(FLOOR_TEMPLATES)) assert.ok(validShow(b.build(101)));
});

test("the drape colour is optional, checked, and reaches the 3D parts", () => {
  const h = toFloor(newHall());
  const drapes = () => showParts(h).filter((p) => p.finish === "fabric" && p.h === 96).map((p) => p.color);
  assert.ok(drapes().every((c) => c === DEFAULT_DRAPE), "unset: the colour every floor had");
  h.venue.drape = "#1f2226";
  assert.ok(DRAPES[h.venue.drape]);
  assert.ok(drapes().length && drapes().every((c) => c === "#1f2226"));
  assert.ok(validShow(h));
  const p = blankProject();
  p.hall = h;
  assert.doesNotThrow(() => validateProject(JSON.parse(JSON.stringify(p))));
  assert.equal(validShow({ ...h, venue: { ...h.venue, drape: "red" } }), false);
  assert.equal(validShow({ ...h, venue: { ...h.venue, drape: "#12345" } }), false);
});
