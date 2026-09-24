// The timeline's keyframed frame, sliding end keys, the previous / next
// keyframe arrows, and the batch queue of clips and stills — in a real
// browser. The arithmetic is pinned in Node (tests/timeline.test.js,
// tests/batch.test.js); this checks the panels are wired to it, that the
// queue is saved with the booth, and that a batch of a clip and a still
// really downloads both.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5213 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5213');
  await page.waitForFunction(() => !!window.__booth?.scene);

  await page.click('[data-tab="video"]');
  await page.click('[data-action="edit-timeline"]');
  await page.locator('#timeline-dialog').waitFor({ state: 'visible' });
  const tl = () => page.evaluate(() => window.__booth.videoTimeline);
  const dlg = (sel) => page.locator(`#timeline-content ${sel}`);
  // A short clip with its two keys at different views, so the render below
  // is quick and the move is real.
  await dlg('#timeline-seconds').fill('4');
  await dlg('#timeline-seconds').dispatchEvent('change');
  await page.evaluate(() => {
    const v = window.__booth.scene;
    v.camera.position.set(-2.4, 2, 3.2);
    v.controls.update();
  });
  await dlg('[data-action="timeline-next"]').click();
  await dlg('[data-action="timeline-recapture"]').click();

  // Previous / next keyframe arrows.
  const selected = () => page.evaluate(() => document.querySelector('#timeline-content .tl-key.selected')?.dataset.tlKey);
  let t = await tl();
  assert.equal(await selected(), t.keys[1].id, 'next jumped to the end key');
  await dlg('[data-action="timeline-prev"]').click();
  assert.equal(await selected(), t.keys[0].id, 'previous jumped back to the start');

  // The end key slides inward: typed, as a diamond drag would set it.
  await dlg('[data-action="timeline-next"]').click();
  await dlg('input[data-key-field="t"]').fill('3');
  await dlg('input[data-key-field="t"]').dispatchEvent('change');
  t = await tl();
  assert.ok(Math.abs(t.keys[1].t - 0.75) < 1e-6, `the end key sits at 3 of 4 s, t=${t.keys[1].t}`);
  assert.ok(await dlg('.tl-hold.tl-end').count() >= 1, 'the held tail is drawn on the track');
  assert.equal(await dlg('.tl-key.end').count(), 2, 'both end diamonds are draggable ends');

  // The frame, keyframed: Start low, End high.
  await page.evaluate(() => {
    const el = document.querySelector('#timeline-frame-keys');
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const slide = (key, value) =>
    page.evaluate(([key, value]) => {
      const el = document.querySelector(`#timeline-content [data-frame-place="${key}"]`);
      el.value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, [key, value]);
  await dlg('[data-action="timeline-prev"]').click();
  await slide('scale', 60);
  await slide('y', 100);
  const guideTop = () => page.evaluate(() => document.querySelector('.frame-guide-box').getBoundingClientRect().top);
  const lowTop = await guideTop();
  await dlg('[data-action="timeline-next"]').click();
  await slide('scale', 60);
  await slide('y', -100);
  const highTop = await guideTop();
  t = await tl();
  assert.equal(t.frameKeys, true, 'the frame is keyframed');
  assert.equal(t.keys[0].place.y, 1, 'Start keeps its own frame (low)');
  assert.equal(t.keys[1].place.y, -1, 'End keeps its own (high)');
  assert.ok(lowTop > highTop + 20, `the guide follows the selected key: ${lowTop} vs ${highTop}`);
  // Scrubbing half way puts the frame between the two.
  const track = await dlg('[data-tl-track]').boundingBox();
  await page.mouse.click(track.x + track.width * 0.375, track.y + track.height - 8);
  const mid = await page.evaluate(() => window.__booth.livePlace);
  assert.ok(mid && mid.y > -1 && mid.y < 1, `the scrubbed frame is between the keys: ${JSON.stringify(mid)}`);

  // Presets and the batch, from inside the timeline.
  await dlg('[data-preset-name]').fill('Rise');
  await dlg('[data-action="preset-save"]').click();
  await dlg('[data-action="batch-add-general"]').click();
  await dlg('[data-action="batch-add-still-general"]').click();
  const jobs = () => dlg('.batch-row[data-job]');
  assert.equal(await jobs().count(), 2, 'a clip and a still are queued');
  await dlg('[data-preset] [data-action="preset-apply"]').click();
  let kit = await page.evaluate(() => window.__booth.project.exportKit);
  assert.equal(kit.presets.length, 1);
  assert.equal(kit.queue[0].preset, kit.presets[0].id, 'the clip uses the preset');
  // The general settings reach every item still on them; a tweak is the item's own.
  await dlg('.batch-general summary').click();
  await dlg('select[data-kit-default="fps"]').selectOption('24');
  await dlg('select[data-kit-default="size"]').selectOption('720');
  await dlg('select[data-kit-default="long"]').selectOption('1080');
  let labels = await jobs().locator('strong').allTextContents();
  assert.match(labels[0], /Preset “Rise” · 4s · 24 fps · 720p/, labels[0]);
  assert.match(labels[1], /Still · 1080 px/, labels[1]);
  await dlg('.batch-row[data-job] .job-tweak summary').first().click();
  await dlg('.batch-row[data-job] select[data-job-set="fps"]').first().selectOption('30');
  assert.equal(await dlg('.batch-row[data-job] .job-tweak').first().evaluate((d) => d.open), true, 'the tweak panel stays open through a redraw');
  await dlg('select[data-kit-default="fps"]').selectOption('60');
  labels = await jobs().locator('strong').allTextContents();
  assert.match(labels[0], /30 fps/, 'a tweaked item keeps its own frame rate');

  // An undo of a booth edit leaves the queue alone.
  await page.evaluate(() => document.querySelector('[data-action="undo"]').click());
  kit = await page.evaluate(() => window.__booth.project.exportKit);
  assert.equal(kit.queue.length, 2, 'undo did not un-queue');

  // Export all: one MP4 and one PNG.
  const files = [];
  page.on('download', (d) => files.push(d.suggestedFilename()));
  await dlg('[data-action="batch-export"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-action="cancel-video"]'), null, { timeout: 240000 });
  await page.waitForTimeout(300);
  assert.equal(files.length, 2, `two files downloaded: ${files.join(', ')}`);
  assert.ok(files.some((f) => /-01-rise\.mp4$/.test(f)) && files.some((f) => /-02-still\.png$/.test(f)), files.join(', '));

  // Saved with the booth: a reload keeps the queue and the preset.
  await page.waitForTimeout(800);
  await page.reload();
  await page.waitForFunction(() => !!window.__booth?.scene);
  kit = await page.evaluate(() => window.__booth.project.exportKit);
  assert.equal(kit?.queue?.length, 2, 'the queue survived a reload');
  assert.equal(kit?.presets?.[0]?.name, 'Rise', 'and the preset');

  assert.deepEqual(errors, [], 'no page errors');
  console.log(`PASS batch and keyframed frame: prev/next, a slid end key, a keyframed frame the guide follows, presets, general settings and tweaks, and a batch of ${files.join(' + ')}.`);
} finally {
  await browser.close();
  await server.close();
}
