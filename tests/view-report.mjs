// Report a problem (src/report.js, ROADMAP.md 1.9): the page's uncaught errors
// and rejections are kept, and Export → Something wrong? copies a report with
// the build, the browser, the project in counts and those errors — or, where
// the clipboard is refused, shows it to copy by hand. Nothing is sent.
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import assert from "node:assert/strict";

const server = await createServer({ server: { host: "127.0.0.1", port: 5259 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--use-gl=angle", "--in-process-gpu", "--single-process"],
});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.addInitScript(() => localStorage.setItem("booth.role", "all")); // past the first visit's welcome (src/roles.js)
  await page.goto("http://127.0.0.1:5259");
  await page.waitForFunction(() => !!window.__booth?.scene);
  await page.evaluate(() => {
    window.__booth.project.name = "Private booth name";
    setTimeout(() => {
      throw new Error("test boom");
    });
    Promise.reject(new Error("test reject"));
  });
  await page.waitForTimeout(300);
  assert.deepEqual(pageErrors.sort(), ["test boom", "test reject"], "only what this test threw");

  await page.click('[data-tab="export"]');
  await page.getByRole("button", { name: "Copy a problem report" }).click();
  await page.waitForFunction(() => /Problem report copied/.test(document.querySelector("#toast")?.textContent || ""));
  const text = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(text, /^Booth Studio problem report\n/);
  assert.match(text, /Build: v\S+ · built \S+ · commit \S+/);
  assert.match(text, /Project: 6 placements, 0 images or files, 10 × 10 ft/);
  assert.match(text, /test boom/);
  assert.match(text, /Unhandled rejection: test reject/);
  assert.ok(!text.includes("Private booth name"), "no names in the report");

  // Where the clipboard is refused, the report opens to copy by hand.
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error("denied"));
  });
  await page.getByRole("button", { name: "Copy a problem report" }).click();
  await page.waitForSelector("#dialog[open] .report-text");
  assert.match(await page.locator(".report-text").inputValue(), /Booth Studio problem report/);
  await page.click("#report-close");
  assert.equal(await page.evaluate(() => document.querySelector("#dialog").open), false);
  console.log("PASS Report a problem keeps the page's errors and rejections and copies a report with the build, the browser, the project in counts (no names) and those errors, or shows it to copy by hand.");
} finally {
  await browser.close();
  await server.close();
}
