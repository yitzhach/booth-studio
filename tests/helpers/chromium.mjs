// The one Chromium every browser suite and tool launches, and how.
//
// The flags give a headless Chromium WebGL through swiftshader, which is all
// the sandbox and the CI runners have, and keep it to one process so four
// cores are enough. A suite that needs other flags passes its own `args`.
//
// Which browser, first match wins:
//   1. BOOTH_TEST_CHROMIUM, when set. CI sets it to the build the suites were
//      written against (.github/workflows/ci.yml, "Chromium build 1194").
//   2. The pinned Playwright's own Chromium, when it is installed.
//   3. The cloud sandbox's /opt/pw-browsers/chromium, when Playwright's own
//      is not there (the sandbox ships one build, which is not always the
//      one the pinned Playwright wants).
// Never point BOOTH_TEST_CHROMIUM at a full Chromium newer than CI's without
// running one suite first: build 1243's full browser exits at launch under
// --single-process and --in-process-gpu (2026-10-26), where its headless
// shell, which (2) picks, runs every suite.
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

export const CHROMIUM_ARGS = [
  "--no-sandbox",
  "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader",
  "--use-gl=angle",
  "--in-process-gpu",
  "--single-process",
  "--disable-dev-shm-usage",
];

const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";

function executable() {
  if (process.env.BOOTH_TEST_CHROMIUM) return { executablePath: process.env.BOOTH_TEST_CHROMIUM };
  if (existsSync(chromium.executablePath()) || !existsSync(SANDBOX_CHROMIUM)) return {};
  return { executablePath: SANDBOX_CHROMIUM };
}

/** Launch options: headless, the browser picked above, CHROMIUM_ARGS, then `extra` over them. */
export function chromiumOptions(extra = {}) {
  return { headless: true, ...executable(), args: CHROMIUM_ARGS, ...extra };
}

export function launchChromium(extra = {}) {
  return chromium.launch(chromiumOptions(extra));
}
