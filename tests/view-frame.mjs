// The export frame in a real browser: the guide over the viewport, moving,
// resizing and reshaping it by its handles and by its sliders, and an export
// rendered from a placed frame. Also the smaller asks of the same round —
// the build stamp in New York time and on a phone, Edit timeline offered
// whatever move is chosen, and a click on nothing landing on Layout.
//
// The arithmetic of placing a frame is covered in Node by
// tests/framing.test.js; this is whether the handles are wired to it.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5221 } });
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
  await page.goto('http://127.0.0.1:5221');
  await page.waitForFunction(() => !!window.__booth?.scene);

  // The build stamp: month, day, hour and minute run together, New York time.
  const stamp = await page.textContent('#build-stamp');
  assert.match(stamp, /· \d{7,8} EST ·/, `the footer stamp reads ${stamp}`);

  // A click on nothing lands on Layout rather than an empty Artwork panel.
  await page.click('[data-tab="art"]');
  const canvas = await page.locator('#scene canvas').boundingBox();
  await page.mouse.click(canvas.x + 20, canvas.y + canvas.height - 90);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__booth.tab), 'layout', 'a click on empty space opens Layout');

  // Edit timeline is offered on a fixed move too, and opening it is choosing Custom.
  await page.click('[data-tab="video"]');
  await page.selectOption('#video-move', 'orbit');
  await page.click('[data-action="edit-timeline"]');
  await page.locator('#timeline-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.inputValue('#video-move'), 'custom', 'the move is now Custom');
  await page.click('#timeline-content [data-action="close-timeline"]');

  // The guide shows the 16:9 clip frame on the Video tab.
  const box = () => page.evaluate(() => {
    const r = document.querySelector('.frame-guide-box').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, hidden: document.querySelector('.frame-guide').hidden };
  });
  const fit = await box();
  assert.equal(fit.hidden, false);
  assert.ok(Math.abs(fit.w / fit.h - 16 / 9) < 0.02, `16:9 guide, got ${fit.w / fit.h}`);

  // A corner resizes and keeps the shape.
  const se = await page.locator('.fg-h[data-fg="se"]').boundingBox();
  await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
  await page.mouse.down();
  await page.mouse.move(se.x - fit.w * 0.4, se.y - fit.h * 0.4, { steps: 6 });
  await page.mouse.up();
  const smaller = await box();
  assert.ok(smaller.w < fit.w * 0.75, `the corner shrinks the frame (${fit.w} -> ${smaller.w})`);
  assert.ok(Math.abs(smaller.w / smaller.h - 16 / 9) < 0.02, 'and keeps it 16:9');
  assert.equal(await page.evaluate(() => window.__booth.frames.video), 'desktop', 'still the widescreen frame');

  // The label moves it.
  const label = await page.locator('.fg-move').boundingBox();
  await page.mouse.move(label.x + 10, label.y + 8);
  await page.mouse.down();
  await page.mouse.move(label.x + 90, label.y + 60, { steps: 6 });
  await page.mouse.up();
  const moved = await box();
  assert.ok(moved.x > smaller.x + 40 && moved.y > smaller.y + 20, 'dragging the label moves the frame');
  assert.ok(Math.abs(moved.w - smaller.w) < 1, 'without resizing it');

  // An edge changes the shape, and the frame becomes a custom size.
  const e = await page.locator('.fg-h[data-fg="e"]').boundingBox();
  await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2);
  await page.mouse.down();
  await page.mouse.move(e.x - moved.w * 0.3, e.y + e.height / 2, { steps: 6 });
  await page.mouse.up();
  const reshaped = await box();
  const frames = await page.evaluate(() => window.__booth.frames);
  assert.equal(frames.video, 'custom', 'an edge drag makes the frame custom');
  assert.ok(Math.abs(frames.custom.width / frames.custom.height - reshaped.w / reshaped.h) < 0.03, 'at the new ratio');

  // The sliders drive the same placement.
  const size = page.locator('[data-frame-place="scale"][data-frame-which="video"]');
  await size.fill('100');
  await size.dispatchEvent('change');
  assert.equal(await page.evaluate(() => window.__booth.framePlace.video.scale), 1, 'Frame size 100% is the full fit');
  await page.click('[data-action="frame-reset-video"]');
  assert.deepEqual(await page.evaluate(() => window.__booth.framePlace.video), { scale: 1, x: 0, y: 0 }, 'reset puts it back');

  // An export from a placed frame renders at the frame's size and leaves the
  // camera's own projection as it found it.
  const result = await page.evaluate(async () => {
    const s = window.__booth.scene;
    const blob = await s.export(1080, { frame: 'square', place: { scale: 0.5, x: 1, y: -1 } });
    const bmp = await createImageBitmap(blob);
    return { w: bmp.width, h: bmp.height, view: s.camera.view?.enabled || false, backdrop: s.backdropCamera?.view?.enabled || false };
  });
  assert.deepEqual([result.w, result.h], [1080, 1080], 'a square still at 1080');
  assert.equal(result.view, false, 'the camera view offset is cleared after an export');

  // The frame persists across a reload, with the other export choices.
  await page.click('[data-tab="export"]');
  await page.selectOption('[data-frame="export"]', 'square');
  const xs = page.locator('[data-frame-place="x"][data-frame-which="export"]');
  await xs.fill('-100');
  await xs.dispatchEvent('change');
  await page.reload();
  await page.waitForFunction(() => !!window.__booth?.scene);
  assert.equal(await page.evaluate(() => window.__booth.framePlace.export.x), -1, 'a placed frame is remembered');

  // On a phone the footer is gone, so the stamp shows in the viewport.
  await page.setViewportSize({ width: 390, height: 800 });
  await page.waitForTimeout(300);
  assert.ok(await page.locator('.scene-label .mobile-stamp').isVisible(), 'the build stamp is visible on a phone');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS export frame: guide, handles, sliders, placed export, build stamp, Edit timeline, click to Layout.');
} finally {
  await browser.close();
  await server.close();
}
