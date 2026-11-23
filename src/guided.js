// The guided booth: five small steps from a quick-started booth to a picture
// of it, for an artist who should never meet the full toolbox unless they ask
// for it (DEMO_PHASE.md, stage A).
//
// The Layout tab holds 106 controls on a computer and 89 on a phone, and that
// is where a first visit used to land. A step shows a handful of them, in the
// order an artist thinks: the booth, its walls and their colour, the light,
// the work on the walls, then something to send. Each step here is data —
// its words, the controls it shows and whether its work is already done — so
// the order, the wording and what each step offers are one table to change.
// src/ui/guided-panel.js draws it; nothing here touches the page.
//
// Like the workspace (src/roles.js) where an artist is in the steps is a view
// setting kept per browser, never in a project or a backup: the same booth
// opens the same with or without them, and "All tools" is one tap and stays
// chosen. `done` only reads the project; it never writes to it.
import { isShown, wallSpec } from "./model.js";
import { currentLook } from "./polish.js";

export const GUIDED_KEY = "booth.guided";
/** The stored value that says the artist chose All tools. */
export const GUIDED_OFF = "off";
/** The most controls a step may show, so a step is never a toolbox again. */
export const MAX_CONTROLS = 8;

/**
 * Whether a placement is a work (not a sign or a label) of this booth (not
 * a neighbour's in the booth row, the rule src/polish.js and the hanging
 * guide follow) on a wall that shows.
 */
const hungWork = (p, a) => (a.kind || "art") === "art" && !a.booth && !!wallSpec(p, a.wall)?.enabled;
const someWallShows = (p) => ["back", "left", "right"].some((k) => p.booth.walls[k]?.enabled) || (p.booth.panels || []).some(isShown);

/** Freeze a list of steps, each step and its controls: one table, read by all. */
function deepFreeze(steps) {
  for (const s of steps) Object.freeze(Object.freeze(s).controls);
  return Object.freeze(steps);
}

/**
 * Each step: its key, a title, one line of help, the controls it shows (the
 * names src/ui/guided-panel.js draws: an existing toolbar or inspector action
 * where there is one, so it runs exactly as it does in the tabs), and
 * `done(p)`, whether the booth already has what the step makes.
 *
 * `booth` is always done: Quick start has built it by the time the steps
 * show. `share` never is: what it makes — a picture, a guide, a link —
 * leaves the project, and the project cannot say whether it was sent. The
 * kind of booth (step 1) carries the canopy with it, as Quick start's
 * choices do, so a canopy is never a switch of its own that would turn an
 * indoor panel booth into an outdoor one.
 * @type {readonly { key: string, title: string, help: string, controls: readonly string[], done: (p: any) => boolean }[]}
 */
export const STEPS = deepFreeze([
  {
    key: "booth",
    title: "Your booth",
    help: "The kind of show and the size of your space. Either can change later.",
    controls: ["booth-kind", "booth-size", "project-name"],
    done: () => true,
  },
  {
    key: "walls",
    title: "Walls and colour",
    help: "How your walls stand, and the colour of your panels.",
    controls: ["wall-layout", "panel-color", "wall-finish"],
    done: (p) => someWallShows(p),
  },
  {
    key: "light",
    title: "Light",
    help: "Pick a look, or let the app light the booth for you.",
    controls: ["polish", "look-gallery", "look-hall", "look-fair", "look-evening"],
    done: (p) => currentLook(p) !== null,
  },
  {
    key: "hang",
    title: "Hang your work",
    help: "Add pictures of your work, give each its width, and the app hangs them.",
    controls: ["add-pictures", "space-evenly", "hung-list"],
    done: (p) => (p.art || []).some((a) => hungWork(p, a)),
  },
  {
    key: "share",
    title: "Share it",
    help: "A picture of your booth, a hanging guide, a link, or the booth on your phone.",
    controls: ["save-picture", "guide", "share-design", "studio-account"],
    done: () => false,
  },
]);

export const STEP_KEYS = Object.freeze(STEPS.map((s) => s.key));
export const firstStep = STEP_KEYS[0];

export const stepIndex = (key) => STEP_KEYS.indexOf(key);
export const stepOf = (key) => STEPS[stepIndex(key)] || null;
/** The step Next goes to, or null from the last step or a key that is not a step. */
export const stepAfter = (key) => (stepIndex(key) < 0 ? null : STEP_KEYS[stepIndex(key) + 1] || null);
/** The step Back goes to, or null from the first. */
export const stepBefore = (key) => (stepIndex(key) < 1 ? null : STEP_KEYS[stepIndex(key) - 1]);

/**
 * Where this browser is: a step's key, GUIDED_OFF once All tools was chosen,
 * or null when it never started the steps. An unreadable store or a stale
 * value is null, never a throw.
 * @returns {string | null}
 */
export function readGuided(storage = globalThis.localStorage) {
  try {
    const v = storage?.getItem(GUIDED_KEY);
    return v === GUIDED_OFF || STEP_KEYS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

/** Remember a step or All tools. Refuses anything else; false when storage is blocked. */
export function writeGuided(value, storage = globalThis.localStorage) {
  if (value !== GUIDED_OFF && !STEP_KEYS.includes(value)) return false;
  try {
    storage?.setItem(GUIDED_KEY, value);
    return !!storage;
  } catch {
    return false;
  }
}
