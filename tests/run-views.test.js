// The view suites' list and CI's shards (tests/helpers/view-suites.mjs): a
// suite file that is not on the list would never run, in CI or in
// `npm run test:view`, and a shard that drops or repeats a suite would hide it.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { SECONDS, SUITES, shard } from "./helpers/view-suites.mjs";

test("every tests/view-*.mjs is on the list, and everything on the list is a file", () => {
  const files = readdirSync(new URL(".", import.meta.url)).filter((f) => /^view-.+\.mjs$/.test(f)).map((f) => f.slice(0, -4));
  assert.deepEqual([...files].sort(), [...SUITES].sort());
  for (const suite of SUITES) assert.ok(SECONDS[suite] > 0, `${suite} has a time`);
});

test("four shards run every suite exactly once and finish close together", () => {
  const shards = [0, 1, 2, 3].map((i) => shard(i, 4));
  assert.deepEqual(shards.flat().sort(), [...SUITES].sort());
  const loads = shards.map((s) => s.reduce((sum, suite) => sum + SECONDS[suite], 0));
  const longest = Math.max(...Object.values(SECONDS));
  assert.ok(Math.max(...loads) - Math.min(...loads) <= longest, `shard times ${loads.join(", ")} s`);
  assert.deepEqual(shard(0, 1), SUITES, "one shard is the whole list, in order");
});
