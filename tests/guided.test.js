import test from "node:test";
import assert from "node:assert/strict";
import { GUIDED_KEY, GUIDED_OFF, STEPS, STEP_KEYS, MAX_CONTROLS, firstStep, readGuided, stepAfter, stepBefore, stepIndex, writeGuided } from "../src/guided.js";
import { quickStart } from "../src/quickstart.js";
import { blankProject, validateProject } from "../src/model.js";
import { applyLook } from "../src/polish.js";

const memory = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};
const work = (over = {}) => ({ id: "w1", title: "Harbour", asset: null, wall: "back", x: 10, y: 40, w: 24, h: 18, thickness: 1.5, offset: 0.5, ...over });

test("five steps, in the order an artist builds a booth", () => {
  assert.deepEqual(STEP_KEYS, ["booth", "walls", "light", "hang", "share"]);
  assert.deepEqual(STEPS.map((s) => s.key), STEP_KEYS);
  assert.equal(firstStep, "booth");
});

test("every step has a title, one line of help, at most eight controls and a done test", () => {
  assert.equal(MAX_CONTROLS, 8);
  for (const s of STEPS) {
    assert.ok(s.title && typeof s.title === "string", s.key);
    assert.ok(s.help && !s.help.includes("\n") && s.help.length <= 120, `${s.key}: help is one line`);
    assert.ok(Array.isArray(s.controls) && s.controls.length >= 1, s.key);
    assert.ok(s.controls.length <= MAX_CONTROLS, `${s.key}: ${s.controls.length} controls`);
    assert.equal(new Set(s.controls).size, s.controls.length, `${s.key}: a control listed twice`);
    assert.equal(typeof s.done, "function", s.key);
  }
});

test("hang is not done on a quick-started booth, and is once a work is on a wall", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  const hang = STEPS.find((s) => s.key === "hang");
  assert.equal(hang.done(p), false);
  p.art.push(work());
  validateProject(p);
  assert.equal(hang.done(p), true);
});

test("a sign, a label or a work on a hidden wall does not count as hung", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  const hang = STEPS.find((s) => s.key === "hang");
  p.art.push(work({ id: "s", kind: "sign" }), work({ id: "l", kind: "label" }));
  assert.equal(hang.done(p), false);
  p.booth.walls.back.enabled = false;
  p.art.push(work({ id: "w2" }));
  assert.equal(hang.done(p), false);
  p.booth.walls.left.enabled = true;
  p.art.push(work({ id: "w3", wall: "left" }));
  assert.equal(hang.done(p), true);
});

test("a work in a neighbour's booth of the row is not this booth's", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  const hang = STEPS.find((s) => s.key === "hang");
  p.art.push(work({ booth: "slot-2" }));
  assert.equal(hang.done(p), false);
});

test("the table is read-only: no caller can add a step or a control", () => {
  assert.throws(() => STEP_KEYS.push("extra"));
  assert.throws(() => STEPS[0].controls.push("extra"));
  assert.throws(() => { STEPS[0].title = "x"; });
  assert.equal(writeGuided("extra", memory()), false);
});

test("the booth and its walls are done from the start; light once it is in a look", () => {
  const p = quickStart({ show: "artshow", size: "10x20" });
  const step = (k) => STEPS.find((s) => s.key === k);
  assert.equal(step("booth").done(p), true);
  assert.equal(step("walls").done(p), true);
  assert.equal(step("light").done(p), false);
  applyLook(p, "gallery");
  assert.equal(step("light").done(p), true);
  assert.equal(step("share").done(p), false);
});

test("reading the steps never changes the project", () => {
  for (const p of [quickStart(), quickStart({ show: "artshow", size: "10x20" }), blankProject()]) {
    p.art.push(work());
    const before = JSON.stringify(p);
    for (const s of STEPS) {
      s.done(p);
      void s.title, s.help, [...s.controls];
    }
    assert.equal(JSON.stringify(p), before);
  }
});

test("Next and Back walk the steps and stop at either end", () => {
  assert.equal(stepAfter("booth"), "walls");
  assert.equal(stepAfter("hang"), "share");
  assert.equal(stepAfter("share"), null);
  assert.equal(stepBefore("walls"), "booth");
  assert.equal(stepBefore("booth"), null);
  assert.equal(stepIndex("light"), 2);
  assert.equal(stepIndex("nonsense"), -1);
  assert.equal(stepAfter("nonsense"), null);
});

test("the guided setting is per browser: a step, All tools, or nothing chosen", () => {
  assert.equal(GUIDED_KEY, "booth.guided");
  const s = memory();
  assert.equal(readGuided(s), null);
  assert.ok(writeGuided("light", s));
  assert.equal(s.m.get(GUIDED_KEY), "light");
  assert.equal(readGuided(s), "light");
  assert.ok(writeGuided(GUIDED_OFF, s));
  assert.equal(readGuided(s), GUIDED_OFF);
  // A stale value is no choice, and an unknown step is never written.
  assert.equal(readGuided(memory({ [GUIDED_KEY]: "colour" })), null);
  assert.equal(writeGuided("colour", s), false);
  assert.equal(readGuided(s), GUIDED_OFF);
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(readGuided(broken), null);
  assert.equal(writeGuided("booth", broken), false);
  assert.equal(readGuided(null), null);
});

test("the setting is never in a project or a backup", () => {
  const p = quickStart();
  const text = JSON.stringify(p);
  assert.ok(!text.includes(GUIDED_KEY));
  assert.ok(!("guided" in p));
});
