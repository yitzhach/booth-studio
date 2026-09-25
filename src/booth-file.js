// A booth design as a file, sent from an exhibitor to a promoter — Show Hub
// v0 (FUTURE_BUILD.md, idea 1).
//
// The Show Hub idea is that a promoter's floor assembles itself: every
// exhibitor designs their own booth, and each design lands on its booth
// number. The hosted version needs a server; this is the version that does
// not. The exhibitor presses **Send my booth to the promoter** and gets one
// .json file — the live design and exactly the images it names. The promoter
// selects a booth on the show floor and presses **Import a booth design**;
// the design is parked on that number exactly as an opened booth's is
// (`p.hall.designs`, src/linked.js), so everything phase 3 built — Open this
// booth, the 3D show, renumbering, deleting — already works on it.
//
// Nothing here changes schema 1. The file is not a backup and says so by its
// `kind`; what it carries is validated by the very rules a backup's live
// design is (`validateProject`), so a design that imports is a design that
// saves.
import { uid, validateProject } from "./model.js";
import { DESIGN_KEYS, MAX_DESIGNS, OWN, liveNumber, putDesign, takeDesign } from "./linked.js";
import { showItems } from "./show.js";

export const DESIGN_FILE_KIND = "booth-studio/booth-design";
export const DESIGN_FILE_VERSION = 1;
/** The same ceiling a backup's asset table has. */
export const MAX_ASSETS = 250;

/** The ids of every asset in `table` that the design `d` names anywhere. */
export function namedAssets(d, table) {
  const text = JSON.stringify(d);
  return Object.keys(table || {}).filter((id) => text.includes(JSON.stringify(id)));
}

/**
 * The live design of `p` as a file: a deep copy of the design and the images
 * it names, nothing else of the project — not its other assets, its photo
 * composition, its export kit or its show floor.
 */
export function designFile(p) {
  const design = JSON.parse(JSON.stringify(takeDesign(p)));
  const assets = {};
  for (const id of namedAssets(design, p.assets)) assets[id] = p.assets[id];
  const number = p.hall ? liveNumber(p.hall) : undefined;
  return {
    kind: DESIGN_FILE_KIND,
    version: DESIGN_FILE_VERSION,
    name: p.name,
    ...(number !== undefined ? { number } : {}),
    design,
    assets,
  };
}

/**
 * Read a parsed design file: `{ name, number?, design, assets }`, or throw
 * with a message a person can act on. A full backup handed in by mistake is
 * named as one rather than refused as nonsense.
 */
export function readDesignFile(f) {
  if (f?.schema === 1 && f?.booth) throw new Error("That is a whole project backup. Open it with Open project backup; import a booth design file here — the exhibitor makes one with Send my booth to the promoter.");
  if (!f || f.kind !== DESIGN_FILE_KIND || f.version !== DESIGN_FILE_VERSION || !f.design || typeof f.design !== "object" || !f.assets || typeof f.assets !== "object")
    throw new Error("This is not a Booth Studio booth design file.");
  if (Object.keys(f.assets).length > MAX_ASSETS) throw new Error("This booth design file is not valid.");
  const d = f.design;
  try {
    validateProject({
      schema: 1,
      units: "inches",
      name: "Imported design",
      mode: "3d",
      photo: { asset: null, layers: [], lights: [], exposure: 0 },
      assets: f.assets,
      booth: d.booth,
      art: d.art,
      lights: d.lights,
      ambient: d.ambient,
      ...(d.views !== undefined ? { views: d.views } : {}),
    });
  } catch {
    throw new Error("This booth design file is not valid. Your floor was kept.");
  }
  const design = {};
  for (const k of DESIGN_KEYS) if (d[k] !== undefined) design[k] = d[k];
  return {
    name: typeof f.name === "string" ? f.name.slice(0, 200) : "",
    ...(Number.isInteger(f.number) ? { number: f.number } : {}),
    design,
    assets: f.assets,
  };
}

/**
 * Put a read design file on floor booth `number`: its images join the
 * project's (an id already there with other data is given a new id, and the
 * design renamed to match), and the design is parked on that booth — or, if
 * that booth is the one open in the editor, replaces the live design. Mutates
 * `p`; returns an error message, or null. Replacing a booth's existing design
 * is the caller's to confirm.
 */
export function importDesign(p, number, file) {
  const h = p.hall;
  if (!h) return "There is no show floor.";
  if (!Number.isInteger(number) || number === OWN || !showItems(h).some((i) => i.kind === "booth" && i.number === number)) return `There is no booth ${number} on the floor.`;
  const live = liveNumber(h) === number;
  const count = Object.keys(h.designs || {}).length;
  if (!live && !h.designs?.[number] && count >= MAX_DESIGNS) return `${MAX_DESIGNS} linked designs is the limit. Delete a booth that has one, or import onto one that already does.`;
  let text = JSON.stringify(file.design);
  const add = {};
  for (const [id, asset] of Object.entries(file.assets)) {
    if (!text.includes(JSON.stringify(id))) continue; // named by nothing: left behind
    const have = p.assets[id];
    if (!have || have.data === asset.data) {
      if (!have) add[id] = asset;
      continue;
    }
    const fresh = uid();
    text = text.split(JSON.stringify(id)).join(JSON.stringify(fresh));
    add[fresh] = asset;
  }
  if (Object.keys(p.assets).length + Object.keys(add).length > MAX_ASSETS) return `This design's images would take the project past ${MAX_ASSETS}. Delete some unused images first.`;
  Object.assign(p.assets, add);
  const design = JSON.parse(text);
  if (live) putDesign(p, design);
  else h.designs = { ...(h.designs || {}), [number]: design };
  return null;
}
