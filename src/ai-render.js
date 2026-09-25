// The AI-render hook: everything an image model would need to repaint a
// frame of the booth or the show, and the one place a provider plugs in.
//
// Local-first forbids live AI calls, so this is the hook and nothing more.
// The owner decides the provider and how its keys are held; until then
// `render()` does nothing but say so. What exists today is the *frame*:
//
// - `beauty` — the frame as rendered, the picture to be repainted;
// - `depth`  — the same frame's depth pass, near white to far black, linear
//              between the nearest and farthest thing in view (the form
//              depth-conditioned models such as ControlNet expect);
// - `mask`   — the same frame with every surface painted one flat colour by
//              what it is (`SURFACES`), so a model can be told "keep the
//              artwork, restyle the walls";
// - `protect` — the frame's artwork, signs and booth numbers alone, every
//              other pixel transparent, cut by the mask so whatever stands in
//              front of a work cuts it too. AI_EXPORT_PHASE.md's rule is that
//              a model must never repaint the visible artwork: `render()`
//              lays this pass back over whatever the provider returns.
// - `description` — the scene in plain words, from the project itself, for
//              the prompt.
//
// All three images come from one camera, one frame and one size, so they
// line up pixel for pixel. The frame is exported as one JSON file (the images
// as data URLs) — the "AI render pack" — and `render(frame)` takes exactly
// that object, so a provider added later can be tried on a pack exported
// today.
//
// `describeScene` and `renderPack` are pure; Node pins them.
import { STATUSES, boothOf } from "./hall.js";
import { BOOTH_STYLES, KINDS, VENUES, floorOf, showItems } from "./show.js";
import { isShown } from "./model.js";
import { lightBarRail } from "./lightbar.js";

export const PACK_VERSION = 1;
/**
 * The long side of a pack's images. 1536 is about 1.3 megapixels at 16:9;
 * the image-editing models AI_EXPORT_PHASE.md weighs take up to 4, which
 * 2048 stays inside for every frame shape.
 */
export const PACK_LONG = 1536;
export const PACK_SIZES = [1024, 1536, 2048];
/** The surfaces a model may never repaint. */
export const PROTECTED = ["artwork", "label"];

/**
 * What each flat colour of the mask means. The colours are far apart in
 * every channel so a model — or a person with a colour picker — cannot mix
 * two of them up; black is nothing (the backdrop).
 */
export const SURFACES = {
  artwork: { label: "Artwork", color: "#ff2d2d" },
  wall: { label: "Walls and panels", color: "#f0f0f0" },
  floor: { label: "Floor", color: "#5a5a5a" },
  booth: { label: "Booth structure", color: "#9d9d9d" },
  drape: { label: "Pipe and drape", color: "#1f4fd8" },
  tent: { label: "Tent canvas", color: "#ffd400" },
  stand: { label: "Other booths and fittings", color: "#a8773f" },
  furniture: { label: "Pedestals and furniture", color: "#1fbf4a" },
  person: { label: "People", color: "#ff8c00" },
  fixture: { label: "Light fixtures", color: "#b43cff" },
  surroundings: { label: "Surroundings", color: "#00b7ff" },
  label: { label: "Signs and numbers", color: "#ff5fd2" },
};

/** Which surface a view tag stands for (src/views.js TAGS). */
export const TAG_SURFACE = { art: "artwork", furniture: "furniture", panels: "wall", people: "person", fixtures: "fixture", surroundings: "surroundings" };

const ft = (inches) => {
  const f = inches / 12;
  return Number.isInteger(f) ? `${f} ft` : `${Math.round(f * 10) / 10} ft`;
};
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** The booth being edited, in a paragraph. */
export function describeBooth(p) {
  const b = p.booth;
  const art = p.art.filter(isShown);
  const walls = ["back", "left", "right"].filter((w) => b.walls?.[w]?.enabled);
  const kind = b.venue === "artshow" ? "indoor art-show booth" : b.tent ? "outdoor canopy-tent booth" : "open outdoor booth";
  const parts = [`A ${ft(b.width)} × ${ft(b.depth)} ${kind}`];
  if (walls.length) parts.push(`with ${walls.length === 3 ? "walls on three sides" : `a ${walls.join(" and ")} wall`} ${ft(Math.max(...walls.map((w) => b.walls[w].height)))} high, coloured ${b.color}`);
  let text = parts.join(" ") + ".";
  if (art.length) {
    const list = art.slice(0, 12).map((a) => `“${a.title || "Untitled"}” (${Math.round(a.w)} × ${Math.round(a.h)} in, ${String(a.wall || "back").startsWith("panel") ? "a free-standing" : a.wall || "back"} wall)`);
    text += ` ${plural(art.length, "work")} on the walls: ${list.join("; ")}${art.length > 12 ? `; and ${art.length - 12} more` : ""}.`;
  } else text += " No artwork is hung.";
  const peds = (b.pedestals || []).filter(isShown).length;
  const people = (b.people || []).filter(isShown).length;
  const extras = [];
  if (peds) extras.push(plural(peds, "pedestal or piece of furniture", "pedestals and pieces of furniture"));
  if (people) extras.push(plural(people, "person", "people") + " for scale");
  if (lightBarRail(p).on) extras.push("a light rail across the front");
  if (p.lights?.length) extras.push(plural(p.lights.length, "spotlight"));
  if (extras.length) text += ` Also: ${extras.join(", ")}.`;
  return text;
}

/** The show floor, in a paragraph. */
export function describeShow(h, openNumber) {
  const f = floorOf(h);
  const items = showItems(h);
  const booths = items.filter((i) => i.kind === "booth");
  const styles = {};
  for (const it of booths) styles[it.style || "pipe"] = (styles[it.style || "pipe"] || 0) + 1;
  const sold = booths.filter((it) => boothOf(h, it.number).status === "sold").length;
  let text = `${VENUES[f.kind] === VENUES.outdoor ? "An outdoor fair" : "An indoor exhibition hall"}, ${ft(f.width)} × ${ft(f.depth)}, with ${plural(booths.length, "booth")} (${Object.entries(styles)
    .map(([k, n]) => `${n} ${BOOTH_STYLES[k].toLowerCase()}`)
    .join(", ")}${sold ? `; ${sold} ${STATUSES.sold.label.toLowerCase()}` : ""}).`;
  const others = {};
  for (const it of items) if (it.kind !== "booth" && it.kind !== "label") others[it.kind] = (others[it.kind] || 0) + 1;
  if (Object.keys(others).length) text += ` Also on the floor: ${Object.entries(others).map(([k, n]) => `${n} × ${KINDS[k].label.toLowerCase()}`).join(", ")}.`;
  if (Number.isInteger(openNumber) && booths.some((b) => b.number === openNumber)) text += ` Booth ${openNumber} is shown in full detail; the rest are simple structures.`;
  return text;
}

/**
 * The whole scene in words: the show when one is being looked at, then the
 * booth drawn in full (if any), then what the frame is.
 */
export function describeScene(p, { show = null, openNumber } = {}) {
  const out = [];
  if (show) {
    out.push(describeShow(show, openNumber));
    if (Number.isInteger(openNumber) && showItems(show).some((i) => i.number === openNumber)) out.push(`Booth ${openNumber}: ${describeBooth(p)}`);
  } else out.push(describeBooth(p));
  out.push("A measured architectural visualisation; keep every size, position and artwork exactly as shown.");
  return out.join("\n\n");
}

/**
 * One frame's pack: the object `render()` takes and the file the export
 * writes. `images` are data URLs (`beauty`, `depth`, `mask`), all
 * `width` × `height`.
 */
export function renderPack({ images, width, height, camera, description, project = "" }) {
  return {
    kind: "booth-studio/ai-render-pack",
    version: PACK_VERSION,
    created: new Date().toISOString(),
    project,
    width,
    height,
    camera,
    description,
    legend: Object.fromEntries(Object.entries(SURFACES).map(([k, v]) => [k, { ...v }])),
    depth: { encoding: "linear, near = white, far = black", near: camera?.near ?? null, far: camera?.far ?? null },
    images,
  };
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/**
 * The protected pass from the frame and its mask, as RGBA pixel arrays of
 * one size: the frame's own pixel wherever the mask says artwork or a sign,
 * transparent everywhere else. A mask pixel counts when it is within `tol`
 * of a protected colour in every channel — the mask is drawn with the
 * viewport's antialiasing, so an edge pixel is a blend, and a work's edge
 * is better kept than repainted.
 */
export function protectPass(beauty, mask, tol = 48) {
  const keep = PROTECTED.map((k) => hex(SURFACES[k].color));
  const out = new Uint8ClampedArray(beauty.length);
  for (let i = 0; i < beauty.length; i += 4) {
    const hit = keep.some((c) => Math.abs(mask[i] - c[0]) <= tol && Math.abs(mask[i + 1] - c[1]) <= tol && Math.abs(mask[i + 2] - c[2]) <= tol);
    if (!hit) continue;
    out[i] = beauty[i];
    out[i + 1] = beauty[i + 1];
    out[i + 2] = beauty[i + 2];
    out[i + 3] = 255;
  }
  return out;
}

/** `over` laid on `under` (both RGBA of one size): the protected pass back on a repaint. */
export function overlay(under, over) {
  const out = new Uint8ClampedArray(under);
  for (let i = 0; i < over.length; i += 4) {
    const a = over[i + 3] / 255;
    if (!a) continue;
    for (let k = 0; k < 3; k++) out[i + k] = Math.round(over[i + k] * a + under[i + k] * (1 - a));
    out[i + 3] = Math.max(under[i + 3], over[i + 3]);
  }
  return out;
}

/** Whether a value is a pack this version made. */
export const isPack = (x) => !!x && x.kind === "booth-studio/ai-render-pack" && x.version === PACK_VERSION && !!x.images?.beauty;

/**
 * The provider, when one is chosen: `{ name, render: async (pack) => Blob }`.
 * None is, on purpose — see the top of this file. Setting one here is the
 * whole integration; nothing else in the app needs to change.
 */
export const provider = null;

/**
 * Repaint a frame. `frame` is a render pack. Resolves to the provider's
 * image with the protected pass laid back over it — or, with no provider
 * chosen, rejects with a message that says so. `restore(image, frame)` does
 * that laying-back (in the browser, `restoreArtwork`); a provider whose
 * image is not the frame's size is refused, since the artwork would no
 * longer line up.
 */
export async function render(frame, chosen = provider, restore = restoreArtwork) {
  if (!chosen) throw new Error("No AI provider is set up. The render pack has everything one needs; the provider and how its key is kept are still to be chosen.");
  if (!isPack(frame)) throw new Error("That is not an AI render pack from this version of Booth Studio.");
  const image = await chosen.render(frame);
  return frame.images.protect && restore ? restore(image, frame) : image;
}

/** Browser: a Blob or data URL to RGBA pixels at its own size. */
async function pixels(src) {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  const bmp = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext("2d");
  g.drawImage(bmp, 0, 0);
  return { c, g, width: bmp.width, height: bmp.height, data: g.getImageData(0, 0, bmp.width, bmp.height).data };
}

/** Browser: the provider's image with the frame's own artwork laid back on it, as a PNG Blob. */
export async function restoreArtwork(image, frame) {
  const out = await pixels(image);
  if (out.width !== frame.width || out.height !== frame.height)
    throw new Error(`The provider returned ${out.width} × ${out.height}, not the frame's ${frame.width} × ${frame.height}, so the original artwork cannot be laid back exactly. Nothing was saved.`);
  const keep = await pixels(frame.images.protect);
  out.g.putImageData(new ImageData(overlay(out.data, keep.data), out.width, out.height), 0, 0);
  return out.c.convertToBlob({ type: "image/png" });
}
