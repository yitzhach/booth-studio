// Show Hub phase 1 in a real browser: Send my booth to the promoter uploads
// the booth and shows a link; the link, opened, puts that booth on a floor
// booth with its original images, or opens it to look at. /api/* is routed
// to the real Worker code (worker/index.js) over an in-memory bucket.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { handleApi } from '../worker/index.js';
import { fakeR2 } from './helpers/fake-r2.js';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5234 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
try {
  const env = { SHARES: fakeR2() };
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await page.route('**/api/**', async (route) => {
    const r = route.request();
    const res = await handleApi(new Request(r.url(), { method: r.method(), headers: r.headers(), body: ['GET', 'HEAD'].includes(r.method()) ? undefined : r.postData() }), env);
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: await res.text() });
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5234');
  await page.waitForFunction(() => !!window.__booth?.scene);

  // ---- The exhibitor shares their booth ------------------------------------
  await page.evaluate(() => window.__booth.mutate(() => (window.__booth.project.booth.color = '#335577')));
  const art = await page.evaluate(() => window.__booth.project.art.filter((a) => a.asset).length);
  await page.click('[data-tab="export"]');
  await page.click('[data-action="share-design"]');
  await page.waitForSelector('#share-link');
  const link = await page.inputValue('#share-link');
  assert.match(link, /\/\?booth=[a-z0-9]{24}$/, 'a link to this site');
  const stored = [...env.SHARES.store.keys()];
  assert.ok(stored.some((k) => k.endsWith('manifest.json')), 'the manifest is on the server');
  assert.equal(stored.filter((k) => k.includes('/assets/')).length, await page.evaluate(() => {
    const p = window.__booth.project, t = JSON.stringify({ b: p.booth, a: p.art, l: p.lights, m: p.ambient, v: p.views });
    return Object.keys(p.assets).filter((id) => t.includes(JSON.stringify(id))).length;
  }), 'with exactly the images the booth names');
  await page.click('#share-copy');
  await page.click('#share-close');

  // ---- The promoter: a floor of their own, then the link -------------------
  await page.evaluate(() => window.__booth.mutate(() => (window.__booth.project.booth.color = '#111111')));
  await page.click('[data-action="mode-show"]');
  await page.evaluate(() => window.__booth.save());
  await page.goto(link.replace(/^https?:\/\/[^/]+/, 'http://127.0.0.1:5234'));
  await page.waitForSelector('#share-place');
  assert.ok(!(await page.evaluate(() => location.search.includes('booth='))), 'the link is taken off the address');
  await page.selectOption('#share-number', '104');
  await page.click('#share-place');
  await page.waitForFunction(() => !!window.__booth.project.hall?.designs?.[104]);
  const landed = await page.evaluate(() => {
    const p = window.__booth.project, d = p.hall.designs[104];
    return { color: d.booth.color, art: d.art.filter((a) => a.asset).length, originals: d.art.every((a) => !a.asset || p.assets[a.asset]?.data?.length > (p.assets[a.asset]?.thumb?.length || 0)) };
  });
  assert.equal(landed.color, '#335577', 'the exhibitor\'s booth is on 104');
  assert.equal(landed.art, art, 'with all its work');
  assert.ok(landed.originals, 'Pro gets the original images, not the previews');
  assert.equal(await page.evaluate(() => window.__booth.project.booth.color), '#111111', 'the promoter\'s own booth is untouched');

  // ---- Look at it: the booth opens as its own project ----------------------
  await page.goto(link.replace(/^https?:\/\/[^/]+/, 'http://127.0.0.1:5234'));
  await page.waitForSelector('#share-look');
  const dl = page.waitForEvent('download');
  await page.click('#share-look');
  await dl;
  assert.equal(await page.evaluate(() => window.__booth.project.booth.color), '#335577');
  assert.match(await page.evaluate(() => window.__booth.project.name), /shared/);

  // ---- A dead link says so --------------------------------------------------
  await page.goto('http://127.0.0.1:5234/?booth=aaaaaaaaaaaaaaaaaaaaaaaa');
  await page.waitForFunction(() => /could not be opened/.test(document.querySelector('#toast')?.textContent || ''));

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS a booth is shared as a link with exactly its images, the link puts it on a promoter\'s floor booth with its originals or opens it to look at, comes off the address, and a dead link says so.');
} finally {
  await browser.close();
  await server.close();
}
