// Workspaces: who is using the app, and so which tabs and tools it offers first.
//
// The app grew one interface for everyone — eight inspector tabs and a full
// toolbar — while three kinds of people use it: an artist planning a booth,
// an organizer laying out a show floor, and someone who wants every tool. A
// workspace is only a filter on what is shown. The scene, the schema, every
// tab and every tool stay exactly as they are; a hidden tab is one tap away
// under More, and tool search and the assistant still reach everything.
//
// Like the tier (src/tier.js) a workspace is a view setting remembered per
// browser, never in a project or a backup: the same booth opens the same in
// any workspace. "Every tool" is today's app, and it is what anyone who
// already has a saved project gets, so nobody who knows the app finds it
// changed under them. The welcome that asks the question shows once, on a
// browser with no project and no workspace chosen.

export const ROLE_KEY = "booth.role";
export const DEFAULT_ROLE = "all";

/**
 * Each workspace: the welcome card's words, the inspector tabs it shows (in
 * the app's own order; null is every tab), the tab it opens on, and the
 * toolbar actions it hides. `artShowTabs` are shown as well when the booth
 * is an indoor art-show booth, because that booth's footprint and walls live
 * in the Art show tab, not in Layout.
 */
export const ROLES = {
  artist: {
    label: "Artist",
    title: "My booth",
    blurb: "Hang your work in a measured booth, light it, and export pictures and a hanging guide.",
    icon: "image",
    tabs: ["art", "layout", "walls", "lighting", "export"],
    artShowTabs: ["show"],
    start: "layout",
    hide: ["draw-box", "draft", "draft-lock", "mode-show"],
  },
  organizer: {
    label: "Show organizer",
    title: "A show floor",
    blurb: "Lay out the floor, number and sell booths, and walk the whole show in 3D.",
    icon: "map",
    tabs: ["hall", "layout", "export"],
    artShowTabs: [],
    start: "hall",
    hide: ["draw-box", "draft", "draft-lock", "mode-photo"],
  },
  all: {
    label: "Every tool",
    title: "Every tool",
    blurb: "Every tab and tool at once, as the app has always been.",
    icon: "layers",
    tabs: null,
    artShowTabs: [],
    start: null,
    hide: [],
  },
};

export const resolveRole = (role) => (ROLES[role] ? role : DEFAULT_ROLE);

/**
 * The workspace this browser chose, or null when it never chose one. Null is
 * not a workspace: the app treats it as "Every tool" and uses it only to know
 * whether the welcome may still be shown.
 */
export function readRole(storage = globalThis.localStorage) {
  try {
    const v = storage?.getItem(ROLE_KEY);
    return ROLES[v] ? v : null;
  } catch {
    return null;
  }
}

export function writeRole(role, storage = globalThis.localStorage) {
  try {
    storage?.setItem(ROLE_KEY, resolveRole(role));
    return true;
  } catch {
    return false;
  }
}

/** Whether to ask on this visit: nothing chosen and nothing saved yet. */
export const needsWelcome = ({ role, hadProject }) => !role && !hadProject;

/**
 * The inspector tabs to show, in the order of `all`. The open tab always
 * shows, whatever the workspace, so a tab reached by tool search, the
 * assistant or a link is never a page with no tab lit; `more` (the More
 * button pressed) shows every tab.
 */
export function visibleTabs(role, all, { active, more = false, artShow = false } = {}) {
  const spec = ROLES[resolveRole(role)];
  if (!spec.tabs || more) return [...all];
  const keep = new Set([...spec.tabs, ...(artShow ? spec.artShowTabs : []), active]);
  return all.filter((t) => keep.has(t));
}

/** Whether a workspace leaves any tab out, and so needs its More button. */
export const hasMoreTabs = (role, all, opts = {}) => visibleTabs(role, all, { ...opts, more: false }).length < all.length;

/** The toolbar actions a workspace hides. */
export const hiddenActions = (role) => [...ROLES[resolveRole(role)].hide];

/**
 * The tab to show after switching to `role` from `current`: the workspace's
 * own start tab when the current one is not among its tabs, else unchanged.
 */
export function tabAfterSwitch(role, current, all, opts = {}) {
  const spec = ROLES[resolveRole(role)];
  if (!spec.tabs) return current;
  const own = visibleTabs(role, all, { ...opts, active: undefined });
  return own.includes(current) ? current : spec.start;
}
