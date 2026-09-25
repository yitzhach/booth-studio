// The show floor: a whole exhibition laid out piece by piece.
//
// The hall planner (src/hall.js) lays a show out as a grid — rows of equal
// booths with aisles between. The show floor is the same plan, freed: every
// booth, walkway, wall, door, column, stage and label is its own piece on the
// floor, dragged, resized, turned and duplicated like shapes on a drawing
// board, and booths of any size sit side by side. It is still `p.hall`: the
// optional `items` list holds the pieces, the optional `venue` the floor
// itself. A plan without `items` is a grid plan and reads exactly as before;
// `showItems()` turns it into pieces the moment the floor is edited, so the
// grid is the quick way to start and the pieces are where it goes from there.
//
// Pure. Inches, like everything else. A piece is a rectangle `w` wide and `d`
// deep centred on `x, y` — x across the floor, y from the back wall toward
// the entrance — turned `rot` degrees clockwise about its centre. The same
// numbers will stand the show up in 3D.
import { hallLayout, hallSize, boothOf, STATUSES } from "./hall.js";

/**
 * Every kind of piece. `w` × `d` is the size it arrives at; `fill` and `line`
 * are how the map draws it; `layer` puts floors (walkways, a pavilion's tent)
 * under the booths and labels over them.
 */
export const KINDS = {
  booth: { label: "Booth", w: 120, d: 120, fill: "#e9eef3", line: "#6b7580", layer: 2 },
  aisle: { label: "Walkway", w: 120, d: 480, fill: "#f3efe4", line: "#d9d0b8", layer: 0 },
  pavilion: { label: "Pavilion tent", w: 480, d: 720, fill: "rgba(120,160,210,0.10)", line: "#7a9cc6", layer: 1 },
  wall: { label: "Wall", w: 240, d: 6, fill: "#3d434a", line: "#3d434a", layer: 3 },
  door: { label: "Entrance", w: 96, d: 12, fill: "#ffffff", line: "#2f7de1", layer: 3 },
  column: { label: "Column", w: 24, d: 24, fill: "#9aa3ad", line: "#6b7580", layer: 3 },
  stage: { label: "Stage", w: 288, d: 144, fill: "#e3dcf3", line: "#8a7cc0", layer: 2 },
  table: { label: "Table", w: 72, d: 30, fill: "#efe6da", line: "#a08c70", layer: 2 },
  desk: { label: "Info desk", w: 96, d: 36, fill: "#dcecf7", line: "#5f8fb5", layer: 2 },
  food: { label: "Food & drink", w: 240, d: 240, fill: "#fbe3d3", line: "#c98a5d", layer: 2 },
  restroom: { label: "Restrooms", w: 144, d: 120, fill: "#e4e8ec", line: "#8a939c", layer: 2 },
  label: { label: "Text", w: 144, d: 30, fill: "none", line: "none", layer: 4 },
};

/** How a booth is built, for the map now and the 3D show next. */
export const BOOTH_STYLES = {
  pipe: "Pipe and drape",
  hardwall: "Hard wall",
  tent: "Canopy tent",
  open: "Open floor",
};

/** The floor a show stands on. */
export const VENUES = { indoor: "Indoor hall", outdoor: "Outdoor fair" };

/**
 * The shape library: what the palette offers, each a kind with its own size
 * and style. A 10 × 20 is a booth of another size, not another kind.
 */
export const SHAPES = [
  { key: "booth10", kind: "booth", label: "10 × 10 booth", w: 120, d: 120 },
  { key: "booth10x20", kind: "booth", label: "10 × 20 booth", w: 240, d: 120 },
  { key: "booth8", kind: "booth", label: "8 × 10 booth", w: 96, d: 120 },
  { key: "island", kind: "booth", label: "20 × 20 island", w: 240, d: 240 },
  { key: "tent10", kind: "booth", label: "10 × 10 tent", w: 120, d: 120, style: "tent" },
  { key: "aisle", kind: "aisle" },
  { key: "pavilion", kind: "pavilion" },
  { key: "wall", kind: "wall" },
  { key: "door", kind: "door" },
  { key: "column", kind: "column" },
  { key: "stage", kind: "stage" },
  { key: "table", kind: "table" },
  { key: "desk", kind: "desk" },
  { key: "food", kind: "food" },
  { key: "restroom", kind: "restroom" },
  { key: "label", kind: "label", text: "Label" },
];

export const SHOW_LIMITS = { size: [2, 12000], pos: [-24000, 48000], floor: [120, 24000] };
export const MAX_ITEMS = 2400;

const inRange = (n, [lo, hi]) => Number.isFinite(n) && n >= lo && n <= hi;

/** Whether stored pieces and venue are ones this version can open. */
export function validShow(h) {
  if (h.venue !== undefined) {
    const v = h.venue;
    if (!v || typeof v !== "object" || !VENUES[v.kind]) return false;
    if (!inRange(v.width, SHOW_LIMITS.floor) || !inRange(v.depth, SHOW_LIMITS.floor)) return false;
  }
  if (h.items === undefined) return true;
  if (!Array.isArray(h.items) || h.items.length > MAX_ITEMS) return false;
  const ids = new Set();
  const numbers = new Set();
  for (const it of h.items) {
    if (!it || typeof it !== "object" || !KINDS[it.kind]) return false;
    if (typeof it.id !== "string" || !/^[\w-]{1,40}$/.test(it.id) || ids.has(it.id)) return false;
    ids.add(it.id);
    if (!inRange(it.x, SHOW_LIMITS.pos) || !inRange(it.y, SHOW_LIMITS.pos)) return false;
    if (!inRange(it.w, SHOW_LIMITS.size) || !inRange(it.d, SHOW_LIMITS.size)) return false;
    if (it.rot !== undefined && !inRange(it.rot, [0, 360])) return false;
    if (it.text !== undefined && (typeof it.text !== "string" || it.text.length > 120)) return false;
    if (it.kind === "booth") {
      if (!Number.isInteger(it.number) || it.number < 1 || it.number > 99999 || numbers.has(it.number)) return false;
      numbers.add(it.number);
      if (it.style !== undefined && !BOOTH_STYLES[it.style]) return false;
    } else if (it.number !== undefined || it.style !== undefined) return false;
  }
  return true;
}

/**
 * The plan's pieces: its own list, or — for a grid plan never edited as a
 * floor — the grid's booths as pieces, centred, in the grid's own numbers.
 */
export function showItems(h) {
  if (h.items) return h.items;
  return hallLayout(h).map((b) => ({ id: "b" + b.number, kind: "booth", number: b.number, x: b.x + b.w / 2, y: b.y + b.d / 2, w: b.w, d: b.d, ...(b.faces === "back" ? { rot: 180 } : {}) }));
}

/** The floor's size: the venue as typed, or the grid's own floor. */
export function floorOf(h) {
  if (h.venue) return { kind: h.venue.kind, width: h.venue.width, depth: h.venue.depth };
  const s = hallSize(h);
  return { kind: "indoor", width: s.width, depth: s.depth };
}

/** Turn a grid plan into a floor of pieces, once, before its first edit. */
export function toFloor(h) {
  if (!h.items) h.items = showItems(h).map((it) => ({ ...it }));
  if (!h.venue) h.venue = floorOf(h);
  return h;
}

/** A piece's axis-aligned box after its turn: `{ l, r, t, b }`. */
export function boxOf(it) {
  const a = (((it.rot || 0) % 180) * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  const hw = (it.w * c + it.d * s) / 2;
  const hd = (it.w * s + it.d * c) / 2;
  return { l: it.x - hw, r: it.x + hw, t: it.y - hd, b: it.y + hd };
}

/** The box round several pieces, or null. */
export function boundsOf(items) {
  if (!items.length) return null;
  const out = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity };
  for (const it of items) {
    const b = boxOf(it);
    out.l = Math.min(out.l, b.l);
    out.r = Math.max(out.r, b.r);
    out.t = Math.min(out.t, b.t);
    out.b = Math.max(out.b, b.b);
  }
  return out;
}

/** A fresh id no piece of the plan has. */
export function newId(items, prefix = "s") {
  const taken = new Set(items.map((i) => i.id));
  let n = items.length + 1;
  while (taken.has(prefix + n)) n++;
  return prefix + n;
}

/** The next free booth number: one past the highest. */
export function nextNumber(items, start = 101) {
  let top = start - 1;
  for (const it of items) if (it.kind === "booth") top = Math.max(top, it.number);
  return top + 1;
}

/** A new piece of the library's `shape`, centred on `x, y`. */
export function makePiece(items, shape, x, y, start = 101) {
  const kind = KINDS[shape.kind];
  const it = { id: newId(items), kind: shape.kind, x, y, w: shape.w ?? kind.w, d: shape.d ?? kind.d };
  if (shape.kind === "booth") {
    it.number = nextNumber(items, start);
    if (shape.style) it.style = shape.style;
  }
  if (shape.text) it.text = shape.text;
  return it;
}

/** Copies of `pieces`, moved by `dx, dy`, with new ids and new booth numbers. */
export function copyPieces(items, pieces, dx, dy, start = 101) {
  const all = [...items];
  const out = [];
  for (const src of pieces) {
    const it = { ...src, id: newId(all), x: src.x + dx, y: src.y + dy };
    if (it.kind === "booth") it.number = nextNumber(all, start);
    all.push(it);
    out.push(it);
  }
  return out;
}

/** Round to the grid, or leave alone when there is none. */
export const toGrid = (v, grid) => (grid > 0 ? Math.round(v / grid) * grid : v);

/**
 * Where a dragged selection lands. `moving` are the pieces as they were when
 * the drag began, `dx, dy` how far the pointer has gone; the selection's box
 * snaps its edges and centre to the other pieces' edges and centres within
 * `range`, and otherwise its top-left corner to the grid. Returns the move to
 * make and the lines that explain it, each `{ axis, at }`.
 */
export function snapMove(moving, others, dx, dy, { grid = 12, range = 6 } = {}) {
  const box = boundsOf(moving);
  if (!box) return { dx, dy, guides: [] };
  const moved = { l: box.l + dx, r: box.r + dx, t: box.t + dy, b: box.b + dy };
  const targets = { x: [], y: [] };
  for (const o of others) {
    const b = boxOf(o);
    targets.x.push(b.l, b.r, (b.l + b.r) / 2);
    targets.y.push(b.t, b.b, (b.t + b.b) / 2);
  }
  const axis = (lo, hi, list) => {
    let best = null;
    for (const at of [lo, hi, (lo + hi) / 2])
      for (const t of list) {
        const delta = t - at;
        if (Math.abs(delta) <= range && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: t };
      }
    return best;
  };
  const guides = [];
  const sx = axis(moved.l, moved.r, targets.x);
  const sy = axis(moved.t, moved.b, targets.y);
  if (sx) {
    dx += sx.delta;
    guides.push({ axis: "x", at: sx.at });
  } else dx = toGrid(box.l + dx, grid) - box.l;
  if (sy) {
    dy += sy.delta;
    guides.push({ axis: "y", at: sy.at });
  } else dy = toGrid(box.t + dy, grid) - box.t;
  return { dx, dy, guides };
}

/**
 * A block of booths: `count` booths `w` × `d`, `perRow` to a row, `gap`
 * between neighbours in a row, rows `aisle` apart — or, back to back, in
 * pairs sharing a back line with the aisle between pairs. Numbered on from
 * the plan's highest, top-left of the block at `x, y`.
 */
export function boothBlock(items, { count, perRow, w, d, gap = 0, aisle = 120, backToBack = false, style, x = 0, y = 0, start = 101 }) {
  const all = [...items];
  const out = [];
  perRow = Math.max(1, Math.min(perRow, count));
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const second = backToBack && row % 2 === 1;
    // Back to back, the first row of a pair faces up the floor, the second
    // down it, so the pair shares a back line with an aisle on each side.
    const first = backToBack && !second;
    const top = backToBack ? y + Math.floor(row / 2) * (2 * d + aisle) + (second ? d : 0) : y + row * (d + aisle);
    const it = { id: newId(all), kind: "booth", number: nextNumber(all, start), x: x + col * (w + gap) + w / 2, y: top + d / 2, w, d };
    if (first) it.rot = 180;
    if (style && style !== "pipe") it.style = style;
    all.push(it);
    out.push(it);
  }
  return out;
}

/**
 * Space pieces evenly: along the direction they are spread the most, each
 * `gap` inches after the one before it, the first staying where it is.
 * Returns the new `{ id, x, y }` for each.
 */
export function spacePieces(pieces, gap) {
  if (pieces.length < 2) return [];
  const bounds = boundsOf(pieces);
  const across = bounds.r - bounds.l >= bounds.b - bounds.t;
  const sorted = [...pieces].sort((a, b) => (across ? a.x - b.x : a.y - b.y));
  const out = [];
  let edge = across ? boxOf(sorted[0]).r : boxOf(sorted[0]).b;
  for (const it of sorted.slice(1)) {
    const b = boxOf(it);
    const half = across ? (b.r - b.l) / 2 : (b.b - b.t) / 2;
    const at = edge + gap + half;
    out.push(across ? { id: it.id, x: at, y: it.y } : { id: it.id, x: it.x, y: at });
    edge = at + half;
  }
  return out;
}

/**
 * Mirror pieces about the middle of the box they fill together: `"x"` flips
 * them left for right (Flip horizontal), `"y"` front for back. Each piece's
 * centre is reflected and its turn with it — a reflection across a vertical
 * line takes a turn of r to −r, across a horizontal one to 180 − r — so a
 * row of booths facing right comes back facing left, still in its row.
 * Pieces are rectangles, so the reflection of one is itself turned. Returns
 * the new `{ id, x, y, rot }` for each (`rot` 0 when unturned).
 */
export function mirrorPieces(pieces, axis = "x") {
  if (!pieces.length) return [];
  const b = boundsOf(pieces);
  const cx = (b.l + b.r) / 2;
  const cy = (b.t + b.b) / 2;
  const round = (n) => Math.round(n * 10) / 10;
  return pieces.map((it) => {
    const r = it.rot || 0;
    const rot = (((axis === "x" ? -r : 180 - r) % 360) + 360) % 360;
    return axis === "x" ? { id: it.id, x: round(2 * cx - it.x), y: it.y, rot } : { id: it.id, x: it.x, y: round(2 * cy - it.y), rot };
  });
}

/**
 * Number the booths afresh from `start`, the way a visitor reads the floor:
 * row by row from the back, left to right, a row being booths whose centres
 * lie within half a booth of each other. Returns `{ id, number }` pairs.
 */
export function renumber(pieces, start) {
  const booths = pieces.filter((i) => i.kind === "booth").sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const b of booths) {
    const row = rows.find((r) => Math.abs(r.y - b.y) < Math.min(b.d, r.d) / 2);
    if (row) row.list.push(b);
    else rows.push({ y: b.y, d: b.d, list: [b] });
  }
  let n = start;
  return rows.flatMap((r) => r.list.sort((a, b) => a.x - b.x).map((b) => ({ id: b.id, number: n++ })));
}

/**
 * The booths as the hall planner counts them — `{ number, row, w, d }`, row
 * being the grid's row or, on a floor, blank — for totals, the CSV and the
 * printed list.
 */
export function showBooths(h) {
  if (!h.items) return hallLayout(h);
  return h.items.filter((i) => i.kind === "booth").map((i) => ({ number: i.number, row: "", w: i.w, d: i.d }));
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const r1 = (n) => Math.round(n * 10) / 10;
const feet = (n) => {
  const f = n / 12;
  return Number.isInteger(f) ? `${f}′` : `${Math.floor(f)}′${r1(n - Math.floor(f) * 12)}″`;
};

/**
 * One piece as SVG: a group turned about its centre, the rectangle coloured
 * by kind — a booth by its sale status — and its words. `data-id` lets the
 * editor find it; `selected` and `mine` outline it.
 */
export function pieceSVG(it, h, { selected = false } = {}) {
  const k = KINDS[it.kind];
  const t = Math.max(6, Math.min(it.w, it.d, 240) * 0.16);
  let fill = k.fill;
  let words = "";
  let line = k.line;
  let width = t * 0.1;
  if (it.kind === "booth") {
    const rec = boothOf(h, it.number);
    fill = STATUSES[rec.status].color;
    if (h.mine === it.number) (line = "#ff5fa2"), (width = t * 0.35);
    const tent = it.style === "tent" ? `<path d="M${-it.w / 2} ${-it.d / 2}L${it.w / 2} ${it.d / 2}M${it.w / 2} ${-it.d / 2}L${-it.w / 2} ${it.d / 2}" stroke="#c7ced6" stroke-width="${t * 0.06}"/>` : "";
    // The number and exhibitor stay upright, whatever way the booth faces.
    words = `${tent}<g transform="rotate(${-(it.rot || 0)})"><text y="${rec.name ? -t * 0.1 : t * 0.4}" font-size="${t * 1.2}" font-weight="700" text-anchor="middle" fill="#1d232b">${it.number}</text>${rec.name ? `<text y="${t * 1.1}" font-size="${t * 0.75}" text-anchor="middle" fill="#1d232b">${esc(rec.name.length > 18 ? rec.name.slice(0, 17) + "…" : rec.name)}</text>` : ""}</g>`;
    // The open front: the side the booth faces is drawn as a gap in the line.
    words += `<line x1="${-it.w / 2}" y1="${it.d / 2}" x2="${it.w / 2}" y2="${it.d / 2}" stroke="${fill}" stroke-width="${width * 1.6}"/>`;
  } else if (it.kind === "label") {
    const size = Math.max(8, it.d * 0.8);
    words = `<text y="${size * 0.35}" font-size="${size}" font-weight="600" text-anchor="middle" fill="#1d232b">${esc(it.text || "")}</text>`;
  } else if (it.kind !== "wall" && it.kind !== "column" && it.kind !== "door") {
    const size = Math.max(8, Math.min(it.w / 8, it.d / 3, 36));
    words = `<g transform="rotate(${-(it.rot || 0)})"><text y="${size * 0.35}" font-size="${size}" text-anchor="middle" fill="#56606b">${esc(it.text || k.label)}</text></g>`;
  }
  const rect = it.kind === "label" ? `<rect x="${-it.w / 2}" y="${-it.d / 2}" width="${it.w}" height="${it.d}" fill="transparent"/>` : `<rect x="${-it.w / 2}" y="${-it.d / 2}" width="${it.w}" height="${it.d}" rx="${it.kind === "column" ? it.w / 2 : 0}" fill="${fill}" stroke="${line}" stroke-width="${width}"${it.kind === "aisle" ? ` stroke-dasharray="${t} ${t * 0.6}"` : ""}/>`;
  const outline = selected ? `<rect class="sel" x="${-it.w / 2}" y="${-it.d / 2}" width="${it.w}" height="${it.d}" fill="none" stroke="#2f7de1" stroke-width="${Math.max(2, t * 0.3)}" vector-effect="non-scaling-stroke"/>` : "";
  return `<g data-id="${esc(it.id)}" data-kind="${it.kind}"${it.kind === "booth" ? ` data-hall-booth="${it.number}"` : ""} transform="translate(${r1(it.x)} ${r1(it.y)})${it.rot ? ` rotate(${it.rot})` : ""}">${rect}${words}${outline}</g>`;
}

/** Every piece, floors first and labels last, as SVG markup. */
export function piecesSVG(h, selected = new Set()) {
  return [...showItems(h)]
    .sort((a, b) => KINDS[a.kind].layer - KINDS[b.kind].layer)
    .map((it) => pieceSVG(it, h, { selected: selected.has(it.id) }))
    .join("");
}

/** The floor: its outline, its size along two edges, and outdoors, grass. */
export function floorSVG(h) {
  const f = floorOf(h);
  const t = Math.max(12, Math.min(f.width, f.depth) * 0.012);
  return `<rect class="floor" x="0" y="0" width="${f.width}" height="${f.depth}" fill="${f.kind === "outdoor" ? "#e3ecd9" : "#fbfbfa"}" stroke="#9aa3ad" stroke-width="${t * 0.25}"/><text x="${f.width / 2}" y="${-t * 0.8}" font-size="${t * 1.1}" text-anchor="middle" fill="#56606b">${feet(f.width)}</text><text transform="translate(${-t * 0.8} ${f.depth / 2}) rotate(-90)" font-size="${t * 1.1}" text-anchor="middle" fill="#56606b">${feet(f.depth)}</text>`;
}

/** The whole floor as a standalone SVG, for the printed map. */
export function showSVG(h) {
  const f = floorOf(h);
  const box = boundsOf(showItems(h)) || { l: 0, r: f.width, t: 0, b: f.depth };
  const pad = Math.max(48, Math.min(f.width, f.depth) * 0.04);
  const l = Math.min(0, box.l) - pad;
  const t = Math.min(0, box.t) - pad;
  const w = Math.max(f.width, box.r) + pad - l;
  const d = Math.max(f.depth, box.b) + pad - t;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r1(l)} ${r1(t)} ${r1(w)} ${r1(d)}" class="hall-map" preserveAspectRatio="xMidYMin meet">${floorSVG(h)}${piecesSVG(h)}</svg>`;
}

export { feet };

/**
 * Saved floor templates: whole floors to start from, each a venue and its
 * pieces. Asked for by name — "a 10 × 10 art fair street, a convention hall
 * with perimeter booths" — and a third, a market under one pavilion tent,
 * because the venue list has had a pavilion since phase 1 and nothing used
 * it. `build(start)` numbers the booths from `start`, back to front and left
 * to right, the way `renumber` reads a floor.
 */
export const FLOOR_TEMPLATES = {
  street: {
    label: "Art fair street",
    note: "Outdoors: two rows of twelve 10 × 10 canopy tents facing each other across a 20′ street, 2′ apart, an entrance at each end.",
    build(start = 101) {
      const items = [];
      const x0 = (1920 - (12 * 120 + 11 * 24)) / 2;
      // The top row faces down the floor, into the street; the bottom row
      // faces up it — the same street from both sides.
      items.push(...boothBlock(items, { count: 12, perRow: 12, w: 120, d: 120, gap: 24, style: "tent", x: x0, y: 60, start }));
      for (const it of boothBlock(items, { count: 12, perRow: 12, w: 120, d: 120, gap: 24, style: "tent", x: x0, y: 420, start })) items.push({ ...it, rot: 180 });
      items.push({ id: newId(items), kind: "aisle", x: 960, y: 300, w: 1704 + 96, d: 240 });
      items.push({ id: newId(items), kind: "door", x: 12, y: 300, w: 192, d: 12, rot: 90 });
      items.push({ id: newId(items), kind: "door", x: 1908, y: 300, w: 192, d: 12, rot: 90 });
      items.push({ id: newId(items), kind: "label", x: 960, y: 24, w: 480, d: 36, text: "Artists' street" });
      return { venue: { kind: "outdoor", width: 1920, depth: 600 }, items };
    },
  },
  convention: {
    label: "Convention hall, perimeter booths",
    note: "Indoors, 150′ × 100′: 10 × 10 booths round three walls facing in, four island rows back to back in the middle, 10′ aisles, an entrance, an info desk, food and restrooms.",
    build(start = 101) {
      const items = [];
      const add = (it) => (items.push({ id: newId(items), ...it }), items.at(-1));
      const booth = (x, y, rot) => add({ kind: "booth", number: nextNumber(items, start), x, y, w: 120, d: 120, ...(rot ? { rot } : {}) });
      // Along the back wall, facing the entrance.
      for (let x = 180; x <= 1620; x += 120) booth(x, 60);
      // Down the left wall facing right (turned 270°), and down the right
      // wall facing left (turned 90°), below the back row's corners.
      for (let y = 240; y <= 960; y += 120) booth(60, y, 270);
      for (let y = 240; y <= 960; y += 120) booth(1740, y, 90);
      // Islands: two pairs of rows back to back, 10′ aisles all round.
      items.push(...boothBlock(items, { count: 32, perRow: 8, w: 120, d: 120, aisle: 120, backToBack: true, x: 420, y: 300, start }));
      add({ kind: "door", x: 900, y: 1194, w: 192, d: 12 });
      add({ kind: "desk", x: 900, y: 1086, w: 96, d: 36 });
      add({ kind: "food", x: 300, y: 1080, w: 240, d: 192 });
      add({ kind: "restroom", x: 1560, y: 1110, w: 144, d: 120 });
      return { venue: { kind: "indoor", width: 1800, depth: 1200 }, items };
    },
  },
  pavilion: {
    label: "Market under a pavilion",
    note: "Outdoors, 80′ × 60′: a 60′ × 40′ pavilion tent over two back-to-back rows of six 8 × 10 booths, food trucks' pad and an entrance.",
    build(start = 101) {
      const items = [];
      items.push({ id: newId(items), kind: "pavilion", x: 480, y: 300, w: 720, d: 480 });
      items.push(...boothBlock(items, { count: 12, perRow: 6, w: 96, d: 120, backToBack: true, x: 192, y: 180, start }));
      items.push({ id: newId(items), kind: "food", x: 480, y: 636, w: 480, d: 144, text: "Food trucks" });
      items.push({ id: newId(items), kind: "door", x: 480, y: 714, w: 144, d: 12 });
      return { venue: { kind: "outdoor", width: 960, depth: 720 }, items };
    },
  },
};
