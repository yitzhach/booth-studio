// The controls that follow an edit made somewhere else, and what a control
// is about. `syncArtInputs`, `syncPanelInputs`, `syncPedestalInputs` and
// `syncShadowInputs` set the fields and sliders from the booth after a drag
// or a live change, leaving alone the one being used; `reveal`,
// `revealPanelFields` and `revealPedestalFields` bring a control the
// viewport picked into sight; `setShadowLive` and `endShadowGesture` are one
// live shadow gesture; `fieldTarget` says which object a control's
// `data-scope` writes to, and `applyColor` and `rememberEdge` set a colour
// from the palette and keep the last edge finish. All are returned. Moved out
// of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam 21): `ctx` is
// boot's state, read and set through it, and the helpers these call.
import { SHADOW_FIELD, SHADOW_KINDS, SHADOW_MAX, normalAngle, shadowSpec } from "../dropshadow.js";
import { isColor, rememberColor } from "../swatches.js";
import { findPanel, panelKey, panelIdOf, artShowPanel, findPedestal, hallSpec, lightBarSpec } from "../model.js";

export function createSyncInputs(ctx) {
  const { checkpoint, dialSVG, mutate, saveViewPrefs, scheduleSave, showSection } = ctx;
  /** One work's placement, in both its number field and its slider. */
  function syncArtInputs(a, except = null) {
    for (const key of ["x", "y"]) {
      for (const input of document.querySelectorAll(
        `[data-field="${key}"][data-scope="art"], [data-field="${key}"][data-scope="art-position"]`,
      )) {
        if (input === except) continue;
        input.value = Number(a[key].toFixed(3));
        input
          .closest("label")
          ?.querySelector("output")
          ?.replaceChildren(Number(a[key].toFixed(2)) + "in");
      }
    }
  }
  // One panel's X and Z, in both controls at once. A drag in the viewport and
  // a pull on either slider are the same edit, so whichever one is not being
  // touched has to follow rather than sit at a stale number.
  function syncPanelInputs(panel, except = null) {
    for (const key of ["x", "z"]) {
      for (const input of document.querySelectorAll(
        `[data-scope="panel-${CSS.escape(panel.id)}"][data-field="${key}"]`,
      )) {
        if (input === except) continue;
        input.value = Number(panel[key].toFixed(3));
        input
          .closest("label")
          ?.querySelector("output")
          ?.replaceChildren(Number(panel[key].toFixed(2)) + "in");
      }
    }
  }
  // Selecting a wall in the viewport is only useful if its controls are on
  // screen; the Layout panel is long enough that they usually are not.
  /**
   * Bring a control the viewport just picked into sight. With the panels'
   * section chips on, it may sit in a section another chip hides, and
   * scrolling to a hidden element does nothing — so its chip is chosen first.
   */
  function reveal(el) {
    if (!el) return;
    showSection(el);
    el.scrollIntoView({ block: "nearest" });
  }
  function revealPanelFields() {
    const id = panelIdOf(ctx.selectedPanel);
    if (!id) return;
    reveal(document.querySelector(`.wall-setting[data-panel="${CSS.escape(id)}"]`));
  }
  /** One pedestal's X and Z, in both its number field and its slider. */
  function syncPedestalInputs(ped, except = null) {
    for (const key of ["x", "z"]) {
      for (const input of document.querySelectorAll(
        `[data-scope="pedestal-${CSS.escape(ped.id)}"][data-field="${key}"]`,
      )) {
        if (input === except) continue;
        input.value = Number(ped[key].toFixed(3));
        input
          .closest("label")
          ?.querySelector("output")
          ?.replaceChildren(Number(ped[key].toFixed(2)) + "in");
      }
    }
  }
  function revealPedestalFields() {
    if (!ctx.selectedPedestal) return;
    reveal(document.querySelector(`.wall-setting[data-pedestal="${CSS.escape(ctx.selectedPedestal)}"]`));
  }
  /**
   * Every shadow control on the page, set from the booth — after a live
   * change, so the typed number follows its slider, and the other shadow's
   * angle follows a global light that just moved. The control being used is
   * left alone: rewriting an input under the cursor fights the person typing.
   */
  function syncShadowInputs(except = null) {
    for (const kind of SHADOW_KINDS) {
      const s = shadowSpec(ctx.p.booth, kind),
        scope = SHADOW_FIELD[kind];
      for (const input of document.querySelectorAll(`[data-fx-live][data-scope="${scope}"]`)) {
        if (input === except) continue;
        const v = s[input.dataset.field];
        if (typeof v === "number") input.value = input.dataset.field === "angle" ? Math.round(v) : Number(v.toFixed(2));
      }
      const dial = document.querySelector(`[data-dial="${scope}"]`);
      if (dial) {
        dial.innerHTML = dialSVG(s.angle);
        dial.setAttribute("aria-valuenow", String(Math.round(s.angle)));
      }
    }
  }
  /**
   * One live change to a shadow, from a slider, a typed number or the dial.
   * The record is written back whole the first time — which is what upgrades
   * an older booth's `dropShadow` — and an angle under the global light moves
   * the global light, so every shadow using it turns together.
   */
  function setShadowLive(scope, key, raw, source = null) {
    const kind = SHADOW_KINDS.find((k) => SHADOW_FIELD[k] === scope);
    if (!kind) return;
    const limits = { opacity: [0, 100], spread: [0, 100], distance: [0, SHADOW_MAX], size: [0, SHADOW_MAX], angle: [-180, 180] }[key];
    const value = Number(raw);
    if (!limits || raw === "" || !Number.isFinite(value)) return;
    const v = key === "angle" ? normalAngle(Math.round(value)) : Math.max(limits[0], Math.min(limits[1], value));
    if (shadowSpec(ctx.p.booth, kind)[key] === v) return;
    if (!ctx.shadowGesture) {
      checkpoint();
      ctx.shadowGesture = true;
    }
    const record = (ctx.p.booth[scope] = shadowSpec(ctx.p.booth, kind));
    record[key] = v;
    if (key === "angle" && record.global) ctx.p.booth.shadowAngle = v;
    ctx.scene?.updateShadows();
    syncShadowInputs(source);
  }
  /** The end of a live shadow gesture: saved, and one undo step behind it. */
  function endShadowGesture() {
    if (!ctx.shadowGesture) return;
    ctx.shadowGesture = false;
    scheduleSave();
  }
  /**
   * Which object a control's `data-scope` is about. One function, because the
   * inspector writes to these from two places now — a typed field or a slider,
   * and a colour chosen from the saved palette — and two copies of this
   * ternary would be two answers to "what a pedestal's scope means".
   *
   * The three derived records (the panel module, the light bar, the hall) are
   * written back as they are read, which is what upgrades a booth saved
   * before they existed the first time one is touched.
   */
  function fieldTarget(scope, art) {
    return (
        scope === "art"
          ? art
          : scope === "booth"
            ? ctx.p.booth
            : scope?.startsWith("wall-")
              ? ctx.p.booth.walls[scope.slice(5)]
              : scope?.startsWith("person-")
                ? (ctx.p.booth.people || []).find((x) => x.id === scope.slice(7))
            : scope?.startsWith("panel-")
              ? findPanel(ctx.p, panelKey(scope.slice(6)))
            : scope?.startsWith("pedestal-")
              ? findPedestal(ctx.p, scope.slice(9))
            : scope === "artShow"
              ? (ctx.p.booth.artShow = artShowPanel(ctx.p.booth))
            : scope === "lightBar"
              ? (ctx.p.booth.lightBar = lightBarSpec(ctx.p.booth))
            : scope === "hall"
              ? (ctx.p.booth.hall = hallSpec(ctx.p.booth))
            : scope === "underlay"
              ? ctx.p.booth.underlay
            : scope === "hallplan"
              ? ctx.p.hall
            : scope === "hallbooth"
              ? ctx.p.hall && ctx.hallSelected !== null ? (ctx.p.hall.booths[ctx.hallSelected] ||= {}) : null
            : scope?.startsWith("model-")
              ? (ctx.p.booth.models || []).find((m) => m.id === scope.slice(6))
            : SHADOW_KINDS.some((kind) => SHADOW_FIELD[kind] === scope)
              ? (ctx.p.booth[scope] = shadowSpec(ctx.p.booth, SHADOW_KINDS.find((kind) => SHADOW_FIELD[kind] === scope)))
              : scope === "light"
                ? ctx.p.lights[ctx.lightIndex]
                : scope === "photoLight"
                  ? ctx.p.photo.lights[ctx.photoLightIndex]
                  : scope === "photoLayer"
                    ? ctx.p.photo.layers.find((l) => l.id === ctx.photoSelected)
                    : scope === "photo"
                      ? ctx.p.photo
                      : ctx.p
    );
  }
  /**
   * Setting one colour control from the palette. It goes through the same
   * `fieldTarget` a typed change does, and takes the same undo step, so a
   * colour chosen from a swatch and a colour chosen from the system picker
   * are one edit in two clothes.
   */
  function applyColor(targetKey, color) {
    if (!isColor(color)) return;
    const [scope, key] = String(targetKey).split("|");
    mutate(() => {
      const a = ctx.p.art.find((x) => x.id === ctx.selected);
      const target = fieldTarget(scope, a);
      if (!target) return;
      ctx.colorHistory = rememberColor(ctx.colorHistory, targetKey, target[key]);
      target[key] = color;
      if (scope === "art" && key === "edgeColor") rememberEdge(target);
    });
    saveViewPrefs();
  }
  /**
   * The finish the next original hung on a wall inherits: the last edge
   * colour, edge material and thickness someone chose. Per browser, like the
   * palette — it is how this person frames work, not something about one
   * booth — and it is only ever a starting value, which every placement is
   * free to change afterwards.
   */
  function rememberEdge(a) {
    if (!a) return;
    ctx.lastEdge = {
      edgeColor: isColor(a.edgeColor) ? a.edgeColor : ctx.lastEdge?.edgeColor,
      edgeTexture: a.edgeTexture || ctx.lastEdge?.edgeTexture,
      thickness: Number.isFinite(a.thickness) ? a.thickness : ctx.lastEdge?.thickness,
    };
    saveViewPrefs();
  }
  return { syncArtInputs, syncPanelInputs, reveal, revealPanelFields, syncPedestalInputs, revealPedestalFields, syncShadowInputs, setShadowLive, endShadowGesture, fieldTarget, applyColor, rememberEdge };
}
