// Opening one booth of the show floor as a full design (src/linked.js), and
// the saved floor templates (show.js FLOOR_TEMPLATES): the storage shape,
// its round trips, what a renumber, a delete and "my booth" do to it, and
// that every backup it writes validates while every older one still does.
import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, validateProject } from "../src/model.js";
import { newHall, validHall } from "../src/hall.js";
import { FLOOR_TEMPLATES, boxOf, toFloor } from "../src/show.js";
import { MAX_DESIGNS, OWN, assetInDesigns, deleteEffect, freshDesign, hasDesign, liveNumber, openBooth, renumberDesigns, setMine } from "../src/linked.js";

const project = () => {
  const p = blankProject();
  p.hall = toFloor(newHall());
  p.booth.color = "#123456";
  return p;
};

test("opening a floor booth parks the live design and brings in one sized from the piece", () => {
  const p = project();
  const mineBooth = p.booth;
  p.hall.items.find((i) => i.number === 103).w = 240;
  assert.equal(liveNumber(p.hall), undefined, "no booth is mine: the live design is on no floor booth");
  assert.equal(openBooth(p, 103), null);
  assert.equal(p.hall.open, 103);
  assert.equal(p.hall.designs[OWN].booth, mineBooth, "your own booth is parked under 0");
  assert.equal(p.booth.width, 240, "sized from its piece");
  assert.equal(p.booth.depth, 120);
  assert.equal(p.booth.walls.back.width, 240);
  assert.equal(p.booth.walls.left.width, 120);
  assert.deepEqual(p.art, []);
  assert.doesNotThrow(() => validateProject(p), "the whole project, parked design and all, is a valid backup");
  // Round trip: open another, then come back.
  const b103 = p.booth;
  openBooth(p, 110);
  assert.equal(p.hall.designs[103].booth, b103);
  openBooth(p, 103);
  assert.equal(p.booth, b103, "a parked design comes back as it was");
  assert.ok(!p.hall.designs[103]);
  openBooth(p, OWN);
  assert.equal(p.booth, mineBooth);
  assert.equal(p.hall.open, undefined, "back on your own booth with no mine is the shortest form: no open");
  assert.deepEqual(Object.keys(p.hall.designs).map(Number).sort((a, b) => a - b), [103, 110]);
  assert.ok(hasDesign(p.hall, 110) && !hasDesign(p.hall, 111));
  assert.doesNotThrow(() => validateProject(p));
});

test("with a booth marked mine, the live design is mine's, and moving mine does not move it", () => {
  const p = project();
  p.hall.mine = 101;
  assert.equal(liveNumber(p.hall), 101);
  const mineBooth = p.booth;
  openBooth(p, 105);
  assert.equal(p.hall.designs[101].booth, mineBooth, "my booth's design is parked under my booth");
  assert.equal(p.hall.open, 105);
  openBooth(p, 101);
  assert.equal(p.hall.open, undefined, "opening mine again drops open");
  // Moving "my booth" is a sale change: the live design stays with 101.
  setMine(p.hall, 112);
  assert.equal(p.hall.mine, 112);
  assert.equal(liveNumber(p.hall), 101);
  setMine(p.hall, undefined);
  assert.equal(liveNumber(p.hall), 101);
  setMine(p.hall, 101);
  assert.equal(p.hall.open, undefined);
  // A design on no booth moves into the booth marked mine…
  const q = project();
  setMine(q.hall, 107);
  assert.equal(liveNumber(q.hall), 107);
  assert.equal(q.hall.open, undefined);
  // …unless that booth already has a design of its own.
  const r = project();
  openBooth(r, 108);
  openBooth(r, OWN);
  setMine(r.hall, 108);
  assert.equal(r.hall.open, OWN, "your own booth stays yours; 108 keeps its design");
});

test("a renumber carries designs and the open booth with their numbers", () => {
  const p = project();
  openBooth(p, 104);
  openBooth(p, 106);
  renumberDesigns(p.hall, [{ from: 104, to: 204 }, { from: 106, to: 206 }]);
  assert.ok(p.hall.designs[204] && !p.hall.designs[104]);
  assert.equal(p.hall.open, 206);
  assert.ok(p.hall.designs[OWN], "your own booth has no number to change");
});

test("deleting booths: a parked design goes with its booth; the open one becomes your own", () => {
  const p = project();
  openBooth(p, 104);
  openBooth(p, 106);
  assert.deepEqual(deleteEffect(p.hall, [104]), { refuse: false, drop: [104], orphan: false });
  // 106 is open and your own booth is already parked: nowhere to put it.
  assert.equal(deleteEffect(p.hall, [106]).refuse, true);
  openBooth(p, OWN);
  openBooth(p, 106);
  delete p.hall.designs[OWN];
  assert.deepEqual(deleteEffect(p.hall, [106]), { refuse: false, drop: [], orphan: true });
});

test("a fresh design is built the way the floor says", () => {
  const tent = freshDesign({ w: 120, d: 120, style: "tent" });
  assert.equal(tent.booth.tent, true);
  assert.equal(tent.booth.venue, "outdoor");
  const hard = freshDesign({ w: 480, d: 30 });
  assert.equal(hard.booth.venue, "artshow");
  assert.equal(hard.booth.width, 360, "a booth is at most 30′");
  assert.equal(hard.booth.depth, 48, "and at least 4′");
  const open = freshDesign({ w: 120, d: 120, style: "open" });
  assert.ok(Object.values(open.booth.walls).every((w) => !w.enabled), "open floor has no walls");
  for (const d of [tent, hard, open]) {
    const p = { ...blankProject(), ...d };
    assert.doesNotThrow(() => validateProject(p));
  }
});

test("parked designs keep their images, and a bad one fails the backup", () => {
  const p = project();
  p.assets.img1 = { id: "img1", name: "a.jpg", type: "image/jpeg", data: "data:image/jpeg;base64,AAAA", width: 10, height: 10 };
  openBooth(p, 102);
  assert.equal(assetInDesigns(p, "img1"), false);
  p.hall.designs[OWN].booth.surroundAsset = "img1";
  assert.equal(assetInDesigns(p, "img1"), true);
  assert.equal(assetInDesigns(p, "img"), false, "a whole id, not a prefix");
  // A parked design is held to the live one's rules.
  const bad = structuredClone(p);
  bad.hall.designs[OWN].booth.width = 9999;
  assert.throws(() => validateProject(bad));
  const missing = structuredClone(p);
  delete missing.assets.img1;
  assert.throws(() => validateProject(missing), "a parked design naming an image not in the backup");
  // The new keys are optional and typed.
  const old = project();
  assert.doesNotThrow(() => validateProject(old), "a plan without them is what every older backup is");
  assert.equal(validHall({ ...old.hall, open: 1.5 }), false);
  assert.equal(validHall({ ...old.hall, designs: { abc: {} } }), false);
  assert.equal(validHall({ ...old.hall, designs: [] }), false);
});

test("never more than MAX_DESIGNS linked designs", () => {
  const p = project();
  p.hall.designs = {};
  for (let i = 0; i < MAX_DESIGNS; i++) p.hall.designs[1000 + i] = freshDesign({ w: 120, d: 120 });
  assert.match(openBooth(p, 105), /limit/);
  assert.equal(openBooth(p, 99999), "There is no booth 99999 on the floor.");
});

test("every floor template is a valid plan of booths that do not overlap", () => {
  for (const [key, t] of Object.entries(FLOOR_TEMPLATES)) {
    const built = t.build(101);
    const h = { ...newHall(), ...built };
    assert.ok(validHall(h), key);
    const booths = built.items.filter((i) => i.kind === "booth");
    assert.ok(booths.length >= 12, `${key}: ${booths.length} booths`);
    assert.equal(Math.min(...booths.map((b) => b.number)), 101);
    const shrink = (b) => ({ l: b.l + 1, r: b.r - 1, t: b.t + 1, b: b.b - 1 });
    for (let i = 0; i < booths.length; i++)
      for (let j = i + 1; j < booths.length; j++) {
        const a = shrink(boxOf(booths[i])),
          b = shrink(boxOf(booths[j]));
        assert.ok(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t, `${key}: booths ${booths[i].number} and ${booths[j].number} overlap`);
      }
    for (const it of built.items) {
      const b = boxOf(it);
      assert.ok(b.l >= -1 && b.t >= -1 && b.r <= built.venue.width + 1 && b.b <= built.venue.depth + 1, `${key}: ${it.kind} ${it.id} is on the floor`);
    }
  }
  assert.ok(FLOOR_TEMPLATES.street.build().items.every((i) => i.kind !== "booth" || i.style === "tent"), "the street is canopy tents");
});
