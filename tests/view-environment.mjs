// The booth's surroundings: the four tent styles, the grounds, the horizon,
// neighbouring booths, zoom in perspective and in plan, the settings kept
// through a reload, a 2048 px export, and the controls at tablet and phone
// widths. It was on no list, so it never ran in CI and rotted unseen: from
// 2026-10-19 the welcome dialog blocked its first click, and the export's
// width became "Export image size". On 2026-10-26 it joined the view suites
// and stopped writing its tent pictures into docs/previews.
import { launchChromium } from './helpers/chromium.mjs';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const server = await createServer({ server: { host: '127.0.0.1', port: 5186 } });
await server.listen();
const browser = await launchChromium({ args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('booth.role', 'all')); // past the first visit's welcome (src/roles.js)
  await page.goto('http://127.0.0.1:5186');
  await page.waitForFunction(() => !!window.__booth?.scene);
  await page.locator('[data-tab="layout"]').click();
  await page.getByLabel('Ground', { exact: true }).selectOption('grass');
  await page.getByLabel('Horizon', { exact: true }).selectOption('park');

  for (const style of ['classic', 'peak', 'barrel', 'dome']) {
    await page.getByLabel('Tent style', { exact: true }).selectOption(style);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate((s) => !!window.__booth.scene.group.getObjectByName('tent-' + s), style), true);
  }

  const distance = () => page.evaluate(() => {
    const s = window.__booth.scene;
    return s.camera.position.distanceTo(s.controls.target);
  });
  const d = await distance();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  assert.ok(await distance() < d);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  assert.ok(Math.abs(await distance() - d) < 0.01);

  await page.locator('[data-view="plan"]').click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  assert.ok(await page.evaluate(() => window.__booth.scene.camera.zoom > 1));
  await page.locator('[data-action="reset-view"]').click();

  for (const ground of ['asphalt', 'concrete', 'grass']) await page.getByLabel('Ground', { exact: true }).selectOption(ground);

  await page.getByLabel('Surround with other booths').check();
  await page.waitForFunction(() => document.querySelector('#save-status').textContent.includes('Saved'));
  // With neighbours and the park horizon the reload took 27 s under
  // swiftshader here (2026-10-26), against Playwright's 30 s default.
  await page.reload({ timeout: 90_000 });
  await page.waitForFunction(() => !!window.__booth?.scene);
  assert.equal(await page.evaluate(() => window.__booth.project.booth.neighbors), true);
  assert.equal(await page.evaluate(() => window.__booth.project.booth.tentStyle), 'dome');

  await page.locator('[data-tab="export"]').click();
  await page.getByLabel('Export image size').selectOption('2048');
  const dl = page.waitForEvent('download');
  await page.locator('[data-action="export-image"]').click();
  await (await dl).saveAs('test-results/environment-export.png');

  for (const width of [820, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('[data-tab="layout"]').click();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await page.screenshot({ path: `test-results/environment-${width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('PASS four tent styles, grounds, neighbors, perspective/orthographic zoom, saved settings, 2048 export, mobile/tablet controls.');
} finally {
  await browser.close();
  await server.close();
}
