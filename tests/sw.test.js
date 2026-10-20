// public/sw.js, the service worker (ROADMAP.md 1.7), run in node against a
// pretend browser: its caches, its network and its clock. tests/offline.mjs
// proves the same worker in a real Chromium against the built app; this one
// proves the rules that take deploys and days to show — what each version
// keeps and lets go, when a kept texture is looked at again — which no
// browser test can wait for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const ORIGIN = "https://booth.test";
const DAY = 24 * 60 * 60 * 1000;
const LIST = "/sw-files.json";
const PREVIOUS = "/sw-files.previous.json";

// One deploy of the app: its page, the files of its build and the list of
// them that vite.config.js writes. three.js is the same file in every one,
// as it is while the three version doesn't change.
const deploy = (tag) => {
  const files = [`/assets/index-${tag}aaaaaa.js`, "/assets/three-T3t3t3t3.js", `/assets/index-${tag}cccccc.css`, `/assets/studio-${tag}ssssss.js`];
  const page = `<!doctype html><script type="module" src="${files[0]}"></script><link rel="modulepreload" href="${files[1]}"><link rel="stylesheet" href="${files[2]}"><title>${tag}</title>`;
  return { tag, files, page };
};
const A = deploy("A1");
const B = deploy("B2");
const C = deploy("C3");
// What the site serves for a deploy: the page, the list and each file.
const siteOf = (d) => ({
  "/": { type: "text/html", body: d.page },
  [LIST]: { type: "application/json", body: JSON.stringify({ files: d.files }) },
  ...Object.fromEntries(d.files.map((p) => [p, { type: p.endsWith(".css") ? "text/css" : "text/javascript", body: `/* ${p} */` }])),
});

// A pretend browser, shared by every version of the worker installed in it.
function browser(files) {
  const b = { clock: Date.UTC(2026, 9, 20, 12), timers: [], stores: new Map() };
  // The network, as the Worker answers: a file it has, else the page itself
  // with a 200 (the single-page fallback). `offline`, `hang` and `answer`
  // stand in for no signal, one bar and an edge that answers on its own.
  b.net = { files: { ...files }, offline: false, hang: false, answer: null, calls: [] };
  b.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, ORIGIN);
    const method = init.method || input.method || "GET";
    b.net.calls.push({ path: url.pathname + url.search, method, cache: init.cache });
    if (b.net.offline) throw new TypeError("Failed to fetch");
    if (b.net.hang) return new Promise(() => {});
    const special = b.net.answer?.(url.pathname);
    if (special) return special;
    const file = b.net.files[url.pathname] || { ...b.net.files["/"], type: "text/html" };
    const body = file.body ?? "";
    const res = new Response(method === "HEAD" ? null : body, {
      status: file.status || 200,
      headers: { "content-type": file.type, "content-length": String(Buffer.byteLength(body)) },
    });
    Object.defineProperty(res, "type", { value: "basic" });
    return res;
  };
  const abs = (r) => new URL(typeof r === "string" ? r : r.url, ORIGIN).href;
  const cacheOf = (name) => {
    if (!b.stores.has(name)) b.stores.set(name, new Map());
    const m = b.stores.get(name);
    return {
      async put(req, res) {
        m.set(abs(req), { status: res.status, statusText: res.statusText, headers: [...res.headers], body: await res.arrayBuffer() });
      },
      async match(req) {
        const e = m.get(abs(req));
        return e && new Response(e.body, { status: e.status, statusText: e.statusText, headers: e.headers });
      },
      async keys() {
        return [...m.keys()].map((url) => ({ url }));
      },
      async delete(req) {
        return m.delete(abs(req));
      },
    };
  };
  b.caches = {
    async open(name) {
      return cacheOf(name);
    },
    async keys() {
      return [...b.stores.keys()];
    },
    async delete(name) {
      return b.stores.delete(name);
    },
  };
  b.paths = (name) => [...(b.stores.get(name)?.keys() || [])].map((u) => new URL(u).pathname).sort();
  b.text = async (name, path) => (await (await cacheOf(name).match(path))?.text()) ?? null;
  b.header = async (name, path, header) => (await cacheOf(name).match(path))?.headers.get(header) ?? null;

  // A version of the worker, as `src/main.js` registers it: /sw.js?v=<commit>.
  b.worker = (version) => {
    const on = {};
    const self = {
      location: new URL(`/sw.js?v=${version}`, ORIGIN),
      addEventListener: (type, fn) => (on[type] = fn),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    };
    vm.runInNewContext(source, {
      self,
      caches: b.caches,
      fetch: b.fetch,
      Response,
      Headers,
      URL,
      Date: { now: () => b.clock },
      setTimeout: (fn, ms) => b.timers.push({ fn, ms }),
      console,
    });
    const lifecycle = async (type) => {
      const waits = [];
      on[type]({ waitUntil: (p) => waits.push(p) });
      await Promise.all(waits);
    };
    return {
      install: () => lifecycle("install"),
      activate: () => lifecycle("activate"),
      // The page's request: "network" when the worker leaves it alone, else
      // its answer, once everything it does afterwards has finished.
      async request(path, { method = "GET", mode = "cors" } = {}) {
        let answer = null;
        const waits = [];
        on.fetch({
          request: { url: new URL(path, ORIGIN).href, method, mode },
          respondWith: (p) => (answer = Promise.resolve(p)),
          waitUntil: (p) => waits.push(p),
        });
        if (!answer) return "network";
        const res = await answer;
        await Promise.all(waits);
        return res;
      },
    };
  };
  return b;
}
const installed = async (b, d) => {
  b.net.files = { ...b.net.files, ...siteOf(d) };
  const w = b.worker(d.tag);
  await w.install();
  await w.activate();
  return w;
};
const until = async (ok) => {
  for (let i = 0; i < 50 && !ok(); i++) await new Promise((done) => setImmediate(done));
  assert.ok(ok());
};
const sorted = (paths) => [...new Set(paths)].sort();

test("the install keeps the page and every file of its build, asked for under the build's version", async () => {
  const b = browser(siteOf(A));
  await b.worker(A.tag).install();
  assert.deepEqual(b.paths("booth-shell"), ["/"]);
  assert.equal(await b.text("booth-shell", "/"), A.page);
  assert.deepEqual(b.paths("booth-build"), sorted([...A.files, LIST]));
  assert.ok(b.net.calls.some((c) => c.path === `${LIST}?v=${A.tag}` && c.cache === "no-cache"), "the list, past any cache");
  assert.ok(b.net.calls.some((c) => c.path === "/" && c.cache === "no-cache"), "the page, past any cache");
});

test("an install fails whole, and the version already here keeps what it had", async () => {
  const b = browser({});
  await installed(b, A);
  const fails = async (site, why) => {
    b.net.files = site;
    await assert.rejects(b.worker(B.tag).install(), why);
    assert.equal(await b.text("booth-shell", "/"), A.page, `${why}: the kept page is still A's`);
    assert.deepEqual(JSON.parse(await b.text("booth-build", LIST)).files, A.files, `${why}: so is the list`);
    for (const p of A.files) assert.ok(b.paths("booth-build").includes(p), `${why}: ${p} still kept`);
  };
  // A file that won't come: the site answers for it with the page.
  const missing = siteOf(B);
  delete missing[B.files[3]];
  await fails(missing, /Could not keep \/assets\/studio-B2/);
  // A deploy rolling out: the new page with the old list.
  await fails({ ...siteOf(B), [LIST]: siteOf(A)[LIST] }, /names files its list does not: \/assets\/index-B2aaaaaa\.js, \/assets\/index-B2cccccc\.css/);
  // No list (the page answers for it), and no page.
  const unlisted = siteOf(B);
  delete unlisted[LIST];
  await fails(unlisted, /No file list/);
  b.net.answer = (p) => p === "/" && new Response("Service unavailable", { status: 503, headers: { "content-type": "text/html" } });
  await fails(siteOf(B), /No page to keep/);
});

test("each version keeps its own files and the previous version's, for a tab still open on it; older ones go", async () => {
  const b = browser({});
  await installed(b, A);
  await installed(b, B);
  b.stores.set("booth-old", new Map());
  b.stores.set("someone-else", new Map());
  await b.caches.open("booth-media");
  await installed(b, C);
  assert.deepEqual(b.paths("booth-build"), sorted([...B.files, ...C.files, LIST, PREVIOUS]));
  assert.deepEqual(JSON.parse(await b.text("booth-build", PREVIOUS)).files, B.files);
  assert.equal(await b.text("booth-shell", "/"), C.page);
  assert.deepEqual((await b.caches.keys()).sort(), ["booth-build", "booth-media", "booth-shell", "someone-else"], "a booth cache of no version goes; nobody else's");
  assert.equal(b.net.calls.filter((c) => c.path === "/assets/three-T3t3t3t3.js").length, 1, "three.js, the same in every build, came once");
});

test("opening the app: the network's page when it answers; the kept one with no network, an error, or after 4 s; a redirect is followed", async () => {
  const b = browser({});
  const w = await installed(b, A);
  b.net.files = siteOf(B); // a new deploy is live
  const open = (path = "/") => w.request(path, { mode: "navigate" });
  assert.equal(await (await open()).text(), B.page, "the deployed page");
  assert.equal(await (await open("/?share=0123456789abcdef")).text(), B.page, "a booth link too");
  b.net.offline = true;
  assert.equal(await (await open()).text(), A.page, "no network: the kept page");
  assert.equal(await (await open("/?share=0123456789abcdef")).text(), A.page, "a booth link too");
  b.net.offline = false;
  b.net.answer = (p) => p === "/" && new Response("Service unavailable", { status: 503 });
  assert.equal(await (await open()).text(), A.page, "an error from the edge: the kept page");
  const moved = { type: "opaqueredirect", ok: false, status: 0 };
  b.net.answer = (p) => p === "/" && moved;
  assert.equal(await open(), moved, "a redirect is the site's answer, not covered");
  b.net.answer = null;
  b.net.hang = true;
  b.timers.length = 0;
  const waiting = open();
  await until(() => b.timers.length === 1);
  assert.equal(b.timers[0].ms, 4000);
  b.timers[0].fn();
  assert.equal(await (await waiting).text(), A.page, "one bar of signal: the kept page after the wait");
});

test("with no page kept, opening the app is the network's alone", async () => {
  const b = browser(siteOf(A));
  const w = b.worker(A.tag);
  assert.equal(await (await w.request("/", { mode: "navigate" })).text(), A.page);
  b.net.offline = true;
  await assert.rejects(w.request("/", { mode: "navigate" }), /Failed to fetch/);
});

test("never touched: other pages, the share links, the studio, other sites, anything but a GET", async () => {
  const b = browser({});
  const w = await installed(b, A);
  for (const [path, how] of [
    ["/pitchdeck/", { mode: "navigate" }],
    ["/api/share/0123456789abcdef"],
    ["/api/share", { method: "POST" }],
    ["/v1/projects"],
    ["/assistant/chat", { method: "POST" }],
    ["https://elsewhere.example/assets/index-A1aaaaaa.js"],
    ["https://elsewhere.example/assets/textures/grass/color.jpg"],
    ["https://elsewhere.example/", { mode: "navigate" }],
    ["/", { method: "POST", mode: "navigate" }],
    [LIST],
  ])
    assert.equal(await w.request(path, how), "network", `${how?.method || "GET"} ${path}`);
});

test("the build's files come from what the install kept, else the network, and nothing is kept as it goes", async () => {
  const b = browser({});
  const w = await installed(b, A);
  const asked = b.net.calls.length;
  assert.equal(await (await w.request(A.files[3])).text(), `/* ${A.files[3]} */`);
  assert.equal(b.net.calls.length, asked, "not asked of the network");
  b.net.files["/assets/other-Zz9zz9zz.js"] = { type: "text/javascript", body: "other" };
  assert.equal(await (await w.request("/assets/other-Zz9zz9zz.js")).text(), "other");
  assert.ok(!b.paths("booth-build").includes("/assets/other-Zz9zz9zz.js"), "only the install keeps build files");
});

test("a texture is kept as it is first used, answered from here, looked at again once a day, and let go once the site has none", async () => {
  const b = browser({});
  const w = await installed(b, A);
  const grass = "/assets/textures/grass/color.jpg";
  const askedFor = () => b.net.calls.filter((c) => c.path === grass).length;
  b.net.files[grass] = { type: "image/jpeg", body: "grass 1" };
  assert.equal(await (await w.request(grass)).text(), "grass 1");
  assert.equal(await b.text("booth-media", grass), "grass 1", "kept as it is first used");
  b.net.files[grass].body = "grass 2";
  b.clock += DAY - 1;
  assert.equal(await (await w.request(grass)).text(), "grass 1", "within the day: from here");
  assert.equal(askedFor(), 1, "and not asked of the network");
  b.clock += 2;
  assert.equal(await (await w.request(grass)).text(), "grass 1", "a day on: still answered from here at once");
  assert.equal(askedFor(), 2, "while the network is asked once");
  assert.equal(await b.text("booth-media", grass), "grass 2", "and its answer kept for next time");
  await w.request(grass);
  assert.equal(askedFor(), 2, "then not again for a day");
  // No signal on the day's look: the kept one stays.
  b.clock += DAY + 1;
  b.net.offline = true;
  assert.equal(await (await w.request(grass)).text(), "grass 2");
  assert.equal(await b.text("booth-media", grass), "grass 2");
  b.net.offline = false;
  // Gone from the site, which answers for it with the page: let go.
  delete b.net.files[grass];
  assert.equal(await (await w.request(grass)).text(), "grass 2", "answered one last time");
  assert.equal(await b.text("booth-media", grass), null, "then let go, so the app's fallback shows");
  // A 404 too.
  const sky = "/assets/hdri/artfair/light.hdr";
  b.net.files[sky] = { type: "application/octet-stream", body: "sky" };
  await w.request(sky);
  b.net.files[sky] = { type: "text/plain", body: "Not found", status: 404 };
  b.clock += DAY + 1;
  await w.request(sky);
  assert.equal(await b.text("booth-media", sky), null);
});

test("a texture the site doesn't have reaches the app as the page, and is never kept", async () => {
  const b = browser({});
  const w = await installed(b, A);
  const none = "/assets/textures/none/color.jpg";
  const res = await w.request(none);
  assert.match(res.headers.get("content-type"), /text\/html/, "the app's fallback depends on seeing this");
  assert.equal(await b.text("booth-media", none), null);
});

test("the app's HEAD before a texture is answered from what is kept, with no length; otherwise by the network", async () => {
  const b = browser({});
  const w = await installed(b, A);
  const grass = "/assets/textures/grass/color.jpg";
  b.net.files[grass] = { type: "image/jpeg", body: "grass 1" };
  await w.request(grass);
  const asked = b.net.calls.length;
  b.net.offline = true;
  const head = await w.request(grass, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-type"), "image/jpeg");
  assert.equal(head.headers.get("content-length"), null, "a length would promise a body");
  assert.equal(await head.text(), "");
  assert.equal(b.net.calls.length, asked, "not asked of the network");
  b.net.offline = false;
  const sky = "/assets/hdri/artfair/light.hdr";
  b.net.files[sky] = { type: "application/octet-stream", body: "sky" };
  assert.equal((await w.request(sky, { method: "HEAD" })).status, 200);
  assert.deepEqual(b.net.calls.at(-1), { path: sky, method: "HEAD", cache: undefined }, "not kept: the network's");
});

test("the manifest and the icons: the network first, the kept copy with no signal", async () => {
  const b = browser({});
  const w = await installed(b, A);
  const manifest = "/manifest.webmanifest";
  b.net.files[manifest] = { type: "application/manifest+json", body: '{"name":"Booth Studio"}' };
  assert.equal(await (await w.request(manifest)).text(), '{"name":"Booth Studio"}');
  b.net.files[manifest].body = '{"name":"Booth Studio 2"}';
  assert.equal(await (await w.request(manifest)).text(), '{"name":"Booth Studio 2"}', "the network's, while there is one");
  b.net.offline = true;
  assert.equal(await (await w.request(manifest)).text(), '{"name":"Booth Studio 2"}', "no signal: the last one kept");
  await assert.rejects(w.request("/icons/icon-192.png"), /Failed to fetch/, "never kept, nothing to give");
});
