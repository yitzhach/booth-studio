// The Artwork tab's actions: the saved colours and the edge colour, the image
// editor's buttons, signs and labels, size, upload and replace, duplicate
// and remove, placing a work on its wall and spacing a wall, the several-
// works bar, and the photo layers. Merged back into main.js's one action
// table with Object.assign. Moved out of src/main.js's boot() as it was
// (MAIN_SPLIT_PHASE.md, seam 12): `ctx` is boot's state, read and set
// through it, and the helpers these call.
import { MAX_SWATCHES, isColor, savePalette } from "../swatches.js";
import { DEFAULT_IMAGE_EDITS, normalizeImageEdits } from "../image-edit.js";
import { DEFAULT_EDGE_COLOR, uid, wallSpec } from "../model.js";
import { hangAt, spaceEvenly } from "../arrange.js";
import { ALIGN_MODES, alignWorks, distributeWorks } from "../align.js";

export function createArtworkActions(ctx) {
  const { addWallAsset, arrangePicked, arrangeWall, currentArtwork, drawImageEditorPreview, fieldTarget, fromSnapshot, mutate, render, renderImageEditor, renderInspector, renderSelection, saveViewPrefs, scaleSelected, scheduleSave, snapshot, toast, updateEditorEdits } = ctx;
  return {
    // Saving the colour a control is showing into the palette. Reading it off
    // the model rather than off the input is what makes the button honest
    // about what it saved when the two could differ.
    "swatch-save": (b) => {
      const [scope, key] = String(b.dataset.target || "").split("|");
      const value = fieldTarget(scope, currentArtwork())?.[key];
      if (!isColor(value)) {
        toast("Choose a colour first.", true);
        return;
      }
      ctx.palette = savePalette(ctx.palette, value);
      saveViewPrefs();
      renderInspector();
      toast(`${value} saved · ${ctx.palette.length} of ${MAX_SWATCHES} colours.`);
    },
    // One edge colour over the whole booth, applied now. The switch above it
    // is the live rule; this is for someone who wants the works themselves
    // changed so they keep the colour when the rule goes off again.
    "edges-to-all": () => {
      const color = ctx.p.booth.edgeColor || DEFAULT_EDGE_COLOR;
      let count = 0;
      mutate(() => {
        for (const a of ctx.p.art) {
          if (a.kind === "sign" || a.kind === "label") continue;
          if (a.edgeColor === color) continue;
          a.edgeColor = color;
          count += 1;
        }
      });
      toast(count ? `${count} work${count === 1 ? "" : "s"} painted ${color}.` : "Every work already carries that colour.");
    },
    "edit-image": () => {
      const a = currentArtwork();
      if (!a?.asset) return;
      ctx.editingStart = snapshot();
      a.edits = normalizeImageEdits(a.edits);
      renderImageEditor();
      document.querySelector("#image-editor").showModal();
      requestAnimationFrame(() => drawImageEditorPreview(a));
    },
    "editor-save": () => {
      if (!ctx.editingStart) return;
      ctx.history.push(ctx.editingStart);
      if (ctx.history.length > 35) ctx.history.shift();
      ctx.future = [];
      ctx.editingStart = null;
      document.querySelector("#image-editor").close();
      render();
      scheduleSave();
      toast("Image edits saved to this placement.");
    },
    "editor-cancel": () => {
      if (!ctx.editingStart) return;
      ctx.p = fromSnapshot(ctx.editingStart);
      ctx.editingStart = null;
      clearTimeout(ctx.scheduleEditedPreview.timer);
      document.querySelector("#image-editor").close();
      render();
      toast("Image edits canceled.");
    },
    "rotate-left": () => updateEditorEdits((edits) => (edits.rotation = (edits.rotation + 270) % 360)),
    "rotate-right": () => updateEditorEdits((edits) => (edits.rotation = (edits.rotation + 90) % 360)),
    "flip-horizontal": () => updateEditorEdits((edits) => (edits.flipX = !edits.flipX)),
    "flip-vertical": () => updateEditorEdits((edits) => (edits.flipY = !edits.flipY)),
    "reset-image-edits": () => updateEditorEdits((edits) => Object.assign(edits, DEFAULT_IMAGE_EDITS)),
    "copy-edits": () => {
      const a = currentArtwork();
      if (!a?.asset) return;
      ctx.p.editClipboard = normalizeImageEdits(a.edits);
      scheduleSave();
      renderInspector();
      toast("Image adjustments copied.");
    },
    "paste-edits": () => {
      const a = currentArtwork();
      if (!a?.asset || !ctx.p.editClipboard) {
        toast("Copy adjustments from another image first.", true);
        return;
      }
      mutate(() => (a.edits = structuredClone(ctx.p.editClipboard)));
      toast("Image adjustments pasted.");
    },
    "add-sign": () => addWallAsset("sign"),
    "add-label": () => addWallAsset("label"),
    "scale-smaller": () => scaleSelected(.9),
    "scale-larger": () => scaleSelected(1.1),
    "face-view": () => {
      const a=ctx.p.art.find(a=>a.id===ctx.selected); if(!a)return;
      ctx.scene?.focusWall(a.wall,a.face);
      document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",a.face!=="outside"&&b.dataset.view===a.wall));
    },
    "clear-samples": () =>
      mutate(() => {
        ctx.p.art = ctx.p.art.filter((a) => a.asset || a.kind);
        ctx.selected = ctx.p.art[0]?.id;
      }),
    "upload-art": () => document.querySelector("#art-input").click(),
    "replace-art": () => document.querySelector("#replace-input").click(),
    "upload-photo": () => document.querySelector("#photo-input").click(),
    "duplicate-art": () =>
      mutate(() => {
        const a = ctx.p.art.find((a) => a.id === ctx.selected);
        if (!a) return;
        if (ctx.p.art.length >= 200) { toast("This prototype supports up to 200 panels.", true); return; }
        const copy = { ...a, id: uid(), title: (a.title + " copy").slice(0,200), x: a.x + 6, edits: a.edits ? structuredClone(a.edits) : undefined };
        ctx.p.art.push(copy);
        ctx.selected = copy.id;
      }),
    "delete-art": () =>
      mutate(() => {
        const gone = new Set(ctx.picked.length > 1 ? ctx.picked : [ctx.selected]);
        ctx.picked = [];
        ctx.p.art = ctx.p.art.filter((a) => !gone.has(a.id));
        ctx.selected = ctx.p.art[0]?.id;
      }),
    center: () =>
      mutate(() => {
        const a = ctx.p.art.find((a) => a.id === ctx.selected);
        a.x = ((wallSpec(ctx.p, a.wall)?.width ?? a.w) - a.w) / 2;
      }),
    // A whole wall at once. Only this face of this wall, in this booth: the
    // outside of a wall and a neighbour's wall are someone else's hang.
    "space-wall": () => arrangeWall((works, wall) => {
      const xs = spaceEvenly(works, wall);
      for (const a of works) a.x = xs[a.id];
      return `${works.length} work${works.length === 1 ? "" : "s"} spaced evenly across the wall.`;
    }),
    "hang-wall": () => arrangeWall((works, wall) => {
      const ys = hangAt(works, wall);
      for (const a of works) a.y = ys[a.id];
      return `${works.length} work${works.length === 1 ? "" : "s"} hung with centres at 60″.`;
    }),
    "eye-level": () =>
      mutate(() => {
        const a = ctx.p.art.find((a) => a.id === ctx.selected);
        a.y = 60 - a.h / 2;
      }),
    "match-ratio": () =>
      mutate(() => {
        const a = ctx.p.art.find((a) => a.id === ctx.selected),
          s = ctx.p.assets[a.asset];
        a.h = +((a.w * s.height) / s.width).toFixed(3);
      }),
    "photo-delete": () =>
      mutate(() => {
        ctx.p.photo.layers = ctx.p.photo.layers.filter((l) => l.id !== ctx.photoSelected);
        ctx.photoSelected = null;
      }),
    "photo-front": () =>
      mutate(() => {
        const l = ctx.p.photo.layers.find((l) => l.id === ctx.photoSelected);
        ctx.p.photo.layers = ctx.p.photo.layers.filter((l) => l.id !== ctx.photoSelected);
        ctx.p.photo.layers.push(l);
      }),
    ...Object.fromEntries(Object.keys(ALIGN_MODES).map((mode) => ["align-" + mode, () => arrangePicked((works) => alignWorks(works, mode), "align")])),
    "distribute-x": () => arrangePicked((works) => distributeWorks(works, "x"), "distribute"),
    "distribute-y": () => arrangePicked((works) => distributeWorks(works, "y"), "distribute"),
    "clear-multi": () => {
      ctx.picked = [];
      ctx.addMode = false;
      renderSelection();
    },
    "multi-mode": () => {
      ctx.addMode = !ctx.addMode;
      renderInspector();
      toast(ctx.addMode ? "Select several: tap works to add them. Done selecting ends it." : ctx.picked.length > 1 ? `${ctx.picked.length} works selected.` : "Back to one at a time.");
    },
  };
}
