// The thirteenth round in a real browser: a cut-out figure is picked by
// double-click from any side, not only where its card faces the camera; and
// Auto pan slides the view sideways a set distance in a set time, either way,
// and stops at a press.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5238 } });
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
  await page.goto('http://127.0.0.1:5238');
  await page.waitForFunction(() => !!window.__booth?.scene);

  // ---- Double-click a figure from the side --------------------------------------
  await page.click('[data-tab="layout"]');
  await page.click('[data-action="add-woman"]');
  await page.waitForFunction(() => Object.values(window.__booth.scene.personFrames).some((g) => g.children.some((m) => m.userData.cutout)), null, { timeout: 15000 });
  await page.evaluate(() => { const s = window.__booth.scene, o = s.onSelectPerson; window.__picks = 0; s.onSelectPerson = (id) => { window.__picks++; o(id); }; });
  for (const [view, rot] of [['left', 180], ['left', 0], ['perspective', 180], ['back', 90]]) {
    await page.evaluate(([v, r]) => { window.__booth.scene.setView(v); window.__booth.mutate(() => (window.__booth.project.booth.people.at(-1).rotation = r)); }, [view, rot]);
    await page.waitForTimeout(400);
    const spot = await page.evaluate(() => {
      const s = window.__booth.scene, r = s.renderer.domElement.getBoundingClientRect();
      const g = Object.values(s.personFrames).at(-1), v = new g.position.constructor();
      g.updateMatrixWorld(true); g.getWorldPosition(v); v.y += 0.8; v.project(s.camera);
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    });
    await page.mouse.dblclick(spot.x, spot.y);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => { const n = window.__picks; window.__picks = 0; return n; }), 1, `double-click picks the figure (${view} view, facing ${rot}°)`);
  }

  // ---- Auto pan -------------------------------------------------------------------
  await page.evaluate(() => window.__booth.scene.setView('perspective'));
  await page.waitForTimeout(300);
  assert.equal(await page.isVisible('.autopan-menu'), false);
  await page.click('.toolbar [data-action="autopan-menu"]');
  assert.equal(await page.isVisible('.autopan-menu'), true, 'the caret opens the menu');
  await page.fill('#autopan-dist', '4');
  await page.dispatchEvent('#autopan-dist', 'change');
  await page.fill('#autopan-time', '1');
  await page.dispatchEvent('#autopan-time', 'change');
  assert.equal(await page.inputValue('#autopan-speed'), '4', 'time sets the speed from the distance');
  await page.fill('#autopan-speed', '8');
  await page.dispatchEvent('#autopan-speed', 'change');
  assert.equal(await page.inputValue('#autopan-time'), '0.5', 'and speed sets the time');
  const pose = () => page.evaluate(() => { const s = window.__booth.scene; return { c: s.camera.position.toArray(), t: s.controls.target.toArray(), right: (() => { const v = new s.camera.position.constructor().setFromMatrixColumn(s.camera.matrixWorld, 0); v.y = 0; return v.normalize().toArray(); })() }; });
  const moved = (a, b) => (b.c[0] - a.c[0]) * a.right[0] + (b.c[2] - a.c[2]) * a.right[2];
  let a = await pose();
  await page.click('.autopan-menu [data-action="autopan-go"]');
  await page.waitForFunction(() => /Start/.test(document.querySelector('.autopan-menu [data-action="autopan-go"]').textContent), null, { timeout: 10000 });
  let b = await pose();
  assert.ok(Math.abs(moved(a, b) / 0.0254 - 48) < 0.5, `left to right slides the view 4′ right (${(moved(a, b) / 0.0254).toFixed(2)}″)`);
  assert.ok(Math.abs(b.c[1] - a.c[1]) < 1e-9 && Math.abs((b.t[0] - a.t[0]) - (b.c[0] - a.c[0])) < 1e-9, 'level, and the target moves with the camera');
  await page.selectOption('#autopan-dir', '-1');
  a = b;
  await page.click('.autopan-menu [data-action="autopan-go"]');
  await page.waitForFunction(() => /Start/.test(document.querySelector('.autopan-menu [data-action="autopan-go"]').textContent), null, { timeout: 10000 });
  b = await pose();
  assert.ok(Math.abs(moved(a, b) / 0.0254 + 48) < 0.5, 'right to left slides it back');
  // A long one, stopped by a press in the viewport.
  await page.fill('#autopan-time', '60');
  await page.dispatchEvent('#autopan-time', 'change');
  await page.click('.autopan-menu [data-action="autopan-go"]');
  await page.waitForTimeout(300);
  const box = await page.locator('#scene canvas').boundingBox();
  await page.mouse.click(box.x + box.width - 40, box.y + box.height - 120);
  await page.waitForFunction(() => /Start/.test(document.querySelector('.autopan-menu [data-action="autopan-go"]').textContent), null, { timeout: 3000 });
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('booth.autoPan')).dir), -1, 'the settings are remembered');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS a figure is picked by double-click from the side, and Auto pan slides the view a set distance in a set time either way, stopping at a press.');
} finally {
  await browser.close();
  await server.close();
}
