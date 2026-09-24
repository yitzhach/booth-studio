import test from "node:test";
import assert from "node:assert/strict";
import { SHORTCUTS, dedupe, fold, rankTools, shortcutOf } from "../src/toolsearch.js";

const entries = [
  { label: "Target height", where: "Lighting · Spotlights" },
  { label: "Height", where: "Layout · Footprint" },
  { label: "Brightness", where: "Lighting · Spotlights" },
  { label: "Brightness", where: "Lighting · Light bar" },
  { label: "Angle", where: "Lighting · Drop shadow" },
  { label: "Download show pack", where: "Export · Show pack" },
  { label: "Measure", where: "Toolbar" },
];

test("a query folds case, accents and punctuation", () => {
  assert.equal(fold("  Café–Lighting!  "), "cafe lighting");
});

test("an empty query lists nothing", () => {
  assert.deepEqual(rankTools(entries, "  "), []);
});

test("the shorter, exact label wins", () => {
  assert.deepEqual(rankTools(entries, "height").map((x) => x.label), ["Height", "Target height"]);
});

test("every word has to match, in the label or where it lives", () => {
  assert.deepEqual(rankTools(entries, "shadow angle").map((x) => x.label), ["Angle"]);
  assert.deepEqual(rankTools(entries, "light bar bright").map((x) => x.where), ["Lighting · Light bar"]);
  assert.deepEqual(rankTools(entries, "angle pack"), []);
});

test("a prefix finds the tool as it is typed", () => {
  assert.equal(rankTools(entries, "meas")[0].label, "Measure");
  assert.equal(rankTools(entries, "show")[0].label, "Download show pack");
});

test("the list is capped", () => {
  assert.equal(rankTools(entries, "i", 2).length, 2);
});

test("the same label twice in one place is one entry", () => {
  const list = dedupe([...entries, { label: "height", where: "Layout · Footprint" }, { label: " ", where: "x" }]);
  assert.equal(list.length, entries.length);
});

test("a shortcut typed exactly puts its tool first, and the rest still follow", () => {
  const entries = [
    { label: "Wall gap", where: "Artwork · Dimensions" },
    { label: "Gap between booths", where: "Layout · Booth row" },
    { label: "Ambient illumination", where: "Lighting" },
  ];
  assert.equal(rankTools(entries, "amb")[0].label, "Ambient illumination");
  assert.equal(rankTools(entries, " AMB ")[0].label, "Ambient illumination", "case and spaces do not matter");
  const gap = rankTools(entries, "gap");
  assert.equal(gap[0].label, "Wall gap");
  assert.equal(gap.length, 2, "the other gap is still listed");
  assert.equal(shortcutOf(entries[2]), "amb");
  assert.equal(shortcutOf({ label: "Nothing", where: "Nowhere" }), "");
  assert.equal(rankTools(entries, "constructor").length, 0, "an object's own keys are not shortcuts");
});

test("shortcuts are short, lower case, and no two name the same control", () => {
  const seen = new Set();
  for (const [name, sc] of Object.entries(SHORTCUTS)) {
    assert.match(name, /^[a-z0-9]{2,5}$/, name);
    assert.ok(sc.label && sc.where && sc.group, name);
    const key = fold(sc.label) + "|" + fold(sc.where);
    assert.ok(!seen.has(key), `${name} names a control another shortcut already does`);
    seen.add(key);
  }
});
