// The guided booth in a real browser (DEMO_PHASE.md, task A2;
// src/ui/guided-panel.js): a first visit → My booth → Start this booth
// lands on step 1 in place of the tab strip; every step holds a handful of
// controls, not the Layout tab's hundred; Next walks to step 5 and Back
// returns; a reload comes back to the same step; All tools brings the five
// tabs back and stays chosen, and Guided beside More returns to the step;
// and someone with a saved project, in Every tool or in Show organizer
// never sees the steps. At a computer's width and at a phone's, with no
// sideways scroll.
import { launchChromium } from './helpers/chromium.mjs';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5262 } });
await server.listen();
const browser = await launchChromium();
const APP = 'http://127.0.0.1:5262';
const STEPS = ['booth', 'walls', 'light', 'hang', 'share'];

const open = async (page) => {
  await page.goto(APP);
  await page.waitForFunction(() => !!window.__booth?.scene);
};
// A first visit again, from a plain page on the same origin (as view-roles does).
const forget = async (page) => {
  await page.goto(`${APP}/third-party-licenses.txt`);
  await page.evaluate(async () => {
    localStorage.clear();
    for (let i = 0; i < 20; i++) {
      await new Promise((done) => {
        const q = indexedDB.deleteDatabase('artist-os-booth-studio');
        q.onsuccess = q.onerror = () => done();
      });
      await new Promise((r) => setTimeout(r, 100));
      if (!(await indexedDB.databases()).some((d) => d.name === 'artist-os-booth-studio')) return;
    }
    throw new Error('the database would not go');
  });
};
const visible = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'; }, sel);
const shownTabs = (page) => page.evaluate(() => [...document.querySelectorAll('.inspector-tabs [data-tab]')].filter((b) => b.getClientRects().length > 0).map((b) => b.dataset.tab));
// What a person can press or type into in the inspector, as they see it. A
// row of radio buttons (the layouts, the swatches) is one control: one stop
// for the keyboard, one choice for a screen reader.
const controls = (page) => page.evaluate(() => {
  const groups = new Set();
  return [...document.querySelectorAll('.inspector button, .inspector input, .inspector select, .inspector textarea, .inspector a[href]')]
    .filter((el) => !el.closest('.sheet-toggle') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && el.type !== 'hidden')
    .filter((el) => el.type !== 'radio' || (!groups.has(el.name) && groups.add(el.name)))
    .map((el) => (el.type === 'radio' ? `radio:${el.name}` : el.dataset.action || el.dataset.tab || el.dataset.guided || el.dataset.field || el.tagName.toLowerCase()));
});
const step = (page) => page.evaluate(() => document.querySelector('#inspector-content .guided')?.dataset.step || null);
const noSideways = (page, what) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth).then((d) => assert.ok(d <= 1, `${what}: ${d}px of sideways scroll`));
const settle = (page) => page.waitForFunction(() => document.querySelector('#save-status')?.textContent !== 'Saving…');

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  const counts = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));

  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const at = `${width}px`;
    await page.setViewportSize({ width, height });
    await forget(page);
    await open(page);

    // --- First visit → My booth → Start this booth: step 1, in place of the tabs.
    await page.click('[data-action="role-artist"]');
    await page.click('[data-action="qs-go"]');
    await page.waitForSelector('#inspector-content .guided');
    assert.equal(await step(page), 'booth', `${at}: Quick start opens step 1`);
    assert.equal(await page.evaluate(() => window.__booth.tab), 'guided');
    assert.equal(await visible(page, '.inspector-tabs'), false, `${at}: the tab strip makes way for the steps`);
    assert.equal(await page.evaluate(() => localStorage.getItem('booth.guided')), 'booth');
    assert.ok(!JSON.stringify(await page.evaluate(() => window.__booth.project)).includes('booth.guided'), 'never in the project');

    // --- Every step: a handful of controls; Next walks on to step 5.
    for (const [i, key] of STEPS.entries()) {
      assert.equal(await step(page), key, `${at}: step ${i + 1}`);
      const c = await controls(page);
      assert.ok(c.length <= 12, `${at}, ${key}: ${c.length} controls (${c.join(', ')})`);
      counts.push(`${key} ${c.length}`);
      assert.ok(c.includes('guided-all'), `${at}, ${key}: All tools is always there`);
      assert.equal(c.includes('guided-back'), i > 0, `${at}, ${key}: Back from step 2 on`);
      assert.equal(c.includes('guided-next'), i < STEPS.length - 1, `${at}, ${key}: Next until the last`);
      await noSideways(page, `${at}, ${key}`);
      if (i < STEPS.length - 1) {
        const next = page.locator('#inspector-content [data-action="guided-next"]');
        await next.scrollIntoViewIfNeeded();
        await next.click();
      }
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('booth.guided')), 'share');

    // --- Step 5 (A6): a picture named a rendering and the hanging guide, offline too;
    // the link asks before anything leaves the device.
    const saved = async (action) => {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 90000 }), page.click(`#inspector-content [data-action="${action}"]`)]);
      return dl.suggestedFilename();
    };
    const uploads = [];
    page.on('request', (r) => r.url().includes('/api/share') && uploads.push(r.url()));
    assert.match(await saved('guided-picture'), /-rendering-front\.png$/, `${at}: the picture's name says it is a rendering`);
    assert.match(await saved('guide'), /hanging-guide\.html$/, `${at}: the hanging guide`);
    await page.click('#inspector-content [data-action="guided-link"]');
    assert.ok(await page.locator('#dialog[open]').count(), `${at}: Send a link asks first`);
    assert.match(await page.locator('#dialog-content').textContent(), /uploaded/);
    await page.click('#confirm-cancel');
    assert.deepEqual(uploads, [], `${at}: nothing left the device`);
    await context.setOffline(true);
    assert.match(await saved('guided-picture'), /rendering/, `${at}: offline, the picture still saves`);
    assert.match(await saved('guide'), /hanging-guide/, `${at}: offline, the guide still saves`);
    await context.setOffline(false);
    assert.equal(await step(page), 'share', `${at}: still on the share step`);
    await page.click('#inspector-content [data-action="guided-back"]');
    assert.equal(await step(page), 'hang', `${at}: Back returns a step`);
    // The tabs' upload (#art-input), reached from the steps, files the pictures and keeps the step on screen.
    const png = Buffer.from(await page.evaluate(() => {
      const cv = document.createElement('canvas');
      cv.width = 64;
      cv.height = 48;
      cv.getContext('2d').fillRect(0, 0, 64, 48);
      return cv.toDataURL('image/png').split(',')[1];
    }), 'base64');
    const before = await page.evaluate(() => Object.keys(window.__booth.project.assets).length);
    await page.setInputFiles('#art-input', { name: 'harbour.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction((n) => Object.keys(window.__booth.project.assets).length > n, before);
    assert.equal(await step(page), 'hang', `${at}: an upload from the hang step stays in it`);

    // --- Add my pictures (A4): three at once, each one's width asked once, all hung.
    const shot = async (w, h, color) => Buffer.from(await page.evaluate(([w, h, c]) => {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const x = cv.getContext('2d');
      x.fillStyle = c;
      x.fillRect(0, 0, w, h);
      return cv.toDataURL('image/png').split(',')[1];
    }, [w, h, color]), 'base64');
    const pictures = [
      { name: 'harbour.png', mimeType: 'image/png', buffer: await shot(64, 48, '#a33') },
      { name: 'dunes.png', mimeType: 'image/png', buffer: await shot(48, 64, '#3a3') },
      { name: 'square.png', mimeType: 'image/png', buffer: await shot(50, 50, '#33a') },
    ];
    const count = () => page.evaluate(() => ({ art: window.__booth.project.art.length, assets: Object.keys(window.__booth.project.assets).length }));
    const before4 = await count();
    await page.setInputFiles('#guided-input', pictures);
    await page.waitForSelector('#dialog[open] #hang-form');
    assert.equal(await page.locator('#dialog .hang-row').count(), 3, `${at}: one row a picture`);
    for (const [i, w] of ['20', '30', '16'].entries()) await page.fill(`[data-hang="${i}"]`, w);
    assert.match(await page.locator('[data-hang-height="0"]').textContent(), /20″ × 15″/, `${at}: the height follows the shape`);
    await page.click('#hang-go');
    await page.waitForFunction((n) => window.__booth.project.art.length === n + 3, before4.art);
    const hung = await page.evaluate(() => {
      const p = window.__booth.project;
      const wallOf = (k) => (k.startsWith('panel:') ? p.booth.panels.find((x) => `panel:${x.id}` === k) : p.booth.walls[k]);
      const mine = p.art.slice(-3);
      const inBounds = mine.every((a) => { const w = wallOf(a.wall); return w && a.x >= 0 && a.y >= 0 && a.x + a.w <= w.width + 0.001 && a.y + a.h <= w.height + 0.001; });
      const hit = (a, b) => a.wall === b.wall && (a.face || 'inside') === (b.face || 'inside') && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const overlaps = p.art.some((a) => p.art.some((b) => a !== b && hit(a, b)));
      return { widths: mine.map((a) => a.w), titles: mine.map((a) => a.title), inBounds, overlaps, assets: mine.every((a) => !!p.assets[a.asset]) };
    });
    assert.deepEqual(hung.widths, [20, 30, 16], `${at}: each the width typed`);
    assert.deepEqual(hung.titles, ['harbour', 'dunes', 'square']);
    assert.ok(hung.inBounds, `${at}: none out of bounds`);
    assert.equal(hung.overlaps, false, `${at}: none overlapping`);
    assert.ok(hung.assets);
    assert.equal(await step(page), 'hang', `${at}: still on the hang step`);
    assert.match(await page.locator('#inspector-content .guided-count').textContent(), /\d+ works? on the walls/);
    // Space them evenly: every wall hung evenly, still inside its walls.
    await page.click('#inspector-content [data-action="guided-space"]');
    await page.waitForTimeout(200);
    assert.ok(await page.evaluate(() => window.__booth.project.art.slice(-3).every((a) => Math.abs(a.y + a.h / 2 - 60) < 0.5)), `${at}: on the 60″ line`);
    // Cancelling the size leaves the library and the walls as they were; an empty width is asked for.
    const before5 = await count();
    await page.setInputFiles('#guided-input', [pictures[0]]);
    await page.waitForSelector('#dialog[open] #hang-form');
    await page.click('#hang-go');
    assert.ok(await page.locator('#dialog[open] .hang-error:not([hidden])').count(), `${at}: a width is asked for`);
    await page.click('#hang-cancel');
    assert.equal(await page.locator('#dialog[open]').count(), 0);
    assert.deepEqual(await count(), before5, `${at}: Cancel adds nothing`);
    await page.click('[data-action="undo"]');
    await page.click('[data-action="undo"]');
    await page.waitForFunction((n) => window.__booth.project.art.length === n, before4.art);
    assert.equal(await page.evaluate(() => Object.keys(window.__booth.project.assets).length), before4.assets, `${at}: one undo takes the even spacing, one the whole hang`);

    // --- Step 1's own controls change the booth and keep it a booth.
    await page.click('#inspector-content [data-action="guided-back"]');
    await page.click('#inspector-content [data-action="guided-back"]');
    await page.click('#inspector-content [data-action="guided-back"]');
    assert.equal(await step(page), 'booth');
    await page.selectOption('#inspector-content [data-guided="size"]', '10x20');
    await page.waitForFunction(() => window.__booth.project.booth.width === 240);
    assert.equal(await step(page), 'booth', `${at}: a change keeps the step on screen`);
    await page.selectOption('#inspector-content [data-guided="show"]', 'artshow');
    await page.waitForFunction(() => window.__booth.project.booth.venue === 'artshow');
    assert.equal(await page.evaluate(() => window.__booth.project.booth.width), 240, `${at}: the size outlives a change of kind`);
    await page.fill('#inspector-content [data-guided="name"]', 'Harbour show');
    await page.press('#inspector-content [data-guided="name"]', 'Enter');
    await page.waitForFunction(() => window.__booth.project.name === 'Harbour show');
    await page.click('[data-action="undo"]');
    await page.waitForFunction(() => window.__booth.project.name !== 'Harbour show');
    assert.equal(await step(page), 'booth', `${at}: undo stays in the steps`);

    // --- Step 2: a layout from its plan, a colour from its swatch (A3).
    await page.click('#inspector-content [data-action="guided-next"]');
    assert.equal(await step(page), 'walls');
    assert.equal(await page.locator('#inspector-content .layout-card').count(), 4, `${at}: four layouts`);
    assert.equal(await page.locator('#inspector-content .layout-card svg line').count() >= 8, true, `${at}: each drawn as a plan`);
    assert.equal(await page.locator('#inspector-content input[data-guided="layout"][value="u"]').isChecked(), true, `${at}: a quick-started booth is a U`);
    await page.click('#inspector-content .layout-card:has(input[value="centre"])');
    await page.waitForFunction(() => (window.__booth.project.booth.panels || []).some((x) => x.id === 'layout-centre' && x.hidden !== true));
    assert.equal(await page.locator('#inspector-content input[data-guided="layout"][value="centre"]').isChecked(), true, `${at}: U with a centre wall puts a free-standing wall in the booth`);
    // Arrow keys move the focus along the layouts and build none; Enter builds the one in focus,
    // the keyboard stays on the row, and the mark only ever shows the booth's own layout.
    await page.focus('#inspector-content input[data-guided="layout"]:checked');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('value')), 'wings', `${at}: an arrow moves the focus`);
    assert.ok(await page.evaluate(() => window.__booth.project.booth.panels.some((x) => x.id === 'layout-centre')), `${at}: passing a layout does not build it`);
    assert.equal(await page.locator('#inspector-content input[data-guided="layout"][value="centre"]').isChecked(), true, `${at}: and the mark stays on the booth's layout`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__booth.project.booth.panels.filter((x) => x.id.startsWith('layout-wing')).length === 2);
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('value')), 'wings', `${at}: focus stays on the row`);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => window.__booth.project.booth.walls.right.enabled), true, `${at}: L passed, not built`);
    await page.click('#inspector-content .layout-card:has(input[value="l"])');
    await page.waitForFunction(() => window.__booth.project.booth.walls.right.enabled === false);
    await page.click('#inspector-content .layout-card:has(input[value="wings"])');
    await page.waitForFunction(() => window.__booth.project.booth.walls.right.enabled === true);
    await page.click('#inspector-content .swatch-choice:has(input[value="#263247"])');
    await page.waitForFunction(() => window.__booth.project.booth.color === '#263247');
    assert.equal(await page.locator('#inspector-content input[data-guided="color"][value="#263247"]').isChecked(), true, `${at}: Navy is marked`);
    const walls = await controls(page);
    assert.ok(walls.length <= 12, `${at}, walls with its choices made: ${walls.length}`);
    await page.click('[data-action="undo"]');
    await page.waitForFunction(() => window.__booth.project.booth.color !== '#263247');
    assert.equal(await step(page), 'walls', `${at}: undo stays in the step`);
    await noSideways(page, `${at}, walls`);
    await page.click('#inspector-content [data-action="guided-back"]');

    // --- Step 3: the four looks as cards and Make it beautiful, the Lighting tab's own (A5).
    await page.click('#inspector-content [data-action="guided-next"]');
    await page.click('#inspector-content [data-action="guided-next"]');
    assert.equal(await step(page), 'light');
    assert.equal(await page.locator('#inspector-content .look-grid [data-action^="look-"]').count(), 4, `${at}: four looks as cards`);
    const marked = () => page.evaluate(() => [...document.querySelectorAll('#inspector-content .look-grid [aria-current="true"]')].map((b) => b.dataset.action));
    const lookOf = () => page.evaluate(() => ({ env: window.__booth.project.booth.envPreset, ambient: window.__booth.project.ambient, lights: window.__booth.project.lights.map((l) => [l.kelvin, l.power, l.tx, l.ty, l.tz]) }));
    const start = { marked: await marked(), look: await lookOf() };
    await page.click('#inspector-content [data-action="look-gallery"]');
    await page.waitForFunction(() => window.__booth.project.ambient === 1.25 && window.__booth.project.booth.envPreset === 'studio');
    assert.deepEqual(await marked(), ['look-gallery'], `${at}: the look chosen is the booth's look`);
    await page.click('#inspector-content [data-action="look-evening"]');
    await page.waitForFunction(() => window.__booth.project.ambient === 0.8);
    assert.deepEqual(await marked(), ['look-evening'], `${at}: and the next one replaces it`);
    await page.click('[data-action="undo"]');
    await page.waitForFunction(() => window.__booth.project.ambient === 1.25);
    assert.deepEqual(await marked(), ['look-gallery'], `${at}: undo restores the look before`);
    assert.equal(await step(page), 'light', `${at}: undo stays in the step`);
    await page.click('[data-action="undo"]');
    await page.waitForFunction((a) => window.__booth.project.ambient === a, start.look.ambient);
    assert.deepEqual(await marked(), start.marked, `${at}: and the one before that`);
    assert.deepEqual(await lookOf(), start.look);
    await page.click('#inspector-content [data-action="polish"]');
    await page.waitForFunction(() => document.querySelectorAll('#inspector-content .look-grid [aria-current="true"]').length === 1);
    assert.equal(await step(page), 'light', `${at}: Make it beautiful keeps the step`);
    assert.notDeepEqual(await lookOf(), start.look, `${at}: Make it beautiful changed the light`);
    await page.click('[data-action="undo"]');
    assert.deepEqual(await lookOf(), start.look, `${at}: one undo puts all of it back`);
    assert.deepEqual(await marked(), start.marked);
    await page.click('#inspector-content [data-action="guided-back"]');
    await page.click('#inspector-content [data-action="guided-back"]');

    // --- A work clicked in the booth is selected; the step stays on screen.
    await page.evaluate(() => {
      window.__booth.project.art.push({ id: 'guided-w', title: 'Harbour', asset: null, wall: 'back', x: 10, y: 40, w: 24, h: 18, thickness: 1.5, offset: 0.5 });
      window.__booth.scene.onSelect('guided-w');
    });
    await page.waitForTimeout(200);
    assert.equal(await step(page), 'booth', `${at}: a work clicked in the booth keeps the step`);
    assert.equal(await page.evaluate(() => window.__booth.tab), 'guided');
    await page.evaluate(() => {
      window.__booth.scene.onSelect(null);
      window.__booth.project.art = window.__booth.project.art.filter((a) => a.id !== 'guided-w');
    });

    // --- A reload comes back to the same step.
    await page.click('#inspector-content [data-action="guided-next"]');
    await page.click('#inspector-content [data-action="guided-next"]');
    assert.equal(await step(page), 'light');
    await settle(page);
    await open(page);
    assert.equal(await page.locator('#dialog[open]').count(), 0, `${at}: no welcome on the way back`);
    assert.equal(await step(page), 'light', `${at}: a reload returns to the same step`);

    // --- A tab reached another way (tool search) brings the strip back, with Guided beside More.
    if (width > 700) {
      await page.fill('#tool-search', 'Hanging guide');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      assert.notEqual(await page.evaluate(() => window.__booth.tab), 'guided', 'tool search opens its tab');
      assert.ok(await visible(page, '.inspector-tabs'), 'the strip is back');
      assert.ok(await visible(page, '.inspector-tabs .tabs-guided'), 'Guided is beside More');
      await page.click('.inspector-tabs .tabs-guided');
      assert.equal(await step(page), 'light', 'Guided returns to the same step');
    }

    // --- All tools: the five tabs, opened where the step's tools live, and it stays chosen.
    const all = page.locator('#inspector-content [data-action="guided-all"]');
    await all.scrollIntoViewIfNeeded();
    await all.click();
    assert.equal(await step(page), null);
    // Step 1 made this an indoor booth, so Art show is among them.
    assert.deepEqual(await shownTabs(page), ['art', 'layout', 'show', 'walls', 'lighting', 'export'], `${at}: the artist's tabs are back`);
    assert.equal(await page.evaluate(() => window.__booth.tab), 'lighting', `${at}: All tools from Light opens Lighting`);
    assert.ok(await visible(page, '.inspector-tabs .tabs-guided'), `${at}: Guided beside More returns`);
    assert.equal(await page.evaluate(() => localStorage.getItem('booth.guided')), 'off');
    await settle(page);
    await open(page);
    assert.equal(await step(page), null, `${at}: All tools stays chosen across a reload`);
    // Quick start again: All tools was chosen, so the Layout tab as before.
    await page.click('.inspector-tabs [data-tab="layout"]');
    const qs = page.locator('#inspector-content [data-action="quick-start"]');
    await qs.scrollIntoViewIfNeeded();
    await qs.click();
    await page.click('[data-action="qs-go"]');
    await page.waitForTimeout(300);
    assert.equal(await step(page), null, `${at}: Quick start keeps All tools once it is chosen`);
    assert.equal(await page.evaluate(() => window.__booth.tab), 'layout');
    await page.click('.inspector-tabs .tabs-guided');
    assert.equal(await step(page), 'booth', `${at}: Guided starts again at step 1`);
    await noSideways(page, `${at}, back in the steps`);
  }

  // --- Never for Every tool, Show organizer, or someone who came with a project.
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const role of ['all', 'organizer']) {
    await forget(page);
    await open(page);
    await page.click(`[data-action="role-${role}"]`);
    await page.waitForTimeout(200);
    if (role === 'all') {
      await page.click('.inspector-tabs [data-tab="layout"]');
      const qs = page.locator('#inspector-content [data-action="quick-start"]');
      await qs.scrollIntoViewIfNeeded();
      await qs.click();
      await page.click('[data-action="qs-go"]');
      await page.waitForTimeout(300);
    }
    assert.equal(await step(page), null, `${role}: no steps`);
    assert.equal(await visible(page, '.inspector-tabs .tabs-guided'), false, `${role}: no Guided button`);
    // A stale step from another visit does not bring them back outside the Artist workspace.
    await page.evaluate(() => localStorage.setItem('booth.guided', 'walls'));
    await settle(page);
    await open(page);
    assert.equal(await step(page), null, `${role}: a remembered step stays hidden`);
  }
  {
    // A booth of their own from before, then the Artist workspace: Quick start keeps to Layout.
    await forget(page);
    await page.evaluate(() => localStorage.setItem('booth.role', 'all'));
    await open(page);
    await settle(page);
    await page.goto(`${APP}/third-party-licenses.txt`);
    await page.evaluate(() => localStorage.setItem('booth.role', 'artist'));
    await open(page);
    assert.equal(await step(page), null, 'a saved project opens as it was');
    await page.click('.inspector-tabs [data-tab="layout"]');
    const qs = page.locator('#inspector-content [data-action="quick-start"]');
    await qs.scrollIntoViewIfNeeded();
    await qs.click();
    await page.click('[data-action="qs-go"]');
    await page.waitForTimeout(300);
    assert.equal(await step(page), null, 'someone with a saved project is not put in the steps');
    assert.ok(await visible(page, '.inspector-tabs .tabs-guided'), 'but Guided is one tap away');
  }

  assert.deepEqual(errors, []);
  console.log(`view-guided: controls per step (1440 px, then 390 px): ${counts.join(' · ')}`);
  console.log('view-guided: the guided booth passes');
} finally {
  await browser.close();
  await server.close();
}
