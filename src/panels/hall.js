// The Show floor tab's builder: the hall planner's rows, totals and map, or,
// with the show floor open, its own panel (src/ui/show-floor-panel.js). What
// the controls do stays in main.js with the action table, which moves later.
// Moved out of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam
// 11): `ctx` is boot's state, read and set through it, and the helpers this
// calls.
import { escapeHTML as e } from "../model.js";
import { HALL_LIMITS, MAX_HALL_BOOTHS, STATUSES, boothOf, hallLayout, hallSVG, hallTotals } from "../hall.js";
import { showSVG } from "../show.js";

export function createHallPanel(ctx) {
  const { allowed, btn, field, proLock, showFloorPanel } = ctx;
  /**
   * Hall (Pro): the whole show's floor, for a promoter — rows of numbered
   * booths on aisles, each with an exhibitor, a status and a price, a map to
   * print and a list to send. Kept in the project as `p.hall`.
   */
  function hallPanel() {
    if (ctx.showFloor && ctx.p.hall && allowed("hall")) return showFloorPanel();
    const intro = "Plan a whole show: rows of numbered booths on aisles, each with an exhibitor, a status and a price. Print the map, send the exhibitor list.";
    if (!allowed("hall")) return proLock("hall", intro + " Part of Booth Studio Pro.");
    const h = ctx.p.hall;
    if (!h) return `<p class="muted">${intro}</p>${btn("hall-start", "Start a hall plan", "map", "primary wide")}`;
    const booths = hallLayout(h);
    if (ctx.hallSelected !== null && !booths.some((b) => b.number === ctx.hallSelected)) ctx.hallSelected = null;
    const t = hallTotals(h);
    const f = (label, key, unit = "", step = 1) => field(label, key, h[key], ...HALL_LIMITS[key], step, unit, "hallplan", "Hall " + label);
    const chosen = ctx.hallSelected !== null ? boothOf(h, ctx.hallSelected) : null;
    const editor = chosen
      ? `<section class="hall-booth"><h3>Booth ${ctx.hallSelected}${h.mine === ctx.hallSelected ? ' <span class="badge">Yours</span>' : ""}</h3><label class="setting-label">Status<select data-field="status" data-scope="hallbooth" aria-label="Booth status">${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${chosen.status === k ? "selected" : ""}>${e(v.label)}</option>`).join("")}</select></label><label class="setting-label">Exhibitor<input type="text" data-field="name" data-scope="hallbooth" aria-label="Exhibitor" maxlength="120" value="${e(chosen.name)}"/></label>${field("Price", "price", chosen.price || 0, ...HALL_LIMITS.price, 1, "$", "hallbooth", "Booth price")}<label class="setting-label">Note<input type="text" data-field="note" data-scope="hallbooth" aria-label="Booth note" maxlength="300" value="${e(chosen.note)}"/></label><div class="button-row">${btn("hall-mine", h.mine === ctx.hallSelected ? "Not my booth" : "This is my booth", "box")}${btn("hall-deselect", "Done", "check")}</div></section>`
      : `<p class="muted">Tap a booth on the map to set its exhibitor, status and price.</p>`;
    return `${btn("mode-show", "Open the show floor", "map", "primary wide")}<p class="muted">The show floor fills the viewport with this plan: drag booths of any size, walkways, walls, doors, tents and stages from a library, snap them together and space them.</p><section><h3>Map <span>${t.booths} booths</span></h3><div class="hall-map-wrap">${h.items ? showSVG(h) : hallSVG(h, { selected: ctx.hallSelected, interactive: true })}</div><p class="hall-totals">${t.sold} sold · ${t.held} held · ${t.open} open${t.soldValue ? ` · sold $${Math.round(t.soldValue).toLocaleString("en-US")}` : ""}${t.heldValue ? ` · held $${Math.round(t.heldValue).toLocaleString("en-US")}` : ""}</p></section>${editor}${h.items ? `<section><h3>Layout</h3><p class="muted">This plan is laid out piece by piece on the show floor, so rows and aisles are no longer typed here. Open the show floor to change it.</p></section>` : `<section><h3>Layout <span>inches</span></h3><div class="field-pair">${f("Rows", "rows")}${f("Booths per row", "perRow")}</div><div class="field-pair">${f("Booth width", "boothWidth", "in")}${f("Booth depth", "boothDepth", "in")}</div>${f("Aisle width", "aisle", "in")}<label class="check-field"><input type="checkbox" data-field="backToBack" data-scope="hallplan" ${h.backToBack ? "checked" : ""}/>Rows back to back, in pairs</label>${f("First booth number", "start")}${f("Default price", "price", "$")}<p class="muted">Up to ${MAX_HALL_BOOTHS} booths. Aisles under 10′ are tight for a crowd; many fire marshals ask for 10′ main aisles.</p></section>`}<section><h3>Share it</h3><div class="button-row">${btn("hall-map", "Download hall map", "download")}${btn("hall-csv", "Exhibitor list (CSV)", "download")}</div>${btn("hall-delete", "Delete the hall plan", "trash-2", "wide")}</section>`;
  }
  return { hallPanel };
}
