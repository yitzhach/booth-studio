// The typing pass (TYPING_PHASE.md, ROADMAP 1.4) takes the modules the type
// check skipped into tsconfig.app.json one area at a time. This is the
// ratchet: the exclude list is exactly what is left, so an area that is in
// cannot slip back out. Each task shrinks LEFT first (red), then its area
// type-checks (green); the gate is the vendored files alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// After task 1, the scene.
const LEFT = ["src/vendor/**", "src/main.js", "src/studio.js", "src/ui/**", "src/panels/**", "src/actions/**"];

test("tsconfig.app.json skips only what the typing pass has not reached", () => {
  // The file opens with a comment; JSON.parse takes what follows it.
  const text = readFileSync(new URL("../tsconfig.app.json", import.meta.url), "utf8");
  const config = JSON.parse(text.slice(text.indexOf("{")));
  assert.deepEqual(config.exclude, LEFT, "an area left the exclude list or came back: update LEFT with TYPING_PHASE.md");
});
