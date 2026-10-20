// Booth Studio's service worker (ROADMAP.md 1.7): the app opens with no
// signal, as on a show floor, once it has been opened here once.
//
// Registered by src/main.js in a built app only, as /sw.js?v=<build commit>,
// so every deploy installs a new worker. What it does with a request:
//
// - Opening the app (a navigation to "/", a booth link's ?share=… too): the
//   network first, so a connected browser gets the deployed page; the page
//   kept last time stands in when there is no network, and after PAGE_WAIT
//   when the network is too slow to answer (one bar at a fair). Any other
//   page (the pitch deck) is the network's alone and is never kept.
// - The build's own files (/assets/<name>-<hash>.js, .css, fonts): all of
//   them kept when the worker installs — the chunks loaded on demand too,
//   from the list vite.config.js writes beside this file (sw-files.json) —
//   and served from here after that; their names change whenever their
//   bytes do. Each new version keeps what it needs and lets the rest go.
// - Textures, HDRIs, the cut-out people and the icons (/assets/<folder>/…):
//   kept as they are first used (never all 29 MB up front) and across
//   deploys, served from here, and fetched again in the background once in
//   this worker's life. The app first asks for each with a HEAD (to tell a
//   file from the page a missing file is answered with): a kept file
//   answers that too.
// - Nothing else: the share links (/api), the studio (/v1, /assistant),
//   other sites and anything that is not a GET or that HEAD go straight to
//   the network.
//
// A missing file is answered with the page itself by the Worker (a 200,
// text/html), so nothing of type text/html is ever kept for a file: the
// app's texture fallbacks depend on seeing that answer, and a kept one
// would hide a texture for good.
//
// If installing fails anywhere (no page, a file that won't come), the whole
// install fails and the worker already here stays, with what it kept.
// To turn all of this off, set OFFLINE in src/main.js to false: the page
// then unregisters this worker and deletes what it kept.

const VERSION = new URL(self.location).searchParams.get("v") || "dev";
const SHELL = "booth-shell";
const BUILD = "booth-build";
const MEDIA = "booth-media";
const KEEP = [SHELL, BUILD, MEDIA];
const LIST = "/sw-files.json";
// How long opening the app waits for the network before the kept page stands in.
const PAGE_WAIT = 4000;

// /assets/index-B1x2y3z4.js, /assets/three-pUL6G2JY.js, a font: a name, a hash, an extension.
const HASHED = /^\/assets\/[^/]+-[\w-]{8,}\.(?:js|css|woff2?|ttf|png|svg|jpe?g|webp)$/;
const MEDIA_PATH = /^\/(?:assets\/(?:hdri|textures|people)\/|icons\/|favicon\.svg$|manifest\.webmanifest$)/;
const NETWORK_ONLY = /^\/(?:api|v1|assistant)(?:\/|$)/;

const isPage = (res) => (res.headers.get("content-type") || "").includes("text/html");
const keepable = (res) => res && res.ok && res.type === "basic" && !isPage(res);
const quietly = (promise) => promise.catch(() => {});
// Media fetched again already in this worker's life.
const refreshed = new Set();

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const list = await fetch(`${LIST}?v=${encodeURIComponent(VERSION)}`, { cache: "no-cache" });
      if (!list.ok || isPage(list)) throw new Error("No file list for this build.");
      const { files } = await list.clone().json();
      const page = await fetch("/", { cache: "no-cache" });
      if (!page.ok || !isPage(page)) throw new Error("No page to keep.");
      const build = await caches.open(BUILD);
      const have = new Set((await build.keys()).map((r) => new URL(r.url).pathname));
      await Promise.all(
        files
          .filter((p) => !have.has(p))
          .map(async (p) => {
            const res = await fetch(p);
            if (!keepable(res)) throw new Error(`Could not keep ${p}.`);
            await build.put(p, res);
          }),
      );
      await build.put(LIST, list);
      await (await caches.open(SHELL)).put("/", page);
      await self.skipWaiting();
    })(),
  );
});

// The new version takes over at once. The build's files not on its list go
// (the old app's scripts); the page and the textures stay.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name.startsWith("booth-") && !KEEP.includes(name)) await caches.delete(name);
      const build = await caches.open(BUILD);
      const list = await build.match(LIST);
      if (list) {
        const wanted = new Set([LIST, ...(await list.json()).files]);
        for (const req of await build.keys()) if (!wanted.has(new URL(req.url).pathname)) await build.delete(req);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || NETWORK_ONLY.test(url.pathname)) return;

  if (req.method === "HEAD" && MEDIA_PATH.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const kept = await (await caches.open(MEDIA)).match(url.href);
        if (!kept) return fetch(req);
        // The kept file's answer without its body; its length would promise one.
        const headers = new Headers(kept.headers);
        headers.delete("content-length");
        return new Response(null, { status: kept.status, statusText: kept.statusText, headers });
      })(),
    );
    return;
  }
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    if (url.pathname !== "/") return;
    event.respondWith(
      (async () => {
        const shell = await caches.open(SHELL);
        const network = fetch(req);
        event.waitUntil(
          quietly(
            network.then((res) => {
              if (res.ok && isPage(res)) return shell.put("/", res.clone());
            }),
          ),
        );
        const kept = await shell.match("/");
        if (!kept) return network;
        const slow = new Promise((done) => setTimeout(() => done(kept), PAGE_WAIT));
        return Promise.race([network.catch(() => kept), slow]);
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
        if (keepable(res)) event.waitUntil(quietly(build.put(url.pathname, res.clone())));
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
        if (kept) {
          if (!refreshed.has(url.href)) {
            refreshed.add(url.href);
            event.waitUntil(
              quietly(
                fetch(req).then((res) => {
                  if (keepable(res)) return media.put(req, res);
                }),
              ),
            );
          }
          return kept;
        }
        const res = await fetch(req);
        if (keepable(res)) event.waitUntil(quietly(media.put(req, res.clone())));
        return res;
      })(),
    );
  }
});
