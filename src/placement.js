// A Booth Studio project as a studio placement, and back (Art-Talk-Back D-060).
//
// Pure: no DOM, no network, so tests/placement.test.js can hold every rule.
// src/studio.js does the talking.
//
// The shape, decided with the platform:
//
// - **`scene` is the schema-1 project with its images taken out** — every key
//   the project has, exactly as a backup would carry it, minus `assets`. So a
//   placement turns back into a project with no translation, and that project
//   exports to a backup today's app opens (schema 1 is forever).
// - **`images` is the manifest**: one entry per asset, keyed by the asset id
//   the scene already uses (`art[].asset`, `photo.asset`, "upload:<id>"
//   grounds…), naming the studio file that holds the original once it has
//   been uploaded (`fileId`, null until then). The bytes never go in the row
//   (D-061); thumbnails are made again on each device.
// - The space's real size (`width`, `depth`, `height` in inches) and the name
//   sit in columns, so a list or another app (ar-wall-placer, later) can read
//   them without knowing Booth Studio's format.
//
// A project too big for one row — the platform caps the scene at 600,000
// characters and the manifest at 400 images so a logged write fits in D1 —
// is refused here first, with words, and stays on the device.

export const FORMAT = "booth-studio/1";
export const SCENE_MAX = 600_000;
export const IMAGES_MAX = 400;
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * The studio id for a project id: a ULID-shaped id derived from its SHA-256,
 * so every device — and a re-run of the import — computes the same one with
 * no lookup table (the Show Tracker's rule, Art-Talk-Back D-038). An id that
 * is already a ULID is used as it is.
 */
export async function platformId(projectId, prefix = "booth-studio:") {
  const raw = String(projectId || "");
  if (/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(raw)) return raw;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(prefix + raw));
  const b = new Uint8Array(digest);
  let n = 0n;
  for (let i = 0; i < 16; i++) n = (n << 8n) | BigInt(b[i]);
  let out = "";
  for (let j = 0; j < 26; j++) {
    out = CROCKFORD[Number(n & 31n)] + out;
    n >>= 5n;
  }
  return out;
}

/** The media type a data: URL declares. */
export const typeOf = (dataUrl) => /^data:([^;,]+)/.exec(String(dataUrl || ""))?.[1] || "application/octet-stream";

/** The decoded size of a base64 data: URL, exactly, without decoding it. */
export function bytesOf(dataUrl) {
  const s = String(dataUrl || "");
  const comma = s.indexOf(",");
  if (comma < 0 || !/;base64$/.test(s.slice(0, comma))) return 0;
  const body = s.length - comma - 1;
  const pad = s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((body * 3) / 4) - pad);
}

/** A data: URL as a Blob, for an upload. */
export function blobOf(dataUrl) {
  const s = String(dataUrl);
  const comma = s.indexOf(",");
  const bin = atob(s.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: typeOf(s) });
}

/** The project's layout without its images: what `scene` holds. */
export function sceneOf(project) {
  const { assets: _assets, ...rest } = project;
  return JSON.parse(JSON.stringify(rest));
}

/** The text a scene is compared by: the same project always gives the same text. */
export const sceneText = (scene) => JSON.stringify(scene ?? null);

/**
 * The manifest for a project's assets. `known` maps an asset id to the file
 * id already holding it (from the placement's last manifest), so an image is
 * uploaded once and named ever after.
 */
export function manifestOf(project, known = {}) {
  return Object.entries(project.assets || {}).map(([key, asset]) => ({
    key,
    fileId: known[key] || null,
    name: typeof asset.name === "string" ? asset.name.slice(0, 200) : null,
    contentType: typeOf(asset.data),
    width: Number.isInteger(asset.width) ? asset.width : null,
    height: Number.isInteger(asset.height) ? asset.height : null,
    bytes: bytesOf(asset.data),
    role: typeof asset.role === "string" ? asset.role.slice(0, 50) : null,
  }));
}

/** key → fileId, from a placement's manifest. */
export function fileIdsOf(images) {
  const out = {};
  for (const im of images || []) if (im && im.key && im.fileId) out[im.key] = im.fileId;
  return out;
}

/** Why a project can't go to the studio, in words; null if it can. */
export function tooBig(scene, images) {
  const size = sceneText(scene).length;
  if (size > SCENE_MAX)
    return `This project's layout is ${Math.round(size / 1000)} KB, more than the studio keeps for one booth (${SCENE_MAX / 1000} KB). It stays on this device.`;
  if (images.length > IMAGES_MAX)
    return `This project has ${images.length} images, more than the studio keeps for one booth (${IMAGES_MAX}). It stays on this device.`;
  return null;
}

/** The placement's fields for a project. */
export function placementOf(project, known = {}) {
  const scene = sceneOf(project);
  const images = manifestOf(project, known);
  return {
    kind: "booth",
    name: String(project.name || "Booth").trim().slice(0, 200) || "Booth",
    format: FORMAT,
    width: finite(project.booth?.width),
    depth: finite(project.booth?.depth),
    height: finite(project.booth?.height),
    sizeUnit: "in",
    scene,
    images,
  };
}
const finite = (n) => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null);

/**
 * Only what changed between a placement record and the fields a project
 * gives now: a sync op carries a patch, and the scene is the one big field.
 */
export function patchFor(record, fields) {
  const patch = {};
  for (const [k, v] of Object.entries(fields)) {
    if (JSON.stringify(record?.[k] ?? null) !== JSON.stringify(v ?? null)) patch[k] = v;
  }
  return Object.keys(patch).length ? patch : null;
}

/** Images a placement names that this device doesn't hold (by key). */
export function missingImages(record, have) {
  return (record.images || []).filter((im) => !have[im.key]);
}

/** Whether every image the placement names can be fetched: an upload not yet attached can't. */
export const imagesReady = (record) => (record.images || []).every((im) => !!im.fileId);

/**
 * The project a placement describes, with `assets` filled from `assets`
 * (key → asset). The caller validates it (model.js validateProject) before
 * it replaces anything.
 */
export function projectFrom(record, assets) {
  const project = JSON.parse(JSON.stringify(record.scene || {}));
  project.assets = {};
  for (const im of record.images || []) if (assets[im.key]) project.assets[im.key] = assets[im.key];
  return project;
}
