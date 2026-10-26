// The app's install icons (public/icons/*.png), drawn from public/favicon.svg
// by the Chromium the suites use: `node tools/make-icons.mjs`. Run it again
// after changing the favicon. The "maskable" one is the mark on a full-bleed
// square at 60% size, so a phone's round or squircle mask never cuts into it;
// the others are the favicon as it is.
import { launchChromium } from "../tests/helpers/chromium.mjs";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const svg = readFileSync(new URL("public/favicon.svg", root), "utf8");
const BACKGROUND = "#171b20"; // the favicon's own square, and the manifest's colours
const ICONS = [
  { file: "icon-192.png", size: 192, mark: 1 },
  { file: "icon-512.png", size: 512, mark: 1 },
  { file: "icon-maskable-512.png", size: 512, mark: 0.6 },
  { file: "apple-touch-icon.png", size: 180, mark: 0.8 },
];

const browser = await launchChromium({ args: [] });
try {
  for (const { file, size, mark } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inner = Math.round(size * mark);
    await page.setContent(
      `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${mark < 1 ? BACKGROUND : "transparent"}">` +
        `<div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
    );
    await page.screenshot({ path: new URL(`public/icons/${file}`, root).pathname, omitBackground: mark === 1 });
    await page.close();
    console.log(`public/icons/${file} ${size}×${size}`);
  }
} finally {
  await browser.close();
}
