import test from "node:test";
import assert from "node:assert/strict";

// backdropFov lives in scene.js, which imports three and touches the DOM at
// module scope, so the rule is restated here the way render-scale.test.js
// restates renderScale. What matters is that it is pinned: the bug it fixes is
// a judgement about how a photograph reads on screen, which no one can see in
// a diff.
const BACKDROP_FRAMING = 65;
const backdropFov = (fov, framing = BACKDROP_FRAMING) => {
  const clamped = Math.min(100, Math.max(25, Number(framing) || BACKDROP_FRAMING));
  const half = Math.atan(Math.tan((fov * Math.PI) / 360) / (clamped / 100));
  return Math.min(160, (half * 360) / Math.PI);
};

// How many source pixels of a 2:1 equirectangular image land across the
// canvas. This is the whole reason the setting exists: at 62 degrees a 1024px
// panorama gives about 176 of them, so every one is smeared over eight screen
// pixels on a 1440px canvas.
const visiblePixels = (sourceWidth, fov) => (sourceWidth * fov) / 360;

test("100% leaves the backdrop framed exactly as the camera frames it", () => {
  assert.equal(backdropFov(62, 100), 62);
});

test("the default pulls the backdrop back without a wide-angle booth", () => {
  const fov = backdropFov(62, BACKDROP_FRAMING);
  assert.ok(fov > 80 && fov < 90, `expected roughly 85 degrees, got ${fov}`);
});

// The point of the widening, stated as the thing the user complained about.
test("widening the backdrop's lens cuts its magnification", () => {
  const before = visiblePixels(1024, 62);
  const after = visiblePixels(1024, backdropFov(62, BACKDROP_FRAMING));
  assert.ok(before < 180, `the old framing showed ${before.toFixed(0)}px`);
  assert.ok(
    after / before > 1.35,
    `expected at least a third more source pixels, got ${(after / before).toFixed(2)}x`,
  );
});

test("framing is monotonic: lower always means wider", () => {
  const fovs = [100, 85, 65, 45, 25].map((f) => backdropFov(62, f));
  for (let i = 1; i < fovs.length; i++)
    assert.ok(fovs[i] > fovs[i - 1], `${fovs[i]} should exceed ${fovs[i - 1]}`);
});

// A backup from an older schema has no backdropFraming at all, and a slider
// can still hand over a blank string.
test("a missing or unusable framing falls back rather than blanking the view", () => {
  assert.equal(backdropFov(62, undefined), backdropFov(62, BACKDROP_FRAMING));
  assert.equal(backdropFov(62, ""), backdropFov(62, BACKDROP_FRAMING));
  assert.equal(backdropFov(62, NaN), backdropFov(62, BACKDROP_FRAMING));
});

test("the framing range is clamped, so no value produces a degenerate lens", () => {
  assert.equal(backdropFov(62, 5), backdropFov(62, 25), "clamped at 25%");
  assert.equal(backdropFov(62, 400), backdropFov(62, 100), "clamped at 100%");
  for (const framing of [25, 40, 65, 80, 100])
    assert.ok(backdropFov(62, framing) < 160);
});
