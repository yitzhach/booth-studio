// Custom camera timelines: keyframes, ramping, holds and fades.
//
// A timeline is the user's own camera move, built by composing a shot in the
// viewport and pressing Add keyframe. Everything here is pure arithmetic — no
// three.js, no DOM, no renderer — for the same reason src/camera-path.js is:
// tests/timeline.test.js covers every property in Node without a GPU, and the
// recorder can sample a timeline without a live scene.
//
// The contract is the one the four fixed moves already satisfy:
//
//   sample(timeline, t)  ->  { position, target }     t in 0..1
//
// which is what src/video.js renders through. A timeline is a different
// implementation of that function and nothing below the sampler changes.
//
// Keys hold absolute world poses, not offsets from the current framing. That is
// the opposite of a fixed move, deliberately: a fixed move is a gesture applied
// to whatever you are looking at, while a keyframe is a shot someone composed
// and wants back exactly.
// Only the geometry is shared with camera-path.js, and only at call time:
// camera-path imports this module back, so anything used while this one is
// still evaluating — the easing table below — has to be defined here.
import { toSpherical, fromSpherical } from "./camera-path.js";
import { resolveFlareSource, DEFAULT_FLARE_SOURCE } from "./flare.js";

// 6t^5 - 15t^4 + 10t^3, the same curve the fixed moves ease with: zero velocity
// and zero acceleration at both ends, so a keyframe is a pose the camera
// arrives at rather than one it hits.
const smootherstep = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export const MIN_KEYS = 2;
export const MAX_KEYS = 12;
export const MIN_SECONDS = 2;
export const MAX_SECONDS = 60;
export const DEFAULT_SECONDS = 12;
// Orbit's own limits, restated here rather than imported as private state; see
// the same constants in camera-path.js for why a move must not drive the
// camera through the floor or the up-vector flip.
const MIN_PHI = 0.08;
const MAX_PHI = Math.PI * 0.82;
const MIN_GROUND_Y = 0.12;
const TAU = Math.PI * 2;

// Per-segment ramping. The ramp is what makes a keyframed clip read as a camera
// rather than a scrubbed viewport, so it is a choice per segment rather than
// one setting for the clip.
export const EASES = {
  smooth: { label: "Ease in and out", fn: smootherstep },
  in: { label: "Ease in · start slow", fn: (t) => t * t },
  out: { label: "Ease out · settle", fn: (t) => 1 - (1 - t) * (1 - t) },
  linear: { label: "Linear · constant", fn: (t) => t },
};
export const DEFAULT_EASE = "smooth";

// How the camera moves through its keyframes as a whole. "keys" is what a
// timeline always did: each segment ramps on its own, so with the default
// ease the camera comes to rest on every keyframe. "glide" is one continuous
// move — it eases in at the start, travels at a steady speed through every
// keyframe without stopping, and eases out at the end — which is how a
// camera on a slider or a gimbal reads, and what makes a multi-key clip look
// shot rather than stepped. A hold still stops the camera; the glide then
// eases out into the hold and back in after it, as a camera operator would.
export const FLOWS = {
  keys: { label: "Ease at every keyframe" },
  glide: { label: "One continuous glide" },
};
export const DEFAULT_FLOW = "keys";
// The fraction of a glide spent speeding up, and again slowing down.
export const GLIDE_RAMP = 0.2;
/**
 * A glide's progress: constant acceleration for the first GLIDE_RAMP of the
 * run, constant speed through the middle, constant deceleration at the end.
 * Continuous in position and speed, and its peak speed is only 1.25x the
 * average — smootherstep's is 1.875x, which is why a long move eased with it
 * rushes through its middle.
 */
export function glideEase(u, ramp = GLIDE_RAMP) {
  const x = Math.min(1, Math.max(0, u));
  const v = 1 / (1 - ramp);
  if (x < ramp) return (v * x * x) / (2 * ramp);
  if (x > 1 - ramp) return 1 - (v * (1 - x) * (1 - x)) / (2 * ramp);
  return v * (x - ramp / 2);
}
export const easeFn = (id) => (EASES[id] || EASES[DEFAULT_EASE]).fn;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+n) ? +n : lo));
const lerp = (a, b, t) => a + (b - a) * t;
const vec3 = (v, fallback = [0, 0, 0]) =>
  Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(+n)) ? v.map(Number) : [...fallback];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
// Shortest way round. Interpolating azimuth naively sends a camera the long way
// round the booth whenever a segment crosses the -pi/pi seam, which on a
// 12-second clip is a full extra lap.
const shortestAngle = (from, to) => {
  let delta = (to - from) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return delta;
};

let counter = 0;
export const keyId = () => `k${Date.now().toString(36)}${(counter++).toString(36)}`;

/** A key captured from a live camera. `t` is filled in by the caller or by normalise. */
export const keyFrom = (position, target, t = 0) => ({
  id: keyId(),
  t: clamp(t, 0, 1),
  hold: 0,
  ease: DEFAULT_EASE,
  position: vec3(position),
  target: vec3(target),
});

export const emptyTimeline = (position, target) => ({
  version: 1,
  seconds: DEFAULT_SECONDS,
  keys: [keyFrom(position, target, 0), keyFrom(position, target, 1)],
  fade: { in: 0, out: 0 },
  flare: { on: false, strength: 0.6, source: DEFAULT_FLARE_SOURCE },
});

/**
 * Makes any input safe to sample.
 *
 * Times are sorted and forced strictly ascending, the first key is pinned to 0
 * and the last to 1, and fewer than two keys is padded by duplicating what
 * there is. A sampler that has to defend itself against unordered or duplicate
 * times would carry that defence into every frame of every clip; doing it once
 * here means sample() can be arithmetic.
 */
export function normalizeTimeline(raw, fallbackPose) {
  const pose = fallbackPose || { position: [0, 1.5, 4], target: [0, 1.2, 0] };
  const source = Array.isArray(raw?.keys) ? raw.keys : [];
  let keys = source
    .map((k) => ({
      id: k?.id || keyId(),
      t: clamp(k?.t, 0, 1),
      hold: clamp(k?.hold ?? 0, 0, 10),
      ease: EASES[k?.ease] ? k.ease : DEFAULT_EASE,
      position: vec3(k?.position, pose.position),
      target: vec3(k?.target, pose.target),
    }))
    .slice(0, MAX_KEYS)
    .sort((a, b) => a.t - b.t);
  while (keys.length < MIN_KEYS)
    keys.push(keys.length ? { ...keys.at(-1), id: keyId() } : keyFrom(pose.position, pose.target));
  keys[0].t = 0;
  keys.at(-1).t = 1;
  // Strictly ascending. Two keys at the same time are a zero-length segment and
  // a division by zero one frame later; nudging the later one is kinder than
  // dropping a pose someone captured on purpose.
  const epsilon = 1 / 1000;
  for (let i = 1; i < keys.length - 1; i++) keys[i].t = Math.max(keys[i].t, keys[i - 1].t + epsilon);
  for (let i = keys.length - 2; i > 0; i--) keys[i].t = Math.min(keys[i].t, keys[i + 1].t - epsilon);
  const seconds = clamp(raw?.seconds ?? DEFAULT_SECONDS, MIN_SECONDS, MAX_SECONDS);
  // A fade cannot outlast the clip, and two fades cannot overlap: a frame that
  // is both fading in and out has no defensible brightness.
  const fadeIn = clamp(raw?.fade?.in ?? 0, 0, seconds / 2);
  const fadeOut = clamp(raw?.fade?.out ?? 0, 0, seconds / 2);
  return {
    version: 1,
    seconds,
    keys,
    flow: FLOWS[raw?.flow] ? raw.flow : DEFAULT_FLOW,
    fade: { in: fadeIn, out: fadeOut },
    flare: {
      on: !!raw?.flare?.on,
      strength: clamp(raw?.flare?.strength ?? 0.6, 0, 1),
      // Which light it comes from. The overhead one is imaginary and always
      // available; a spotlight is real and may not exist.
      source: resolveFlareSource(raw?.flare?.source),
    },
  };
}

export const isTimeline = (value) => !!value && typeof value === "object" && Array.isArray(value.keys);

/**
 * Where a hold sits inside the clip. A key with a hold pauses on its pose, so
 * the clip's time is longer than the sum of its segments — the holds are taken
 * out of the timeline's own 0..1 before the segments are walked, which is why
 * a hold slows nothing down: it stops.
 */
function holdWindows(keys) {
  const total = keys.reduce((sum, k) => sum + (k.hold || 0), 0);
  return { total, keys };
}

/**
 * One frame of a timeline.
 *
 * `t` is clip time in 0..1 including any holds. Returns a camera position and a
 * look-at target, clamped to stay above the floor exactly as samplePath does.
 */
export function sampleTimeline(timeline, t) {
  const tl = isTimeline(timeline) && timeline.version === 1 ? timeline : normalizeTimeline(timeline);
  const keys = tl.keys;
  const clipSeconds = Math.max(0.001, tl.seconds);
  const { total: heldSeconds } = holdWindows(keys);
  // Holds are wall time the camera does not move, so they are removed from the
  // clip before the motion is placed in what is left. With no holds this is the
  // identity and a timeline is exactly its keys' own times.
  const moving = Math.max(0.001, clipSeconds - heldSeconds);
  const now = clamp(t, 0, 1) * clipSeconds;
  if (tl.flow === "glide") return sampleGlide(keys, now, moving);

  let elapsed = 0;
  let index = keys.length - 2;
  let local = 1;
  outer: for (let i = 0; i < keys.length; i++) {
    const hold = keys[i].hold || 0;
    if (hold > 0) {
      if (now <= elapsed + hold) {
        index = Math.min(i, keys.length - 2);
        local = i >= keys.length - 1 ? 1 : 0;
        break outer;
      }
      elapsed += hold;
    }
    if (i >= keys.length - 1) break;
    const span = (keys[i + 1].t - keys[i].t) * moving;
    if (now <= elapsed + span || i === keys.length - 2) {
      index = i;
      local = span > 0 ? clamp((now - elapsed) / span, 0, 1) : 1;
      break outer;
    }
    elapsed += span;
  }
  return poseBetween(keys[index], keys[index + 1], easeFn(keys[index].ease)(local));
}

/**
 * A glide's pose at `now` clip seconds. The clip is cut into runs at every
 * held keyframe (and at the two ends); each run is eased as one move by
 * `glideEase`, and inside it the segments are walked linearly in time, so the
 * camera passes through a middle keyframe at speed instead of stopping.
 */
function sampleGlide(keys, now, moving) {
  const n = keys.length;
  const arrive = [],
    leave = [];
  let before = 0;
  for (const k of keys) {
    arrive.push(k.t * moving + before);
    before += k.hold || 0;
    leave.push(arrive.at(-1) + (k.hold || 0));
  }
  for (let i = 0; i < n; i++) if (now >= arrive[i] && now <= leave[i]) return poseBetween(keys[i], keys[Math.min(i + 1, n - 1)], 0);
  let seg = n - 2;
  for (let i = 0; i < n - 1; i++)
    if (now <= arrive[i + 1]) {
      seg = i;
      break;
    }
  let a = seg,
    b = seg;
  while (a > 0 && !(keys[a].hold > 0)) a--;
  while (b < n - 2 && !(keys[b + 1].hold > 0)) b++;
  const start = leave[a],
    end = arrive[b + 1];
  const u = end > start ? (now - start) / (end - start) : 1;
  const at = start + glideEase(u) * (end - start);
  let j = b;
  for (let i = a; i <= b; i++)
    if (at <= arrive[i + 1]) {
      j = i;
      break;
    }
  const span = arrive[j + 1] - leave[j];
  return poseBetween(keys[j], keys[j + 1], span > 0 ? clamp((at - leave[j]) / span, 0, 1) : 1);
}

/**
 * Auto timing: spaces the middle keyframes so the camera travels at an even
 * speed through the whole clip — each segment gets time in proportion to how
 * far the camera goes in it, the orbit's own curve included, plus how far
 * its aim swings, so a pan on the spot is not given no time at all. The two
 * ends stay pinned, holds are kept, the length is kept. With a glide this is
 * the smooth, steady move a motion-control rig makes.
 */
export function autoTime(timeline) {
  const tl = normalizeTimeline(timeline);
  const lengths = [];
  for (let i = 0; i < tl.keys.length - 1; i++) {
    let length = 0;
    let prev = poseBetween(tl.keys[i], tl.keys[i + 1], 0);
    for (let s = 1; s <= 24; s++) {
      const next = poseBetween(tl.keys[i], tl.keys[i + 1], s / 24);
      length += Math.hypot(...sub(next.position, prev.position)) + 0.5 * Math.hypot(...sub(next.target, prev.target));
      prev = next;
    }
    lengths.push(length);
  }
  const total = lengths.reduce((sum, l) => sum + l, 0);
  if (!(total > 1e-6)) return tl;
  let run = 0;
  const keys = tl.keys.map((k, i) => {
    const t = i === 0 ? 0 : (run += lengths[i - 1]) / total;
    return { ...k, t };
  });
  return normalizeTimeline({ ...tl, keys });
}

/**
 * Interpolates two poses in the spherical frame of the segment's own target.
 *
 * A straight line between two poses on opposite sides of the booth goes through
 * the tent. Orbiting — radius, azimuth the short way round, polar angle — is
 * what the four fixed moves do and what a camera operator would do.
 */
export function poseBetween(from, to, e) {
  const target = [lerp(from.target[0], to.target[0], e), lerp(from.target[1], to.target[1], e), lerp(from.target[2], to.target[2], e)];
  const a = toSpherical(sub(from.position, from.target));
  const b = toSpherical(sub(to.position, to.target));
  const radius = Math.max(0.3, lerp(Math.max(a.radius, 0.0001), Math.max(b.radius, 0.0001), e));
  const theta = a.theta + shortestAngle(a.theta, b.theta) * e;
  const phi = Math.min(MAX_PHI, Math.max(MIN_PHI, lerp(a.phi, b.phi, e)));
  const position = add(target, fromSpherical({ radius, theta, phi }));
  // Clamping phi bounds the angle, not the height: a wide radius at a legal
  // angle can still put the eye under the floor. Lift the pair, so the segment
  // keeps its shape instead of lurching.
  if (position[1] < MIN_GROUND_Y) {
    const rise = MIN_GROUND_Y - position[1];
    position[1] += rise;
    target[1] += rise;
  }
  return { position, target };
}

/**
 * Brightness of a frame, 0 (black) to 1 (the render as lit).
 *
 * Linear in time on purpose: an eased fade reads as a light being dimmed, and a
 * fade to black is a cut being made.
 */
export function fadeAt(timeline, t) {
  const tl = isTimeline(timeline) && timeline.version === 1 ? timeline : normalizeTimeline(timeline);
  const seconds = Math.max(0.001, tl.seconds);
  const now = clamp(t, 0, 1) * seconds;
  const rising = tl.fade.in > 0 ? clamp(now / tl.fade.in, 0, 1) : 1;
  const falling = tl.fade.out > 0 ? clamp((seconds - now) / tl.fade.out, 0, 1) : 1;
  return Math.min(rising, falling);
}

/**
 * How fast the camera travels through one segment, in metres per second — the
 * read-out that lets someone set "speed" by moving a keyframe in time, without
 * a multiplier that could contradict the clip's own length.
 */
export function segmentSpeed(timeline, index) {
  const tl = isTimeline(timeline) && timeline.version === 1 ? timeline : normalizeTimeline(timeline);
  const from = tl.keys[index];
  const to = tl.keys[index + 1];
  if (!from || !to) return 0;
  const heldSeconds = tl.keys.reduce((sum, k) => sum + (k.hold || 0), 0);
  const moving = Math.max(0.001, tl.seconds - heldSeconds);
  const span = (to.t - from.t) * moving;
  const distance = Math.hypot(...sub(to.position, from.position));
  return span > 0 ? distance / span : 0;
}

/** Total clip length including holds — what the export panel and the frame count use. */
export const timelineSeconds = (timeline) =>
  clamp(normalizeTimeline(timeline).seconds, MIN_SECONDS, MAX_SECONDS);

/**
 * Where each key sits in clip seconds, holds included: `arrive` is when the
 * camera reaches the key's pose and `leave` when it sets off again, which is
 * `arrive` plus the key's hold. The visual timeline draws from this, so a key
 * on the track is exactly where the recorder will put it.
 */
export function keySchedule(timeline) {
  const tl = normalizeTimeline(timeline);
  const held = tl.keys.reduce((sum, k) => sum + (k.hold || 0), 0);
  const moving = Math.max(0.001, tl.seconds - held);
  let before = 0;
  return tl.keys.map((k) => {
    const arrive = k.t * moving + before;
    before += k.hold || 0;
    return { id: k.id, arrive, leave: arrive + (k.hold || 0) };
  });
}

/**
 * The inverse, for dragging a key along the track or typing its time: the `t`
 * that makes key `index` arrive at `seconds` of clip time. The first and last
 * keys are pinned by `normalizeTimeline` whatever this returns.
 */
export function keyTAt(timeline, index, seconds) {
  const tl = normalizeTimeline(timeline);
  const held = tl.keys.reduce((sum, k) => sum + (k.hold || 0), 0);
  const moving = Math.max(0.001, tl.seconds - held);
  const before = tl.keys.slice(0, Math.max(0, index)).reduce((sum, k) => sum + (k.hold || 0), 0);
  return clamp((seconds - before) / moving, 0, 1);
}
