// The 2026-09-25 seventh round in a real browser: the show floor's
// right-drag selection box (drawn while it happens) and ⌘/Ctrl right-drag
// pan, Flip horizontal / vertical, the Pan tool in the 3D view and on the
// floor, a walk that takes up where it stopped, several tapes kept at once,
// and the panels' sub-tabs.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5214 } });
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
  // This suite is the one that sees the sub-tabs as a person does.
  await page.addInitScript(() => localStorage.setItem('booth.sectionTabs', 'on'));
  await page.goto('http://127.0.0.1:5214');
  await page.waitForFunction(() => !!window.__booth?.scene);
  const hall = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__booth.project.hall ?? null)));
  const pose = () => page.evaluate(() => window.__booth.scene.pose());
  const near = (a, b, eps = 1e-3) => a.every((v, i) => Math.abs(v - b[i]) < eps);

  // ---- Sub-tabs -------------------------------------------------------------
  await page.click('[data-tab="lighting"]');
  const chips = page.locator('#inspector-content .section-tabs [data-subtab]');
  const n = await chips.count();
  assert.ok(n >= 4, `a long panel gets chips (${n})`);
  const shown = () => page.evaluate(() => [...document.querySelectorAll('#inspector-content section')].filter((s) => !s.parentElement.closest('section') && s.offsetParent !== null).length);
  assert.equal(await shown(), 1, 'and shows one section at a time');
  await chips.nth(1).click();
  assert.equal(await chips.nth(1).getAttribute('aria-selected'), 'true');
  assert.equal(await shown(), 1);
  await page.click('#inspector-content [data-subtab="All"]');
  assert.ok((await shown()) >= 3, 'All shows the panel as it was');
  await page.click('[data-tab="layout"]');
  await page.click('[data-tab="lighting"]');
  assert.equal(await page.locator('#inspector-content [data-subtab="All"]').getAttribute('aria-selected'), 'true', 'the choice is remembered per tab');
  await chips.first().click();

  // ---- Tool search still reaches a section behind a chip -----------------
  const hidden = await page.evaluate(() => {
    const s = [...document.querySelectorAll('#inspector-content section.sub-hidden h3')][0];
    return s && s.textContent.replace(/\s+/g, ' ').trim();
  });
  if (hidden) {
    await page.keyboard.press('/');
    await page.keyboard.type(hidden.split(' ').slice(0, 2).join(' '));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const visible = await page.evaluate((t) => [...document.querySelectorAll('#inspector-content section h3')].some((h) => h.textContent.replace(/\s+/g, ' ').trim() === t && h.offsetParent !== null), hidden);
    assert.ok(visible, `search opens the chip "${hidden}" lives under`);
  }

  // ---- Walk takes up where it stopped -------------------------------------
  await page.click('[data-view="perspective"]');
  await page.evaluate(() => window.__booth.scene.applyPose({ position: [3, 2, 4], target: [0, 1, 0] }));
  const orbit = await pose();
  await page.click('.toolbar [data-action="walk"]');
  const firstWalk = await pose();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowLeft');
  const walked = await pose();
  assert.ok(!near(walked.position, firstWalk.position), 'the walk moved');
  await page.click('.toolbar [data-action="walk"]');
  const after = await pose();
  assert.ok(near(after.position, orbit.position) && near(after.target, orbit.target), 'Done comes back to the orbit view walked away from');
  await page.click('.toolbar [data-action="walk"]');
  const again = await pose();
  assert.ok(near(again.position, walked.position) && near(again.target, walked.target), 'walking again starts where the last walk stopped');
  await page.click('.toolbar [data-action="walk"]');

  // ---- The Pan tool in 3D --------------------------------------------------
  await page.click('.toolbar [data-action="pan"]');
  assert.equal(await page.evaluate(() => window.__booth.scene.panTool), true);
  assert.match(await page.textContent('#gesture-hint'), /^Pan:/);
  const box3d = await page.locator('#scene canvas').boundingBox();
  const before = await pose();
  await page.mouse.move(box3d.x + box3d.width * 0.5, box3d.y + box3d.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box3d.x + box3d.width * 0.3, box3d.y + box3d.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const panned = await pose();
  const d = (a, b) => a.map((v, i) => v - b[i]);
  const dp = d(panned.position, before.position), dt = d(panned.target, before.target);
  assert.ok(Math.hypot(...dt) > 0.05, 'a left-drag moved the target');
  assert.ok(near(dp, dt, 0.02), 'camera and target moved together: a pan, not an orbit');
  await page.keyboard.press('v');
  assert.equal(await page.evaluate(() => window.__booth.scene.panTool), false, 'V puts the hand down');

  // ---- Several tapes ------------------------------------------------------
  await page.click('[data-view="plan"]');
  await page.keyboard.press('t');
  assert.equal(await page.locator('.measure-bar').isVisible(), true, 'the tape shows its bar');
  await page.check('#keep-tapes');
  const cv = await page.locator('#scene canvas').boundingBox();
  const at = (fx, fy) => page.mouse.click(cv.x + cv.width * fx, cv.y + cv.height * fy);
  await at(0.4, 0.4); await at(0.6, 0.4);
  await at(0.4, 0.6); await at(0.6, 0.6);
  await at(0.45, 0.5); await at(0.55, 0.5);
  const tapes = () => page.evaluate(() => window.__booth.scene.annotations.filter((a) => a.kind === 'tape').length);
  assert.equal(await tapes(), 3, 'three tapes read at once');
  assert.equal(await page.evaluate(() => window.__booth.project.booth.measure), undefined, 'and nothing was written to the booth');
  await page.keyboard.press('Escape');
  assert.equal(await tapes(), 3, 'kept tapes stay after the tape is put away');
  await page.keyboard.press('t');
  await page.click('[data-action="clear-tapes"]');
  assert.equal(await tapes(), 0, 'Clear tapes clears them');
  await at(0.4, 0.4); await at(0.6, 0.4);
  await page.uncheck('#keep-tapes');
  await at(0.4, 0.6); await at(0.6, 0.6);
  assert.equal(await tapes(), 1, 'with Keep off, one tape at a time as before');
  await page.keyboard.press('Escape');

  // ---- The show floor: a right-drag box, drawn --------------------------
  await page.click('[data-action="mode-show"]');
  const svg = await page.locator('#show-floor svg').boundingBox();
  const h0 = await hall();
  const view0 = await page.evaluate(() => document.querySelector('#show-floor svg').getAttribute('viewBox'));
  await page.mouse.move(svg.x + 4, svg.y + 4);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(svg.x + svg.width * 0.55, svg.y + svg.height * 0.55, { steps: 8 });
  const marquee = page.locator('#show-floor .sf-marquee');
  assert.equal(await marquee.isVisible(), true, 'the box is drawn while the right-drag goes on');
  const mb = await marquee.boundingBox();
  assert.ok(mb.width > 100 && mb.height > 100, `and it is the size of the drag (${Math.round(mb.width)}×${Math.round(mb.height)})`);
  await page.mouse.up({ button: 'right' });
  assert.equal(await marquee.isVisible(), false, 'and goes when it ends');
  const picked = await page.evaluate(() => window.__booth.showEditor?.selection?.length ?? null);
  const status = await page.textContent('#inspector-content');
  assert.match(status, /\d+ selected/, 'the booths inside it are selected');
  assert.equal(await page.evaluate(() => document.querySelector('#show-floor svg').getAttribute('viewBox')), view0, 'a plain right-drag does not pan');
  assert.deepEqual((await hall()).items, h0.items, 'nor move anything');
  // Left-drag on empty floor draws it too (it never showed before).
  await page.mouse.move(svg.x + 3, svg.y + svg.height - 3);
  await page.mouse.down();
  await page.mouse.move(svg.x + 60, svg.y + svg.height - 60, { steps: 4 });
  assert.equal(await marquee.isVisible(), true, 'a left-drag box is drawn as well');
  await page.mouse.up();

  // ⌘ / Ctrl + right-drag pans, and the status bar says so.
  assert.match(await page.textContent('#gesture-hint'), /(⌘|Ctrl) right-drag to pan/);
  const mod = (await page.evaluate(() => /Mac/.test(navigator.platform))) ? 'Meta' : 'Control';
  await page.keyboard.down(mod);
  await page.mouse.move(svg.x + svg.width / 2, svg.y + svg.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(svg.x + svg.width / 2 + 120, svg.y + svg.height / 2 + 40, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await page.keyboard.up(mod);
  const view1 = await page.evaluate(() => document.querySelector('#show-floor svg').getAttribute('viewBox'));
  assert.notEqual(view1, view0, `${mod} + right-drag pans`);

  // The Pan tool on the floor: a left-drag over a booth pans, moves nothing.
  const h1 = await hall();
  await page.keyboard.press('h');
  const booth = await page.locator('#show-floor [data-kind="booth"]').first().boundingBox();
  await page.mouse.move(booth.x + booth.width / 2, booth.y + booth.height / 2);
  await page.mouse.down();
  await page.mouse.move(booth.x + booth.width / 2 + 90, booth.y + booth.height / 2 + 30, { steps: 5 });
  await page.mouse.up();
  assert.notEqual(await page.evaluate(() => document.querySelector('#show-floor svg').getAttribute('viewBox')), view1, 'the hand pans the floor');
  assert.deepEqual((await hall()).items, h1.items, 'and moves no booth');
  await page.keyboard.press('h');

  // ---- Flip horizontal ------------------------------------------------------
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Escape');
  const booths = (await hall()).items.filter((i) => i.kind === 'booth');
  const a = booths[0], b = booths.find((x) => x.y === a.y && x.x !== a.x);
  await page.evaluate(([ia, ib]) => window.__booth.showEditor.select([ia, ib]), [a.id, b.id]);
  await page.waitForTimeout(100);
  await page.click('#inspector-content [data-action="show-flip-x"]');
  const flipped = (await hall()).items;
  const fa = flipped.find((i) => i.id === a.id), fb = flipped.find((i) => i.id === b.id);
  assert.equal(fa.x, b.x, 'Flip horizontal swaps a pair left for right');
  assert.equal(fb.x, a.x);
  assert.equal((fa.rot || 0), ((360 - (a.rot || 0)) % 360), 'and mirrors its turn');
  await page.keyboard.press('Control+z');
  assert.equal((await hall()).items.find((i) => i.id === a.id).x, a.x, 'one undo step');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('view-tools2: PASS');
} finally {
  await browser.close();
  await server.close();
}
