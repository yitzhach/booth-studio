// Export framing: the shape of a delivered file, separate from its size.
//
// Both exports used to take their aspect ratio from the viewport — "height
// follows width, from the canvas" — which meant a PNG or an MP4 came out
// whatever shape the browser window happened to be that afternoon. A booth
// drawing that goes to a jury, a phone or Instagram has a shape it is
// expected in, and resizing a 2100 x 1160 file afterwards either letterboxes
// it or crops the booth out of it.
//
// So a frame is chosen, not inherited. "This window" is still here and is
// still the default, because someone who has composed a shot in the viewport
// means that shot; everything else states its ratio and the render is set up
// for it, camera included.
//
// Pure: nothing here touches the renderer or the DOM, which is what lets
// tests/framing.test.js check every preset's arithmetic in Node.

/**
 * The offered frames. `aspect` is width / height; `null` means "whatever the
 * viewport is", which is resolved at render time. `long` is the long edge in
 * pixels a preset is naturally delivered at — 1920 for a 16:9 desktop file,
 * 1080 for the vertical and square social frames, which is what those
 * platforms accept without re-encoding.
 */
export const FRAMES = {
  view: { label: "This window · current shape", aspect: null, long: 1920 },
  desktop: { label: "Desktop · widescreen 16:9", aspect: 16 / 9, long: 1920 },
  phone: { label: "Phone · vertical 9:16", aspect: 9 / 16, long: 1920 },
  square: { label: "Instagram · square 1:1", aspect: 1, long: 1080 },
  portrait: { label: "Instagram · portrait 4:5", aspect: 4 / 5, long: 1350 },
  custom: { label: "Custom size", aspect: null, long: 1920 },
};
export const DEFAULT_FRAME = "view";
// A clip starts in widescreen. "This window" was its default too, and was
// reported as "video export exports the same dimensions the preview window is
// at, not the preset size": a clip is nearly always delivered somewhere with
// a shape of its own. The frame guide shows the 16:9 over the viewport, so
// the window's shape no longer decides anything unless it is chosen.
export const DEFAULT_CLIP_FRAME = "desktop";
export const CUSTOM_FRAME = { width: 1920, height: 1080 };
/** The widest and narrowest a custom frame may be, per side, in pixels. */
export const FRAME_MIN = 64;
export const FRAME_MAX = 8192;

// `null` and `""` both become 0 through Number(), which is a finite number and
// would clamp to the minimum side — a 64px export nobody asked for. A missing
// value is missing, so it takes the default rather than the floor.
const clampSide = (n, fallback) => {
  if (n === null || n === undefined || n === "") return fallback;
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(FRAME_MIN, Math.min(FRAME_MAX, v)) : fallback;
};

/** An even number, because H.264 encodes in 16x16 macroblocks over even sides. */
export const even = (n) => Math.max(2, Math.round(n / 2) * 2);

/**
 * The pixel size of one exported frame.
 *
 * `long` is how big the file should be along its longer side — the existing
 * "2048 px wide" and "1080p" settings, generalised, so a vertical phone frame
 * at 1920 is 1080 x 1920 rather than 1920 x 3413. `viewport` is the aspect the
 * window happens to be, and is only consulted by the frames that say they
 * want it.
 *
 * Sides are forced even for both kinds of export: a PNG does not care, but
 * one function answering both is how the two cannot drift apart.
 */
export function frameSize(id, { long, viewport = 16 / 9, custom } = {}) {
  const frame = FRAMES[id] ? { id, ...FRAMES[id] } : { id: DEFAULT_FRAME, ...FRAMES[DEFAULT_FRAME] };
  if (frame.id === "custom") {
    const width = clampSide(custom?.width, CUSTOM_FRAME.width),
      height = clampSide(custom?.height, CUSTOM_FRAME.height);
    return { width: even(width), height: even(height), aspect: width / height, id: frame.id };
  }
  const aspect = frame.aspect ?? (Number.isFinite(viewport) && viewport > 0 ? viewport : 16 / 9);
  const side = Math.max(FRAME_MIN, Math.min(FRAME_MAX, Math.round(Number(long) || frame.long)));
  // The long edge is the one that gets the number asked for, so a 9:16 phone
  // frame at "1920" is 1920 tall. A square frame is both.
  const width = aspect >= 1 ? side : Math.round(side * aspect);
  const height = aspect >= 1 ? Math.round(side / aspect) : side;
  return { width: even(width), height: even(height), aspect, id: frame.id };
}

/** What the size select offers for a still. The long edge, in pixels. */
export const STILL_SIZES = [1080, 1440, 2048, 3072, 4096];
/** What the video size select offers. Keeps the old 720/1080/1440 numbers. */
export const CLIP_SIZES = [720, 1080, 1440];

/**
 * Where a frame of `aspect` sits inside a viewport of `width` x `height`
 * pixels: the largest rectangle of that shape that fits, centred. This is
 * the frame guide drawn over the viewport, and — rendered as a view offset of
 * the camera (scene.js `frameRect`) — the exact picture an export delivers, so what is inside the guide
 * is what is in the file. Reported as "if it's set at 16:9, I need to see
 * this aspect ratio in the preview so changes can be made before export".
 */
export function guideRect(width, height, aspect) {
  if (!(width > 0 && height > 0 && aspect > 0)) return { x: 0, y: 0, width: width || 0, height: height || 0 };
  const view = width / height;
  const w = aspect <= view ? height * aspect : width;
  const h = aspect <= view ? height : width / aspect;
  return { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h };
}

/**
 * Where the frame sits in the viewport, when it has been moved or resized by
 * hand: `scale` is its size as a share of the largest frame of its shape that
 * fits (1 is the whole fit, the default), and `x` / `y` run -1..1 across the
 * room left over on each axis (0 is centred, -1 the left or top edge). Stored
 * this way rather than in pixels so it survives a window resize: a frame
 * moved to the left third of the viewport stays in the left third.
 *
 * Asked for as "the export frame, with the option to manually drag or move
 * the export window or change the shape manually, with handles or sliders".
 */
export const DEFAULT_PLACE = { scale: 1, x: 0, y: 0 };
export const MIN_PLACE_SCALE = 0.2;
const clamp01 = (n, lo, hi, fallback) => (Number.isFinite(Number(n)) ? Math.max(lo, Math.min(hi, Number(n))) : fallback);
export const normalPlace = (place) => ({
  scale: clamp01(place?.scale, MIN_PLACE_SCALE, 1, 1),
  x: clamp01(place?.x, -1, 1, 0),
  y: clamp01(place?.y, -1, 1, 0),
});

/** The placed frame, in the viewport's own units. */
export function placeRect(width, height, aspect, place) {
  const { scale, x, y } = normalPlace(place);
  const fit = guideRect(width, height, aspect);
  const w = fit.width * scale,
    h = fit.height * scale;
  return { x: ((width - w) / 2) * (1 + x), y: ((height - h) / 2) * (1 + y), width: w, height: h };
}

/**
 * The inverse, for a frame dragged by its handles: the shape it now has and
 * the placement that reproduces it. The rectangle is clamped inside the
 * viewport first, so a handle dragged past the edge stops at it.
 */
export function placeFromRect(width, height, rect) {
  const w = Math.max(1, Math.min(width, rect.width)),
    h = Math.max(1, Math.min(height, rect.height));
  const left = Math.max(0, Math.min(width - w, rect.x)),
    top = Math.max(0, Math.min(height - h, rect.y));
  const aspect = w / h;
  const fit = guideRect(width, height, aspect);
  const slackX = width - w,
    slackY = height - h;
  return {
    aspect,
    place: normalPlace({
      scale: w / fit.width,
      x: slackX > 1e-6 ? (left * 2) / slackX - 1 : 0,
      y: slackY > 1e-6 ? (top * 2) / slackY - 1 : 0,
    }),
  };
}
