/* ==========================================================================
   The studio platform's gate for Booth Studio, in a real browser: two
   devices, one studio, the network cut (Art-Talk-Back docs/phase-5-booth.md).

   Runs the built app (dist/) behind its real Worker (worker/index.js) and the
   real studio-api together under `wrangler dev` — one origin, as in
   production — against a fresh local D1 and R2, and drives browser contexts
   ("devices", each with its own storage) through the real pages:

     signed out   nothing calls /v1 and the studio code never loads.
     sign-in      the studio's email code, from inside Booth Studio.
     import       "Import my existing projects" moves this device's project
                  and its images into the studio once; running it again adds
                  nothing; the project from before sign-in isn't pushed until
                  then.
     device 2     opens the booth from the studio, images included.
     offline      an edit and a new image made with no network reach the
                  other device after a reconnect.
     conflict     the same booth edited on two offline devices: the studio
                  keeps its copy, the second device gets a card and can put
                  its own back.
     backup       a synced project downloads as a backup that a signed-out
                  copy of the app opens (schema 1 is forever).
     down         with the platform answering 503, the app keeps saving on the
                  device and catches up when it's back.
     ended        a sign-in the studio ends keeps the changes made since, and
                  signing in again sends them.

   The studio API lives in yitzhach/Art-Talk-Back. Point STUDIO_PLATFORM at a
   checkout of it with `pnpm install` done (default: ../Art-Talk-Back). The
   app's Worker runs from a temporary config bound to that checkout's dev API,
   so wrangler.jsonc stays production. BOOTH_COMPAT_DATE overrides the app's
   compatibility date (the platform pins 2026-08-15, its D-025; the app uses
   its own, read from wrangler.jsonc).

   Usage: npm run build && STUDIO_PLATFORM=../Art-Talk-Back \
          BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium node tests/two-devices.mjs
   ========================================================================== */
import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProject } from "../src/model.js";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(APP, process.env.STUDIO_PLATFORM || path.join("..", "Art-Talk-Back"));
const PORT = Number(process.env.E2E_PORT || 8792);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const EMAIL = "owner@example.com"; // OWNER_EMAILS in studio-api's dev config
const COMPAT =
  process.env.BOOTH_COMPAT_DATE ||
  /"compatibility_date"\s*:\s*"([^"]+)"/.exec(fs.readFileSync(path.join(APP, "wrangler.jsonc"), "utf8"))[1];

const fails = [];
let passed = 0;
function check(name, ok, detail) {
  if (ok) passed++;
  else fails.push(name + (detail ? ` — ${detail}` : ""));
  console.log((ok ? "  PASS  " : "  FAIL  ") + name + (detail ? `  — ${detail}` : ""));
}

/* ---- the server: app Worker + studio-api, fresh D1 ------------------------ */
/** JSON with comments and trailing commas (wrangler.jsonc) → a value. */
function readJsonc(file) {
  const src = fs.readFileSync(file, "utf8");
  let out = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j;
    } else if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i + 2) + 1;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}
/**
 * studio-api's own dev config, with its paths made absolute and a throwaway
 * SIGNING_KEY: file links (image uploads and downloads) need one, and the
 * checkout's .dev.vars is never committed (its CLAUDE.md: no secrets).
 */
function apiConfig(state) {
  const dir = path.join(ROOT, "workers", "studio-api");
  const c = readJsonc(path.join(dir, "wrangler.jsonc"));
  delete c.$schema;
  delete c.env;
  c.main = path.join(dir, c.main);
  c.vars = { ...c.vars, SIGNING_KEY: "booth-two-devices-test-key-not-a-secret" };
  for (const d of c.d1_databases) d.migrations_dir = path.join(dir, d.migrations_dir);
  const file = path.join(state, "studio-api.wrangler.json");
  fs.writeFileSync(file, JSON.stringify(c));
  return file;
}
let log = "";
function startServer() {
  if (!fs.existsSync(path.join(APP, "dist", "index.html"))) throw new Error("No dist/: run `npm run build` first");
  if (!fs.existsSync(path.join(ROOT, "workers", "studio-api", "wrangler.jsonc")))
    throw new Error(`No studio platform at ${ROOT}: set STUDIO_PLATFORM to an Art-Talk-Back checkout`);
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "booth-e2e-"));
  const appConfig = path.join(state, "app.wrangler.json");
  // worker/index.js also exports its constants for the Node tests; `wrangler
  // dev` with several Workers takes every named export for an entrypoint and
  // refuses a number. The deployed Worker is unaffected; here the default
  // export alone is re-exported.
  const entry = path.join(state, "entry.mjs");
  fs.writeFileSync(entry, `export { default } from ${JSON.stringify(path.join(APP, "worker", "index.js"))};\n`);
  fs.writeFileSync(appConfig, JSON.stringify({
    name: "booth-studio-dev",
    main: entry,
    compatibility_date: COMPAT,
    assets: { directory: path.join(APP, "dist"), binding: "ASSETS", not_found_handling: "single-page-application", run_worker_first: ["/api/*", "/v1/*"] },
    services: [{ binding: "API", service: "studio-api-dev" }],
  }));
  const wrangler = path.join(ROOT, "node_modules", ".bin", "wrangler");
  const env = { ...process.env, CI: "1" };
  const api = apiConfig(state);
  const mig = spawnSync(wrangler, ["d1", "migrations", "apply", "DB", "--local", "--persist-to", state,
    "-c", api], { cwd: ROOT, encoding: "utf8", env });
  if (mig.status !== 0) throw new Error(`migrations failed: ${mig.stdout}${mig.stderr}`);
  const proc = spawn(wrangler, ["dev", "-c", appConfig, "-c", api,
    "--persist-to", state, "--port", String(PORT), "--ip", "127.0.0.1"], { cwd: ROOT, env });
  proc.stdout.on("data", (d) => (log += d));
  proc.stderr.on("data", (d) => (log += d));
  return { proc, state };
}
async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${ORIGIN}/v1/openapi.json`)).ok && (await fetch(`${ORIGIN}/index.html`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`wrangler dev did not come up:\n${log.slice(-3000)}`);
}
async function codeFor(email, after) {
  const re = new RegExp(`sign-in code for ${email.replace(/[.@+]/g, "\\$&")}: (\\d{6})`, "g");
  for (let i = 0; i < 300; i++) {
    const all = [...log.slice(after).matchAll(re)];
    if (all.length) return all.at(-1)[1];
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("no sign-in code in the dev log");
}

/* ---- devices ---------------------------------------------------------------- */
const launch = {
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--use-gl=angle", "--disable-dev-shm-usage"],
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
};
const IGNORE = /Failed to load resource|ERR_INTERNET_DISCONNECTED|net::ERR_FAILED|WebGL|GPU stall|GL Driver/;
async function device(browser, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  // A CI runner draws WebGL on the CPU, several pages at once: give it time.
  page.setDefaultTimeout(90_000);
  const errors = [];
  const v1 = [];
  const chunks = [];
  page.on("pageerror", (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !IGNORE.test(m.text())) errors.push(`${name}: ${m.text()}`);
  });
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/v1/")) v1.push(u.pathname);
    if (/\/assets\/studio-/.test(u.pathname)) chunks.push(u.pathname);
  });
  return { name, ctx, page, errors, v1, chunks };
}
async function ready(d) {
  await d.page.goto(`${ORIGIN}/`, { waitUntil: "load" });
  await d.page.waitForFunction(() => {
    const s = document.querySelector("#save-status");
    return !!document.querySelector("#project-name") && s && s.textContent !== "Opening…";
  });
  // The first frames compile the scene's shaders, which on a CPU renderer can
  // hold the page for a while; a click waits for the page to draw again.
  await d.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}
/** Change something and wait until it is saved on the device. */
async function edit(d, fn) {
  await d.page.evaluate(() => (document.querySelector("#save-status").textContent = ""));
  await fn();
  await d.page.waitForFunction(() => document.querySelector("#save-status").textContent === "✓ Saved on this device");
}
const rename = (d, name) =>
  edit(d, async () => {
    await d.page.fill("#project-name", name);
    await d.page.press("#project-name", "Tab");
  });
async function addImage(d, name, color) {
  const before = Object.keys((await stored(d)).assets).length;
  const buffer = Buffer.from(await d.page.evaluate((c) => {
    const cv = document.createElement("canvas");
    cv.width = 64;
    cv.height = 48;
    const x = cv.getContext("2d");
    x.fillStyle = c;
    x.fillRect(0, 0, 64, 48);
    return cv.toDataURL("image/png").split(",")[1];
  }, color), "base64");
  await d.page.setInputFiles("#art-input", { name, mimeType: "image/png", buffer });
  for (let i = 0; i < 100; i++) {
    if (Object.keys((await stored(d)).assets).length > before) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`${d.name}: the image never reached the device's storage`);
}
/** What the device has saved: the project's name and id, and each image's original by key. */
/** Whether the app's own validator opens this project (what a backup restore checks). */
const validates = (p) => {
  try {
    validateProject(structuredClone(p));
    return true;
  } catch {
    return false;
  }
};
const stored = (d) =>
  d.page.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open("artist-os-booth-studio");
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction(["projects", "assets"]);
      const project = tx.objectStore("projects").get("current");
      const keys = tx.objectStore("assets").getAllKeys();
      const rows = tx.objectStore("assets").getAll();
      tx.oncomplete = () => {
        const assets = {};
        keys.result.forEach((k, i) => (assets[k] = rows.result[i].data));
        db.close();
        resolve({ name: project.result?.name, id: project.result?.id, assets });
      };
    };
  }));
/** The whole saved project, put back together the way storage.js load() does. */
const savedProject = (d) =>
  d.page.evaluate(() => new Promise((resolve, reject) => {
    const r = indexedDB.open("artist-os-booth-studio");
    r.onerror = () => reject(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction(["projects", "assets"]);
      const project = tx.objectStore("projects").get("current");
      const keys = tx.objectStore("assets").getAllKeys();
      const rows = tx.objectStore("assets").getAll();
      tx.oncomplete = () => {
        const p = project.result;
        db.close();
        if (!p.assets || !Object.keys(p.assets).length) {
          p.assets = {};
          keys.result.forEach((k, i) => (p.assets[k] = rows.result[i]));
          delete p.assetOrder;
        }
        resolve(p);
      };
    };
  }));
async function signIn(d) {
  const p = d.page;
  await p.click('button.avatar[data-action="studio-account"]');
  await p.waitForSelector("#st-email");
  await p.fill("#st-email", EMAIL);
  const mark = log.length;
  await p.click("#st-send");
  await p.waitForSelector("#st-code-row:not([hidden])");
  await p.fill("#st-code", await codeFor(EMAIL, mark));
  await p.click("#st-verify");
  await p.waitForSelector("#st-signed-in");
}
// Signed out there is no BoothStudio: then this only gives the page a moment.
const sync = (d) => d.page.evaluate(() => globalThis.BoothStudio?.sync());
const status = (d) => d.page.evaluate(() => globalThis.BoothStudio.status());
const pending = (d) => d.page.evaluate(() => globalThis.BoothStudio.pendingCount());
const api = (d, url) => d.page.evaluate((u) => fetch(u).then((r) => r.json()), url);
const placements = async (d) => (await api(d, "/v1/placements?limit=20")).items;
async function until(d, what, fn, tries = 80) {
  for (let i = 0; i < tries; i++) {
    if (await fn()) return true;
    await sync(d);
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`${d.name}: timed out waiting for ${what}`);
}

// Something already answering on the port would be tested instead of this
// build: a dev server left over from an earlier run, say.
if (await fetch(`${ORIGIN}/`).then(() => true, () => false))
  throw new Error(`${ORIGIN} is already in use: stop whatever is serving it (an old wrangler dev?) or set E2E_PORT`);
const { proc, state } = startServer();
let browser;
const errorsSeen = []; // from devices already closed
try {
  await waitUp();
  console.log(`(app compatibility_date ${COMPAT})`);
  browser = await chromium.launch(launch);

  /* ==== SIGNED OUT ======================================================== */
  console.log("\n-- signed out: the app as it always was");
  const zero = await device(browser, "signed-out device");
  await ready(zero);
  await rename(zero, "Never leaves this device");
  await addImage(zero, "local.png", "#884422");
  await zero.page.reload({ waitUntil: "load" });
  await zero.page.waitForFunction(() => document.querySelector("#project-name")?.value === "Never leaves this device");
  check("signed out, edits and images save on the device and survive a reload", (await stored(zero)).name === "Never leaves this device");
  check("signed out, nothing calls /v1", zero.v1.length === 0, zero.v1.join(", "));
  check("signed out, the studio code is never even loaded", zero.chunks.length === 0, zero.chunks.join(", "));
  check("signed out, the footer says Local workspace", (await zero.page.textContent("#network")) === "Local workspace");
  errorsSeen.push(...zero.errors);
  await zero.ctx.close(); // one fewer page drawing on the CPU

  /* ==== DEVICE 1: sign in, then import ==================================== */
  console.log("\n-- device 1: sign in from inside Booth Studio, then import");
  const one = await device(browser, "device 1");
  await ready(one);
  await rename(one, "Booth from device one");
  await addImage(one, "heron.png", "#2b4338");
  await addImage(one, "egret.png", "#c8b088");
  const local1 = await stored(one);
  await signIn(one);
  check("the email code signs in on the same origin", (await one.page.textContent("#st-signed-in")).includes(EMAIL));
  await sync(one);
  check("signed in, the project from before isn't pushed until the import", (await placements(one)).length === 0 && (await status(one)) === "local",
    await status(one));
  await one.page.click("#st-import");
  await one.page.waitForFunction(() => /Import finished/.test(document.querySelector("#st-import-result")?.textContent || ""), null, { timeout: 60_000 })
    .catch(async (err) => {
      throw new Error(`${err.message}\n  the panel said: ${await one.page.textContent("#st-import-result").catch(() => "?")}`);
    });
  const result1 = await one.page.textContent("#st-import-result");
  check("the import reports what the studio answered", /1 added, 0 already in the studio, 2 images uploaded/.test(result1), result1);
  let list = await placements(one);
  const booth = list[0];
  check("the studio holds the booth: name, real size, format, scene", list.length === 1 && booth.name === "Booth from device one" &&
    booth.width === 120 && booth.format === "booth-studio/1" && booth.scene.id === local1.id && !("assets" in booth.scene),
    JSON.stringify(list.map((b) => [b.name, b.width, b.format])));
  check("every image is a studio file named in the manifest, never inside the row",
    booth.images.length === 2 && booth.images.every((im) => /^[0-9A-Z]{26}$/.test(im.fileId)) && !JSON.stringify(booth).includes("base64,"));
  check("the device copy is left exactly as it was", JSON.stringify(await stored(one)) === JSON.stringify(local1));

  await one.page.click("#st-import");
  await one.page.waitForFunction(() => /0 added/.test(document.querySelector("#st-import-result")?.textContent || ""));
  const result2 = await one.page.textContent("#st-import-result");
  list = await placements(one);
  check("running it again adds nothing", /0 added, 1 already in the studio\./.test(result2) && list.length === 1 &&
    JSON.stringify(list[0].images) === JSON.stringify(booth.images), result2);
  await one.page.click("#st-close");
  await until(one, "synced", async () => (await status(one)) === "synced");
  check("after the import, the project syncs: the footer says so", /Studio · synced/.test(await one.page.textContent("#network")));

  /* ==== DEVICE 2: opens it, images included =============================== */
  console.log("\n-- device 2: the booth from the studio, images included");
  const two = await device(browser, "device 2");
  await ready(two);
  await signIn(two);
  await sync(two);
  check("the second device's own project stays its own until imported", (await status(two)) === "local");
  await two.page.click("#st-close");
  await two.page.click('button.avatar[data-action="studio-account"]');
  await two.page.waitForSelector(`[data-open-booth="${booth.id}"]`);
  await two.page.click(`[data-open-booth="${booth.id}"]`);
  await two.page.click("#confirm-go"); // its own project isn't in the studio: a backup downloads first
  await two.page.waitForFunction(() => document.querySelector("#project-name")?.value === "Booth from device one");
  await until(two, "the opened booth saved", async () => (await stored(two)).name === "Booth from device one");
  let got = await stored(two);
  check("the second device shows the booth, with the same id", got.id === local1.id);
  check("and every image, byte for byte", JSON.stringify(Object.values(got.assets).sort()) === JSON.stringify(Object.values(local1.assets).sort()),
    `${Object.keys(got.assets).length} images`);

  /* ==== OFFLINE EDITS + RECONNECT ========================================= */
  console.log("\n-- offline on device 2: an edit and a new image, then reconnect");
  await until(two, "device 2 synced", async () => (await status(two)) === "synced");
  await two.ctx.setOffline(true);
  await rename(two, "Edited offline");
  await addImage(two, "ibis.png", "#aa3344");
  await sync(two);
  const off = { status: await status(two), pending: await pending(two) };
  check("with no network the change waits on the device and says so", off.status === "offline" && off.pending >= 1, JSON.stringify(off));
  check("the footer says how many changes wait", /offline · \d+ changes? waiting/.test(await two.page.textContent("#network")));
  await two.ctx.setOffline(false);
  await until(two, "the outbox to empty", async () => (await pending(two)) === 0 && (await status(two)) === "synced");
  list = await placements(two);
  check("back online, the edit and the new image reach the studio", list[0].name === "Edited offline" && list[0].images.length === 3 &&
    list[0].images.every((im) => im.fileId), JSON.stringify([list[0].name, list[0].images.length]));
  await until(one, "device 1 to get the edit", async () => (await stored(one)).name === "Edited offline");
  got = await stored(one);
  const twoNow = await stored(two);
  check("device 1 shows the edit and the new image", Object.keys(got.assets).length === 3 &&
    JSON.stringify(Object.values(got.assets).sort()) === JSON.stringify(Object.values(twoNow.assets).sort()));
  check("and its screen, not only its storage", (await one.page.inputValue("#project-name")) === "Edited offline");

  /* ==== CONFLICT ========================================================== */
  console.log("\n-- the same booth edited on two offline devices");
  await until(one, "device 1 settled", async () => (await pending(one)) === 0 && (await status(one)) === "synced");
  await until(two, "device 2 settled", async () => (await pending(two)) === 0 && (await status(two)) === "synced");
  await one.ctx.setOffline(true);
  await two.ctx.setOffline(true);
  await rename(one, "Name from one");
  await rename(two, "Name from two");
  await one.ctx.setOffline(false);
  await until(one, "device 1 to send", async () => (await pending(one)) === 0);
  await two.ctx.setOffline(false);
  await sync(two);
  await two.page.waitForSelector('#studio-card:not([hidden])');
  check("the second device gets a review card", /changed on another device too/.test(await two.page.textContent("#studio-card")));
  await two.page.waitForFunction(() => document.querySelector("#project-name")?.value === "Name from one");
  check("the studio kept its copy, and that's what device 2 shows now", (await placements(two))[0].name === "Name from one");
  check("the device that synced first saw no card", !(await one.page.$('#studio-card:not([hidden])')));
  await edit(two, () => two.page.click('#studio-card [data-studio="use-mine"]'));
  check("\"Use this device's\" puts this device's version back on screen", (await two.page.inputValue("#project-name")) === "Name from two");
  await until(two, "device 2 to send its version", async () => (await placements(two))[0].name === "Name from two");
  await until(one, "device 1 to get it", async () => (await one.page.inputValue("#project-name")) === "Name from two");
  await until(one, "device 1 to save it", async () => (await stored(one)).name === "Name from two");
  check("and it reaches the studio and the other device, screen and storage", true);

  /* ==== BACKUP FROM A SYNCED PROJECT ====================================== */
  console.log("\n-- a synced project downloads as a backup that today's app opens");
  await two.page.click('[data-tab="export"]');
  const [download] = await Promise.all([two.page.waitForEvent("download"), two.page.click('[data-action="backup"]')]);
  const file = path.join(state, "synced.booth.json");
  await download.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, "utf8"));
  check("the backup is a schema-1 project with its originals inside", backup.schema === 1 && backup.name === "Name from two" &&
    Object.keys(backup.assets).length === 3 && Object.values(backup.assets).every((a) => /^data:image\/png;base64,/.test(a.data)));
  const three = await device(browser, "signed-out device 3");
  await ready(three);
  await three.page.setInputFiles("#backup-input", file);
  await three.page.click("#confirm-go");
  await three.page.waitForFunction(() => document.querySelector("#project-name")?.value === "Name from two");
  await until(three, "the backup saved", async () => (await stored(three)).name === "Name from two", 40);
  got = await stored(three);
  check("a signed-out copy of the app opens it, images and all", got.name === "Name from two" && Object.keys(got.assets).length === 3);
  check("and that copy never called the studio", three.v1.length === 0);
  errorsSeen.push(...three.errors);
  await three.ctx.close();

  /* ==== A RENAME MADE OUTSIDE THE APP ===================================== */
  // The studio assistant (or anything else on the API) renames a booth by its
  // name column alone. That rename reaches both screens and stays: the next
  // save brings the scene up to it rather than sending the old name back.
  console.log("\n-- a rename made through the studio API, not in the app");
  await until(one, "device 1 settled", async () => (await pending(one)) === 0 && (await status(one)) === "synced");
  await until(two, "device 2 settled", async () => (await pending(two)) === 0 && (await status(two)) === "synced");
  const before = (await placements(one))[0];
  const patched = await one.page.evaluate(async ({ id, version }) => {
    const r = await fetch(`/v1/placements/${id}`, { method: "PATCH", headers: { "content-type": "application/json", "If-Match": String(version) },
      body: JSON.stringify({ name: "Renamed in the studio" }) });
    return r.status;
  }, { id: before.id, version: before.version });
  check("the studio takes a rename of the name column alone", patched === 200, String(patched));
  await until(one, "device 1 to show the rename", async () => (await one.page.inputValue("#project-name")) === "Renamed in the studio");
  await until(two, "device 2 to show the rename", async () => (await two.page.inputValue("#project-name")) === "Renamed in the studio");
  await until(one, "device 1 to save it", async () => (await stored(one)).name === "Renamed in the studio");
  await until(one, "device 1 settled", async () => (await pending(one)) === 0 && (await status(one)) === "synced");
  await until(two, "device 2 settled", async () => (await pending(two)) === 0 && (await status(two)) === "synced");
  const after = (await placements(one))[0];
  check("it reaches both screens and stays: the scene caught up, not sent back", after.name === "Renamed in the studio" &&
    after.scene.name === "Renamed in the studio" && (await two.page.inputValue("#project-name")) === "Renamed in the studio",
    JSON.stringify([after.name, after.scene.name]));
  check("and no review card for it", !(await one.page.$('#studio-card:not([hidden])')) && !(await two.page.$('#studio-card:not([hidden])')));

  /* ==== THE PLATFORM IS DOWN ============================================== */
  console.log("\n-- the studio answers 503: the app carries on");
  await one.page.route("**/v1/**", (r) => r.fulfill({ status: 503, contentType: "application/json",
    body: JSON.stringify({ error: { code: "unavailable", message: "The studio can't be reached just now." } }) }));
  await rename(one, "While the studio was down");
  await sync(one);
  check("the edit is saved on the device", (await stored(one)).name === "While the studio was down");
  check("the app says the studio can't sync, and keeps the change", (await status(one)) === "error" && (await pending(one)) >= 1,
    `${await status(one)} / ${await pending(one)}`);
  await one.page.unroute("**/v1/**");
  await until(one, "the change to go out", async () => (await pending(one)) === 0);
  check("when the studio is back, the change goes out", (await placements(one))[0].name === "While the studio was down");

  /* ==== AN ENDED SIGN-IN ================================================== */
  console.log("\n-- a sign-in the studio ends keeps the changes made since");
  const jar = await one.ctx.cookies();
  const sess = jar.find((c) => c.name === "studio_session");
  await fetch(`${ORIGIN}/v1/auth/logout`, { method: "POST", headers: { Cookie: `studio_session=${sess.value}` } });
  await rename(one, "After the sign-in ended");
  await sync(one);
  // The save queues the change and the sync finds the sign-in gone, in either order.
  for (let i = 0; i < 50 && !((await status(one)) === "expired" && (await pending(one)) >= 1); i++) {
    await new Promise((r) => setTimeout(r, 100));
    await sync(one);
  }
  const ended = { status: await status(one), pending: await pending(one) };
  check("the change waits on the device, not wiped", ended.status === "expired" && ended.pending >= 1 &&
    (await stored(one)).name === "After the sign-in ended", JSON.stringify(ended));
  check("and the footer says to sign in again", /sign in again/.test(await one.page.textContent("#network")));
  await one.page.click('button.avatar[data-action="studio-account"]');
  await one.page.waitForSelector("#st-expired");
  check("Studio account says who to sign in as", /Sign in again as owner@/.test(await one.page.textContent("#st-expired")) &&
    (await one.page.inputValue("#st-email")) === EMAIL);
  await one.page.click("#st-close");
  await signIn(one);
  await until(one, "the waiting change to go out", async () => (await pending(one)) === 0);
  check("signing in again as the same person sends it", (await placements(one))[0].name === "After the sign-in ended");
  await until(two, "device 2 to get it", async () => (await stored(two)).name === "After the sign-in ended");
  check("and it reaches the other device", true);

  /* ==== THE OPEN BOOTH DELETED FROM THE STUDIO ========================== */
  // The assistant (or anything else on the API) deletes the booth open on both
  // devices. Each keeps its copy and says so; neither sends it back. Before
  // this was handled, a device re-created it, the studio refused the id, and
  // the two went round again every half second for as long as it was open.
  console.log("\n-- the open booth is deleted from the studio, not in the app");
  await until(one, "device 1 settled", async () => (await pending(one)) === 0 && (await status(one)) === "synced");
  await until(two, "device 2 settled", async () => (await pending(two)) === 0 && (await status(two)) === "synced");
  const doomed = (await placements(one))[0];
  const pushes = { one: 0, two: 0 };
  one.page.on("request", (r) => r.url().includes("/v1/sync/push") && pushes.one++);
  two.page.on("request", (r) => r.url().includes("/v1/sync/push") && pushes.two++);
  const removed = await one.page.evaluate(async ({ id, version }) =>
    (await fetch(`/v1/placements/${id}`, { method: "DELETE", headers: { "If-Match": String(version) } })).status,
  { id: doomed.id, version: doomed.version });
  check("the studio takes the delete", removed >= 200 && removed < 300, String(removed));
  await until(one, "device 1 to see it gone", async () => (await status(one)) === "gone");
  await until(two, "device 2 to see it gone", async () => (await status(two)) === "gone");
  const seen = { ...pushes };
  for (let i = 0; i < 8; i++) {
    await sync(one);
    await sync(two);
    await new Promise((r) => setTimeout(r, 300));
  }
  check("neither device sends it back, and nothing goes round", (await placements(one)).length === 0 &&
    pushes.one === seen.one && pushes.two === seen.two, JSON.stringify({ seen, pushes }));
  check("both keep the booth, and the footer says so", (await stored(one)).name === doomed.name && (await stored(two)).name === doomed.name &&
    /deleted from the studio · kept on this device/.test(await one.page.textContent("#network")));
  if (await one.page.isVisible("#st-close")) await one.page.click("#st-close"); // still open from signing in again
  await rename(one, "Edited after the delete");
  await sync(one);
  await new Promise((r) => setTimeout(r, 600));
  await sync(one);
  check("an edit afterwards stays on the device too", (await stored(one)).name === "Edited after the delete" &&
    (await status(one)) === "gone" && pushes.one === seen.one && (await placements(one)).length === 0, JSON.stringify(pushes));

  /* ==== A BOOTH BUILT AND CHANGED BY AN AGENT ============================ */
  // Art-Talk-Back D-070: studio-api runs this app's own scene code
  // (src/scene-ops.js), so a booth an agent builds or edits through the API
  // opens here like one made here, and passes the app's own validator.
  console.log("\n-- a booth built and changed through the studio API, by an agent");
  const action = (d, name, input) => d.page.evaluate(async ({ name, input }) => {
    const r = await fetch(`/v1/actions/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    return { status: r.status, data: await r.json() };
  }, { name, input });
  const built = await action(one, "placement.build", {
    name: "Built by an agent", show: "artshow", size: "10x15",
    ops: [{ op: "add_furniture", kind: "chair", x: 0, z: 20, rotation: 180 }],
  });
  check("an agent builds a booth through the API", built.status === 200 && built.data.result.width === 180, JSON.stringify(built.data).slice(0, 200));
  const builtId = built.data.result.id;
  await sync(one);
  if (await one.page.isVisible("#st-close")) await one.page.click("#st-close");
  await one.page.click('button.avatar[data-action="studio-account"]');
  await one.page.waitForSelector(`[data-open-booth="${builtId}"]`);
  check("Studio account lists it", /Built by an agent/.test(await one.page.textContent("#st-booths")));
  await one.page.click(`[data-open-booth="${builtId}"]`);
  // The booth open here was deleted from the studio, so a backup of it goes first.
  await one.page.waitForSelector("#confirm-go");
  await Promise.all([one.page.waitForEvent("download"), one.page.click("#confirm-go")]);
  await until(one, "the built booth to open", async () => (await one.page.inputValue("#project-name")) === "Built by an agent");
  await until(one, "the built booth to save", async () => (await stored(one)).name === "Built by an agent");
  let mine = await savedProject(one);
  check("it opens on screen: an indoor art-show booth, 15′ wide, with its chair, and the app's validator takes it",
    mine.booth.venue === "artshow" && mine.booth.width === 180 && mine.booth.pedestals.some((x) => x.kind === "chair") && validates(mine),
    JSON.stringify([mine.booth.venue, mine.booth.width, mine.booth.pedestals.length]));
  await until(one, "device 1 settled", async () => (await pending(one)) === 0 && (await status(one)) === "synced");
  const current = (await action(one, "placement.edit", { id: builtId, version: (await placements(one)).find((x) => x.id === builtId).version,
    ops: [
      { op: "add_furniture", kind: "table6", x: -30, z: 36, ref: "t" }, { op: "set_booth", color: "#f4f1ea" }, { op: "rename", name: "Edited by an agent" },
      // And the show it's at, from a spec: a floor, two back-to-back rows, this booth marked as mine.
      { op: "start_floor", venue: "indoor", width: 1200, depth: 720 },
      { op: "add_booths", count: 8, perRow: 4, x: 120, y: 120, backToBack: true },
      { op: "set_exhibitor", number: 105, name: "Ada Pottery", status: "sold" },
      { op: "mark_my_booth", number: 103 },
    ] }));
  check("the agent edits it while it's open", current.status === 200, JSON.stringify(current.data).slice(0, 200));
  await until(one, "the edit on screen", async () => (await one.page.inputValue("#project-name")) === "Edited by an agent");
  await until(one, "the edit saved", async () => (await savedProject(one)).booth.pedestals.some((x) => x.kind === "table6"));
  mine = await savedProject(one);
  check("the screen follows: the table where it was put, the colour, the name, and still valid",
    mine.booth.pedestals.find((x) => x.kind === "table6")?.x === -30 && mine.booth.color === "#f4f1ea" && validates(mine) &&
    !(await one.page.$('#studio-card:not([hidden])')));
  check("and the show floor it was given: 8 booths, an exhibitor, this booth as mine",
    mine.hall?.items?.filter((x) => x.kind === "booth").length === 8 && mine.hall.booths[105]?.name === "Ada Pottery" && mine.hall.mine === 103,
    JSON.stringify(mine.hall && { items: mine.hall.items.length, mine: mine.hall.mine }));

  const errors = [...errorsSeen, ...one.errors, ...two.errors];
  check("no page errors on any device", !errors.length, errors.slice(0, 4).join(" | "));
} catch (err) {
  fails.push(`crashed: ${err?.stack || err}`);
  console.log(`  FAIL  crashed — ${err?.stack || err}`);
} finally {
  if (browser) await browser.close();
  proc.kill();
  // The dev server's log (sign-in codes, studio-api errors), when a run fails and E2E_LOG names a file.
  if (fails.length && process.env.E2E_LOG) fs.writeFileSync(process.env.E2E_LOG, log);
  fs.rmSync(state, { recursive: true, force: true });
}
console.log(`\n${passed}/${passed + fails.length} checks passed`);
if (fails.length) {
  console.log("FAILED:");
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
