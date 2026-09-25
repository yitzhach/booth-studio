// Phase 3 of the show floor in a real browser: a floor booth opened as a full
// design sized from its piece, edited, parked when another is opened, drawn
// in full in the 3D show, brought back, undone, kept through a reload; and a
// floor started from a saved template.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5232 } });
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
  await page.goto('http://127.0.0.1:5232');
  await page.waitForFunction(() => !!window.__booth?.scene);
  const project = () => page.evaluate(() => JSON.parse(JSON.stringify({ booth: window.__booth.project.booth, art: window.__booth.project.art.length, hall: window.__booth.project.hall })));
  const firstArt = await page.evaluate(() => window.__booth.project.art.length);
  const firstColour = (await project()).booth.color;

  // ---- A floor booth opened as a new design -------------------------------
  await page.click('[data-action="mode-show"]');
  // Booth 103 made a 20′ booth first: the design opens at that size.
  await page.locator('#show-floor [data-hall-booth="103"]').click();
  await page.fill('[data-show-field="w"]', '240');
  await page.press('[data-show-field="w"]', 'Enter');
  await page.locator('#show-floor [data-hall-booth="103"]').click();
  assert.match(await page.textContent('.show-design'), /new design/, 'the panel says what Open does');
  await page.click('[data-action="show-open-booth"]');
  let s = await project();
  assert.equal(await page.locator('#scene').isVisible(), true, 'the booth editor opens');
  assert.equal(await page.locator('#show-floor').isVisible(), false);
  assert.equal(s.hall.open, 103);
  assert.equal(s.booth.width, 240, 'sized from its piece');
  assert.equal(s.art, 0, 'a new design has no work on it yet');
  assert.ok(s.hall.designs['0'], 'the booth I had is parked');
  assert.equal(s.hall.designs['0'].art.length, firstArt);
  assert.match(await page.textContent('#scene-title'), /Booth 103/, 'the title says which booth is open');

  // Edited: a colour of its own.
  await page.evaluate(() => window.__booth.mutate(() => (window.__booth.project.booth.color = '#aa3355')));

  // ---- Seen in the 3D show, in full, where booth 103 stands --------------
  await page.click('[data-action="mode-show"]');
  await page.click('[data-action="show-3d"]');
  const full = await page.evaluate(() => {
    const s = window.__booth.scene;
    let o = s.frames.back;
    while (o && o.name !== 'offstage') o = o.parent;
    return { onStage: !!s.frames.back && !o, width: s.p.booth.width };
  });
  assert.ok(full.onStage && full.width === 240, 'booth 103 is drawn as its design in the 3D show');
  await page.screenshot({ path: '/tmp/linked-3d.png' });
  await page.click('[data-action="show-3d"]');

  // ---- Another booth: 103 is parked, and comes back as it was ---------------
  await page.locator('#show-floor [data-hall-booth="105"]').click();
  await page.click('[data-action="show-open-booth"]');
  s = await project();
  assert.equal(s.hall.open, 105);
  assert.equal(s.hall.designs['103'].booth.color, '#aa3355', "103's design is kept with it");
  await page.click('[data-action="mode-show"]');
  await page.locator('#show-floor [data-hall-booth="103"]').click();
  assert.match(await page.textContent('.show-design'), /its own design/);
  await page.click('[data-action="show-open-booth"]');
  s = await project();
  assert.equal(s.booth.color, '#aa3355', '103 opens as it was left');
  assert.ok(s.hall.designs['105'] && !s.hall.designs['103']);

  // ---- Undo puts the last open back ------------------------------------------
  await page.keyboard.press('Control+z');
  s = await project();
  assert.equal(s.hall.open, 105, 'undo reopens the booth open before');

  // ---- Renumbering carries a design ---------------------------------------------
  await page.click('[data-action="mode-show"]');
  await page.locator('#show-floor [data-hall-booth="103"]').click();
  await page.fill('[data-show-field="number"]', '303');
  await page.press('[data-show-field="number"]', 'Enter');
  s = await project();
  assert.ok(s.hall.designs['303'] && !s.hall.designs['103'], 'a typed number takes the design with it');

  // ---- My own booth, back --------------------------------------------------------
  await page.keyboard.press('Escape');
  await page.click('[data-action="show-open-own"]');
  s = await project();
  assert.equal(s.hall.open, undefined, 'back on my own booth');
  assert.equal(s.booth.color, firstColour);
  assert.equal(s.art, firstArt, 'with all its work');

  // ---- Through a reload -------------------------------------------------------------
  await page.evaluate(() => window.__booth.save());
  await page.reload();
  await page.waitForFunction(() => !!window.__booth?.scene);
  s = await project();
  assert.deepEqual(Object.keys(s.hall.designs).sort(), ['105', '303'], 'linked designs survive a reload');

  // ---- A template ---------------------------------------------------------------------
  await page.click('[data-action="mode-show"]');
  await page.click('[data-action="show-template-convention"]');
  await page.click('#confirm-go');
  s = await project();
  assert.equal(s.hall.items.filter((i) => i.kind === 'booth').length, 59, 'the convention hall: perimeter and islands');
  assert.deepEqual([s.hall.venue.width, s.hall.venue.depth], [1800, 1200]);
  assert.deepEqual(Object.keys(s.hall.designs).sort(), ['105', '303'], 'designs stay with their numbers');
  await page.screenshot({ path: '/tmp/template-convention.png' });
  await page.click('[data-action="show-3d"]');
  await page.screenshot({ path: '/tmp/template-convention-3d.png' });
  await page.click('[data-action="show-3d"]');
  await page.click('[data-action="show-template-street"]');
  await page.click('#confirm-go');
  s = await project();
  assert.equal(s.hall.venue.kind, 'outdoor');
  await page.keyboard.press('Control+z');
  assert.equal((await project()).hall.venue.width, 1800, 'undo brings the last floor back');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS a floor booth opens as a design sized from its piece, shows in full in the 3D show, is parked and reopened as it was, follows undo and a renumber, gives way to my own booth again, survives a reload, and floors start from templates.');
} finally {
  await browser.close();
  await server.close();
}
