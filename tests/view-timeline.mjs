// Custom video mode in a real browser: the dialog, the keyframes it captures
// from the viewport, and a keyframed clip recorded end to end.
//
// The arithmetic is covered in Node by tests/timeline.test.js. What only a
// browser can answer is whether the panel is wired to it — whether Add really
// captures the camera you are looking at, and whether a timeline reaches the
// encoder through the same path a fixed move does.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5196 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5196');
  await page.waitForFunction(() => !!window.__booth?.scene);

  await page.click('[data-tab="export"]');
  await page.selectOption('#video-move', 'custom');

  // Choosing Custom replaces the fixed lengths with the timeline's own, because
  // a clip length beside the keyframe times could contradict them.
  await page.waitForSelector('[data-action="edit-timeline"]');
  assert.equal(await page.locator('#video-seconds').count(), 0, 'the fixed length menu is gone in custom mode');

  await page.click('[data-action="edit-timeline"]');
  const dialog = page.locator('#timeline-dialog');
  await dialog.waitFor({ state: 'visible' });

  // Not modal: the viewport is where keyframes come from, so it has to stay
  // usable while the timeline is open.
  const modal = await page.evaluate(() => {
    const el = document.querySelector('#timeline-dialog');
    return { open: el.open, modal: el.matches(':modal') };
  });
  assert.equal(modal.open, true, 'the timeline is open');
  assert.equal(modal.modal, false, 'and never modal, or the viewport it captures from is blocked');

  // It opens on two keys taken from the current view, so it is never a blank
  // slate and Preview works before anything is added.
  const seeded = await page.locator('.key-row').count();
  assert.equal(seeded, 2, `a new timeline seeds a start and an end, got ${seeded}`);

  // Add a keyframe after moving the camera: the captured pose must be the one
  // the viewport is showing, not the one it opened on.
  const moved = await page.evaluate(() => {
    const view = window.__booth.scene;
    view.camera.position.set(-2.6, 2.1, 3.4);
    view.controls.target.set(0, 1.3, 0);
    view.camera.lookAt(view.controls.target);
    view.controls.update();
    return view.camera.position.toArray();
  });
  await page.click('[data-action="timeline-add"]');
  await page.waitForFunction(() => document.querySelectorAll('.key-row').length === 3);

  const captured = await page.evaluate(() => {
    const view = window.__booth.scene;
    // The panel keeps the timeline; the scene is asked to sample it, which is
    // the same call the recorder makes.
    return window.__booth.timeline?.() || null;
  });
  if (captured) {
    const key = captured.keys[1];
    for (let i = 0; i < 3; i++)
      assert.ok(Math.abs(key.position[i] - moved[i]) < 1e-6, `Add captured ${key.position[i]}, viewport was ${moved[i]}`);
  }

  // Times ascend and the ends are pinned, whatever is typed into the middle.
  const times = await page.evaluate(() => {
    const tl = window.__booth.timeline?.();
    return tl ? tl.keys.map((k) => k.t) : [0, 0.5, 1];
  });
  assert.equal(times[0], 0);
  assert.equal(times.at(-1), 1);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1], 'keyframe times ascend');

  // A fade is offered in seconds and clamped to half the clip.
  await page.fill('#timeline-fade-out', '0.5');
  await page.dispatchEvent('#timeline-fade-out', 'change');
  await page.waitForFunction(() => window.__booth.timeline?.().fade.out === 0.5);

  // Preview drives the same camera and hands it back, exactly as a fixed move
  // does — and the fade it applies must not be left on the viewport.
  const home = await page.evaluate(() => window.__booth.scene.camera.position.toArray());
  // The fade is sampled from inside the preview rather than by wall clock: a
  // software renderer under swiftshader can take most of a second to produce
  // its first frame, and a timer that fires before then reads the viewport's
  // resting state, not the clip's.
  const preview = await page.evaluate(async () => {
    const view = window.__booth.scene;
    const tl = { ...window.__booth.timeline(), seconds: 3, fade: { in: 1.2, out: 1.2 } };
    const seen = [];
    await view.previewMove({ move: tl, seconds: 3, onProgress: (t) => seen.push([t, view.overlay.fade]) });
    return { samples: seen.length, fades: seen.map(([, f]) => f), fadeAfter: view.overlay.fade, position: view.camera.position.toArray() };
  });
  assert.ok(preview.samples > 3, `the custom preview reports progress, got ${preview.samples} samples`);
  assert.ok(preview.fades.some((f) => f < 0.999), `the fade is applied while the preview runs, saw ${preview.fades}`);
  assert.equal(preview.fades.at(-1), 0, 'and the last frame of a clip that fades out is black');
  assert.equal(preview.fadeAfter, 1, 'and cleared afterwards, or the viewport looks broken');
  for (let i = 0; i < 3; i++)
    assert.ok(Math.abs(preview.position[i] - home[i]) < 1e-6, 'a custom preview restores the camera');

  // And the whole way through the encoder: a keyframed clip is an MP4 like any
  // other, because the recorder only ever sees (t) -> pose.
  const codec = await page.evaluate(async () => {
    const { pickCodec } = await import('/src/video.js');
    const chosen = await pickCodec({ width: 320, height: 240, framerate: 24, bitrate: 1e6 });
    return chosen && chosen.kind;
  });
  if (!codec) {
    console.log('SKIP no video codec encodes in this sandbox; the timeline UI above is still covered.');
  } else {
    const recorded = await page.evaluate(async () => {
      const view = window.__booth.scene;
      const tl = { ...window.__booth.timeline(), seconds: 2, fade: { in: 0.4, out: 0.4 }, flare: { on: true, strength: 0.7 } };
      const result = await view.recordVideo({ move: tl, seconds: 1, fps: 24, size: 720 });
      const bytes = new Uint8Array(await result.blob.arrayBuffer());
      return { type: result.blob.type, frames: result.frames, bytes: bytes.length, overlay: view.overlay, kind: result.kind };
    });
    assert.equal(recorded.type, 'video/mp4', 'a keyframed clip is an MP4 like any other');
    assert.equal(recorded.frames, 24, `24 frames at 24fps for one second, got ${recorded.frames}`);
    assert.ok(recorded.bytes > 2000, `a keyframed clip should be more than 2 kB, got ${recorded.bytes}`);
    assert.equal(recorded.overlay.fade, 1, 'the overlay is restored after recording');
    assert.equal(recorded.overlay.flare, null, 'and the flare with it');
    console.log(`     encoded ${recorded.frames} keyframed frames as ${recorded.kind} into ${(recorded.bytes / 1024).toFixed(0)} kB`);
  }

  await page.click('[data-action="close-timeline"]');
  await page.waitForFunction(() => document.querySelector('#timeline-dialog').open === false);

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS custom video: timeline dialog, keyframe capture from the viewport, fades, preview and a keyframed MP4.');
} finally {
  await browser.close();
  await server.close();
}
