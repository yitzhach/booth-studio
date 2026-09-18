// The art-show booth in a real renderer. The node tests pin the arithmetic;
// this checks that the venue switch reaches the scene: seamless walls, nine
// spotlights hung on a bar, a hall around the booth, and a pedestal that can
// be picked up and dragged across the floor.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5197 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
const IN = 0.0254;

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5197');
  await page.waitForFunction(() => !!window.__booth?.scene);

  // --- The venue switch.
  await page.click('[data-tab="show"]');
  await page.getByLabel('Venue').selectOption('artshow');
  await page.waitForTimeout(600);
  const booth = await page.evaluate(() => window.__booth.project.booth);
  assert.equal(booth.venue, 'artshow');
  assert.equal(booth.walls.back.width, 144, 'the back wall is 144in');
  assert.equal(booth.walls.left.width, 120, 'the side walls are 120in');
  assert.equal(booth.walls.back.height, 144, 'and all of them are 144in tall');
  assert.equal(booth.tent, false, 'no canopy indoors');

  // --- Seamless walls: the slabs are there, the seam posts are not.
  const walls = await page.evaluate(() => {
    const scene = window.__booth.scene;
    scene.group.updateMatrixWorld(true);
    const slabs = scene.wallObjects.map((o) => o.userData.wall);
    // Every box in the group that is not a wall slab and stands as tall as a
    // wall would be a seam post. The outdoor booth has one every 30 inches.
    let posts = 0;
    scene.group.traverse((o) => {
      const box = o.geometry?.parameters;
      if (!box || o.userData.wall || o.userData.artId) return;
      if (box.width && box.width < 0.02 && box.height > 1) posts += 1;
    });
    return { slabs, posts };
  });
  assert.deepEqual(walls.slabs.sort(), ['back', 'left', 'right'], 'three wall slabs');
  assert.equal(walls.posts, 0, 'an art-show wall has no seam posts in it');

  // --- The light bar: nine spotlights, each aimed at a wall, plus the rail.
  const bar = await page.evaluate(() => {
    const scene = window.__booth.scene;
    const rail = scene.group.getObjectByName('light-bar');
    if (!rail) return null;
    const spots = [];
    rail.traverse((o) => { if (o.isSpotLight) spots.push({
      pos: [o.position.x, o.position.y, o.position.z],
      target: [o.target.position.x, o.target.position.y, o.target.position.z],
    }); });
    return { spots, expected: window.__booth.fixtures };
  });
  assert.ok(bar, 'the bar is in the scene');
  assert.equal(bar.spots.length, 9, 'nine directional fixtures');
  assert.equal(bar.expected.length, 9, 'and the booth says there should be nine');
  for (let i = 0; i < 9; i++) {
    const f = bar.expected[i];
    assert.ok(Math.abs(bar.spots[i].pos[0] - f.x * IN) < 1e-6, `fixture ${i + 1} hangs where the bar says`);
    assert.ok(Math.abs(bar.spots[i].pos[1] - f.y * IN) < 1e-6);
    assert.ok(Math.abs(bar.spots[i].target[0] - f.tx * IN) < 1e-6, `fixture ${i + 1} is aimed where the wall is`);
    assert.ok(Math.abs(bar.spots[i].target[2] - f.tz * IN) < 1e-6);
  }

  // --- The exhibition hall.
  assert.ok(await page.evaluate(() => !!window.__booth.scene.group.getObjectByName('exhibition-hall')),
    'the booth stands in an exhibition hall');
  await page.getByLabel('Hall ceiling height').fill('240');
  await page.getByLabel('Hall ceiling height').dispatchEvent('change');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__booth.project.booth.hall.ceiling), 240,
    'the ceiling height is typed in inches');

  // --- Custom booth dimensions.
  await page.getByLabel('Booth width').fill('200');
  await page.getByLabel('Booth width').dispatchEvent('change');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__booth.project.booth.width), 200,
    'the whole footprint is typed, not chosen from a list');

  // --- The individual panel, and rebuilding the walls from it.
  await page.getByLabel('Panel width').fill('30');
  await page.getByLabel('Panel width').dispatchEvent('change');
  await page.locator('[data-action="relink-walls"]').click();
  await page.waitForTimeout(500);
  const rebuilt = await page.evaluate(() => window.__booth.project.booth.walls);
  assert.equal(rebuilt.back.width % 30, 0, 'the back wall is a whole number of 30in panels');
  assert.equal(rebuilt.left.width % 30, 0, 'and so is a side wall');

  // --- A pedestal: added, measured, and dragged across the floor.
  await page.click('[data-tab="walls"]');
  await page.locator('[data-action="add-pedestal"]').click();
  await page.waitForTimeout(500);
  const ped = await page.evaluate(() => window.__booth.project.booth.pedestals[0]);
  assert.equal(ped.height, 44, '44in tall');
  assert.equal(ped.width, 12, '12in wide');
  assert.equal(ped.depth, 12, '12in deep');
  assert.equal(await page.evaluate(() => window.__booth.selectedPedestal), ped.id,
    'a new pedestal arrives selected, ready to be moved');

  // Where its column stands, read back off the mesh.
  const pedestalState = () => page.evaluate(() => {
    const scene = window.__booth.scene;
    scene.group.updateMatrixWorld(true);
    const mesh = scene.pedestalObjects[0];
    const m = mesh.matrixWorld.elements, box = mesh.geometry.parameters;
    return { centre: [m[12], m[13], m[14]], width: box.width, height: box.height };
  });
  await page.getByLabel('Pedestal 1 Position X').fill('-20');
  await page.getByLabel('Pedestal 1 Position X').dispatchEvent('change');
  await page.getByLabel('Pedestal 1 Position Z').fill('12');
  await page.getByLabel('Pedestal 1 Position Z').dispatchEvent('change');
  await page.waitForTimeout(500);
  let stood = await pedestalState();
  assert.ok(Math.abs(stood.centre[0] - -20 * IN) < 1e-6, 'X is where it was typed');
  assert.ok(Math.abs(stood.centre[2] - 12 * IN) < 1e-6, 'Z is where it was typed');
  assert.ok(Math.abs(stood.width - 12 * IN) < 1e-6, 'and it is as wide as it says');

  // Drag it. A selected pedestal follows the pointer, the way a wall does.
  const screenPoint = async () => page.evaluate(() => {
    const scene = window.__booth.scene;
    scene.group.updateMatrixWorld(true);
    const mesh = scene.pedestalObjects[0];
    const v = mesh.localToWorld(new (mesh.position.constructor)(0, 0, 0));
    v.project(scene.camera);
    const r = scene.renderer.domElement.getBoundingClientRect();
    return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height];
  });
  const [px, py] = await screenPoint();
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px + 120, py + 30, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const dragged = await page.evaluate(() => window.__booth.project.booth.pedestals[0]);
  assert.ok(Math.abs(dragged.x - -20) > 1 || Math.abs(dragged.z - 12) > 1,
    'dragging a selected pedestal moves it across the floor');
  assert.equal(dragged.x, Math.round(dragged.x), 'a snapped drag lands on whole inches');
  const half = await page.evaluate(() => window.__booth.project.booth.width / 2);
  assert.ok(Math.abs(dragged.x) <= half, 'and it stops at the footprint');
  stood = await pedestalState();
  assert.ok(Math.abs(stood.centre[0] - dragged.x * IN) < 1e-6,
    'the mesh stands where the drag says, without a scene rebuild to put it there');
  assert.equal(Number(await page.getByLabel('Pedestal 1 Position X').inputValue()), dragged.x,
    'and the typed field follows the drag');

  // Removing it takes its meshes with it.
  await page.locator('[data-action^="delete-pedestal-"]').click();
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__booth.scene.pedestalObjects.length), 0,
    'a removed pedestal leaves nothing behind');

  // --- Back to the outdoor booth, with the seam posts returning.
  await page.click('[data-tab="show"]');
  await page.getByLabel('Venue').selectOption('outdoor');
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__booth.project.booth.width), 120);
  assert.equal(await page.evaluate(() => !!window.__booth.scene.group.getObjectByName('light-bar')), false,
    'the outdoor booth has no light bar');
  assert.equal(await page.evaluate(() => !!window.__booth.scene.group.getObjectByName('exhibition-hall')), false,
    'and no hall around it');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS art show booth: seamless walls, nine-head light bar, hall, and a pedestal you can drag.');
} finally {
  await browser.close();
  await server.close();
}
