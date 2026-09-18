// Free-standing interior walls, in a real renderer. The node tests pin the
// schema and the clamping; this checks that a panel typed in inches ends up
// standing where it was measured, that art hangs on both of its faces, and
// that removing one takes its meshes and its texture claim with it.
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

const IN = 0.0254;
// Where a wall's mesh actually stands, in metres, and which way it faces.
const wallState = (page, key) => page.evaluate((k) => {
  const scene = window.__booth.scene;
  scene.group.updateMatrixWorld(true);
  const mesh = scene.wallObjects.find((o) => o.userData.wall === k);
  if (!mesh) return null;
  // Read the world matrix directly rather than importing three into the page:
  // 12..14 is the translation, 8..10 the local +Z axis — the face normal.
  const m = mesh.matrixWorld.elements, box = mesh.geometry.parameters;
  return { centre: [m[12], m[13], m[14]], normal: [m[8], m[9], m[10]],
    width: box.width, height: box.height };
}, key);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5196');
  await page.waitForFunction(() => !!window.__booth?.scene);
  await page.click('[data-tab="layout"]');

  // No panels to begin with, and a fresh project says so in its schema.
  assert.deepEqual(await page.evaluate(() => window.__booth.project.booth.panels), [],
    'a new project starts with no free-standing walls');

  await page.locator('[data-action="add-panel"]').click();
  await page.waitForTimeout(400);
  const key = await page.evaluate(() => 'panel:' + window.__booth.project.booth.panels[0].id);

  // Stand it off centre and turn it, then read the mesh back.
  await page.fill(`input[aria-label="Panel 1 Position X"]`, '-24');
  await page.locator('input[aria-label="Panel 1 Position X"]').dispatchEvent('change');
  await page.fill(`input[aria-label="Panel 1 Position Z"]`, '18');
  await page.locator('input[aria-label="Panel 1 Position Z"]').dispatchEvent('change');
  await page.fill(`input[aria-label="Panel 1 Rotation"]`, '90');
  await page.locator('input[aria-label="Panel 1 Rotation"]').dispatchEvent('change');
  await page.waitForTimeout(500);

  const panel = await wallState(page, key);
  assert.ok(panel, 'the panel has a wall mesh of its own');
  // The frame's origin is the bottom-left corner, so the mesh centre is the
  // measured centre at half the panel's height. Turned 90°, the face looks
  // along +X.
  assert.ok(Math.abs(panel.centre[0] - -24 * IN) < 1e-6, 'X is where it was typed');
  assert.ok(Math.abs(panel.centre[2] - 18 * IN) < 1e-6, 'Z is where it was typed');
  assert.ok(Math.abs(panel.centre[1] - panel.height / 2) < 1e-6, 'it stands on the floor');
  assert.ok(Math.abs(panel.normal[0] - 1) < 1e-6, 'turned 90°, the front faces +X');
  assert.ok(Math.abs(panel.normal[2]) < 1e-6, 'and no longer toward the entrance');

  // The perimeter walls are untouched by any of this.
  const back = await wallState(page, 'back');
  assert.ok(Math.abs(back.normal[2] - 1) < 1e-6, 'the back wall still faces the entrance');
  assert.ok(Math.abs(back.centre[2] - (-60 * IN - 0.031)) < 1e-6,
    'and still hangs its slab just outside the footprint line');

  // A panel is interior: it must not move the booth or its neighbours.
  assert.equal(await page.evaluate(() => window.__booth.project.booth.width), 120,
    'a free-standing wall does not change the footprint');

  // Hang art on the panel's back face through the Location dropdown.
  await page.click('[data-tab="art"]');
  await page.locator('.layer-row, [data-art]').first().click().catch(() => {});
  await page.waitForTimeout(200);
  // The Location dropdown must offer the panel by key, both faces.
  const options = await page.evaluate(() =>
    [...document.querySelectorAll('select[aria-label="Wall location"] option')].map((o) => o.value));
  assert.ok(options.includes(key + '-inside') && options.includes(key + '-outside'),
    'the panel is offered as a location, front and back');
  assert.ok(options.includes('back-inside'), 'and the perimeter walls are still offered');

  await page.evaluate((k) => {
    window.__booth.mutate(() => {
      const p = window.__booth.project;
      p.art[0].wall = k;
      p.art[0].face = 'outside';
      p.art[0].x = 2;
      p.art[0].y = 20;
    });
  }, key);
  await page.waitForTimeout(500);
  const hung = await page.evaluate((id) => {
    const scene = window.__booth.scene;
    scene.group.updateMatrixWorld(true);
    const entry = scene.artGroups.get(id);
    if (!entry) return null;
    const m = entry.group.matrixWorld.elements;
    return [m[12], m[13], m[14]];
  }, await page.evaluate(() => window.__booth.project.art[0].id));
  assert.ok(hung, 'art on a panel is built into the scene');
  // The back face looks the other way, so the art sits just behind the panel.
  assert.ok(hung[0] < -24 * IN, 'art on the back face hangs behind the panel');

  // Removing the panel keeps the placement, on the back wall.
  await page.click('[data-tab="layout"]');
  await page.locator('[data-action^="delete-panel-"]').click();
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.__booth.project.art[0].wall), 'back',
    'art on a removed panel moves to the back wall rather than vanishing');
  assert.equal(await wallState(page, key), null, 'the panel mesh is gone');
  assert.equal(
    await page.evaluate(() => [...window.__booth.scene.surfaces.claims.keys()].filter((c) => c.startsWith('wall:panel:')).length),
    0, 'and the panel hands its texture set back');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS free-standing walls: measured placement, both faces, removal keeps the art.');
} finally {
  await browser.close();
  await server.close();
}
