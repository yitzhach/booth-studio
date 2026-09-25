// The show floor in 3D: every piece of `p.hall.items` stood up, walked and
// recorded.
//
// The drawing board (src/show-editor.js) is the plan; this is the same plan
// seen from the aisle. It is drawn by the booth's own renderer — BoothScene
// builds it in place of the booth's surroundings (see `setShow` in scene.js)
// — so walk mode, the camera timeline, the frame guide, the PNG export and
// the MP4 recorder all work on it unchanged. What is new is only the floor.
//
// Two rules make a thousand booths affordable:
//
// - **Every booth but one is light.** A booth on the floor is its carpet tile,
//   its drape or walls or tent, and its number — a handful of boxes. The one
//   booth whose design is open in Booth Studio (`homeBooth`) is drawn as the
//   real booth, by the code that always drew it, at the world origin; the
//   whole show is placed round it rather than the booth being moved into the
//   show, so its lights, shadow cameras and pickers see the coordinates they
//   always saw.
// - **One InstancedMesh per kind of part.** `showParts` turns the plan into a
//   flat list of boxes, pyramids and cylinders; `buildShow` draws each shape
//   and finish as a single instanced mesh, so a floor of 1,000 booths is a
//   dozen draw calls, not four thousand.
//
// The first half of this file is pure — plan in, numbers out — so Node pins
// it (tests/show-scene.test.js). Plan coordinates are the editor's: inches,
// x across the floor, y from the back wall toward the entrance, `rot`
// clockwise seen from above. In the world, x is x, plan y is +z (toward the
// camera in the booth's own framing), and up is y.
import * as T from "three";
import { STATUSES, boothOf } from "./hall.js";
import { KINDS, boundsOf, floorOf, showItems } from "./show.js";
import { EYE_HEIGHT } from "./views.js";

const IN = 0.0254;
const rad = (deg) => (deg * Math.PI) / 180;

/** Heights, in inches, of what stands on the floor. */
export const SHOW_HEIGHTS = {
  drape: 96, // pipe and drape: an 8′ back drape…
  rail: 36, // …and 3′ side rails
  hardwall: 96,
  tentEave: 84,
  tentPeak: 120,
  pavilionEave: 120,
  pavilionPeak: 216,
  hallWall: 192,
  wall: 144,
  column: 180,
  door: 96,
  stage: 24,
  table: 30,
  desk: 42,
  counter: 42,
  restroom: 96,
  sign: 104,
};

/** Colours of the parts that are not a booth's sale colour. */
const COLOURS = {
  drape: "#465469",
  hardwall: "#f1efea",
  canvas: "#f6f5f1",
  pole: "#9aa3ad",
  aisle: "#b8ae98",
  pavilion: "#fbfbf8",
  wall: "#d8d5ce",
  column: "#b9bfc6",
  door: "#2f7de1",
  stage: "#4a4458",
  table: "#c8b89f",
  desk: "#5f8fb5",
  food: "#c98a5d",
  foodFloor: "#e8d5c3",
  restroom: "#8a939c",
  floorIndoor: "#bdb8ae",
  floorOutdoor: "#7f9a5b",
  hall: "#e6e3dd",
};

/**
 * The booth drawn in full: the one whose design is open — `h.open` when a
 * booth has been opened (phase 3), else the promoter's own, `h.mine`. Null
 * when neither names a booth on the floor, and then every booth is light.
 */
export function homeBooth(h) {
  const n = h?.open ?? h?.mine;
  if (!Number.isInteger(n)) return null;
  return showItems(h).find((i) => i.kind === "booth" && i.number === n) || null;
}

/**
 * Where the world sits on the plan. The home booth is drawn at the origin
 * facing +z, as it always was, so the plan is turned and moved to put that
 * booth there; with no home booth the floor's centre is the origin and
 * nothing turns. Returns `{ x, y, rot }`: the plan point at the origin and
 * the plan's turn about it.
 */
export function worldFrame(h) {
  const home = homeBooth(h);
  if (home) return { x: home.x, y: home.y, rot: home.rot || 0 };
  const f = floorOf(h);
  return { x: f.width / 2, y: f.depth / 2, rot: 0 };
}

/**
 * A plan point, in inches, to the world, in metres: `[x, z]`. The inverse of
 * placing the home booth at its piece: move the piece's centre to the origin,
 * then undo its clockwise turn (a turn about +y by +rot).
 */
export function planToWorld(frame, px, py) {
  const dx = (px - frame.x) * IN,
    dz = (py - frame.y) * IN;
  const a = rad(frame.rot);
  return [dx * Math.cos(a) + dz * Math.sin(a), -dx * Math.sin(a) + dz * Math.cos(a)];
}

/**
 * A part of a piece: a local offset (`lx` across, `lz` toward its front, both
 * inches from the piece's centre) turned with the piece and placed on the
 * plan. Returns plan inches and the part's turn about +y in radians.
 */
function at(it, lx, lz) {
  const a = rad(it.rot || 0);
  return { x: it.x + lx * Math.cos(a) - lz * Math.sin(a), z: it.y + lx * Math.sin(a) + lz * Math.cos(a), rotY: -a };
}

/**
 * Every part the floor stands up, as plain numbers, in plan inches:
 * `{ shape: "box" | "roof" | "cyl", finish: "matte" | "fabric", x, y, z, w,
 * h, d, rotY, color }` — centred, `y` up from the floor. `skip` is the id of
 * the piece drawn in full elsewhere (the home booth), which gets nothing
 * here. The builder groups the list by shape and finish into instanced
 * meshes; Node counts it.
 */
export function showParts(h, { skip = null } = {}) {
  const drape = h.venue?.drape || COLOURS.drape;
  const H = SHOW_HEIGHTS;
  const out = [];
  const part = (it, shape, finish, lx, lz, w, hgt, d, color, base = 0) => {
    const p = at(it, lx, lz);
    out.push({ shape, finish, x: p.x, y: base + hgt / 2, z: p.z, w, h: hgt, d, rotY: p.rotY, color, piece: it.id });
  };
  for (const it of showItems(h)) {
    if (it.id === skip) continue;
    const { w, d } = it;
    switch (it.kind) {
      case "booth": {
        const rec = boothOf(h, it.number);
        part(it, "box", "matte", 0, 0, w, 0.6, d, STATUSES[rec.status].color);
        const style = it.style || "pipe";
        if (style === "pipe") {
          part(it, "box", "fabric", 0, -d / 2 + 0.5, w, H.drape, 1, drape);
          part(it, "box", "fabric", -w / 2 + 0.5, 0, 1, H.rail, d - 1, drape);
          part(it, "box", "fabric", w / 2 - 0.5, 0, 1, H.rail, d - 1, drape);
        } else if (style === "hardwall") {
          part(it, "box", "matte", 0, -d / 2 + 1, w, H.hardwall, 2, COLOURS.hardwall);
          part(it, "box", "matte", -w / 2 + 1, 0, 2, H.hardwall, d - 2, COLOURS.hardwall);
          part(it, "box", "matte", w / 2 - 1, 0, 2, H.hardwall, d - 2, COLOURS.hardwall);
        } else if (style === "tent") {
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(it, "box", "matte", sx * (w / 2 - 1), sz * (d / 2 - 1), 2, H.tentEave, 2, COLOURS.pole);
          part(it, "roof", "fabric", 0, 0, w, H.tentPeak - H.tentEave, d, COLOURS.canvas, H.tentEave);
          part(it, "box", "fabric", 0, -d / 2 + 0.5, w - 4, H.tentEave, 0.5, COLOURS.canvas);
        }
        break;
      }
      case "aisle":
        part(it, "box", "fabric", 0, 0, w, 0.3, d, COLOURS.aisle);
        break;
      case "pavilion": {
        part(it, "roof", "fabric", 0, 0, w, H.pavilionPeak - H.pavilionEave, d, COLOURS.pavilion, H.pavilionEave);
        // A pole at each corner and at least every 20′ along each side.
        const across = Math.max(1, Math.ceil(w / 240)),
          along = Math.max(1, Math.ceil(d / 240));
        const poles = new Set();
        const pole = (lx, lz) => {
          const key = `${Math.round(lx)}:${Math.round(lz)}`;
          if (poles.has(key)) return;
          poles.add(key);
          part(it, "cyl", "matte", lx, lz, 4, H.pavilionEave, 4, COLOURS.pole);
        };
        for (let i = 0; i <= across; i++) for (const s of [-1, 1]) pole(-w / 2 + (w * i) / across, (s * d) / 2);
        for (let i = 0; i <= along; i++) for (const s of [-1, 1]) pole((s * w) / 2, -d / 2 + (d * i) / along);
        break;
      }
      case "wall":
        part(it, "box", "matte", 0, 0, w, H.wall, d, COLOURS.wall);
        break;
      case "column":
        part(it, "cyl", "matte", 0, 0, w, H.column, d, COLOURS.column);
        break;
      case "door":
        part(it, "box", "matte", 0, 0, w, 0.4, Math.max(d, 24), COLOURS.door);
        part(it, "box", "matte", -w / 2, 0, 4, H.door, 4, COLOURS.door);
        part(it, "box", "matte", w / 2, 0, 4, H.door, 4, COLOURS.door);
        part(it, "box", "matte", 0, 0, w + 4, 6, 4, COLOURS.door, H.door);
        break;
      case "stage":
        part(it, "box", "matte", 0, 0, w, H.stage, d, COLOURS.stage);
        break;
      case "table":
        part(it, "box", "matte", 0, 0, w, H.table, d, COLOURS.table);
        break;
      case "desk":
        part(it, "box", "matte", 0, 0, w, H.desk, d, COLOURS.desk);
        break;
      case "food": {
        part(it, "box", "matte", 0, 0, w, 0.6, d, COLOURS.foodFloor);
        const counter = Math.min(d, 30);
        part(it, "box", "matte", 0, -d / 2 + counter / 2, w, H.counter, counter, COLOURS.food);
        break;
      }
      case "restroom":
        part(it, "box", "matte", 0, 0, w, H.restroom, d, COLOURS.restroom);
        break;
    }
  }
  return out;
}

/**
 * The words the floor shows: every booth's number (and exhibitor) over its
 * front, and every Text piece hung as a sign. `{ x, z, y, text, sub }` in
 * plan inches; the builder shows only the ones nearest the camera.
 */
export function showLabels(h, { skip = null } = {}) {
  const out = [];
  for (const it of showItems(h)) {
    if (it.kind === "booth") {
      const front = at(it, 0, it.d / 2);
      const rec = boothOf(h, it.number);
      const style = it.style || "pipe";
      const top = style === "tent" ? SHOW_HEIGHTS.tentEave + 6 : style === "open" ? 60 : SHOW_HEIGHTS.drape + 8;
      out.push({ x: front.x, z: front.z, y: it.id === skip ? top + 24 : top, text: String(it.number), sub: rec.name || "", piece: it.id });
    } else if (it.kind === "label" && it.text) out.push({ x: it.x, z: it.y, y: SHOW_HEIGHTS.sign + 24, text: it.text, sub: "", piece: it.id });
    else if (["stage", "food", "restroom", "desk"].includes(it.kind)) out.push({ x: it.x, z: it.y, y: SHOW_HEIGHTS.sign, text: it.text || KINDS[it.kind].label, sub: "", piece: it.id });
  }
  return out;
}

const EYE = EYE_HEIGHT * IN;
/** How far ahead a walking visitor looks, and how much lower: metres. */
const LOOK = 3;
const LOOK_DOWN = 0.12;
/** A walkthrough's pace, metres a second: an unhurried visitor. */
export const WALK_SPEED = 1.1;

/**
 * A pose at eye height at world `[x, z]`, looking toward world `[tx, tz]`:
 * at a point `LOOK` metres ahead and a little down, for a timeline key, or —
 * `look` of 0.01 — a centimetre ahead and level, which is how walk mode's
 * orbit controls hold a head (see `walkStart` in views.js).
 */
function eyePose(p, toward, look = LOOK) {
  let fx = toward[0] - p[0],
    fz = toward[1] - p[1];
  const len = Math.hypot(fx, fz) || 1;
  fx /= len;
  fz /= len;
  return { position: [p[0], EYE, p[1]], target: [p[0] + fx * look, look === LOOK ? EYE - LOOK_DOWN : EYE, p[1] + fz * look] };
}

/**
 * Where walking the show starts: in the aisle nearest the way in, looking
 * down it. The way in is the first Entrance piece — stepped 6′ from it
 * toward the floor's centre — or else the middle of the front edge; with no
 * aisle to find, the walk starts there, looking at the middle of the floor.
 * World metres.
 */
export function showWalkStart(h) {
  const frame = worldFrame(h);
  const entry = showEntry(h);
  const lines = aisleLines(h);
  if (!lines.length) return entry;
  const here = [entry.position[0], entry.position[2]];
  let best = null;
  for (const l of lines) {
    const a = planToWorld(frame, l.x1, l.y1),
      b = planToWorld(frame, l.x2, l.y2);
    for (const [from, to] of [[a, b], [b, a]]) {
      const d = Math.hypot(from[0] - here[0], from[1] - here[1]);
      if (!best || d < best.d) best = { d, from, to };
    }
  }
  return eyePose(best.from, best.to, 0.01);
}

/** The way in: inside the entrance, or the middle of the front edge. */
function showEntry(h) {
  const f = floorOf(h);
  const frame = worldFrame(h);
  const door = showItems(h).find((i) => i.kind === "door");
  const centre = { x: f.width / 2, y: f.depth / 2 };
  let from;
  if (door) {
    const dx = centre.x - door.x,
      dy = centre.y - door.y;
    const len = Math.hypot(dx, dy) || 1;
    from = { x: door.x + (dx / len) * 72, y: door.y + (dy / len) * 72 };
  } else from = { x: f.width / 2, y: Math.max(0, f.depth - 72) };
  return eyePose(planToWorld(frame, from.x, from.y), planToWorld(frame, centre.x, centre.y), 0.01);
}

/**
 * The aisles, as centre lines in plan inches: `{ x1, y1, x2, y2 }`. Walkway
 * pieces are their own long axes. With none drawn, the aisles are read off
 * the booths: rows of booths (centres within half a booth of each other, as
 * `renumber` groups them), and an aisle wherever two rows are at least 3′
 * apart — the gap's middle line, as long as the two rows together.
 */
export function aisleLines(h) {
  const items = showItems(h);
  const walks = items.filter((i) => i.kind === "aisle");
  if (walks.length)
    return walks.map((it) => {
      const long = it.d >= it.w;
      const half = Math.max(0, (long ? it.d : it.w) / 2 - 24);
      const a = at(it, long ? 0 : -half, long ? -half : 0),
        b = at(it, long ? 0 : half, long ? half : 0);
      return { x1: a.x, y1: a.z, x2: b.x, y2: b.z };
    });
  const booths = items.filter((i) => i.kind === "booth").sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const b of booths) {
    const box = { l: b.x - Math.max(b.w, b.d) / 2, r: b.x + Math.max(b.w, b.d) / 2 };
    const row = rows.find((r) => Math.abs(r.y - b.y) < Math.min(b.d, r.d) / 2);
    const top = b.y - (b.rot % 180 ? b.w : b.d) / 2,
      bottom = b.y + (b.rot % 180 ? b.w : b.d) / 2;
    if (row) {
      row.top = Math.min(row.top, top);
      row.bottom = Math.max(row.bottom, bottom);
      row.l = Math.min(row.l, box.l);
      row.r = Math.max(row.r, box.r);
    } else rows.push({ y: b.y, d: b.d, top, bottom, l: box.l, r: box.r });
  }
  rows.sort((a, b) => a.top - b.top);
  const lines = [];
  const f = floorOf(h);
  const add = (y, l, r) => lines.push({ x1: l, y1: y, x2: r, y2: y });
  // The walkway along the front of the floor and along the back, 5′ in from
  // the booths or halfway to the wall, whichever is nearer; then every gap
  // between rows, front to back.
  const last = rows.at(-1);
  if (last && f.depth - last.bottom >= 36) add(Math.min(last.bottom + 60, (last.bottom + f.depth) / 2), last.l, last.r);
  for (let i = rows.length - 1; i > 0; i--) {
    const gap = rows[i].top - rows[i - 1].bottom;
    if (gap >= 36) add((rows[i].top + rows[i - 1].bottom) / 2, Math.min(rows[i].l, rows[i - 1].l), Math.max(rows[i].r, rows[i - 1].r));
  }
  if (rows.length && rows[0].top >= 36) add(Math.max(rows[0].top - 60, rows[0].top / 2), rows[0].l, rows[0].r);
  return lines;
}

/**
 * A walkthrough of the whole show as a camera timeline — "a timeline whose
 * keys stand in aisles". It starts at the entrance and walks the aisles as a
 * visitor would: the nearest aisle first, along it, then on to the nearest
 * end of the next, each key looking where the walk goes next. At most
 * `maxKeys` keys (the timeline's limit), so a very large floor walks its
 * front aisles; the clip's length is the path at `WALK_SPEED`, within the
 * timeline's 2–60 s. Returns a raw timeline for `normalizeTimeline`.
 */
export function showWalkthrough(h, { maxKeys = 12, minSeconds = 2, maxSeconds = 60 } = {}) {
  const frame = worldFrame(h);
  const start = showEntry(h);
  let here = [start.position[0], start.position[2]];
  const points = [here];
  const left = aisleLines(h).map((l) => ({ a: planToWorld(frame, l.x1, l.y1), b: planToWorld(frame, l.x2, l.y2) }));
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  while (left.length && points.length + 2 <= maxKeys) {
    let best = 0,
      flip = false,
      near = Infinity;
    left.forEach((l, i) => {
      for (const [end, f] of [[l.a, false], [l.b, true]])
        if (dist(here, end) < near) (near = dist(here, end)), (best = i), (flip = f);
    });
    const l = left.splice(best, 1)[0];
    const [enter, exit] = flip ? [l.b, l.a] : [l.a, l.b];
    if (dist(here, enter) > 0.3) points.push(enter);
    if (points.length < maxKeys) points.push(exit);
    here = exit;
  }
  // No aisle at all: walk straight in to the floor's middle.
  if (points.length < 2) {
    const f = floorOf(h);
    points.push(planToWorld(frame, f.width / 2, f.depth / 2));
    // Already standing there: three metres on, the way the walk faces.
    if (dist(points[0], points[1]) < 0.5) points[1] = [points[0][0] + (start.target[0] - start.position[0]) * 300, points[0][1] + (start.target[2] - start.position[2]) * 300];
  }
  const legs = points.slice(1).map((p, i) => dist(points[i], p));
  const total = legs.reduce((s, n) => s + n, 0) || 1;
  let run = 0;
  const keys = points.map((p, i) => {
    const t = i === 0 ? 0 : (run += legs[i - 1]) / total;
    const next = points[i + 1];
    // The last key keeps looking the way it arrived.
    const toward = next || [p[0] + (p[0] - points[i - 1][0]), p[1] + (p[1] - points[i - 1][1])];
    return { t, ...eyePose(p, toward) };
  });
  const ahead = [points[0][0] + start.target[0] - start.position[0], points[0][1] + start.target[2] - start.position[2]];
  keys[0] = { t: 0, ...eyePose(points[0], dist(points[0], points[1]) > 0.3 ? points[1] : ahead) };
  return {
    version: 1,
    seconds: Math.round(Math.min(maxSeconds, Math.max(minSeconds, total / WALK_SPEED))),
    flow: "glide",
    keys,
    fade: { in: 0.5, out: 0.8 },
  };
}

/**
 * Everything there is to see, in plan inches `{ l, r, t, b }`: the floor, and
 * any piece laid past its edge — a block of booths added below the rest can
 * land outside a floor nobody has resized yet, and it is still in the show.
 */
export function showExtent(h) {
  const f = floorOf(h);
  const box = boundsOf(showItems(h)) || { l: 0, r: 0, t: 0, b: 0 };
  return { l: Math.min(0, box.l), r: Math.max(f.width, box.r), t: Math.min(0, box.t), b: Math.max(f.depth, box.b) };
}

/**
 * How big the world is round the origin, in metres: the camera's far plane
 * and the orbit's reach are set from it, so a 400′ hall can be seen whole.
 */
export function showReach(h) {
  const e = showExtent(h);
  const frame = worldFrame(h);
  let r = 0;
  for (const [x, y] of [[e.l, e.t], [e.r, e.t], [e.l, e.b], [e.r, e.b]]) {
    const [wx, wz] = planToWorld(frame, x, y);
    r = Math.max(r, Math.hypot(wx, wz));
  }
  return Math.max(12, r);
}

/**
 * Where the camera stands to see the whole show: high over the entrance
 * side, looking down across everything on the floor. World metres.
 */
export function showOverview(h) {
  const e = showExtent(h);
  const frame = worldFrame(h);
  const mx = (e.l + e.r) / 2,
    my = (e.t + e.b) / 2;
  const [cx, cz] = planToWorld(frame, mx, my);
  const [fx, fz] = planToWorld(frame, mx, e.b);
  let dx = fx - cx,
    dz = fz - cz;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  const span = Math.max(e.r - e.l, e.b - e.t) * IN;
  return { position: [cx + dx * span * 0.7, span * 0.72, cz + dz * span * 0.7], target: [cx, 0, cz] };
}

// --- three.js ------------------------------------------------------------

const GEOMETRY = {
  box: () => new T.BoxGeometry(1, 1, 1),
  // Four sides, turned so its base is a unit square rather than a diamond.
  roof: () => new T.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4),
  cyl: () => new T.CylinderGeometry(0.5, 0.5, 1, 12),
};

/** A number, drawn once to a canvas, as a sprite's texture. */
function labelTexture(text, sub) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = sub ? 128 : 96;
  const g = c.getContext("2d");
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.beginPath();
  g.roundRect(4, 4, c.width - 8, c.height - 8, 18);
  g.fill();
  g.fillStyle = "#1d232b";
  g.textAlign = "center";
  g.font = "700 56px 'DM Sans', system-ui, sans-serif";
  g.fillText(text.length > 12 ? text.slice(0, 11) + "…" : text, c.width / 2, sub ? 62 : 68);
  if (sub) {
    g.font = "500 30px 'DM Sans', system-ui, sans-serif";
    g.fillText(sub.length > 16 ? sub.slice(0, 15) + "…" : sub, c.width / 2, 106);
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

/** How many labels are on screen at once, and how far they reach. */
export const LABEL_POOL = 40;
export const LABEL_REACH = 30;

/**
 * The show, stood up: a group to add beside the booth, already placed so the
 * home booth's piece sits at the origin. `group.userData.placeLabels(camera)`
 * moves the label pool to the booths nearest the camera; the scene calls it
 * before each frame. `dispose()` frees what it made.
 */
export function buildShow(h) {
  const frame = worldFrame(h);
  const home = homeBooth(h);
  const f = floorOf(h);
  const outer = new T.Group();
  outer.name = "show-floor";
  outer.rotation.y = rad(frame.rot);
  const inner = new T.Group();
  inner.position.set(-frame.x * IN, 0, -frame.y * IN);
  inner.scale.setScalar(IN);
  outer.add(inner);
  const owned = [];
  const own = (x) => (owned.push(x), x);

  // The floor itself, and indoors the hall round it.
  const outdoor = f.kind === "outdoor";
  const margin = outdoor ? 2400 : 0;
  const ground = new T.Mesh(own(new T.PlaneGeometry(f.width + margin * 2, f.depth + margin * 2)), own(new T.MeshStandardMaterial({ color: outdoor ? COLOURS.floorOutdoor : COLOURS.floorIndoor, roughness: 0.95 })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(f.width / 2, -0.4, f.depth / 2);
  ground.name = "show-ground";
  ground.userData.surface = "floor";
  inner.add(ground);
  // The hall's walls face inward and are drawn from one side only — a
  // dollhouse cut-away: from outside, the near walls vanish and the far ones
  // show their inside faces, so the overview looks into the hall; walking
  // inside, all four are there.
  if (!outdoor) {
    const wallMat = own(new T.MeshStandardMaterial({ color: COLOURS.hall, roughness: 0.9 }));
    const H = SHOW_HEIGHTS.hallWall;
    for (const [x, z, len, turn] of [[f.width / 2, 0, f.width, 0], [f.width / 2, f.depth, f.width, Math.PI], [0, f.depth / 2, f.depth, Math.PI / 2], [f.width, f.depth / 2, f.depth, -Math.PI / 2]]) {
      const wall = new T.Mesh(own(new T.PlaneGeometry(len, H)), wallMat);
      wall.position.set(x, H / 2, z);
      wall.rotation.y = turn;
      wall.userData.surface = "hall";
      inner.add(wall);
    }
  }

  // Every part, one instanced mesh per shape and finish.
  const parts = showParts(h, { skip: home?.id });
  const groups = new Map();
  for (const p of parts) {
    const key = p.shape + ":" + p.finish;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const m = new T.Matrix4(),
    q = new T.Quaternion(),
    up = new T.Vector3(0, 1, 0),
    pos = new T.Vector3(),
    scl = new T.Vector3(),
    colour = new T.Color();
  for (const [key, list] of groups) {
    const [shape, finish] = key.split(":");
    const geometry = own(GEOMETRY[shape]());
    const material = own(new T.MeshStandardMaterial({ roughness: finish === "fabric" ? 1 : 0.85, side: shape === "roof" ? T.DoubleSide : T.FrontSide }));
    const mesh = new T.InstancedMesh(geometry, material, list.length);
    mesh.name = "show-" + shape + "-" + finish;
    mesh.userData.surface = shape === "roof" ? "tent" : finish === "fabric" ? "drape" : "stand";
    list.forEach((p, i) => {
      q.setFromAxisAngle(up, p.rotY);
      m.compose(pos.set(p.x, p.y, p.z), q, scl.set(p.w, p.h, p.d));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, colour.set(p.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    inner.add(mesh);
  }

  // Labels: a small pool of sprites, handed to the nearest booths.
  const labels = showLabels(h, { skip: home?.id });
  const textures = new Map();
  const pool = [];
  const hasCanvas = typeof document !== "undefined";
  const layer = new T.Group();
  layer.name = "show-labels";
  inner.add(layer);
  let placedFrom = null;
  const world = new T.Vector3();
  const placeLabels = (camera) => {
    if (!hasCanvas || !labels.length) return;
    const eye = camera.getWorldPosition(world);
    if (placedFrom && placedFrom.distanceToSquared(eye) < 0.25) return;
    placedFrom = eye.clone();
    // The camera in plan inches: undo the outer turn and the inner move.
    const local = inner.worldToLocal(eye.clone());
    const reach = (LABEL_REACH / IN) ** 2;
    const near = labels
      .map((l) => ({ l, d: (l.x - local.x) ** 2 + (l.z - local.z) ** 2 }))
      .filter((x) => x.d < reach)
      .sort((a, b) => a.d - b.d)
      .slice(0, LABEL_POOL);
    while (pool.length < near.length) {
      const s = new T.Sprite(new T.SpriteMaterial({ depthWrite: false, transparent: true }));
      s.userData.surface = "label";
      layer.add(s);
      pool.push(s);
    }
    pool.forEach((s, i) => {
      const x = near[i]?.l;
      s.visible = !!x;
      if (!x) return;
      const key = x.text + "\n" + x.sub;
      if (!textures.has(key)) {
        // A bounded cache: past a few hundred, start again.
        if (textures.size > 400) {
          for (const t of textures.values()) if (!pool.some((p) => p.material.map === t)) t.dispose();
          for (const [k, t] of [...textures]) if (!pool.some((p) => p.material.map === t)) textures.delete(k);
        }
        textures.set(key, labelTexture(x.text, x.sub));
      }
      const map = textures.get(key);
      if (s.material.map !== map) {
        s.material.map = map;
        s.material.needsUpdate = true;
      }
      const aspect = map.image.width / map.image.height;
      s.scale.set(22 * aspect, 22, 1);
      s.position.set(x.x, x.y, x.z);
    });
  };
  outer.userData.placeLabels = placeLabels;
  outer.userData.counts = { parts: parts.length, meshes: groups.size, labels: labels.length };
  outer.userData.dispose = () => {
    for (const x of owned) x.dispose();
    for (const s of pool) s.material.dispose();
    for (const t of textures.values()) t.dispose();
    inner.traverse((o) => o.isInstancedMesh && o.dispose());
  };
  return outer;
}
