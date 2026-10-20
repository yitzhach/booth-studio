import test from "node:test";
import assert from "node:assert/strict";
import { applyVenue, blankProject, demoProject, uid, validateProject } from "../src/model.js";
import { ENV_PRESETS } from "../src/lighting.js";
import { HANG_LINE } from "../src/arrange.js";
import { LOOKS, aimLights, applyEnvPreset, applyLook, currentLook, evenHang, lightTargets, lookFor, polish } from "../src/polish.js";

const work = (wall, x, y, w, h, extra = {}) => ({ id: uid(), asset: null, title: "w", wall, x, y, w, h, thickness: 1.5, offset: 0.75, ...extra });

test("every look names a real environment and stays inside the project's limits", () => {
  for (const [k, look] of Object.entries(LOOKS)) {
    assert.ok(ENV_PRESETS[look.envPreset], k);
    const p = demoProject();
    assert.equal(applyLook(p, k).look, k);
    assert.equal(p.booth.envPreset, look.envPreset);
    assert.equal(p.ambient, look.ambient);
    assert.ok(p.lights.every((l) => l.kelvin === look.kelvin && l.power === look.power));
    validateProject(p);
  }
  assert.equal(applyLook(demoProject(), "nope"), null);
});

test("a look brings its preset's floor and horizon, the way the Environment picker does", () => {
  const p = demoProject();
  applyLook(p, "fair");
  assert.equal(p.booth.ground, ENV_PRESETS.artfair.ground);
  assert.equal(p.booth.horizon, ENV_PRESETS.artfair.horizon);
});

test("an art-show booth in a photographed environment leaves its white hall", () => {
  const p = applyVenue(blankProject(), "artshow");
  assert.equal(p.booth.hall.on, true);
  assert.deepEqual(applyEnvPreset(p, "artfair"), { hallOff: true });
  assert.equal(p.booth.hall.on, false);
  const q = applyVenue(blankProject(), "artshow");
  assert.deepEqual(applyEnvPreset(q, "tradeshow"), { hallOff: false }, "a white hall preset keeps it");
  assert.equal(q.booth.hall.on, true);
});

test("the venue suggests the look", () => {
  assert.equal(lookFor(applyVenue(blankProject(), "artshow")), "gallery");
  const tent = blankProject();
  tent.booth.tent = true;
  assert.equal(lookFor(tent), "fair");
  assert.equal(lookFor(blankProject()), "gallery");
});

test("even hang: equal gaps, centres on 60″, every wall of this booth", () => {
  const p = blankProject();
  p.art = [work("back", 3, 10, 30, 40), work("back", 50, 70, 20, 20), work("left", 0, 0, 24, 36)];
  assert.equal(evenHang(p), 2);
  const [a, b, c] = p.art;
  const gap = (120 - 50) / 3;
  assert.ok(Math.abs(a.x - gap) < 0.01 && Math.abs(b.x - (gap * 2 + 30)) < 0.01);
  for (const w of p.art) assert.ok(Math.abs(w.y + w.h / 2 - HANG_LINE) < 0.01);
  assert.ok(Math.abs(c.x - (p.booth.walls.left.width - 24) / 2) < 0.01, "one work is centred");
  validateProject(p);
});

test("even hang leaves a wall with a label, a neighbour's wall and a work too tall to centre", () => {
  const p = blankProject();
  p.art = [work("back", 3, 10, 30, 40), work("back", 40, 40, 6, 4, { kind: "label" }), work("left", 7, 7, 20, 20, { booth: "slot-1" })];
  const before = JSON.stringify(p.art);
  assert.equal(evenHang(p), 0);
  assert.equal(JSON.stringify(p.art), before);
  const q = blankProject();
  q.art = [work("right", 0, 0, 40, 90)];
  evenHang(q);
  assert.ok(q.art[0].y >= 0 && q.art[0].y + 90 <= q.booth.walls.right.height, "kept on the wall");
});

test("light targets: one per wall first, spares to the fullest wall, at most four", () => {
  const p = blankProject();
  p.art = [work("back", 0, 30, 20, 30), work("back", 40, 30, 20, 30), work("back", 80, 30, 20, 30), work("left", 30, 30, 30, 30)];
  const t = lightTargets(p);
  assert.equal(t.length, 4);
  assert.equal(t.filter((x) => x.wall === "back").length, 3);
  assert.equal(t.filter((x) => x.wall === "left").length, 1);
  p.art = Array.from({ length: 9 }, (_, i) => work(["back", "left", "right"][i % 3], (i % 3) * 30, 30, 20, 30));
  assert.equal(lightTargets(p).length, 4);
  p.art = [work("back", 0, 0, 10, 10, { face: "outside" }), work("back", 0, 0, 10, 10, { kind: "sign" })];
  assert.deepEqual(lightTargets(p), [], "outside faces and signs are not lit");
});

test("a target sits on the wall's face at the middle of its works", () => {
  const p = blankProject();
  p.art = [work("back", 20, 40, 20, 20)];
  const [t] = lightTargets(p);
  assert.deepEqual(t.at, [-60 + 30, 50, -60]);
  p.art = [work("left", 20, 40, 20, 20)];
  assert.deepEqual(lightTargets(p)[0].at, [-60, 50, 60 - 30]);
  p.art = [work("right", 20, 40, 20, 20)];
  assert.deepEqual(lightTargets(p)[0].at, [60, 50, -60 + 30]);
});

test("aiming: lights hang in front of their work, inside the booth, and keep their identity", () => {
  const p = demoProject();
  const ids = p.lights.map((l) => l.id);
  const n = aimLights(p);
  assert.equal(n, 4, "six works on three walls: one light each, and the spare");
  assert.deepEqual(p.lights.slice(0, 2).map((l) => l.id), ids, "the first two are the old ones");
  for (const l of p.lights) {
    assert.ok(Math.abs(l.x) <= 54 && Math.abs(l.z) <= 54, "inside the footprint");
    assert.ok(l.y > l.ty, "above what it lights");
    assert.equal(l.kelvin, 4000);
  }
  validateProject(p);
});

test("one work and two lights cross on it; nothing hung changes nothing", () => {
  const p = blankProject();
  p.art = [work("back", 50, 40, 20, 20)];
  assert.equal(aimLights(p), 2);
  const [a, b] = p.lights;
  assert.equal(a.tx, b.tx);
  assert.notEqual(a.x, b.x);
  const q = blankProject();
  const before = JSON.stringify(q.lights);
  assert.equal(aimLights(q), 0);
  assert.equal(JSON.stringify(q.lights), before);
});

test("make it beautiful: the venue's look, the hang and the lights, still a valid project", () => {
  const p = demoProject();
  const r = polish(p);
  assert.deepEqual(r, { look: "gallery", hallOff: false, walls: 3, lights: 4 });
  validateProject(p);
  const q = demoProject();
  assert.equal(polish(q, { look: "evening" }).look, "evening");
  assert.equal(polish(demoProject(), { look: "bogus" }).look, "gallery", "a stale look falls back");
});

test("hero shots: front, three-quarter, aisle, and a close-up of the fullest wall", async () => {
  const { heroShots, HERO_CLIP } = await import("../src/polish.js");
  const p = demoProject();
  p.art.push(work("back", 90, 30, 20, 20));
  const shots = heroShots(p);
  assert.deepEqual(shots.map((s) => s.name), ["Front", "Three-quarter", "Aisle", "Close-up"]);
  const [front, three, aisle, close] = shots;
  const D = (p.booth.depth * 0.0254) / 2;
  assert.ok(front.pose.position[2] > D && front.pose.position[0] === 0, "in front, square on");
  assert.ok(three.pose.position[0] > 0 && three.pose.position[2] > D, "front right");
  assert.ok(aisle.pose.position[0] < 0, "walking past on the left");
  assert.ok(close.pose.target[2] < -D + 0.01, "the back wall, which has the most work");
  assert.ok(close.pose.position[2] > close.pose.target[2] && close.pose.position[2] < D * 2, "in front of it, not behind the booth");
  for (const s of shots) for (const v of [...s.pose.position, ...s.pose.target]) assert.ok(Number.isFinite(v) && Math.abs(v) < 1000);
  assert.equal(heroShots(blankProject()).length, 3, "no work, no close-up");
  assert.equal(HERO_CLIP.move, "orbit");
});

test("currentLook is applyLook read back: named while every value holds, null once one is changed by hand", () => {
  assert.equal(currentLook(demoProject()), null, "a new booth is in no look");
  for (const key of Object.keys(LOOKS)) {
    const p = demoProject();
    applyLook(p, key);
    assert.equal(currentLook(p), key);
  }
  const changed = (edit) => {
    const p = demoProject();
    applyLook(p, "gallery");
    edit(p);
    return currentLook(p);
  };
  assert.equal(changed((p) => (p.booth.horizon = "open")), null, "the horizon");
  assert.equal(changed((p) => (p.booth.ground = "grass")), null, "the floor");
  assert.equal(changed((p) => (p.ambient = 1)), null, "the room light");
  assert.equal(changed((p) => (p.lights[1].kelvin = 3000)), null, "one spotlight");
  // Nothing to colour: the surroundings and room light are the look.
  assert.equal(changed((p) => (p.lights = [])), "gallery");
  // An art-show booth under a photographed sky is in it only while its white hall stays out.
  const show = applyVenue(blankProject(), "artshow");
  applyLook(show, "fair");
  assert.equal(currentLook(show), "fair");
  show.booth.hall = { ...show.booth.hall, on: true };
  assert.equal(currentLook(show), null);
});
