// The art-show light bar: one bar across the front of the booth carrying
// directional heads, each one spotting a section of one wall.
//
// These are scenery, not entries in `p.lights`. Nine fixtures would fill that
// four-light list twice over, and none of the nine is a thing anyone wants to
// aim by hand: where a head points is a consequence of the booth's own
// measurements. So the bar is described by five numbers and the fixtures are
// derived from them — which also makes the arithmetic a pure function this
// file can hand to Node, rather than something only a renderer can answer.
import { lightBarSpec, wallSpec } from "./model.js";
// The walls a fixture can be assigned to, left to right along the bar, so the
// heads fan outward from the middle instead of crossing over each other.
const WALL_ORDER = ["left", "back", "right"];
// How far inside the booth's front edge the bar hangs, in inches. Far enough
// in that a head aimed at the back wall clears the valance of the booth in
// front; near enough the entrance that the side walls are lit from the front
// rather than raked from directly above.
export const BAR_INSET = 8;
// How far in from each end of the bar the outermost head sits, in inches.
const END_MARGIN = 5;
/** The fraction of a wall's height a head is aimed at. Eye level on a 96" wall. */
const AIM_HEIGHT = 0.58;
/**
 * How the fixtures are shared out between the three walls. The back wall is
 * the one a visitor faces, so it takes the remainder: nine heads is 3/3/3,
 * eight is 3 back and 2 a side, seven is 3/2/2.
 */
export function fixtureShare(count, walls = WALL_ORDER) {
  const n = Math.max(0, Math.round(count));
  const share = Object.fromEntries(walls.map((w) => [w, Math.floor(n / walls.length)]));
  let extra = n - Object.values(share).reduce((a, b) => a + b, 0);
  // Remainders go to the back wall first, then the left, then the right.
  for (const wall of ["back", "left", "right"]) {
    if (extra <= 0) break;
    if (wall in share) { share[wall] += 1; extra -= 1; }
  }
  return share;
}
/**
 * Where a wall's fixtures are aimed: `n` points evenly spread across the
 * wall's face, in booth inches. The wall's own width is used rather than the
 * footprint, because a wall may be narrower than the side it stands on.
 */
function targets(p, key, n) {
  const spec = wallSpec(p, key);
  if (!spec || !spec.enabled || n <= 0) return [];
  const b = p.booth, y = spec.height * AIM_HEIGHT;
  const out = [];
  for (let i = 0; i < n; i++) {
    // Centres of n equal sections, so no head is aimed at a wall's edge.
    const along = ((i + 0.5) / n) * spec.width;
    if (key === "back") out.push({ x: -spec.width / 2 + along, y, z: -b.depth / 2 });
    // A side wall's frame runs from the entrance toward the back, so the
    // first section is the one nearest the front — which is also the one the
    // outermost head on that side of the bar can reach without crossing over.
    if (key === "left") out.push({ x: -b.width / 2, y, z: b.depth / 2 - along });
    if (key === "right") out.push({ x: b.width / 2, y, z: -b.depth / 2 + along });
  }
  // The right wall's sections run back-to-front along the bar, so its heads
  // read left to right like every other group.
  return key === "right" ? out.reverse() : out;
}
/**
 * Every fixture on the bar: where its head hangs and what it is aimed at, in
 * booth inches, ordered left to right along the bar. A wall that is hidden
 * takes no fixtures, and its share is not handed to another wall — nine heads
 * on a two-walled booth would be nine heads nobody hung.
 */
export function lightBarFixtures(p) {
  const bar = lightBarSpec(p.booth);
  if (!bar.on) return [];
  const b = p.booth;
  const share = fixtureShare(bar.count);
  const aims = [];
  for (const wall of WALL_ORDER)
    for (const target of targets(p, wall, share[wall])) aims.push({ wall, target });
  if (!aims.length) return [];
  const span = Math.max(0, b.width - END_MARGIN * 2);
  const z = b.depth / 2 - BAR_INSET;
  return aims.map(({ wall, target }, i) => ({
    wall,
    // One head per slot, evenly along the bar. With a single fixture the slot
    // is the middle of the bar rather than its left end.
    x: aims.length === 1 ? 0 : -span / 2 + (span * i) / (aims.length - 1),
    y: bar.height,
    z,
    tx: target.x,
    ty: target.y,
    tz: target.z,
    power: bar.power,
    kelvin: bar.kelvin,
  }));
}
/** The bar itself: a rail across the booth, in inches. */
export function lightBarRail(p) {
  const bar = lightBarSpec(p.booth), b = p.booth;
  return { width: b.width, y: bar.height, z: b.depth / 2 - BAR_INSET, on: bar.on };
}
