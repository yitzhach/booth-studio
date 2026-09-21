// The finishing controls in a real renderer: the drawn drop shadow, a hidden
// spotlight, the universal edge colour, the saved palette and the export
// frame. Every one of them was asked for after looking at a booth, so what
// these check is that each control reaches the scene rather than only the
// project — a setting that changes a number and not a picture is the failure
// mode all five share.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5203 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});

const shadows = (page) =>
  page.evaluate(() => {
    const out = [];
    window.__booth.scene.group.traverse((o) => {
      if (o.userData.artShadow) out.push({ id: o.userData.artShadow, opacity: o.material.opacity, y: o.position.y, x: o.position.x });
    });
    return out;
  });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5203');
  await page.waitForFunction(() => !!window.__booth?.scene);

  // --- A shadow behind every hung work, on by default.
  const placed = await page.evaluate(() => window.__booth.project.art.length);
  const first = await shadows(page);
  assert.equal(first.length, placed, 'every hung work has a shadow card behind it');
  assert.ok(first.every((s) => s.opacity > 0 && s.y < 0), 'each one is visible and falls below the work');

  // --- The three sliders, each doing what its label says.
  await page.click('[data-tab="lighting"]');
  const slider = (key) => page.locator(`input[type=range][data-field="${key}"][data-scope="dropShadow"]`);
  await slider('darkness').fill('90');
  await slider('darkness').dispatchEvent('change');
  await page.waitForTimeout(400);
  const darker = await shadows(page);
  assert.ok(darker[0].opacity > first[0].opacity, 'darker is darker');

  await slider('distance').fill('100');
  await slider('distance').dispatchEvent('change');
  await page.waitForTimeout(400);
  const further = await shadows(page);
  assert.ok(Math.abs(further[0].y) > Math.abs(darker[0].y), 'further is thrown further');

  // --- And off is off, which is what says the gap is the shadow's doing.
  await page.getByLabel('Shadow behind hung work').uncheck();
  await page.waitForTimeout(400);
  assert.deepEqual(await shadows(page), [], 'switching it off leaves nothing behind');
  await page.getByLabel('Shadow behind hung work').check();
  await page.waitForTimeout(400);
  assert.ok((await shadows(page)).length === placed, 'and it comes back');

  // --- A wall gap is what sizes one, which is the whole reported bug.
  await page.evaluate(() => window.__booth.mutate(() => (window.__booth.project.art[0].offset = 4)));
  await page.waitForTimeout(500);
  const deep = await shadows(page);
  const target = await page.evaluate(() => window.__booth.project.art[0].id);
  const gapped = deep.find((s) => s.id === target);
  const flush = deep.find((s) => s.id !== target);
  assert.ok(Math.abs(gapped.y) > Math.abs(flush.y), 'a work stood 4in off the wall throws a deeper shadow than one at 0.75in');

  // --- Hiding a spotlight rather than deleting it.
  const lit = await page.evaluate(() => {
    let spots = 0;
    window.__booth.scene.group.traverse((o) => {
      if (o.isSpotLight) spots += 1;
    });
    return spots;
  });
  await page.locator('[data-light-eye="0"]').click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    let spots = 0;
    window.__booth.scene.group.traverse((o) => {
      if (o.isSpotLight) spots += 1;
    });
    return { spots, lights: window.__booth.project.lights.length, aim: window.__booth.project.lights[0] };
  });
  assert.equal(after.spots, lit - 1, 'the hidden spotlight is not built');
  assert.equal(after.lights, 2, 'but it is still in the list');
  assert.equal(after.aim.on, false);
  assert.ok(Number.isFinite(after.aim.tx) && after.aim.power > 0, 'with its aim and its power kept');
  await page.locator('[data-light-eye="0"]').click();
  await page.waitForTimeout(500);
  assert.equal(
    await page.evaluate(() => {
      let spots = 0;
      window.__booth.scene.group.traverse((o) => { if (o.isSpotLight) spots += 1; });
      return spots;
    }),
    lit,
    'and the eye puts it back',
  );

  // --- The universal edge colour, and the palette under the swatch.
  await page.evaluate(() => window.__booth.mutate(() => (window.__booth.project.art[0].edgeColor = '#112233')));
  await page.click('[data-tab="art"]');
  await page.getByLabel('Universal edge colour for every work').check();
  const universal = page.locator('input[type=color][data-field="edgeColor"][data-scope="booth"]');
  await page.waitForTimeout(300);
  await universal.fill('#aa3322');
  await universal.dispatchEvent('change');
  await page.waitForTimeout(600);
  const painted = await page.evaluate(() => {
    const out = [];
    window.__booth.scene.group.traverse((o) => {
      // The box is the work's edges; the plane in front of it is the image.
      if (o.userData.artId && o.geometry?.type === 'BoxGeometry') out.push('#' + o.material.color.getHexString());
    });
    return out;
  });
  assert.ok(painted.length > 1 && painted.every((c) => c === '#aa3322'), `every work takes the universal colour, got ${painted.join(' ')}`);
  assert.equal(
    await page.evaluate(() => window.__booth.project.art[0].edgeColor),
    '#112233',
    'without any work being rewritten',
  );

  // Saving that colour fills a palette slot, and the slot sets the colour back.
  await page.locator('[data-action="swatch-save"]').first().click();
  await page.waitForTimeout(300);
  assert.ok(await page.locator('[data-swatch="#aa3322"]').count(), 'the saved colour is offered as a swatch');
  await universal.fill('#224488');
  await universal.dispatchEvent('change');
  await page.waitForTimeout(400);
  await page.locator('[data-swatch="#aa3322"]').first().click();
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__booth.project.booth.edgeColor), '#aa3322', 'and clicking it puts that colour back');
  // Previous is now the colour it held before this one.
  assert.ok(await page.locator('.swatch-previous').count(), 'and Previous offers the colour before it');

  // --- The export frame: a chosen shape, not the browser window's.
  await page.click('[data-tab="export"]');
  await page.getByLabel('Export frame').selectOption('phone');
  await page.waitForTimeout(300);
  const shot = await page.evaluate(async () => {
    const scene = window.__booth.scene;
    const blob = await scene.export(1920, { frame: 'phone' });
    const bitmap = await createImageBitmap(blob);
    const canvas = scene.renderer.domElement;
    return { width: bitmap.width, height: bitmap.height, canvasAspect: canvas.width / canvas.height, aspect: scene.camera.aspect };
  });
  assert.deepEqual([shot.width, shot.height], [1080, 1920], 'a vertical export is 1080 x 1920 in a landscape window');
  assert.ok(shot.canvasAspect > 1, 'the window itself is still landscape');
  assert.ok(Math.abs(shot.aspect - shot.canvasAspect) < 0.01, 'and the camera is handed back the viewport it had');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS finishing: drop shadow, hidden spotlights, universal edges, saved palette, export frame.');
} finally {
  await browser.close();
  await server.close();
}
