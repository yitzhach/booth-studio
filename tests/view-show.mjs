// The show floor in a real browser: the plan full-screen, shapes from the
// library, dragging with snapping, a selection box, blocks of booths, spacing,
// renumbering, the keys, undo, a reload, and a phone.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5211 } });
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
  await page.goto('http://127.0.0.1:5211');
  await page.waitForFunction(() => !!window.__booth?.scene);
  const hall = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__booth.project.hall ?? null)));
  const center = async (sel) => {
    const b = await page.locator(sel).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  // ---- Opening it ---------------------------------------------------------
  await page.click('[data-action="mode-show"]');
  assert.equal(await page.locator('#show-floor').isVisible(), true, 'the show floor fills the viewport');
  assert.equal(await page.locator('#scene').isVisible(), false, 'the booth steps aside');
  let h = await hall();
  assert.equal(h.items.length, 16, 'a new plan starts as sixteen booths on the floor');
  assert.equal(await page.locator('#show-floor [data-kind="booth"]').count(), 16);
  assert.equal(await page.locator('#library [data-show-shape]').count(), 16, 'the library offers the shapes');
  await page.screenshot({ path: '/tmp/show-floor.png' });

  // ---- A shape tapped lands in the middle, selected ------------------------
  await page.click('#library [data-show-shape="aisle"]');
  h = await hall();
  assert.equal(h.items.length, 17);
  const aisle = h.items.at(-1);
  assert.equal(aisle.kind, 'aisle');
  assert.equal(await page.locator('#show-floor .sf-handle').count(), 8, 'a lone selection has eight handles');
  await page.keyboard.press('Delete');
  assert.equal((await hall()).items.length, 16, 'Delete removes it');
  await page.keyboard.press('Control+z');
  assert.equal((await hall()).items.length, 17, 'and undo brings it back');

  // ---- A shape dragged from the library lands where it is let go ---------
  const from = await center('#library [data-show-shape="stage"]');
  const floor = await page.locator('#show-floor svg').boundingBox();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(floor.x + floor.width * 0.3, floor.y + floor.height * 0.8, { steps: 6 });
  assert.equal(await page.locator('#show-floor .sf-ghost').isVisible(), true, 'a ghost follows the pointer');
  await page.mouse.up();
  h = await hall();
  const stage = h.items.at(-1);
  assert.equal(stage.kind, 'stage');
  const view = await page.evaluate(() => window.__booth.showEditor.view);
  const expectX = view.x + (floor.width * 0.3) / view.s;
  assert.ok(Math.abs(stage.x - expectX) < 30, `dropped where it was let go (${stage.x} ≈ ${expectX})`);

  // ---- Dragging a booth snaps it to its neighbour --------------------------
  // Booth 102 dragged up by a whole booth and a little: it lands flush on
  // the top edge line of the booths beside it, not a few inches off.
  const before = (await hall()).items.find((i) => i.number === 102);
  const b102 = await center('#show-floor [data-hall-booth="102"]');
  await page.mouse.move(b102.x, b102.y);
  await page.mouse.down();
  await page.mouse.move(b102.x + 3, b102.y + 40, { steps: 5 });
  await page.mouse.move(b102.x + 2, b102.y + 3, { steps: 5 });
  assert.ok(await page.locator('#show-floor .sf-guides line').count() >= 1, 'the line it snapped to shows');
  await page.mouse.up();
  const after = (await hall()).items.find((i) => i.number === 102);
  assert.deepEqual([after.x, after.y], [before.x, before.y], 'a small wobble snaps back to where it lined up');
  await page.mouse.move(b102.x, b102.y);
  await page.mouse.down();
  await page.mouse.move(b102.x, b102.y + 200, { steps: 8 });
  await page.mouse.up();
  const moved = (await hall()).items.find((i) => i.number === 102);
  assert.ok(moved.y > before.y + 60, 'a real drag moves it');
  assert.equal((moved.y - moved.d / 2) % 12, 0, 'and its edge lands on the grid');
  await page.keyboard.press('Control+z');
  assert.equal((await hall()).items.find((i) => i.number === 102).y, before.y, 'one undo step');

  // ---- A selection box, then spacing and lining up -------------------------
  await page.click('[data-action="show-fit"]');
  const a = await center('#show-floor [data-hall-booth="101"]');
  const c = await center('#show-floor [data-hall-booth="104"]');
  // From empty floor above row 1 to below it.
  await page.mouse.move(a.x - 60, a.y - 80);
  await page.mouse.down();
  await page.mouse.move(c.x + 45, a.y + 45, { steps: 6 });
  await page.mouse.up();
  let sel = await page.evaluate(() => window.__booth.showEditor.selection);
  assert.ok(sel.length >= 4, `a box selects the booths inside it (${sel.length})`);
  await page.fill('#show-gap', '24');
  await page.press('#show-gap', 'Enter');
  await page.click('[data-action="show-space"]');
  h = await hall();
  const row = h.items.filter((i) => sel.includes(i.id)).sort((x, y) => x.x - y.x);
  assert.equal(row[1].x - row[0].x, 120 + 24, 'spaced 24″ apart');

  // ---- Add a block of booths ---------------------------------------------
  await page.keyboard.press('Escape');
  await page.fill('input[data-show-block="count"]', '6');
  await page.press('input[data-show-block="count"]', 'Enter');
  await page.fill('input[data-show-block="perRow"]', '3');
  await page.press('input[data-show-block="perRow"]', 'Enter');
  await page.selectOption('select[data-show-block="style"]', 'tent');
  await page.click('[data-action="show-add-block"]');
  h = await hall();
  const tents = h.items.filter((i) => i.style === 'tent');
  assert.equal(tents.length, 6, 'six tents added');
  assert.deepEqual(tents.map((t) => t.number), [117, 118, 119, 120, 121, 122], 'numbered on from the highest');
  sel = await page.evaluate(() => window.__booth.showEditor.selection);
  assert.equal(sel.length, 6, 'and selected');

  // Keys: duplicate, turn.
  await page.keyboard.press('Control+d');
  assert.equal((await hall()).items.filter((i) => i.style === 'tent').length, 12, 'Ctrl+D duplicates');
  await page.keyboard.press('r');
  assert.ok((await hall()).items.filter((i) => i.rot === 90).length >= 6, 'R turns them');

  // ---- A booth's own panel: size, number and sale -------------------------
  await page.keyboard.press('Escape');
  await page.click('#show-floor [data-hall-booth="103"]');
  await page.fill('input[data-show-field="w"]', '240');
  await page.press('input[data-show-field="w"]', 'Enter');
  await page.selectOption('select[data-scope="hallbooth"][data-field="status"]', 'sold');
  await page.fill('input[data-scope="hallbooth"][data-field="name"]', 'Ada Pottery');
  await page.press('input[data-scope="hallbooth"][data-field="name"]', 'Enter');
  await page.fill('input[data-show-field="number"]', '500');
  await page.press('input[data-show-field="number"]', 'Enter');
  h = await hall();
  const ada = h.items.find((i) => i.number === 500);
  assert.equal(ada?.w, 240, 'a 10 × 20 now');
  assert.equal(h.booths[500]?.name, 'Ada Pottery', 'the sale follows the booth to its new number');
  assert.equal(h.booths[103], undefined);
  assert.match(await page.locator('#show-floor [data-hall-booth="500"]').innerHTML(), /Ada Pottery/);

  // The venue.
  await page.selectOption('select[data-show-venue="kind"]', 'outdoor');
  await page.fill('input[data-show-venue="width"]', '200');
  await page.press('input[data-show-venue="width"]', 'Enter');
  h = await hall();
  assert.deepEqual([h.venue.kind, h.venue.width], ['outdoor', 2400]);

  // ---- Renumber the whole floor -------------------------------------------
  await page.keyboard.press('Escape');
  await page.click('#show-floor svg', { position: { x: 5, y: 5 } });
  await page.click('[data-action="show-renumber"]');
  h = await hall();
  const numbers = h.items.filter((i) => i.kind === 'booth').map((i) => i.number).sort((x, y) => x - y);
  assert.equal(numbers[0], 101);
  assert.equal(new Set(numbers).size, numbers.length, 'no number twice');
  assert.ok(Object.values(h.booths).some((r) => r.name === 'Ada Pottery'), 'the sale survives renumbering');

  // ---- Zoom, back to the booth, reload -------------------------------------
  const s0 = (await page.evaluate(() => window.__booth.showEditor.view)).s;
  await page.mouse.move(floor.x + floor.width / 2, floor.y + floor.height / 2);
  await page.mouse.wheel(0, -300);
  assert.ok((await page.evaluate(() => window.__booth.showEditor.view)).s > s0, 'the wheel zooms in');
  await page.click('[data-action="show-exit"]');
  assert.equal(await page.locator('#scene').isVisible(), true, 'back to the booth');
  assert.equal(await page.locator('#show-floor').isVisible(), false);
  const count = (await hall()).items.length;
  await page.evaluate(() => window.__booth.save());
  await page.reload();
  await page.waitForFunction(() => !!window.__booth?.scene);
  assert.equal((await hall()).items.length, count, 'the floor survives a reload');
  await page.click('[data-tab="hall"]');
  assert.match(await page.textContent('#inspector-content'), /laid out piece by piece/, 'the Hall tab knows the plan is a floor now');

  // ---- A phone ---------------------------------------------------------------
  // One page: a second one in this single-process browser closes the first.
  const phone = page;
  await phone.setViewportSize({ width: 390, height: 844 });
  await phone.click('[data-action="mode-show"]');
  assert.equal(await phone.locator('#show-floor').isVisible(), true);
  assert.ok(await phone.locator('.inspector .mobile-library [data-show-shape]').first().isVisible(), 'on a phone the shapes are in the panel');
  const n0 = await phone.evaluate(() => window.__booth.project.hall.items.length);
  await phone.locator('.inspector .mobile-library [data-show-shape="booth10"]').click();
  assert.equal(await phone.evaluate(() => window.__booth.project.hall.items.length), n0 + 1, 'a tap adds a booth');
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `no sideways scroll (${overflow})`);
  await phone.screenshot({ path: '/tmp/show-floor-phone.png' });

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS the show floor opens full-screen, adds shapes by tap and by drag, snaps a dragged booth, selects by box, spaces, adds a block of tents numbered on, duplicates and turns, resizes and renumbers a booth with its sale, sets the venue, zooms, survives a reload and works on a phone.');
} finally {
  await browser.close();
  await server.close();
}
