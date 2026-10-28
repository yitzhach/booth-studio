// src/scene.js is being split along its seams (ROADMAP.md 1.3,
// SCENE_SPLIT_PHASE.md). This is the ratchet: it holds scene.js at its count
// after the last seam, so it can only shrink. Each seam lowers MAX first (red),
// then moves the code (green); the gate is 1,000.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// After seam 9, the booth build: the last seam.
const MAX = 183;

test(`src/scene.js stays at ${MAX} lines or fewer: a seam moves code out, nothing moves back`, () => {
  const text = readFileSync(fileURLToPath(new URL("../src/scene.js", import.meta.url)), "utf8");
  const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  assert.ok(lines <= MAX, `src/scene.js is ${lines} lines, over ${MAX}: move the new code into a module beside it (SCENE_SPLIT_PHASE.md)`);
});
