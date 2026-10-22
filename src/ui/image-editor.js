// The image editor: a placement's non-destructive edits (rotate, flip, light
// and colour) over a preview of its original. Its buttons stay in the action
// table, which moves later. Moved out of src/main.js's boot() as it was
// (MAIN_SPLIT_PHASE.md, seam 4): `ctx` is boot's state, read through it, and
// the helpers this calls.
import { escapeHTML as e } from "../model.js";
import { normalizeImageEdits } from "../image-edit.js";
import { applyImageEdits } from "../image-paint.js";
import { decodeAt } from "../image-source.js";

export function createImageEditor(ctx) {
  const { currentArtwork, icon, refreshIcons, toast } = ctx;
  let editPreviewRevision = 0;
  const editPreviewSources = new WeakMap();
  function drawImageEditorPreview(a) {
    const preview = document.querySelector("#image-edit-preview");
    const asset = ctx.p.assets[a.asset];
    if (!preview || !asset) return;
    const revision = ++editPreviewRevision;
    const paint = (source) => {
      if (revision !== editPreviewRevision || !document.querySelector("#image-editor").open) return;
      const edited = applyImageEdits(source, a.edits);
      const box = preview.getBoundingClientRect();
      const pixelRatio = Math.min(devicePixelRatio, 2);
      preview.width = Math.max(1, Math.round(box.width * pixelRatio));
      preview.height = Math.max(1, Math.round(box.height * pixelRatio));
      const ctx = preview.getContext("2d");
      ctx.fillStyle = "#11161b";
      ctx.fillRect(0, 0, preview.width, preview.height);
      const fit = Math.min(preview.width / edited.width, preview.height / edited.height) * 0.92;
      const width = edited.width * fit, height = edited.height * fit;
      ctx.drawImage(edited, (preview.width - width) / 2, (preview.height - height) / 2, width, height);
    };
    const cached = editPreviewSources.get(asset);
    if (cached) { paint(cached); return; }
    // 720 px is what this dialog shows; decoding the original at that size is
    // the browser's job, not a full unpack followed by a canvas shrink.
    decodeAt(asset.data, asset.width, asset.height, 720).then(
      (source) => {
        editPreviewSources.set(asset, source);
        paint(source);
      },
      () => {
        if (revision === editPreviewRevision)
          toast("Could not load the editor preview. Your original is still saved.", true);
      },
    );
  }
  function editRange(label, key, value, min, max, step, unit = "") {
    return `<label class="range"><span>${label}<output>${Number(value.toFixed(2))}${unit}</output></span><input type="range" data-edit="${key}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${value}"/></label>`;
  }
  function renderImageEditor() {
    const a = currentArtwork();
    const dialog = document.querySelector("#image-editor");
    if (!a?.asset) {
      dialog.close();
      return;
    }
    a.edits = normalizeImageEdits(a.edits);
    const edits = a.edits;
    document.querySelector("#image-editor-content").innerHTML = `
      <div class="image-editor-heading"><div><span class="eyebrow">NON-DESTRUCTIVE</span><h2>Edit ${e(a.title)}</h2></div><button data-action="editor-cancel" class="icon-only" aria-label="Cancel image edits">${icon("x")}<span>Cancel</span></button></div>
      <div class="image-editor-grid">
        <div class="image-preview-wrap"><canvas id="image-edit-preview" aria-label="Edited image preview"></canvas><p>The uploaded original is preserved. These adjustments apply only to this wall placement.</p></div>
        <div class="image-adjustments">
          <section><h3>Orientation</h3><div class="button-row"><button data-action="rotate-left" aria-label="Rotate 90° counterclockwise">↶ 90°</button><button data-action="rotate-right" aria-label="Rotate 90° clockwise">↷ 90°</button></div><div class="button-row"><button data-action="flip-horizontal" class="${edits.flipX ? "active" : ""}">Flip horizontal</button><button data-action="flip-vertical" class="${edits.flipY ? "active" : ""}">Flip vertical</button></div></section>
          <section><h3>Light and color</h3>
            ${editRange("Exposure","exposure",edits.exposure,-2,2,.05," EV")}
            ${editRange("Contrast","contrast",edits.contrast,-100,100,1)}
            ${editRange("Saturation","saturation",edits.saturation,-100,100,1)}
            ${editRange("Temperature","temperature",edits.temperature,-100,100,1)}
            ${editRange("Tint","tint",edits.tint,-100,100,1)}
          </section>
          <button data-action="reset-image-edits" class="wide">Reset adjustments</button>
        </div>
      </div>
      <div class="image-editor-footer"><button data-action="editor-cancel">Cancel</button><button data-action="editor-save" class="primary">Save edits</button></div>`;
    refreshIcons();
    requestAnimationFrame(() => drawImageEditorPreview(a));
  }
  function scheduleEditedPreview() {
    const a = currentArtwork();
    if (!a) return;
    cancelAnimationFrame(scheduleEditedPreview.frame);
    scheduleEditedPreview.frame = requestAnimationFrame(() => drawImageEditorPreview(a));
  }
  function updateEditorEdits(run) {
    const a = currentArtwork();
    if (!ctx.editingStart || !a?.asset) return;
    a.edits = normalizeImageEdits(a.edits);
    run(a.edits);
    renderImageEditor();
  }
  return { drawImageEditorPreview, renderImageEditor, scheduleEditedPreview, updateEditorEdits };
}
