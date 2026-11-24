import test from "node:test";
import assert from "node:assert/strict";
import { hangNew, heightFor } from "../src/hang.js";
import { quickStart } from "../src/quickstart.js";
import { boundWarning, validateProject } from "../src/model.js";
import { applyWallLayout } from "../src/wall-layouts.js";

const asset = (width, height, name = "a.png") => ({ data: "data:image/png;base64,AAAA", width, height, name, role: "artwork" });
const overlap = (a, b) => a.wall === b.wall && (a.face || "inside") === (b.face || "inside") && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const picture = (p, id, w, shape = [64, 48], name = `${id}.png`) => {
  p.assets[id] = asset(...shape, name);
  return { asset: id, width: w };
};

test("the height follows the picture's shape", () => {
  assert.equal(heightFor(asset(64, 48), 20), 15);
  assert.equal(heightFor(asset(48, 64), 18), 24);
  assert.equal(heightFor(asset(100, 100), 30), 30);
});

test("three pictures: three works on walls, each the width typed, none overlapping, none out of bounds", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  const placed = hangNew(p, [picture(p, "a", 20), picture(p, "b", 30), picture(p, "c", 16, [48, 64])]);
  assert.equal(placed.length, 3);
  assert.equal(p.art.length, 3);
  assert.deepEqual(p.art.map((a) => a.w), [20, 30, 16]);
  assert.deepEqual(p.art.map((a) => a.h), [15, 22.5, 21.333]);
  for (const a of p.art) assert.equal(boundWarning(p, a), "", a.title);
  for (const a of p.art) for (const b of p.art) if (a !== b) assert.ok(!overlap(a, b), `${a.title} on ${b.title}`);
  assert.deepEqual(p.art.map((a) => a.title), ["a", "b", "c"], "named after the file");
  for (const a of p.art) assert.ok(Math.abs(a.y + a.h / 2 - 60) < 0.01, "centred on the 60″ line");
  validateProject(p);
});

test("a full wall spills onto the next one, and never onto a wall that is not there", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  applyWallLayout(p, "l");
  const pics = Array.from({ length: 8 }, (_, i) => picture(p, `p${i}`, 34));
  hangNew(p, pics);
  assert.equal(p.art.length, 8);
  const walls = new Set(p.art.map((a) => a.wall));
  assert.ok(walls.has("back") && walls.has("left"), [...walls].join(","));
  assert.ok(!walls.has("right"), "the right wall is open in an L");
  for (const a of p.art) assert.equal(boundWarning(p, a), "", a.title);
  for (const a of p.art) for (const b of p.art) if (a !== b) assert.ok(!overlap(a, b), `${a.title} on ${b.title}`);
  validateProject(p);
});

test("work already hung is left where it is, and the new work goes around it", () => {
  const p = quickStart({ show: "artshow", size: "10x20" });
  hangNew(p, [picture(p, "a", 40)]);
  const first = { ...p.art[0] };
  hangNew(p, [picture(p, "b", 40), picture(p, "c", 40)]);
  assert.deepEqual(p.art[0], first);
  for (const a of p.art) for (const b of p.art) if (a !== b) assert.ok(!overlap(a, b), `${a.title} on ${b.title}`);
});

test("a width is held to what a wall can take; a picture with no asset or no width is skipped", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  const placed = hangNew(p, [picture(p, "big", 500), { asset: "missing", width: 20 }, picture(p, "none", NaN), picture(p, "zero", 0)]);
  assert.equal(placed.length, 1);
  assert.equal(p.art[0].w, 120, "no wider than the widest wall");
  assert.ok(p.art[0].h <= p.booth.walls.back.height);
  validateProject(p);
});

test("a picture taller than the walls is held to their height, its shape kept", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  hangNew(p, [picture(p, "tall", 80, [40, 100])]);
  const a = p.art[0];
  assert.ok(a.h <= p.booth.walls.back.height);
  assert.ok(Math.abs(a.w / a.h - 0.4) < 0.01);
  assert.equal(boundWarning(p, a), "");
});

test("the 200-placement limit is kept", () => {
  const p = quickStart({ show: "artfair", size: "10x20" });
  const pics = Array.from({ length: 205 }, (_, i) => picture(p, `p${i}`, 4));
  hangNew(p, pics);
  assert.equal(p.art.length, 200);
  validateProject(p);
});

test("no side under an inch: a narrow panorama or a tiny width still makes a booth that opens", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  hangNew(p, [picture(p, "pano", 2, [4000, 1000]), picture(p, "tiny", 1, [64, 48])]);
  assert.equal(p.art.length, 2);
  for (const a of p.art) assert.ok(a.w >= 1 && a.h >= 1, `${a.title}: ${a.w} × ${a.h}`);
  assert.ok(Math.abs(p.art[0].w / p.art[0].h - 4) < 0.01, "the panorama keeps its shape");
  validateProject(p);
});

test("a picture as wide as a wall finds the next empty wall instead of covering work", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  hangNew(p, [picture(p, "small", 20)]);
  hangNew(p, [picture(p, "wide", 120, [120, 40])]);
  const [small, wide] = p.art;
  assert.ok(!overlap(small, wide), `wide went to ${wide.wall} at ${wide.x}`);
  assert.equal(boundWarning(p, wide), "");
  validateProject(p);
});

test("sizes are fitted wall by wall, never to a mix of one wall's width and another's height", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  for (const k of ["back", "left", "right"]) p.booth.walls[k].height = 84;
  p.booth.panels.push({ id: "tall", width: 48, height: 96, x: 0, z: 0, rotation: 0 });
  hangNew(p, [picture(p, "sq", 100, [50, 50])]);
  const a = p.art[0];
  assert.equal(boundWarning(p, a), "", `${a.wall}: ${a.w} × ${a.h} at ${a.x}, ${a.y}`);
  assert.equal(a.w, 84, "the largest a wall can take it, square");
  validateProject(p);
});
