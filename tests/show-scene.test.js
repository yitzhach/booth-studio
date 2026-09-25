// The show floor in 3D (src/show-scene.js): the plan stood up as parts, the
// world placed round the booth whose design is open, the walk's start and
// the walkthrough timeline. The pure half is pinned here; `buildShow` is
// built in Node too, since three's geometry needs no GPU.
import test from "node:test";
import assert from "node:assert/strict";
import { newHall } from "../src/hall.js";
import { toFloor, boothBlock } from "../src/show.js";
import { aisleLines, buildShow, homeBooth, planToWorld, showLabels, showOverview, showParts, showReach, showWalkStart, showWalkthrough, worldFrame } from "../src/show-scene.js";
import { MAX_KEYS, MAX_SECONDS, MIN_SECONDS, normalizeTimeline, sampleTimeline } from "../src/timeline.js";

const IN = 0.0254;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const floor = (items, venue = { kind: "indoor", width: 1200, depth: 900 }) => ({ ...newHall(), items, venue });

test("the home booth is the opened one, else mine, and sits at the world origin facing +z", () => {
  const h = floor([
    { id: "a", kind: "booth", number: 101, x: 300, y: 200, w: 120, d: 120 },
    { id: "b", kind: "booth", number: 102, x: 600, y: 400, w: 120, d: 120, rot: 90 },
  ]);
  assert.equal(homeBooth(h), null);
  assert.deepEqual(worldFrame(h), { x: 600, y: 450, rot: 0 });
  h.mine = 101;
  assert.equal(homeBooth(h).id, "a");
  h.open = 102;
  assert.equal(homeBooth(h).id, "b", "an opened booth wins over mine");
  const frame = worldFrame(h);
  const [x, z] = planToWorld(frame, 600, 400);
  assert.ok(near(x, 0) && near(z, 0));
  // Booth b is turned 90° clockwise, so its front (plan +y in its own frame)
  // points to plan −x. A point 60″ that way must land on world +z.
  const [fx, fz] = planToWorld(frame, 600 - 60, 400);
  assert.ok(near(fx, 0) && near(fz, 60 * IN), `${fx} ${fz}`);
});

test("each booth style stands up its own parts, and the home booth none", () => {
  const h = floor([
    { id: "p", kind: "booth", number: 1, x: 100, y: 100, w: 120, d: 120 },
    { id: "h", kind: "booth", number: 2, x: 300, y: 100, w: 120, d: 120, style: "hardwall" },
    { id: "t", kind: "booth", number: 3, x: 500, y: 100, w: 120, d: 120, style: "tent" },
    { id: "o", kind: "booth", number: 4, x: 700, y: 100, w: 120, d: 120, style: "open" },
  ]);
  const count = (id, skip) => showParts(h, { skip }).filter((p) => p.piece === id).length;
  assert.equal(count("p"), 4, "pipe and drape: floor, back drape, two rails");
  assert.equal(count("h"), 4, "hard wall: floor and three walls");
  assert.equal(count("t"), 7, "tent: floor, four legs, roof, back wall");
  assert.equal(count("o"), 1, "open floor: the floor alone");
  assert.equal(count("t", "t"), 0);
  // A tent's roof starts at its eave; a drape is 8′ and a rail 3′.
  const roof = showParts(h).find((p) => p.piece === "t" && p.shape === "roof");
  assert.equal(roof.y - roof.h / 2, 84);
  const drapes = showParts(h).filter((p) => p.piece === "p" && p.finish === "fabric").map((p) => p.h);
  assert.deepEqual(drapes.sort(), [36, 36, 96]);
  // A booth's floor is its sale colour.
  h.booths[1] = { status: "sold" };
  assert.equal(showParts(h).find((p) => p.piece === "p").color, "#b9e4c3");
});

test("a back drape follows its booth's turn", () => {
  const h = floor([{ id: "p", kind: "booth", number: 1, x: 500, y: 500, w: 120, d: 60, rot: 180 }]);
  const back = showParts(h).find((p) => p.h === 96);
  // Turned half round, the back is toward the entrance (plan +y).
  assert.ok(near(back.z, 500 + 30 - 0.5) && near(back.x, 500), `${back.x} ${back.z}`);
});

test("every other kind of piece stands up, and a label only as words", () => {
  const kinds = ["aisle", "pavilion", "wall", "door", "column", "stage", "table", "desk", "food", "restroom", "label"];
  const h = floor(kinds.map((kind, i) => ({ id: "k" + i, kind, x: 100 + i * 50, y: 300, w: 96, d: 96, ...(kind === "label" ? { text: "Hall A" } : {}) })));
  const parts = showParts(h);
  for (const [i, kind] of kinds.entries()) {
    const n = parts.filter((p) => p.piece === "k" + i).length;
    assert.ok(kind === "label" ? n === 0 : n > 0, `${kind}: ${n}`);
  }
  assert.ok(showLabels(h).some((l) => l.text === "Hall A"));
});

test("a thousand booths are a dozen draw calls, not four thousand", () => {
  const h = floor([], { kind: "indoor", width: 6000, depth: 6000 });
  h.items.push(...boothBlock(h.items, { count: 1000, perRow: 40, w: 120, d: 120, aisle: 120, backToBack: true }));
  h.items.slice(0, 300).forEach((it) => (it.style = "tent"));
  const show = buildShow(h);
  const meshes = [];
  show.traverse((o) => o.isInstancedMesh && meshes.push(o));
  assert.ok(meshes.length <= 6, `${meshes.length} instanced meshes`);
  const instances = meshes.reduce((n, m) => n + m.count, 0);
  assert.equal(instances, showParts(h).length);
  assert.equal(show.userData.counts.labels, 1000);
  show.userData.dispose();
});

test("the walk starts inside the entrance at eye height, looking in", () => {
  const h = floor([{ id: "d", kind: "door", x: 600, y: 894, w: 96, d: 12 }]);
  const s = showWalkStart(h);
  const frame = worldFrame(h);
  const [dx, dz] = planToWorld(frame, 600, 894);
  assert.ok(near(s.position[1], 62 * IN));
  assert.ok(near(Math.hypot(s.position[0] - dx, s.position[2] - dz), 72 * IN, 1e-3), "6′ in from the door");
  assert.ok(s.target[2] < s.position[2], "looking into the hall, away from the door");
  // No door: the middle of the front edge.
  const bare = showWalkStart(floor([]));
  assert.ok(bare.position[2] > 0 && near(bare.position[0], 0));
});

test("aisles come from walkway pieces, or from the gaps between rows of booths", () => {
  const withWalks = floor([{ id: "w", kind: "aisle", x: 600, y: 450, w: 120, d: 600 }]);
  const [line] = aisleLines(withWalks);
  assert.ok(near(line.x1, 600) && near(line.x2, 600), "along the walkway's long axis");
  assert.ok(near(Math.abs(line.y2 - line.y1), 600 - 48));
  // The usual grid: two back-to-back rows with an aisle in front of them and
  // one row pair further on, as the hall planner lays it out.
  const grid = toFloor({ ...newHall(), rows: 4 });
  const lines = aisleLines(grid);
  assert.ok(lines.length >= 2, `${lines.length} aisles`);
  for (const l of lines) assert.ok(near(l.y1, l.y2), "rows run across, so their aisles do");
});

test("a walkthrough is a timeline whose keys stand in the aisles", () => {
  const grid = toFloor({ ...newHall(), rows: 4, perRow: 10 });
  const raw = showWalkthrough(grid);
  const tl = normalizeTimeline(raw);
  assert.ok(tl.keys.length >= 3 && tl.keys.length <= MAX_KEYS, `${tl.keys.length} keys`);
  assert.ok(tl.seconds >= MIN_SECONDS && tl.seconds <= MAX_SECONDS);
  assert.equal(tl.flow, "glide");
  const reach = showReach(grid);
  for (const k of tl.keys) {
    assert.ok(near(k.position[1], 62 * IN), "every key at eye height");
    assert.ok(Math.hypot(k.position[0], k.position[2]) <= reach + 1e-9, "every key on the floor");
  }
  // Sampled, the camera stays at eye height all the way.
  for (let t = 0; t <= 1; t += 0.05) assert.ok(Math.abs(sampleTimeline(tl, t).position[1] - 62 * IN) < 0.05);
  // Never more keys than the timeline allows, however big the floor.
  const huge = toFloor({ ...newHall(), rows: 40, perRow: 30 });
  assert.ok(normalizeTimeline(showWalkthrough(huge)).keys.length <= MAX_KEYS);
  // An empty floor still walks somewhere.
  assert.ok(normalizeTimeline(showWalkthrough(floor([]))).keys.length >= 2);
});

test("the overview looks down on the floor from beyond its entrance edge", () => {
  const h = floor([]);
  const o = showOverview(h);
  assert.ok(o.position[1] > 5 && o.position[2] > 0);
  assert.deepEqual(o.target, [0, 0, 0]);
  assert.ok(showReach(h) >= Math.hypot(600, 450) * IN - 1e-9);
});
