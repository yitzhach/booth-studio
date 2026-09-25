// The show floor: pieces, snapping, blocks of booths, spacing, numbering.
import test from "node:test";
import assert from "node:assert/strict";
import { newHall, hallTotals, hallCSV, hallHTML, validHall } from "../src/hall.js";
import { SHAPES, boothBlock, boxOf, copyPieces, floorOf, makePiece, renumber, showItems, showSVG, snapMove, spacePieces, toFloor, validShow } from "../src/show.js";
import { blankProject, validateProject } from "../src/model.js";

test("a grid plan reads as pieces, and turning it into a floor keeps every booth where it was", () => {
  const h = newHall();
  const pieces = showItems(h);
  assert.equal(pieces.length, 16);
  assert.deepEqual([pieces[0].number, pieces[0].x, pieces[0].y], [101, 120 + 60, 120 + 60]);
  assert.equal(pieces[8].rot, 180, "the second of a back-to-back pair faces the other aisle");
  assert.equal(h.items, undefined, "reading does not change the plan");
  toFloor(h);
  assert.equal(h.items.length, 16);
  assert.deepEqual(floorOf(h), { kind: "indoor", width: 120 * 2 + 8 * 120, depth: 120 * 2 + 2 * 120 });
  assert.ok(validHall(h));
  assert.equal(hallTotals(h).booths, 16);
});

test("pieces are optional in schema 1 and checked when present", () => {
  const p = blankProject();
  p.hall = toFloor(newHall());
  p.hall.items.push(makePiece(p.hall.items, SHAPES.find((s) => s.key === "aisle"), 600, 600));
  assert.doesNotThrow(() => validateProject(JSON.parse(JSON.stringify(p))));
  const base = () => toFloor(newHall());
  const bad = [
    (h) => h.items.push({ ...h.items[0] }),
    (h) => (h.items[1].number = h.items[0].number),
    (h) => (h.items[0].kind = "spaceship"),
    (h) => (h.items[0].w = 0),
    (h) => (h.items[0].style = "castle"),
    (h) => (h.venue.kind = "moon"),
    (h) => h.items.push({ id: "z", kind: "aisle", x: 0, y: 0, w: 10, d: 10, number: 5 }),
  ];
  for (const f of bad) {
    const h = base();
    f(h);
    assert.equal(validShow(h), false, f.toString());
  }
});

test("a new piece takes the next booth number; copies take new ids and numbers", () => {
  const h = toFloor(newHall());
  const b = makePiece(h.items, SHAPES[1], 50, 50);
  assert.deepEqual([b.number, b.w, b.d], [117, 240, 120]);
  const tent = makePiece(h.items, SHAPES.find((s) => s.key === "tent10"), 0, 0);
  assert.equal(tent.style, "tent");
  const copies = copyPieces(h.items, h.items.slice(0, 2), 240, 0);
  assert.deepEqual(copies.map((c) => c.number), [117, 118]);
  assert.ok(copies.every((c) => !h.items.some((i) => i.id === c.id)));
});

test("a turned piece's box swaps its width and depth", () => {
  const b = boxOf({ x: 100, y: 100, w: 240, d: 120, rot: 90 });
  assert.deepEqual([b.l, b.r, b.t, b.b].map(Math.round), [40, 160, -20, 220]);
});

test("a drag snaps to a neighbour's edge before the grid", () => {
  const other = { id: "a", x: 60, y: 60, w: 120, d: 120 };
  const moving = [{ id: "b", x: 300, y: 60, w: 120, d: 120 }];
  // Dragged left to leave its left edge 4″ from the other's right edge.
  const s = snapMove(moving, [other], -116, 0, { grid: 12, range: 6 });
  assert.equal(s.dx, -120);
  assert.deepEqual(s.guides[0], { axis: "x", at: 120 });
  // Far from anything, the corner lands on the grid.
  const g = snapMove(moving, [], 4, 5, { grid: 12, range: 6 });
  assert.deepEqual([g.dx, g.dy], [0, 0]);
});

test("a block of booths: rows, gaps, back-to-back pairs and numbering on", () => {
  const h = toFloor(newHall());
  const block = boothBlock(h.items, { count: 10, perRow: 5, w: 120, d: 120, gap: 24, aisle: 120, x: 0, y: 1000 });
  assert.equal(block.length, 10);
  assert.equal(block[0].number, 117);
  assert.equal(block[1].x - block[0].x, 144, "a 24″ gap between neighbours");
  assert.equal(block[5].y - block[0].y, 240, "the next row an aisle away");
  const pairs = boothBlock([], { count: 12, perRow: 4, w: 120, d: 120, aisle: 120, backToBack: true, x: 0, y: 0, start: 1 });
  assert.deepEqual([pairs[4].y - pairs[0].y, pairs[8].y - pairs[0].y], [120, 360]);
  assert.equal(pairs[4].rot, 180);
});

test("spacing lays pieces out a set gap apart; renumbering reads rows from the back", () => {
  const pieces = [
    { id: "a", kind: "booth", number: 5, x: 60, y: 60, w: 120, d: 120 },
    { id: "b", kind: "booth", number: 9, x: 500, y: 70, w: 240, d: 120 },
    { id: "c", kind: "booth", number: 2, x: 250, y: 50, w: 120, d: 120 },
  ];
  const moved = spacePieces(pieces, 36);
  assert.deepEqual(moved, [{ id: "c", x: 120 + 36 + 60, y: 50 }, { id: "b", x: 276 + 36 + 120, y: 70 }]);
  pieces.push({ id: "d", kind: "booth", number: 1, x: 60, y: 400, w: 120, d: 120 });
  assert.deepEqual(renumber(pieces, 101), [{ id: "a", number: 101 }, { id: "c", number: 102 }, { id: "b", number: 103 }, { id: "d", number: 104 }]);
});

test("the map, the CSV and the printed page follow the floor", () => {
  const h = toFloor(newHall());
  h.items[0].w = 240;
  h.booths = { 101: { status: "sold", name: "Ada Pottery" } };
  assert.match(hallCSV(h).split("\n")[1], /^101,,20 x 10,Sold,Ada Pottery/);
  assert.match(showSVG(h), /data-hall-booth="101"/);
  assert.match(showSVG(h), /Ada Pottery/);
  assert.match(hallHTML(h, "Fair"), /data-id="b101"/);
});
