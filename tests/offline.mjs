// Opens with no signal (public/sw.js, ROADMAP.md 1.7), in a real browser
// against the built app — `npm run build` first; the dev server, which the
// view suites drive, never registers the worker.
//
// Opened once with the network, given the Outdoor fair look (a grass floor
// and a photographed sky, so a texture, an HDRI and a chunk loaded on demand)
// and saved on this device; then the network cut, as on a show floor: the app
// must open again with that booth, its floor and its sky, every file from the
// worker. A booth link must still get the app. Back online, the page must come
// from the network, not the copy, and a redirect must be followed; a kept
// texture a day old is looked at again by its ETag; and when the network
// answers with an error, or too slowly, the kept page must stand in.
import { chromium } from "@playwright/test";
import { preview } from "vite";
import assert from "node:assert/strict";

const root = new URL("..", import.meta.url).pathname;
const PORT = 5263;
// The server's side: how often the page itself was asked for, and switches
// that make it answer slowly, like one bar of signal, with an error, or with
// a redirect.
let pageHits = 0;
let slowPage = false;
let failPage = false;
let movedPage = false;
// And every texture asked of it: whether "changed since?" with an ETag, and its answer.
const looks = [];
const server = await preview({
  root,
  logLevel: "warn",
  preview: { host: "127.0.0.1", port: PORT, strictPort: true },
  plugins: [
    {
      name: "page-counter",
      configurePreviewServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url.startsWith("/assets/textures/"))
            res.on("finish", () => looks.push({ path: req.url.split("?")[0], etag: req.headers["if-none-match"] || null, status: res.statusCode }));
          next();
        });
        s.middlewares.use((req, res, next) => {
          if (req.method !== "GET" || !(req.url === "/" || req.url.startsWith("/?"))) return next();
          pageHits++;
          if (failPage) {
            res.statusCode = 503;
            res.end("Service unavailable");
          } else if (movedPage) {
            res.statusCode = 302;
            res.setHeader("Location", "/manifest.webmanifest");
            res.end();
          } else if (slowPage) setTimeout(next, 15000);
          else next();
        });
      },
    },
  ],
});
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--use-gl=angle", "--in-process-gpu", "--single-process", "--disable-dev-shm-usage"],
});
const url = `http://127.0.0.1:${PORT}/`;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // Past the first visit's welcome (src/roles.js); about:blank has no storage.
  await context.addInitScript(() => location.protocol === "http:" && localStorage.setItem("booth.role", "all"));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  const grass = () => page.evaluate(() => window.BOOTH_ASSETS?.grass?.state || null);

  await page.goto(url);
  await page.waitForSelector("#scene canvas");
  // The worker installs once the page has loaded, keeps the page and every
  // file of the build, and takes the page over.
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 60000 });
  const kept = await page.evaluate(async () => {
    const out = {};
    for (const n of await caches.keys()) out[n] = (await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname);
    return { out, script: (await navigator.serviceWorker.getRegistration())?.active?.scriptURL };
  });
  assert.match(kept.script, /\/sw\.js\?v=[\w]+$/, "registered under the build's commit");
  assert.deepEqual(kept.out["booth-shell"], ["/"], "the page is kept");
  const build = kept.out["booth-build"] || [];
  for (const re of [/^\/assets\/index-[\w-]+\.js$/, /^\/assets\/three-[\w-]+\.js$/, /\.css$/, /^\/assets\/HDRLoader-[\w-]+\.js$/, /^\/assets\/studio-[\w-]+\.js$/, /\.woff2$/])
    assert.ok(build.some((p) => re.test(p)), `kept on install: ${re} — ${build.join(", ")}`);

  // The Outdoor fair look: a grass floor and the art fair's photographed sky.
  await page.click('[data-tab="lighting"]');
  await page.click('[data-action="look-fair"]');
  await page.waitForFunction(() => window.BOOTH_ASSETS?.grass?.state === "loaded", null, { timeout: 60000 });
  await page.fill("#project-name", "Offline booth");
  await page.press("#project-name", "Tab");
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector("#save-status")?.textContent || ""));
  // The sky's files are kept as they are used.
  await page.waitForFunction(async () => {
    const media = (await (await caches.open("booth-media")).keys()).map((r) => new URL(r.url).pathname);
    return media.some((p) => p.endsWith("/hdri/artfair/light.hdr")) && media.some((p) => p.includes("/textures/grass/"));
  }, null, { timeout: 60000 });

  // No signal: it opens again, with that booth, its floor and its sky, from the worker.
  const offline = [];
  const failed = [];
  const watch = (r) => offline.push({ path: new URL(r.url()).pathname, status: r.status(), worker: r.fromServiceWorker() });
  // The page's own GETs: Chromium reports every HEAD as aborted once it has
  // answered 200 — with or without a worker, checked — and the 200s are
  // checked below.
  const fail = (r) => r.method() === "HEAD" || r.serviceWorker() || failed.push(new URL(r.url()).pathname);
  page.on("response", watch);
  page.on("requestfailed", fail);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("#scene canvas");
  await page.waitForFunction(() => document.querySelector("#project-name")?.value === "Offline booth", null, { timeout: 30000 });
  await page.waitForFunction(() => window.BOOTH_ASSETS?.grass?.state === "loaded", null, { timeout: 60000 });
  await page.waitForFunction(() => performance.getEntriesByType("resource").some((e) => e.name.endsWith("/hdri/artfair/light.hdr")), null, { timeout: 60000 });
  await page.waitForTimeout(1000);
  page.off("response", watch);
  page.off("requestfailed", fail);
  assert.equal(await grass(), "loaded", "the grass floor, offline");
  for (const re of [/^\/$/, /^\/assets\/index-/, /^\/assets\/three-/, /^\/assets\/HDRLoader-/, /\/hdri\/artfair\/light\.hdr$/, /\/textures\/grass\//]) {
    const hit = offline.find((r) => re.test(r.path));
    assert.ok(hit && hit.status === 200 && hit.worker, `${re} from the worker, offline: ${JSON.stringify(hit)}`);
  }
  assert.deepEqual(failed.filter((p) => p.startsWith("/assets/")), [], "no file of the app failed offline");

  // A booth link, offline, still gets the app (its booth can't come without the network).
  await page.goto(`${url}?share=0123456789abcdef`);
  await page.waitForSelector("#scene canvas");

  // Back online: the page comes from the network, not the copy.
  await context.setOffline(false);
  const before = pageHits;
  await page.goto(url);
  await page.waitForSelector("#scene canvas");
  assert.ok(pageHits > before, "online, the page is asked of the network");

  // A day on, a kept texture is looked at again by its ETag: unchanged, the
  // site answers 304, and the kept copy is good for another day. The
  // browser's own cache would ask that by itself while it still holds the
  // file, so it is emptied first (what the worker kept stays), as a phone's
  // soon is.
  await (await context.newCDPSession(page)).send("Network.clearBrowserCache");
  const aged = await page.evaluate(async () => {
    const media = await caches.open("booth-media");
    const req = (await media.keys()).find((r) => r.url.includes("/textures/grass/"));
    const kept = await media.match(req);
    const headers = new Headers(kept.headers);
    headers.set("x-booth-kept", "0");
    await media.put(req, new Response(await kept.blob(), { status: kept.status, headers }));
    return new URL(req.url).pathname;
  });
  looks.length = 0;
  await page.evaluate((p) => fetch(p).then((r) => r.blob()), aged);
  await page.waitForFunction(async (p) => Number((await (await caches.open("booth-media")).match(p))?.headers.get("x-booth-kept")) > 0, aged, { timeout: 30000 });
  const look = looks.find((l) => l.path === aged);
  assert.ok(look?.etag && look.status === 304, `${aged} looked at by its ETag and found unchanged: ${JSON.stringify(looks)}`);

  // The network answers with an error (a 503 from the edge): the kept page at
  // once — not the error, and not after the slow network's wait.
  // Timed from a blank page to the page's answer ("commit"): putting this
  // WebGL page away takes seconds of its own under swiftshader.
  await page.goto("about:blank");
  failPage = true;
  const asked = pageHits;
  const erred = Date.now();
  const answered = await page.goto(url, { waitUntil: "commit" });
  const tookErr = Date.now() - erred;
  failPage = false;
  assert.ok(pageHits > asked, "the network was asked, and answered 503");
  assert.equal(answered.status(), 200, "the kept page, not the 503");
  assert.ok(tookErr < 2000, `at once, not after the worker's 4 s wait: ${tookErr} ms`);
  await page.waitForSelector("#scene canvas");

  // The site sends the page elsewhere (a new address, a sign-in): followed,
  // not covered with the kept page.
  movedPage = true;
  await page.goto(url, { waitUntil: "commit" });
  movedPage = false;
  assert.equal(new URL(page.url()).pathname, "/manifest.webmanifest", "the redirect, not the kept page");

  // One bar of signal: the network takes 15 s; the kept page stands in after the worker's 4.
  // (Last: the slow answer is still on its way when the suite ends.)
  slowPage = true;
  const started = Date.now();
  await page.goto(url, { timeout: 30000 });
  await page.waitForSelector("#scene canvas");
  const took = Date.now() - started;
  slowPage = false;
  assert.ok(took < 12000, `opened in ${took} ms on a network that took 15 s`);

  assert.deepEqual(errors, [], "no page errors, online or off");
  console.log(`PASS The built app keeps its page and every file of its build in a service worker under the build's commit; with the network cut it opens again with the booth saved here, its grass floor and its photographed sky, every file from the worker; a booth link still gets the app; online the page comes from the network, a redirect is followed and a day-old texture is looked at again by its ETag (a 304); and on a network that answers with an error, or too slowly, the kept page stands in (${took} ms).`);
} finally {
  await browser.close();
  await server.close();
}
