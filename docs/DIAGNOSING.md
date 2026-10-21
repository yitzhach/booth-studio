# Diagnosing Booth Studio

Two reports that came back and were guessed at before anyone measured,
moved verbatim from `HANDOFF.md` on 2026-10-21 (ROADMAP 1.1). Before either,
get `window.BOOTH_BUILD` (the deployed commit) and, for anything drawn,
`window.BOOTH_ASSETS` from the browser that sees it — or ask for Export →
Something wrong? → Copy a problem report, which carries both. The
`root-cause` skill starts here.

## Diagnosing "the texture isn't showing"

This came up twice and was guessed at twice. Do not guess a third time.

Since 2026-10-20 a service worker (`public/sw.js`) sits between the page and
the network in a built app. It never keeps an HTML answer for a file, so it
cannot hide a texture behind the fallback, but it does answer a texture it
kept from that copy, looks at the site's again only once a day, and lets it
go only when the site no longer has it. So a texture replaced on the site
can show its old self for up to a day in a browser that kept it. To rule it
out: DevTools → Application → Service workers → tick "Bypass for network",
then reload. To let go of what it kept, Application → Cache storage →
delete `booth-media`; the booths saved on the device are in IndexedDB and
stay (never "Clear site data", which deletes them too). Or set `OFFLINE` to
false in `src/main.js` for everyone: the page then unregisters the worker
and deletes only what it kept, at each browser's next open that reaches the
network.

If the worker must go at once, everywhere — a browser being shown the kept
page included — replace `public/sw.js` with this and deploy it, with
`OFFLINE` set to false in the same deploy (or the page registers it again).
A browser looks for a changed `sw.js` each time the app is opened, kept page
or not, so this reaches every browser that has the worker; it deletes what
the worker kept (never the booths, which are in IndexedDB) and unregisters:

```js
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name.startsWith("booth-")) await caches.delete(name);
      await self.registration.unregister();
    })(),
  ),
);
```

**`window.BOOTH_ASSETS`** works in production and records, per texture set,
whether it loaded and what it found. `window.BOOTH_BUILD` gives the deployed
commit. `window.__booth` is dev-only.

Two real causes were found, and one of them no longer exists:

- ~~**An uploaded ground photograph outranks the Ground kind entirely.**~~
  **Fixed.** Presets and uploads are two groups of one picker, so a preset
  always switches the floor and there is nothing to remove first. An older
  backup's upload opens as the first entry of the library. If a report from
  before this shipped mentions Remove ground texture, that is why.
- **A ground kind whose files are missing** falls back to the procedural
  surface silently. That is by design; `BOOTH_ASSETS` is how you tell that
  apart from a bug.

Ruled out, so do not re-investigate: Cloudflare Workers serves the assets
correctly, checked with `wrangler dev --local`. The build output contains all
37 asset files.

**Also ruled out, 2026-09-18.** "Grass does nothing, the floor stays cement"
was reported again and chased to the end this time. On `main`, against the
committed assets, all six ground kinds load, claim, bind and **render
distinctly** — grass comes out green in a screenshot. `BOOTH_ASSETS` reported
every set `loaded` with all four maps at a 2 m tile, and HEAD on every
`color.jpg` returned 200 `image/jpeg`. The selector, the loader and the
renderer are not the bug. If it recurs it is state or staleness on that
browser, so get **`window.BOOTH_ASSETS` and `window.BOOTH_BUILD` from the
machine seeing it** before touching code. The remaining known cause is a stale
deploy, which looks exactly like this and is not visible from the repository;
the other one, an uploaded ground photo outranking the kind, was removed when
the picker became one list.
## Diagnosing "the video won't play"

- **Ask which codec it used.** The export panel states it before rendering and
  the toast repeats it afterwards. VP9 in MP4 is the fallback for a browser
  with no H.264 encoder; it plays in Chrome, Edge and VLC and **QuickTime
  Player cannot open it at all**. That is the most likely answer, and the app
  now warns rather than handing over a file that looks broken.
- **If it says H.264 and still will not play**, the container is the suspect.
  `muxMp4` takes the encoder's own `decoderConfig.description` verbatim as the
  `avcC` payload, and the H.264 branch has never been produced on real
  hardware here. `tests/video.test.js` parses the file back; use mp4box.js for
  an opinion this repository did not write.
- **The H.264 level is computed from the frame size and rate** (`h264Level`).
  It used to be hard-coded at 4.0, which cannot carry 1440p at any rate or
  1080p at 60 — a stream that exceeds its declared level is out of spec and a
  strict decoder may refuse it. If you add a size or a frame rate, the test
  "every offered size and frame rate declares a level it does not exceed"
  covers you.
