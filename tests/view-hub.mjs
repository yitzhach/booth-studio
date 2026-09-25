// Show Hub v0 in a real browser: an exhibitor sends their booth as a design
// file from the Export tab; a promoter imports it onto a floor booth, it
// lands there with its images, opens as that booth, replaces a design only
// after a confirm, and undo takes it off again; the same file dropped on a
// floor booth lands on that booth.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5233 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5233');
  await page.waitForFunction(() => !!window.__booth?.scene);
  const hall = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__booth.project.hall || null)));

  // ---- The exhibitor: Export → Send my booth to the promoter ---------------
  await page.evaluate(() => window.__booth.mutate(() => (window.__booth.project.booth.color = '#335577')));
  const artCount = await page.evaluate(() => window.__booth.project.art.length);
  await page.click('[data-tab="export"]');
  const dl = page.waitForEvent('download');
  await page.click('[data-action="send-design"]');
  const download = await dl;
  assert.match(download.suggestedFilename(), /\.booth-design\.json$/);
  const path = await download.path();
  const file = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(file.kind, 'booth-studio/booth-design');
  assert.equal(file.design.booth.color, '#335577');
  assert.ok(!file.design.hall && !file.photo, 'the design alone, not the project');

  // ---- The promoter: a floor, booth 104, Import a booth design ------------
  await page.evaluate(() => window.__booth.mutate(() => (window.__booth.project.booth.color = '#111111')));
  await page.click('[data-action="mode-show"]');
  await page.locator('#show-floor [data-hall-booth="104"]').click();
  let chooser = page.waitForEvent('filechooser');
  await page.click('[data-action="import-design"]');
  await (await chooser).setFiles(path);
  await page.waitForFunction(() => !!window.__booth.project.hall?.designs?.[104]);
  let h = await hall();
  assert.equal(h.designs['104'].booth.color, '#335577', 'the design lands on booth 104');
  assert.equal(h.designs['104'].art.length, artCount, 'with all its work');
  const missing = await page.evaluate(() => window.__booth.project.hall.designs[104].art.filter((a) => a.asset && !window.__booth.project.assets[a.asset]).length);
  assert.equal(missing, 0, 'and every image it names');
  assert.match(await page.textContent('.show-design'), /its own design/, 'the panel shows it linked');

  // ---- A second import onto 104 asks first ----------------------------------
  chooser = page.waitForEvent('filechooser');
  await page.click('[data-action="import-design"]');
  await (await chooser).setFiles(path);
  await page.waitForSelector('#confirm-go');
  assert.match(await page.textContent('#dialog'), /Replace booth 104/);
  await page.click('#confirm-go');

  // ---- Opened, it is that exhibitor's booth ---------------------------------
  await page.click('[data-action="show-open-booth"]');
  assert.equal(await page.evaluate(() => window.__booth.project.booth.color), '#335577');
  assert.equal(await page.evaluate(() => window.__booth.project.hall.open), 104);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  h = await hall();
  assert.ok(!h?.designs?.['104'], 'undo takes the imported design off again');

  // ---- A backup is refused with the right advice ---------------------------
  await page.click('[data-action="mode-show"]').catch(() => {});
  await page.locator('#show-floor [data-hall-booth="105"]').click();
  const backupPath = path + '.backup.json';
  await (await import('node:fs/promises')).writeFile(backupPath, await page.evaluate(() => JSON.stringify(window.__booth.project)));
  chooser = page.waitForEvent('filechooser');
  await page.click('[data-action="import-design"]');
  await (await chooser).setFiles(backupPath);
  await page.waitForFunction(() => /whole project backup/.test(document.querySelector('#toast')?.textContent || ''));

  // ---- The file dropped straight on a booth ---------------------------------
  const drop = async (type, x, y) => {
    const dt = await page.evaluateHandle((text) => {
      const d = new DataTransfer();
      d.items.add(new File([text], 'jane.booth-design.json', { type: 'application/json' }));
      return d;
    }, JSON.stringify(file));
    await page.locator('#show-floor').dispatchEvent(type, { dataTransfer: dt, clientX: x, clientY: y, bubbles: true, cancelable: true });
  };
  const b106 = await page.locator('#show-floor [data-hall-booth="106"]').boundingBox();
  const [cx, cy] = [b106.x + b106.width / 2, b106.y + b106.height / 2];
  await drop('dragover', cx, cy);
  assert.ok(await page.locator('#show-floor [data-hall-booth="106"]').evaluate((g) => g.classList.contains('sf-drop')), 'the booth under the file is outlined');
  await drop('drop', cx, cy);
  await page.waitForFunction(() => !!window.__booth.project.hall?.designs?.[106]);
  assert.equal((await hall()).designs['106'].booth.color, '#335577', 'a file dropped on booth 106 lands there');
  assert.equal(await page.locator('#show-floor .sf-drop').count(), 0, 'the outline goes with the drop');
  const floorBox = await page.locator('#show-floor').boundingBox();
  await drop('drop', floorBox.x + 4, floorBox.y + 4);
  await page.waitForFunction(() => /Drop a booth design file on a booth/.test(document.querySelector('#toast')?.textContent || ''));

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS a booth is sent as a design file, imported onto a floor booth with its images, replaced only after a confirm, opens as that booth, is undone, a backup handed in by mistake is named as one, and the file dropped on a booth lands on that booth.');
} finally {
  await browser.close();
  await server.close();
}
