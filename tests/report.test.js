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

test("Firefox and Safari stacks keep the frame that threw: only V8 opens with the message", () => {
  const err = new TypeError("x is undefined");
  err.stack = "paint@https://x.dev/assets/main.js:120:4\nrender@https://x.dev/assets/main.js:90:2\nboot@https://x.dev/assets/main.js:10:1";
  assert.equal(errorEntry({ type: "error", error: err }).where, "paint@https://x.dev/assets/main.js:120:4 ← render@https://x.dev/assets/main.js:90:2");
  const anon = new Error("no");
  anon.stack = "@https://x.dev/assets/main.js:5:1";
  assert.equal(errorEntry({ type: "error", error: anon }).where, "@https://x.dev/assets/main.js:5:1");
});

test("what someone typed stays out of an error: quoted text and a link's query", () => {
  const parse = new SyntaxError(`Unexpected token 'M', "My Booth N"... is not valid JSON`);
  parse.stack = `SyntaxError: ${parse.message}\n    at JSON.parse (<anonymous>)\n    at open (https://x.dev/assets/main.js:7:3?share=secretid)`;
  const e = errorEntry({ type: "error", error: parse });
  assert.equal(e.message, `Unexpected token 'M', "…"... is not valid JSON`);
  assert.ok(!JSON.stringify(e).includes("My Booth") && !JSON.stringify(e).includes("secretid"));
  assert.equal(errorEntry({ type: "unhandledrejection", reason: new Error("GET https://x.dev/api/shares?id=secretid failed") }).message, "Unhandled rejection: GET https://x.dev/api/shares failed");
  assert.equal(errorEntry({ type: "error", message: "Script error.", filename: "https://x.dev/assets/index-abc.js?share=secretid", lineno: 1, colno: 2 }).where, "index-abc.js:1:2");
  // What JSON.parse quotes can hold quotes of its own: everything between the first and the last goes.
  const nested = errorEntry({ type: "error", message: `Unexpected token 'x', "{"name": "Jane Doe"... is not valid JSON` });
  assert.equal(nested.message, `Unexpected token 'x', "…"... is not valid JSON`);
  // Single-quoted text goes when it holds a space, as a typed name does; a quoted property name stays.
  assert.equal(errorEntry({ type: "error", message: "Failed to execute 'querySelector' on 'Document': '#Jane's booth' is not a valid selector." }).message, "Failed to execute '…' is not a valid selector.");
  assert.equal(errorEntry({ type: "error", message: "Cannot read properties of undefined (reading 'length')" }).message, "Cannot read properties of undefined (reading 'length')");
});

test("a V8 message over several lines is not taken for the frames", () => {
  const err = new Error("line1\nline2\nline3");
  err.stack = "Error: line1\nline2\nline3\n    at paint (main.js:120:4)\n    at render (main.js:90:2)";
  assert.equal(errorEntry({ type: "error", error: err }).where, "at paint (main.js:120:4) ← at render (main.js:90:2)");
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

test("the same error again is counted, so a frame loop can't push out the error that started it", () => {
  clearErrors();
  const at = (s) => new Date(Date.UTC(2026, 9, 20, 4, 0, s));
  recordError({ message: "boot failed", where: "boot (main.js:1:1)" }, at(0));
  for (let i = 1; i <= 500; i++) recordError({ message: "frame broke", where: "frame (scene.js:9:9)" }, at(1 + (i % 50)));
  const list = recentErrors();
  assert.equal(list.length, 2);
  assert.deepEqual([list[0].message, list[0].count, list[1].message, list[1].count], ["frame broke", 500, "boot failed", 1]);
  const text = reportText({ errors: list, now: at(59) });
  assert.match(text, /frame broke \(frame \(scene\.js:9:9\)\) — 500 times since 04:00:02 UTC/);
  assert.match(text, /boot failed \(boot \(main\.js:1:1\)\)\n?/);
  assert.ok(!/boot failed.*times since/.test(text), "a single error has no count");
  clearErrors();
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
