import test from "node:test";
import assert from "node:assert/strict";
import { LAYOUTS, LAYOUT_KEYS, PANEL_COLORS, applyWallLayout, currentLayout, layoutFits, layoutPlan } from "../src/wall-layouts.js";
import { quickStart } from "../src/quickstart.js";
import { MAX_PANELS, validateProject, wallSpec } from "../src/model.js";

const KINDS = ["artfair", "artshow"];
const SIZES = ["10x10", "10x20"];
const work = (id, over = {}) => ({ id, title: id, asset: null, wall: "back", x: 10, y: 40, w: 20, h: 16, thickness: 1.5, offset: 0.5, ...over });
const booths = () => KINDS.flatMap((show) => SIZES.map((size) => ({ show, size, p: quickStart({ show, size }) })));

test("four layouts: U, L, U with wings, U with a centre wall", () => {
  assert.deepEqual(LAYOUT_KEYS, ["u", "l", "wings", "centre"]);
  for (const k of LAYOUT_KEYS) assert.ok(LAYOUTS[k].label && LAYOUTS[k].blurb, k);
});

test("six panel colours with plain names, no maker's", () => {
  assert.deepEqual(PANEL_COLORS.map((c) => c.name), ["Black", "Charcoal", "Grey", "White", "Tan", "Navy"]);
  for (const c of PANEL_COLORS) assert.match(c.hex, /^#[0-9a-f]{6}$/);
  assert.equal(new Set(PANEL_COLORS.map((c) => c.hex)).size, 6);
});

test("every layout on both kinds and both sizes is a valid project, and reads back as itself", () => {
  for (const { show, size, p } of booths())
    for (const k of LAYOUT_KEYS) {
      const q = structuredClone(p);
      assert.ok(applyWallLayout(q, k), `${show} ${size} ${k}`);
      validateProject(q);
      assert.equal(currentLayout(q), k, `${show} ${size} ${k}`);
    }
});

test("what each layout builds", () => {
  const p = quickStart({ show: "artfair", size: "10x20" });
  applyWallLayout(p, "l");
  assert.equal(p.booth.walls.right.enabled, false);
  assert.ok(p.booth.walls.left.enabled && p.booth.walls.back.enabled);
  assert.equal(p.booth.panels.length, 0);
  applyWallLayout(p, "wings");
  assert.ok(p.booth.walls.right.enabled);
  assert.equal(p.booth.panels.length, 2);
  for (const panel of p.booth.panels) {
    assert.ok(Math.abs(panel.x) + panel.width / 2 <= p.booth.width / 2 + 0.001, "a wing stands inside the footprint");
    assert.ok(panel.z > 0, "toward the aisle");
  }
  applyWallLayout(p, "centre");
  assert.equal(p.booth.panels.length, 1);
  assert.equal(p.booth.panels[0].x, 0);
  assert.ok(p.booth.panels[0].width < p.booth.width);
  applyWallLayout(p, "u");
  assert.equal(p.booth.panels.length, 0);
  assert.equal(currentLayout(p), "u");
});

test("applying a layout twice changes nothing the second time", () => {
  for (const { p } of booths())
    for (const k of LAYOUT_KEYS) {
      const q = structuredClone(p);
      q.art.push(work("a"), work("b", { wall: "right", x: 30 }));
      applyWallLayout(q, k);
      const once = JSON.stringify(q);
      applyWallLayout(q, k);
      assert.equal(JSON.stringify(q), once, k);
    }
});

test("work on a wall a layout removes moves to the nearest wall that remains, and none is lost", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  applyWallLayout(p, "wings");
  const [leftWing, rightWing] = p.booth.panels.map((x) => `panel:${x.id}`);
  p.art.push(
    work("r1", { wall: "right", x: 10 }),
    work("r2", { wall: "right", x: 40 }),
    work("lw", { wall: leftWing, x: 2 }),
    work("rw", { wall: rightWing, x: 2 }),
    work("b1", { wall: "back", x: 60 }),
  );
  validateProject(p);
  applyWallLayout(p, "l");
  validateProject(p);
  assert.equal(p.art.length, 5, "none lost");
  const where = Object.fromEntries(p.art.map((a) => [a.id, a.wall]));
  assert.equal(where.lw, "left", "a left wing's work goes to the left wall");
  assert.equal(where.rw, "back", "a right wing's work, with the right wall gone too, goes to the back");
  assert.equal(where.r1, "back");
  assert.equal(where.r2, "back");
  assert.equal(where.b1, "back", "work on a wall that stays stays put");
  for (const a of p.art) {
    const wall = wallSpec(p, a.wall);
    assert.ok(wall?.enabled, `${a.id} is on a wall that shows`);
    assert.ok(a.x >= 0 && a.x + a.w <= wall.width + 0.001, `${a.id} inside its wall`);
  }
  // None of the moved work sits on top of another on the back wall.
  const back = p.art.filter((a) => a.wall === "back");
  for (const a of back)
    for (const b of back)
      if (a !== b) assert.ok(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.id} overlaps ${b.id}`);
});

test("the artist's own free-standing walls are left alone", () => {
  const p = quickStart({ show: "artshow", size: "10x20" });
  p.booth.panels.push({ id: "mine", name: "My wall", width: 48, height: 96, x: -40, z: -20, rotation: 30 });
  const mine = JSON.stringify(p.booth.panels[0]);
  for (const k of LAYOUT_KEYS) {
    applyWallLayout(p, k);
    assert.equal(JSON.stringify(p.booth.panels.find((x) => x.id === "mine")), mine, k);
    validateProject(p);
  }
  assert.equal(currentLayout(p), "centre", "an artist's own wall does not hide the layout");
});

test("a layout that would pass the eight-wall limit is refused and changes nothing", () => {
  const p = quickStart({ show: "artfair", size: "10x20" });
  for (let i = 0; i < MAX_PANELS - 1; i++) p.booth.panels.push({ id: `own${i}`, width: 24, height: 80, x: -100 + i * 25, z: -40, rotation: 0 });
  const before = JSON.stringify(p);
  assert.equal(applyWallLayout(p, "wings"), null);
  assert.equal(JSON.stringify(p), before);
  assert.ok(applyWallLayout(p, "centre"), "one more fits");
  validateProject(p);
});

test("a September backup with no panels takes each layout", () => {
  for (const k of LAYOUT_KEYS) {
    const p = quickStart({ show: "artfair", size: "10x10" });
    delete p.booth.panels;
    delete p.booth.pedestals;
    validateProject(p);
    assert.ok(applyWallLayout(p, k), k);
    validateProject(p);
    assert.equal(currentLayout(p), k);
  }
});

test("an unknown layout changes nothing; a booth in none of them reads as none", () => {
  const p = quickStart();
  const before = JSON.stringify(p);
  assert.equal(applyWallLayout(p, "zigzag"), null);
  assert.equal(JSON.stringify(p), before);
  p.booth.walls.left.enabled = false;
  p.booth.walls.right.enabled = false;
  assert.equal(currentLayout(p), null);
});

test("each layout's plan drawing is lines inside the booth's outline", () => {
  for (const k of LAYOUT_KEYS) {
    const lines = layoutPlan(k, { width: 240, depth: 120 });
    assert.ok(lines.length >= 2, k);
    for (const [x1, , x2] of lines) for (const v of [x1, x2]) assert.ok(v >= 0 && v <= 240, k);
    for (const [, y1, , y2] of lines) for (const v of [y1, y2]) assert.ok(v >= 0 && v <= 120, k);
  }
});

test("work on a wall the artist hid stays with that wall", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  p.booth.panels.push({ id: "mine", width: 48, height: 80, x: 0, z: -20, rotation: 0, hidden: true });
  p.art.push(work("h", { wall: "panel:mine", x: 4 }));
  applyWallLayout(p, "centre");
  assert.equal(p.art[0].wall, "panel:mine");
  validateProject(p);
});

test("layoutFits says beforehand what applyWallLayout will refuse", () => {
  const p = quickStart({ show: "artfair", size: "10x20" });
  for (const k of LAYOUT_KEYS) assert.equal(layoutFits(p, k), true, k);
  assert.equal(layoutFits(p, "zigzag"), false);
  for (let i = 0; i < MAX_PANELS - 1; i++) p.booth.panels.push({ id: `own${i}`, width: 24, height: 80, x: 0, z: 0, rotation: 0 });
  assert.equal(layoutFits(p, "wings"), false);
  assert.equal(layoutFits(p, "centre"), true);
  assert.equal(layoutFits(p, "u"), true);
});
