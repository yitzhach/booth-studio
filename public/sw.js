// Booth Studio's service worker (ROADMAP.md 1.7): the app opens with no
// signal, as on a show floor, once it has been opened here once.
//
// Registered by src/main.js in a built app only, as /sw.js?v=<build commit>,
// so every deploy installs a new worker and empties the old one's caches.
// What it does with a request:
//
// - Opening the app (a navigation): the network first, so a connected
//   browser always gets the deployed page; with no connection, the copy of
//   the page kept the last time.
// - The build's own files (/assets/<name>-<hash>.js, .css, fonts): kept the
//   first time they are fetched, and served from here after that — their
//   names change whenever their bytes do.
// - Textures, HDRIs, the cut-out people and the icons (/assets/<folder>/…):
//   from here when kept, fetched again in the background to stay current,
//   kept the first time they are used — never all 29 MB up front.
// - Nothing else: the share links (/api), the studio (/v1, /assistant) and
//   other sites go straight to the network, untouched.
//
// A missing file is answered with the page itself by the Worker (a 200,
// text/html), so nothing of type text/html is ever kept for a file: the app
// checks for exactly that answer to fall back to its procedural textures,
// and a kept fallback would hide a texture for good.
//
// To turn all of this off, set OFFLINE in src/main.js to false: the page then
// unregisters this worker and its caches go with the next version.

const VERSION = new URL(self.location).searchParams.get("v") || "dev";
const SHELL = `booth-shell-${VERSION}`;
const BUILD = `booth-build-${VERSION}`;
const MEDIA = `booth-media-${VERSION}`;
const KEEP = [SHELL, BUILD, MEDIA];

// /assets/index-B1x2y3z4.js, /assets/three-pUL6G2JY.js, a font: a name, a hash, an extension.
const HASHED = /^\/assets\/[^/]+-[\w-]{8,}\.(?:js|css|woff2?|ttf|png|svg|jpe?g|webp)$/;
const MEDIA_PATH = /^\/(?:assets\/(?:hdri|textures|people)\/|icons\/|favicon\.svg$|manifest\.webmanifest$)/;
const NETWORK_ONLY = /^\/(?:api|v1|assistant)(?:\/|$)/;

const isPage = (res) => (res.headers.get("content-type") || "").includes("text/html");
const keepable = (res) => res && res.ok && res.type === "basic" && !isPage(res);

// On install, the page and everything it loads at start: the scripts and
// stylesheets it names, and the fonts its stylesheets name.
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const page = await fetch("/", { cache: "no-cache" });
      if (!page.ok || !isPage(page)) return;
      const html = await page.clone().text();
      const shell = await caches.open(SHELL);
      await shell.put("/", page);
      const files = new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]).filter((p) => HASHED.test(p)));
      const build = await caches.open(BUILD);
      for (const css of [...files].filter((p) => p.endsWith(".css"))) {
        try {
          const text = await (await fetch(css)).text();
          for (const m of text.matchAll(/url\((\/assets\/[^)]+\.woff2)\)/g)) files.add(m[1]);
        } catch {}
      }
      await Promise.all(
        [...files].map(async (p) => {
          try {
            const res = await fetch(p);
            if (keepable(res)) await build.put(p, res);
          } catch {}
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

// The new version takes over at once, and the old versions' caches go.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name.startsWith("booth-") && !KEEP.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || NETWORK_ONLY.test(url.pathname)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          // The app's page, whatever the address (a booth link carries ?share=).
          if (res.ok && isPage(res)) (await caches.open(SHELL)).put("/", res.clone());
          return res;
        } catch (err) {
          const kept = await (await caches.open(SHELL)).match("/");
          if (kept) return kept;
          throw err;
        }
      })(),
    );
    return;
  }

  if (HASHED.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const build = await caches.open(BUILD);
        const kept = await build.match(url.pathname);
        if (kept) return kept;
        const res = await fetch(req);
        if (keepable(res)) build.put(url.pathname, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (MEDIA_PATH.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const media = await caches.open(MEDIA);
        const kept = await media.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (keepable(res)) media.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        if (kept) {
          event.waitUntil(fresh);
          return kept;
        }
        return (await fresh) || Response.error();
      })(),
    );
  }
});
