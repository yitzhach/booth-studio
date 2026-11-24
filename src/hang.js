// Hanging new pictures for the guided booth's fourth step (DEMO_PHASE.md,
// task A4): each picture the artist adds, at the width they typed, on the
// first open spot of the booth's walls.
//
// An upload in the tabs only files a picture in the library; hanging it is a
// second tap, at a size guessed from a 36″ default. An artist in the steps
// gives the width once and the height follows the picture's own shape, so
// what lands on the wall is the size of the real work. Each goes first onto
// the 60″ hang line of the back wall, then the left, the right and any
// free-standing wall that shows, so the first works are at eye level across
// the booth; only when every hang line is full does a picture go above or
// below one (`openSpot`'s rows). Nothing already hung moves. Pure: the
// caller adds the images to `p.assets` and makes the whole hang one undo
// step (src/ui/hang-dialog.js).
import { PLACEMENT_GAP, boothPanels, constrain, isShown, openSpot, panelKey, uid, wallSpec } from "./model.js";
import { HANG_LINE } from "./arrange.js";

/** The widest a typed width may be, in inches: the widest wall schema 1 allows a booth front. */
export const MAX_WIDTH = 240;
/** validateProject's limit on placements. */
export const MAX_PLACEMENTS = 200;

const round = (n) => +n.toFixed(3);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** A picture's height at a width, from its own shape. */
export const heightFor = (asset, width) => round((width * asset.height) / asset.width);

/** The walls new work goes onto, in order: the back, the sides, then free-standing walls that show. */
function wallsInOrder(p) {
  const keys = ["back", "left", "right", ...boothPanels(p).filter(isShown).map((panel) => panelKey(panel.id))];
  return keys.filter((k) => wallSpec(p, k)?.enabled);
}

/** Whether a placement is inside its wall and on top of nothing of this booth's. */
function open(p, a) {
  const wall = wallSpec(p, a.wall);
  if (a.x < 0 || a.y < 0 || a.x + a.w > wall.width + 0.001 || a.y + a.h > wall.height + 0.001) return false;
  return !p.art.some((o) => o.wall === a.wall && (o.face || "inside") === "inside" && !o.booth && a.x < o.x + o.w && o.x < a.x + a.w && a.y < o.y + o.h && o.y < a.y + a.h);
}

/** The size a picture can hang at on a wall: as asked, or shrunk to fit it, its shape kept; never under 1″ a side. */
function fitTo(size, wall) {
  const s = Math.min(1, wall.width / size.w, wall.height / size.h);
  return { w: round(size.w * s), h: round(size.h * s) };
}

/**
 * Hang pictures: `pictures` is a list of `{ asset, width }`, an asset id in
 * `p.assets` and the width in inches the artist typed. Each becomes a
 * placement pushed onto `p.art`, titled from its file name; one with no
 * image or no width is skipped. A picture keeps the width typed on any wall
 * that can take it; one too big for every wall is shrunk, its shape kept, to
 * the largest size a wall can take, and goes there. Neither side is ever
 * under an inch (schema 1's least), so a narrow panorama at a small width
 * grows to one inch high. The 200-placement limit is kept. Returns the
 * placements made.
 * @param {any} p
 * @param {{ asset: string, width: number }[]} pictures
 */
export function hangNew(p, pictures) {
  const walls = wallsInOrder(p);
  const placed = [];
  if (!walls.length) return placed;
  for (const pic of pictures) {
    if (p.art.length >= MAX_PLACEMENTS) break;
    const asset = p.assets[pic.asset];
    if (!asset || !(asset.width > 0) || !(asset.height > 0) || !(pic.width > 0)) continue;
    // As typed, then grown until neither side is under an inch.
    let size = { w: Math.min(pic.width, MAX_WIDTH), h: heightFor(asset, Math.min(pic.width, MAX_WIDTH)) };
    const grow = Math.max(1, 1 / size.w, 1 / size.h);
    size = { w: round(size.w * grow), h: round(size.h * grow) };
    // The walls it fits as asked; if none, the wall that takes it largest.
    const fits = (k) => fitTo(size, wallSpec(p, k));
    let candidates = walls.filter((k) => fits(k).w === size.w);
    if (!candidates.length) {
      const best = walls.reduce((a, k) => (fits(k).w > fits(a).w ? k : a), walls[0]);
      size = fits(best);
      candidates = walls.filter((k) => fitTo(size, wallSpec(p, k)).w === size.w);
    }
    if (size.w < 1 || size.h < 1) continue;
    const work = {
      id: uid(),
      title: (asset.name || "").replace(/\.[^.]+$/, "").slice(0, 120) || "Artwork",
      asset: pic.asset,
      face: "inside",
      w: size.w,
      h: size.h,
      thickness: 1.5,
      offset: 0.75,
    };
    const start = (wall) => {
      const spec = wallSpec(p, wall);
      // A work nearly as wide as its wall starts at its left end, not the usual gap in.
      return { ...work, wall, x: round(clamp(PLACEMENT_GAP, 0, spec.width - work.w)), y: round(clamp(HANG_LINE - work.h / 2, 0, spec.height - work.h)) };
    };
    // First every wall's hang line, then any row of any wall.
    let spot = null;
    for (const onLine of [true, false]) {
      for (const wall of candidates) {
        const s = start(wall);
        const c = openSpot(p, s);
        if (open(p, c) && (!onLine || c.y === s.y)) {
          spot = c;
          break;
        }
      }
      if (spot) break;
    }
    // Every wall full: on the first wall it fits anyway, as openSpot gives
    // up, rather than a picture that seems not to have arrived.
    spot ||= constrain(p, start(candidates[0]));
    p.art.push(spot);
    placed.push(spot);
  }
  return placed;
}
