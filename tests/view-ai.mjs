// The AI-render hook in a real browser: the frame, its depth pass and its
// surface mask rendered through one camera at one size, the mask painted
// only in the legend's colours, the depth a grey ramp, the scene left as it
// was afterwards; the pack downloaded from Export and from the 3D show; and
// Render with AI saying no provider is set up.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

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

  // Reads the three passes back as pixels and sums them up.
  const passes = () =>
    page.evaluate(async () => {
      const { SURFACES } = await import('/src/ai-render.js');
      const s = window.__booth.scene;
      const before = { background: s.scene.background, override: s.scene.overrideMaterial };
      const out = await s.renderPasses(480);
      const read = async (blob) => {
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const g = c.getContext('2d');
        g.drawImage(bmp, 0, 0);
        return { w: bmp.width, h: bmp.height, d: g.getImageData(0, 0, bmp.width, bmp.height).data };
      };
      const [beauty, depth, mask] = [await read(out.beauty), await read(out.depth), await read(out.mask)];
      const legend = Object.entries(SURFACES).map(([k, v]) => [k, [1, 3, 5].map((i) => parseInt(v.color.slice(i, i + 2), 16))]);
      legend.push(['none', [0, 0, 0]]);
      const found = {};
      let matched = 0;
      const n = mask.d.length / 4;
      for (let i = 0; i < mask.d.length; i += 4) {
        const px = [mask.d[i], mask.d[i + 1], mask.d[i + 2]];
        const hit = legend.find(([, c]) => c.every((v, k) => Math.abs(v - px[k]) <= 6));
        if (hit) (matched++, (found[hit[0]] = (found[hit[0]] || 0) + 1));
      }
      let grey = 0,
        lo = 255,
        hi = 0;
      for (let i = 0; i < depth.d.length; i += 4) {
        const [r, g, b] = [depth.d[i], depth.d[i + 1], depth.d[i + 2]];
        if (Math.abs(r - g) <= 2 && Math.abs(g - b) <= 2) grey++;
        lo = Math.min(lo, r);
        hi = Math.max(hi, r);
      }
      return {
        sizes: [beauty, depth, mask].map((x) => [x.w, x.h]),
        matched: matched / n,
        found,
        grey: grey / n,
        lo,
        hi,
        range: out.depthRange,
        restored: s.scene.background === before.background && s.scene.overrideMaterial === before.override,
        wallMaterial: s.wallObjects[0]?.material?.type,
      };
    });

  // ---- The booth ------------------------------------------------------------
  let r = await passes();
  assert.deepEqual(r.sizes[0], r.sizes[1], 'the depth pass is the frame\'s size');
  assert.deepEqual(r.sizes[0], r.sizes[2], 'and so is the mask');
  assert.equal(Math.max(...r.sizes[0]), 480);
  assert.ok(r.matched > 0.97, `the mask is only the legend's colours (${(r.matched * 100).toFixed(1)}%)`);
  assert.ok(r.found.artwork > 100, `the artwork is in the mask (${JSON.stringify(r.found)})`);
  assert.ok(r.found.wall > 100 && r.found.floor > 100, 'walls and floor are');
  assert.ok(r.grey > 0.99, 'the depth pass is grey');
  assert.ok(r.hi > 200 && r.lo < 40, `and spans the grey range (${r.lo}..${r.hi})`);
  assert.ok(r.range.near > 0 && r.range.far > r.range.near);
  assert.ok(r.restored, 'the scene is put back');
  assert.equal(r.wallMaterial, 'MeshStandardMaterial', 'every material too');

  // ---- The pack from Export --------------------------------------------------
  await page.click('[data-tab="export"]');
  assert.ok(await page.locator('.ai-legend .ai-swatch').count() >= 10, 'the legend is shown');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('[data-action="ai-pack"]')]);
  const pack = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.equal(pack.kind, 'booth-studio/ai-render-pack');
  for (const k of ['beauty', 'depth', 'mask', 'protect']) assert.match(pack.images[k], /^data:image\/png;base64,/, k);
  // The protected pass: the artwork opaque, the rest see-through.
  const kept = await page.evaluate(async (src) => {
    const bmp = await createImageBitmap(await (await fetch(src)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
    let opaque = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) opaque++;
    return opaque / (d.length / 4);
  }, pack.images.protect);
  assert.ok(kept > 0.01 && kept < 0.5, `the protected pass is the artwork alone (${(kept * 100).toFixed(1)}% opaque)`);
  assert.equal(Math.max(pack.width, pack.height), 1536, 'the default size');
  assert.match(pack.description, /^A 10 ft × 10 ft/);
  assert.ok(pack.camera.position.length === 3 && pack.camera.far > pack.camera.near);
  await page.click('[data-action="ai-render"]');
  await page.waitForFunction(() => /No AI provider is set up/.test(document.querySelector('#toast').textContent));

  // ---- The 3D show -------------------------------------------------------------
  await page.click('[data-action="mode-show"]');
  await page.click('[data-action="show-3d"]');
  r = await passes();
  assert.ok(r.matched > 0.97, `the show's mask is the legend's colours too (${(r.matched * 100).toFixed(1)}%)`);
  assert.ok(r.found.drape > 50, `the other booths' drapes are marked (${JSON.stringify(r.found)})`);
  assert.ok(r.hi > 150 && r.lo < 60, `depth spans the floor (${r.lo}..${r.hi})`);
  const [download2] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('[data-action="ai-pack"]')]);
  const showPack = JSON.parse(await readFile(await download2.path(), 'utf8'));
  assert.match(showPack.description, /An indoor exhibition hall/);
  // Kept for a look by eye.
  for (const [name, p] of [['booth', pack], ['show', showPack]])
    for (const k of ['beauty', 'depth', 'mask']) await writeFile(`/tmp/ai-${name}-${k}.png`, Buffer.from(p.images[k].split(',')[1], 'base64'));
  // After all that, the 3D show still draws as itself.
  const back = await page.evaluate(() => {
    const s = window.__booth.scene;
    return s.scene.overrideMaterial === null && s.scene.background?.isColor && s.scene.background.getHexString() !== '000000';
  });
  assert.ok(back, 'the show is put back');

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS the frame, its depth pass and its surface mask render at one size through one camera, the mask in the legend\'s colours and the depth a full grey ramp, the scene put back after; the pack downloads from Export and from the 3D show; Render with AI says no provider is set up.');
} finally {
  await browser.close();
  await server.close();
}
