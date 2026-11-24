import test from "node:test";
import assert from "node:assert/strict";
import { GUIDED_KEY, GUIDED_OFF, GUIDED_SIZES, STEPS, STEP_KEYS, MAX_CONTROLS, applyBoothChoice, boothChoiceOf, boothName, firstStep, hungWorks, readGuided, stepAfter, stepBefore, stepIndex, writeGuided } from "../src/guided.js";
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

test("step 1 reads a quick-started booth back as the kind and size it was given", () => {
  for (const show of ["artfair", "artshow", "tradeshow"])
    for (const size of GUIDED_SIZES) assert.deepEqual(boothChoiceOf(quickStart({ show, size })), { show, size }, `${show} ${size}`);
  const odd = blankProject();
  odd.booth.width = 132;
  assert.equal(boothChoiceOf(odd).size, null);
});

test("step 1 changes the kind and the size and keeps the work, inside its walls", () => {
  const p = quickStart({ show: "artfair", size: "10x20", furniture: ["table6", "chair"] });
  p.art.push(work({ x: 200, w: 30 }));
  applyBoothChoice(p, { size: "10x10" });
  assert.deepEqual(boothChoiceOf(p), { show: "artfair", size: "10x10" });
  assert.equal(p.booth.walls.back.width, 120);
  assert.equal(p.art.length, 1);
  assert.ok(p.art[0].x + p.art[0].w <= 120, "the work is pulled back onto the narrower wall");
  assert.equal(p.booth.pedestals.length, 2);
  validateProject(p);

  applyBoothChoice(p, { show: "artshow" });
  assert.deepEqual(boothChoiceOf(p), { show: "artshow", size: "10x10" }, "the size is kept across a change of kind");
  assert.equal(p.booth.tent, false);
  assert.equal(p.art.length, 1);
  validateProject(p);

  applyBoothChoice(p, { show: "tradeshow", size: "10x20" });
  assert.deepEqual(boothChoiceOf(p), { show: "tradeshow", size: "10x20" });
  validateProject(p);
});

test("choosing the size a booth already has, or nothing known, changes nothing", () => {
  const p = quickStart({ show: "artshow", size: "10x10" });
  p.booth.color = "#123456";
  const before = JSON.stringify(p);
  applyBoothChoice(p, { show: "artshow", size: "10x10" });
  applyBoothChoice(p, { show: "nonsense", size: "nonsense" });
  applyBoothChoice(p, {});
  assert.equal(JSON.stringify(p), before, "the colour is not reset by choosing the same kind");
});

test("between the fair and the trade show only the canopy changes: the colour and walls stay", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  p.booth.color = "#112233";
  p.booth.walls.back.height = 84;
  applyBoothChoice(p, { show: "tradeshow" });
  assert.equal(p.booth.tent, false);
  assert.equal(p.booth.envPreset, "tradeshow");
  assert.equal(p.booth.color, "#112233");
  assert.equal(p.booth.walls.back.height, 84);
  applyBoothChoice(p, { show: "artfair" });
  assert.equal(p.booth.tent, true);
  assert.equal(p.booth.color, "#112233");
  validateProject(p);
});

test("a booth of a size step 1 does not offer keeps it across a change of kind", () => {
  const p = quickStart({ show: "artfair", size: "10x10" });
  p.booth.width = 132;
  p.booth.walls.back.width = 132;
  applyBoothChoice(p, { show: "artshow" });
  assert.equal(p.booth.venue, "artshow");
  assert.equal(p.booth.width, 132);
  assert.equal(p.booth.walls.back.width, 132);
  assert.equal(boothChoiceOf(p).size, null);
  validateProject(p);
});

test("a name Quick start gave follows the booth; a name the artist typed stays", () => {
  const p = quickStart({ show: "artfair", size: "10x20" });
  assert.equal(p.name, boothName("artfair", "10x20"));
  applyBoothChoice(p, { size: "10x10" });
  assert.equal(p.name, "10 × 10 ft art fair booth");
  applyBoothChoice(p, { show: "artshow" });
  assert.equal(p.name, "10 × 10 ft art show booth");
  p.name = "Riverside";
  applyBoothChoice(p, { size: "10x20" });
  assert.equal(p.name, "Riverside");
});

test("the hang step counts by the rule its tick uses", () => {
  const p = quickStart();
  p.art.push(work(), work({ id: "w2", wall: "left" }), work({ id: "s", kind: "sign" }));
  assert.equal(hungWorks(p).length, 2);
  p.booth.walls.left.enabled = false;
  assert.equal(hungWorks(p).length, 1);
});
