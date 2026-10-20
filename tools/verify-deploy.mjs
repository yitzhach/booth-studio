// Has a merge to `main` reached production, and does the live app start?
//
// Cloudflare's Git integration deploys every push to `main` a few minutes
// after the merge, and nothing reports back when it has finished; twice a fix
// was reported as not working while its build was still running (HANDOFF.md).
// This waits until the live page's script carries the commit — the build
// stamp vite.config.js writes into the bundle as `commit:"<7 characters>"` —
// or a later commit that contains it, and then opens the page in Chromium and
// checks that the app starts: the 3D view has its canvas, the footer names
// the commit, a project is open, and the page threw nothing. It only reads:
// it never signs in, and the browser profile it uses is thrown away.
//
//   node tools/verify-deploy.mjs                    origin/main, fetched first
//   node tools/verify-deploy.mjs --commit fe7305d   a given commit
//   node tools/verify-deploy.mjs --check-only       what is live now: no wait, no browser
//   node tools/verify-deploy.mjs --url <preview> --commit <sha>   a branch preview
//   --timeout <minutes> (default 15) · --no-browser
//
// Exit status: 0 live and started · 1 live, but the page did not start ·
// 2 the commit was not live before the timeout · 3 no verdict: a usage error,
// the site or the browser could not be reached (a network block, a missing
// Chromium), or this checkout cannot tell whether the live commit contains
// the expected one. A 3 says nothing about the deploy; never roll back on it.
//
// In a cloud session the network goes through HTTPS_PROXY. Node's fetch reads
// it only with NODE_USE_ENV_PROXY=1 (Node 22.21 and later), so the script runs
// itself again with that set, and Chromium is given the same proxy (it trusts
// the proxy's authority through the system's NSS store, which the cloud
// environment sets up). `BOOTH_TEST_CHROMIUM` picks the browser, and the
// launch flags are the test suites' own.
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { ROLE_KEY, DEFAULT_ROLE } from "../src/roles.js";

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy && process.env.NODE_USE_ENV_PROXY !== "1") {
  const again = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" },
  });
  process.exit(again.status ?? 3);
}

const LIVE = "https://booth-studio.bobdylan2000.workers.dev";
const POLL_MS = 20_000;
/** Reads that may fail in a row before the site counts as unreachable. */
const MAX_FAILED_READS = 3;
const FLAGS = new Set(["--check-only", "--no-browser"]);
const OPTIONS = new Set(["--commit", "--url", "--timeout"]);
const repo = fileURLToPath(new URL("..", import.meta.url));

function stop(code, message) {
  console.error(message);
  process.exit(code);
}

/** git in this repository, wherever the script was started from. */
function git(...args) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

const args = process.argv.slice(2);
const given = {};
for (let i = 0; i < args.length; i++) {
  const value = args[i + 1];
  if (FLAGS.has(args[i])) given[args[i]] = true;
  else if (OPTIONS.has(args[i]) && value !== undefined && !value.startsWith("--")) given[args[i]] = args[++i];
  else if (OPTIONS.has(args[i])) stop(3, `${args[i]} needs a value.`);
  else stop(3, `Unknown argument ${args[i]}. See the comment at the top of tools/verify-deploy.mjs.`);
}
const site = (given["--url"] ?? LIVE).replace(/\/+$/, "");
const checkOnly = !!given["--check-only"];
const timeoutMs = Number(given["--timeout"] ?? 15) * 60_000;
if (!(timeoutMs > 0)) stop(3, "--timeout is a number of minutes.");
if (given["--url"] && !given["--commit"] && !checkOnly) {
  stop(3, "A preview serves its branch, not origin/main: give --commit with --url.");
}

/** Brings origin/main up to date, so merges made on GitHub are known here. */
function fetchMain() {
  try {
    git("fetch", "--quiet", "origin", "main");
  } catch {
    console.log("note   could not fetch origin/main; using this checkout's copy");
  }
}

/** The commit to wait for, as the build stamp writes it: 7 characters. */
function expectedCommit() {
  const commit = given["--commit"];
  if (commit) {
    if (!/^[0-9a-f]{7,40}$/i.test(commit)) stop(3, "--commit takes a commit hash of at least 7 characters.");
    return commit.slice(0, 7).toLowerCase();
  }
  if (checkOnly) return null;
  fetchMain();
  try {
    return git("rev-parse", "origin/main").slice(0, 7);
  } catch {
    stop(3, "No --commit given, and origin/main could not be read.");
  }
}

const known = (commit) => {
  try {
    git("cat-file", "-e", `${commit}^{commit}`);
    return true;
  } catch {
    return false;
  }
};

/**
 * Whether the live commit already contains the expected one — a later merge
 * that deployed first. true or false, or null when this checkout cannot tell
 * (a commit it has not got, even after fetching; a shallow clone).
 */
function contains(live, expected) {
  if (!known(live) || !known(expected)) fetchMain();
  if (!known(live) || !known(expected)) return null;
  const run = spawnSync("git", ["-C", repo, "merge-base", "--is-ancestor", expected, live]);
  return run.status === 0 ? true : run.status === 1 ? false : null;
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
  const stamp = /commit:"([0-9a-f]{7,40}|local)"/.exec(js)?.[1];
  if (!stamp) throw new Error(`no build stamp in ${src}`);
  return stamp.slice(0, 7);
}

async function waitForCommit(expected) {
  const started = Date.now();
  let said = "";
  let failedReads = 0;
  let checked = new Map();
  for (;;) {
    let now;
    try {
      now = await liveCommit();
      failedReads = 0;
    } catch (error) {
      failedReads += 1;
      if (failedReads >= MAX_FAILED_READS) {
        stop(3, `FAIL   ${site} could not be read ${failedReads} times in a row (${error.message}): no verdict on the deploy`);
      }
      now = `unreadable (${error.message})`;
    }
    const seconds = Math.round((Date.now() - started) / 1000);
    if (now === expected) {
      console.log(`live   ${site} serves ${now} (expected ${expected}) after ${seconds} s`);
      return now;
    }
    const isCommit = /^[0-9a-f]{7}$/.test(now);
    if (isCommit && !checked.has(now)) checked.set(now, contains(now, expected));
    if (isCommit && checked.get(now) === true) {
      console.log(`live   ${site} serves ${now}, a later commit that contains ${expected}, after ${seconds} s`);
      return now;
    }
    if (now !== said) {
      console.log(`wait   ${site} serves ${now}; waiting for ${expected}`);
      said = now;
    }
    if (Date.now() - started + POLL_MS > timeoutMs) {
      if (isCommit && checked.get(now) === null) {
        stop(3, `FAIL   ${site} serves ${now}, and this checkout cannot tell whether it contains ${expected} (a shallow clone?): no verdict`);
      }
      stop(2, `FAIL   ${expected} was not live after ${timeoutMs / 60_000} min; ${site} still serves ${now}`);
    }
    await sleep(POLL_MS);
  }
}

/**
 * Opens the site in Chromium. `code` is 0 when the app started, 1 when the
 * page was reached but did not start cleanly, 3 when the check itself could
 * not run (no browser, no network path to the page).
 */
async function startsInBrowser(live) {
  const cannot = (error) => ({ code: 3, line: `FAIL   the browser check could not run: ${String(error?.message ?? error).split("\n")[0]}` });
  let browser;
  try {
    const { chromium } = await import("@playwright/test");
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
      ...(proxy ? { proxy: { server: proxy } } : {}),
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
  } catch (error) {
    return cannot(error);
  }
  const started = Date.now();
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
    await page.addInitScript(([key, role]) => localStorage.setItem(key, role), [ROLE_KEY, DEFAULT_ROLE]);
    let response;
    try {
      response = await page.goto(`${site}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    } catch (error) {
      // No network path from the browser is no verdict; a page the network
      // reaches that never finishes arriving is a page that did not start.
      if (/net::ERR_/.test(String(error?.message))) return cannot(error);
      problems.push(`the page did not arrive within 120 s (${String(error?.message).split("\n")[0]})`);
    }
    if (response && response.status() >= 400) problems.push(`the page answered ${response.status()}`);
    if (!problems.length) {
      try {
        await page.waitForSelector("#scene canvas", { state: "attached", timeout: 120_000 });
      } catch {
        problems.push("the 3D view never appeared (no canvas in #scene after 120 s)");
      }
      // Let the first frames draw and any late error surface.
      await page.waitForTimeout(3000);
      const seen = await page.evaluate(() => ({
        commit: window.BOOTH_BUILD?.commit ?? null,
        footer: document.querySelector("#build-stamp")?.textContent ?? "",
        project: document.querySelector("#scene-title")?.textContent.trim() ?? "",
      }));
      if (live && seen.commit?.slice(0, 7) !== live) problems.push(`window.BOOTH_BUILD.commit is ${seen.commit}, not ${live}`);
      if (seen.commit && !seen.footer.includes(seen.commit)) problems.push(`the footer does not name ${seen.commit}`);
      if (!seen.project) problems.push("no project is open (the scene title is empty)");
      if (!problems.length) {
        const took = ((Date.now() - started) / 1000).toFixed(1);
        return { code: 0, line: `start  ok: 3D canvas, footer ${seen.commit}, project "${seen.project}", no page errors (${took} s)` };
      }
    }
    const took = ((Date.now() - started) / 1000).toFixed(1);
    return { code: 1, line: `FAIL   the page did not start cleanly (${took} s):\n  ${problems.join("\n  ")}` };
  } catch (error) {
    // The browser itself failing mid-check (a crashed renderer, a closed
    // target) is the tool's failure, not the deploy's.
    return cannot(error);
  } finally {
    await browser.close().catch(() => {});
  }
}

const expected = expectedCommit();
if (checkOnly) {
  let now;
  try {
    now = await liveCommit();
  } catch (error) {
    stop(3, `FAIL   ${error.message}: no verdict on the deploy`);
  }
  if (!expected) {
    console.log(`live   ${site} serves ${now}`);
    process.exit(0);
  }
  const has = now === expected || contains(now, expected);
  const verdict = now === expected ? "as expected" : has === true ? `contains ${expected}` : has === null ? `cannot tell whether it contains ${expected}` : `expected ${expected}`;
  console.log(`live   ${site} serves ${now} (${verdict})`);
  process.exit(has === true ? 0 : has === null ? 3 : 2);
}
const live = await waitForCommit(expected);
if (!given["--no-browser"]) {
  const result = await startsInBrowser(live);
  console.log(result.line);
  process.exit(result.code);
}
