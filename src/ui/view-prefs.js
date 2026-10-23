// The viewport's own settings and the toolbar's state: the preview quality
// menu (`qualityOptions`, `syncQuality`), `syncTools` (which tools are lit,
// and the Fast edit lock's label), the Fast edit switch and its lock
// (`setDraft`, `setDraftPolicy`), the view settings this browser keeps in
// localStorage (`loadViewPrefs`, `saveViewPrefs`) and the frame guide over
// the viewport (`frameGuideShape`, `updateFrameGuide`). All of those are
// returned. It adds no listener and reads nothing when it is made, so
// main.js calls it before the scene's wiring, which loads the view settings
// as it starts. Moved out of src/main.js's boot() as it was
// (MAIN_SPLIT_PHASE.md, seam 20): `ctx` is boot's state, read and set
// through it, and the helpers these call.
import { FRAMES, CUSTOM_FRAME, FRAME_MIN, FRAME_MAX, STILL_SIZES, placeRect, normalPlace } from "../framing.js";
import { readPalette } from "../swatches.js";
import { escapeHTML as e } from "../model.js";
import { AUTO_QUALITY } from "../adaptive.js";

export function createViewPrefs(ctx) {
  const { getPlace, toast } = ctx;
  /**
   * The preview quality menu's options, with Auto saying which rung it has
   * settled on. Asked on the real machine: "when not editing, what preview
   * quality are we looking at? I don't see where the level is visible." It
   * was a setting at the bottom of Export and a toast said once when Auto
   * stepped down, and nothing else — so the menu now also sits under the
   * viewport, and Auto names where it is.
   */
  function qualityOptions() {
    const rung = ctx.scene?.autoScale;
    const autoText =
      ctx.quality === AUTO_QUALITY && rung
        ? `Auto · now ${rungName(rung)}`
        : "Auto · adapts to this computer";
    return [
      [AUTO_QUALITY, autoText],
      [1, "Efficient · older devices"],
      [2, "Balanced"],
      [3, "High detail · light-bar shadows"],
    ]
      .map(([value, text]) => `<option value="${value}" ${ctx.quality === value ? "selected" : ""}>${e(text)}</option>`)
      .join("");
  }
  /** What a supersampling factor is called, by the fixed setting that draws at it. */
  function rungName(scale) {
    return scale >= 3 ? "High detail, 3×" : scale >= 2 ? "Balanced, 2×" : scale > 1 ? `${scale}×` : "Efficient, 1×";
  }
  /**
   * The menu under the viewport and the one in Export, and beside the first
   * the factor the viewport is actually drawing at — which is not always the
   * setting: fast edit draws at 1× without shadows, and on a Retina display
   * Efficient still draws at the display's own 2×.
   */
  function syncQuality() {
    for (const select of document.querySelectorAll("#quality, #quality-quick")) select.innerHTML = qualityOptions();
    const now = document.querySelector("#quality-now");
    if (!now) return;
    const factor = ctx.scene ? Number(ctx.scene.renderer.getPixelRatio().toFixed(2)) : null;
    now.textContent = !ctx.scene ? "" : ctx.scene.draft ? "fast edit · softest, no shadows" : sharpness(factor);
  }
  /**
   * What the drawing scale looks like, in words rather than a supersampling
   * factor: asked for on the real machine, because "drawing at 2×" meant
   * nothing to someone who is not a graphics programmer. The factor stays in
   * the tooltip for whoever wants it.
   */
  function sharpness(factor) {
    const word = factor >= 3 ? "sharpest" : factor >= 2 ? "sharp" : factor > 1 ? "softer" : "softest";
    document.querySelector("#quality-now")?.setAttribute("title", `Drawing ${factor} pixels for each one on screen`);
    return word;
  }
  function syncTools() {
    syncQuality();
    const draft = !!ctx.scene?.draft;
    document.querySelector('[data-action="measure"]')?.classList.toggle("active", !!ctx.scene?.measure.on);
    for (const el of document.querySelectorAll('.toolbar [data-action="pan"]')) el.classList.toggle("active", ctx.panTool);
    const keep = document.querySelector("#keep-tapes");
    if (keep) keep.checked = !!ctx.scene?.measure.keep;
    document.querySelector('.toolbar [data-action="walk"]')?.classList.toggle("active", ctx.walking);
    document.querySelector('.toolbar [data-action="draw-box"]')?.classList.toggle("active", !!ctx.scene?.drawingBox);
    document
      .querySelector('[data-action="snap"]')
      ?.classList.toggle("active", !!ctx.scene?.snap);
    for (const el of document.querySelectorAll('[data-action="draft"]'))
      el.classList.toggle("active", draft);
    for (const el of document.querySelectorAll("[data-draft]")) el.checked = draft;
    const lockLabels = {
      auto: ["Auto", "Fast edit follows the gesture: on while you arrange a work, off when you let go."],
      on: ["On", "Fast edit is held on. Shadows and supersampling stay off until you unlock it."],
      off: ["Off", "Fast edit is held off. Arranging a work will not drop the quality."],
    };
    const [text, title] = lockLabels[ctx.draftPolicy] || lockLabels.auto;
    for (const el of document.querySelectorAll('[data-action="draft-lock"]')) {
      el.classList.toggle("active", ctx.draftPolicy !== "auto");
      el.classList.toggle("locked-off", ctx.draftPolicy === "off");
      el.title = title;
      el.setAttribute("aria-label", "Fast edit lock: " + text);
      const span = el.querySelector("span");
      if (span) span.textContent = text;
    }
    for (const el of document.querySelectorAll("[data-draft-policy]"))
      el.value = ctx.draftPolicy;
  }
  /**
   * The lock beside the Fast edit button, cycling auto → on → off. Auto is the
   * default and is the gesture deciding for itself; the two locks are for
   * someone who has judged it on their own machine and does not want it
   * changed back under them.
   */
  /**
   * The view settings that belong to this browser rather than to the booth:
   * the export frame, the clip's frame, careful rendering, the saved palette
   * and the last edge finish. None of them is in the backup, none is in the
   * undo history, and none is in schema 1 — the same rule the fast-edit lock
   * follows. Read defensively: a stored value that is no longer offered falls
   * back to the default rather than being trusted.
   */
  function loadViewPrefs() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem("booth.view") || "{}");
    } catch {
      return;
    }
    if (!saved || typeof saved !== "object") return;
    if (FRAMES[saved.exportFrame]) ctx.exportFrame = saved.exportFrame;
    // Before 2026-09-25 every browser saved "This window" for a clip, because
    // that was the default, not because anyone chose it. Those are left at
    // the new widescreen default; a choice saved since (`clipFrame: 2`) is
    // kept, "This window" included.
    if (FRAMES[saved.videoFrameShape] && saved.clipFrame === 2) ctx.videoFrameShape = saved.videoFrameShape;
    if (STILL_SIZES.includes(Number(saved.exportLong))) ctx.exportLong = Number(saved.exportLong);
    if (typeof saved.videoSettle === "boolean") ctx.videoSettle = saved.videoSettle;
    if (saved.framePlace && typeof saved.framePlace === "object")
      ctx.framePlace = { video: normalPlace(saved.framePlace.video), export: normalPlace(saved.framePlace.export) };
    if (saved.customFrame) {
      const clamp = (n, fallback) =>
        Number.isFinite(Number(n)) ? Math.max(FRAME_MIN, Math.min(FRAME_MAX, Math.round(Number(n)))) : fallback;
      ctx.customFrame = {
        width: clamp(saved.customFrame.width, CUSTOM_FRAME.width),
        height: clamp(saved.customFrame.height, CUSTOM_FRAME.height),
      };
    }
    ctx.palette = readPalette(saved.palette);
    if (saved.colorHistory && typeof saved.colorHistory === "object") ctx.colorHistory = saved.colorHistory;
    if (saved.lastEdge && typeof saved.lastEdge === "object") ctx.lastEdge = saved.lastEdge;
    if (saved.quality === AUTO_QUALITY || [1, 2, 3].includes(saved.quality)) ctx.quality = saved.quality;
    if (saved.autoScale && typeof saved.autoScale === "object") ctx.autoScale = saved.autoScale;
  }
  function saveViewPrefs() {
    try {
      localStorage.setItem(
        "booth.view",
        JSON.stringify({ exportFrame: ctx.exportFrame, exportLong: ctx.exportLong, customFrame: ctx.customFrame, videoFrameShape: ctx.videoFrameShape, clipFrame: 2, framePlace: ctx.framePlace, videoSettle: ctx.videoSettle, palette: ctx.palette, colorHistory: ctx.colorHistory, lastEdge: ctx.lastEdge, quality: ctx.quality, autoScale: ctx.autoScale }),
      );
    } catch {
      // A browser with storage switched off keeps all of this for the
      // session; remembering it across one is the only thing lost.
    }
  }
  function setDraftPolicy(policy, announce = true) {
    ctx.draftPolicy = ctx.scene ? ctx.scene.setDraftPolicy(policy) : policy;
    try {
      localStorage.setItem("booth.draftPolicy", ctx.draftPolicy);
    } catch {
      // A browser with storage switched off still gets the setting for this
      // session; remembering it is the only thing that is lost.
    }
    syncTools();
    if (announce)
      toast(
        {
          auto: "Fast edit follows the gesture again: on while you arrange a work, off when you let go.",
          on: "Fast edit locked on. Exports are unaffected.",
          off: "Fast edit locked off. Arranging will not drop the quality.",
        }[ctx.draftPolicy],
      );
  }
  /**
   * Fast edit is the draft renderer: shadows off, supersampling off. It is a
   * view setting, so it is not pushed onto the undo history and does not mark
   * the project dirty — nothing about the booth changed, and every export
   * puts full quality back before it draws a frame.
   *
   * It deliberately does not go through `render()`. That rebuilds the library
   * and the whole inspector, which on a booth full of uploaded originals is
   * the most expensive thing this file does — so the button whose job is to
   * make the app faster used to cost a pause of its own on the way in.
   */
  function setDraft(on, announce = true) {
    if (!ctx.scene || ctx.scene.draft === !!on) {
      syncTools();
      return;
    }
    ctx.scene.setDraft(!!on);
    syncTools();
    if (announce)
      toast(
        ctx.scene.draft
          ? "Fast edit on. Shadows and supersampling are off while you arrange — exports are unaffected."
          : "Full quality. Shadows and supersampling are back.",
      );
  }
  /**
   * The frame guide: the chosen export frame outlined over the viewport, with
   * everything outside it dimmed. Shown while the Video or Export tab is open,
   * the timeline dialog is up, or a move is previewing — the places a shot is
   * composed for a file — and only when the frame is not "This window", which
   * is the viewport already. The export draws exactly what is inside it
   * (scene.js `frameRect`), so composing to the guide is composing the file.
   */
  function frameGuideShape() {
    if (!ctx.scene || ctx.p.mode === "photo") return null;
    const timelineOpen = document.querySelector("#timeline-dialog")?.open;
    const which = ctx.tab === "export" ? "export" : ctx.tab === "video" || timelineOpen || ctx.busyPreview ? "video" : null;
    const id = which === "export" ? ctx.exportFrame : which === "video" ? ctx.videoFrameShape : null;
    if (!id || id === "view" || !FRAMES[id]) return null;
    const aspect = id === "custom" ? ctx.customFrame.width / ctx.customFrame.height : FRAMES[id].aspect;
    return { id, which, aspect, label: id === "custom" ? `${ctx.customFrame.width} × ${ctx.customFrame.height}` : FRAMES[id].label.split(" · ")[1] || FRAMES[id].label };
  }
  function updateFrameGuide() {
    const guide = document.querySelector(".frame-guide");
    const host = document.querySelector("#scene");
    if (!guide || !host) return;
    const shape = frameGuideShape();
    guide.hidden = !shape;
    if (!shape) return;
    guide.dataset.which = shape.which;
    const W = host.clientWidth,
      H = host.clientHeight;
    const r = ctx.renderRect
      ? { x: ctx.renderRect.x * W, y: ctx.renderRect.y * H, width: ctx.renderRect.width * W, height: ctx.renderRect.height * H }
      : placeRect(W, H, shape.aspect, getPlace(shape.which));
    Object.assign(guide.style, {
      left: `${host.offsetLeft}px`,
      top: `${host.offsetTop}px`,
      width: `${host.clientWidth}px`,
      height: `${host.clientHeight}px`,
    });
    Object.assign(guide.firstElementChild.style, {
      left: `${r.x}px`,
      top: `${r.y}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    guide.querySelector(".fg-label").textContent = shape.label;
  }
  return { qualityOptions, syncQuality, syncTools, loadViewPrefs, saveViewPrefs, setDraftPolicy, setDraft, frameGuideShape, updateFrameGuide };
}
