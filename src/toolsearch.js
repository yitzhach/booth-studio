// Finding a tool by name. Asked for on the real machine as "a search box —
// you can search a tool name and it opens the tool or gives a list of
// options": seven inspector tabs, each long, is a lot of scrolling to find
// one slider whose tab you have forgotten.
//
// Pure: main.js collects the entries from what the inspector would draw (so
// the index is never a second list to keep in step with the panels) and this
// file only decides which of them a query means, in what order. Node tests
// pin it.

/** Lower case, accents off, punctuation to spaces: how both sides compare. */
export const fold = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Short names for tools, typed into the search box as a shortcut straight to
 * one control. Asked for 2026-09-24 ("let's come up with tool names — and we
 * can use those as a shortcut in the search bar … a way to save time").
 *
 * Each maps to a label and, where the label is not unique, the start of the
 * `where` it lives in, exactly as the search index names them — so a renamed
 * control breaks a view test rather than a shortcut quietly going nowhere.
 * The names are a first draft for the owner to edit: short, lower case, no
 * two alike, and each one a word or the obvious letters of one. Help lists
 * them, grouped as they are here.
 */
export const SHORTCUTS = {
  // Tabs.
  art: { label: "Artwork", where: "Inspector tab", group: "Tabs" },
  lay: { label: "Layout", where: "Inspector tab", group: "Tabs" },
  show: { label: "Art show", where: "Inspector tab", group: "Tabs" },
  wl: { label: "Walls", where: "Inspector tab", group: "Tabs" },
  lt: { label: "Lighting", where: "Inspector tab", group: "Tabs" },
  vid: { label: "Video", where: "Inspector tab", group: "Tabs" },
  hall: { label: "Show floor", where: "Inspector tab", group: "Tabs" },
  ex: { label: "Export", where: "Inspector tab", group: "Tabs" },
  // Toolbar and view.
  sel: { label: "Select", where: "Toolbar", group: "Toolbar and view" },
  mv: { label: "Move", where: "Toolbar", group: "Toolbar and view" },
  snap: { label: "Snap 1″", where: "Toolbar", group: "Toolbar and view" },
  tape: { label: "Measure", where: "Toolbar", group: "Toolbar and view" },
  walk: { label: "Walk", where: "Toolbar", group: "Toolbar and view" },
  box: { label: "Box", where: "Toolbar", group: "Toolbar and view" },
  fast: { label: "Fast edit", where: "Toolbar", group: "Toolbar and view" },
  plan: { label: "Plan", where: "View", group: "Toolbar and view" },
  pv: { label: "Perspective", where: "View", group: "Toolbar and view" },
  rv: { label: "Reset view", where: "View", group: "Toolbar and view" },
  pq: { label: "Preview quality", where: "Status bar", group: "Toolbar and view" },
  // Artwork.
  up: { label: "Upload originals", where: "Artwork", group: "Artwork" },
  dim: { label: "Dimensions", where: "Artwork", group: "Artwork" },
  edge: { label: "Edge material", where: "Artwork", group: "Artwork" },
  gap: { label: "Wall gap", where: "Artwork", group: "Artwork" },
  c60: { label: "Center at 60″", where: "Artwork", group: "Artwork" },
  even: { label: "Space this wall evenly", where: "Artwork", group: "Artwork" },
  h60: { label: "Hang this wall at 60″", where: "Artwork", group: "Artwork" },
  sev: { label: "Select several", where: "Artwork", group: "Artwork" },
  dup: { label: "Duplicate", where: "Artwork · Actions", group: "Artwork" },
  // Layout.
  wh: { label: "Wall height", where: "Layout", group: "Layout" },
  env: { label: "Environment", where: "Layout", group: "Layout" },
  gnd: { label: "Ground", where: "Layout", group: "Layout" },
  sv: { label: "Save this view", where: "Layout", group: "Layout" },
  tags: { label: "Tags", where: "Layout", group: "Layout" },
  ppl: { label: "People for scale", where: "Layout", group: "Layout" },
  ul: { label: "Floor plan underlay", where: "Layout", group: "Layout" },
  clr: { label: "Clearance checks", where: "Layout", group: "Layout" },
  fab: { label: "Fabric finish", where: "Layout", group: "Layout" },
  row: { label: "Booth row", where: "Layout", group: "Layout" },
  qs: { label: "Quick start a new booth", where: "Layout", group: "Layout" },
  tpl: { label: "Save this booth as a template", where: "Layout", group: "Layout" },
  venue: { label: "Venue", where: "Art show", group: "Layout" },
  // Walls and floor.
  fw: { label: "Add free-standing wall", where: "Walls", group: "Walls and floor" },
  ped: { label: "Add pedestal", where: "Walls", group: "Walls and floor" },
  furn: { label: "Add to the floor", where: "Walls", group: "Walls and floor" },
  glb: { label: "Import .glb model", where: "Walls", group: "Walls and floor" },
  // Lighting.
  amb: { label: "Ambient illumination", where: "Lighting", group: "Lighting" },
  spot: { label: "Spotlights", where: "Lighting", group: "Lighting" },
  ds: { label: "Drop shadow", where: "Lighting", group: "Lighting" },
  // Export.
  png: { label: "Export PNG", where: "Export", group: "Export" },
  mp4: { label: "Export MP4", where: "Export", group: "Export" },
  frm: { label: "Frame", where: "Video", group: "Export" },
  pack: { label: "Download show pack", where: "Export", group: "Export" },
  pwr: { label: "Download power and rentals sheet", where: "Export", group: "Export" },
  elev: { label: "Download elevations", where: "Export", group: "Export" },
  guide: { label: "Download hanging guide", where: "Export", group: "Export" },
  "3d": { label: "Download booth as .glb", where: "Export", group: "Export" },
  bak: { label: "Download project backup", where: "Export", group: "Export" },
};

/** Whether `entry` is the control a shortcut names. */
export const isShortcutFor = (sc, entry) =>
  fold(entry.label) === fold(sc.label) && fold(entry.where).startsWith(fold(sc.where));

/** The shortcut that names `entry`, or "" — shown beside it in the results. */
export function shortcutOf(entry, shortcuts = SHORTCUTS) {
  for (const [name, sc] of Object.entries(shortcuts)) if (isShortcutFor(sc, entry)) return name;
  return "";
}

/**
 * The entries a query matches, best first, at most `limit`.
 *
 * An entry is `{ label, where }`: what the control is called, and the tab and
 * section it sits in ("Lighting · Drop shadow"). Every word of the query has
 * to appear somewhere in the two, so "shadow angle" finds the dial and
 * "lighting brightness" finds the spotlight's slider rather than every
 * brightness there is. A word that starts a word of the label counts more
 * than one found in the middle of it, and the label counts more than where
 * it lives; shorter labels win a tie, because "Height" searched for is more
 * likely the wall's height than "Target height".
 */
export function rankTools(entries, query, limit = 12, shortcuts = SHORTCUTS) {
  const words = fold(query).split(" ").filter(Boolean);
  if (!words.length) return [];
  // A shortcut typed exactly puts its control first; whatever else the words
  // match follows, so a shortcut that is also a word ("gap") loses nothing.
  const sc = Object.hasOwn(shortcuts, words.join("")) ? shortcuts[words.join("")] : null;
  const named = sc ? entries.find((x) => isShortcutFor(sc, x)) : null;
  if (named) return [named, ...rankTools(entries.filter((x) => x !== named), query, limit - 1, {})];
  const scored = [];
  entries.forEach((entry, order) => {
    const label = fold(entry.label),
      where = fold(entry.where),
      labelWords = label.split(" ");
    let score = 0;
    for (const w of words) {
      if (label === w) score += 100;
      else if (labelWords.some((x) => x.startsWith(w))) score += label.startsWith(w) ? 40 : 30;
      else if (label.includes(w)) score += 15;
      else if (where.split(" ").some((x) => x.startsWith(w))) score += 8;
      else if (where.includes(w)) score += 4;
      else return;
    }
    if (label === words.join(" ")) score += 200;
    scored.push({ entry, score, len: label.length, order });
  });
  scored.sort((a, b) => b.score - a.score || a.len - b.len || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.entry);
}

/**
 * One entry per distinct label and place. A panel says "Download project
 * backup" in Layout and in Export; both are listed, because both are real
 * places to find it, but the same label twice in one section is one entry.
 */
export function dedupe(entries) {
  const seen = new Set();
  return entries.filter((x) => {
    const key = fold(x.label) + "|" + fold(x.where);
    if (!fold(x.label) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
