// Wall layouts and panel colours for the guided booth's second step
// (DEMO_PHASE.md, task A3): how an artist's walls stand, in one tap, and
// the colour of the panels from six plain names.
//
// A layout writes only what schema 1 already has: the three perimeter walls'
// `enabled` and `width` in `booth.walls`, and free-standing walls in
// `booth.panels` (WALLS_PHASE.md). The walls a layout adds carry ids that
// begin "layout-", which is how applying another layout finds and replaces
// them; every free-standing wall the artist added by hand is left exactly as
// it is. So a layout is an ordinary booth afterwards — every wall can still
// be moved, resized or hidden in the Walls tab — and applying the same one
// twice changes nothing the second time.
//
// Work hung on a wall a layout takes away is never lost: it moves to the
// nearest wall that remains (a wing's work to the side wall beside it, a
// side wall's or the centre wall's to the back), placed clear of what is
// already there (`openSpot`). Pure — no DOM, no scene — and not in the
// platform's scene bundle, so the platform's copy is untouched.
import { MAX_PANELS, boothPanels, constrain, openSpot, panelKey, wallSpec } from "./model.js";

/** The four layouts, in the order the step shows them. */
export const LAYOUTS = Object.freeze({
  u: { label: "U", blurb: "A back wall and both sides." },
  l: { label: "L", blurb: "A back wall and the left side, open on the right." },
  wings: { label: "U with wings", blurb: "A U, and a short wall at each front corner facing the aisle." },
  centre: { label: "U with a centre wall", blurb: "A U, and a free-standing wall across the middle." },
});
export const LAYOUT_KEYS = Object.freeze(Object.keys(LAYOUTS));

/**
 * Panel colours by their plain names (no maker's names: DEMO_PHASE.md →
 * Constraints). Charcoal is the outdoor booth's own default and White the
 * indoor art-show booth's, so a new booth already wears one of them.
 */
export const PANEL_COLORS = Object.freeze([
  { name: "Black", hex: "#1f2022" },
  { name: "Charcoal", hex: "#45474a" },
  { name: "Grey", hex: "#8b8e92" },
  { name: "White", hex: "#f4f3f0" },
  { name: "Tan", hex: "#c9b593" },
  { name: "Navy", hex: "#263247" },
]);

const PREFIX = "layout-";
const isLayoutPanel = (panel) => typeof panel.id === "string" && panel.id.startsWith(PREFIX);
/** How far inside the front edge a wing stands, in inches: clear of the canopy's legs. */
const WING_INSET = 3;

/**
 * The free-standing walls a layout adds, measured to this booth: a wing is
 * a fifth of the booth's width (24″ on a 10 × 10, 48″ on a 10 × 20) and
 * faces the aisle from a front corner; a centre wall is 40% of the width,
 * at most 8 ft, across the middle, facing the entrance like the back wall.
 */
function panelsFor(p, key) {
  const b = p.booth;
  const height = b.walls.back.height;
  if (key === "wings") {
    const width = Math.round(b.width / 5);
    const x = b.width / 2 - width / 2;
    const z = b.depth / 2 - WING_INSET;
    return [
      { id: `${PREFIX}wing-left`, name: "Left wing", width, height, x: -x, z, rotation: 0 },
      { id: `${PREFIX}wing-right`, name: "Right wing", width, height, x, z, rotation: 0 },
    ];
  }
  if (key === "centre") return [{ id: `${PREFIX}centre`, name: "Centre wall", width: Math.min(96, Math.round(b.width * 0.4)), height, x: 0, z: 0, rotation: 0 }];
  return [];
}

/**
 * Where work goes when its wall is taken away: the wall nearest it that the
 * layout keeps. A wing's goes to the side wall it stands beside, if that
 * side stays; everything else to the back wall, which every layout keeps.
 */
function nearestWall(p, from) {
  if (from === panelKey(`${PREFIX}wing-left`) && wallSpec(p, "left")?.enabled) return "left";
  if (from === panelKey(`${PREFIX}wing-right`) && wallSpec(p, "right")?.enabled) return "right";
  return "back";
}

/**
 * Where on that wall: the end nearest the wall it came from — a side
 * wall's work at that side's end of the back wall, a wing's at the front of
 * its side wall (x = 0 is the front of the left wall, the back of the right
 * one: src/scene/build.js `wallFrame`) — then walked clear of what is there.
 */
function landing(p, a, from, to) {
  const width = wallSpec(p, to).width;
  const right = from === "right" || from.endsWith("wing-right");
  let x;
  if (to === "back") x = right ? width - a.w - 6 : from === "left" ? 6 : (width - a.w) / 2;
  else x = to === "left" ? 6 : width - a.w - 6;
  return openSpot(p, constrain(p, { ...a, wall: to, face: "inside", x: Math.max(0, x) }));
}

/** Whether a layout can stand here: a known key, within the eight free-standing walls. */
export const layoutFits = (p, key) => !!LAYOUTS[key] && boothPanels(p).filter((panel) => !isLayoutPanel(panel)).length + panelsFor(p, key).length <= MAX_PANELS;

/**
 * Stand the booth's walls in a layout. Returns the project, or null — and
 * changes nothing — for an unknown key or a layout whose walls would pass
 * the eight free-standing walls a booth may have.
 * @param {any} p
 * @param {string} key
 */
export function applyWallLayout(p, key) {
  if (!layoutFits(p, key)) return null;
  const own = boothPanels(p).filter((panel) => !isLayoutPanel(panel));
  const added = panelsFor(p, key);
  const b = p.booth;
  // A wall is gone when a perimeter wall that stood is switched off, or a
  // free-standing wall is taken out. One the artist hid stays hidden, with
  // its work on it, as it would in the Walls tab.
  const stood = new Set(["back", "left", "right"].filter((k) => b.walls[k].enabled));
  const existed = new Set(boothPanels(p).map((panel) => panelKey(panel.id)));
  b.walls.back = { ...b.walls.back, enabled: true, width: b.width };
  b.walls.left = { ...b.walls.left, enabled: true, width: b.depth };
  b.walls.right = { ...b.walls.right, enabled: key !== "l", width: b.depth };
  b.panels = [...own, ...added];
  // Work on a wall that no longer stands moves; work on a wall that stays is
  // only held inside it, since a wall may have grown back to full width.
  const gone = (wall) => (stood.has(wall) && !b.walls[wall].enabled) || (existed.has(wall) && !wallSpec(p, wall));
  for (let i = 0; i < p.art.length; i++) {
    const a = p.art[i];
    p.art[i] = gone(a.wall) ? landing(p, a, a.wall, nearestWall(p, a.wall)) : constrain(p, a);
  }
  return p;
}

/**
 * The layout a booth stands in, or null for walls set some other way: the
 * three perimeter walls as the layout has them and exactly its walls among
 * the free-standing ones. Walls the artist added by hand do not count, so
 * a booth stays "U with a centre wall" with a wall of its own beside it.
 */
export function currentLayout(p) {
  const w = p.booth.walls;
  const ids = boothPanels(p).filter(isLayoutPanel).map((panel) => panel.id).sort().join(" ");
  if (!w.back.enabled || !w.left.enabled) return null;
  for (const key of LAYOUT_KEYS) {
    const want = panelsFor(p, key).map((panel) => panel.id).sort().join(" ");
    if (w.right.enabled === (key !== "l") && ids === want) return key;
  }
  return null;
}

/**
 * A layout's plan drawing as lines [x1, y1, x2, y2] in a booth of the given
 * size, seen from above with the back wall at the top (y = 0) and the aisle
 * at the bottom. src/ui/guided-panel.js draws them as a small SVG.
 * @param {string} key
 * @param {{ width: number, depth: number }} size
 * @returns {number[][]}
 */
export function layoutPlan(key, { width, depth }) {
  const lines = [[0, 0, width, 0], [0, 0, 0, depth]];
  if (key !== "l") lines.push([width, 0, width, depth]);
  if (key === "wings") {
    const wing = Math.round(width / 5);
    const y = depth - WING_INSET;
    lines.push([0, y, wing, y], [width - wing, y, width, y]);
  }
  if (key === "centre") {
    const half = Math.min(96, Math.round(width * 0.4)) / 2;
    lines.push([width / 2 - half, depth / 2, width / 2 + half, depth / 2]);
  }
  return lines;
}
