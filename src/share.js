// A booth as a link (Show Hub, phase 1): the browser half of worker/index.js.
//
// Send my booth to the promoter used to download a file carrying every
// original image — too big to email. Now it uploads the design once and
// gives back a link, `<site>/?booth=<id>`. The promoter opens it in the app:
// a Pro browser fetches the originals and can put the booth on its show
// floor; a Lite browser gets the previews the manifest already carries (the
// small thumbnails) and can look at the booth, not use it. Which is which is
// the browser's own tier — there are no accounts yet (HANDOFF.md → Next).
//
// The shape on the wire is the design file (src/booth-file.js) with each
// image's `data` lifted out, so a manifest is small and a link opens fast;
// the originals travel one request each.
export const SHARE_KIND = "booth-studio/booth-share";
export const SHARE_PARAM = "booth";
const API = "/api/share";

/** Split a design file into the manifest and the originals to upload. */
export function splitForShare(file) {
  const assets = {};
  const originals = {};
  for (const [id, a] of Object.entries(file.assets)) {
    const { data, ...rest } = a;
    assets[id] = rest;
    originals[id] = data;
  }
  return { manifest: { ...file, kind: SHARE_KIND, assets }, originals };
}

/**
 * A manifest and whatever originals were fetched, back into a design file
 * `readDesignFile` takes. An image with no original fetched uses its preview
 * — the Lite view — and one with neither (a 3D model, for Lite) is left out
 * with every item that names it.
 */
export function joinShare(manifest, originals = {}) {
  const assets = {};
  const missing = new Set();
  for (const [id, a] of Object.entries(manifest.assets || {})) {
    const data = originals[id] ?? (a.role !== "model" ? a.thumb : undefined);
    if (data) assets[id] = { ...a, data };
    else missing.add(id);
  }
  let design = manifest.design;
  if (missing.size) {
    const names = (x) => [...missing].some((id) => JSON.stringify(x).includes(JSON.stringify(id)));
    design = JSON.parse(JSON.stringify(design));
    design.art = (design.art || []).filter((a) => !names(a));
    if (design.booth?.models) design.booth.models = design.booth.models.filter((m) => !names(m));
    if (design.booth?.pedestals) design.booth.pedestals = design.booth.pedestals.filter((m) => !names(m));
  }
  return { kind: "booth-studio/booth-design", version: 1, name: manifest.name, ...(Number.isInteger(manifest.number) ? { number: manifest.number } : {}), design, assets };
}

/** The link for share `id` on this site. */
export const shareLink = (id, origin = location.origin) => `${origin}/?${SHARE_PARAM}=${id}`;

async function answer(res) {
  if (res.ok) return res;
  let msg = "The server could not do that.";
  try {
    msg = (await res.json()).error || msg;
  } catch {}
  throw new Error(msg);
}

/** How long a link lasts from when it was sent or last updated — worker/index.js's SHARE_DAYS. */
export const SHARE_DAYS_SHOWN = 180;
/** Every original of one link together — worker/index.js's MAX_SHARE_BYTES. */
export const MAX_SHARE_BYTES = 200 * 1024 * 1024;

/** Refuse, before anything is sent, a booth the Worker would refuse part-way. */
function checkSize(originals) {
  const total = Object.values(originals).reduce((n, d) => n + (d?.length || 0), 0);
  if (total > MAX_SHARE_BYTES) throw new Error(`its images come to ${Math.round(total / 1048576)} MB, over the ${MAX_SHARE_BYTES / 1048576} MB a link can carry. Take some work off the walls, or send it as a file.`);
}

async function putOriginals(id, originals, skip, progress, f) {
  const ids = Object.keys(originals).filter((a) => !skip.has(a));
  let done = 0;
  progress(done, ids.length);
  for (const a of ids) {
    const res = await f(`${API}/${id}/assets/${encodeURIComponent(a)}`, { method: "PUT", headers: { "content-type": "text/plain" }, body: originals[a] });
    if (res.status !== 409) await answer(res); // 409: already there, which is what we wanted
    progress(++done, ids.length);
  }
}

/**
 * Upload a design file; resolves to `{ id, key }`. The key is what updates or
 * deletes the link later, and only this browser has it (`rememberLink`).
 * `progress(done, total)`.
 */
export async function uploadShare(file, progress = () => {}, f = fetch) {
  const { manifest, originals } = splitForShare(file);
  checkSize(originals);
  const res = await answer(await f(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(manifest) }));
  const { id, key } = await res.json();
  await putOriginals(id, originals, new Set(), progress, f);
  return { id, key };
}

/**
 * Send a design file again under link `id`: whoever opens the link from now
 * on gets this one. Images the link already has are not sent again.
 */
export async function updateShare(id, key, file, progress = () => {}, f = fetch) {
  const { manifest, originals } = splitForShare(file);
  checkSize(originals);
  const res = await answer(await f(`${API}/${encodeURIComponent(id)}`, { method: "PUT", headers: { "content-type": "application/json", "x-share-key": key }, body: JSON.stringify(manifest) }));
  const { have = [] } = await res.json();
  await putOriginals(id, originals, new Set(have), progress, f);
}

/** Delete link `id` and everything on the server under it. */
export async function deleteShare(id, key, f = fetch) {
  await answer(await f(`${API}/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "x-share-key": key } }));
}

// The links this browser has sent, with their keys. Kept on the device, not
// in the project: a backup handed to someone should not hand them the power
// to change a link. Losing it (cleared site data) only loses the ability to
// update or delete; the link itself still opens until it lapses.
const LINKS = "booth.sentLinks";
/** `[{ id, key, name, sent }]`, newest first. */
export function sentLinks(store = globalThis.localStorage) {
  try {
    const list = JSON.parse(store.getItem(LINKS) || "[]");
    return Array.isArray(list) ? list.filter((l) => l && typeof l.id === "string" && typeof l.key === "string") : [];
  } catch {
    return [];
  }
}
function saveLinks(list, store) {
  try {
    store.setItem(LINKS, JSON.stringify(list.slice(0, 50)));
  } catch {}
}
export function rememberLink(link, store = globalThis.localStorage) {
  saveLinks([{ ...link, sent: new Date().toISOString() }, ...sentLinks(store).filter((l) => l.id !== link.id)], store);
}
export function forgetLink(id, store = globalThis.localStorage) {
  saveLinks(sentLinks(store).filter((l) => l.id !== id), store);
}

/** Fetch a share: the manifest, and the originals too when `full`. */
export async function downloadShare(id, full, progress = () => {}, f = fetch) {
  const manifest = await (await answer(await f(`${API}/${encodeURIComponent(id)}`))).json();
  if (manifest?.kind !== SHARE_KIND) throw new Error("That link is not a booth.");
  const originals = {};
  if (full) {
    const ids = Object.keys(manifest.assets || {});
    let done = 0;
    progress(done, ids.length);
    for (const a of ids) {
      originals[a] = await (await answer(await f(`${API}/${encodeURIComponent(id)}/assets/${encodeURIComponent(a)}`))).text();
      progress(++done, ids.length);
    }
  }
  return joinShare(manifest, originals);
}
