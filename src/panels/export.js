// The Export tab's builders: the frame a still or a clip comes out in and
// what it will measure (the Video tab draws the same two), the AI render's
// pack and the power and rentals sheet. The hero set is
// src/ui/polish-panel.js and Keep your work src/ui/keep-safe-panel.js; what
// the controls do stays in main.js with the action table, which moves later.
// Moved out of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam
// 11): `ctx` is boot's state, read through it, and the helpers this calls.
import { CUSTOM_MOVE } from "../camera-path.js";
import { SIZES } from "../video.js";
import { FRAMES, FRAME_MIN, FRAME_MAX, frameSize } from "../framing.js";
import { escapeHTML as e } from "../model.js";
import { PACK_SIZES, SURFACES, provider as aiProvider } from "../ai-render.js";
import { CIRCUIT_WATTS, powerLines, powerTotals } from "../power.js";

export function createExportPanel(ctx) {
  const { btn, frameKeyed, getPlace, selectedKeyName } = ctx;
  /**
   * The frame a delivered file comes out in, for a still and for a clip.
   *
   * Both used to inherit the viewport's shape, which meant an export was
   * whatever size someone's browser window happened to be — reported as "it
   * exports at the same dimensions I have the viewing window at". "This
   * window" is still offered and is still the default, because a shot
   * composed in the viewport is a real intention; the rest name their ratio.
   */
  function frameFields(which) {
    const value = which === "video" ? ctx.videoFrameShape : ctx.exportFrame;
    const options = Object.entries(FRAMES)
      .map(([k, v]) => `<option value="${k}" ${value === k ? "selected" : ""}>${e(v.label)}</option>`)
      .join("");
    const custom =
      value === "custom"
        ? `<div class="field-row"><label class="field"><span>Width</span><div><input type="number" data-frame-custom="width" data-frame-which="${which}" aria-label="Custom frame width" value="${ctx.customFrame.width}" min="${FRAME_MIN}" max="${FRAME_MAX}" step="2"/><small>px</small></div></label><label class="field"><span>Height</span><div><input type="number" data-frame-custom="height" data-frame-which="${which}" aria-label="Custom frame height" value="${ctx.customFrame.height}" min="${FRAME_MIN}" max="${FRAME_MAX}" step="2"/><small>px</small></div></label></div><p class="muted">One custom size, shared by the still and the clip. Sides are rounded to even numbers, which is what an H.264 encoder requires.</p>`
        : "";
    const place = getPlace(which);
    const keyed = which === "video" && frameKeyed();
    const slider = (key, label, min, v) =>
      `<label class="range"><span>${label}<output>${Math.round(v * 100)}%</output></span><input type="range" data-frame-place="${key}" data-frame-which="${which}" aria-label="${e(label)} (${which === "video" ? "video" : "still"})" min="${min}" max="100" step="1" value="${Math.round(v * 100)}"/></label>`;
    // The frame's place in the viewport: the same thing the guide's handles
    // drag, as sliders. Only for a frame with its own shape — "This window"
    // is the viewport and has nowhere to move.
    const placing =
      value === "view"
        ? ""
        : `${keyed ? `<p class="keyed-note">Keyframed: these set <strong>${e(selectedKeyName())}</strong>'s frame.</p>` : which === "video" && ctx.videoMove === CUSTOM_MOVE && ctx.videoTimeline?.frameKeys ? `<p class="keyed-note">This clip's frame is keyframed: each keyframe has its own, set in Edit timeline. These sliders do not move it.</p>` : ""}${slider("scale", "Frame size", 20, place.scale)}${slider("x", "Frame left / right", -100, place.x)}${slider("y", "Frame up / down", -100, place.y)}<p class="muted">Or drag the frame in the viewport: its label moves it, a corner resizes it, an edge changes its shape (and makes it a custom size).</p>${place.scale !== 1 || place.x !== 0 || place.y !== 0 ? btn(`frame-reset-${which}`, "Reset frame to fit", "rotate-ccw", "wide") : ""}`;
    return `<label class="setting-label">Frame<select data-frame="${which}" aria-label="${which === "video" ? "Video frame" : "Export frame"}">${options}</select></label>${custom}${placing}`;
  }
  /** What the chosen frame will actually produce, in pixels, said out loud. */
  function frameNote(which) {
    const viewport = ctx.scene?.renderer?.domElement
      ? ctx.scene.renderer.domElement.width / ctx.scene.renderer.domElement.height
      : 16 / 9;
    const shape =
      which === "video"
        ? frameSize(ctx.videoFrameShape, {
            long: Math.max(SIZES[ctx.videoSize]?.width || 1920, SIZES[ctx.videoSize]?.height || 1080),
            viewport,
            custom: ctx.customFrame,
          })
        : frameSize(ctx.exportFrame, { long: ctx.exportLong, viewport, custom: ctx.customFrame });
    const chosen = which === "video" ? ctx.videoFrameShape : ctx.exportFrame;
    return `${shape.width} × ${shape.height} px${chosen === "view" ? ", the shape of this window" : ""}. ${chosen === "view" ? "" : "The viewport outlines it while this tab is open: what is inside the outline is what the file shows."}`;
  }
  /**
   * Export → AI render (the hook, src/ai-render.js): the frame, its depth
   * pass, its surface mask and the scene in words, as one file for an image
   * model to repaint. No model is called — local-first — until the owner
   * chooses a provider.
   */
  function aiSection() {
    const legend = Object.values(SURFACES).map((x) => `<span class="ai-swatch"><i style="background:${x.color}"></i>${e(x.label)}</span>`).join("");
    return `<section class="ai-render"><h3>AI render</h3><p class="muted">For repainting this view with an image model: the frame as rendered, its depth (near white, far black), a mask with every surface one flat colour, and the artwork and signs alone on transparent — laid back over whatever a model returns, so it never repaints the work. All lined up pixel for pixel, with the scene described in words, in one .json file. The frame is the one set above.</p><div class="ai-legend">${legend}</div><label class="setting-label">Size<select id="ai-size" aria-label="AI render pack size">${PACK_SIZES.map((n) => `<option value="${n}" ${ctx.aiLong === n ? "selected" : ""}>${n} px on the long side</option>`).join("")}</select></label>${btn("ai-pack", "Download AI render pack", "sparkles", "wide")}${btn("ai-render", aiProvider ? `Render with ${aiProvider.name}` : "Render with AI", "sparkles", "wide")}<p class="muted">${aiProvider ? "" : "No AI provider is set up yet — nothing leaves this device. The pack works with any model that takes an image, a depth map or a mask."}</p></section>`;
  }
  /** Export → Power and rentals (Pro): the service desk's two forms. */
  function powerSection() {
    const totals = powerTotals(powerLines(ctx.p, { outlets: ctx.powerOutlets }));
    return `<section><h3>Power and rentals</h3><p class="muted">What to order from the show: <strong>${totals.watts} W · ${totals.amps} A · ${totals.circuits} circuit${totals.circuits === 1 ? "" : "s"}</strong> of 120 V / 15 A, worked out from the lights, screens and outlets in this booth (circuits loaded to ${CIRCUIT_WATTS} W), and every table, chair and riser on its floor with carpet for it.</p><label class="field"><span>General outlets</span><div><input type="number" id="power-outlets" min="0" max="20" step="1" value="${ctx.powerOutlets}" aria-label="General outlets"/><small>ea</small></div></label>${btn("power-sheet", "Download power and rentals sheet", "plug", "wide")}</section>`;
  }
  return { frameFields, frameNote, aiSection, powerSection };
}
