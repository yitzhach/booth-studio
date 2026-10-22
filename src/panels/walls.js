// The Walls tab's builders: the free-standing walls, the pedestals and
// furniture, and the 3D models (Pro), each with its position sliders. What a
// drag, a slider or a typed number does to them stays in main.js with the
// action table, which moves later. Moved out of src/main.js's boot() as it
// was (MAIN_SPLIT_PHASE.md, seam 9): `ctx` is boot's state, read through it,
// and the helpers this calls.
import { escapeHTML as e, MAX_PANELS, boothPanels, panelKey, isShown, panelRange, MAX_PEDESTALS, PEDESTAL, FURNITURE, BOX_LIMITS, MAX_MODELS, furnitureKind, boothPedestals } from "../model.js";

export function createWallsPanel(ctx) {
  const { allowed, btn, colorField, field, gated, hideEye, icon, range } = ctx;
  // A position slider's travel is the booth's own footprint, so the whole
  // length of it is somewhere a wall can usefully stand. A panel already
  // outside that — typed, or in an older backup, both of which the schema
  // allows — widens its own slider instead of being dragged back in the
  // moment these controls are drawn.
  function panelSlider(panel, name, key, label) {
    const reach = Math.max(panelRange(ctx.p)[key], Math.abs(panel[key])),
      min = -Math.ceil(reach),
      max = Math.ceil(reach);
    return `<label class="range"><span>${label}<output>${Number(panel[key].toFixed(2))}in</output></span><input type="range" data-field="${key}" data-scope="panel-${e(panel.id)}" aria-label="${e(name + " " + label + " slider")}" min="${min}" max="${max}" step="1" value="${panel[key]}"/></label>`;
  }
  function panelFields() {
    const panels = boothPanels(ctx.p);
    return `<section><h3>Free-standing walls</h3><p class="muted">Interior panels you can stand anywhere in the booth and hang art on either side. Position is measured in inches from the centre of the floor: X is right, Z is toward the entrance. They do not change the booth footprint.</p><p class="muted">Click a free-standing wall in the booth to select it, then drag it across the floor or use the sliders. Snap keeps a drag on whole inches.</p>${panels.map((panel, i) => {
      const name = panel.name || "Panel " + (i + 1),
        scope = "panel-" + panel.id,
        chosen = ctx.selectedPanel === panelKey(panel.id),
        f = (label, key, value, min, max, step, unit) =>
          field(label, key, value, min, max, step, unit, scope, name + " " + label);
      return `<div class="wall-setting${chosen ? " selected" : ""}${isShown(panel) ? "" : " is-hidden"}" data-panel="${e(panel.id)}"><div class="panel-heading"><h4>${e(name)}${chosen ? ' <span class="badge">Selected</span>' : ""}${isShown(panel) ? "" : ' <span class="badge">Hidden</span>'}</h4><span class="piece-actions">${hideEye("panel", panel.id, name, isShown(panel))}${btn("delete-panel-" + panel.id, "Remove " + name, "trash-2", "icon-only")}</span></div>${f("Width", "width", panel.width, 12, 360, 1, "in")}${f("Height", "height", panel.height, 24, 144, 1, "in")}${f("Position X", "x", panel.x, -360, 360, 1, "in")}${panelSlider(panel, name, "x", "Slide left / right")}${f("Position Z", "z", panel.z, -360, 360, 1, "in")}${panelSlider(panel, name, "z", "Slide front / back")}${f("Rotation", "rotation", panel.rotation, -180, 180, 5, "°")}</div>`;
    }).join("")}${panels.length < MAX_PANELS ? btn("add-panel", "Add free-standing wall", "plus", "wide") : `<p class="muted">${MAX_PANELS} free-standing walls is the limit.</p>`}</section>`;
  }
  /** A position slider for a pedestal. Same travel rule a free-standing wall's gets. */
  function pedestalSlider(ped, name, key, label) {
    const reach = Math.max(panelRange(ctx.p)[key], Math.abs(ped[key])),
      min = -Math.ceil(reach),
      max = Math.ceil(reach);
    return `<label class="range"><span>${label}<output>${Number(ped[key].toFixed(2))}in</output></span><input type="range" data-field="${key}" data-scope="pedestal-${e(ped.id)}" aria-label="${e(name + " " + label + " slider")}" min="${min}" max="${max}" step="1" value="${ped[key]}"/></label>`;
  }
  function pedestalFields() {
    const list = boothPedestals(ctx.p);
    return `<section><h3>Pedestals and furniture</h3><p class="muted">Pedestals, tables in their cloths, a counter, seating, a print bin, gridwall, a banner stand and a screen. Double-click one in the booth to pick it up, then drag it across the floor or use the sliders. Position is inches from the centre of the floor: X is right, Z is toward the entrance. Plan view shows the clear floor around the one selected.</p>${list.map((ped, i) => {
      const name = ped.name || "Pedestal " + (i + 1),
        scope = "pedestal-" + ped.id,
        chosen = ctx.selectedPedestal === ped.id,
        f = (label, key, value, min, max, step, unit) =>
          field(label, key, value, min, max, step, unit, scope, name + " " + label);
      return `<div class="wall-setting${chosen ? " selected" : ""}${isShown(ped) ? "" : " is-hidden"}" data-pedestal="${e(ped.id)}"><div class="panel-heading"><h4>${e(name)}${chosen ? ' <span class="badge">Selected</span>' : ""}${isShown(ped) ? "" : ' <span class="badge">Hidden</span>'}${ped.locked ? ' <span class="badge">Locked</span>' : ""}</h4><span class="piece-actions"><button data-lock-pedestal="${e(ped.id)}" class="eye" title="${ped.locked ? "Unlock" : "Lock"} ${e(name)}" aria-label="${ped.locked ? "Unlock" : "Lock"} ${e(name)}" aria-pressed="${!!ped.locked}">${icon(ped.locked ? "lock" : "lock-open")}</button>${hideEye("pedestal", ped.id, name, isShown(ped))}${btn("delete-pedestal-" + ped.id, "Remove " + name, "trash-2", "icon-only")}</span></div>${furnitureKind(ped) === "box" ? `${f("Height", "height", ped.height, ...BOX_LIMITS.height, 1, "in")}${range("Pull up", "height", ped.height, BOX_LIMITS.height[0], Math.max(96, Math.ceil(ped.height)), 1, scope, "in")}${f("Width", "width", ped.width, ...BOX_LIMITS.width, 1, "in")}${f("Depth", "depth", ped.depth, ...BOX_LIMITS.depth, 1, "in")}` : `${f("Height", "height", ped.height, 6, 96, 1, "in")}${f("Width", "width", ped.width, 4, 96, 1, "in")}${f("Depth", "depth", ped.depth, 4, 96, 1, "in")}`}${colorField("Finish", "color", scope, ped.color || PEDESTAL.color, name + " finish")}${f("Position X", "x", ped.x, -360, 360, 1, "in")}${pedestalSlider(ped, name, "x", "Slide left / right")}${f("Position Z", "z", ped.z, -360, 360, 1, "in")}${pedestalSlider(ped, name, "z", "Slide front / back")}${f("Rotation", "rotation", ped.rotation, -180, 180, 5, "°")}</div>`;
    }).join("")}${list.length < MAX_PEDESTALS ? `<label class="setting-label">Add to the floor<select id="furniture-kind" aria-label="Furniture to add">${Object.entries(FURNITURE).filter(([k]) => k !== "box" || allowed("box")).map(([k, f]) => `<option value="${k}" ${k === ctx.furnitureChoice ? "selected" : ""}>${e(f.label)} · ${f.width}×${f.depth}″</option>`).join("")}</select></label>${btn("add-pedestal", "Add " + FURNITURE[ctx.furnitureChoice].label.toLowerCase(), "plus", "wide")}` : `<p class="muted">${MAX_PEDESTALS} pieces is the limit.</p>`}</section>`;
  }
  /**
   * Walls → 3D models (Pro): a .glb brought in from SketchUp, Blender or a
   * maker's own scan — a sculpture, a custom display — stood on the floor at
   * a typed height. Kept in the booth like an image, so a backup carries it.
   */
  function modelsSection() {
    const models = ctx.p.booth.models || [];
    const rows = models
      .map((m, i) => {
        const name = m.name || "Model " + (i + 1),
          scope = "model-" + m.id,
          f = (label, key, value, min, max, step, unit) => field(label, key, value, min, max, step, unit, scope, name + " " + label);
        return `<div class="wall-setting${isShown(m) ? "" : " is-hidden"}" data-model="${e(m.id)}"><div class="panel-heading"><h4>${e(name)}${isShown(m) ? "" : ' <span class="badge">Hidden</span>'}</h4><span class="piece-actions">${hideEye("model", m.id, name, isShown(m))}${btn("delete-model-" + m.id, "Remove " + name, "trash-2", "icon-only")}</span></div>${f("Height", "height", m.height, 1, 240, 0.5, "in")}<div class="field-pair">${f("Left / right", "x", m.x, -600, 600, 1, "in")}${f("Front / back", "z", m.z, -600, 600, 1, "in")}</div>${f("Rotation", "rotation", m.rotation, -360, 360, 5, "°")}</div>`;
      })
      .join("");
    return gated("glb", `<section><h3>3D models <span>${models.length} / ${MAX_MODELS}</span></h3><p class="muted">Bring in a .glb from SketchUp, Blender or a 3D scan — a sculpture, a custom display — and stand it on the floor. It is scaled to the height you type, so its own units do not matter. Saved in the booth and its backups.</p>${rows}${models.length < MAX_MODELS ? btn("upload-model", "Import .glb model", "upload", "wide") : `<p class="muted">${MAX_MODELS} models is the limit.</p>`}</section>`, "Bring in .glb models from SketchUp, Blender or a scan, and export the booth as .glb. Part of Booth Studio Pro.");
  }
  return { panelFields, pedestalFields, modelsSection };
}
