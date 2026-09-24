// The batch export queue: general settings, per-job tweaks and timeline
// presets, and the backup validator that keeps every older backup loading.
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalKit, validKit, resolveJob, tweak, overridden, applyPreset, removePreset, jobSlug,
  DEFAULT_SETTINGS, MAX_JOBS, CUSTOM,
} from "../src/batch.js";
import { emptyTimeline } from "../src/timeline.js";
import { validateProject, blankProject as defaultProject } from "../src/model.js";

const tl = (seconds = 8) => ({ ...emptyTimeline([3, 1.6, 4], [0, 1.2, 0]), seconds });
const pose = { position: [3, 1.6, 4], target: [0, 1.2, 0] };

test("an empty or missing kit reads as the general settings and nothing queued", () => {
  const kit = normalKit(undefined);
  assert.deepEqual(kit.defaults, DEFAULT_SETTINGS);
  assert.deepEqual(kit.queue, []);
  assert.deepEqual(kit.presets, []);
  assert.equal(validKit(undefined), true);
});

test("a job follows the general settings until one of its own is tweaked", () => {
  let kit = normalKit({ defaults: { fps: 24, size: 720, frame: "square" }, queue: [{ id: "a", kind: "clip", move: "orbit", seconds: 10, set: {} }] });
  let job = kit.queue[0];
  assert.deepEqual([resolveJob(job, kit).fps, resolveJob(job, kit).size, resolveJob(job, kit).frame], [24, 720, "square"]);
  // Changing the general settings reaches it...
  kit = { ...kit, defaults: { ...kit.defaults, fps: 60 } };
  assert.equal(resolveJob(job, kit).fps, 60);
  // ...until it has its own.
  job = tweak(job, "fps", 30);
  assert.equal(overridden(job, "fps"), true);
  kit = { ...kit, defaults: { ...kit.defaults, fps: 24 } };
  assert.equal(resolveJob(job, kit).fps, 30);
  // And handing it back follows the general setting again.
  job = tweak(job, "fps", undefined);
  assert.equal(overridden(job, "fps"), false);
  assert.equal(resolveJob(job, kit).fps, 24);
  // A value this version does not offer is not stored.
  assert.equal(overridden(tweak(job, "fps", 17), "fps"), false);
});

test("a preset copied across clips links them, and deleting it leaves each a copy", () => {
  let kit = normalKit({
    presets: [{ id: "p1", name: "Slow push", timeline: tl(8) }],
    queue: [
      { id: "a", kind: "clip", move: "orbit", seconds: 10, set: { frame: "desktop" } },
      { id: "b", kind: "clip", move: "orbit", seconds: 10, set: { frame: "phone" } },
      { id: "s", kind: "still", pose, set: {} },
    ],
  });
  kit = applyPreset(kit, "p1");
  assert.deepEqual(kit.queue.map((j) => j.preset), ["p1", "p1", undefined]);
  assert.equal(resolveJob(kit.queue[0], kit).seconds, 8);
  assert.equal(resolveJob(kit.queue[1], kit).frame, "phone");
  // Editing the preset reaches every clip on it.
  kit = { ...kit, presets: [{ ...kit.presets[0], timeline: { ...kit.presets[0].timeline, seconds: 20 } }] };
  assert.equal(resolveJob(kit.queue[1], kit).seconds, 20);
  kit = removePreset(kit, "p1");
  assert.equal(kit.presets.length, 0);
  assert.equal(kit.queue[0].preset, undefined);
  assert.equal(resolveJob(kit.queue[0], kit).timeline.seconds, 20);
  assert.equal(resolveJob(kit.queue[0], kit).move, CUSTOM);
});

test("a still resolves to its pose and the still size", () => {
  const kit = normalKit({ defaults: { long: 2048 }, queue: [{ id: "s", kind: "still", pose, set: { frame: "square" } }] });
  const r = resolveJob(kit.queue[0], kit);
  assert.equal(r.kind, "still");
  assert.equal(r.long, 2048);
  assert.equal(r.frame, "square");
  assert.deepEqual(r.pose, pose);
});

test("the backup validator refuses what it cannot open and accepts a real kit", () => {
  const good = { defaults: { fps: 30 }, presets: [{ id: "p", name: "A", timeline: tl() }], queue: [{ id: "a", kind: "still", pose, set: {} }] };
  assert.equal(validKit(good), true);
  assert.equal(validKit(null), false);
  assert.equal(validKit({ queue: [{ id: "a", kind: "gif" }] }), false);
  assert.equal(validKit({ queue: [{ id: "a", kind: "clip" }, { id: "a", kind: "clip" }] }), false);
  assert.equal(validKit({ queue: Array.from({ length: MAX_JOBS + 1 }, (_, i) => ({ id: `j${i}`, kind: "clip" })) }), false);
  assert.equal(validKit({ presets: [{ id: "p", name: "A", timeline: {} }] }), false);
  // A project with a kit loads, and one without still does.
  const p = defaultProject();
  assert.doesNotThrow(() => validateProject(p));
  assert.doesNotThrow(() => validateProject({ ...p, exportKit: good }));
  assert.throws(() => validateProject({ ...p, exportKit: { queue: "x" } }));
});

test("file names number the jobs and say what they are", () => {
  assert.equal(jobSlug({ kind: "still" }, 0), "01-still");
  assert.equal(jobSlug({ kind: "clip", move: CUSTOM, name: "Aisle walk-in!" }, 11), "12-aisle-walk-in");
});
