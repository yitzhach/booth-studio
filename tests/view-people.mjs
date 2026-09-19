// Figures for scale, and the spotlight fixtures that hide themselves indoors.
// Both are things you can only check by building the scene: the heights have to
// survive the inches-to-metres conversion into real geometry, and the housings
// have to actually leave the group.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5195 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5195');
  await page.waitForFunction(() => !!window.__booth?.scene);

  await page.click('[data-tab="layout"]');
  await page.click('[data-action="add-woman"]');
  await page.click('[data-action="add-man"]');

  const stored = await page.evaluate(() => window.__booth.project.booth.people);
  assert.equal(stored.length, 2, 'both figures were added');
  assert.equal(stored[0].height, 66, "a woman defaults to 5'6\"");
  assert.equal(stored[1].height, 72, "a man defaults to 6'0\"");
  assert.notEqual(stored[0].x, stored[1].x, 'a second figure does not stand inside the first');

  // The height that matters is the one in the scene, in metres, after the
  // inches conversion — a figure that is right in the panel and wrong in the
  // render is worse than no figure at all.
  const built = await page.evaluate(() => {
    const scene = window.__booth.scene;
    const Vector3 = scene.camera.position.constructor;
    const tops = [];
    scene.group.traverse((o) => {
      if (!o.isGroup || !o.userData?.person) return;
      let top = 0;
      o.traverse((part) => {
        if (!part.isMesh) return;
        const at = new Vector3();
        part.getWorldPosition(at);
        const p = part.geometry?.parameters || {};
        top = Math.max(top, at.y + (p.radius || (p.height || 0) / 2));
      });
      tops.push(top);
    });
    return tops.sort((a, b) => a - b);
  });
  assert.equal(built.length, 2, 'both figures reached the scene');
  assert.ok(Math.abs(built[0] - 66 * 0.0254) < 0.02, `the 5'6" figure stands ${built[0].toFixed(3)} m tall`);
  assert.ok(Math.abs(built[1] - 72 * 0.0254) < 0.02, `the 6'0" figure stands ${built[1].toFixed(3)} m tall`);
  assert.ok(built[1] > built[0], 'and the taller default is taller in the render');

  // Editing a height moves the geometry, which is what makes it a measurement.
  const raised = await page.evaluate(async () => {
    const project = window.__booth.project;
    project.booth.people[0].height = 80;
    window.__booth.mutate(() => {});
    const Vector3 = window.__booth.scene.camera.position.constructor;
    let top = 0;
    window.__booth.scene.group.traverse((o) => {
      if (!o.isMesh || !o.userData?.person) return;
      const at = new Vector3();
      o.getWorldPosition(at);
      const p = o.geometry?.parameters || {};
      top = Math.max(top, at.y + (p.radius || (p.height || 0) / 2));
    });
    return top;
  });
  assert.ok(Math.abs(raised - 80 * 0.0254) < 0.02, `an edited height rebuilt at ${raised.toFixed(3)} m`);

  // Spotlight fixtures. The housing is a 0.045 m cylinder; the rail is a box
  // and is not one of these, which is the point — the rail stays either way.
  const fixtures = await page.evaluate(() => {
    const scene = window.__booth.scene;
    const project = window.__booth.project;
    const housings = () => {
      let n = 0;
      scene.group.traverse((o) => {
        if (o.isMesh && o.geometry?.type === 'CylinderGeometry' && Math.abs(o.geometry.parameters.radiusTop - 0.045) < 1e-9) n++;
      });
      return n;
    };
    const rails = () => {
      let n = 0;
      scene.group.traverse((o) => {
        if (o.isMesh && o.geometry?.type === 'BoxGeometry' && Math.abs(o.geometry.parameters.height - 0.025) < 1e-9 && Math.abs(o.geometry.parameters.depth - 0.025) < 1e-9) n++;
      });
      return n;
    };
    const at = (preset, mode) => {
      project.booth.envPreset = preset;
      project.booth.fixtures = mode;
      window.__booth.mutate(() => {});
      return { housings: housings(), rails: rails() };
    };
    return {
      lights: project.lights.length,
      studio: at('studio', 'auto'),
      indoor: at('tradeshow', 'auto'),
      indoorForced: at('tradeshow', 'always'),
      outdoorHidden: at('artfair', 'never'),
    };
  });
  assert.equal(fixtures.studio.housings, fixtures.lights, 'the studio draws a housing per spotlight');
  assert.equal(fixtures.indoor.housings, 0, 'an indoor environment hides them by default');
  assert.equal(fixtures.indoorForced.housings, fixtures.lights, 'and Always show brings them back');
  assert.equal(fixtures.outdoorHidden.housings, 0, 'Never show hides them outdoors too');
  assert.ok(fixtures.indoor.rails >= 1, 'the rail above the booth stays whatever the housings do');
  assert.equal(fixtures.studio.rails, fixtures.indoor.rails, 'the upper row is the same row in both');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS people for scale at real heights, and spotlight housings hidden indoors with the rail kept.');
} finally {
  await browser.close();
  await server.close();
}
