import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ROLE, ROLES, ROLE_KEY, hasMoreTabs, hiddenActions, needsWelcome, readRole, resolveRole, tabAfterSwitch, visibleTabs, writeRole } from "../src/roles.js";

const TABS = ["art", "layout", "show", "walls", "lighting", "video", "hall", "export"];
const memory = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

test("every workspace names only real tabs, and its start tab is one of its own", () => {
  for (const [k, r] of Object.entries(ROLES)) {
    for (const t of [...(r.tabs || []), ...r.artShowTabs]) assert.ok(TABS.includes(t), `${k}: ${t}`);
    if (r.tabs) assert.ok(r.tabs.includes(r.start), k);
    assert.ok(r.title && r.blurb && r.label, k);
  }
});

test("Every tool is the default and shows every tab in the app's order", () => {
  assert.equal(DEFAULT_ROLE, "all");
  assert.equal(resolveRole("nonsense"), "all");
  assert.equal(resolveRole(undefined), "all");
  assert.deepEqual(visibleTabs("all", TABS, { active: "art" }), TABS);
  assert.equal(hasMoreTabs("all", TABS), false);
  assert.deepEqual(hiddenActions("all"), []);
});

test("the artist's tabs, with Art show only for an art-show booth", () => {
  assert.deepEqual(visibleTabs("artist", TABS, { active: "layout" }), ["art", "layout", "walls", "lighting", "export"]);
  assert.deepEqual(visibleTabs("artist", TABS, { active: "layout", artShow: true }), ["art", "layout", "show", "walls", "lighting", "export"]);
  assert.equal(hasMoreTabs("artist", TABS), true);
  assert.ok(hiddenActions("artist").includes("mode-show"));
});

test("the organizer's tabs", () => {
  assert.deepEqual(visibleTabs("organizer", TABS, { active: "hall" }), ["layout", "hall", "export"]);
  assert.ok(hiddenActions("organizer").includes("mode-photo"));
});

test("the open tab always shows, and More shows them all", () => {
  assert.deepEqual(visibleTabs("artist", TABS, { active: "video" }), ["art", "layout", "walls", "lighting", "video", "export"]);
  assert.deepEqual(visibleTabs("organizer", TABS, { active: "art", more: true }), TABS);
});

test("switching keeps the tab when the workspace has it, else opens the workspace's own", () => {
  assert.equal(tabAfterSwitch("artist", "lighting", TABS), "lighting");
  assert.equal(tabAfterSwitch("artist", "hall", TABS), "layout");
  assert.equal(tabAfterSwitch("organizer", "art", TABS), "hall");
  assert.equal(tabAfterSwitch("all", "video", TABS), "video");
  assert.equal(tabAfterSwitch("artist", "show", TABS, { artShow: true }), "show");
  assert.equal(tabAfterSwitch("artist", "show", TABS), "layout");
});

test("the welcome is for a browser with no workspace chosen and no project saved", () => {
  assert.equal(needsWelcome({ role: null, hadProject: false }), true);
  assert.equal(needsWelcome({ role: null, hadProject: true }), false);
  assert.equal(needsWelcome({ role: "all", hadProject: false }), false);
});

test("read and write: unknown or unreadable storage is no choice, never a throw", () => {
  const s = memory();
  assert.equal(readRole(s), null);
  assert.ok(writeRole("artist", s));
  assert.equal(s.m.get(ROLE_KEY), "artist");
  assert.equal(readRole(s), "artist");
  assert.ok(writeRole("bogus", s));
  assert.equal(readRole(s), "all");
  assert.equal(readRole(memory({ [ROLE_KEY]: "bogus" })), null);
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(readRole(broken), null);
  assert.equal(writeRole("artist", broken), false);
  assert.equal(readRole(null), null);
});
