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
//                               stay, so a manifest alone draws a preview
//   shares/<id>/assets/<asset>  one image's original, as its data: URL
//
// The routes:
//
//   POST /api/share                      manifest → { id }
//   PUT  /api/share/<id>/assets/<asset>  one original, once
//   GET  /api/share/<id>                 the manifest
//   GET  /api/share/<id>/assets/<asset>  one original
//
// There are no accounts, so nothing here knows who is Pro: which images a
// browser fetches (originals for Pro, the manifest's previews for Lite) is
// decided in the browser (src/share.js). Real enforcement needs identity —
// see HANDOFF.md → Next. What the Worker does enforce: ids nobody can guess,
// sizes, that a manifest is a booth design, that an image is one the
// manifest names and an image at all, that nothing is overwritten, and that
// a link lapses after SHARE_DAYS.

export const SHARE_KIND = "booth-studio/booth-share";
export const MAX_MANIFEST = 4 * 1024 * 1024;
export const MAX_ASSET = 40_000_000;
export const MAX_SHARE_ASSETS = 250;
export const SHARE_DAYS = 180;
const ID = /^[a-z0-9]{24}$/;
const ASSET_ID = /^[A-Za-z0-9_.:-]{1,80}$/;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const fail = (status, error) => json({ error }, status);

export function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return [...bytes].map((b) => b.toString(36).padStart(2, "0").slice(-2)).join("").slice(0, 24).padEnd(24, "0");
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

async function expired(obj) {
  const made = Date.parse(obj?.customMetadata?.created || "");
  return !Number.isFinite(made) || Date.now() - made > SHARE_DAYS * 86400000;
}

export async function handleApi(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean); // api, share, id?, assets?, asset?
  if (parts[0] !== "api" || parts[1] !== "share") return fail(404, "Not found.");
  const bucket = env.SHARES;
  if (!bucket) return fail(503, "Sharing is not set up on this server.");
  const method = request.method;

  if (parts.length === 2 && method === "POST") {
    const text = await readLimited(request, MAX_MANIFEST);
    if (text === null) return fail(413, "That booth is too big to share.");
    let m;
    try {
      m = JSON.parse(text);
    } catch {
      return fail(400, "That is not a booth.");
    }
    if (!validManifest(m)) return fail(400, "That is not a booth.");
    const id = newId();
    await bucket.put(`shares/${id}/manifest.json`, text, { httpMetadata: { contentType: "application/json" }, customMetadata: { created: new Date().toISOString() } });
    return json({ id }, 201);
  }

  const id = parts[2];
  if (!ID.test(id || "")) return fail(404, "No such booth link.");
  const manifestObj = await bucket.get(`shares/${id}/manifest.json`);
  if (!manifestObj || (await expired(manifestObj))) return fail(404, "This booth link has expired or never existed.");

  if (parts.length === 3 && method === "GET") {
    return new Response(manifestObj.body, { headers: { "content-type": "application/json", "cache-control": "private, max-age=60" } });
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
      if (await bucket.head(key)) return fail(409, "This image is already uploaded.");
      const text = await readLimited(request, MAX_ASSET);
      if (text === null) return fail(413, "That image is too big.");
      const model = manifest.assets[asset].role === "model";
      if (!(model ? /^data:model\/gltf-binary;base64,/ : /^data:image\/(png|jpeg);base64,/).test(text)) return fail(400, "That is not an image.");
      await bucket.put(key, text, { httpMetadata: { contentType: "text/plain" } });
      return json({ ok: true }, 201);
    }
  }
  return fail(405, "Not allowed.");
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
};
