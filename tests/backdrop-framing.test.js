import test from "node:test";
import assert from "node:assert/strict";

// backdropFov lives in scene.js, which imports three and touches the DOM at
// module scope, so the rule is restated here the way render-scale.test.js
// restates renderScale. What matters is that it is pinned: the bug it fixes is
// a judgement about how a photograph reads on screen, which no one can see in
// a diff.
const BACKDROP_FRAMING = 65;
// Restated here for the same reason, and pinned for a stronger one: the lock is
// the difference between a horizon nailed to the floor and one that slides.
const lockedPitch = (pitch, fov, wideFov) => {
  const narrow = Math.tan((Math.min(179, Math.max(1, fov)) * Math.PI) / 360);
  const wide = Math.tan((Math.min(179, Math.max(1, wideFov)) * Math.PI) / 360);
  if (!(narrow > 0) || !(wide > 0)) return pitch;
  const clamped = Math.min(Math.PI / 2.2, Math.max(-Math.PI / 2.2, pitch));
  return Math.atan(Math.tan(clamped) * (wide / narrow));
};
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

// Horizon lock. The backdrop is drawn through a wider lens than the booth, so
// the same pitch moves the two by different amounts on screen and the
// photographed horizon slides against the floor. lockedPitch is the correction.
test("the locked backdrop lands a pitched direction where the camera's own lens would", () => {
  const fov = 62;
  const wide = backdropFov(fov, 40);
  const screen = (angle, lens) => Math.tan(angle) / Math.tan((lens * Math.PI) / 360);
  for (const degrees of [-30, -12, -3, 0, 5, 18, 34]) {
    const pitch = (degrees * Math.PI) / 180;
    const corrected = lockedPitch(pitch, fov, wide);
    assert.ok(
      Math.abs(screen(corrected, wide) - screen(pitch, fov)) < 1e-9,
      `${degrees}° lands at ${screen(corrected, wide)} instead of ${screen(pitch, fov)}`,
    );
  }
});

test("locking over-rotates, because the wider lens compresses the same angle", () => {
  const wide = backdropFov(62, 40);
  assert.ok(lockedPitch(0.3, 62, wide) > 0.3);
  assert.ok(lockedPitch(-0.3, 62, wide) < -0.3);
  assert.equal(lockedPitch(0, 62, wide), 0, "level stays level");
});

test("a backdrop at 100% framing is the camera's own lens, so the lock is a no-op", () => {
  const same = backdropFov(62, 100);
  for (const pitch of [-0.4, 0, 0.25])
    assert.ok(Math.abs(lockedPitch(pitch, 62, same) - pitch) < 1e-9);
});

test("no pitch can fold the backdrop over", () => {
  const wide = backdropFov(62, 25);
  for (const pitch of [-3, -Math.PI / 2, -1.2, 1.2, Math.PI / 2, 3]) {
    const corrected = lockedPitch(pitch, 62, wide);
    assert.ok(Number.isFinite(corrected), `pitch ${pitch} produced ${corrected}`);
    assert.ok(Math.abs(corrected) < Math.PI / 2, "and stays in front of the lens");
    assert.equal(Math.sign(corrected), Math.sign(pitch) || 0, "and never flips direction");
  }
});
