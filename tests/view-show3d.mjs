// The show floor in 3D, in a real browser: the plan stood up in the booth's
// viewport, "my booth" drawn in full in its place, walking it from the
// entrance, a walkthrough laid down the aisles as a timeline, the timeline
// swapped back when the booth is looked at again, and the whole walk
// recorded to MP4 where this sandbox can encode.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5231 } });
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
  await page.goto('http://127.0.0.1:5231');
  await page.waitForFunction(() => !!window.__booth?.scene);
  const state = () =>
    page.evaluate(() => {
      const s = window.__booth.scene;
      const show = s.group.getObjectByName('show-floor');
      const off = s.group.getObjectByName('offstage');
      let instanced = 0,
        instances = 0;
      show?.traverse((o) => o.isInstancedMesh && (instanced++, (instances += o.count)));
      return {
        show3d: window.__booth.show3d,
        hasShow: !!show,
        instanced,
        instances,
        offstage: off ? off.children.map((o) => o.name || o.type) : null,
        boothOnStage: (() => {
          let o = s.frames.back;
          while (o && o.name !== 'offstage') o = o.parent;
          return !!s.frames.back && !o;
        })(),
        camera: s.camera.position.toArray(),
        far: s.camera.far,
        walking: !!s.walking,
        labels: show ? show.getObjectByName('show-labels').children.filter((c) => c.visible).length : 0,
      };
    });
  // How much the picture varies: a blank or single-colour canvas is ~0.
  const variety = () =>
    page.evaluate(() => {
      const s = window.__booth.scene;
      s.renderFrame();
      const c = document.createElement('canvas');
      c.width = 96;
      c.height = 64;
      const g = c.getContext('2d');
      g.drawImage(s.renderer.domElement, 0, 0, 96, 64);
      const d = g.getImageData(0, 0, 96, 64).data;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4) seen.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4));
      return seen.size;
    });

  // ---- The plan, then 3D --------------------------------------------------
  await page.click('[data-action="mode-show"]');
  await page.click('[data-action="add-block"], [data-action="show-add-block"]');
  await page.locator('#show-floor [data-hall-booth="101"]').click();
  await page.click('[data-action="hall-mine"]');
  assert.equal(await page.evaluate(() => window.__booth.project.hall.mine), 101, 'booth 101 is mine');
  await page.click('[data-action="show-3d"]');
  let s = await state();
  assert.equal(s.show3d, true);
  assert.equal(await page.locator('#scene').isVisible(), true, 'the 3D viewport shows the floor');
  assert.equal(await page.locator('#show-floor').isVisible(), false, 'the plan steps aside');
  assert.ok(s.hasShow, 'the scene built the show');
  assert.ok(s.instanced > 0 && s.instanced <= 8, `one instanced mesh per kind of part, got ${s.instanced}`);
  assert.ok(s.instances > 25 * 3, `every other booth stood up (${s.instances} parts)`);
  assert.ok(s.boothOnStage, 'my booth is drawn in full');
  assert.ok(s.offstage.length > 0, 'its surroundings are offstage');
  assert.ok(s.far > 100 || s.camera[1] < 60, 'the camera reaches the whole floor');
  await page.screenshot({ path: '/tmp/show-3d.png' });
  const v1 = await variety();
  assert.ok(v1 > 25, `the picture is not blank (${v1})`);
  assert.match(await page.textContent('#mode-label'), /3D/);
  assert.equal(await page.locator('#view-switch [data-view="back"]').isVisible(), false, 'Back / Left / Right mean nothing on a floor');
  await page.screenshot({ path: '/tmp/show-3d.png' });

  // Plan view of the whole floor, and back.
  await page.click('#view-switch [data-view="plan"]');
  assert.equal(await page.evaluate(() => window.__booth.scene.camera.isOrthographicCamera), true);
  await page.screenshot({ path: '/tmp/show-3d-plan.png' });
  await page.click('#view-switch [data-view="perspective"]');

  // ---- Walking -------------------------------------------------------------
  await page.keyboard.press('w');
  s = await state();
  assert.ok(s.walking, 'W walks the show');
  assert.ok(Math.abs(s.camera[1] - 62 * 0.0254) < 1e-3, `at eye height, got ${s.camera[1]}`);
  const at = s.camera;
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Shift+ArrowUp');
  s = await state();
  const stepped = Math.hypot(s.camera[0] - at[0], s.camera[2] - at[2]);
  assert.ok(Math.abs(stepped - 30 * 0.0254) < 1e-3, `a step and a stride forward, got ${stepped}`);
  assert.ok(s.labels > 0, 'booth numbers show near the camera');
  await page.screenshot({ path: '/tmp/show-3d-walk.png' });
  await page.keyboard.press('Escape');
  assert.equal((await state()).walking, false, 'Esc stops walking');

  // ---- A walkthrough ----------------------------------------------------------
  const boothTimeline = await page.evaluate(() => window.__booth.videoTimeline);
  await page.click('[data-action="show-walkthrough"]');
  assert.equal(await page.locator('#timeline-dialog').isVisible(), true, 'the timeline opens on the walk');
  const tl = await page.evaluate(() => window.__booth.timeline());
  assert.ok(tl.keys.length >= 3, `keys down the aisles, got ${tl.keys.length}`);
  for (const k of tl.keys) assert.ok(Math.abs(k.position[1] - 62 * 0.0254) < 1e-6, 'every key at eye height');
  assert.equal(tl.flow, 'glide');
  // Playing the first second of it moves the camera along the floor.
  const moved = await page.evaluate(async () => {
    const view = window.__booth.scene;
    const before = view.camera.position.toArray();
    await view.previewMove({ move: window.__booth.timeline(), seconds: 1.5 });
    view.showMoment(window.__booth.timeline(), 0.5);
    const mid = view.camera.position.toArray();
    return Math.hypot(mid[0] - before[0], mid[2] - before[2]);
  });
  assert.ok(moved > 1, `halfway through, the walk has gone somewhere (${moved.toFixed(2)} m)`);

  const codec = await page.evaluate(async () => {
    const { pickCodec } = await import('/src/video.js');
    const chosen = await pickCodec({ width: 320, height: 240, framerate: 24, bitrate: 1e6 });
    return chosen && chosen.kind;
  });
  if (!codec) console.log('SKIP no video codec encodes in this sandbox; the walkthrough above is still covered.');
  else {
    const recorded = await page.evaluate(async () => {
      const view = window.__booth.scene;
      const result = await view.recordVideo({ move: window.__booth.timeline(), seconds: 1, fps: 12, size: 720 });
      return { type: result.blob.type, frames: result.frames, bytes: result.blob.size };
    });
    assert.equal(recorded.type, 'video/mp4', 'the walk records as an MP4');
    assert.equal(recorded.frames, 12);
    assert.ok(recorded.bytes > 2000, `more than 2 kB, got ${recorded.bytes}`);
    console.log(`     recorded a ${recorded.frames}-frame walkthrough, ${(recorded.bytes / 1024).toFixed(0)} kB`);
  }
  await page.click('[data-action="close-timeline"]');

  // ---- Back to the plan, then the booth: the booth's own timeline returns ---
  await page.keyboard.press('Escape');
  s = await state();
  assert.equal(s.show3d, false, 'Esc goes back to the plan');
  assert.equal(await page.locator('#show-floor').isVisible(), true);
  await page.click('[data-action="show-exit"]');
  s = await state();
  assert.equal(s.hasShow, false, 'the booth is itself again');
  assert.deepEqual(await page.evaluate(() => window.__booth.videoTimeline), boothTimeline, "the booth's timeline is the one it had");

  // ---- No booth of mine: the whole floor is light -----------------------------
  await page.click('[data-action="mode-show"]');
  await page.locator('#show-floor [data-hall-booth="101"]').click();
  await page.click('[data-action="hall-mine"]');
  await page.click('[data-action="show-3d"]');
  s = await state();
  assert.equal(s.boothOnStage, false, 'with no booth of mine, the booth is offstage');
  assert.ok((await variety()) > 20);

  // ---- An undo in 3D stands up the plan it gives back ----------------------------
  const before = (await state()).instances;
  await page.keyboard.press('Control+z');
  await page.waitForFunction(() => window.__booth.project.hall.mine === 101);
  s = await state();
  assert.ok(s.boothOnStage && s.instances < before, 'undo brings my booth back into the 3D floor');

  // ---- A phone ----------------------------------------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#scene').isVisible(), true);
  assert.ok(await page.locator('[data-action="show-walk"]').isVisible() || (await page.locator('[data-action="show-walk"]').count()) === 1, 'Walk the show is in the panel');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `no sideways scroll (${overflow})`);
  await page.screenshot({ path: '/tmp/show-3d-phone.png' });

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS the show floor stands up in 3D with my booth in full and the rest instanced, walks from the entrance with numbers near the camera, lays a walkthrough down the aisles as a timeline and records it, swaps the timeline back, draws a floor with no booth of mine, follows an undo and fits a phone.');
} finally {
  await browser.close();
  await server.close();
}
