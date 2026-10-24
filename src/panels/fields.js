// The panels' small builders: `field` (a number field), `range` (a slider),
// `colorField` (a colour control with the saved palette under it), `hideEye`
// (the eye that hides a piece), and the Pro lock: `allowed` (whether this
// browser's tier has a feature), `proLock` (what a Pro section shows in
// Lite) and `gated` (one or the other). All are returned: the section
// builders reach them through `ctx`. Moved out of src/main.js's boot() as it
// was (MAIN_SPLIT_PHASE.md, seam 21): `ctx` is boot's state, read through
// it, and the helpers these call.
import { MAX_SWATCHES, previousColor } from "../swatches.js";
import { escapeHTML as e } from "../model.js";
import { PRO_FEATURES, can } from "../tier.js";

export function createFields(ctx) {
  const { btn, icon } = ctx;
  function field(
    label,
    key,
    value,
    min = 0,
    max = 360,
    step = 0.25,
    unit = "in",
    scope = "art",
    // Several panels each show a "Width" and a "Position X". The visible label
    // is right as it is; the accessible name has to say which panel.
    aria = label,
  ) {
    return `<label class="field"><span>${label}</span><div><input type="number" data-field="${key}" data-scope="${scope}" aria-label="${e(aria)}" value="${Number(value.toFixed(3))}" min="${min}" max="${max}" step="${step}"/><small>${unit}</small></div></label>`;
  }
  /**
   * The eye beside a piece someone added — a free-standing wall, a pedestal or
   * piece of furniture, a figure — asked for as "a hide button, so you don't
   * need to delete; you can just hide it". Hidden keeps its size and place;
   * see `isShown` in model.js for everything it is left out of.
   */
  function hideEye(kind, id, name, shown) {
    return `<button data-hide="${kind}" data-hide-id="${e(id)}" class="eye" title="${shown ? "Hide" : "Show"} ${e(name)}" aria-label="${shown ? "Hide" : "Show"} ${e(name)}" aria-pressed="${!shown}">${icon(shown ? "eye" : "eye-off")}</button>`;
  }
  /** Whether this browser's tier includes a feature. The only question asked. */
  const allowed = (feature) => can(ctx.tier, feature);
  /**
   * What a Pro section shows in Lite: its name, a lock, and the one way on.
   * The section's own controls are not drawn at all, so nothing in it can be
   * half-used; the booth itself still draws every Pro part it carries.
   */
  function proLock(feature, what = "") {
    const name = PRO_FEATURES[feature] || "This tool";
    return `<section class="pro-lock" data-pro-lock="${e(feature)}"><h3>${e(name)} <span class="pro-badge">${icon("lock")}Pro</span></h3><p class="muted">${e(what || name + " is part of Booth Studio Pro.")}</p>${btn("tier-pro", "Switch to Pro", "zap", "wide")}</section>`;
  }
  /** A Pro section's markup, or its lock in Lite. */
  const gated = (feature, html, what) => (allowed(feature) ? html : proLock(feature, what));
  /**
   * A colour control, with the saved palette under it.
   *
   * The operating system's own colour window opens from the swatch and
   * nothing can be added inside it, so the seven saved colours and Previous
   * sit in the panel directly beneath — the same place the fixed finishes
   * already are, one gesture away either way. Saving is explicit: a colour is
   * kept because someone pressed Save, not because they passed through it.
   */
  function colorField(label, key, scope, value, aria = label) {
    const target = `${scope}|${key}`,
      current = (value || "#ffffff").toLowerCase(),
      previous = previousColor(ctx.colorHistory, target, current);
    const chip = (color, attrs, title, text = "") =>
      `<button ${attrs} style="background:${e(color)}" title="${e(title)}" aria-label="${e(title)}">${text}</button>`;
    const saved = ctx.palette
      .map((c) => chip(c, `data-swatch="${e(c)}" data-target="${e(target)}"`, `Use ${c} · shift-click to forget it`))
      .join("");
    return `<div class="color-block"><label class="color-field">${label}<input type="color" data-field="${e(key)}" data-scope="${e(scope)}" aria-label="${e(aria)}" value="${e(current)}"/></label><div class="swatches saved-swatches">${saved}${
      ctx.palette.length < MAX_SWATCHES
        ? `<button class="swatch-save" data-action="swatch-save" data-target="${e(target)}" title="Save ${current} to the palette" aria-label="Save this colour to the palette">+</button>`
        : ""
    }${
      previous
        ? chip(previous, `class="swatch-previous" data-swatch="${e(previous)}" data-target="${e(target)}"`, `Previous · ${previous}`, "<span>Previous</span>")
        : ""
    }</div></div>`;
  }
  function range(
    label,
    key,
    value,
    min,
    max,
    step,
    scope = "global",
    unit = "",
    // How many stored units one point of this slider is worth. 1 — every
    // slider but one — means the control is the stored number itself.
    scale = 1,
  ) {
    const shown = value / scale;
    return `<label class="range"><span>${label}<output>${Number(shown.toFixed(2))}${unit}</output></span><input type="range" data-field="${key}" data-scope="${scope}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${shown}"${scale === 1 ? "" : ` data-scale="${scale}"`}/></label>`;
  }
  return { field, hideEye, allowed, proLock, gated, colorField, range };
}
