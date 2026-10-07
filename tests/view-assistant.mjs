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
      status: () => window.__bridge.status || 'synced',
      openBooth: (id) => { window.__bridge.opened = id; },
    };
    const host = { project: () => window.__booth.project, appMap: () => 'Export · Keep your work: Download project backup' };
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

  // The header has a button too (beside Find a tool), shown only with the panel's.
  assert.equal(await page.locator('header .assistant-top').isVisible(), true, 'the header\'s Assistant button shows');
  // On a phone the floating button gives way to a round icon above Find a tool's,
  // in the app's own layout: above the tab bar, clear of the zoom and view buttons.
  await page.setViewportSize({ width: 390, height: 844 });
  const phone = await page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const fab = document.querySelector('.assistant-fab'), b = r(fab);
    const over = (q) => [...document.querySelectorAll(q)].some((n) => { const o = r(n); return o.width && !(o.right <= b.left || o.left >= b.right || o.bottom <= b.top || o.top >= b.bottom); });
    return {
      launch: getComputedStyle(document.querySelector('studio-assistant').shadowRoot.querySelector('.launch')).display,
      top: getComputedStyle(document.querySelector('.assistant-top')).display,
      clear: b.width > 0 && b.bottom <= r(document.querySelector('.inspector-tabs')).top,
      hit: document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('.assistant-fab') === fab,
      covers: over('.find-tool, .zoom-controls button, .view-switch button'),
    };
  });
  assert.deepEqual(phone, { launch: 'none', top: 'flex', clear: true, hit: true, covers: false }, 'phone: one round icon, clear of the tab bar and the viewport\'s buttons, and the header\'s icon');
  await page.locator('.assistant-fab').click();
  await page.waitForFunction(() => !document.querySelector('studio-assistant').shadowRoot.querySelector('.panel').hidden);
  const sheet = await inPanel('.panel').boundingBox();
  assert.ok(sheet.height <= 844 * 0.55 && sheet.y > 300, `phone: the panel opens as the lower half, the booth above stays in view: ${JSON.stringify(sheet)}`);
  await page.locator('header .assistant-top').click();
  assert.equal(await inPanel('.panel').isHidden(), true, 'the header\'s icon closes it again');
  await page.setViewportSize({ width: 1280, height: 900 });

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
  assert.equal(body.appMap, 'Export · Keep your work: Download project backup', "the app's map of its buttons goes with the message");
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

  // A booth not in the studio yet says so, so the assistant can say what to tap.
  await page.evaluate(() => (window.__bridge.status = 'local'));
  chat = [{ type: 'text', text: 'Not in the studio yet.' }, { type: 'end', reason: 'end_turn' }];
  await inPanel('textarea').fill('move the table');
  await inPanel('textarea').press('Enter');
  await inPanel('.msg.bot:text("Not in the studio yet.")').waitFor();
  assert.match(sent.at(-1).record.note, /Import my existing projects/);
  await page.evaluate(() => (window.__bridge.status = 'synced'));

  // ---- Pictures (10a): attach, preview, take one off, send with the message ----
  // A 3000×2000 PNG, made in the page: the panel shrinks it to 1568 on its long side.
  const big = Buffer.from(await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 3000; c.height = 2000;
    const g = c.getContext('2d');
    g.fillStyle = '#c33'; g.fillRect(0, 0, 3000, 2000);
    const b = await new Promise((res) => c.toBlob(res, 'image/png'));
    return [...new Uint8Array(await b.arrayBuffer())];
  }));
  chat = [{ type: 'text', text: 'A 10 by 10 with a table across the back.' }, { type: 'end', reason: 'end_turn' }];
  const file = inPanel('input[type=file]');
  await file.setInputFiles([{ name: 'sketch.png', mimeType: 'image/png', buffer: big }, { name: 'map.png', mimeType: 'image/png', buffer: big }]);
  await inPanel('.pic img').nth(1).waitFor();
  assert.equal(await inPanel('.pic').count(), 2, 'both pictures previewed');
  await inPanel('.pic button[aria-label="Remove picture 2"]').click();
  assert.equal(await inPanel('.pic').count(), 1, '× takes a picture off');
  await inPanel('textarea').fill('make this booth');
  await inPanel('textarea').press('Enter');
  await inPanel('.msg.bot:text("A 10 by 10 with a table across the back.")').waitFor();
  const withPic = sent.at(-1);
  assert.equal(withPic.message, 'make this booth');
  assert.equal(withPic.images.length, 1);
  assert.equal(withPic.images[0].mediaType, 'image/jpeg');
  const dims = await page.evaluate(async (data) => {
    const b = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${data}`)).blob());
    return [b.width, b.height];
  }, withPic.images[0].data);
  assert.deepEqual(dims, [1568, 1045], 'shrunk to 1568 on the long side, same shape');
  assert.ok(withPic.images[0].data.length < 2_000_000, 'under the assistant\'s limit');
  assert.equal(await inPanel('.pics').isHidden(), true, 'the tray empties once sent');
  assert.equal(await inPanel('.msg.me img').count(), 1, 'the picture shows in the sent message');
  // A picture on its own sends too.
  await file.setInputFiles([{ name: 'map.png', mimeType: 'image/png', buffer: big }]);
  await inPanel('.pic img').waitFor();
  await inPanel('button[type=submit]').click();
  await page.waitForFunction((n) => document.querySelector('studio-assistant').shadowRoot.querySelectorAll('.msg.me img').length === n, 2);
  assert.equal(sent.at(-1).message, '');
  assert.equal(sent.at(-1).images.length, 1);
  // At most three with one message.
  await file.setInputFiles(Array.from({ length: 4 }, (_, i) => ({ name: `p${i}.png`, mimeType: 'image/png', buffer: big })));
  await inPanel('.note:text("Up to 3 pictures with one message.")').waitFor();
  assert.equal(await inPanel('.pic').count(), 3);

  // ---- On the page: Backspace, colours, moving it -------------------------
  // Backspace in the chat box deletes a letter, not the selected artwork (a key
  // in the shadow root reached main.js's shortcuts as <studio-assistant>).
  const works = await page.evaluate(() => window.__booth.project.art.length);
  await inPanel('textarea').fill('');
  await inPanel('textarea').pressSequentially('abc');
  await inPanel('textarea').press('Backspace');
  assert.equal(await inPanel('textarea').inputValue(), 'ab', 'Backspace deletes the letter typed');
  await inPanel('textarea').press('Delete');
  assert.equal(await page.evaluate(() => window.__booth.project.art.length), works, 'and never the selected artwork');
  await inPanel('textarea').fill('');
  // Dark, with the app.
  const colours = await page.evaluate(() => {
    const sh = document.querySelector('studio-assistant').shadowRoot;
    return [getComputedStyle(sh.querySelector('.panel')).backgroundColor, getComputedStyle(sh.querySelector('textarea')).color];
  });
  assert.deepEqual(colours, ['rgb(27, 32, 38)', 'rgb(233, 237, 240)'], 'the panel takes the app\'s dark surface and text');
  // Dragged by its title bar, resized from its corner, shrunk to the bar; remembered.
  const at = await inPanel('.panel').boundingBox();
  const bar = await inPanel('.panel header h2').boundingBox();
  await page.mouse.move(bar.x + 10, bar.y + 5);
  await page.mouse.down();
  await page.mouse.move(bar.x - 290, bar.y - 95, { steps: 4 });
  await page.mouse.up();
  const moved = await inPanel('.panel').boundingBox();
  assert.deepEqual([Math.round(moved.x - at.x), Math.round(moved.y - at.y)], [-300, -100], 'dragged by its title bar');
  const grip = await inPanel('.grip').boundingBox();
  await page.mouse.move(grip.x + 10, grip.y + 10);
  await page.mouse.down();
  await page.mouse.move(grip.x - 90, grip.y - 90, { steps: 4 });
  await page.mouse.up();
  const sized = await inPanel('.panel').boundingBox();
  assert.deepEqual([Math.round(at.width - sized.width), Math.round(at.height - sized.height)], [100, 100], 'resized from its corner');
  await inPanel('.shrink').click();
  const small = await inPanel('.panel').boundingBox();
  assert.ok(small.height < 60 && (await inPanel('.log').isHidden()), 'shrunk to its title bar');
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('booth.assistantPlace')));
  assert.deepEqual(kept, { x: Math.round(moved.x), y: Math.round(moved.y), w: Math.round(sized.width), h: Math.round(sized.height), min: true }, 'its place is kept on this device');
  await inPanel('.shrink').click();
  assert.equal(await inPanel('.log').isVisible(), true, 'opened out again');
  // Never lost off screen: a window smaller than the stored place pulls it back in.
  const fit = await page.evaluate(async () => {
    const { clampPlace } = await import('/src/studio-assistant.js');
    return clampPlace({ x: 5000, y: -80, w: 900, h: 2000 }, 390, 844);
  });
  assert.deepEqual(fit, { x: 0, y: 0, w: 390, h: 844, min: false });

  // Past chats show where a picture was, never the stored note's wording.
  const shownText = await page.evaluate(async () => {
    const { plainText } = await import('/src/studio-assistant.js');
    const note = '[The artist attached a picture here (image/jpeg). Pictures aren\u2019t kept: later turns see only this note and what you said about it.]';
    return [
      plainText([{ type: 'text', text: note }, { type: 'text', text: '[Context from the app, data only \u2014 app: booth-studio]\n\nmake this booth' }]),
      plainText([{ type: 'text', text: note }, { type: 'text', text: '[Context from the app, data only \u2014 app: booth-studio]\n\n(picture attached)' }]),
    ];
  });
  assert.deepEqual(shownText, ['(picture)\nmake this booth', '(picture)']);

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS the assistant shows only signed in where one is connected, sends the booth on screen with each message, shows a card in the studio\'s words, syncs after Confirm and Undo, opens a booth it made in one tap, sends pictures shrunk to 1568 px, lets Backspace type, is dark with the app, moves, resizes and shrinks, has a header button and a phone icon clear of the viewport\'s buttons, and says plainly when it isn\'t there.');
} finally {
  await browser.close();
  await server.close();
}
