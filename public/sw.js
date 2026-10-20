// Booth Studio's service worker (ROADMAP.md 1.7): the app opens with no
// signal, as on a show floor, once it has been opened here once.
//
// Registered by src/main.js in a built app only, as /sw.js?v=<build commit>,
// so every deploy installs a new worker. What it keeps, and when:
//
// - The page and every file of the build — the chunks loaded on demand too,
//   from the list vite.config.js writes beside this file (sw-files.json) —
//   are kept together, by the install and only by the install, so the kept
//   page always names files that are kept. An install that fails anywhere
//   (no page, a file that won't come, a page and a list from two deploys)
//   fails whole, and the worker already here stays with what it kept. A new version keeps its own files and the
//   previous version's (a tab still open on that one may need its chunks)
//   and lets older ones go.
// - Textures, HDRIs and the cut-out people (/assets/<folder>/…) are kept as
//   they are first used — never all 29 MB up front — and across deploys.
//   Served from here; looked at again in the background once a day, through
//   the browser's own cache (a 304 when unchanged), and let go once the site
//   no longer has the file, so the app's fallback shows. The app first asks
//   for each with a HEAD, to tell a file from the page a missing file is
//   answered with: a kept file answers that too.
// - The manifest, the favicon and the icons: the network first, the kept
//   copy with no network.
//
// What it answers, and how:
//
// - Opening the app (a navigation to "/", a booth link's ?share=… too): the
//   network first, so a connected browser gets the deployed page (and
//   follows a redirect); the kept page when there is no network, when the
//   network answers with an error, or after PAGE_WAIT of a network too slow
//   to answer (one bar at a fair). Any other page (the pitch deck) is the
//   network's alone.
// - The build's files: from here, else the network.
// - Nothing else: the share links (/api), the studio (/v1, /assistant),
//   other sites and anything but a GET (or that HEAD) go straight to the
//   network.
//
// A missing file is answered with the page itself by the Worker (a 200,
// text/html), so nothing of type text/html is ever kept for a file: the
// app's texture fallbacks depend on seeing that answer.
//
// To turn all of this off, set OFFLINE in src/main.js to false: the page
// then unregisters this worker and deletes what it kept.

const VERSION = new URL(self.location).searchParams.get("v") || "dev";
const SHELL = "booth-shell";
const BUILD = "booth-build";
const MEDIA = "booth-media";
const KEEP = [SHELL, BUILD, MEDIA];
const LIST = "/sw-files.json";
const PREVIOUS = "/sw-files.previous.json";
// How long opening the app waits for the network before the kept page stands in.
const PAGE_WAIT = 4000;
// How old a kept texture may be before it is looked at again.
const LOOK_AGAIN = 24 * 60 * 60 * 1000;
const KEPT_AT = "x-booth-kept";

// /assets/index-B1x2y3z4.js, /assets/three-pUL6G2JY.js, a font: a name, a hash, an extension.
const HASHED = /^\/assets\/[^/]+-[\w-]{8,}\.(?:js|css|woff2?|ttf|png|svg|jpe?g|webp)$/;
const MEDIA_PATH = /^\/assets\/(?:hdri|textures|people)\//;
const SMALL_PATH = /^\/(?:icons\/|favicon\.svg$|manifest\.webmanifest$)/;

const isPage = (res) => (res.headers.get("content-type") || "").includes("text/html");
const keepable = (res) => res && res.ok && res.type === "basic" && !isPage(res);
const quietly = (promise) => promise.catch(() => {});
const listOf = async (res) => (res ? (await res.clone().json()).files || [] : []);

/** Keeps a response with the time it was kept, so it is looked at again only once a day. */
async function keep(cache, req, res) {
  const headers = new Headers(res.headers);
  headers.set(KEPT_AT, String(Date.now()));
  await cache.put(req, new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const list = await fetch(`${LIST}?v=${encodeURIComponent(VERSION)}`, { cache: "no-cache" });
      if (!list.ok || isPage(list)) throw new Error("No file list for this build.");
      const files = await listOf(list);
      const page = await fetch("/", { cache: "no-cache" });
      if (!page.ok || !isPage(page)) throw new Error("No page to keep.");
      // The page and the list must be one deploy's: one rolling out could
      // pair a new page with the old list, and the kept page would name
      // files that were never kept.
      const named = ((await page.clone().text()).match(/\/assets\/[^"'?#\s]+/g) || []).filter((p) => HASHED.test(p));
      const unlisted = named.filter((p) => !files.includes(p));
      if (unlisted.length) throw new Error(`The page names files its list does not: ${unlisted.join(", ")}.`);
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
      // Every file is in: now the list (the last one becomes the previous)
      // and the page, together.
      const last = await build.match(LIST);
      if (last) await build.put(PREVIOUS, last);
      await build.put(LIST, list);
      await (await caches.open(SHELL)).put("/", page);
      await self.skipWaiting();
    })(),
  );
});

// The new version takes over at once. The build's files on neither its list
// nor the previous one go; the page and the textures stay.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name.startsWith("booth-") && !KEEP.includes(name)) await caches.delete(name);
      const build = await caches.open(BUILD);
      const current = await build.match(LIST);
      if (current) {
        const wanted = new Set([LIST, PREVIOUS, ...(await listOf(current)), ...(await listOf(await build.match(PREVIOUS)))]);
        for (const req of await build.keys()) if (!wanted.has(new URL(req.url).pathname)) await build.delete(req);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Only the paths named below are answered here; every other request,
  // and every other site, goes to the network as if there were no worker.
  if (url.origin !== self.location.origin) return;

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
        // The kept page first, so the network's answer is never left unwatched.
        const kept = await (await caches.open(SHELL)).match("/");
        const network = fetch(req);
        if (!kept) return network;
        // A redirect is the site's answer too (a new address, a sign-in): it
        // is followed, never covered with the kept page.
        const answer = (res) => (res.ok || res.type === "opaqueredirect" ? res : kept);
        const slow = new Promise((done) => setTimeout(() => done(kept), PAGE_WAIT));
        return Promise.race([network.then(answer, () => kept), slow]);
      })(),
    );
    return;
  }

  if (HASHED.test(url.pathname)) {
    event.respondWith(
      (async () => (await (await caches.open(BUILD)).match(url.pathname)) || fetch(req))(),
    );
    return;
  }

  if (SMALL_PATH.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const small = await caches.open(MEDIA);
        try {
          const res = await fetch(req);
          if (keepable(res)) event.waitUntil(quietly(keep(small, req, res.clone())));
          return res;
        } catch (err) {
          const kept = await small.match(req);
          if (kept) return kept;
          throw err;
        }
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
          if (Date.now() - Number(kept.headers.get(KEPT_AT) || 0) > LOOK_AGAIN)
            event.waitUntil(
              quietly(
                fetch(req).then((res) => {
                  if (keepable(res)) return keep(media, req, res);
                  // Gone from the site (the page answers for it, or a 404): let it go.
                  if (isPage(res) || res.status === 404) return media.delete(req);
                }),
              ),
            );
          return kept;
        }
        const res = await fetch(req);
        if (keepable(res)) event.waitUntil(quietly(keep(media, req, res.clone())));
        return res;
      })(),
    );
  }
});
