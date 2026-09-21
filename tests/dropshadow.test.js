// The drawn drop shadow. Two things rest on this arithmetic: that a wall gap
// is visible head-on, and that the three sliders do what their labels say.
import test from "node:test";
import assert from "node:assert/strict";
import { DROP_SHADOW, dropShadowSpec, shadowPlan, shadowKey } from "../src/dropshadow.js";

const art = (over = {}) => ({ w: 36, h: 48, offset: 0.75, thickness: 1.5, ...over });
const spec = (over = {}) => dropShadowSpec({ dropShadow: { ...DROP_SHADOW, ...over } });

test("a booth that has never heard of drop shadows gets the defaults", () => {
  assert.deepEqual(dropShadowSpec({}), { on: true, ...DROP_SHADOW, on: DROP_SHADOW.on });
  assert.deepEqual(dropShadowSpec(undefined), dropShadowSpec({}));
  // A stored value out of range is clamped rather than believed.
  assert.equal(dropShadowSpec({ dropShadow: { darkness: 4000 } }).darkness, 100);
  assert.equal(dropShadowSpec({ dropShadow: { darkness: "dark" } }).darkness, DROP_SHADOW.darkness);
});

test("darker and lighter is the opacity, and 0 is no shadow at all", () => {
  assert.ok(shadowPlan(spec({ darkness: 90 }), art()).opacity > shadowPlan(spec({ darkness: 20 }), art()).opacity);
  assert.equal(shadowPlan(spec({ darkness: 0 }), art()).on, false);
  assert.equal(shadowPlan(spec({ on: false }), art()).on, false);
});

test("further and closer is how far it is thrown, and it falls rather than rises", () => {
  const near = shadowPlan(spec({ distance: 0 }), art()),
    far = shadowPlan(spec({ distance: 100 }), art());
  assert.ok(Math.abs(far.dy) > Math.abs(near.dy) * 2);
  assert.ok(near.dy < 0 && far.dy < 0, "the light is overhead, so the shadow drops");
  assert.ok(far.dx > 0);
});

test("softer and harder is the penumbra, and a softer shadow is a lighter one", () => {
  const hard = shadowPlan(spec({ softness: 0 }), art()),
    soft = shadowPlan(spec({ softness: 100 }), art());
  assert.ok(soft.blur > hard.blur);
  assert.ok(soft.opacity < hard.opacity, "the same light over a larger area");
});

test("a deeper wall gap throws a bigger shadow — which is the point of it", () => {
  const flush = shadowPlan(spec(), art({ offset: 0 })),
    stood = shadowPlan(spec(), art({ offset: 3 }));
  assert.ok(Math.abs(stood.dy) > Math.abs(flush.dy));
  assert.ok(stood.width > flush.width);
  assert.ok(flush.on && flush.opacity > 0, "a flush work still reads as an object on a wall");
});

test("the plane always holds the whole shadow, so nothing is cut off square", () => {
  for (const offset of [0, 0.75, 3, 12, 40])
    for (const softness of [0, 50, 100])
      for (const distance of [0, 50, 100])
        for (const size of [[6, 6], [36, 48], [120, 96]]) {
          const plan = shadowPlan(spec({ softness, distance }), art({ offset, w: size[0], h: size[1] }));
          assert.ok(plan.width > size[0] && plan.height > size[1], "the pad is on both sides");
          assert.ok(plan.insetX > 0 && plan.insetX < 0.5, `insetX ${plan.insetX}`);
          assert.ok(plan.insetY > 0 && plan.insetY < 0.5, `insetY ${plan.insetY}`);
          assert.ok(plan.blur <= 0.49 && plan.blur >= 0);
          assert.ok(plan.opacity > 0 && plan.opacity <= 0.85);
        }
});

test("two works of the same shape share one canvas", () => {
  const a = shadowPlan(spec(), art()),
    b = shadowPlan(spec(), art({ offset: 0.75 }));
  assert.equal(shadowKey(a), shadowKey(b));
  assert.notEqual(shadowKey(a), shadowKey(shadowPlan(spec({ softness: 100 }), art())));
});
