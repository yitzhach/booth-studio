// Sign-in with a password instead of the emailed code (Art-Talk-Back D-080),
// in a real browser, with the studio routed: the header's Sign in button opens
// Studio account, "Use my password" signs in, and signed in the account sets,
// changes and removes the password. No real studio-api runs here.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5243 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  const me = (hasPassword) => ({ user: { id: 'U1', email: 'isaac@example.com', name: null }, memberships: [{ studioId: 'S1', studioName: 'Studio', role: 'owner', clientId: null }], activeStudioId: 'S1', hasPassword });
  let hasPassword = true;
  const puts = [];
  await page.route('**/v1/**', async (r) => {
    const url = new URL(r.request().url()), m = r.request().method();
    if (url.pathname === '/v1/auth/password/login') {
      const b = JSON.parse(r.request().postData());
      return b.password === 'harbour mural 2026'
        ? r.fulfill({ json: me(true) })
        : r.fulfill({ status: 400, json: { error: { code: 'bad_request', message: "That email and password don't match. You can always sign in with an emailed code." } } });
    }
    if (url.pathname === '/v1/auth/password' && m === 'PUT') { puts.push(JSON.parse(r.request().postData()).password); hasPassword = true; return r.fulfill({ status: 204 }); }
    if (url.pathname === '/v1/auth/password' && m === 'DELETE') { hasPassword = false; return r.fulfill({ status: 204 }); }
    if (url.pathname === '/v1/me') return r.fulfill({ json: me(hasPassword) });
    if (url.pathname.startsWith('/v1/sync')) return r.fulfill({ json: { changes: [], cursor: '0', hasMore: false } });
    return r.fulfill({ json: { items: [], data: [] } });
  });
  await page.route('**/assistant/status', (r) => r.fulfill({ json: { available: false } }));

  await page.goto('http://127.0.0.1:5243');
  await page.waitForFunction(() => !!window.__booth?.scene);
  await page.locator('header button.avatar').click();
  await page.locator('#st-email').fill('isaac@example.com');
  await page.locator('#st-pw-show').click();
  await page.locator('#st-pw').fill('wrong');
  await page.locator('#st-pw-go').click();
  await page.waitForFunction(() => /don't match/.test(document.querySelector('#st-msg')?.textContent || ''));
  await page.locator('#st-pw').fill('harbour mural 2026');
  await page.locator('#st-pw').press('Enter');
  await page.locator('#st-signed-in').waitFor();
  await page.waitForFunction(() => document.querySelector('header button.avatar')?.textContent === 'I');
  await page.waitForFunction(() => document.querySelector('#st-setpw')?.textContent === 'Change password');
  assert.equal(await page.locator('#st-rmpw').isVisible(), true, 'with a password, Remove shows');

  await page.locator('#st-newpw').fill('short');
  await page.locator('#st-setpw').click();
  assert.match(await page.locator('#st-pw-msg').textContent(), /10 characters/);
  assert.equal(puts.length, 0, 'a short password is never sent');
  await page.locator('#st-rmpw').click();
  await page.waitForFunction(() => document.querySelector('#st-setpw')?.textContent === 'Set password');
  await page.locator('#st-newpw').fill('a much longer one');
  await page.locator('#st-setpw').click();
  await page.waitForFunction(() => /Password set/.test(document.querySelector('#st-pw-msg')?.textContent || ''));
  assert.deepEqual(puts, ['a much longer one']);
  assert.deepEqual(errors, []);
  console.log('PASS the header Sign in opens Studio account; a password signs in (a wrong one says so plainly); signed in, a password is set, refused under 10 characters, and removed');
} finally {
  await browser.close();
  await server.close();
}
