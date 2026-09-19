// What a click costs, what a slider does, and what an art-show booth looks
// like in a photographed environment. All three were reported from a real
// machine: selecting a work was slow to show its handles, dragging was not
// smooth, and an indoor booth put a white band across the hall behind it.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5198 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});

// revision counts scene rebuilds: update() disposes the group and increments
// it. It is the measure that matters here — a rebuild is the expensive thing,
// and a click must not cause one.
const revision = (page) => page.evaluate(() => window.__booth.scene.revision);
const handles = (page) => page.evaluate(() => window.__booth.scene.resizeHandles.length);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5198');
  await page.waitForFunction(() => !!window.__booth?.scene);
  await page.waitForTimeout(400);

  // ---- Selecting costs no rebuild ---------------------------------------
  const first = await page.evaluate(() => window.__booth.project.art[1].id);
  const before = await revision(page);
  await page.evaluate((id) => window.__booth.scene.onSelect(id), first);
  await page.waitForTimeout(250);
  assert.equal(await revision(page), before, 'selecting a work rebuilds nothing');
  assert.equal(await page.evaluate(() => window.__booth.project.art.find((a) => a.id === window.__booth.scene.selected)?.id), first);
  assert.ok(await page.evaluate(() => !!window.__booth.scene.selectionEdge), 'the selected work is outlined');
  assert.equal(await handles(page), 0, 'a plain selection has no scale handles');

  // Double-clicking arms the transform: the eight handles appear, still with
  // no rebuild. This is the gesture that was reported as slow.
  await page.evaluate((id) => {
    const s = window.__booth.scene;
    s.scaleId = id;
    s.setSelection(id, null, null);
  }, first);
  assert.equal(await revision(page), before, 'arming the handles rebuilds nothing');
  assert.equal(await handles(page), 8, 'eight scale handles');
  assert.ok(await page.evaluate(() => window.__booth.scene.resizeHandles.every((h) => h.parent)),
    'every handle is in the scene, not orphaned');

  // Selecting away disposes the outline and the handles rather than stacking
  // a second set on the next click.
  const second = await page.evaluate(() => window.__booth.project.art[0].id);
  await page.evaluate((id) => window.__booth.scene.onSelect(id), second);
  await page.waitForTimeout(200);
  assert.equal(await handles(page), 0, 'the previous work\'s handles are gone');
  assert.equal(await page.evaluate(() => window.__booth.scene.selectionObjects.length), 1,
    'one outline, not one per click');
  assert.equal(await revision(page), before, 'and still no rebuild');

  // ---- The artwork position sliders -------------------------------------
  await page.click('[data-tab="art"]');
  const slider = page.locator('input[aria-label="Slide left / right slider"]');
  assert.equal(await slider.count(), 1, 'the selected work has a left/right slider');
  const startX = await page.evaluate((id) => window.__booth.project.art.find((a) => a.id === id).x, second);
  // fill() on a range dispatches input and then change, which is one
  // gesture — the same shape as a drag: many inputs, one change at the end.
  await slider.fill(String(Math.round(startX + 12)));
  await page.waitForTimeout(150);
  const moved = await page.evaluate((id) => window.__booth.project.art.find((a) => a.id === id), second);
  assert.ok(Math.abs(moved.x - (startX + 12)) < 0.6, `the slider moves the work: ${startX} -> ${moved.x}`);
  // The number field beside it is the same edit, so it has to follow.
  assert.ok(Math.abs(Number(await page.locator('input[data-scope="art"][data-field="x"]').inputValue()) - moved.x) < 0.01,
    'the typed field follows the slider');
  // A slider gesture is one undo step, and it does not rebuild the scene.
  assert.equal(await revision(page), before, 'a slider move rebuilds nothing');
  // Undo from the page rather than from inside the input, the way a hand on
  // a mouse would: the keydown handler ignores keys typed into a field.
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(150);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(250);
  assert.ok(Math.abs(await page.evaluate((id) => window.__booth.project.art.find((a) => a.id === id).x, second) - startX) < 0.01,
    'one undo returns the work to where the gesture started');

  // The vertical slider is bounded by the wall, not by the schema's 360.
  const up = page.locator('input[aria-label="Slide up / down slider"]');
  assert.equal(await up.count(), 1);
  assert.ok(Number(await up.getAttribute('max')) <= 144, 'the travel is the wall, not 360 inches');

  // ---- An art-show booth in a photographed environment ------------------
  await page.click('[data-tab="show"]');
  await page.getByLabel('Venue').selectOption('artshow');
  await page.waitForTimeout(700);
  assert.ok(await page.evaluate(() => !!window.__booth.scene.group.getObjectByName('exhibition-hall')),
    'an art-show booth opens in its own hall');

  await page.click('[data-tab="layout"]');
  await page.selectOption('select[aria-label="Environment"]', 'tradeshow');
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => window.__booth.project.booth.hall.on), false,
    'choosing a photographed environment switches the hall off');
  assert.equal(await page.evaluate(() => !!window.__booth.scene.group.getObjectByName('exhibition-hall')), false,
    'and its white walls are out of the frame');
  // The booth itself is untouched: this is the room, not the booth.
  assert.equal(await page.evaluate(() => window.__booth.project.booth.venue), 'artshow');
  assert.equal(await page.evaluate(() => window.__booth.project.booth.lightBar.on), true,
    'the light bar is still overhead');
  assert.ok(await page.evaluate(() => !!window.__booth.scene.group.getObjectByName('light-bar')));

  // And it comes back from the Layout panel, where the environment was chosen.
  const hallToggle = page.locator('input[data-scope="hall"][data-field="on"]').first();
  assert.equal(await hallToggle.count(), 1, 'the hall is switchable where the environment is');
  await hallToggle.check();
  await page.waitForTimeout(600);
  assert.ok(await page.evaluate(() => !!window.__booth.scene.group.getObjectByName('exhibition-hall')),
    'the hall comes back on request');

  // ---- The light bar is adjustable from Lighting ------------------------
  await page.click('[data-tab="lighting"]');
  const diffusion = page.locator('input[data-scope="lightBar"][data-field="diffusion"]');
  const power = page.locator('input[data-scope="lightBar"][data-field="power"]');
  assert.equal(await diffusion.count(), 1, 'diffusion is in the Lighting tool too');
  assert.equal(await power.count(), 1, 'and so is the bar\'s brightness');
  await power.fill('150');
  await power.dispatchEvent('change');
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__booth.project.booth.lightBar.power), 150);
  await diffusion.fill('0');
  await diffusion.dispatchEvent('change');
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__booth.project.booth.lightBar.diffusion), 0);

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS selecting rebuilds nothing, artwork sliders, hall off in a photographed environment, light bar in Lighting.');
} finally {
  await browser.close();
  await server.close();
}
