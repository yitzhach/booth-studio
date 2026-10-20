// Opens with no signal (public/sw.js, ROADMAP.md 1.7), in a real browser
// against the built app — `npm run build` first; the dev server, which the
// view suites drive, never registers the worker. Opened once with the
// network, the booth renamed and saved on this device; then the network cut,
// as on a show floor: the app must open again, with that booth as it was
// saved, and a booth link must still get the app. The share itself needs the
// network, and says so; that is not this suite's.
import { chromium } from "@playwright/test";
import { preview } from "vite";
import assert from "node:assert/strict";

const root = new URL("..", import.meta.url).pathname;
const PORT = 5263;
const server = await preview({ root, logLevel: "warn", preview: { host: "127.0.0.1", port: PORT, strictPort: true } });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--use-gl=angle", "--in-process-gpu", "--single-process", "--disable-dev-shm-usage"],
});
const url = `http://127.0.0.1:${PORT}/`;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(() => localStorage.setItem("booth.role", "all")); // past the first visit's welcome (src/roles.js)
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack || e.message));

  await page.goto(url);
  await page.waitForSelector("#scene canvas");
  // The worker installs once the page has loaded, keeps the page and its
  // files, and takes the page over.
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 60000 });
  const kept = await page.evaluate(async () => {
    const names = await caches.keys();
    const out = {};
    for (const n of names) out[n.replace(/-[^-]+$/, "")] = (await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname);
    return { names, out, script: (await navigator.serviceWorker.getRegistration())?.active?.scriptURL };
  });
  assert.match(kept.script, /\/sw\.js\?v=[\w]+$/, "registered under the build's commit");
  assert.deepEqual(kept.out["booth-shell"], ["/"], "the page is kept");
  const build = kept.out["booth-build"] || [];
  assert.ok(build.some((p) => /^\/assets\/index-[\w-]+\.js$/.test(p)), `the app's script is kept: ${build.join(", ")}`);
  assert.ok(build.some((p) => /^\/assets\/three-[\w-]+\.js$/.test(p)), "and three.js's");
  assert.ok(build.some((p) => /\.css$/.test(p)), "and the stylesheet");

  // A booth of this device's own, saved.
  await page.fill("#project-name", "Offline booth");
  await page.press("#project-name", "Tab");
  await page.waitForFunction(() => /Saved on this device/.test(document.querySelector("#save-status")?.textContent || ""));

  // No signal: it opens again, with that booth.
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("#scene canvas");
  await page.waitForFunction(() => document.querySelector("#project-name")?.value === "Offline booth", null, { timeout: 30000 });
  // A booth link, offline, still gets the app (its booth can't come without the network).
  await page.goto(`${url}?share=0123456789abcdef`);
  await page.waitForSelector("#scene canvas");

  // With the network back, the page comes from the network again, not the copy.
  await context.setOffline(false);
  const fresh = await page.goto(url);
  assert.equal(fresh.fromServiceWorker(), true, "pages go through the worker");
  await page.waitForSelector("#scene canvas");

  assert.deepEqual(errors, [], "no page errors, online or off");
  console.log("PASS The built app keeps its page, scripts and stylesheet in a service worker under the build's commit, and with the network cut it opens again with the booth saved here, and a booth link still gets the app.");
} finally {
  await browser.close();
  await server.close();
}
