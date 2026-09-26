// The twelfth round in a real browser: Add booths grows the floor to take a
// block that runs off it; a sale on a booth number no longer on the floor is
// listed and moved; floor templates ride in a project backup and come back
// from one; and a figure is turned round with one click on Flip.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5236 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5236');
  await page.waitForFunction(() => !!window.__booth?.scene);
  await page.evaluate(() => localStorage.setItem('booth.sectionTabs', 'off'));
  await page.click('[data-action="mode-show"]');
  await page.waitForSelector('#show-floor [data-hall-booth]');
  const hall = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__booth.project.hall)));

  // ---- Add booths grows the floor ----------------------------------------------
  const before = await hall();
  await page.click('[data-action="show-add-block"]');
  let h = await hall();
  assert.ok(h.items.length > before.items.length, 'booths were added');
  assert.ok(h.venue.depth > before.venue.depth, 'and the floor grew to take them');
  assert.equal(await page.locator('[data-action="show-grow"]').count(), 0, 'so nothing is left off the floor');
  await page.keyboard.press('Control+z');
  h = await hall();
  assert.equal(h.items.length, before.items.length, 'one undo takes the block back');
  assert.equal(h.venue.depth, before.venue.depth, 'and the growth with it');

  // ---- A sale left behind is listed and moved ----------------------------------
  const free = h.items.find((i) => i.kind === 'booth' && !(h.booths[i.number]?.name)).number;
  await page.evaluate(() => window.__booth.mutate(() => (window.__booth.project.hall.booths[9001] = { status: 'sold', name: 'Left Behind', price: 700 })));
  await page.waitForSelector('[data-orphan="9001"]');
  assert.match(await page.textContent('[data-orphan="9001"]'), /Sold · Left Behind · \$700/);
  await page.selectOption('[data-orphan-to="9001"]', String(free));
  await page.click('[data-action="hall-orphan-move-9001"]');
  h = await hall();
  assert.equal(h.booths[free].name, 'Left Behind', 'the sale is on a floor booth now');
  assert.equal(h.booths[9001], undefined);
  assert.equal(await page.locator('[data-orphan]').count(), 0, 'and the list is gone');
  await page.evaluate(() => window.__booth.mutate(() => (window.__booth.project.hall.booths[9002] = { status: 'held', name: 'Gone' })));
  await page.click('[data-action="hall-orphan-forget-9002"]');
  await page.click('#confirm-go');
  assert.equal((await hall()).booths[9002], undefined, 'Forget drops it');

  // ---- Floor templates ride in a backup ----------------------------------------
  await page.click('[data-action="show-save-template"]');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('booth.floorTemplates')));
  assert.equal(saved.length, 1);
  await page.click('[data-action="show-exit"]');
  await page.click('[data-tab="export"]');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="backup"]')]);
  const file = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.deepEqual(file.floorTemplates, saved, 'the backup carries the templates');
  await page.evaluate(() => localStorage.setItem('booth.floorTemplates', '[]'));
  await page.setInputFiles('#backup-input', { name: 'b.booth.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.click('#confirm-go');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('booth.floorTemplates') || '[]').length === 1);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('booth.floorTemplates'))), saved, 'opening it brings them back');
  assert.equal(await page.evaluate(() => 'floorTemplates' in window.__booth.project), false, 'and they stay out of the project');
  // An older backup, with no templates, still opens.
  delete file.floorTemplates;
  await page.setInputFiles('#backup-input', { name: 'old.booth.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.click('#confirm-go');
  await page.waitForFunction(() => /restored/.test(document.body.textContent));

  // ---- Flip a figure -----------------------------------------------------------
  await page.click('[data-tab="layout"]');
  await page.click('[data-action="add-woman"]');
  const facing = () => page.evaluate(() => window.__booth.project.booth.people.at(-1).rotation);
  assert.equal(await facing(), 180);
  await page.locator('.person-row').last().locator('[data-action="flip-person"]').click();
  assert.equal(await facing(), 0, 'Flip turns her round');
  await page.locator('.person-row').last().locator('[data-action="flip-person"]').click();
  assert.equal(await facing(), 180, 'and back');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS Add booths grows the floor (one undo), a left-behind sale is listed, moved and forgotten, floor templates ride in a backup and come back from one, and Flip turns a figure round.');
} finally {
  await browser.close();
  await server.close();
}
