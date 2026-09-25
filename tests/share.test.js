// Show Hub phase 1: a booth as a link. The Worker (worker/index.js) against
// an in-memory bucket, and the browser half (src/share.js) through it — a
// Pro open gets the originals, a Lite one the previews.
import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, demoProject, validateProject } from "../src/model.js";
import { newHall } from "../src/hall.js";
import { toFloor } from "../src/show.js";
import { designFile, importDesign, readDesignFile } from "../src/booth-file.js";
import { MAX_SHARE_BYTES as CLIENT_BYTES, SHARE_DAYS_SHOWN, deleteShare, downloadShare, forgetLink, joinShare, rememberLink, sentLinks, splitForShare, updateShare, uploadShare } from "../src/share.js";
import worker, { MAX_SHARE_BYTES, SHARE_DAYS, UPLOAD_HOURS, handleApi, newId, sweep } from "../worker/index.js";
import { fakeR2 } from "./helpers/fake-r2.js";

const PNG = "data:image/png;base64,iVBORw0KGgoORIGINAL";
const THUMB = "data:image/jpeg;base64,/9j/THUMB";
const exhibitor = () => {
  const p = blankProject();
  p.name = "Jane Painter";
  p.booth.color = "#335577";
  p.assets.w = { width: 1000, height: 800, role: "artwork", data: PNG, thumb: THUMB };
  p.art = [{ ...demoProject().art[0], id: "a1", asset: "w" }];
  return p;
};
const env = () => ({ SHARES: fakeR2() });
const through = (e) => async (path, init = {}) => handleApi(new Request("https://x" + path, init), e);

test("the manifest carries no originals; the originals go one by one", () => {
  const { manifest, originals } = splitForShare(designFile(exhibitor()));
  assert.equal(manifest.assets.w.data, undefined);
  assert.equal(manifest.assets.w.thumb, THUMB);
  assert.equal(originals.w, PNG);
});

test("share and open: Pro gets originals, Lite the previews, and both import", async () => {
  const e = env();
  assert.doesNotThrow(() => validateProject(exhibitor()));
  const { id, key } = await uploadShare(designFile(exhibitor()), () => {}, through(e));
  assert.match(id, /^[a-z0-9]{24}$/);
  assert.match(key, /^[a-z0-9]{48}$/);
  assert.ok(![...e.SHARES.store.values()].some((v) => JSON.stringify(v).includes(key)), "only the key's hash is stored");
  const pro = readDesignFile(await downloadShare(id, true, () => {}, through(e)));
  assert.equal(pro.assets.w.data, PNG);
  assert.equal(pro.design.booth.color, "#335577");
  const lite = readDesignFile(await downloadShare(id, false, () => {}, through(e)));
  assert.equal(lite.assets.w.data, THUMB, "Lite draws the booth through its previews");
  const floor = blankProject();
  floor.hall = toFloor(newHall());
  assert.equal(importDesign(floor, 104, pro), null);
  assert.doesNotThrow(() => validateProject(floor));
});

test("an image with neither original nor preview drops out with what names it", () => {
  const { manifest } = splitForShare(designFile(exhibitor()));
  delete manifest.assets.w.thumb;
  const f = joinShare(manifest, {});
  assert.deepEqual(f.design.art, []);
  assert.doesNotThrow(() => readDesignFile(f));
});

test("the Worker refuses what it should", async () => {
  const e = env();
  const call = through(e);
  assert.equal((await call("/api/share", { method: "POST", body: "{}" })).status, 400, "not a booth");
  const withData = splitForShare(designFile(exhibitor())).manifest;
  withData.assets.w.data = PNG;
  assert.equal((await call("/api/share", { method: "POST", body: JSON.stringify(withData) })).status, 400, "originals never ride in a manifest");
  assert.equal((await call("/api/share/nope")).status, 404);
  assert.equal((await call("/api/share/" + newId())).status, 404, "an unknown id");
  const { id } = await uploadShare(designFile(exhibitor()), () => {}, call);
  assert.equal((await call(`/api/share/${id}/assets/w`, { method: "PUT", body: PNG })).status, 409, "never overwritten");
  assert.equal((await call(`/api/share/${id}/assets/other`, { method: "PUT", body: PNG })).status, 404, "only images the manifest names");
  const id2 = (await (await call("/api/share", { method: "POST", body: JSON.stringify(splitForShare(designFile(exhibitor())).manifest) })).json()).id;
  assert.equal((await call(`/api/share/${id2}/assets/w`, { method: "PUT", body: "<script>" })).status, 400, "an image at all");
  // A link lapses.
  const key = `shares/${id}/manifest.json`;
  e.SHARES.store.get(key).meta.created = new Date(Date.now() - (SHARE_DAYS + 1) * 86400000).toISOString();
  assert.equal((await call(`/api/share/${id}`)).status, 404);
  assert.equal((await handleApi(new Request("https://x/api/share", { method: "POST", body: "{}" }), {})).status, 503, "no bucket, no sharing");
});

test("everything but /api/* is the static app", async () => {
  let asked = null;
  const res = await worker.fetch(new Request("https://x/pitchdeck/"), { ASSETS: { fetch: (r) => ((asked = new URL(r.url).pathname), new Response("page")) } });
  assert.equal(asked, "/pitchdeck/");
  assert.equal(await res.text(), "page");
});

const age = (e, id, ms) => (e.SHARES.store.get(`shares/${id}/manifest.json`).meta.created = new Date(Date.now() - ms).toISOString());

test("the client and the Worker agree on the limits", () => {
  assert.equal(CLIENT_BYTES, MAX_SHARE_BYTES);
  assert.equal(SHARE_DAYS_SHOWN, SHARE_DAYS);
});

test("the sender updates a link in place: kept images stay, dropped ones go, new ones upload", async () => {
  const e = env();
  const call = through(e);
  const { id, key } = await uploadShare(designFile(exhibitor()), () => {}, call);
  const next = exhibitor();
  next.booth.color = "#aa0000";
  next.assets.v = { width: 10, height: 10, role: "artwork", data: "data:image/png;base64,NEW", thumb: THUMB };
  next.art.push({ ...next.art[0], id: "a2", asset: "v" });
  const sent = [];
  const counting = async (path, init = {}) => ((init.method === "PUT" && path.includes("/assets/") && sent.push(path)), call(path, init));
  await updateShare(id, key, designFile(next), () => {}, counting);
  assert.deepEqual(sent.map((s) => s.split("/").pop()), ["v"], "w was on the server already and is not sent again");
  const got = readDesignFile(await downloadShare(id, true, () => {}, call));
  assert.equal(got.design.booth.color, "#aa0000");
  assert.equal(got.assets.v.data, "data:image/png;base64,NEW");
  // Drop w: its original leaves the bucket.
  const third = exhibitor();
  third.art = [];
  delete third.assets.w;
  await updateShare(id, key, designFile(third), () => {}, call);
  assert.ok(![...e.SHARES.store.keys()].some((k) => k.includes("/assets/")), "images the link no longer names are deleted");
  // An update starts the link's days again.
  age(e, id, (SHARE_DAYS - 1) * 86400000);
  await updateShare(id, key, designFile(exhibitor()), () => {}, call);
  assert.ok(Date.now() - Date.parse(e.SHARES.store.get(`shares/${id}/manifest.json`).meta.created) < 60000);
});

test("only the key changes or deletes a link, and a delete empties it", async () => {
  const e = env();
  const call = through(e);
  const { id, key } = await uploadShare(designFile(exhibitor()), () => {}, call);
  const other = newId() + newId();
  await assert.rejects(updateShare(id, other, designFile(exhibitor()), () => {}, call), /Only the browser that sent/);
  await assert.rejects(deleteShare(id, other, call), /Only the browser that sent/);
  assert.equal((await call(`/api/share/${id}`, { method: "DELETE" })).status, 403, "no key at all");
  await deleteShare(id, key, call);
  assert.equal(e.SHARES.store.size, 0);
  assert.equal((await call(`/api/share/${id}`)).status, 404);
});

test("images arrive soon after their manifest, and one link's images have a ceiling", async () => {
  const e = env();
  const call = through(e);
  const post = async (m) => (await (await call("/api/share", { method: "POST", body: JSON.stringify(m) })).json()).id;
  const m = splitForShare(designFile(exhibitor())).manifest;
  const late = await post(m);
  age(e, late, (UPLOAD_HOURS + 1) * 3600000);
  assert.equal((await call(`/api/share/${late}/assets/w`, { method: "PUT", body: PNG })).status, 403, "too late to upload");
  const full = await post({ ...m, assets: { ...m.assets, big: { width: 1, height: 1, role: "artwork" } } });
  await e.SHARES.put(`shares/${full}/assets/big`, "x".repeat(MAX_SHARE_BYTES - 10));
  assert.equal((await call(`/api/share/${full}/assets/w`, { method: "PUT", body: PNG })).status, 413, "past the link's total");
  // The client says so before sending anything.
  const huge = exhibitor();
  huge.assets.w.data = "data:image/png;base64," + "A".repeat(MAX_SHARE_BYTES);
  let posted = false;
  await assert.rejects(uploadShare(designFile(huge), () => {}, async (path, init) => ((posted = true), call(path, init))), /over the 200 MB/);
  assert.equal(posted, false);
});

test("the rate limiters turn a flood away", async () => {
  let n = 0;
  const e = { ...env(), LINK_RATE: { limit: async ({ key }) => ({ success: (assert.equal(key, "1.2.3.4"), ++n <= 2) }) } };
  const body = JSON.stringify(splitForShare(designFile(exhibitor())).manifest);
  const post = () => handleApi(new Request("https://x/api/share", { method: "POST", body, headers: { "cf-connecting-ip": "1.2.3.4" } }), e);
  assert.equal((await post()).status, 201);
  assert.equal((await post()).status, 201);
  const third = await post();
  assert.equal(third.status, 429);
  assert.match((await third.json()).error, /Wait a minute/);
});

test("the daily sweep deletes lapsed links and leftovers, and keeps live ones", async () => {
  const e = env();
  const call = through(e);
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push((await uploadShare(designFile(exhibitor()), () => {}, call)).id);
  age(e, ids[1], (SHARE_DAYS + 1) * 86400000);
  age(e, ids[3], (SHARE_DAYS + 1) * 86400000);
  e.SHARES.store.delete(`shares/${ids[4]}/manifest.json`); // a delete cut short
  assert.equal(await sweep(e), 3);
  const left = new Set([...e.SHARES.store.keys()].map((k) => k.split("/")[1]));
  assert.deepEqual([...left].sort(), [ids[0], ids[2]].sort());
  assert.equal(await sweep({}), 0, "no bucket, nothing to sweep");
  let waited = null;
  await worker.scheduled({}, e, { waitUntil: (p) => (waited = p) });
  assert.equal(await waited, 0);
});

test("the links this browser sent are remembered, newest first, and forgotten", () => {
  const m = new Map();
  const store = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  assert.deepEqual(sentLinks(store), []);
  rememberLink({ id: "a", key: "k1", name: "One" }, store);
  rememberLink({ id: "b", key: "k2", name: "Two" }, store);
  rememberLink({ id: "a", key: "k1", name: "One, again" }, store);
  assert.deepEqual(sentLinks(store).map((l) => [l.id, l.name]), [["a", "One, again"], ["b", "Two"]]);
  forgetLink("a", store);
  assert.deepEqual(sentLinks(store).map((l) => l.id), ["b"]);
  m.set("booth.sentLinks", "not json");
  assert.deepEqual(sentLinks(store), []);
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(sentLinks(broken), []);
  assert.doesNotThrow(() => rememberLink({ id: "c", key: "k" }, broken));
});
