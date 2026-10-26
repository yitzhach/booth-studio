// Runs the view suites, each on its own and one after another (two browser
// suites at once time out on a four-core sandbox), every one to the end; then
// names each that failed, and exits 1 if any did.
//
//   node tests/run-views.mjs                  every view suite (npm run test:view)
//   node tests/run-views.mjs people panels    tests/view-people.mjs, tests/view-panels.mjs
//   node tests/run-views.mjs all e2e          every view suite, then tests/e2e.mjs
//   node tests/run-views.mjs --shard 1/4      CI's second of four shards
//   --logs <dir>   each suite's output to <dir>/<suite>.log, and a line to
//                  <dir>/status as each one ends ("view-people 0 38s"), then
//                  DONE: for a run left in the background
//
// A name is tests/view-<name>.mjs if that exists, else tests/<name>.mjs, else
// a path (tests/view-people.mjs works too). The list and CI's shards are in
// tests/helpers/view-suites.mjs.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SUITES, shard } from "./helpers/view-suites.mjs";

const tests = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
let logs = null;
let names = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--logs") logs = args[++i];
  else if (args[i] === "--shard") {
    const [index, count] = (args[++i] || "").split("/").map(Number);
    if (!(count > 0 && index >= 0 && index < count)) throw new Error(`--shard wants <index>/<count>, like 0/4, not ${args[i]}`);
    names.push(...shard(index, count));
  } else if (args[i] === "all") names.push(...SUITES);
  else names.push(args[i]);
}
if (!names.length) names = [...SUITES];

const files = names.map((name) => {
  const file = [`view-${name}.mjs`, `${name}.mjs`].map((f) => path.join(tests, f)).concat(path.resolve(name)).find((f) => f.endsWith(".mjs") && existsSync(f));
  if (!file) throw new Error(`no suite ${name}: tests/view-${name}.mjs and tests/${name}.mjs are both missing`);
  return file;
});
if (logs) {
  mkdirSync(logs, { recursive: true });
  writeFileSync(path.join(logs, "status"), "");
}

const ci = !!process.env.GITHUB_ACTIONS;
const failed = [];
for (const file of files) {
  const suite = path.basename(file, ".mjs");
  const started = Date.now();
  let run;
  if (logs) {
    const out = openSync(path.join(logs, `${suite}.log`), "w");
    run = spawnSync(process.execPath, [file], { stdio: ["ignore", out, out] });
    closeSync(out);
  } else {
    if (ci) console.log(`::group::${suite}`);
    run = spawnSync(process.execPath, [file], { stdio: "inherit" });
    if (ci) console.log("::endgroup::");
  }
  const status = run.status ?? run.signal; // a signal when the suite was killed
  const seconds = Math.round((Date.now() - started) / 1000);
  if (status !== 0) failed.push(suite);
  console.log(`${status === 0 ? "ok  " : "FAIL"} ${suite} (${status === 0 ? "" : `exit ${status}, `}${seconds} s)`);
  if (logs) appendFileSync(path.join(logs, "status"), `${suite} ${status} ${seconds}s\n`);
}
if (logs) appendFileSync(path.join(logs, "status"), "DONE\n");

console.log(`${files.length} suites, ${failed.length} failed${failed.length ? ": " + failed.join(" ") : ""}`);
if (failed.length) {
  if (ci) console.log(`::error::View suites failed: ${failed.join(" ")}`);
  process.exit(1);
}
