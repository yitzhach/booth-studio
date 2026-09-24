// Every icon the panels ask for must be one the page registers with lucide.
// An unregistered name draws nothing — reported as "blank buttons" for the
// timeline's previous / next keyframe arrows — and nothing else fails, so
// this reads the names out of main.js's own source and checks them.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const pascal = (name) => name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join("");

test("every icon named in main.js is registered", () => {
  const block = src.slice(src.indexOf("const icons = {"), src.indexOf("};", src.indexOf("const icons = {")));
  const registered = new Set([...block.matchAll(/^\s*(\w+)(?::\s*\w+)?,/gm)].map((m) => m[1]));
  const used = new Set();
  for (const m of src.matchAll(/\bbtn\(\s*[^,]+,\s*(?:"[^"]*"|`[^`]*`|[^,()]+),\s*"([a-z0-9-]+)"/g)) used.add(m[1]);
  for (const m of src.matchAll(/\bicon\(\s*"([a-z0-9-]+)"/g)) used.add(m[1]);
  assert.ok(used.size > 30, `found ${used.size} icon names`);
  const missing = [...used].filter((name) => !registered.has(pascal(name)));
  assert.deepEqual(missing, [], `icons used but not registered: ${missing.join(", ")}`);
});
