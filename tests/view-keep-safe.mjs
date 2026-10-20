// Export → Keep your work says what the browser does with this device's copy
// and when a backup was last downloaded here, offers to ask the browser to
// keep it, and a booth holding the artist's own images gets a backup reminder
// at most once a month (src/keep-safe.js, ROADMAP.md 1.7 and 1.8).
//
// navigator.storage is stood in for: what a real browser answers depends on
// the browser and how the site has been used, and Firefox would prompt.
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import assert from "node:assert/strict";

const server = await createServer({ server: { host: "127.0.0.1", port: 5257 } });
await server.listen();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BOOTH_TEST_CHROMIUM ? { executablePath: process.env.BOOTH_TEST_CHROMIUM } : {}),
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--use-gl=angle", "--in-process-gpu", "--single-process"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("booth.role", "all"); // past the first visit's welcome (src/roles.js)
    let persisted = sessionStorage.getItem("test.persisted") === "yes";
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: {
        persisted: async () => persisted,
        persist: async () => {
          persisted = true;
          sessionStorage.setItem("test.persisted", "yes");
          return true;
        },
        estimate: async () => ({ usage: 37 * 1024 ** 2, quota: 2.1 * 1024 ** 3 }),
      },
    });
  });
  await page.goto("http://127.0.0.1:5257");
  await page.waitForFunction(() => !!window.__booth?.scene);
  const keepSafe = () => page.locator("#keep-safe").innerText();

  await page.click('[data-tab="export"]');
  await page.waitForFunction(() => /may clear/.test(document.querySelector("#keep-safe")?.textContent || ""));
  assert.match(await keepSafe(), /Using 37 MB of about 2\.1 GB here/);
  assert.match(await keepSafe(), /No backup downloaded from this browser yet/);
  // A redraw draws the last answer straight back, never the placeholder in its place.
  await page.click('[data-tab="lighting"]');
  await page.click('[data-tab="export"]');
  assert.doesNotMatch(await keepSafe(), /Checking how this browser/);
  assert.match(await keepSafe(), /may clear/);

  await page.getByRole("button", { name: "Ask the browser to keep it" }).click();
  await page.waitForFunction(() => /until you clear it yourself/.test(document.querySelector("#keep-safe")?.textContent || ""));
  assert.match(await page.locator("#toast").innerText(), /will keep this device's copy/);
  assert.equal(await page.getByRole("button", { name: "Ask the browser to keep it" }).count(), 0, "no button once it is kept");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download project backup" }).click()]);
  assert.match(download.suggestedFilename(), /\.booth\.json$/);
  await page.waitForFunction(() => /Last backup downloaded from this browser:/.test(document.querySelector("#keep-safe")?.textContent || ""));

  // The example booth holds no images of anyone's: no reminder.
  const reminded = () => page.evaluate(() => /live only in this browser/.test(document.querySelector("#toast")?.textContent || ""));
  await page.evaluate(() => localStorage.removeItem("booth.keepSafe"));
  await page.reload();
  await page.waitForFunction(() => !!window.__booth?.scene);
  await page.waitForTimeout(5000);
  assert.equal(await reminded(), false, "no reminder for the example booth");

  // An image of the artist's own, never backed up: one reminder, and not on the next visit.
  await page.evaluate(async () => {
    const b = window.__booth;
    b.project.assets["own-image"] = { name: "own.png", width: 1, height: 1, role: "artwork", data: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" };
    await b.save();
  });
  const remindedAgain = () => page.waitForFunction(() => /live only in this browser/.test(document.querySelector("#toast")?.textContent || ""), null, { timeout: 15000 });
  await page.reload();
  await page.waitForFunction(() => !!window.__booth?.scene);
  await remindedAgain();
  // Another toast covers it at once, as the start's own toasts can: not seen, so not counted.
  await page.evaluate(() => (document.querySelector("#toast").textContent = "Something else happened."));
  await page.waitForTimeout(9000);
  await page.reload();
  await page.waitForFunction(() => !!window.__booth?.scene);
  await remindedAgain();
  // On screen for its 8 seconds this time: counted, and not shown again for a month.
  await page.waitForTimeout(9000);
  await page.reload();
  await page.waitForFunction(() => !!window.__booth?.scene);
  await page.waitForTimeout(5000);
  assert.equal(await reminded(), false, "not twice in a month");

  // (Signed in, no reminder at all: tests/keep-safe.test.js.)
  assert.deepEqual(errors, []);
  console.log("PASS Keep your work says whether the browser keeps this device's copy and when it was last backed up, asks the browser on request, and reminds about a backup once a month for a booth with the artist's own images, never for the example booth.");
} finally {
  await browser.close();
  await server.close();
}
