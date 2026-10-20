import { test } from "node:test";
import assert from "node:assert/strict";
import { KEEP_SAFE_KEY, REMIND_DAYS, backupDue, formatBytes, keepSafeLines, keepSafeOf, noteKeepSafe } from "../src/keep-safe.js";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const now = new Date("2026-10-20T12:00:00Z");
const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000);

test("a backup and a reminder are remembered per project, and nothing else is touched", () => {
  const s = memory();
  assert.deepEqual(keepSafeOf(s, "a"), { backup: null, reminded: null });
  noteKeepSafe(s, "a", "backup", now);
  noteKeepSafe(s, "b", "reminded", now);
  assert.equal(keepSafeOf(s, "a").backup.toISOString(), now.toISOString());
  assert.equal(keepSafeOf(s, "a").reminded, null);
  assert.equal(keepSafeOf(s, "b").reminded.toISOString(), now.toISOString());
  noteKeepSafe(s, "a", "nonsense", now);
  noteKeepSafe(s, "", "backup", now);
  assert.deepEqual(Object.keys(JSON.parse(s.getItem(KEEP_SAFE_KEY))).sort(), ["a", "b"]);
});

test("broken or missing storage reads as nothing remembered", () => {
  const s = memory();
  s.setItem(KEEP_SAFE_KEY, "{not json");
  assert.deepEqual(keepSafeOf(s, "a"), { backup: null, reminded: null });
  s.setItem(KEEP_SAFE_KEY, JSON.stringify({ a: { backup: "not a date" } }));
  assert.equal(keepSafeOf(s, "a").backup, null);
  assert.deepEqual(keepSafeOf(undefined, "a"), { backup: null, reminded: null });
  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(keepSafeOf(throwing, "a"), { backup: null, reminded: null });
  assert.doesNotThrow(() => noteKeepSafe(throwing, "a", "backup", now));
});

test("a backup reminder: signed out, own images, no recent backup, not reminded lately", () => {
  const base = { hasOwnImages: true, signedIn: false, backup: null, reminded: null, now };
  assert.equal(backupDue(base), true);
  assert.equal(backupDue({ ...base, signedIn: true }), false, "the studio keeps a signed-in booth");
  assert.equal(backupDue({ ...base, hasOwnImages: false }), false, "the example booth holds no images of anyone's");
  assert.equal(backupDue({ ...base, backup: daysAgo(3) }), false);
  assert.equal(backupDue({ ...base, backup: daysAgo(REMIND_DAYS) }), true);
  assert.equal(backupDue({ ...base, reminded: daysAgo(1) }), false, "never twice in a month");
  assert.equal(backupDue({ ...base, reminded: daysAgo(REMIND_DAYS + 1) }), true);
});

test("sizes read the way a person says them", () => {
  assert.equal(formatBytes(512_000), "512 KB");
  assert.equal(formatBytes(37_400_000), "37 MB");
  assert.equal(formatBytes(2_140_000_000), "2.1 GB");
  assert.equal(formatBytes(10), "1 KB");
  assert.equal(formatBytes(undefined), "");
  assert.equal(formatBytes(-1), "");
});

test("Keep your work says what the browser does with this device's copy", () => {
  const kept = keepSafeLines({ persisted: true, usage: 37_000_000, quota: 2_100_000_000, backup: now, signedIn: false });
  assert.equal(kept.ask, false);
  assert.match(kept.lines[0], /keeps this device's copy until you clear it/);
  assert.match(kept.lines[1], /Using 37 MB of about 2\.1 GB/);
  assert.match(kept.lines[2], /Last backup downloaded from this browser: Oct 20, 2026/);
  const atRisk = keepSafeLines({ persisted: false, backup: null, signedIn: true });
  assert.equal(atRisk.ask, true, "only then is the button offered");
  assert.match(atRisk.lines[0], /may clear/);
  assert.ok(atRisk.lines.includes("No backup downloaded from this browser yet."));
  assert.ok(atRisk.lines.some((l) => /also kept in your studio/.test(l)));
  assert.ok(!atRisk.lines.some((l) => /^Using/.test(l)), "no numbers when the browser gives none");
  const unknown = keepSafeLines({ persisted: null });
  assert.equal(unknown.ask, false);
  assert.match(unknown.lines[0], /does not say/);
});
