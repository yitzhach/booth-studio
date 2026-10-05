// A booth's scene changed by name instead of by hand: the studio assistant,
// or any agent, says "move the table 2′ left" and this does it with the app's
// own rules. Art-Talk-Back D-070, docs/phase-5-booth.md 9b.
//
// Pure, like model.js: no DOM, no storage. `npm run bundle:scene` builds this
// file and what it imports into one ES module that studio-api vendors, so the
// server applies an edit with exactly the code the app uses, and every result
// passes `validateProject` before it is written. A change made here opens in
// the app like one made in it.
//
// A scene is a schema-1 project without `assets` (src/placement.js); the
// images it names come with it as the placement's manifest. Ops never touch
// image bytes: they move, size and remove what is there, and build the booth
// around it.
//
// Measurements are inches. On the floor, `x` runs across the booth from its
// centre (+ to the right as you face the back wall from the entrance) and `z`
// from its centre toward the entrance (+ toward the front). On a wall, a
// work's `x` is its left edge from the wall's left end as you face the wall
// from inside the booth, and `y` its bottom edge off the floor.
//
// The show floor (`hall`, src/show.js) has its own frame: inches from the
// venue's back-left corner, `x` across and `y` toward the entrance, each
// piece by its centre; `rot` turns it clockwise, and a booth at rot 0 opens
// toward the entrance. Booths are named by number, as the show numbers them.
import {
  BOX_LIMITS, FURNITURE, MAX_PANELS, MAX_PEDESTALS, applyVenue, boothPanels, boothPedestals, constrain,
  constrainPanel, constrainPedestal, isPanelKey, panelKey, uid, validateProject, wallKeys, wallLabel, wallSpec,
} from "./model.js";
import { FOOTPRINTS, SHOWS, quickStart } from "./quickstart.js";
import { HALL_LIMITS, STATUSES, boothOf, newHall } from "./hall.js";
import {
  BOOTH_STYLES, DEFAULT_DRAPE, FLOOR_TEMPLATES, KINDS as FLOOR_KINDS, MAX_ITEMS, SHOW_LIMITS, VENUES as FLOOR_VENUES,
  boothBlock, floorOf, growToFit, newId, nextNumber, showItems, toFloor,
} from "./show.js";
import { OWN, deleteEffect, liveNumber, setMine, setOpen } from "./linked.js";
import { HANG_LINE, hangAt, sameWall, spaceEvenly } from "./arrange.js";
import { FORMAT, placementOf } from "./placement.js";

export { FORMAT };
export const SCENE_OPS_VERSION = 1;
/** One request's worth: enough to lay out a booth, small enough to read on a card. */
export const MAX_OPS = 50;

/** An op the scene can't take. `index` is the op's place in the list. */
export class SceneOpError extends Error {
  constructor(message, index = null) {
    super(message);
    this.name = "SceneOpError";
    this.index = index;
  }
}

// ------------------------------------------------------------- words

/** 66 → 5′ 6″, 8 → 8″, 24 → 2′. */
export function inches(n) {
  const v = Math.round(Math.abs(n) * 10) / 10;
  const ft = Math.floor(v / 12), inch = Math.round((v - ft * 12) * 10) / 10;
  const sign = n < 0 ? "−" : "";
  if (!ft) return `${sign}${inch}″`;
  return inch ? `${sign}${ft}′ ${inch}″` : `${sign}${ft}′`;
}
const across = (x) => (Math.abs(x) < 0.5 ? "centred" : `${inches(Math.abs(x))} ${x < 0 ? "left" : "right"} of centre`);
const deep = (z) => (Math.abs(z) < 0.5 ? "mid-depth" : `${inches(Math.abs(z))} toward the ${z < 0 ? "back" : "front"}`);
const quote = (s) => `“${String(s)}”`;
const furnitureName = (ped) => ped.name || FURNITURE[ped.kind || "pedestal"]?.label || "Pedestal";

// ------------------------------------------------------------- scene ↔ project

// The smallest data URLs validateProject takes, standing in for images the
// scene names but this code never sees.
const STUB_IMAGE = "data:image/png;base64,iVBORw0KGgo=";
const STUB_MODEL = "data:model/gltf-binary;base64,Z2xURg==";

/** The project a scene describes, with stand-in assets for its manifest. */
function projectOf(scene, images = []) {
  if (!scene || typeof scene !== "object") throw new SceneOpError("This booth has no scene to change.");
  const p = JSON.parse(JSON.stringify(scene));
  p.assets = {};
  for (const im of images || []) {
    if (!im || typeof im.key !== "string") continue;
    p.assets[im.key] = {
      width: im.width || 1,
      height: im.height || 1,
      ...(im.role ? { role: im.role } : {}),
      ...(im.name ? { name: im.name } : {}),
      data: im.role === "model" ? STUB_MODEL : STUB_IMAGE,
    };
  }
  return p;
}

/** Back to a scene: checked by the app's own validator, assets taken out. */
function sceneOfChecked(p) {
  let out;
  try {
    out = validateProject(p) || p;
  } catch {
    throw new SceneOpError("That change would leave a booth Booth Studio can't open, so nothing was changed.");
  }
  const { assets: _assets, ...scene } = out;
  return JSON.parse(JSON.stringify(scene));
}

/** The columns a placement keeps beside its scene (name, kind, real size, format). */
export function fieldsOf(scene) {
  const { scene: _s, images: _i, ...fields } = placementOf({ ...scene, assets: {} });
  return fields;
}

// ------------------------------------------------------------- describe

/**
 * What is in a booth, small enough for a model to read: the booth, its walls,
 * each work and each piece of furniture with its id and position. Never the
 * images, lights or camera.
 */
export function describe(scene, images = []) {
  const p = projectOf(scene, images);
  const b = p.booth;
  const round = (n) => Math.round(n * 10) / 10;
  return {
    format: FORMAT,
    name: p.name,
    units: "inches",
    frame:
      "Floor: x across from the booth's centre (+ right as you face the back wall), z from the centre toward the entrance (+ front). Walls: a work's x is its left edge from the wall's left end as you face the wall from inside, y its bottom edge off the floor.",
    booth: {
      width: b.width, depth: b.depth, height: b.height,
      venue: b.venue || "outdoor", tent: !!b.tent, color: b.color,
    },
    walls: wallKeys(p).map((key) => {
      const w = wallSpec(p, key);
      const panel = w?.panel;
      return {
        wall: key, label: wallLabel(p, key), width: w?.width, height: w?.height, shown: !!w?.enabled,
        ...(panel ? { id: panel.id, freeStanding: true, x: panel.x, z: panel.z, rotation: panel.rotation } : {}),
      };
    }),
    art: p.art.map((a) => ({
      id: a.id, title: a.title, wall: a.wall, x: round(a.x), y: round(a.y), w: round(a.w), h: round(a.h),
      ...(a.kind && a.kind !== "art" ? { kind: a.kind } : {}),
      ...(a.face === "outside" ? { face: "outside" } : {}),
      ...(a.booth ? { rowBooth: a.booth } : {}),
      hasImage: !!(a.asset && p.assets[a.asset]),
    })),
    furniture: boothPedestals(p).map((ped) => ({
      id: ped.id, kind: ped.kind || "pedestal", name: furnitureName(ped),
      x: round(ped.x), z: round(ped.z), rotation: ped.rotation, width: ped.width, depth: ped.depth, height: ped.height,
      ...(ped.hidden ? { hidden: true } : {}),
    })),
    floor: p.hall ? floorSummary(p.hall) : null,
    limits: { furniture: MAX_PEDESTALS, freeStandingWalls: MAX_PANELS, floorPieces: MAX_ITEMS, ops: MAX_OPS },
  };
}

/** Pieces listed one by one up to this many; past it, counts only. */
export const FLOOR_LIST_MAX = 300;

/** The show floor: its size, my booth, each booth (number, place, exhibitor) and each other piece. */
function floorSummary(h) {
  const items = showItems(h);
  const booths = items.filter((it) => it.kind === "booth");
  const others = items.filter((it) => it.kind !== "booth");
  const piece = (it) => ({ id: it.id, x: it.x, y: it.y, w: it.w, d: it.d, ...(it.rot ? { rot: it.rot } : {}) });
  return {
    frame: "Inches from the venue's back-left corner: x across, y toward the entrance; each piece by its centre; rot clockwise, a booth at rot 0 opens toward the entrance.",
    venue: { ...floorOf(h), drape: h.venue?.drape || DEFAULT_DRAPE },
    mine: h.mine ?? null,
    counts: { booths: booths.length, other: others.length },
    booths: booths.slice(0, FLOOR_LIST_MAX).map((it) => {
      const b = boothOf(h, it.number);
      return {
        number: it.number, ...piece(it), ...(it.style ? { style: it.style } : {}),
        status: b.status, ...(b.name ? { exhibitor: b.name } : {}), ...(b.note ? { note: b.note } : {}),
      };
    }),
    pieces: others.slice(0, FLOOR_LIST_MAX).map((it) => ({ kind: it.kind, ...piece(it), ...(it.text ? { text: it.text } : {}) })),
    ...(booths.length > FLOOR_LIST_MAX || others.length > FLOOR_LIST_MAX ? { truncated: true } : {}),
  };
}

// ------------------------------------------------------------- the ops

const num = (description, extra = {}) => ({ type: "number", description, ...extra });
const str = (description, extra = {}) => ({ type: "string", description, ...extra });
const ID = str("The id, as describe_booth lists it, or the ref you gave a piece added earlier in this list (\"@ref\").");
const REF = str("Optional name for the new piece, so later ops in this list can use it as \"@ref\".", { maxLength: 40 });
const WALL = str("back, left, right, or a free-standing wall as \"panel:<id>\" (or \"panel:@ref\").");
const KINDS = Object.keys(FURNITURE);
const op = (name, description, properties, required = []) => ({
  name,
  description,
  schema: {
    type: "object",
    properties: { op: { const: name }, ...properties },
    required: ["op", ...required],
    additionalProperties: false,
  },
});

/**
 * Every op, with the words and JSON Schema a model is given. studio-api
 * hands these to the assistant as they are: the app is their only author.
 */
export const OPS = [
  op("rename", "Rename the booth.", { name: str("The new name", { minLength: 1, maxLength: 200 }) }, ["name"]),
  op(
    "set_booth",
    "Change the booth itself. venue first resets the booth to that kind of show's defaults (outdoor: a 10×10 pop-up; artshow: an indoor booth of white panel walls with a light bar); width, depth and height then size it (48–360″ wide and deep, 48–144″ tall), and the walls follow. Work, furniture and free-standing walls are pulled back inside if the booth gets smaller.",
    {
      venue: str("outdoor or artshow", { enum: ["outdoor", "artshow"] }),
      width: num("Across the front, inches", { minimum: 48, maximum: 360 }),
      depth: num("Front to back, inches", { minimum: 48, maximum: 360 }),
      height: num("Wall height, inches", { minimum: 48, maximum: 144 }),
      tent: { type: "boolean", description: "A white canopy over an outdoor booth" },
      color: str("Wall colour as #rrggbb", { pattern: "^#[0-9a-fA-F]{6}$" }),
    },
  ),
  op(
    "add_furniture",
    `Stand a piece of furniture on the floor. Kinds: ${KINDS.map((k) => `${k} (${FURNITURE[k].label}, ${FURNITURE[k].width}×${FURNITURE[k].depth}×${FURNITURE[k].height}″)`).join(", ")}. Sizes default to those; a box (riser, plinth, stage) may be up to 360×360×144″.`,
    {
      kind: str("One of the kinds above", { enum: KINDS }),
      x: num("Across from the booth's centre, inches (+ right)"),
      z: num("From the centre toward the entrance, inches (+ front)"),
      rotation: num("Degrees, −180 to 180; 0 faces the entrance", { minimum: -180, maximum: 180 }),
      width: num("Inches"), depth: num("Inches"), height: num("Inches"),
      name: str("What to call it", { maxLength: 200 }),
      color: str("#rrggbb", { pattern: "^#[0-9a-fA-F]{6}$" }),
      ref: REF,
    },
    ["kind"],
  ),
  op(
    "change_furniture",
    "Move, turn, resize, rename, hide or show one piece of furniture. Send only what changes.",
    {
      id: ID,
      x: num("Inches (+ right)"), z: num("Inches (+ front)"),
      rotation: num("Degrees", { minimum: -180, maximum: 180 }),
      width: num("Inches"), depth: num("Inches"), height: num("Inches"),
      name: str("What to call it", { maxLength: 200 }),
      color: str("#rrggbb", { pattern: "^#[0-9a-fA-F]{6}$" }),
      hidden: { type: "boolean", description: "Hidden pieces stay in the booth but are not drawn" },
    },
    ["id"],
  ),
  op("remove_furniture", "Take a piece of furniture out of the booth.", { id: ID }, ["id"]),
  op(
    "add_wall",
    `Stand a free-standing wall inside the booth (up to ${MAX_PANELS}). x and z are its centre; rotation 0 faces the entrance.`,
    {
      x: num("Centre across, inches (+ right)"), z: num("Centre toward the entrance, inches (+ front)"),
      width: num("Inches, 12–360", { minimum: 12, maximum: 360 }),
      height: num("Inches, 24–144", { minimum: 24, maximum: 144 }),
      rotation: num("Degrees", { minimum: -180, maximum: 180 }),
      name: str("What to call it", { maxLength: 200 }),
      ref: REF,
    },
  ),
  op(
    "change_wall",
    "Move, turn, resize, rename, hide or show a wall. For back, left and right only width, height and hidden apply; a free-standing wall (\"panel:<id>\") also takes x, z, rotation and name.",
    {
      wall: WALL,
      x: num("Inches"), z: num("Inches"),
      width: num("Inches", { minimum: 12, maximum: 360 }),
      height: num("Inches", { minimum: 24, maximum: 144 }),
      rotation: num("Degrees", { minimum: -180, maximum: 180 }),
      name: str("What to call it", { maxLength: 200 }),
      hidden: { type: "boolean" },
    },
    ["wall"],
  ),
  op("remove_wall", "Take a free-standing wall out. Move or remove the work hanging on it first.", { wall: WALL }, ["wall"]),
  op(
    "change_art",
    "Move a work to another wall or place, resize it (give w or h and the other follows its shape, or both), or retitle it. It stays on its wall: a position past the edge is pulled back.",
    {
      id: ID,
      wall: WALL,
      x: num("Left edge from the wall's left end, inches"),
      y: num("Bottom edge off the floor, inches"),
      w: num("Width, inches", { minimum: 1, maximum: 360 }),
      h: num("Height, inches", { minimum: 1, maximum: 360 }),
      title: str("Title", { maxLength: 200 }),
    },
    ["id"],
  ),
  op("remove_art", "Take a work off the walls (its image stays in the booth's files).", { id: ID }, ["id"]),
  op(
    "arrange_wall",
    `Hang every work on one wall with its centre on one line (${HANG_LINE}″ off the floor unless given), and space them evenly across it unless spacing is "keep".`,
    {
      wall: WALL,
      line: num("Centre line off the floor, inches", { minimum: 12, maximum: 144 }),
      spacing: str("even (default) or keep", { enum: ["even", "keep"] }),
    },
    ["wall"],
  ),

  // ---- the show floor
  op(
    "start_floor",
    `Start the show floor: an empty venue of this size, or one of the floor templates (${Object.entries(FLOOR_TEMPLATES).map(([k, t]) => `${k}: ${t.label}`).join("; ")}). A floor that already has pieces is only replaced with replace: true; its exhibitors and "my booth" are kept by booth number.`,
    {
      venue: str("indoor or outdoor", { enum: Object.keys(FLOOR_VENUES) }),
      width: num("Across, inches (120–24000)", { minimum: 120, maximum: 24000 }),
      depth: num("Back to entrance, inches (120–24000)", { minimum: 120, maximum: 24000 }),
      template: str("A floor template instead of an empty venue", { enum: Object.keys(FLOOR_TEMPLATES) }),
      drape: str("Pipe-and-drape colour as #rrggbb", { pattern: "^#[0-9a-fA-F]{6}$" }),
      replace: { type: "boolean", description: "Replace a floor that already has pieces" },
    },
  ),
  op(
    "set_floor",
    "Change the venue: indoor or outdoor, its size, the drape colour. Pieces stay where they are.",
    {
      venue: str("indoor or outdoor", { enum: Object.keys(FLOOR_VENUES) }),
      width: num("Inches", { minimum: 120, maximum: 24000 }),
      depth: num("Inches", { minimum: 120, maximum: 24000 }),
      drape: str("#rrggbb", { pattern: "^#[0-9a-fA-F]{6}$" }),
    },
  ),
  op(
    "add_booths",
    `Add a block of booths, numbered on from the floor's highest (or from start): count booths w × d, perRow to a row, gap between neighbours, rows aisle apart; backToBack pairs rows sharing a back line. x, y is the block's back-left corner. Styles: ${Object.keys(BOOTH_STYLES).join(", ")}.`,
    {
      count: num("How many booths", { minimum: 1, maximum: 600 }),
      perRow: num("Booths in a row", { minimum: 1, maximum: 200 }),
      w: num("Booth width, inches (default 120)", { minimum: 24, maximum: 12000 }),
      d: num("Booth depth, inches (default 120)", { minimum: 24, maximum: 12000 }),
      gap: num("Between neighbours in a row, inches (default 0)", { minimum: 0, maximum: 2400 }),
      aisle: num("Between rows, inches (default 120)", { minimum: 0, maximum: 2400 }),
      backToBack: { type: "boolean", description: "Rows in back-to-back pairs" },
      style: str("How the booths are built", { enum: Object.keys(BOOTH_STYLES) }),
      x: num("Block's left edge, inches from the venue's left"),
      y: num("Block's back edge, inches from the venue's back"),
      start: num("Lowest number to use; numbers carry on past the floor's highest booth", { minimum: 1, maximum: 99999 }),
    },
    ["count", "x", "y"],
  ),
  op(
    "add_floor_piece",
    `Put one piece on the show floor, centred on x, y. Kinds: ${Object.entries(FLOOR_KINDS).map(([k, v]) => `${k} (${v.label}, ${v.w}×${v.d}″)`).join(", ")}. A booth gets the next number unless number is given.`,
    {
      kind: str("One of the kinds above", { enum: Object.keys(FLOOR_KINDS) }),
      x: num("Centre across, inches"), y: num("Centre toward the entrance, inches"),
      w: num("Inches", { minimum: 2, maximum: 12000 }), d: num("Inches", { minimum: 2, maximum: 12000 }),
      rot: num("Degrees clockwise, 0–360", { minimum: 0, maximum: 360 }),
      number: num("A booth's number", { minimum: 1, maximum: 99999 }),
      style: str("A booth's style", { enum: Object.keys(BOOTH_STYLES) }),
      text: str("A label's words, or a name for any piece", { maxLength: 120 }),
      ref: REF,
    },
    ["kind", "x", "y"],
  ),
  op(
    "change_floor_piece",
    "Move, turn, resize or restyle one piece of the show floor. piece is a booth number (\"#105\"), a piece id from describe_booth, or \"@ref\".",
    {
      piece: str("\"#105\" for booth 105, a piece id, or \"@ref\""),
      x: num("Inches"), y: num("Inches"),
      w: num("Inches", { minimum: 2, maximum: 12000 }), d: num("Inches", { minimum: 2, maximum: 12000 }),
      rot: num("Degrees clockwise", { minimum: 0, maximum: 360 }),
      style: str("A booth's style", { enum: Object.keys(BOOTH_STYLES) }),
      text: str("Words", { maxLength: 120 }),
    },
    ["piece"],
  ),
  op(
    "remove_floor_piece",
    "Take one piece off the show floor. A booth's exhibitor, \"my booth\" mark and parked design go with it.",
    { piece: str("\"#105\", a piece id, or \"@ref\"") },
    ["piece"],
  ),
  op(
    "set_exhibitor",
    `Who has a booth on the floor, and where its sale stands: ${Object.keys(STATUSES).join(", ")}.`,
    {
      number: num("The booth's number", { minimum: 1, maximum: 99999 }),
      name: str("Exhibitor (empty to clear)", { maxLength: 120 }),
      status: str("open, held or sold", { enum: Object.keys(STATUSES) }),
      note: str("A note (empty to clear)", { maxLength: 300 }),
      price: num("Booth price", { minimum: HALL_LIMITS.price[0], maximum: HALL_LIMITS.price[1] }),
    },
    ["number"],
  ),
  op(
    "mark_my_booth",
    "Mark which floor booth is the artist's own (the 3D show stands it at the centre, in full). Leave number out to clear it.",
    { number: num("The booth's number", { minimum: 1, maximum: 99999 }) },
  ),
  op("fit_floor", "Grow the venue (never shrink it) so every piece is on it, with a margin.", {
    margin: num("Inches round the pieces (default 60)", { minimum: 0, maximum: 1200 }),
  }),
];
export const OP_NAMES = OPS.map((o) => o.name);

// ------------------------------------------------------------- apply

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const has = (o, k) => o[k] !== undefined;

function checkShape(o, i) {
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new SceneOpError(`Op ${i + 1} isn't an object.`, i);
  const def = OPS.find((d) => d.name === o.op);
  if (!def) throw new SceneOpError(`Op ${i + 1}: there is no op "${o.op}". Ops: ${OP_NAMES.join(", ")}.`, i);
  const props = def.schema.properties;
  for (const k of Object.keys(o)) if (!props[k]) throw new SceneOpError(`Op ${i + 1} (${o.op}): unknown field "${k}".`, i);
  for (const k of def.schema.required) if (!has(o, k)) throw new SceneOpError(`Op ${i + 1} (${o.op}) needs ${k}.`, i);
  for (const [k, v] of Object.entries(o)) {
    const s = props[k];
    if (k === "op") continue;
    if (s.type === "number" && !isNum(v)) throw new SceneOpError(`Op ${i + 1} (${o.op}): ${k} must be a number.`, i);
    if (s.type === "boolean" && typeof v !== "boolean") throw new SceneOpError(`Op ${i + 1} (${o.op}): ${k} must be true or false.`, i);
    if (s.type === "string" && typeof v !== "string") throw new SceneOpError(`Op ${i + 1} (${o.op}): ${k} must be text.`, i);
    if (s.enum && !s.enum.includes(v)) throw new SceneOpError(`Op ${i + 1} (${o.op}): ${k} must be one of ${s.enum.join(", ")}.`, i);
    if (s.pattern && !new RegExp(s.pattern).test(v)) throw new SceneOpError(`Op ${i + 1} (${o.op}): ${k} isn't a #rrggbb colour.`, i);
    if (isNum(s.minimum) && v < s.minimum) throw new SceneOpError(`Op ${i + 1} (${o.op}): ${k} must be at least ${s.minimum}.`, i);
    if (isNum(s.maximum) && v > s.maximum) throw new SceneOpError(`Op ${i + 1} (${o.op}): ${k} must be at most ${s.maximum}.`, i);
    if (isNum(s.maxLength) && v.length > s.maxLength) throw new SceneOpError(`Op ${i + 1} (${o.op}): ${k} is too long.`, i);
    if (isNum(s.minLength) && v.trim().length < s.minLength) throw new SceneOpError(`Op ${i + 1} (${o.op}): ${k} can't be empty.`, i);
  }
}

/**
 * Apply `ops` in order to a scene. Returns `{ scene, lines }`: the new scene
 * (validated) and one plain sentence per op for the confirm card. Throws a
 * SceneOpError naming the first op that can't be done; nothing is half-done.
 */
export function applyOps(scene, ops, images = []) {
  if (!Array.isArray(ops) || !ops.length) throw new SceneOpError("Give at least one op.");
  if (ops.length > MAX_OPS) throw new SceneOpError(`At most ${MAX_OPS} ops at a time.`);
  const p = projectOf(scene, images);
  p.booth.pedestals = boothPedestals(p);
  const refs = new Map();
  const lines = [];
  ops.forEach((o, i) => {
    checkShape(o, i);
    lines.push(run(p, o, i, refs));
  });
  return { scene: sceneOfChecked(p), lines };
}

function resolve(id, refs, i) {
  if (typeof id !== "string") return id;
  if (id.startsWith("@")) {
    if (!refs.has(id.slice(1))) throw new SceneOpError(`Op ${i + 1}: nothing earlier in this list was given ref "${id.slice(1)}".`, i);
    return refs.get(id.slice(1));
  }
  if (id.startsWith("panel:@")) return panelKey(resolve(id.slice(6), refs, i));
  return id;
}
function remember(o, id, refs, i) {
  if (o.ref === undefined) return;
  if (refs.has(o.ref)) throw new SceneOpError(`Op ${i + 1}: ref "${o.ref}" is already used in this list.`, i);
  refs.set(o.ref, id);
}
function pieceOf(p, id, i) {
  const ped = p.booth.pedestals.find((x) => x.id === id);
  if (!ped) throw new SceneOpError(`Op ${i + 1}: this booth has no furniture with id ${id}.`, i);
  return ped;
}
function artOf(p, id, i) {
  const a = p.art.find((x) => x.id === id);
  if (!a) throw new SceneOpError(`Op ${i + 1}: this booth has no work with id ${id}.`, i);
  return a;
}
function wallOf(p, key, i) {
  if (!wallSpec(p, key)) throw new SceneOpError(`Op ${i + 1}: this booth has no wall "${key}". Walls: ${wallKeys(p).join(", ")}.`, i);
  return key;
}
const sizeLimits = (kind) => (kind === "box" ? BOX_LIMITS : { width: [4, 96], depth: [4, 96], height: [6, 96] });
function checkSize(kind, o, i) {
  const lim = sizeLimits(kind);
  for (const k of ["width", "depth", "height"]) {
    if (has(o, k) && (o[k] < lim[k][0] || o[k] > lim[k][1])) {
      throw new SceneOpError(`Op ${i + 1}: a ${FURNITURE[kind]?.label || kind} is ${lim[k][0]}–${lim[k][1]}″ ${k === "depth" ? "deep" : k === "height" ? "tall" : "wide"}.`, i);
    }
  }
}
/** Everything back inside the booth after its size changed. */
function settle(p) {
  p.art = p.art.map((a) => constrain(p, a));
  p.booth.panels = boothPanels(p).map((panel) => constrainPanel(p, panel));
  p.booth.pedestals = boothPedestals(p).map((ped) => constrainPedestal(p, ped));
}

function run(p, o, i, refs) {
  const b = p.booth;
  switch (o.op) {
    case "rename": {
      p.name = o.name.trim().slice(0, 200);
      return `Rename the booth ${quote(p.name)}`;
    }
    case "set_booth": {
      const said = [];
      if (has(o, "venue")) {
        applyVenue(p, o.venue);
        said.push(o.venue === "artshow" ? "an indoor art-show booth" : "an outdoor booth");
      }
      if (has(o, "width")) {
        b.width = o.width;
        b.walls.back = { ...b.walls.back, width: o.width };
      }
      if (has(o, "depth")) {
        b.depth = o.depth;
        b.walls.left = { ...b.walls.left, width: o.depth };
        b.walls.right = { ...b.walls.right, width: o.depth };
      }
      if (has(o, "width") || has(o, "depth")) said.push(`${inches(b.width)} wide × ${inches(b.depth)} deep`);
      if (has(o, "height")) {
        b.height = o.height;
        for (const k of ["back", "left", "right"]) b.walls[k] = { ...b.walls[k], height: Math.min(144, o.height) };
        if (b.artShow) b.artShow = { ...b.artShow, height: Math.max(24, Math.min(144, o.height)) };
        said.push(`walls ${inches(o.height)} tall`);
      }
      if (has(o, "tent")) {
        if (o.tent && b.venue === "artshow") throw new SceneOpError(`Op ${i + 1}: an indoor art-show booth has no canopy.`, i);
        b.tent = o.tent;
        said.push(o.tent ? "with a canopy" : "no canopy");
      }
      if (has(o, "color")) {
        b.color = o.color.toLowerCase();
        said.push(`walls ${b.color}`);
      }
      if (!said.length) throw new SceneOpError(`Op ${i + 1} (set_booth): say what to change.`, i);
      // Sized by hand now: the art-show walls no longer follow the panel module.
      if (b.artShow && (has(o, "width") || has(o, "depth") || has(o, "height"))) b.artShow = { ...b.artShow, linked: false };
      settle(p);
      return `Make the booth ${said.join(", ")}`;
    }
    case "add_furniture": {
      if (p.booth.pedestals.length >= MAX_PEDESTALS) throw new SceneOpError(`Op ${i + 1}: a booth holds at most ${MAX_PEDESTALS} pieces of furniture.`, i);
      checkSize(o.kind, o, i);
      const { label, ...size } = FURNITURE[o.kind];
      const ped = constrainPedestal(p, {
        id: uid(),
        name: o.name || label,
        ...size,
        ...(o.kind === "pedestal" ? {} : { kind: o.kind }),
        x: o.x ?? 0,
        z: o.z ?? 0,
        rotation: o.rotation ?? 0,
        ...(has(o, "width") ? { width: o.width } : {}),
        ...(has(o, "depth") ? { depth: o.depth } : {}),
        ...(has(o, "height") ? { height: o.height } : {}),
        ...(has(o, "color") ? { color: o.color.toLowerCase() } : {}),
      });
      p.booth.pedestals.push(ped);
      remember(o, ped.id, refs, i);
      return `Add ${furnitureName(ped)} (${inches(ped.width)} × ${inches(ped.depth)}), ${across(ped.x)}, ${deep(ped.z)}`;
    }
    case "change_furniture": {
      const id = resolve(o.id, refs, i);
      const ped = pieceOf(p, id, i);
      checkSize(ped.kind || "pedestal", o, i);
      const next = { ...ped };
      for (const k of ["x", "z", "rotation", "width", "depth", "height", "hidden"]) if (has(o, k)) next[k] = o[k];
      if (has(o, "name")) next.name = o.name;
      if (has(o, "color")) next.color = o.color.toLowerCase();
      const placed = constrainPedestal(p, next);
      p.booth.pedestals = p.booth.pedestals.map((x) => (x.id === id ? placed : x));
      const said = [];
      if (has(o, "x") || has(o, "z")) said.push(`to ${across(placed.x)}, ${deep(placed.z)}`);
      if (has(o, "rotation")) said.push(`turned to ${placed.rotation}°`);
      if (has(o, "width") || has(o, "depth") || has(o, "height")) said.push(`${inches(placed.width)} × ${inches(placed.depth)}, ${inches(placed.height)} tall`);
      if (has(o, "name")) said.push(`named ${quote(placed.name)}`);
      if (has(o, "color")) said.push(placed.color);
      if (has(o, "hidden")) said.push(placed.hidden ? "hidden" : "shown");
      if (!said.length) throw new SceneOpError(`Op ${i + 1} (change_furniture): say what to change.`, i);
      return `${furnitureName(ped)}: ${said.join(", ")}`;
    }
    case "remove_furniture": {
      const id = resolve(o.id, refs, i);
      const ped = pieceOf(p, id, i);
      p.booth.pedestals = p.booth.pedestals.filter((x) => x.id !== id);
      return `Remove ${furnitureName(ped)}`;
    }
    case "add_wall": {
      const panels = boothPanels(p);
      if (panels.length >= MAX_PANELS) throw new SceneOpError(`Op ${i + 1}: a booth holds at most ${MAX_PANELS} free-standing walls.`, i);
      const panel = constrainPanel(p, {
        id: uid(),
        name: o.name || `Wall ${panels.length + 1}`,
        width: o.width ?? 48,
        height: o.height ?? Math.min(b.height, 96),
        x: o.x ?? 0,
        z: o.z ?? 0,
        rotation: o.rotation ?? 0,
      });
      b.panels = [...panels, panel];
      remember(o, panel.id, refs, i);
      return `Add a free-standing wall ${quote(panel.name)}, ${inches(panel.width)} wide, ${across(panel.x)}, ${deep(panel.z)}`;
    }
    case "change_wall": {
      const key = wallOf(p, resolve(o.wall, refs, i), i);
      const label = wallLabel(p, key);
      const said = [];
      if (isPanelKey(key)) {
        const id = key.slice("panel:".length);
        b.panels = boothPanels(p).map((panel) => {
          if (panel.id !== id) return panel;
          const next = { ...panel };
          for (const k of ["x", "z", "rotation", "width", "height", "hidden"]) if (has(o, k)) next[k] = o[k];
          if (has(o, "name")) next.name = o.name;
          return constrainPanel(p, next);
        });
      } else {
        for (const k of ["x", "z", "rotation", "name"]) {
          if (has(o, k)) throw new SceneOpError(`Op ${i + 1}: the ${label.toLowerCase()} stays where the booth puts it; only width, height and hidden change.`, i);
        }
        const max = key === "back" ? b.width : b.depth;
        if (has(o, "width") && o.width > max) throw new SceneOpError(`Op ${i + 1}: the ${label.toLowerCase()} can be at most ${inches(max)} wide; make the booth bigger first.`, i);
        const w = { ...b.walls[key] };
        if (has(o, "width")) w.width = o.width;
        if (has(o, "height")) w.height = o.height;
        if (has(o, "hidden")) w.enabled = !o.hidden;
        b.walls[key] = w;
      }
      const spec = wallSpec(p, key);
      if (has(o, "x") || has(o, "z")) said.push(`to ${across(spec.panel.x)}, ${deep(spec.panel.z)}`);
      if (has(o, "rotation")) said.push(`turned to ${spec.panel.rotation}°`);
      if (has(o, "width") || has(o, "height")) said.push(`${inches(spec.width)} wide, ${inches(spec.height)} tall`);
      if (has(o, "name")) said.push(`named ${quote(o.name)}`);
      if (has(o, "hidden")) said.push(o.hidden ? "hidden" : "shown");
      if (!said.length) throw new SceneOpError(`Op ${i + 1} (change_wall): say what to change.`, i);
      p.art = p.art.map((a) => (a.wall === key ? constrain(p, a) : a));
      return `${label}: ${said.join(", ")}`;
    }
    case "remove_wall": {
      const key = wallOf(p, resolve(o.wall, refs, i), i);
      if (!isPanelKey(key)) throw new SceneOpError(`Op ${i + 1}: the back, left and right walls can be hidden (change_wall hidden) but not removed.`, i);
      const hung = p.art.filter((a) => a.wall === key);
      if (hung.length) throw new SceneOpError(`Op ${i + 1}: ${hung.length} work${hung.length === 1 ? " hangs" : "s hang"} on ${wallLabel(p, key)}; move or remove ${hung.length === 1 ? "it" : "them"} first.`, i);
      const label = wallLabel(p, key);
      b.panels = boothPanels(p).filter((panel) => panelKey(panel.id) !== key);
      return `Remove the free-standing wall ${quote(label)}`;
    }
    case "change_art": {
      const id = resolve(o.id, refs, i);
      const a = artOf(p, id, i);
      const next = { ...a };
      if (has(o, "wall")) next.wall = wallOf(p, resolve(o.wall, refs, i), i);
      if (has(o, "w") && has(o, "h")) {
        next.w = o.w;
        next.h = o.h;
      } else if (has(o, "w")) {
        next.h = Math.round(((a.h * o.w) / a.w) * 100) / 100;
        next.w = o.w;
      } else if (has(o, "h")) {
        next.w = Math.round(((a.w * o.h) / a.h) * 100) / 100;
        next.h = o.h;
      }
      if (has(o, "x")) next.x = o.x;
      if (has(o, "y")) next.y = o.y;
      if (has(o, "title")) next.title = o.title;
      const wall = wallSpec(p, next.wall);
      if (next.w > wall.width || next.h > wall.height) {
        throw new SceneOpError(`Op ${i + 1}: ${quote(a.title)} at ${inches(next.w)} × ${inches(next.h)} is bigger than ${wallLabel(p, next.wall)} (${inches(wall.width)} × ${inches(wall.height)}).`, i);
      }
      const placed = constrain(p, next);
      p.art = p.art.map((x) => (x.id === id ? placed : x));
      const said = [];
      if (has(o, "wall") && next.wall !== a.wall) said.push(`to ${wallLabel(p, next.wall)}`);
      if (has(o, "x") || has(o, "y")) said.push(`${inches(placed.x)} from the wall's left end, bottom ${inches(placed.y)} off the floor`);
      if (has(o, "w") || has(o, "h")) said.push(`${inches(placed.w)} × ${inches(placed.h)}`);
      if (has(o, "title")) said.push(`titled ${quote(placed.title)}`);
      if (!said.length) throw new SceneOpError(`Op ${i + 1} (change_art): say what to change.`, i);
      return `${quote(a.title)}: ${said.join(", ")}`;
    }
    case "remove_art": {
      const id = resolve(o.id, refs, i);
      const a = artOf(p, id, i);
      p.art = p.art.filter((x) => x.id !== id);
      return `Take ${quote(a.title)} off the wall`;
    }
    case "arrange_wall": {
      const key = wallOf(p, resolve(o.wall, refs, i), i);
      const works = p.art.filter((a) => a.wall === key && (a.face || "inside") === "inside" && !a.booth);
      if (!works.length) throw new SceneOpError(`Op ${i + 1}: nothing hangs on ${wallLabel(p, key)} yet.`, i);
      const wall = wallSpec(p, key);
      const line = o.line ?? HANG_LINE;
      const ys = hangAt(works, wall, line);
      const xs = o.spacing === "keep" ? {} : spaceEvenly(sameWall(works, works[0]), wall);
      p.art = p.art.map((a) => (ys[a.id] === undefined ? a : constrain(p, { ...a, y: ys[a.id], ...(xs[a.id] !== undefined ? { x: xs[a.id] } : {}) })));
      return `${wallLabel(p, key)}: ${works.length} work${works.length === 1 ? "" : "s"} centred ${inches(line)} off the floor${o.spacing === "keep" ? "" : ", evenly spaced"}`;
    }
    case "start_floor":
    case "set_floor":
    case "add_booths":
    case "add_floor_piece":
    case "change_floor_piece":
    case "remove_floor_piece":
    case "set_exhibitor":
    case "mark_my_booth":
    case "fit_floor":
      return runFloor(p, o, i, refs);
    default:
      throw new SceneOpError(`Op ${i + 1}: there is no op "${o.op}".`, i);
  }
}

// ------------------------------------------------------------- the show floor

const feetBy = (w, d) => `${inches(w)} × ${inches(d)}`;
function floorOfP(p, i) {
  if (!p.hall) throw new SceneOpError(`Op ${i + 1}: this project has no show floor yet; start one with start_floor.`, i);
  return toFloor(p.hall);
}
/** A piece by "#number", id or "@ref". */
function floorPiece(h, key, refs, i) {
  const id = resolve(key, refs, i);
  const hit = /^#\d+$/.test(id)
    ? h.items.find((it) => it.kind === "booth" && it.number === Number(id.slice(1)))
    : h.items.find((it) => it.id === id);
  if (!hit) throw new SceneOpError(`Op ${i + 1}: the show floor has no ${/^#/.test(id) ? `booth ${id.slice(1)}` : `piece ${id}`}.`, i);
  return hit;
}
const pieceName = (it) => (it.kind === "booth" ? `Booth ${it.number}` : it.text ? `${FLOOR_KINDS[it.kind].label} “${it.text}”` : FLOOR_KINDS[it.kind].label);
function roomFor(h, n, i) {
  if (h.items.length + n > MAX_ITEMS) throw new SceneOpError(`Op ${i + 1}: a show floor holds at most ${MAX_ITEMS} pieces.`, i);
}
function checkPos(o, i) {
  for (const k of ["x", "y"]) {
    if (has(o, k) && (o[k] < SHOW_LIMITS.pos[0] || o[k] > SHOW_LIMITS.pos[1])) throw new SceneOpError(`Op ${i + 1}: ${k} is off any floor this app draws.`, i);
  }
}

function runFloor(p, o, i, refs) {
  switch (o.op) {
    case "start_floor": {
      const old = p.hall;
      if (old && showItems(old).length && !o.replace) {
        throw new SceneOpError(`Op ${i + 1}: this project already has a show floor; say replace: true to start it again.`, i);
      }
      if (!o.template && (!has(o, "width") || !has(o, "depth"))) throw new SceneOpError(`Op ${i + 1}: give width and depth, or a template.`, i);
      const h = newHall();
      if (o.template) {
        const t = FLOOR_TEMPLATES[o.template].build(h.start);
        h.venue = t.venue;
        h.items = t.items;
      } else {
        h.venue = { kind: o.venue || "indoor", width: o.width, depth: o.depth };
        h.items = [];
      }
      if (has(o, "venue")) h.venue.kind = o.venue;
      if (has(o, "width")) h.venue.width = o.width;
      if (has(o, "depth")) h.venue.depth = o.depth;
      if (has(o, "drape")) h.venue.drape = o.drape.toLowerCase();
      // Exhibitors, my booth and parked designs are kept by number, as the app's own template swap does.
      if (old) for (const k of ["booths", "mine", "open", "designs", "price", "start"]) if (old[k] !== undefined) h[k] = old[k];
      p.hall = h;
      const v = h.venue;
      return `Start ${o.template ? `the ${FLOOR_TEMPLATES[o.template].label.toLowerCase()} floor` : "an empty floor"}: ${FLOOR_VENUES[v.kind].toLowerCase()}, ${feetBy(v.width, v.depth)}${h.items.length ? `, ${h.items.filter((x) => x.kind === "booth").length} booths` : ""}`;
    }
    case "set_floor": {
      const h = floorOfP(p, i);
      const said = [];
      if (has(o, "venue")) {
        h.venue.kind = o.venue;
        said.push(FLOOR_VENUES[o.venue].toLowerCase());
      }
      if (has(o, "width")) h.venue.width = o.width;
      if (has(o, "depth")) h.venue.depth = o.depth;
      if (has(o, "width") || has(o, "depth")) said.push(feetBy(h.venue.width, h.venue.depth));
      if (has(o, "drape")) {
        h.venue.drape = o.drape.toLowerCase();
        said.push(`drape ${h.venue.drape}`);
      }
      if (!said.length) throw new SceneOpError(`Op ${i + 1} (set_floor): say what to change.`, i);
      return `Show floor: ${said.join(", ")}`;
    }
    case "add_booths": {
      const h = floorOfP(p, i);
      checkPos(o, i);
      roomFor(h, o.count, i);
      const start = o.start ?? nextNumber(h.items, h.start);
      const block = boothBlock(h.items, {
        count: o.count, perRow: o.perRow ?? o.count, w: o.w ?? 120, d: o.d ?? 120, gap: o.gap ?? 0, aisle: o.aisle ?? 120,
        backToBack: !!o.backToBack, style: o.style, x: o.x, y: o.y, start,
      });
      const taken = new Set(h.items.filter((it) => it.kind === "booth").map((it) => it.number));
      const clash = block.find((b) => taken.has(b.number));
      if (clash) throw new SceneOpError(`Op ${i + 1}: booth ${clash.number} is already on the floor; start the numbers elsewhere.`, i);
      h.items.push(...block);
      const first = block[0].number, last = block.at(-1).number;
      return `Add ${block.length} booth${block.length === 1 ? "" : "s"} ${feetBy(block[0].w, block[0].d)}${block.length > 1 ? `, numbered ${first}–${last}` : `, number ${first}`}, ${o.perRow && o.perRow < o.count ? `${o.perRow} to a row` : "in one row"}${o.backToBack ? ", back to back" : ""}`;
    }
    case "add_floor_piece": {
      const h = floorOfP(p, i);
      checkPos(o, i);
      roomFor(h, 1, i);
      const kind = FLOOR_KINDS[o.kind];
      if (o.kind !== "booth" && (has(o, "number") || has(o, "style"))) throw new SceneOpError(`Op ${i + 1}: only a booth has a number or a style.`, i);
      const it = { id: newId(h.items), kind: o.kind, x: o.x, y: o.y, w: o.w ?? kind.w, d: o.d ?? kind.d };
      if (has(o, "rot") && o.rot % 360) it.rot = o.rot % 360;
      if (o.kind === "booth") {
        it.number = o.number ?? nextNumber(h.items, h.start);
        if (h.items.some((x) => x.kind === "booth" && x.number === it.number)) throw new SceneOpError(`Op ${i + 1}: booth ${it.number} is already on the floor.`, i);
        if (o.style && o.style !== "pipe") it.style = o.style;
      }
      if (o.text) it.text = o.text;
      h.items.push(it);
      remember(o, it.id, refs, i);
      return `Add ${pieceName(it)} (${feetBy(it.w, it.d)}) at ${inches(it.x)} across, ${inches(it.y)} from the back`;
    }
    case "change_floor_piece": {
      const h = floorOfP(p, i);
      checkPos(o, i);
      const it = floorPiece(h, o.piece, refs, i);
      if (it.kind !== "booth" && has(o, "style")) throw new SceneOpError(`Op ${i + 1}: only a booth has a style.`, i);
      const said = [];
      if (has(o, "x")) it.x = o.x;
      if (has(o, "y")) it.y = o.y;
      if (has(o, "x") || has(o, "y")) said.push(`to ${inches(it.x)} across, ${inches(it.y)} from the back`);
      if (has(o, "w")) it.w = o.w;
      if (has(o, "d")) it.d = o.d;
      if (has(o, "w") || has(o, "d")) said.push(feetBy(it.w, it.d));
      if (has(o, "rot")) {
        if (o.rot % 360) it.rot = o.rot % 360;
        else delete it.rot;
        said.push(`turned to ${o.rot % 360}°`);
      }
      if (has(o, "style")) {
        if (o.style === "pipe") delete it.style;
        else it.style = o.style;
        said.push(BOOTH_STYLES[o.style].toLowerCase());
      }
      if (has(o, "text")) {
        if (o.text) it.text = o.text;
        else delete it.text;
        said.push(o.text ? `“${o.text}”` : "no words");
      }
      if (!said.length) throw new SceneOpError(`Op ${i + 1} (change_floor_piece): say what to change.`, i);
      return `${pieceName(it)}: ${said.join(", ")}`;
    }
    case "remove_floor_piece": {
      const h = floorOfP(p, i);
      const it = floorPiece(h, o.piece, refs, i);
      if (it.kind === "booth") {
        const n = it.number;
        const effect = deleteEffect(h, [n]);
        if (effect.refuse) throw new SceneOpError(`Op ${i + 1}: booth ${n} holds the design open in the app, and your own booth's design is parked; open another booth in the app first.`, i);
        const live = liveNumber(h);
        delete h.booths[n];
        if (h.mine === n) delete h.mine;
        if (h.designs) delete h.designs[n];
        if (h.designs && !Object.keys(h.designs).length) delete h.designs;
        if (effect.orphan) setOpen(h, OWN);
        else if (live !== undefined) setOpen(h, live);
      }
      h.items = h.items.filter((x) => x.id !== it.id);
      return `Remove ${pieceName(it)}`;
    }
    case "set_exhibitor": {
      const h = floorOfP(p, i);
      const n = o.number;
      if (!h.items.some((it) => it.kind === "booth" && it.number === n)) throw new SceneOpError(`Op ${i + 1}: the show floor has no booth ${n}.`, i);
      const b = { ...(h.booths[n] || {}) };
      const said = [];
      for (const k of ["name", "note"]) {
        if (!has(o, k)) continue;
        if (o[k].trim()) b[k] = o[k].trim();
        else delete b[k];
        said.push(k === "name" ? (o[k].trim() ? quote(o[k].trim()) : "no exhibitor") : o[k].trim() ? `note ${quote(o[k].trim())}` : "no note");
      }
      if (has(o, "status")) {
        b.status = o.status;
        said.push(STATUSES[o.status].label.toLowerCase());
      }
      if (has(o, "price")) {
        b.price = o.price;
        said.push(`price ${o.price}`);
      }
      if (!said.length) throw new SceneOpError(`Op ${i + 1} (set_exhibitor): say what to change.`, i);
      h.booths[n] = b;
      return `Booth ${n}: ${said.join(", ")}`;
    }
    case "mark_my_booth": {
      const h = floorOfP(p, i);
      if (has(o, "number") && !h.items.some((it) => it.kind === "booth" && it.number === o.number)) {
        throw new SceneOpError(`Op ${i + 1}: the show floor has no booth ${o.number}.`, i);
      }
      setMine(h, o.number);
      return has(o, "number") ? `Booth ${o.number} is mine` : "No booth on the floor is marked as mine";
    }
    case "fit_floor": {
      const h = floorOfP(p, i);
      const grew = growToFit(h, o.margin ?? 60);
      return grew ? `Grow the floor to ${feetBy(h.venue.width, h.venue.depth)} so every piece is on it` : "The floor already holds every piece";
    }
  }
  throw new SceneOpError(`Op ${i + 1}: there is no op "${o.op}".`, i);
}

// ------------------------------------------------------------- build

/** What `build` takes. */
export const BUILD_SCHEMA = {
  type: "object",
  properties: {
    name: str("The booth's name", { maxLength: 200 }),
    show: str(`Kind of show: ${Object.entries(SHOWS).map(([k, v]) => `${k} (${v.label})`).join(", ")}`, { enum: Object.keys(SHOWS) }),
    size: str(`A standard footprint: ${Object.keys(FOOTPRINTS).join(", ")} (feet). For any other size, add a set_booth op.`, { enum: Object.keys(FOOTPRINTS) }),
    ops: { type: "array", maxItems: MAX_OPS, description: "Then these ops, in order, as for placement_edit", items: { type: "object" } },
  },
  additionalProperties: false,
};

/**
 * A new booth: the quick start for that show and size, then `ops`. Returns
 * `{ scene, lines }` like applyOps; the scene has no images.
 */
export function build({ name, show = "artfair", size = "10x10", ops = [] } = {}) {
  if (show !== undefined && !SHOWS[show]) throw new SceneOpError(`show must be one of ${Object.keys(SHOWS).join(", ")}.`);
  if (size !== undefined && !FOOTPRINTS[size]) throw new SceneOpError(`size must be one of ${Object.keys(FOOTPRINTS).join(", ")}.`);
  const p = quickStart({ show, size, furniture: [], name });
  const { assets: _a, ...scene } = p;
  const first = `New ${FOOTPRINTS[size].label} booth for ${SHOWS[show].label.toLowerCase()}, named ${quote(p.name)}`;
  if (!ops.length) return { scene: sceneOfChecked(p), lines: [first] };
  const out = applyOps(scene, ops, []);
  return { scene: out.scene, lines: [first, ...out.lines] };
}
