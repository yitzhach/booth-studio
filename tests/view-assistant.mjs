// The studio assistant's panel in Booth Studio (src/studio-assistant.js,
// Art-Talk-Back phase-5-booth.md 9c), in a real browser. The studio and the
// assistant are routed: /assistant/status says whether one is connected,
// /assistant/chat streams the assistant's events (server-sent, as
// studio-assistant sends them), and /v1/assistant/* holds the cards. The
// bridge is a stand-in recording what the panel asks of it.
//
// No real model runs here: what the assistant says is scripted. What is
// proven is the panel: where it shows, what it sends (the booth on screen as
// the chat's record), a card in the studio's own lines, Confirm and Undo each
// followed by a sync, "Open it" for a booth the assistant made, and plain
// words when the assistant isn't there.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5241 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
const sse = (events) => events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const PLACEMENT = '01J00000000000000000000BTH';
const card = (id, action, details) => ({
  id, action, summary: 'Table 2′ left; booth 15′ wide', status: 'pending', expiresAt: new Date(Date.now() + 3600e3).toISOString(), details,
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  const sent = [], confirmed = [], undone = [];
  let available = true, chat = null;
  await page.route('**/assistant/status', (r) => r.fulfill({ json: { available } }));
  await page.route('**/assistant/chat', async (r) => {
    sent.push(JSON.parse(r.request().postData()));
    if (!chat) return r.fulfill({ status: 404, json: { error: { code: 'not_found', message: 'no' } } });
    await r.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: sse(chat) });
  });
  await page.route('**/v1/assistant/thread', (r) => r.fulfill({ json: { threadId: '01J0000000000000000000THRD', messages: [] } }));
  await page.route('**/v1/assistant/proposals?status=all', (r) => r.fulfill({ json: { items: [] } }));
  await page.route('**/v1/assistant/proposals/*/confirm', (r) => {
    const id = r.request().url().split('/').at(-2);
    confirmed.push(id);
    const built = id === 'card-build';
    r.fulfill({ json: {
      proposal: { id, action: built ? 'placement.build' : 'placement.edit', status: 'confirmed' },
      result: { id: built ? '01J0000000000000000000NEWB' : PLACEMENT },
      activityIds: [`act-${id}`],
    } });
  });
  await page.route('**/v1/activity/*/undo', (r) => {
    undone.push(r.request().url().split('/').at(-2));
    r.fulfill({ json: { ok: true } });
  });

  await page.goto('http://127.0.0.1:5241');
  await page.waitForFunction(() => !!window.__booth?.scene);
  const mount = () => page.evaluate(async () => {
    window.__bridge = { synced: 0, opened: null };
    const bridge = {
      onStatus(fn) { window.__bridge.paint = fn; return () => {}; },
      sync: async () => { window.__bridge.synced++; },
      placementId: async () => '01J00000000000000000000BTH',
      openBooth: (id) => { window.__bridge.opened = id; },
    };
    const host = { project: () => window.__booth.project };
    const { mount } = await import('/src/studio-assistant.js');
    await mount(bridge, host);
  });
  const shown = () => page.evaluate(() => {
    const el = document.querySelector('studio-assistant');
    return !!el && !el.hidden && getComputedStyle(el).display !== 'none';
  });
  const inPanel = (sel) => page.locator(`studio-assistant >> ${sel}`);

  // ---- Where it shows -------------------------------------------------------
  await mount();
  assert.equal(await shown(), false, 'signed out: no panel');
  await page.evaluate(() => {
    localStorage.setItem('booth.studio', JSON.stringify({ signedIn: true, email: 'owner@example.com', synced: true }));
    window.__bridge.paint();
  });
  assert.equal(await shown(), true, 'signed in, with an assistant connected: the button shows');
  await page.evaluate(() => {
    localStorage.setItem('booth.studio', JSON.stringify({ signedIn: true, email: 'owner@example.com', synced: true, expired: true }));
    window.__bridge.paint();
  });
  assert.equal(await shown(), false, 'a sign-in the studio ended: hidden');
  await page.evaluate(() => {
    localStorage.setItem('booth.studio', JSON.stringify({ signedIn: true, email: 'owner@example.com', synced: true }));
    document.querySelector('studio-assistant').remove();
  });
  available = false;
  await mount();
  assert.equal(await shown(), false, 'no assistant connected to this copy (production before its first deploy): hidden');
  available = true;
  await page.evaluate(() => document.querySelector('studio-assistant').remove());
  await mount();
  assert.equal(await shown(), true);
  const launch = page.locator('studio-assistant >> .launch');
  const box = await launch.boundingBox();
  assert.ok(box.x > 640 && box.y + box.height <= 900 - 40, `the button sits bottom right, clear of the footer: ${JSON.stringify(box)}`);

  // ---- A change proposed, confirmed, undone ---------------------------------
  await launch.click();
  await page.waitForFunction(() => !document.querySelector('studio-assistant').shadowRoot.querySelector('.panel').hidden);
  chat = [
    { type: 'text', text: 'Here is the change.' },
    { type: 'card', proposal: card('card-edit', 'placement.edit', [
      { label: 'Action', value: 'Change things inside a Booth Studio booth' },
      { label: 'Booth', value: 'Spring booth' },
      { label: 'Change 1', value: 'Table 6′ with cloth: to 2′ left of centre, 2′ 6″ toward the front' },
      { label: 'Change 2', value: 'Make the booth 15′ wide × 10′ deep' },
    ]) },
    { type: 'end', reason: 'end_turn' },
  ];
  await inPanel('textarea').fill('slide the table two feet left and make the booth 10 by 15');
  await inPanel('textarea').press('Enter');
  await inPanel('[data-card="card-edit"]').waitFor();
  const body = sent.at(-1);
  assert.equal(body.app, 'booth-studio');
  assert.equal(body.message, 'slide the table two feet left and make the booth 10 by 15');
  assert.deepEqual(body.record, { type: 'placement', id: PLACEMENT, label: await page.evaluate(() => window.__booth.project.name) },
    'the booth on screen goes with the message');
  const lines = await inPanel('[data-card="card-edit"] dd').allTextContents();
  assert.deepEqual(lines.slice(1), ['Spring booth', 'Table 6′ with cloth: to 2′ left of centre, 2′ 6″ toward the front', 'Make the booth 15′ wide × 10′ deep']);
  assert.equal(await inPanel('.msg.bot').last().textContent(), 'Here is the change.');
  assert.equal(await page.evaluate(() => window.__bridge.synced), 0, 'nothing saved, nothing synced, before the tap');
  await inPanel('[data-card="card-edit"] button.primary').click();
  await inPanel('[data-card="card-edit"] .status:text("Saved.")').waitFor();
  assert.deepEqual(confirmed, ['card-edit']);
  await page.waitForFunction(() => window.__bridge.synced === 1);
  await inPanel('[data-card="card-edit"] button:text("Undo")').click();
  await inPanel('[data-card="card-edit"] .status:text("Undone.")').waitFor();
  assert.deepEqual(undone, ['act-card-edit']);
  await page.waitForFunction(() => window.__bridge.synced === 2, null, { timeout: 5000 });
  assert.equal(await inPanel('[data-card="card-edit"] button:text("Open it")').count(), 0, 'an edit has no Open it');

  // ---- A booth made, opened in one tap --------------------------------------
  chat = [
    { type: 'card', proposal: card('card-build', 'placement.build', [{ label: 'Action', value: 'Make a new Booth Studio booth' }, { label: 'Booth', value: 'New 10 × 15 ft booth' }]) },
    { type: 'end', reason: 'end_turn' },
  ];
  await inPanel('textarea').fill('make me a new 10x15 art show booth');
  await inPanel('textarea').press('Enter');
  await inPanel('[data-card="card-build"] button.primary').click();
  await inPanel('[data-card="card-build"] button:text("Open it")').click();
  assert.equal(await page.evaluate(() => window.__bridge.opened), '01J0000000000000000000NEWB');

  // ---- Plain words when the assistant isn't there ---------------------------
  chat = null;
  await inPanel('textarea').fill('hello there');
  await inPanel('textarea').press('Enter');
  await inPanel('.note:text("The assistant isn’t switched on here yet.")').waitFor();

  // Finish-my-sentence from the booth's own names.
  await page.evaluate(() => window.__booth.mutate(() => (window.__booth.project.name = 'Winter Park corner booth')));
  await launch.click();
  await launch.click();
  await inPanel('textarea').fill('make Winter');
  await inPanel('textarea').press('Tab');
  assert.equal(await inPanel('textarea').inputValue(), 'make Winter Park corner booth');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS the assistant shows only signed in where one is connected, sends the booth on screen with each message, shows a card in the studio\'s words, syncs after Confirm and Undo, opens a booth it made in one tap, and says plainly when it isn\'t there.');
} finally {
  await browser.close();
  await server.close();
}
