// Every icon the panels ask for must be one the page registers with lucide.
// An unregistered name draws nothing — reported as "blank buttons" for the
// timeline's previous / next keyframe arrows — and nothing else fails, so
// this reads the names out of main.js's own source and checks them. Since
// main.js is being split (MAIN_SPLIT_PHASE.md), the panels and dialogs moved
// out of it draw their buttons with the same `btn` and `icon`, so their
// modules are read too. The registry moved with them, to src/ui/icons.js
// (seam 21).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const src = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const registry = readFileSync(new URL("../src/ui/icons.js", import.meta.url), "utf8");
const moved = ["ui", "panels", "actions"]
  .map((dir) => new URL(`../src/${dir}/`, import.meta.url))
  .filter((dir) => existsSync(dir))
  .flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith(".js")).map((f) => readFileSync(new URL(f, dir), "utf8")));
const pascal = (name) => name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("");

test("every icon named in main.js is registered", () => {
  const block = registry.slice(registry.indexOf("const icons = {"), registry.indexOf("};", registry.indexOf("const icons = {")));
  const registered = new Set([...block.matchAll(/^\s*(\w+)(?::\s*\w+)?,/gm)].map((m) => m[1]));
  const used = new Set();
  for (const text of [src, ...moved]) {
    for (const m of text.matchAll(/\bbtn\(\s*[^,]+,\s*(?:"[^"]*"|`[^`]*`|[^,()]+),\s*"([a-z0-9-]+)"/g)) used.add(m[1]);
    for (const m of text.matchAll(/\bicon\(\s*"([a-z0-9-]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size > 30, `found ${used.size} icon names`);
  const missing = [...used].filter((name) => !registered.has(pascal(name)));
  assert.deepEqual(missing, [], `icons used but not registered: ${missing.join(", ")}`);
});
