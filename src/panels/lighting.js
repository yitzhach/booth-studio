// The Lighting tab's builders: the light bar's three levels (drawn in the Art
// show tab as well) and the two drawn drop shadows, Photoshop's rows and the
// angle dial. Looks and Make it beautiful, at the top of the tab, are
// src/ui/polish-panel.js; what the controls do stays in main.js with the
// action table, which moves later. Moved out of src/main.js's boot() as it
// was (MAIN_SPLIT_PHASE.md, seam 9): `ctx` is boot's state, read through it,
// and the helpers this calls.
import { SHADOW_FIELD, SHADOW_MAX, shadowSpec } from "../dropshadow.js";
import { escapeHTML as e, DIFFUSION_MAX, LIGHT_BAR_POWER_SLIDER_MAX, LIGHT_BAR_POWER_STEP } from "../model.js";

export function createLightingPanel(ctx) {
  const { btn, icon, range } = ctx;
  // The three light-bar levels that are worth reaching for while looking at the
  // booth. They appear in two panels — Art show, next to the bar's geometry,
  // and Lighting, next to the spotlights — and used to be written out twice.
  // Two copies of a slider is two ranges to widen and one of them will be
  // missed, which is the whole reason this is a function.
  function lightBarLevels(bar) {
    // Fixture brightness is shown as a percentage of a bar that reads right —
    // 50 is the default, 100 is twice it — while the stored value stays the
    // light's own power. A booth saved brighter than the slider offers widens
    // its own slider rather than being dragged down the moment these controls
    // are drawn. Same move as `panelSlider` and `artSlider`, same reason.
    const power = Math.max(
      LIGHT_BAR_POWER_SLIDER_MAX,
      Math.ceil(bar.power / LIGHT_BAR_POWER_STEP),
    );
    // A booth composed before the slider was a percentage carries the old
    // default, 60 stored units, which is 375 on this scale — a bar nobody
    // would now choose, on a slider stretched to reach it. Rather than
    // rewriting a stored number behind the owner's back, say where it is and
    // offer the one drag back.
    const over = bar.power > LIGHT_BAR_POWER_SLIDER_MAX * LIGHT_BAR_POWER_STEP;
    return `${range("Fixture brightness", "power", bar.power, 0, power, 1, "lightBar", "", LIGHT_BAR_POWER_STEP)}${over ? `<div class="warning">This booth's bar is stored above the scale, so the slider is stretched to ${power} to reach it. 50 is the default.${btn("bar-default", "Set brightness to 50", null, "wide")}</div>` : ""}${range("Temperature", "kelvin", bar.kelvin, 2700, 6500, 100, "lightBar", " K")}${range("Diffusion", "diffusion", Math.min(DIFFUSION_MAX, bar.diffusion), 0, DIFFUSION_MAX, 0.1, "lightBar")}`;
  }
  /**
   * The two drawn shadows, laid out the way Photoshop's Drop Shadow dialog is
   * — asked for with a screenshot of it: Opacity, Angle with its dial and
   * Use Global Light, Distance, Spread and Size, each a slider with the
   * number typed beside it. The eye in each heading shows or hides that
   * shadow without losing its settings. They live in Lighting because they
   * are light, even though they are drawn rather than cast; see
   * src/dropshadow.js for why.
   *
   * The sliders, the typed numbers and the dial move the shadows live
   * (`shadowGesture`, in main.js) and take one undo step per gesture. The
   * eye and Use Global Light are ordinary edits.
   */
  function shadowSection(kind) {
    const s = shadowSpec(ctx.p.booth, kind),
      scope = SHADOW_FIELD[kind],
      name = kind === "behind" ? "Drop shadow" : "Under shadow";
    const heading =
      kind === "behind"
        ? `Drop shadow <span>behind the work</span>`
        : `Second shadow <span>under &amp; to the side</span>`;
    const eye = `<button data-shadow-eye="${kind}" class="eye${s.on ? "" : " off"}" title="${s.on ? "Hide" : "Show"} this shadow" aria-label="${s.on ? "Hide" : "Show"} ${e(name.toLowerCase())}" aria-pressed="${s.on}">${icon(s.on ? "eye" : "eye-off")}</button>`;
    const note =
      kind === "behind"
        ? `Photoshop's drop shadow, on the wall behind every hung work. Angle is where the light comes from; Distance and Size are inches on the wall, so a shadow reads the same at every export size. ${s.on ? "" : "Hidden: its settings are kept, and the eye brings it back."}`
        : `A stronger shadow thrown down and to the side, for weight on the wall. It draws over the one above, so the two read as a tight contact shadow and a soft cast one. ${s.on ? "" : "Hidden until the eye is switched on; set it up first if you like."}`;
    return `<section class="fx${s.on ? "" : " fx-off"}" data-fx="${kind}"><div class="fx-head"><h3>${heading}</h3>${eye}</div>${fxRow(name, "Opacity", "opacity", s.opacity, 0, 100, 1, scope, "%")}${angleRow(name, s, scope)}${fxRow(name, "Distance", "distance", s.distance, 0, SHADOW_MAX, 0.05, scope, "in", 6)}${fxRow(name, "Spread", "spread", s.spread, 0, 100, 1, scope, "%")}${fxRow(name, "Size", "size", s.size, 0, SHADOW_MAX, 0.05, scope, "in", 6)}<p class="muted">${note}</p></section>`;
  }
  /**
   * One Photoshop-style row: the label, a slider, the number and its unit.
   * Both inputs are the same field, so either can be used and the other
   * follows. A slider's travel stops at `reach` where the typed number may
   * go further — fine control over the first few inches matters more than
   * dragging to a foot — unless the value is already past it.
   */
  function fxRow(name, label, key, value, min, max, step, scope, unit, reach = max) {
    const top = Math.max(reach, value);
    const shown = Number(value.toFixed(2));
    return `<div class="fx-row"><span class="fx-label">${label}</span><input type="range" data-field="${key}" data-scope="${scope}" data-fx-live aria-label="${e(name + " " + label.toLowerCase())}" min="${min}" max="${top}" step="${step}" value="${shown}"/><input type="number" data-field="${key}" data-scope="${scope}" data-fx-live aria-label="${e(name + " " + label.toLowerCase() + " value")}" min="${min}" max="${max}" step="${step}" value="${shown}"/><span class="fx-unit">${unit === "in" ? "″" : unit}</span></div>`;
  }
  /** Photoshop's angle row: a dial to drag, the degrees, and Use Global Light. */
  function angleRow(name, s, scope) {
    return `<div class="fx-row fx-angle"><span class="fx-label">Angle</span><span class="fx-dial" data-dial="${scope}" role="slider" tabindex="0" aria-label="${e(name)} angle dial" aria-valuemin="-180" aria-valuemax="180" aria-valuenow="${s.angle}">${dialSVG(s.angle)}</span><input type="number" data-field="angle" data-scope="${scope}" data-fx-live aria-label="${e(name)} angle value" min="-180" max="180" step="1" value="${Math.round(s.angle)}"/><span class="fx-unit">°</span></div><label class="check-field fx-global"><input type="checkbox" data-field="global" data-scope="${scope}" ${s.global ? "checked" : ""}/>Use global light</label>`;
  }
  /** The dial's face: a line from the centre toward the light. */
  function dialSVG(angle) {
    const r = (angle * Math.PI) / 180,
      x = 12 + 8.5 * Math.cos(r),
      y = 12 - 8.5 * Math.sin(r);
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5"/><line x1="12" y1="12" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"/><circle class="hub" cx="12" cy="12" r="1.5"/></svg>`;
  }
  return { lightBarLevels, shadowSection, dialSVG };
}
