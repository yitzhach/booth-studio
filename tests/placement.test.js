// A project as a studio placement and back (src/placement.js), and the
// Worker's /v1 forward to the studio API (worker/index.js forwardToStudio).
// The two-device run (tests/two-devices.mjs) drives the same code in a
// browser against a real studio-api; these hold the rules without one.
import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, demoProject, validateProject } from "../src/model.js";
import {
  FORMAT, IMAGES_MAX, SCENE_MAX, blobOf, bytesOf, fileIdsOf, imagesReady, manifestOf, missingImages, patchFor, placementOf,
  platformId, projectFrom, sceneFromRecord, sceneOf, sceneText, tooBig, typeOf,
} from "../src/placement.js";
import worker, { forwardToAssistant, forwardToStudio } from "../worker/index.js";
import { readSession, writeSession } from "../src/studio-session.js";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const booth = () => {
  const p = blankProject();
  p.name = "Spring booth";
  p.assets.w = { width: 1000, height: 800, role: "artwork", name: "heron.png", data: PNG, thumb: "data:image/jpeg;base64,/9j/" };
  p.art = [{ ...demoProject().art[0], id: "a1", asset: "w" }];
  return p;
};

test("a project's placement: real size in columns, the layout as the scene, images as a manifest", () => {
  const p = booth();
  const f = placementOf(p);
  assert.equal(f.format, FORMAT);
  assert.deepEqual([f.kind, f.name, f.width, f.depth, f.height, f.sizeUnit], ["booth", "Spring booth", 120, 120, 96, "in"]);
  assert.equal(f.scene.assets, undefined, "no images inside the scene");
  assert.equal(JSON.stringify(f.scene).includes("iVBOR"), false, "and no bytes anywhere in it");
  assert.deepEqual(f.images, [{ key: "w", fileId: null, name: "heron.png", contentType: "image/png", width: 1000, height: 800, bytes: 8, role: "artwork" }]);
  // The project itself is untouched.
  assert.equal(p.assets.w.data, PNG);
});

test("a placement turns back into the same project, which today's app opens (schema 1)", () => {
  const p = booth();
  const record = { id: "01J000000000000000000000AA", ...placementOf(p, { w: "01J000000000000000000000FF" }) };
  assert.equal(record.images[0].fileId, "01J000000000000000000000FF");
  const back = projectFrom(record, { w: p.assets.w });
  assert.deepEqual(back, JSON.parse(JSON.stringify(p)));
  assert.doesNotThrow(() => validateProject(back));
  // A backup of it is the project as JSON, exactly what a backup was before.
  const file = JSON.parse(JSON.stringify(back));
  assert.doesNotThrow(() => validateProject(file));
});

test("the same project always gives the same scene text; a change gives a patch of only what moved", () => {
  const p = booth();
  assert.equal(sceneText(sceneOf(p)), sceneText(sceneOf(JSON.parse(JSON.stringify(p)))));
  const record = placementOf(p);
  assert.equal(patchFor(record, placementOf(p)), null);
  p.booth.color = "#112233";
  assert.deepEqual(Object.keys(patchFor(record, placementOf(p))), ["scene"]);
  p.name = "Summer";
  assert.deepEqual(Object.keys(patchFor(record, placementOf(p))).sort(), ["name", "scene"]);
});

test("a rename made outside the app (the assistant, the API) reaches the project instead of being sent back", () => {
  const p = booth();
  const record = { id: "01J000000000000000000000AA", ...placementOf(p) };
  // Unchanged, and the column's trimmed or defaulted name, leave the scene as it is.
  assert.equal(sceneText(sceneFromRecord(record)), sceneText(sceneOf(p)));
  for (const name of ["  Spring booth ", ""]) {
    const q = { ...p, name };
    const r = { ...record, ...placementOf(q) };
    assert.equal(sceneText(sceneFromRecord(r)), sceneText(sceneOf(q)), JSON.stringify(name));
  }
  // Renamed in the studio: only the column moved, and the column wins.
  const renamed = { ...record, name: "Winter Park booth", version: 2 };
  assert.notEqual(sceneText(sceneFromRecord(renamed)), sceneText(sceneOf(p)), "the bridge sees a change to apply");
  const back = projectFrom(renamed, { w: p.assets.w });
  assert.equal(back.name, "Winter Park booth");
  assert.doesNotThrow(() => validateProject(back));
  // Once opened, the project's own placement agrees with the row's name: nothing is sent back over it.
  assert.equal(placementOf(back).name, "Winter Park booth");
  assert.deepEqual(Object.keys(patchFor(renamed, placementOf(back)) || {}), ["scene"], "only the scene catches up");
  assert.equal(record.scene.name, "Spring booth", "the record itself is untouched");
});

test("file ids come from the last manifest, so an image goes up once", () => {
  const p = booth();
  p.assets.g = { width: 10, height: 10, role: "ground", data: PNG };
  const known = fileIdsOf([{ key: "w", fileId: "01J000000000000000000000FF" }, { key: "x", fileId: null }]);
  assert.deepEqual(known, { w: "01J000000000000000000000FF" });
  const images = manifestOf(p, known);
  assert.deepEqual(images.map((i) => [i.key, i.fileId]), [["w", "01J000000000000000000000FF"], ["g", null]]);
  assert.equal(imagesReady({ images }), false, "g isn't uploaded yet");
  assert.equal(imagesReady({ images: [images[0]] }), true);
  assert.deepEqual(missingImages({ images }, { w: p.assets.w }).map((i) => i.key), ["g"]);
});

test("ids: the same project id always maps to the same ULID; a ULID maps to itself", async () => {
  const a = await platformId("bf26e45f-f10c-4b7d-8a99-addf958993da");
  assert.match(a, /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  assert.equal(await platformId("bf26e45f-f10c-4b7d-8a99-addf958993da"), a);
  assert.notEqual(await platformId("another"), a);
  assert.notEqual(await platformId("bf26e45f-f10c-4b7d-8a99-addf958993da", "import:"), a, "op ids live in their own space");
  assert.equal(await platformId(a), a);
});

test("data: URLs: the declared type, the exact decoded size, the bytes", async () => {
  assert.equal(typeOf(PNG), "image/png");
  assert.equal(typeOf("data:model/gltf-binary;base64,Z2xURg=="), "model/gltf-binary");
  for (const raw of ["", "a", "ab", "abc", "abcd", "hello world!"]) {
    const url = `data:application/octet-stream;base64,${Buffer.from(raw).toString("base64")}`;
    assert.equal(bytesOf(url), raw.length, JSON.stringify(raw));
    const blob = blobOf(url);
    assert.equal(blob.size, raw.length);
    assert.equal(Buffer.from(await blob.arrayBuffer()).toString(), raw);
  }
  assert.equal(blobOf(PNG).type, "image/png");
});

test("a project too big for one studio row says so in words, and stays on the device", () => {
  const p = booth();
  assert.equal(tooBig(sceneOf(p), manifestOf(p)), null);
  p.notes = "x".repeat(SCENE_MAX);
  assert.match(tooBig(sceneOf(p), manifestOf(p)), /more than the studio keeps for one booth/);
  const many = Array.from({ length: IMAGES_MAX + 1 }, (_, i) => ({ key: `k${i}` }));
  assert.match(tooBig({}, many), /401 images/);
});

test("the Worker forwards /v1/* to the studio API, and says so plainly when it can't", async () => {
  const seen = [];
  const API = { fetch: async (req) => (seen.push(new URL(req.url).pathname), Response.json({ ok: true })) };
  const ASSETS = { fetch: async () => new Response("app") };
  const res = await worker.fetch(new Request("https://booth.test/v1/me"), { API, ASSETS });
  assert.equal(res.status, 200);
  assert.deepEqual(seen, ["/v1/me"]);
  assert.equal(await (await worker.fetch(new Request("https://booth.test/index.html"), { API, ASSETS })).text(), "app");
  // A branch preview has no binding; a platform that is down throws.
  const none = await forwardToStudio(new Request("https://booth.test/v1/me"), {});
  assert.equal(none.status, 503);
  assert.equal((await none.json()).error.code, "unavailable");
  const down = await forwardToStudio(new Request("https://booth.test/v1/me"), { API: { fetch: async () => { throw new Error("gone"); } } });
  assert.equal(down.status, 503);
  // Share links are untouched by any of this.
  const share = await worker.fetch(new Request("https://booth.test/api/share/x"), { API, ASSETS });
  assert.equal(share.status, 503, "no SHARES bucket here: the share routes answer as they always did");
  assert.deepEqual(seen, ["/v1/me"]);
});

test("the session flag: absent unless signed in, and unreadable storage means signed out", () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  assert.equal(readSession(storage), null);
  writeSession({ signedIn: true, email: "a@b.c" }, storage);
  assert.equal(readSession(storage).email, "a@b.c");
  writeSession(null, storage);
  assert.equal(readSession(storage), null);
  assert.equal(readSession({ getItem: () => { throw new Error("blocked"); } }), null);
  store.set("booth.studio", "{nope");
  assert.equal(readSession(storage), null);
});

test("the Worker forwards /assistant/* to the assistant where one is bound, and says whether one is", async () => {
  const req = (path, init) => new Request(`https://booth.test${path}`, init);
  // No binding (production before "Deploy production assistant", a branch preview): available false, chat 404.
  let res = await forwardToAssistant(req("/assistant/status"), {});
  assert.deepEqual([res.status, await res.json()], [200, { available: false }]);
  res = await forwardToAssistant(req("/assistant/chat", { method: "POST", body: "{}" }), {});
  assert.equal(res.status, 404);
  assert.match((await res.json()).error.message, /isn't switched on/);
  // Bound (staging): status says so; everything else goes to the assistant, cookie and all.
  const seen = [];
  const ASSISTANT = { fetch: async (r) => (seen.push([r.method, new URL(r.url).pathname, r.headers.get("cookie")]), new Response("event: end\ndata: {}\n\n", { headers: { "content-type": "text/event-stream" } })) };
  res = await forwardToAssistant(req("/assistant/status"), { ASSISTANT });
  assert.deepEqual(await res.json(), { available: true });
  res = await worker.fetch(req("/assistant/chat", { method: "POST", body: "{}", headers: { cookie: "studio_session=abc" } }), { ASSISTANT, ASSETS: { fetch: () => new Response("asset") } });
  assert.equal(res.headers.get("content-type"), "text/event-stream");
  assert.deepEqual(seen, [["POST", "/assistant/chat", "studio_session=abc"]]);
  // The assistant down: a 503 in the API's error shape.
  res = await forwardToAssistant(req("/assistant/chat", { method: "POST" }), { ASSISTANT: { fetch: async () => { throw new Error("down"); } } });
  assert.equal(res.status, 503);
});
