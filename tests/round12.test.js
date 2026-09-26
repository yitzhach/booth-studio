// The twelfth round: the one-click Flip for a figure, and the sales kept for
// booth numbers no longer on the floor.
import test from "node:test";
import assert from "node:assert/strict";
import { flipFacing } from "../src/people.js";
import { moveSale, newHall, orphanSales, validHall } from "../src/hall.js";
import { showBooths, toFloor } from "../src/show.js";

test("Flip turns a figure round and stays in the Facing field's range", () => {
  assert.equal(flipFacing(180), 0);
  assert.equal(flipFacing(0), 180);
  assert.equal(flipFacing(90), -90);
  assert.equal(flipFacing(-90), 90);
  assert.equal(flipFacing(-180), 0);
  assert.equal(flipFacing(undefined), 180);
  for (let r = -180; r <= 180; r += 5) {
    const f = flipFacing(r);
    assert.ok(f >= -180 && f <= 180);
    assert.equal(flipFacing(f), r === -180 ? 180 : r, "flipped twice is back where it was");
  }
});

function floorWithSales() {
  const h = toFloor(newHall());
  const [a, b] = showBooths(h).map((x) => x.number);
  h.booths = { [a]: { status: "sold", name: "Ann", price: 900 }, [b]: { status: "open" }, 9001: { status: "held", name: "Ben" }, 9002: { status: "open" }, 9003: { note: "call back" } };
  return { h, a, b };
}

test("sales on numbers off the floor are listed, empty records are not", () => {
  const { h } = floorWithSales();
  assert.deepEqual(orphanSales(h).map((o) => o.number), [9001, 9003]);
  assert.equal(orphanSales(h)[0].name, "Ben");
});

test("a left-behind sale moves onto a free floor booth, never over a sale", () => {
  const { h, a, b } = floorWithSales();
  assert.equal(moveSale(h, 9001, a), false, "booth a is sold");
  assert.equal(moveSale(h, 9001, 424242), false, "not on the floor");
  assert.equal(moveSale(h, 9001, b), true, "booth b is open");
  assert.equal(h.booths[b].name, "Ben");
  assert.equal(h.booths[9001], undefined);
  assert.deepEqual(orphanSales(h).map((o) => o.number), [9003]);
  assert.ok(validHall(h));
});
