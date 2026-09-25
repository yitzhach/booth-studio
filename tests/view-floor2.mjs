// The show floor's later additions in a real browser: a piece off the floor
// is flagged and the floor grows to fit it; the drape colour is chosen; a
// floor is saved as a template, started from and removed.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5235 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5235');
  await page.waitForFunction(() => !!window.__booth?.scene);
  await page.evaluate(() => localStorage.setItem('booth.sectionTabs', 'off'));
  await page.click('[data-action="mode-show"]');
  await page.waitForSelector('#show-floor [data-hall-booth]');
  const hall = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__booth.project.hall)));

  // ---- Off the floor, then grown to fit --------------------------------------
  assert.equal(await page.locator('[data-action="show-grow"]').count(), 0, 'no warning while everything is on the floor');
  await page.evaluate(() => window.__booth.mutate(() => (window.__booth.project.hall.venue.depth = 240)));
  await page.waitForSelector('[data-action="show-grow"]');
  assert.match(await page.textContent('.warning'), /off the floor's edge/);
  await page.click('[data-action="show-grow"]');
  let h = await hall();
  assert.ok(h.venue.depth > 240, 'the floor grew');
  assert.equal(await page.locator('[data-action="show-grow"]').count(), 0, 'and the warning went');
  await page.keyboard.press('Control+z');
  assert.equal((await hall()).venue.depth, 240, 'undo puts it back');
  await page.click('[data-action="show-grow"]');

  // ---- Drape colour ------------------------------------------------------------
  await page.selectOption('[data-show-venue="drape"]', '#1f2226');
  assert.equal((await hall()).venue.drape, '#1f2226');

  // ---- Save the floor as a template, change the floor, start from it ----------
  const saved = await hall();
  await page.click('[data-action="show-save-template"]');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('booth.floorTemplates')));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].items.length, saved.items.length);
  const mine = page.locator('[data-action^="show-mytemplate-"]');
  assert.equal(await mine.count(), 1, 'the saved floor is offered');
  await page.click('[data-action="show-template-pavilion"]');
  await page.click('#confirm-go');
  assert.notEqual((await hall()).items.length, saved.items.length, 'a built-in template replaced it');
  await mine.click();
  await page.click('#confirm-go');
  h = await hall();
  assert.deepEqual(h.items, saved.items, 'my template brings back every piece');
  assert.deepEqual(h.venue, saved.venue, 'and the floor, drape and all');
  await page.click('[data-action^="show-forget-template-"]');
  assert.equal(await mine.count(), 0);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('booth.floorTemplates'))), []);

  // ---- It all survives a reload ------------------------------------------------
  await page.evaluate(() => window.__booth.save());
  await page.reload();
  await page.waitForFunction(() => !!window.__booth?.scene);
  assert.equal(await page.evaluate(() => window.__booth.project.hall.venue.drape), '#1f2226');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS pieces off the floor are flagged and the floor grows to fit (undoably), the drape colour is chosen and kept, and a floor is saved as a template, started from and removed.');
} finally {
  await browser.close();
  await server.close();
}
