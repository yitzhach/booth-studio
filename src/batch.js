// The batch export queue: clips and stills rendered in one go.
//
// Asked for as "a batch export function — if you want a bunch of video or
// image exports — and you can either add each one individually, or save a
// timeline preset that can be copied across a bunch of export files, or you
// create a general export setting, and tweak each one in the batch queue".
// Those are three ways into one list, so they are one shape here:
//
// - **General settings** (`kit.defaults`): the frame rate, sizes, frame and
//   its placement every job uses unless it says otherwise.
// - **A job** names what it renders — a clip (a fixed move, its own frozen
//   timeline, or a preset) or a still (a camera pose) — and carries `set`,
//   only the settings it overrides. A job added with "current settings"
//   overrides all of them, which is the old batch list exactly: frozen as
//   queued. A job added "with the general settings" overrides none, and
//   follows the general settings until one of its own is tweaked.
// - **A timeline preset** is a named, saved timeline. A clip that uses one
//   links to it rather than copying it, so the same move rendered as a 16:9,
//   a 9:16 and a square follows every later edit of the preset.
//
// It is saved with the booth, as the optional `p.exportKit`, so the queue
// and the presets survive a reload (autosave keeps the project on this
// browser) and travel in a backup. Every backup written before it simply has
// none. Pure: no DOM, no renderer, so tests/batch.test.js pins it in Node.
import { normalizeTimeline, isTimeline, MAX_KEYS } from "./timeline.js";
import { FRAMES, DEFAULT_CLIP_FRAME, CUSTOM_FRAME, FRAME_MIN, FRAME_MAX, STILL_SIZES, normalPlace, DEFAULT_PLACE } from "./framing.js";

export const MAX_JOBS = 60;
export const MAX_PRESETS = 24;
export const CLIP_SIZE_IDS = [720, 1080, 1440];
export const CLIP_FPS = [24, 30, 60];
export const CUSTOM = "custom";

/** Every setting a job can take from the general settings, or override. */
export const SETTING_KEYS = ["fps", "size", "long", "frame", "custom", "place", "settle"];

export const DEFAULT_SETTINGS = {
  fps: 30,
  size: 1080,
  long: 4096,
  frame: DEFAULT_CLIP_FRAME,
  custom: { ...CUSTOM_FRAME },
  place: { ...DEFAULT_PLACE },
  settle: true,
};

const side = (n, fallback) => (Number.isFinite(Number(n)) ? Math.max(FRAME_MIN, Math.min(FRAME_MAX, Math.round(Number(n)))) : fallback);
const str = (v, max) => typeof v === "string" && v.length <= max;
const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n) && Math.abs(n) < 1000);

/** One setting made safe, or undefined when it is not one this version knows. */
function cleanSetting(key, v) {
  if (v === undefined) return undefined;
  if (key === "fps") return CLIP_FPS.includes(Number(v)) ? Number(v) : undefined;
  if (key === "size") return CLIP_SIZE_IDS.includes(Number(v)) ? Number(v) : undefined;
  if (key === "long") return STILL_SIZES.includes(Number(v)) ? Number(v) : undefined;
  if (key === "frame") return FRAMES[v] ? v : undefined;
  if (key === "custom") return v && typeof v === "object" ? { width: side(v.width, CUSTOM_FRAME.width), height: side(v.height, CUSTOM_FRAME.height) } : undefined;
  if (key === "place") return v && typeof v === "object" ? normalPlace(v) : undefined;
  if (key === "settle") return typeof v === "boolean" ? v : undefined;
  return undefined;
}

/** Only the known settings, each cleaned; anything else is dropped. */
export function cleanSettings(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const key of SETTING_KEYS) {
    const v = cleanSetting(key, raw[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
}

/** A kit that is safe to read, whatever was stored. */
export function normalKit(raw) {
  const kit = raw && typeof raw === "object" ? raw : {};
  const presets = (Array.isArray(kit.presets) ? kit.presets : [])
    .filter((x) => x && typeof x.id === "string" && isTimeline(x.timeline))
    .slice(0, MAX_PRESETS)
    .map((x) => ({ id: x.id, name: str(x.name, 120) ? x.name : "Preset", timeline: normalizeTimeline(x.timeline) }));
  const ids = new Set(presets.map((x) => x.id));
  const queue = (Array.isArray(kit.queue) ? kit.queue : [])
    .filter((j) => j && typeof j.id === "string" && (j.kind === "clip" || j.kind === "still"))
    .slice(0, MAX_JOBS)
    .map((j) => {
      const job = { id: j.id, kind: j.kind, set: cleanSettings(j.set) };
      if (str(j.name, 120) && j.name) job.name = j.name;
      if (j.kind === "still") {
        job.pose = vec3(j.pose?.position) && vec3(j.pose?.target) ? { position: [...j.pose.position], target: [...j.pose.target] } : null;
      } else {
        job.move = typeof j.move === "string" ? j.move : CUSTOM;
        job.seconds = Number.isFinite(Number(j.seconds)) ? Math.max(2, Math.min(60, Number(j.seconds))) : 12;
        // A preset that has since been deleted leaves the clip its own copy
        // (below) rather than a link to nothing.
        if (typeof j.preset === "string" && ids.has(j.preset)) job.preset = j.preset;
        if (isTimeline(j.timeline)) job.timeline = normalizeTimeline(j.timeline);
      }
      return job;
    });
  return { defaults: { ...DEFAULT_SETTINGS, ...cleanSettings(kit.defaults) }, presets, queue };
}

/** Whether a stored kit is one this version can open: the backup validator. */
export function validKit(kit) {
  if (kit === undefined) return true;
  if (!kit || typeof kit !== "object") return false;
  if (kit.defaults !== undefined && (typeof kit.defaults !== "object" || !kit.defaults)) return false;
  if (kit.presets !== undefined) {
    if (!Array.isArray(kit.presets) || kit.presets.length > MAX_PRESETS) return false;
    const ids = new Set();
    for (const x of kit.presets) {
      if (!x || !str(x.id, 200) || !x.id || ids.has(x.id) || !str(x.name, 120)) return false;
      if (!isTimeline(x.timeline) || x.timeline.keys.length > MAX_KEYS) return false;
      ids.add(x.id);
    }
  }
  if (kit.queue !== undefined) {
    if (!Array.isArray(kit.queue) || kit.queue.length > MAX_JOBS) return false;
    const ids = new Set();
    for (const j of kit.queue) {
      if (!j || !str(j.id, 200) || !j.id || ids.has(j.id)) return false;
      if (j.kind !== "clip" && j.kind !== "still") return false;
      if (j.name !== undefined && !str(j.name, 120)) return false;
      if (j.set !== undefined && (typeof j.set !== "object" || !j.set)) return false;
      if (j.timeline !== undefined && (!isTimeline(j.timeline) || j.timeline.keys.length > MAX_KEYS)) return false;
      if (j.kind === "still" && j.pose != null && !(vec3(j.pose.position) && vec3(j.pose.target))) return false;
      ids.add(j.id);
    }
  }
  return true;
}

/**
 * What a job renders, every setting decided: its own override where it has
 * one, the general setting where it does not. A clip on a preset gets the
 * preset's timeline as it is now.
 */
export function resolveJob(job, kit) {
  const settings = { ...DEFAULT_SETTINGS, ...kit.defaults, ...job.set };
  if (job.kind === "still") {
    // A still in "This window" would take whatever shape the window is on
    // the day the batch runs; it keeps the frame it was given.
    return { kind: "still", pose: job.pose, long: settings.long, frame: settings.frame, custom: settings.custom, place: settings.place };
  }
  const preset = job.preset ? kit.presets.find((x) => x.id === job.preset) : null;
  const timeline = preset ? preset.timeline : job.timeline || null;
  const custom = job.move === CUSTOM;
  return {
    kind: "clip",
    move: job.move,
    timeline: custom ? timeline : null,
    seconds: custom && timeline ? timeline.seconds : job.seconds,
    fps: settings.fps,
    size: settings.size,
    frame: settings.frame,
    custom: settings.custom,
    place: settings.place,
    settle: settings.settle,
  };
}

/** Which of a job's settings are its own rather than the general ones. */
export const overridden = (job, key) => Object.prototype.hasOwnProperty.call(job.set || {}, key);

/** A job with one setting tweaked (or, with `undefined`, handed back to the general settings). */
export function tweak(job, key, value) {
  const set = { ...job.set };
  const v = cleanSetting(key, value);
  if (v === undefined) delete set[key];
  else set[key] = v;
  return { ...job, set };
}

/**
 * Copies a preset onto every clip in the queue (or the ids given) — "a
 * timeline preset that can be copied across a bunch of export files". The
 * clips link to it, so a later edit of the preset reaches them all.
 */
export function applyPreset(kit, presetId, ids = null) {
  if (!kit.presets.some((x) => x.id === presetId)) return kit;
  return {
    ...kit,
    queue: kit.queue.map((j) =>
      j.kind === "clip" && (!ids || ids.includes(j.id)) ? { ...j, move: CUSTOM, preset: presetId, timeline: undefined } : j,
    ),
  };
}

/** Deletes a preset; clips linked to it keep a copy of it, so nothing queued changes. */
export function removePreset(kit, presetId) {
  const preset = kit.presets.find((x) => x.id === presetId);
  if (!preset) return kit;
  return {
    ...kit,
    presets: kit.presets.filter((x) => x.id !== presetId),
    queue: kit.queue.map((j) => (j.preset === presetId ? { ...j, preset: undefined, timeline: structuredClone(preset.timeline) } : j)),
  };
}

/** A short file name part for a job: its own name, or what it is. */
export function jobSlug(job, index) {
  const base = (job.name || (job.kind === "still" ? "still" : job.move === CUSTOM ? "timeline" : job.move)).toLowerCase();
  return `${String(index + 1).padStart(2, "0")}-${base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || job.kind}`;
}

