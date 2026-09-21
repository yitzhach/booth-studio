// The shadow a hung work throws onto the wall behind it.
//
// Two things asked for the same mechanism. The first is a drop shadow with
// controls — darker or lighter, further or closer, softer or harder. The
// second is the wall gap: artwork stood off the wall on a batten, which was
// only visible if you put your eye along the wall and looked down it, because
// nothing in the picture said the work was floating. A gap you cannot see is
// a measurement nobody can check.
//
// A real spotlight does cast that shadow, but only when a spotlight happens to
// be aimed across the work, and it is gone the moment the light bar is
// diffused into a wash — which is exactly the lighting an art-show booth is
// composed in. So the shadow here is drawn, not lit: a soft dark card on the
// wall behind each work, sized from the work's own wall gap and shaped by
// three sliders. It is scenery in the same sense the light bar's housings are
// scenery, and it is in every export, because it is part of the drawing.
//
// Pure. Nothing here builds a texture or touches three — scene.js does that
// from the plan these functions return, and tests/dropshadow.test.js checks
// the arithmetic in Node.

/**
 * The defaults, all 0..100 so the sliders read as percentages of "as much as
 * this is willing to do". `darkness` 40 was chosen against a 0.75″ wall gap —
 * the gap the sample panels ship with — as the point where the gap is plainly
 * visible head-on without the work looking like it is hovering.
 */
export const DROP_SHADOW = {
  on: true,
  darkness: 40,
  distance: 45,
  softness: 55,
};
/** A work with no wall gap at all still gets this much throw, in inches. */
const MIN_GAP = 0.35;
/** The deepest gap that still makes the shadow grow, in inches. */
const MAX_GAP = 6;

const pct = (n, fallback) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : fallback;
};

/** A booth's drop-shadow settings, with every absent field at its default. */
export const dropShadowSpec = (booth = {}) => {
  const s = booth.dropShadow || {};
  return {
    on: s.on === undefined ? DROP_SHADOW.on : !!s.on,
    darkness: pct(s.darkness, DROP_SHADOW.darkness),
    distance: pct(s.distance, DROP_SHADOW.distance),
    softness: pct(s.softness, DROP_SHADOW.softness),
  };
};

/**
 * Where one work's shadow falls and what it looks like.
 *
 * Everything is in inches, in the wall's own frame, relative to the centre of
 * the work: `dx` right, `dy` up. The light is treated as coming from above and
 * slightly in front — which is where a booth's spotlights and an art-show
 * light bar both are — so the shadow drops and spreads sideways rather than
 * rising.
 *
 * `inset` is how much of the plane, as a fraction of its own side, is the soft
 * margin around the work-sized core. scene.js turns that pair into a canvas;
 * quantising it is what keeps a booth of twenty works from building twenty
 * textures.
 */
export function shadowPlan(spec, art) {
  const on = spec.on && spec.darkness > 0;
  const w = Math.max(0.25, Number(art.w) || 0),
    h = Math.max(0.25, Number(art.h) || 0);
  // The wall gap is the whole reason a work has a shadow to throw, so it sets
  // the scale of one. Clamped at both ends: a flush work still reads as an
  // object on a wall, and a 12″ stand-off is a sculpture, not a print.
  const gap = Math.max(MIN_GAP, Math.min(MAX_GAP, (Number(art.offset) || 0) + MIN_GAP));
  const distance = spec.distance / 100,
    softness = spec.softness / 100;
  // How far the shadow is thrown. At 0 it is a contact shadow hugging the
  // frame; at 100 it is thrown about two and a half times the gap, which is a
  // low raking light.
  const throwIn = gap * (0.35 + 2.15 * distance);
  const dy = -throwIn;
  const dx = throwIn * 0.45;
  // How far it is smeared. Hard at 0 — a crisp edge, as a bare source gives —
  // and at 100 a penumbra wider than the gap itself.
  const blurIn = 0.12 + gap * (0.15 + 2.4 * softness);
  // The plane has to hold the work, the throw and the whole penumbra, or the
  // shadow is cut off square where the texture runs out.
  const padX = Math.abs(dx) + blurIn * 1.6,
    padY = Math.abs(dy) + blurIn * 1.6;
  const planeW = w + padX * 2,
    planeH = h + padY * 2;
  // Spread softens as it widens, the way a real penumbra does: the same light
  // over a larger area.
  const spread = Math.min(1, blurIn / (Math.min(w, h) * 0.5 + blurIn));
  const opacity = (spec.darkness / 100) * 0.85 * (1 - spread * 0.35);
  return {
    on,
    dx,
    dy,
    width: planeW,
    height: planeH,
    // Quantised to 2% so near-identical works share one canvas, and never to
    // zero: a margin rounded away is a shadow that reaches the edge of its
    // own texture, which reads as a second hard rectangle on the wall.
    insetX: Math.max(0.02, Math.round((padX / planeW) * 50) / 50),
    insetY: Math.max(0.02, Math.round((padY / planeH) * 50) / 50),
    blur: Math.round(Math.min(0.49, (blurIn * 1.6) / Math.min(planeW, planeH)) * 50) / 50,
    opacity: Math.round(opacity * 1000) / 1000,
  };
}

/** The cache key for the canvas a plan wants. Shape only — never its size. */
export const shadowKey = (plan) => `${plan.insetX}:${plan.insetY}:${plan.blur}`;
