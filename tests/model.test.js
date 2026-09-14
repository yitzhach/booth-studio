import test from "node:test";
import assert from "node:assert/strict";
import {
  blankProject,
  demoProject,
  validateProject,
  constrain,
  boundWarning,
  mismatch,
  homography,
  convex,
  IN,
} from "../src/model.js";
import { hangingGuide } from "../src/guide.js";
test("measured units: a 36 × 48 panel has 3:4 geometry in metres", () => {
  assert.equal(36 * IN, 0.9144);
  assert.equal(48 * IN, 1.2191999999999998);
  assert.ok(Math.abs((36 * IN) / (48 * IN) - 0.75) < 1e-9);
});
test("clamping respects the selected side wall, with visible oversize warnings", () => {
  const p = demoProject();
  p.booth.walls.left.width = 72;
  const a = { ...p.art[0], wall: "left", w: 36, x: 80, y: -5 };
  const c = constrain(p, a);
  assert.equal(c.x, 36);
  assert.equal(c.y, 0);
  assert.equal(boundWarning(p, c), "");
  assert.match(boundWarning(p, { ...c, w: 96 }), /beyond/);
  p.booth.walls.left.enabled = false;
  assert.match(boundWarning(p, c), /hidden/);
});
test("backup round trip preserves data; malformed and nonfinite values are rejected", () => {
  const p = demoProject();
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
  for (const bad of [
    { ...p, schema: 2 },
    { ...p, ambient: NaN },
    {
      ...p,
      assets: { bad: { data: "https://example.com", width: 1, height: 1 } },
    },
    { ...p, art: [{ ...p.art[0], thickness: -1 }] },
  ])
    assert.throws(() => validateProject(bad));
});
test("image aspect mismatch is detected without changing original data", () => {
  const p = demoProject();
  p.assets.test = {
    data: "data:image/png;base64,eA==",
    width: 300,
    height: 400,
  };
  const a = { ...p.art[0], asset: "test", w: 36, h: 48 };
  assert.equal(mismatch(p, a), false);
  assert.equal(mismatch(p, { ...a, h: 36 }), true);
  assert.equal(p.assets.test.data, "data:image/png;base64,eA==");
});
test("projective photo mapping maps all four corners accurately", () => {
  const q = [
      [10, 25],
      [200, 5],
      [180, 290],
      [30, 240],
    ],
    f = homography(q);
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ].forEach((uv, i) => {
    f(...uv).forEach((v, j) => assert.ok(Math.abs(v - q[i][j]) < 1e-8));
  });
  assert.equal(convex(q), true);
  assert.equal(convex([q[0], q[2], q[1], q[3]]), false);
});
test("guide escapes titles and documents wall reference coordinates", () => {
  const p = demoProject();
  p.name = "<script>alert(1)</script>";
  p.art[0].title = "<img onerror=bad>";
  const g = hangingGuide(p);
  assert.ok(!g.includes("<script>alert"));
  assert.ok(g.includes("&lt;img"));
  assert.match(g, /bottom-left/);
  assert.match(g, /not hook positions/);
});
