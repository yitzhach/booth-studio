// The user's own templates, kept per browser: floor templates (show.js
// floorTemplateOf) and booth templates (the booth without its work). Moved out
// of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam 3). It reads
// none of boot's state, so it is plain exports rather than a factory.
import { validFloorTemplate } from "../show.js";

// The user's own floor templates (show.js floorTemplateOf), per browser.
export const FLOOR_TEMPLATE_KEY = "booth.floorTemplates", MAX_FLOOR_TEMPLATES = 12;
export function readFloorTemplates() {
  try {
    const list = JSON.parse(localStorage.getItem(FLOOR_TEMPLATE_KEY) || "[]");
    return Array.isArray(list) ? list.filter(validFloorTemplate) : [];
  } catch {
    return [];
  }
}
export function writeFloorTemplates(list) {
  try {
    localStorage.setItem(FLOOR_TEMPLATE_KEY, JSON.stringify(list.slice(0, MAX_FLOOR_TEMPLATES)));
    return true;
  } catch {
    return false;
  }
}
/**
 * Floor templates carried in a backup, added to this browser's list: the
 * valid ones whose id is not here already, after the ones here, up to the
 * limit. Returns how many were added.
 */
export function mergeFloorTemplates(carried) {
  const list = readFloorTemplates();
  const have = new Set(list.map((t) => t.id));
  const fresh = carried.filter((t) => validFloorTemplate(t) && !have.has(t.id)).slice(0, Math.max(0, MAX_FLOOR_TEMPLATES - list.length));
  return fresh.length && writeFloorTemplates([...list, ...fresh]) ? fresh.length : 0;
}
// The user's own booth templates: the booth without its work, per browser.
export const TEMPLATE_KEY = "booth.templates", MAX_TEMPLATES = 12;
export function readTemplates() {
  try {
    const list = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "[]");
    return Array.isArray(list) ? list.filter((t) => t && t.id && t.booth && typeof t.label === "string") : [];
  } catch {
    return [];
  }
}
export function writeTemplates(list) {
  try {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list.slice(0, MAX_TEMPLATES)));
    return true;
  } catch {
    return false;
  }
}
