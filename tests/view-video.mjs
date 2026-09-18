// Covers the video export end to end in a real browser: the UI, a real
// WebCodecs H.264 encode, the muxer's output parsed back as an MP4, and the
// promise every recording makes — that it leaves the camera exactly where it
// found it.
//
// H.264 encoding is not guaranteed in a headless sandbox: it depends on
// Chromium shipping a software encoder for this platform. When it is missing
// the suite says so and still checks everything up to the encode, because the
// alternative is a test that is skipped silently and rots.
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import assert from 'node:assert/strict';

const root = new URL('..', import.meta.url).pathname;
const server = await createServer({ root, server: { host: '127.0.0.1', port: 5194 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process', '--disable-dev-shm-usage'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.goto('http://127.0.0.1:5194');
  await page.waitForFunction(() => !!window.__booth?.scene);

  const supported = await page.evaluate(() => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined');
  assert.equal(supported, true, 'Chromium should expose WebCodecs; without it the UI below is the fallback copy');

  await page.click('[data-tab="export"]');
  const move = page.locator('#video-move');
  assert.equal(await move.count(), 1, 'the export panel offers a camera move');
  const moves = await move.locator('option').evaluateAll((os) => os.map((o) => o.value));
  assert.deepEqual(moves, ['orbit', 'push', 'reveal', 'survey'], `unexpected moves ${moves}`);

  // Choosing a move proposes the length it was designed around.
  await move.selectOption('push');
  await page.waitForFunction(() => document.querySelector('#video-seconds')?.value === '8', null, { timeout: 5000 });
  await move.selectOption('survey');
  await page.waitForFunction(() => document.querySelector('#video-seconds')?.value === '14', null, { timeout: 5000 });

  // Which codec this machine will actually encode, asked the way the app asks.
  // Open Chromium builds ship without H.264 encoding, which is the whole
  // reason the VP9 fallback exists — and the reason this suite can exercise the
  // real encoder-to-muxer pipeline here at all.
  const codec = await page.evaluate(async () => {
    const { pickCodec } = await import('/src/video.js');
    const chosen = await pickCodec({ width: 320, height: 240, framerate: 30, bitrate: 1e6 });
    return chosen && { codec: chosen.config.codec, kind: chosen.kind };
  });

  // The framing the recording must hand back untouched.
  const before = await page.evaluate(() => {
    const v = window.__booth.scene;
    return { position: v.camera.position.toArray(), target: v.controls.target.toArray(), fov: v.camera.fov, pixelRatio: v.renderer.getPixelRatio() };
  });

  if (!codec) {
    console.log('SKIP no video codec encodes in this sandbox; the UI and the muxer are still covered by tests/video.test.js.');
  } else {
    // A short clip at the smallest size: this is about correctness, and a
    // software encoder under swiftshader is slow.
    const result = await page.evaluate(async () => {
      const view = window.__booth.scene;
      const progress = [];
      const blob = await view.recordVideo({
        move: 'orbit', seconds: 1, fps: 24, size: 720,
        onProgress: (f) => progress.push(f),
      });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const dv = new DataView(bytes.buffer);
      const boxes = [];
      for (let o = 0; o < bytes.length; ) {
        const size = dv.getUint32(o);
        boxes.push({ type: String.fromCharCode(...bytes.slice(o + 4, o + 8)), size });
        if (size < 8) break;
        o += size;
      }
      // Walk moov/trak/mdia/minf/stbl to read the sample entry and the sample
      // count back out of the file that was just produced.
      const walk = (from, end, wanted) => {
        for (let o = from; o < end; ) {
          const size = dv.getUint32(o);
          if (size < 8) return null;
          const type = String.fromCharCode(...bytes.slice(o + 4, o + 8));
          if (type === wanted) return { start: o + 8, end: o + size };
          o += size;
        }
        return null;
      };
      const moov = boxes.reduce((at, b) => (b.type === 'moov' ? at : at + b.size), 0);
      let level = walk(moov + 8, bytes.length, 'trak');
      for (const type of ['mdia', 'minf', 'stbl']) level = walk(level.start, level.end, type);
      const stsd = walk(level.start, level.end, 'stsd');
      const entryStart = stsd.start + 8; // version, flags, entry count
      const entry = String.fromCharCode(...bytes.slice(entryStart + 4, entryStart + 8));
      const configuration = String.fromCharCode(...bytes.slice(entryStart + 8 + 78 + 4, entryStart + 8 + 78 + 8));
      const stsz = walk(level.start, level.end, 'stsz');
      const samples = dv.getUint32(stsz.start + 8);
      return { type: blob.type, bytes: bytes.length, boxes, progress, frames: progress.length, entry, configuration, samples };
    });
    assert.equal(result.type, 'video/mp4', 'the recording is an MP4');
    assert.deepEqual(result.boxes.map((b) => b.type), ['ftyp', 'mdat', 'moov'], `top-level boxes were ${JSON.stringify(result.boxes)}`);
    assert.ok(result.bytes > 2000, `a 1-second clip should be more than 2 kB, got ${result.bytes}`);
    assert.equal(result.frames, 24, `24 frames at 24fps for one second, got ${result.frames}`);
    assert.equal(result.progress.at(-1), 1, 'progress finishes at 100%');
    for (let i = 1; i < result.progress.length; i++)
      assert.ok(result.progress[i] > result.progress[i - 1], 'progress only moves forward');
    // mdat must actually hold encoded video, not an empty container.
    const mdat = result.boxes.find((b) => b.type === 'mdat');
    assert.ok(mdat.size > 1000, `mdat holds only ${mdat.size} bytes, so nothing was encoded`);

    // The sample entry has to name the codec that is actually in the file, and
    // carry its configuration box. This is the assertion that a synthetic
    // muxer test cannot make: the bytes came from a real VideoEncoder.
    assert.equal(result.entry, codec.kind === 'vp09' ? 'vp09' : 'avc1', `sample entry was ${result.entry}`);
    assert.equal(result.configuration, codec.kind === 'vp09' ? 'vpcC' : 'avcC', `configuration box was ${result.configuration}`);
    assert.equal(result.samples, result.frames, 'every rendered frame reached the sample table');
    console.log(`     encoded ${result.frames} frames with ${codec.codec} into ${(result.bytes / 1024).toFixed(0)} kB, as ${result.entry}/${result.configuration}`);
  }

  // The recording drives the user's own camera, so it has to give it back.
  const after = await page.evaluate(() => {
    const v = window.__booth.scene;
    return { position: v.camera.position.toArray(), target: v.controls.target.toArray(), fov: v.camera.fov, pixelRatio: v.renderer.getPixelRatio(), looping: !!v.renderer.info };
  });
  for (const key of ['position', 'target']) {
    for (let i = 0; i < 3; i++)
      assert.ok(Math.abs(after[key][i] - before[key][i]) < 1e-6, `${key} axis ${i} came back as ${after[key][i]}, was ${before[key][i]}`);
  }
  assert.equal(after.fov, before.fov, 'the field of view is restored');
  assert.equal(after.pixelRatio, before.pixelRatio, 'the preview pixel ratio is restored');

  // And the canvas must be back at viewport size, still animating.
  const live = await page.evaluate(async () => {
    const view = window.__booth.scene;
    const first = view.renderer.info.render.frame;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { advanced: view.renderer.info.render.frame > first, width: view.renderer.domElement.clientWidth };
  });
  assert.equal(live.advanced, true, 'the live render loop is running again');
  assert.ok(live.width > 300, `the canvas came back at ${live.width}px`);

  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS video export: camera moves, WebCodecs encode, MP4 container and camera restoration.');
} finally {
  await browser.close();
  await server.close();
}
