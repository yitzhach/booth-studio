// Looks and Make it beautiful in a real browser (src/polish.js): the button
// hangs every wall on the 60″ line and aims a light at the work in one undo
// step, a look stands the booth in its environment, the Environment picker
// still follows the same rule, and Photo mode offers neither.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5254 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
const shots = process.env.POLISH_SHOTS;

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await page.addInitScript(() => localStorage.setItem('booth.role', 'all')); // past the first visit's welcome (src/roles.js)
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5254');
  await page.waitForFunction(() => !!window.__booth?.scene);
  const project = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__booth.project)));
  const before = await project();
  if (shots) await page.screenshot({ path: `${shots}/polish-before.png` });

  // --- Make it beautiful, from the Lighting tab.
  await page.click('[data-tab="lighting"]');
  assert.ok(await page.locator('#inspector-content .look-grid button').count() >= 4, 'the looks are offered');
  await page.click('#inspector-content [data-action="polish"]');
  await page.waitForTimeout(400);
  let p = await project();
  assert.equal(p.booth.envPreset, 'studio', "the outdoor booth without a canopy gets the gallery look");
  assert.equal(p.lights.length, 4, 'six works on three walls: four lights');
  for (const a of p.art) assert.ok(Math.abs(a.y + a.h / 2 - 60) < 0.01, `${a.title} on the 60″ line`);
  for (const l of p.lights) assert.ok(l.y > l.ty && Math.abs(l.x) <= 54 && Math.abs(l.z) <= 54, 'a light above its work, inside the booth');
  assert.match(await page.locator('#toast').textContent(), /Gallery white · 3 walls hung evenly · 4 spotlights aimed/);
  if (shots) await page.screenshot({ path: `${shots}/polish-after.png` });

  // --- One undo puts every part of it back.
  await page.click('[data-action="undo"]');
  await page.waitForTimeout(300);
  p = await project();
  assert.deepEqual(p.lights, before.lights, 'the lights are back');
  assert.deepEqual(p.art.map((a) => [a.x, a.y]), before.art.map((a) => [a.x, a.y]), 'the hang is back');

  // --- A look: the fair brings its floor and horizon and colours the lights.
  await page.click('[data-tab="lighting"]');
  await page.click('[data-action="look-fair"]');
  await page.waitForTimeout(300);
  p = await project();
  assert.equal(p.booth.envPreset, 'artfair');
  assert.equal(p.booth.ground, 'grass');
  assert.equal(p.booth.horizon, 'open');
  assert.ok(p.lights.every((l) => l.kelvin === 5000));
  // The look the booth is in is marked, and only until a value of it is changed by hand.
  const marked = () => page.locator('#inspector-content .look-grid button.active').evaluateAll((els) => els.map((el) => el.dataset.action));
  assert.deepEqual(await marked(), ['look-fair']);
  await page.click('[data-action="warm"]');
  await page.waitForTimeout(300);
  assert.deepEqual(await marked(), [], 'Warm changes the light by hand: the booth is in no look');

  // --- The Environment picker (Layout) follows the same rule.
  await page.click('[data-tab="layout"]');
  await page.selectOption('#inspector-content select[data-field="envPreset"]', 'warehouse');
  await page.waitForTimeout(300);
  p = await project();
  assert.equal(p.booth.ground, 'concrete', "the picker still brings the preset's floor");

  // --- Export offers it too; Photo mode offers neither.
  await page.click('[data-tab="export"]');
  assert.ok(await page.locator('#inspector-content [data-action="polish"]').count(), 'Export has the button');
  await page.click('[data-action="mode-photo"]');
  await page.waitForTimeout(300);
  await page.click('[data-tab="lighting"]');
  assert.equal(await page.locator('#inspector-content .look-grid').count(), 0, 'no looks for a photograph');
  await page.click('[data-tab="export"]');
  assert.equal(await page.locator('#inspector-content [data-action="polish"]').count(), 0);
  await page.click('[data-action="mode-3d"]');

  // --- The hero set: four named stills from their own cameras, then the
  // orbit. The 15 s clip is 450 frames, too slow under swiftshader to wait
  // for, so it is cancelled once the stills are down — which also proves a
  // cancel keeps what was written.
  await page.click('[data-tab="export"]');
  const files = [];
  page.on('download', (d) => files.push(d.suggestedFilename()));
  const poseBefore = await page.evaluate(() => JSON.stringify(window.__booth.scene.pose()));
  await page.click('#inspector-content [data-action="hero-export"]');
  await page.waitForFunction(() => document.querySelectorAll('#inspector-content [data-action="cancel-video"]').length, null, { timeout: 30000 });
  const deadline = Date.now() + 240000;
  while (files.filter((f) => f.endsWith('.png')).length < 4 && Date.now() < deadline) await page.waitForTimeout(250);
  assert.deepEqual(files.filter((f) => f.endsWith('.png')).map((f) => f.replace(/^.*?-(\d\d-)/, '$1')), ['01-front.png', '02-three-quarter.png', '03-aisle.png', '04-close-up.png']);
  await page.click('#inspector-content [data-action="cancel-video"]');
  await page.waitForFunction(() => !document.querySelector('#inspector-content [data-action="cancel-video"]'), null, { timeout: 60000 });
  assert.match(await page.locator('#toast').textContent(), /Cancelled after 4 items/);
  assert.equal(await page.evaluate(() => JSON.stringify(window.__booth.scene.pose())), poseBefore, 'the view on screen is not moved');

  // --- Tool search finds it by name.
  await page.fill('#tool-search', 'Make it beautiful');
  assert.ok(await page.locator('#tool-results li').count(), 'tool search lists it');

  assert.deepEqual(errors, []);
  console.log('PASS Make it beautiful hangs every wall on 60″ and aims four lights in one undo; a look brings its environment, floor and light colour; the picker keeps the same rule; Photo mode has neither; the hero set writes front, three-quarter, aisle and close-up stills from their own cameras and a cancel keeps them.');
} finally {
  await browser.close();
  await server.close();
}
