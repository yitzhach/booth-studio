// Show Hub phase 1: a booth as a link. The Worker (worker/index.js) against
// an in-memory bucket, and the browser half (src/share.js) through it — a
// Pro open gets the originals, a Lite one the previews.
import test from "node:test";
import assert from "node:assert/strict";
import { blankProject, demoProject, validateProject } from "../src/model.js";
import { newHall } from "../src/hall.js";
import { toFloor } from "../src/show.js";
import { designFile, importDesign, readDesignFile } from "../src/booth-file.js";
import { downloadShare, joinShare, splitForShare, uploadShare } from "../src/share.js";
import worker, { SHARE_DAYS, handleApi, newId } from "../worker/index.js";
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
  const id = await uploadShare(designFile(exhibitor()), () => {}, through(e));
  assert.match(id, /^[a-z0-9]{24}$/);
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
  const id = await uploadShare(designFile(exhibitor()), () => {}, call);
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
