// Has a merge to `main` reached production, and does the live app start?
//
// Cloudflare's Git integration deploys every push to `main` a few minutes
// after the merge, and nothing reports back when it has finished; twice a fix
// was reported as not working while its build was still running (HANDOFF.md).
// This waits until the live page's script carries the commit — the build
// stamp vite.config.js writes into the bundle as `commit:"<7 characters>"` —
// and then opens the page in Chromium and checks that the app starts: the 3D
// view has its canvas, the footer names the commit, a project is open, and the
// page threw nothing. It only reads: it never signs in, and the browser
// profile it uses is thrown away.
//
//   node tools/verify-deploy.mjs                    the commit at origin/main
//   node tools/verify-deploy.mjs --commit fe7305d   a given commit
//   node tools/verify-deploy.mjs --check-only       what is live now: no wait, no browser
//   node tools/verify-deploy.mjs --url <preview> --commit <sha>   a branch preview
//   --timeout <minutes> (default 15) · --no-browser
//
// Exit status: 0 live and started · 1 live but the page did not start ·
// 2 the commit was not live before the timeout · 3 a usage or network error.
//
// In a cloud session the network goes through HTTPS_PROXY. Node's fetch reads
// it only with NODE_USE_ENV_PROXY=1, so the script runs itself again with that
// set, and Chromium is given the same proxy. `BOOTH_TEST_CHROMIUM` picks the
// browser, as in the test suites.
import { execFileSync, spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

if (process.env.HTTPS_PROXY && process.env.NODE_USE_ENV_PROXY !== "1") {
  const again = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" },
  });
  process.exit(again.status ?? 3);
}

const LIVE = "https://booth-studio.bobdylan2000.workers.dev";
const POLL_MS = 20_000;
const FLAGS = new Set(["--check-only", "--no-browser"]);
const OPTIONS = new Set(["--commit", "--url", "--timeout"]);

function stop(code, message) {
  console.error(message);
  process.exit(code);
}

const args = process.argv.slice(2);
const given = {};
for (let i = 0; i < args.length; i++) {
  if (FLAGS.has(args[i])) given[args[i]] = true;
  else if (OPTIONS.has(args[i]) && args[i + 1] !== undefined) given[args[i]] = args[++i];
  else stop(3, `Unknown argument ${args[i]}. See the comment at the top of tools/verify-deploy.mjs.`);
}
const site = (given["--url"] ?? LIVE).replace(/\/+$/, "");
const checkOnly = !!given["--check-only"];
const timeoutMs = Number(given["--timeout"] ?? 15) * 60_000;
if (!(timeoutMs > 0)) stop(3, "--timeout is a number of minutes.");

/** The commit to wait for, as the build stamp writes it: 7 characters. */
function expectedCommit() {
  if (given["--commit"]) return given["--commit"].slice(0, 7).toLowerCase();
  if (checkOnly) return null;
  try {
    return execFileSync("git", ["rev-parse", "origin/main"], { encoding: "utf8" }).trim().slice(0, 7);
  } catch {
    stop(3, "No --commit given, and origin/main could not be read (git fetch origin main first).");
  }
}

async function get(url) {
  const res = await fetch(url, { cache: "no-store", headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.text();
}

/** The commit the site serves now, read from its app script's build stamp. */
async function liveCommit() {
  const html = await get(`${site}/?verify=${Date.now()}`);
  const src = /<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/.exec(html)?.[1];
  if (!src) throw new Error(`no app script in ${site}/`);
  const js = await get(new URL(src, `${site}/`).href);
  const stamp = /commit:"([0-9a-f]{7}|local)"/.exec(js)?.[1];
  if (!stamp) throw new Error(`no build stamp in ${src}`);
  return stamp;
}

async function waitForCommit(expected) {
  const started = Date.now();
  let said = "";
  for (;;) {
    let now;
    try {
      now = await liveCommit();
    } catch (error) {
      now = `unreadable (${error.message})`;
    }
    if (now === expected) {
      console.log(`live   ${site} serves ${now} (expected ${expected}) after ${Math.round((Date.now() - started) / 1000)} s`);
      return;
    }
    if (now !== said) {
      console.log(`wait   ${site} serves ${now}; waiting for ${expected}`);
      said = now;
    }
    if (Date.now() - started + POLL_MS > timeoutMs) {
      stop(2, `FAIL   ${expected} was not live after ${timeoutMs / 60_000} min; ${site} still serves ${now}`);
    }
    await sleep(POLL_MS);
  }
}

/** Opens the site in Chromium and reports whether the app started. */
async function startsInBrowser(expected) {
  const { chromium } = await import("@playwright/test");
  const started = Date.now();
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
    ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}),
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
      "--use-gl=angle",
      "--in-process-gpu",
      "--single-process",
      "--disable-dev-shm-usage",
    ],
  });
  const problems = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
    const origin = new URL(site).origin;
    page.on("response", (res) => {
      const u = new URL(res.url());
      if (u.origin === origin && u.pathname.startsWith("/assets/") && res.status() >= 400) {
        problems.push(`${res.status()} ${u.pathname}`);
      }
    });
    // A fresh browser is a first visit, and the welcome is modal; the test
    // suites pass it the same way.
    await page.addInitScript(() => localStorage.setItem("booth.role", "all"));
    await page.goto(`${site}/`, { waitUntil: "load", timeout: 120_000 });
    await page.waitForSelector("#scene canvas", { state: "attached", timeout: 120_000 });
    // Let the first frames draw and any late error surface.
    await page.waitForTimeout(3000);
    const seen = await page.evaluate(() => ({
      commit: window.BOOTH_BUILD?.commit ?? null,
      footer: document.querySelector("#build-stamp")?.textContent ?? "",
      project: document.querySelector("#scene-title")?.textContent.trim() ?? "",
    }));
    if (expected && seen.commit !== expected) problems.push(`window.BOOTH_BUILD.commit is ${seen.commit}, not ${expected}`);
    if (seen.commit && !seen.footer.includes(seen.commit)) problems.push(`the footer does not name ${seen.commit}`);
    if (!seen.project) problems.push("no project is open (the scene title is empty)");
    const took = ((Date.now() - started) / 1000).toFixed(1);
    if (problems.length) return { ok: false, line: `FAIL   the page did not start cleanly (${took} s):\n  ${problems.join("\n  ")}` };
    return { ok: true, line: `start  ok: 3D canvas, footer ${seen.commit}, project "${seen.project}", no page errors (${took} s)` };
  } finally {
    await browser.close();
  }
}

const expected = expectedCommit();
if (checkOnly) {
  try {
    const now = await liveCommit();
    console.log(`live   ${site} serves ${now}${expected ? (now === expected ? " (as expected)" : ` (expected ${expected})`) : ""}`);
    process.exit(expected && now !== expected ? 2 : 0);
  } catch (error) {
    stop(3, `FAIL   ${error.message}`);
  }
}
await waitForCommit(expected);
if (!given["--no-browser"]) {
  let result;
  try {
    result = await startsInBrowser(expected);
  } catch (error) {
    result = { ok: false, line: `FAIL   the browser check could not run: ${error.message}` };
  }
  console.log(result.line);
  process.exit(result.ok ? 0 : 1);
}
