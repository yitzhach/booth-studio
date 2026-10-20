import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ERRORS, clearErrors, errorEntry, projectSummary, recentErrors, recordError, reportText } from "../src/report.js";
import { demoProject } from "../src/model.js";

test("an error event and a rejection read as a message and a place", () => {
  const err = new TypeError("x is undefined");
  err.stack = "TypeError: x is undefined\n    at paint (main.js:120:4)\n    at render (main.js:90:2)\n    at boot (main.js:10:1)";
  assert.deepEqual(errorEntry({ type: "error", error: err, message: "Uncaught TypeError: x is undefined" }), {
    message: "x is undefined",
    where: "at paint (main.js:120:4) ← at render (main.js:90:2)",
  });
  assert.deepEqual(errorEntry({ type: "unhandledrejection", reason: "quota exceeded" }), { message: "Unhandled rejection: quota exceeded", where: "" });
  assert.deepEqual(errorEntry({ type: "error", message: "Script error.", filename: "https://x.dev/assets/index-abc.js", lineno: 3, colno: 9 }), {
    message: "Script error.",
    where: "index-abc.js:3:9",
  });
  assert.equal(errorEntry({ type: "error", message: "y".repeat(1000) }).message.length, 300, "a long message is clipped");
});

test("the ring keeps the last MAX_ERRORS, newest first", () => {
  clearErrors();
  for (let i = 0; i < MAX_ERRORS + 5; i++) recordError({ message: `e${i}` }, new Date(Date.UTC(2026, 9, 20, 4, 0, i)));
  recordError({ message: "" });
  recordError(null);
  const list = recentErrors();
  assert.equal(list.length, MAX_ERRORS);
  assert.equal(list[0].message, `e${MAX_ERRORS + 4}`);
  assert.equal(list.at(-1).message, "e5");
  clearErrors();
  assert.deepEqual(recentErrors(), []);
});

test("the project is counts and settings only — no names, titles or images", () => {
  const p = demoProject();
  p.name = "Private booth name";
  p.art[0].title = "Secret title";
  const s = projectSummary(p);
  assert.match(s, /^6 placements, 0 images or files, 10 × 10 ft/);
  assert.ok(!s.includes("Private") && !s.includes("Secret"));
  assert.equal(projectSummary(null), "none open");
});

test("the report names the build, leaves the booth link's id out, and lists errors", () => {
  const text = reportText({
    build: { version: "0.1.0", time: "2026-10-20T04:00:00.000Z", commit: "abc1234" },
    href: "https://booth-studio.example.dev/?share=secretid#x",
    userAgent: "TestBrowser/1",
    viewport: "1280×900 @2x",
    signedIn: false,
    project: demoProject(),
    assets: { grass: { state: "loaded" }, concrete: { state: "missing" } },
    errors: [{ at: "2026-10-20T04:01:02.000Z", message: "boom", where: "main.js:1:1" }],
    now: new Date("2026-10-20T04:05:00Z"),
  });
  assert.match(text, /^Booth Studio problem report\n/);
  assert.match(text, /Build: v0\.1\.0 · built 2026-10-20T04:00:00\.000Z · commit abc1234/);
  assert.match(text, /Page: https:\/\/booth-studio\.example\.dev\/\n/);
  assert.ok(!text.includes("secretid"), "a booth link's id is not in the report");
  assert.match(text, /Texture sets: grass loaded, concrete missing/);
  assert.match(text, /Recent errors on this page, newest first \(1\):\n- 04:01:02 UTC boom \(main\.js:1:1\)/);
  assert.match(reportText({ errors: [] }), /Recent errors on this page: none/);
});
