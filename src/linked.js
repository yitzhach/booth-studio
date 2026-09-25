// Opening one booth of the show floor as a full Booth Studio design.
//
// The owner's answer (2026-09-25): every booth on the floor is light — its
// size, how it is built, its number and its sale — and any one of them can be
// opened as a full design linked to it. Not every booth a full design: that
// would make files huge and the walk slow.
//
// The storage shape, decided here and schema-1 safe (two optional keys of
// `p.hall`, absent from every older backup):
//
// - **The live design stays where it always was.** `p.booth`, `p.art`,
//   `p.lights`, `p.ambient` and `p.views` are the booth being edited, and the
//   whole editor — every panel, the scene, the exports — goes on reading
//   them unchanged. Opening a booth swaps which design is live; it does not
//   teach the editor about several.
// - **`p.hall.open`** is the number of the floor booth the live design
//   belongs to. Absent, it belongs to `p.hall.mine` — which is what every
//   plan saved before this meant — or, with no booth marked mine, to no
//   booth. `0` says the same explicitly: "your own booth, not on this floor".
// - **`p.hall.designs`** holds the designs not being edited, keyed by booth
//   number exactly as the sales in `p.hall.booths` are, so a renumber, a
//   typed number and a delete carry a design the way they carry a sale. Key
//   `"0"` is the booth that belonged to no floor booth, parked when the
//   first floor booth was opened.
//
// A design is `{ booth, art, lights, ambient, views? }`: the project minus
// its identity, its photo composition, its export kit and the hall itself.
// Its images stay in `p.assets`, shared, which is why nothing may delete an
// asset a parked design still names (`assetInDesigns`).
import { applyVenue, blankProject } from "./model.js";
import { showItems } from "./show.js";

export const DESIGN_KEYS = ["booth", "art", "lights", "ambient", "views"];
/** Parked designs a plan may hold: plenty for a promoter, bounded for a backup. */
export const MAX_DESIGNS = 60;
/** The key of the design that belongs to no floor booth. */
export const OWN = 0;

/** The number the live design belongs to, or undefined for none. */
export function liveNumber(h) {
  const n = h?.open ?? h?.mine;
  return Number.isInteger(n) && n !== OWN ? n : undefined;
}

/** Whether booth `number` has a design, live or parked. */
export const hasDesign = (h, number) => liveNumber(h) === number || !!h?.designs?.[number];

/** The live design, lifted off the project (by reference). */
export function takeDesign(p) {
  const d = {};
  for (const k of DESIGN_KEYS) if (p[k] !== undefined) d[k] = p[k];
  return d;
}

/** Make `d` the live design. */
export function putDesign(p, d) {
  for (const k of DESIGN_KEYS) {
    if (d[k] !== undefined) p[k] = d[k];
    else if (k === "views") delete p.views;
  }
}

const clampInt = (n, lo, hi) => Math.round(Math.min(hi, Math.max(lo, n)));

/**
 * A new design for a floor booth that has none: sized from the piece, and
 * built the way the piece says — a canopy tent is the outdoor booth with its
 * tent up, open floor has no walls, pipe and drape and hard wall are the
 * art-show booth with its walls. The booth's own limits (4′ to 30′) bound the
 * size; a 40′ island opens as a 30′ one.
 */
export function freshDesign(piece) {
  const p = blankProject();
  const tent = piece.style === "tent";
  applyVenue(p, tent ? "outdoor" : "artshow");
  const b = p.booth;
  b.width = clampInt(piece.w, 48, 360);
  b.depth = clampInt(piece.d, 48, 360);
  b.walls.back = { ...b.walls.back, width: b.width };
  b.walls.left = { ...b.walls.left, width: b.depth };
  b.walls.right = { ...b.walls.right, width: b.depth };
  b.tent = tent;
  if (piece.style === "open") for (const w of ["back", "left", "right"]) b.walls[w] = { ...b.walls[w], enabled: false };
  return { booth: b, art: [], lights: p.lights, ambient: p.ambient };
}

/**
 * Open floor booth `number` (or `OWN`, the booth that belongs to no floor
 * booth) as the live design: park the live one under the number it belongs
 * to, and bring this one's in — its parked design, or a fresh one sized from
 * its piece. Mutates `p`; returns an error message, or null.
 */
export function openBooth(p, number) {
  const h = p.hall;
  if (!h) return "There is no show floor.";
  const piece = number === OWN ? null : showItems(h).find((i) => i.kind === "booth" && i.number === number);
  if (number !== OWN && !piece) return `There is no booth ${number} on the floor.`;
  const from = liveNumber(h) ?? OWN;
  if (from === number) return null;
  const designs = { ...(h.designs || {}) };
  if (Object.keys(designs).length >= MAX_DESIGNS && !designs[number]) return `${MAX_DESIGNS} linked designs is the limit. Delete a booth that has one, or open one that already does.`;
  designs[from] = takeDesign(p);
  const next = designs[number] || (number === OWN ? null : freshDesign(piece));
  if (!next) return "Your own booth has no design to go back to.";
  delete designs[number];
  putDesign(p, next);
  if (Object.keys(designs).length) h.designs = designs;
  else delete h.designs;
  setOpen(h, number);
  return null;
}

/** Store which booth is open, in its shortest form: absent when it is mine's. */
export function setOpen(h, number) {
  const mine = Number.isInteger(h.mine) ? h.mine : OWN;
  if (number === mine) delete h.open;
  else h.open = number;
}

/**
 * "This is my booth". A live design already on a floor booth stays on it —
 * moving the sale must not carry the design to another booth, which an
 * absent `open` would. A live design on no booth yet is the one this means:
 * it moves in, unless that booth already has a parked design of its own.
 */
export function setMine(h, number) {
  const live = liveNumber(h);
  if (number === undefined) delete h.mine;
  else h.mine = number;
  const joins = live === undefined && number !== undefined && !h.designs?.[number];
  setOpen(h, live ?? (joins ? number : OWN));
}

/**
 * What deleting these booths would do to designs: `{ refuse, drop }`. The
 * booth being edited cannot be deleted from under its own design while the
 * booth-without-a-floor-booth slot is already taken — there would be nowhere
 * to put it. Otherwise a deleted booth's parked design goes with it (undo
 * brings both back) and a deleted live booth's design becomes your own
 * booth's.
 */
export function deleteEffect(h, numbers) {
  const live = liveNumber(h);
  const drop = numbers.filter((n) => h.designs?.[n]);
  const refuse = live !== undefined && numbers.includes(live) && !!h.designs?.[OWN];
  return { refuse, drop, orphan: live !== undefined && numbers.includes(live) };
}

/**
 * Carry parked designs and `open` through booths renumbered `{ from, to }`.
 * `mine` is the caller's (it moves with the sale); call this after it has
 * moved, so an `open` that now equals it is dropped.
 */
export function renumberDesigns(h, moves) {
  if (h.designs) {
    const moved = {};
    for (const m of moves) if (h.designs[m.from]) moved[m.to] = h.designs[m.from];
    for (const m of moves) delete h.designs[m.from];
    Object.assign(h.designs, moved);
  }
  if (h.open !== undefined) {
    const m = moves.find((x) => x.from === h.open && h.open !== OWN);
    setOpen(h, m ? m.to : h.open);
  }
}

/** Whether any parked design names asset `id` — which must then be kept. */
export function assetInDesigns(p, id) {
  const d = p.hall?.designs;
  return !!d && JSON.stringify(d).includes(JSON.stringify(id));
}
