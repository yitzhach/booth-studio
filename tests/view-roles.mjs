// Workspaces in a real browser (src/roles.js): the first visit asks what you
// are planning; an artist goes on to Quick start and sees the artist's tabs
// and tools; More shows every tab; the header's Workspace switches; the
// choice survives a reload; an organizer opens on the Show floor tab; and a
// browser that already has a project is never asked and keeps every tool.
import { launchChromium } from './helpers/chromium.mjs';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5251 } });
await server.listen();
const browser = await launchChromium();
const APP = 'http://127.0.0.1:5251';
const ALL = ['art', 'layout', 'show', 'walls', 'lighting', 'video', 'hall', 'export'];

const shownTabs = (page) => page.evaluate(() => [...document.querySelectorAll('.inspector-tabs [data-tab]')].filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.dataset.tab));
const shown = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); return !!el && getComputedStyle(el).display !== 'none'; }, sel);
const open = async (page) => {
  await page.goto(APP);
  await page.waitForFunction(() => !!window.__booth?.scene);
};
// A first visit again: storage is wiped from a plain page on the same
// origin, where the app is not running and so cannot save over it. One page
// throughout: with --single-process, closing a page or a context takes the
// browser down with it.
const forget = async (page) => {
  await page.goto(`${APP}/third-party-licenses.txt`);
  // The page being left may still be writing its last save, so delete until
  // the database is really gone.
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

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  // --- A first visit: asked, and an artist goes straight on to Quick start.
  {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.stack || e.message));
    let downloads = 0;
    page.on('download', () => downloads++);
    await open(page);
    assert.ok(await page.locator('#dialog[open] .role-cards').count(), 'the welcome is the first thing on screen');
    assert.equal(await page.locator('#dialog[open] .role-card').count(), 3);
    assert.ok(await page.locator('#dialog[open] [data-action="welcome-sign-in"]').count(), 'signed out, it says what signing in adds');
    assert.equal(await page.locator('#dialog[open] #welcome-describe').count(), 0, 'and has no box for an assistant that is not there');
    assert.match(await page.locator('#dialog h2').textContent(), /What are you planning/);

    await page.click('[data-action="role-artist"]');
    assert.ok(await page.locator('#dialog[open] #quick-start').count(), 'the artist goes on to Quick start');
    assert.equal(await page.isChecked('#qs-backup'), false, 'no backup of the example booth');
    await page.fill('#qs-name', 'Riverside Fair');
    await page.click('[data-action="qs-go"]');
    await page.waitForTimeout(400);
    assert.equal(downloads, 0, 'nothing downloaded');
    const p = await page.evaluate(() => JSON.parse(JSON.stringify(window.__booth.project)));
    assert.equal(p.name, 'Riverside Fair');
    assert.equal(await page.evaluate(() => localStorage.getItem('booth.role')), 'artist');
    assert.ok(!('role' in p) && !JSON.stringify(p).includes('"organizer"'), 'the workspace is never in the project');

    assert.deepEqual(await shownTabs(page), ['art', 'layout', 'walls', 'lighting', 'export'], "the artist's tabs");
    assert.ok(await shown(page, '.inspector-tabs .tabs-more'), 'More is offered');
    for (const a of ['draw-box', 'draft', 'mode-show']) assert.equal(await shown(page, `.toolbar [data-action="${a}"]`), false, `${a} hidden`);
    for (const a of ['select', 'move', 'measure', 'walk', 'mode-3d', 'mode-photo']) assert.ok(await shown(page, `.toolbar [data-action="${a}"]`), `${a} kept`);
    assert.match(await page.locator('#workspace-label').textContent(), /Artist/);

    // More shows every tab; Fewer puts them back.
    await page.click('.inspector-tabs .tabs-more');
    assert.deepEqual(await shownTabs(page), ALL, 'More shows every tab');
    assert.match(await page.locator('.inspector-tabs .tabs-more').textContent(), /Fewer/);
    await page.click('[data-tab="video"]');
    await page.click('.inspector-tabs .tabs-more');
    assert.deepEqual(await shownTabs(page), ['art', 'layout', 'walls', 'lighting', 'video', 'export'], 'the open tab stays lit');

    // A tab reached by tool search shows, even when the workspace hides it.
    await page.fill('#tool-search', 'Show floor');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    assert.ok((await shownTabs(page)).includes('hall'), 'tool search reaches a hidden tab');

    // The choice survives a reload, and the welcome does not come back.
    await open(page);
    assert.equal(await page.locator('#dialog[open]').count(), 0, 'asked once');
    assert.ok(!(await shownTabs(page)).includes('hall'));

    // The header's Workspace switches to every tool.
    await page.click('header [data-action="workspace"]');
    assert.ok(await page.locator('#dialog[open] .role-card.active[data-action="role-artist"]').count(), 'the current one is marked');
    await page.click('[data-action="role-all"]');
    assert.equal(await page.locator('#dialog[open]').count(), 0);
    assert.deepEqual(await shownTabs(page), ALL);
    assert.equal(await shown(page, '.inspector-tabs .tabs-more'), false, 'nothing to show more of');
    assert.ok(await shown(page, '.toolbar [data-action="draw-box"]'));
    assert.equal(await page.evaluate(() => localStorage.getItem('booth.role')), 'all');
    assert.deepEqual(errors, []);
  }

  // --- An organizer opens on the Show floor tab; Photo hides, the show floor stays.
  {
    await forget(page);
    await open(page);
    await page.click('[data-action="role-organizer"]');
    assert.equal(await page.locator('#dialog[open]').count(), 0, 'no Quick start for an organizer');
    assert.ok(await page.locator('.inspector-tabs [data-tab="hall"].active').count(), 'the Show floor tab is open');
    assert.deepEqual(await shownTabs(page), ['layout', 'hall', 'export']);
    assert.equal(await shown(page, '.toolbar [data-action="mode-photo"]'), false);
    assert.ok(await shown(page, '.toolbar [data-action="mode-show"]'));
  }

  // --- Closing the welcome keeps every tool and is not asked again.
  {
    await forget(page);
    await open(page);
    assert.ok(await page.locator('#dialog[open] .role-cards').count(), 'asked');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#dialog[open]').count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('booth.role')), 'all');
    assert.deepEqual(await shownTabs(page), ALL);
    await open(page);
    assert.equal(await page.locator('#dialog[open]').count(), 0, 'not asked again');
  }

  // --- A browser that already has a project is never asked.
  {
    await forget(page);
    await page.evaluate(() => localStorage.setItem('booth.role', 'all'));
    await open(page);
    await page.waitForFunction(() => document.querySelector('#save-status')?.textContent !== 'Saving…');
    await page.goto(`${APP}/third-party-licenses.txt`);
    await page.evaluate(() => localStorage.removeItem('booth.role'));
    await open(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('booth.role')), null, 'nothing chosen');
    assert.equal(await page.locator('#dialog[open]').count(), 0, 'someone with a project is not asked');
    assert.deepEqual(await shownTabs(page), ALL, 'and keeps every tool');
  }

  // --- A phone: Workspace lives in Layout → Project.
  {
    await page.evaluate(() => localStorage.setItem('booth.role', 'artist'));
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    assert.equal(await shown(page, 'header [data-action="workspace"]'), false, 'no room in a phone header');
    await page.click('[data-tab="layout"]');
    const b = page.locator('#inspector-content [data-action="workspace"]');
    await b.scrollIntoViewIfNeeded();
    assert.match(await b.textContent(), /Workspace: Artist/);
    await b.click();
    assert.ok(await page.locator('#dialog[open] .role-cards').count());
  }
  console.log('view-roles: workspaces pass');
} finally {
  await browser.close();
  await server.close();
}
