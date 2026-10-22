// src/main.js is being split along its seams (ROADMAP.md 1.2,
// MAIN_SPLIT_PHASE.md). This is the ratchet: it holds main.js at its count
// after the last seam, so it can only shrink. Each seam lowers MAX first (red),
// then moves the code (green); the gate is 1,500.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// After seam 4, the looks and hero set and the image editor (src/ui/polish-panel.js, src/ui/image-editor.js).
const MAX = 6764;

test(`src/main.js stays at ${MAX} lines or fewer: a seam moves code out, nothing moves back`, () => {
  const text = readFileSync(fileURLToPath(new URL("../src/main.js", import.meta.url)), "utf8");
  const lines = text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
  assert.ok(lines <= MAX, `src/main.js is ${lines} lines, over ${MAX}: move the new code into a module beside it (MAIN_SPLIT_PHASE.md)`);
});
