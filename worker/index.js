// Booth Studio's one backend: booth share links (Show Hub, phase 1).
//
// The owner's word (2026-09-25): an exhibitor sends the promoter a link, not
// a file — "we do it on the backend". Everything else the app does stays in
// the browser; this Worker only answers `/api/*` (`run_worker_first` in
// wrangler.jsonc) and hands every other path to the static assets, exactly
// as before it existed.
//
// Storage is the R2 bucket `booth-studio-shares` (binding `SHARES`):
//
//   shares/<id>/manifest.json   the booth design file (src/booth-file.js)
//                               with every image's `data` taken out —
//                               width, height, role and the small `thumb`
//                               stay, so a manifest alone draws a preview.
//                               Its custom metadata holds `created` (when it
//                               was sent or last updated) and `keyHash`, the
//                               SHA-256 of the sender's key.
//   shares/<id>/assets/<asset>  one image's original, as its data: URL
//
// The routes:
//
//   POST   /api/share                      manifest → { id, key }
//   PUT    /api/share/<id>/assets/<asset>  one original, once, within
//                                          UPLOAD_HOURS of the manifest
//   GET    /api/share/<id>                 the manifest
//   GET    /api/share/<id>/assets/<asset>  one original
//   PUT    /api/share/<id>                 (key) a new manifest under the same
//                                          link → { have: [asset ids kept] }
//   DELETE /api/share/<id>                 (key) the link and everything in it
//
// The key is the sender's and nobody else's: it is returned once, when the
// link is made, kept in the sender's browser (src/share.js), and sent back
// in the `x-share-key` header to update or delete. Only its hash is stored,
// so the bucket's contents cannot update a link.
//
// There are no accounts, so nothing here knows who is Pro: which images a
// browser fetches (originals for Pro, the manifest's previews for Lite) is
// decided in the browser (src/share.js). Real enforcement needs identity —
// see HANDOFF.md → Next. What the Worker does enforce: ids nobody can guess,
// sizes (each image, and every image of one link together), that a manifest
// is a booth design, that an image is one the manifest names and an image at
// all, that nothing is overwritten, that images arrive soon after their
// manifest rather than whenever someone likes, a per-address rate on making
// links and uploading (the `LINK_RATE` and `IMAGE_RATE` bindings), and that
// a link lapses after SHARE_DAYS — refused on read, and deleted by the daily
// sweep (`scheduled`, the cron in wrangler.jsonc).

export const SHARE_KIND = "booth-studio/booth-share";
export const MAX_MANIFEST = 4 * 1024 * 1024;
export const MAX_ASSET = 40_000_000;
/** Every original of one link together: the ceiling the app puts on a backup it opens. */
export const MAX_SHARE_BYTES = 200 * 1024 * 1024;
export const MAX_SHARE_ASSETS = 250;
export const SHARE_DAYS = 180;
/** How long after a manifest is sent (or updated) its images may be uploaded. */
export const UPLOAD_HOURS = 24;
const ID = /^[a-z0-9]{24}$/;
const ASSET_ID = /^[A-Za-z0-9_.:-]{1,80}$/;
const KEY = /^[a-z0-9]{48}$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fail = (status, error) => json({ error }, status);

export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return [...bytes].map((b) => b.toString(36).padStart(2, "0").slice(-2)).join("").slice(0, 24).padEnd(24, "0");
}

async function hash(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Whether a parsed manifest is shaped like one; the app validates the design itself. */
export function validManifest(m) {
  if (!m || m.kind !== SHARE_KIND || m.version !== 1 || !m.design || typeof m.design !== "object" || !m.assets || typeof m.assets !== "object") return false;
  const ids = Object.keys(m.assets);
  if (ids.length > MAX_SHARE_ASSETS) return false;
  return ids.every((id) => {
    const a = m.assets[id];
    return ASSET_ID.test(id) && a && typeof a === "object" && a.data === undefined && (a.thumb === undefined || (typeof a.thumb === "string" && /^data:image\/(png|jpeg);base64,/.test(a.thumb)));
  });
}

async function readLimited(request, limit) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > limit) return null;
  const text = await request.text();
  return text.length > limit ? null : text;
}

const age = (obj) => Date.now() - Date.parse(obj?.customMetadata?.created || "");
const expired = (obj) => !(age(obj) <= SHARE_DAYS * 86400000);

/** A manifest body, parsed and checked, or a failure Response. */
async function readManifest(request) {
  const text = await readLimited(request, MAX_MANIFEST);
  if (text === null) return fail(413, "That booth is too big to share.");
  let m;
  try {
    m = JSON.parse(text);
  } catch {
    return fail(400, "That is not a booth.");
  }
  return validManifest(m) ? { text, m } : fail(400, "That is not a booth.");
}

/** Every object under `prefix`, a page at a time. */
async function listAll(bucket, prefix) {
  const out = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix, cursor });
    out.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function deleteShare(bucket, id) {
  const keys = (await listAll(bucket, `shares/${id}/`)).map((o) => o.key);
  for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
}

/**
 * False when this address has made too many writes this minute: `LINK_RATE`
 * counts links made or updated, `IMAGE_RATE` images uploaded (wrangler.jsonc
 * sets both). No binding, no limit — as in the tests and `vite dev`.
 */
async function withinRate(env, request, binding) {
  if (!env[binding]) return true;
  const { success } = await env[binding].limit({ key: request.headers.get("cf-connecting-ip") || "unknown" });
  return success;
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean); // api, share, id?, assets?, asset?
  if (parts[0] !== "api" || parts[1] !== "share") return fail(404, "Not found.");
  const bucket = env.SHARES;
  if (!bucket) return fail(503, "Sharing is not set up on this server.");
  const method = request.method;
  const tooMany = () => fail(429, "Too many uploads from here just now. Wait a minute and try again.");

  if (parts.length === 2 && method === "POST") {
    if (!(await withinRate(env, request, "LINK_RATE"))) return tooMany();
    const read = await readManifest(request);
    if (read instanceof Response) return read;
    const id = newId();
    const key = newId() + newId();
    await bucket.put(`shares/${id}/manifest.json`, read.text, { httpMetadata: { contentType: "application/json" }, customMetadata: { created: new Date().toISOString(), keyHash: await hash(key) } });
    return json({ id, key }, 201);
  }

  const id = parts[2];
  if (!ID.test(id || "")) return fail(404, "No such booth link.");
  const manifestObj = await bucket.get(`shares/${id}/manifest.json`);
  if (!manifestObj || expired(manifestObj)) return fail(404, "This booth link has expired or never existed.");

  if (parts.length === 3 && method === "GET") {
    return new Response(manifestObj.body, { headers: { "content-type": "application/json", "cache-control": "private, max-age=60" } });
  }

  if (parts.length === 3 && (method === "PUT" || method === "DELETE")) {
    const key = request.headers.get("x-share-key") || "";
    const stored = manifestObj.customMetadata?.keyHash;
    if (!KEY.test(key) || !stored || (await hash(key)) !== stored) return fail(403, "Only the browser that sent this booth can change it.");
    if (method === "DELETE") {
      await deleteShare(bucket, id);
      return json({ ok: true });
    }
    if (!(await withinRate(env, request, "LINK_RATE"))) return tooMany();
    const read = await readManifest(request);
    if (read instanceof Response) return read;
    // An image's data never changes under its id (a new picture is a new
    // id), so an image the new manifest still names is kept, not sent again.
    const have = [];
    const drop = [];
    for (const o of await listAll(bucket, `shares/${id}/assets/`)) {
      const asset = o.key.slice(`shares/${id}/assets/`.length);
      (read.m.assets[asset] ? have : drop).push(o.key);
    }
    if (drop.length) await bucket.delete(drop);
    await bucket.put(`shares/${id}/manifest.json`, read.text, { httpMetadata: { contentType: "application/json" }, customMetadata: { created: new Date().toISOString(), keyHash: stored } });
    return json({ have: have.map((k) => k.slice(`shares/${id}/assets/`.length)) });
  }

  if (parts.length === 5 && parts[3] === "assets") {
    const asset = parts[4];
    const manifest = await manifestObj.json();
    if (!ASSET_ID.test(asset) || !manifest.assets?.[asset]) return fail(404, "This booth has no such image.");
    const key = `shares/${id}/assets/${asset}`;
    if (method === "GET") {
      const obj = await bucket.get(key);
      if (!obj) return fail(404, "This image was never uploaded.");
      return new Response(obj.body, { headers: { "content-type": "text/plain", "cache-control": "private, max-age=86400" } });
    }
    if (method === "PUT") {
      if (!(age(manifestObj) <= UPLOAD_HOURS * 3600000)) return fail(403, "This link's images were sent long ago; send the booth again to change them.");
      if (!(await withinRate(env, request, "IMAGE_RATE"))) return tooMany();
      if (await bucket.head(key)) return fail(409, "This image is already uploaded.");
      const text = await readLimited(request, MAX_ASSET);
      if (text === null) return fail(413, "That image is too big.");
      const model = manifest.assets[asset].role === "model";
      if (!(model ? /^data:model\/gltf-binary;base64,/ : /^data:image\/(png|jpeg);base64,/).test(text)) return fail(400, "That is not an image.");
      const used = (await listAll(bucket, `shares/${id}/assets/`)).reduce((n, o) => n + (o.size || 0), 0);
      if (used + text.length > MAX_SHARE_BYTES) return fail(413, `This booth's images come to more than ${Math.round(MAX_SHARE_BYTES / 1048576)} MB together.`);
      await bucket.put(key, text, { httpMetadata: { contentType: "text/plain" } });
      return json({ ok: true }, 201);
    }
  }
  return fail(405, "Not allowed.");
}

/**
 * The daily sweep: every link past SHARE_DAYS, and anything left under a
 * link whose manifest is gone (a delete cut short), is deleted — so a lapsed
 * link stops costing storage, not only stops opening.
 */
export async function sweep(env) {
  const bucket = env.SHARES;
  if (!bucket) return 0;
  // Every link is listed before any is deleted: deleting while paging can
  // shift what the next page starts from and skip a link.
  const ids = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: "shares/", delimiter: "/", cursor });
    for (const prefix of page.delimitedPrefixes || []) ids.push(prefix.slice("shares/".length).replace(/\/$/, ""));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  let swept = 0;
  for (const id of ids) {
    const m = await bucket.head(`shares/${id}/manifest.json`);
    if (m && !expired(m)) continue;
    await deleteShare(bucket, id);
    swept++;
  }
  return swept;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env);
      } catch {
        return fail(500, "The server could not do that.");
      }
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(sweep(env));
  },
};
