// Show Hub v0 (src/booth-file.js): one booth design as a file, from the
// exhibitor to the promoter — what the file carries, what it refuses, and
// where an import lands on the floor.
import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, demoProject, validateProject } from "../src/model.js";
import { newHall } from "../src/hall.js";
import { toFloor } from "../src/show.js";
import { MAX_DESIGNS, openBooth } from "../src/linked.js";
import { DESIGN_FILE_KIND, designFile, importDesign, namedAssets, readDesignFile } from "../src/booth-file.js";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const exhibitor = () => {
  const p = blankProject();
  p.name = "Jane Painter";
  p.booth.color = "#335577";
  p.assets.used = { width: 10, height: 10, role: "artwork", data: PNG };
  p.assets.unused = { width: 10, height: 10, role: "artwork", data: PNG + "AA" };
  p.art = [{ ...(demoProject().art[0] || {}), id: "w1", asset: "used" }];
  return p;
};
const promoter = () => {
  const p = blankProject();
  p.hall = toFloor(newHall());
  return p;
};
const roundTrip = (x) => JSON.parse(JSON.stringify(x));

test("the file carries the live design and only the images it names", () => {
  const p = exhibitor();
  assert.doesNotThrow(() => validateProject(p));
  const f = designFile(p);
  assert.equal(f.kind, DESIGN_FILE_KIND);
  assert.equal(f.name, "Jane Painter");
  assert.deepEqual(Object.keys(f.assets), ["used"]);
  assert.equal(f.design.booth.color, "#335577");
  assert.ok(!("photo" in f.design) && !("hall" in f.design), "not the rest of the project");
  assert.deepEqual(namedAssets(f.design, p.assets), ["used"]);
});

test("a file lands on the chosen floor booth as a parked design, and saves", () => {
  const p = promoter();
  const file = readDesignFile(roundTrip(designFile(exhibitor())));
  assert.equal(importDesign(p, 104, file), null);
  assert.equal(p.hall.designs[104].booth.color, "#335577");
  assert.ok(p.assets.used, "its image joins the project");
  assert.ok(!p.assets.unused);
  assert.doesNotThrow(() => validateProject(p), "the promoter's project is still a valid backup");
  assert.equal(openBooth(p, 104), null, "and opens like any linked design");
  assert.equal(p.booth.color, "#335577");
  assert.equal(p.art[0].asset, "used");
});

test("an image id already used for other data is renamed, not overwritten", () => {
  const p = promoter();
  p.assets.used = { width: 5, height: 5, role: "artwork", data: PNG + "BB" };
  importDesign(p, 101, readDesignFile(roundTrip(designFile(exhibitor()))));
  const id = p.hall.designs[101].art[0].asset;
  assert.notEqual(id, "used");
  assert.equal(p.assets.used.data, PNG + "BB", "the promoter's own image is untouched");
  assert.equal(p.assets[id].data, PNG);
  assert.doesNotThrow(() => validateProject(p));
});

test("importing onto the booth open in the editor replaces the live design", () => {
  const p = promoter();
  openBooth(p, 102);
  importDesign(p, 102, readDesignFile(roundTrip(designFile(exhibitor()))));
  assert.equal(p.booth.color, "#335577");
  assert.ok(!p.hall.designs?.[102]);
  assert.doesNotThrow(() => validateProject(p));
});

test("refusals: no such booth, the design limit, a backup, a broken file", () => {
  const p = promoter();
  const file = readDesignFile(roundTrip(designFile(exhibitor())));
  assert.match(importDesign(p, 9999, file), /no booth 9999/);
  assert.match(importDesign(blankProject(), 101, file), /no show floor/);
  p.hall.designs = {};
  for (let i = 0; i < MAX_DESIGNS; i++) p.hall.designs[5000 + i] = {};
  assert.match(importDesign(p, 101, file), /limit/);
  assert.throws(() => readDesignFile(roundTrip(exhibitor())), /whole project backup/);
  assert.throws(() => readDesignFile({ kind: "nope" }), /not a Booth Studio booth design/);
  const bad = roundTrip(designFile(exhibitor()));
  bad.design.booth.width = 5;
  assert.throws(() => readDesignFile(bad), /not valid/);
});
