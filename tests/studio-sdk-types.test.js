// src/vendor/studio-sdk.d.ts is written by hand from the SDK's source in
// Art-Talk-Back, beside the .js generated there (TYPING_PHASE.md, task 6).
// This holds the two together: every export the declaration names, and
// every member it gives the three classes, exists in the vendored module,
// and the module exports nothing the declaration leaves out. An SDK update
// that adds, renames or drops one fails here, with the name, until the
// declaration follows it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as sdk from "../src/vendor/studio-sdk.js";

const dts = readFileSync(new URL("../src/vendor/studio-sdk.d.ts", import.meta.url), "utf8");
// The members a declared class lists, by name: `name(`, `name:` or `name<`.
const members = (name) => {
  const body = dts.slice(dts.indexOf(`export class ${name}`)).split("\n}")[0];
  return [...body.matchAll(/^ {2}(?:static |readonly |private )*([A-Za-z]\w*)[(:<]/gm)].map((m) => m[1]).filter((m) => m !== "constructor");
};

test("the SDK's declaration names exactly what the vendored module exports", () => {
  const declared = [...dts.matchAll(/^export (?:class|const|function) (\w+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(declared, Object.keys(sdk).sort());
});

test("every member the declaration gives a class, the module's class has", () => {
  // Instance fields (arrow functions, `api`, `online`) exist only on an
  // instance, so ApiClient and Studio are read from one; Studio's own
  // constructor is private, so its instance members are read from the
  // source's field list instead of `new`.
  const client = new sdk.ApiClient({ baseUrl: "http://x" });
  for (const m of members("ApiClient")) assert.ok(m in client, `ApiClient has no ${m}`);
  const error = new sdk.ApiError(401, "c", "m");
  for (const m of members("ApiError")) assert.ok(m in error, `ApiError has no ${m}`);
  const source = sdk.Studio.toString();
  for (const m of members("Studio")) {
    const found = m in sdk.Studio || m in sdk.Studio.prototype || source.includes(`__publicField(this, "${m}"`);
    assert.ok(found, `Studio has no ${m}`);
  }
});
