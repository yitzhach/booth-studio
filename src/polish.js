// Looks and "Make it beautiful": a good picture without touching a slider.
//
// The owner's ask was "easy to use, but super high quality results". The
// controls for a good booth picture all exist — the environment, the ambient
// light, each spotlight's aim, power and colour, the hang — but a first-time
// artist meets them as dozens of separate sliders. A look sets the ones that
// go together in one tap; "Make it beautiful" picks the look for the venue,
// hangs each wall evenly on the 60″ line and aims the spotlights at the work.
//
// Everything here writes fields a project already has, through the same
// rules the inspector follows, so a polished booth is an ordinary booth: every
// value stays editable, it saves and backs up as it always did, and main.js
// makes the whole thing one undo step. Pure — no DOM, no scene — so the
// arithmetic is pinned by node tests (tests/polish.test.js).
//
// What a look *looks* like on screen is the owner's to judge; no session can.
// The values are in this one table so that judgement is a one-line change.
import { constrain, groundKind, groundUpload, hallSpec, isArtShow, isShown, selectGround, uid, wallSpec } from "./model.js";
import { hangAt, sameWall, spaceEvenly } from "./arrange.js";
import { resolvePreset } from "./presets.js";

/**
 * Each look: the environment preset it stands in (which brings its floor and
 * horizon), the ambient level, and the colour and power of the booth's
 * spotlights. The art-show light bar keeps its own settings.
 */
export const LOOKS = {
  gallery: {
    label: "Gallery white",
    blurb: "Neutral studio light that keeps colour true: the jury-photo look.",
    envPreset: "studio",
    ambient: 1.25,
    kelvin: 4000,
    power: 80,
  },
  hall: {
    label: "Convention hall",
    blurb: "A bright white exhibition hall, as at an indoor show.",
    envPreset: "tradeshow",
    ambient: 1.15,
    kelvin: 3500,
    power: 90,
  },
  fair: {
    label: "Outdoor fair",
    blurb: "Daylight on grass under open sky, as at a summer art fair.",
    envPreset: "artfair",
    ambient: 1.35,
    kelvin: 5000,
    power: 70,
  },
  evening: {
    label: "Warm evening",
    blurb: "Lower room light and warm spots that make the work glow.",
    envPreset: "home",
    ambient: 0.8,
    kelvin: 3000,
    power: 120,
  },
};

/** The look a booth's venue suggests: a canopy outdoors is a fair. */
export const lookFor = (p) => (isArtShow(p) ? "gallery" : p.booth.tent ? "fair" : "gallery");

/**
 * Stand the booth in an environment preset, with the floor and horizon that
 * preset carries — the rule the Environment picker has always followed, kept
 * here so a look and the picker cannot drift apart. A chosen photograph of a
 * floor stays (the preset is remembered for when it is deleted), and an
 * art-show booth in a photographed environment leaves its white hall, whose
 * back wall would otherwise cut across the photograph. Returns whether that
 * hall was switched off, so the caller can say so.
 */
export function applyEnvPreset(p, id) {
  const preset = resolvePreset(id);
  p.booth.envPreset = preset.id;
  if (groundUpload(p)) p.booth.groundPreset = preset.ground;
  else selectGround(p, preset.ground);
  p.booth.horizon = preset.horizon;
  if (isArtShow(p) && preset.hdri && hallSpec(p.booth).on) {
    p.booth.hall = { ...hallSpec(p.booth), on: false };
    return { hallOff: true };
  }
  return { hallOff: false };
}

/** Apply a look. Unknown keys are ignored, so a stale button never throws. */
export function applyLook(p, key) {
  const look = LOOKS[key];
  if (!look) return null;
  const { hallOff } = applyEnvPreset(p, look.envPreset);
  p.ambient = look.ambient;
  for (const l of p.lights) {
    l.kelvin = look.kelvin;
    l.power = look.power;
  }
  return { look: key, hallOff };
}

/**
 * The look a booth is in: the one whose every value it still holds — the
 * environment with its floor and horizon (a photographed floor stays, as
 * applyEnvPreset leaves it), an art-show hall a photographed sky put out,
 * the room light, and every spotlight's colour and power — or null once any
 * of them is changed by hand. The inverse of applyLook: a field a look gains
 * there is checked here too. With no spotlights, a booth whose surroundings
 * and room light match is in the look, because applying it would change
 * nothing more.
 */
export function currentLook(p) {
  const env = resolvePreset(p.booth.envPreset);
  const lights = p.lights || [];
  for (const [key, look] of Object.entries(LOOKS)) {
    if (env.id !== look.envPreset || p.ambient !== look.ambient || (p.booth.horizon || "studio") !== env.horizon) continue;
    if ((groundUpload(p) ? p.booth.groundPreset : groundKind(p)) !== env.ground) continue;
    if (isArtShow(p) && env.hdri && hallSpec(p.booth).on) continue;
    if (lights.every((l) => l.kelvin === look.kelvin && l.power === look.power)) return key;
  }
  return null;
}

// Signs and labels are placed beside a particular work, so a wall carrying
// one is left as it hangs: spacing the works would leave a label behind.
const isWork = (a) => a.kind !== "sign" && a.kind !== "label";
const ownBooth = (a) => (a.booth || null) === null;

/**
 * Hang every wall of this booth evenly: the works on each face spaced with
 * equal gaps and their centres on the 60″ line. Neighbouring booths in a
 * row are someone else's hang and are left alone. Returns how many walls
 * were hung.
 */
export function evenHang(p) {
  const seen = new Set();
  let walls = 0;
  for (const a of p.art) {
    if (!ownBooth(a)) continue;
    const key = `${a.wall}|${a.face || "inside"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const wall = wallSpec(p, a.wall);
    if (!wall || wall.enabled === false) continue;
    const works = sameWall(p.art, a);
    if (!works.length || !works.every(isWork)) continue;
    const xs = spaceEvenly(works, wall);
    const ys = hangAt(works, wall);
    for (const w of works) Object.assign(w, constrain(p, { ...w, x: xs[w.id], y: ys[w.id] }));
    walls++;
  }
  return walls;
}

// Where a perimeter wall stands and which way its inside faces, in booth
// inches (x right, z toward the entrance, origin the floor's centre) — the
// frames scene.wallFrame builds: `at(u, v)` is the point `u` along the wall
// and `v` up it, `n` the inward normal.
function perimeter(p, wall) {
  const W = p.booth.width / 2,
    D = p.booth.depth / 2;
  if (wall === "back") return { at: (u, v) => [-W + u, v, -D], n: [0, 0, 1] };
  if (wall === "left") return { at: (u, v) => [-W, v, D - u], n: [1, 0, 0] };
  if (wall === "right") return { at: (u, v) => [W, v, -D + u], n: [-1, 0, 0] };
  return null;
}

// The most spotlights a booth may carry (validateProject's limit).
const MAX_LIGHTS = 4;
// How far into the booth a spotlight hangs from the wall it lights, inches.
const STANDOFF = 48;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (n) => Math.round(n * 10) / 10;

/** Split `list` into `k` runs of near-equal length, in order. */
function chunks(list, k) {
  const out = [];
  for (let i = 0; i < k; i++) out.push(list.slice(Math.round((i * list.length) / k), Math.round(((i + 1) * list.length) / k)));
  return out.filter((c) => c.length);
}

/**
 * Where the spotlights should point: the works hung inside the booth's three
 * perimeter walls, grouped into at most four targets. Each wall with work gets
 * one target, then the spare ones go to the walls with the most works per
 * target; a wall's works are split left to right. A target is the middle of
 * its group, on the wall's face. Free-standing panels and outside faces are
 * left to the hand: no fixed rule says which side of them a light belongs.
 */
export function lightTargets(p) {
  const byWall = new Map();
  for (const a of p.art) {
    if (!ownBooth(a) || !isWork(a) || !isShown(a) || (a.face || "inside") !== "inside") continue;
    const frame = perimeter(p, a.wall);
    if (!frame || wallSpec(p, a.wall)?.enabled === false) continue;
    if (!byWall.has(a.wall)) byWall.set(a.wall, []);
    byWall.get(a.wall).push(a);
  }
  if (!byWall.size) return [];
  const walls = [...byWall.entries()].map(([wall, works]) => ({ wall, works: works.sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2)), k: 1 }));
  walls.sort((a, b) => b.works.length - a.works.length);
  const slots = Math.min(MAX_LIGHTS, walls.reduce((n, w) => n + w.works.length, 0));
  // More walls with work than lights: the fullest walls get them.
  const lit = walls.slice(0, slots);
  for (let spare = slots - lit.length; spare > 0; spare--) {
    const next = lit.filter((w) => w.k < w.works.length).sort((a, b) => b.works.length / b.k - a.works.length / a.k)[0];
    if (!next) break;
    next.k++;
  }
  const out = [];
  for (const { wall, works, k } of lit) {
    const frame = perimeter(p, wall);
    for (const group of chunks(works, k)) {
      const u = (Math.min(...group.map((a) => a.x)) + Math.max(...group.map((a) => a.x + a.w))) / 2;
      const v = group.reduce((s, a) => s + a.y + a.h / 2, 0) / group.length;
      out.push({ wall, at: frame.at(u, v), n: frame.n, count: group.length });
    }
  }
  return out;
}

/**
 * Aim the spotlights at the work: one light per target from lightTargets,
 * hung STANDOFF inches into the booth in front of it, a little under the
 * booth's height, and kept inside the footprint. The lights already there
 * are reused in order (their id, colour, power and on/off kept); a booth
 * with fewer gets new ones like its first, and lights beyond the targets are
 * removed, because a light pointing at nothing reads as a mistake. One work
 * and two or more lights: two lights cross on it from either side. Nothing
 * hung, nothing changed. Returns how many lights were aimed.
 */
export function aimLights(p) {
  let targets = lightTargets(p);
  if (!targets.length) return 0;
  if (targets.length === 1 && p.lights.length >= 2) targets = [targets[0], targets[0]];
  const W = p.booth.width / 2 - 6,
    D = p.booth.depth / 2 - 6;
  const height = clamp((p.booth.height || 96) - 5, 60, 150);
  const like = p.lights[0] || { power: 75, kelvin: 4000 };
  const lights = targets.map((t, i) => {
    const [tx, ty, tz] = t.at;
    // Two lights on one work stand apart along the wall and cross on it.
    const along = targets.length === 2 && targets[0] === targets[1] ? (i ? 24 : -24) : 0;
    const side = [t.n[2], 0, -t.n[0]];
    const x = clamp(tx + t.n[0] * STANDOFF + side[0] * along, -W, W);
    const z = clamp(tz + t.n[2] * STANDOFF + side[2] * along, -D, D);
    const old = p.lights[i];
    return {
      ...(old || { id: uid(), power: like.power, kelvin: like.kelvin }),
      x: round(x),
      y: round(height),
      z: round(z),
      // A hair in front of the face, so the beam's centre is on the work.
      tx: round(tx + t.n[0]),
      ty: round(clamp(ty, 0, 160)),
      tz: round(tz + t.n[2]),
    };
  });
  p.lights = lights;
  return lights.length;
}

/**
 * Make it beautiful: the venue's look (or `look`), every wall hung evenly,
 * the spotlights aimed at what is now hanging. Returns what it did, for the
 * toast.
 */
export function polish(p, { look = lookFor(p) } = {}) {
  const walls = evenHang(p);
  const lights = aimLights(p);
  // The look last, so a spotlight aimLights had to add takes its colour and
  // power like the rest.
  const applied = applyLook(p, look) || applyLook(p, lookFor(p));
  return { look: applied.look, hallOff: applied.hallOff, walls, lights };
}

// The hero set: the handful of pictures a booth is shown by — a jury
// application, a promoter's page, a post — rendered in one press. Poses are
// in metres, the camera's own units, with the floor's centre at the origin
// and +z toward the entrance, as `scene.pose()` reports them.
const M = 0.0254;
// The camera's vertical field of view (scene.js FOV), and how much room is
// left round the booth when it is fitted to the frame.
const FOV = 62;
const MARGIN = 1.25;
// A standing eye, a little under the 60″ hang line's own height.
const EYE = 1.6;

const r3 = (v) => v.map((n) => Math.round(n * 1000) / 1000);
const pose = (position, target) => ({ position: r3(position), target: r3(target) });

/**
 * The hero stills: Front (the whole booth, square on), Three-quarter (from
 * the front right, looking across into the far corner), Aisle (what a
 * visitor sees close up, walking past on the left), and Close-up (the wall
 * with the most work, filling the frame) when anything hangs.
 *
 * Every camera stands in front of the booth's open side: its side walls run
 * the full depth, so a camera off to the side sees only the back of one.
 * The export cuts a 16:9 frame out of the viewport (scene.js frameRect), so
 * what fits depends on the viewport's shape, `aspect` (width / height): the
 * field of view is the camera's vertical one, narrowed to the cut.
 */
export function heroShots(p, { aspect = 16 / 9 } = {}) {
  const W = p.booth.width * M,
    D = p.booth.depth * M,
    H = Math.max(p.booth.height || 96, ...["back", "left", "right"].map((k) => p.booth.walls[k]?.height || 0)) * M;
  const wide = 16 / 9,
    t = Math.tan(((FOV / 2) * Math.PI) / 180);
  // Half-angles of the 16:9 cut, as tangents: across, then up.
  const across = aspect >= wide ? t * wide : t * aspect;
  const up = across / wide;
  const fit = (w, h) => MARGIN * Math.max(w / 2 / across, h / 2 / up);
  const front = D / 2;
  const shots = [
    { name: "Front", pose: pose([0, EYE, front + fit(W, H)], [0, Math.min(H / 2, 1.3), -D / 6]) },
    { name: "Three-quarter", pose: pose([W * 0.3, EYE + 0.15, front + fit(W, H) * 0.9], [-W * 0.1, 1.2, -D / 4]) },
    { name: "Aisle", pose: pose([-W * 0.35, EYE, front + 1], [W * 0.2, 1.3, -D / 3]) },
  ];
  // The wall with the most work, square on, the whole wall in frame.
  const counts = { back: 0, left: 0, right: 0 };
  for (const a of p.art)
    if (ownBooth(a) && isWork(a) && isShown(a) && (a.face || "inside") === "inside" && a.wall in counts && wallSpec(p, a.wall)?.enabled !== false) counts[a.wall]++;
  const [wall, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (n) {
    const spec = wallSpec(p, wall);
    const works = p.art.filter((a) => a.wall === wall && ownBooth(a) && isWork(a) && (a.face || "inside") === "inside");
    const v = works.reduce((s, a) => s + a.y + a.h / 2, 0) / works.length;
    const { at, n: normal } = perimeter(p, wall);
    const [tx, ty, tz] = at(spec.width / 2, v).map((x) => x * M);
    // Never further back than the booth is deep, across that wall.
    const room = (wall === "back" ? D : W) * 0.95;
    const back = Math.min(Math.max(fit(spec.width * M, spec.height * M * 0.7), 1.2), room);
    shots.push({ name: "Close-up", pose: pose([tx + normal[0] * back, Math.max(ty, 1.2), tz + normal[2] * back], [tx, ty, tz]) });
  }
  return shots;
}

/** The hero clip: a slow 15 s orbit, the move every booth reel opens with. */
export const HERO_CLIP = { move: "orbit", seconds: 15 };
