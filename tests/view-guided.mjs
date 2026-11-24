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
const controls = (page) => page.evaluate(() => [...new Set([...document.querySelectorAll('.inspector button, .inspector input, .inspector select, .inspector textarea, .inspector a[href]')]
  .filter((el) => !el.closest('.sheet-toggle') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && el.type !== 'hidden')
  .map((el) => (el.type === 'radio' ? `radio:${el.name}` : el.dataset.action || el.dataset.tab || el.dataset.guided || el.dataset.field || el.tagName.toLowerCase())))]);
const step = (page) => page.evaluate(() => document.querySelector('#inspector-content .guided')?.dataset.step || null);
const noSideways = (page, what) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth).then((d) => assert.ok(d <= 1, `${what}: ${d}px of sideways scroll`));
const settle = (page) => page.waitForFunction(() => document.querySelector('#save-status')?.textContent !== 'Saving…');

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
    await page.click('#inspector-content [data-action="guided-back"]');
    assert.equal(await step(page), 'hang', `${at}: Back returns a step`);
    // Add my pictures files the pictures and keeps the step on screen.
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
