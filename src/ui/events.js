// The page's clicks and keys: the one `click` listener every button on the
// page reaches (its `data-action` goes to the action table, its other
// `data-*` to the tab, the layer, the view, a swatch or an eye), and the
// keyboard — the image editor's Escape, the show floor's and the walk's
// keys, the dial's arrows, the nudges, the tool letters, undo and zoom.
// Called once for its effect. Moved out of src/main.js's boot() as it was
// (MAIN_SPLIT_PHASE.md, seam 17): `ctx` is boot's state, read and set
// through it, and the helpers these call.
import { typingIn } from "../typing.js";
import { SHADOW_FIELD, SHADOW_KINDS, shadowSpec } from "../dropshadow.js";
import { removeSwatch } from "../swatches.js";
import { lightVisible, boothPanels, panelKey, isShown, boothPedestals } from "../model.js";
import { nudge } from "../arrange.js";
import { STEP, STRIDE, newView } from "../views.js";
import { moveSale } from "../hall.js";
import { sentLinks, shareLink } from "../share.js";
import { readFloorTemplates, readTemplates, writeFloorTemplates, writeTemplates } from "./templates.js";
import { assetInDesigns } from "../linked.js";
import { PRO_FEATURES, actionFeature } from "../tier.js";

export function createEvents(ctx) {
  const { addCatalogPlacement, allowed, applyColor, applyTemplate, confirmAction, copyLink, deletePanel, deletePedestal, endShadowGesture, goToView, mutate, nudgeSelection, openQuickStart, removeLink, removeRowSlot, renderInspector, rotateSelection, saveViewPrefs, sendToLink, setDrawingBox, setMeasuring, setShadowLive, setSheet, setWalking, show3dKey, showClearance, showFloorKey, startFrom, toast } = ctx;
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.action) {
      try {
        const action = b.dataset.action;
        // The one gate every Pro action passes: whatever drew the button, a
        // Lite browser gets the reason instead of the tool.
        const feature = actionFeature(action);
        if (feature && !allowed(feature)) {
          toast(`${PRO_FEATURES[feature]} is part of Booth Studio Pro. Layout → Project → Plan switches to Pro.`, true);
          return;
        }
        if (action.startsWith("row-remove-")) removeRowSlot(action.slice(11));
        else if (/^link-(copy|update|delete)-/.test(action)) {
          const [, what, id] = action.match(/^link-(\w+)-(.+)$/);
          const l = sentLinks().find((x) => x.id === id);
          if (!l) renderInspector();
          else if (what === "copy") copyLink(shareLink(l.id));
          else if (what === "update") sendToLink(l);
          else removeLink(l);
        }
        else if (action.startsWith("view-go-")) goToView(action.slice(8));
        else if (action.startsWith("clearance-show-")) showClearance(Number(action.slice(15)));
        else if (action.startsWith("delete-model-")) {
          const id = action.slice(13);
          mutate(() => {
            const gone = (ctx.p.booth.models || []).find((m) => m.id === id);
            ctx.p.booth.models = (ctx.p.booth.models || []).filter((m) => m.id !== id);
            if (!ctx.p.booth.models.length) delete ctx.p.booth.models;
            // The file goes with its last placement.
            if (gone && !(ctx.p.booth.models || []).some((m) => m.asset === gone.asset) && !assetInDesigns(ctx.p, gone.asset)) delete ctx.p.assets[gone.asset];
          });
        }
        else if (action.startsWith("view-update-")) {
          const id = action.slice(12);
          const pose = ctx.scene?.pose();
          if (pose) mutate(() => (ctx.p.views = (ctx.p.views || []).map((v) => (v.id === id ? { ...v, ...newView(pose, id), name: v.name } : v))));
          toast("View replaced with what the camera shows now.");
        }
        else if (action.startsWith("view-delete-")) {
          const id = action.slice(12);
          mutate(() => {
            ctx.p.views = (ctx.p.views || []).filter((v) => v.id !== id);
            if (!ctx.p.views.length) delete ctx.p.views;
          });
        }
        else if (action.startsWith("delete-panel-")) deletePanel(action.slice(13));
        else if (action.startsWith("delete-pedestal-")) deletePedestal(action.slice(16));
        else if (action.startsWith("show-template-")) applyTemplate(action.slice(14));
        else if (action.startsWith("hall-orphan-move-")) {
          const from = Number(action.slice(17));
          const to = Number(document.querySelector(`[data-orphan-to="${from}"]`)?.value);
          let moved = false;
          mutate(() => (moved = moveSale(ctx.p.hall, from, to)));
          toast(moved ? `Booth ${from}'s sale is on booth ${to} now. Undo puts it back.` : `Booth ${to} has a sale of its own, or is not on the floor.`, !moved);
        } else if (action.startsWith("hall-orphan-forget-")) {
          const n = Number(action.slice(19));
          confirmAction(`Forget booth ${n}'s sale?`, "Its status, exhibitor, price and note go. Undo brings them back.", () => mutate(() => delete ctx.p.hall.booths[n]));
        }
        else if (action.startsWith("show-mytemplate-")) {
          const t = readFloorTemplates().find((x) => x.id === action.slice(16));
          if (t && ctx.p.hall) startFrom(t.label, () => ({ venue: { ...t.venue }, items: t.items.map((it) => ({ ...it })) }));
        } else if (action.startsWith("show-forget-template-")) {
          writeFloorTemplates(readFloorTemplates().filter((x) => x.id !== action.slice(21)));
          renderInspector();
        }
        else if (action.startsWith("qs-forget-")) {
          writeTemplates(readTemplates().filter((t) => t.id !== action.slice(10)));
          openQuickStart();
        }
        else ctx.actions[action]?.(b);
      } catch (err) {
        toast(err.message, true);
      }
    }
    if (b.dataset.tab) {
      // On a phone a folded panel comes back when a tab is chosen: choosing
      // one is asking to see it.
      setSheet(false);
      ctx.tab = b.dataset.tab;
      renderInspector();
    }
    if (b.dataset.source) addCatalogPlacement(b.dataset.source);
    if (b.dataset.layer) {
      ctx.photoSelected = b.dataset.layer;
      renderInspector();
      ctx.photo.update(ctx.p, ctx.photoSelected);
    }
    if (b.dataset.walk) {
      const [f, r] = { forward: [1, 0], back: [-1, 0], left: [0, -1], right: [0, 1] }[b.dataset.walk] || [0, 0];
      ctx.scene?.walk(f, r, STRIDE / 2);
      return;
    }
    if (b.dataset.view) {
      if (ctx.walking) setWalking(false);
      ctx.scene?.setView(b.dataset.view);
      document
        .querySelectorAll("[data-view]")
        .forEach((x) => x.classList.toggle("active", x === b));
    }
    if (b.dataset.color) mutate(() => (ctx.p.booth.color = b.dataset.color));
    // A saved colour, applied to the control it sits under. Shift-click takes
    // it out of the palette instead: seven slots is few enough that one
    // colour nobody wants any more is a seventh of the palette.
    if (b.dataset.swatch && b.dataset.target) {
      if (ev.shiftKey && !b.classList.contains("swatch-previous")) {
        ctx.palette = removeSwatch(ctx.palette, b.dataset.swatch);
        saveViewPrefs();
        renderInspector();
      } else applyColor(b.dataset.target, b.dataset.swatch);
    }
    // The eye beside a spotlight. Hiding one keeps its position, its aim and
    // its power — deleting it, which used to be the only way to take a light
    // out of a composition, threw all three away.
    if (b.dataset.lightEye !== undefined) {
      const index = +b.dataset.lightEye;
      const list = ctx.p.mode === "photo" ? ctx.p.photo.lights : ctx.p.lights;
      const light = list[index];
      if (light) {
        mutate(() => (light.on = !lightVisible(light)));
        toast(lightVisible(light) ? `Spotlight ${index + 1} showing.` : `Spotlight ${index + 1} hidden. Its position and aim are kept.`);
      }
      return;
    }
    // Lock a floor piece: still drawn, no longer picked in the viewport, so a
    // box laid down as a stage or a floor can be clicked through. Only this
    // button and the piece's own controls change it.
    if (b.dataset.lockPedestal) {
      const id = b.dataset.lockPedestal,
        item = boothPedestals(ctx.p).find((x) => x.id === id);
      if (!item) return;
      const lock = !item.locked;
      mutate(() => {
        if (lock) item.locked = true;
        else delete item.locked;
        if (lock && ctx.selectedPedestal === id) ctx.selectedPedestal = null;
      });
      toast(lock ? "Locked. Clicks in the booth pass through it; change it here, or unlock it." : "Unlocked. Click it in the booth to select it again.");
      return;
    }
    // Hide a piece rather than delete it. Letting go of it too, if it was the
    // one selected: its controls stay in the list, but there is nothing left
    // in the viewport for a selection outline or a drag to point at.
    if (b.dataset.hide) {
      const kind = b.dataset.hide,
        id = b.dataset.hideId;
      const list = kind === "pedestal" ? boothPedestals(ctx.p) : kind === "panel" ? boothPanels(ctx.p) : kind === "model" ? ctx.p.booth.models || [] : ctx.p.booth.people || [];
      const item = list.find((x) => x.id === id);
      if (!item) return;
      const hide = isShown(item);
      mutate(() => {
        if (hide) item.hidden = true;
        else delete item.hidden;
        if (hide && kind === "pedestal" && ctx.selectedPedestal === id) ctx.selectedPedestal = null;
        if (hide && kind === "panel" && ctx.selectedPanel === panelKey(id)) ctx.selectedPanel = null;
      });
      const what = { pedestal: "Piece", panel: "Free-standing wall", person: "Figure", model: "Model" }[kind] || "Piece";
      toast(hide ? `${what} hidden. Its size and place are kept; the eye brings it back.` : `${what} showing again.`);
      return;
    }
    // The eye in a drawn shadow's heading. Hidden keeps every setting, so
    // the second shadow can be set up before it is shown.
    if (b.dataset.shadowEye) {
      const kind = b.dataset.shadowEye;
      if (!SHADOW_KINDS.includes(kind)) return;
      mutate(() => {
        const record = (ctx.p.booth[SHADOW_FIELD[kind]] = shadowSpec(ctx.p.booth, kind));
        record.on = !record.on;
      });
      const on = shadowSpec(ctx.p.booth, kind).on;
      toast(`${kind === "behind" ? "Drop shadow" : "Second shadow"} ${on ? "showing" : "hidden. Its settings are kept"}.`);
      return;
    }
    if (b.dataset.light !== undefined) {
      if (ctx.p.mode === "photo") ctx.photoLightIndex = +b.dataset.light;
      else ctx.lightIndex = +b.dataset.light;
      renderInspector();
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (document.querySelector("#image-editor").open) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ctx.actions["editor-cancel"]();
      }
      return;
    }
    if (
      typingIn(ev) ||
      document.querySelector("#dialog").open
    )
      return;
    // The show in 3D: walking, and the way back to the plan.
    if (ctx.showFloor && ctx.show3d) {
      if (show3dKey(ev)) ev.preventDefault();
      return;
    }
    // The show floor has keys of its own, and none of the booth's apply.
    if (ctx.showFloor && ctx.showEditor) {
      if (showFloorKey(ev)) ev.preventDefault();
      return;
    }
    // The shadow angle dial, focused: arrows turn it a degree, Shift fifteen,
    // counterclockwise for Up and Right the way the angle is measured.
    if (ev.target.dataset?.dial) {
      const turn = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[ev.key];
      if (!turn) return;
      ev.preventDefault();
      const kind = SHADOW_KINDS.find((k) => SHADOW_FIELD[k] === ev.target.dataset.dial);
      if (!kind) return;
      setShadowLive(ev.target.dataset.dial, "angle", shadowSpec(ctx.p.booth, kind).angle + turn * (ev.shiftKey ? 15 : 1));
      endShadowGesture();
      return;
    }
    // Walking: WASD and the arrows step, Shift strides, Esc stops. Before the
    // nudge keys, which would otherwise move the selected work instead.
    if (ctx.walking) {
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      const move = { w: [1, 0], ArrowUp: [1, 0], s: [-1, 0], ArrowDown: [-1, 0], a: [0, -1], ArrowLeft: [0, -1], d: [0, 1], ArrowRight: [0, 1] }[k];
      if (move && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        ctx.scene.walk(move[0], move[1], ev.shiftKey ? STRIDE : STEP);
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        setWalking(false);
        return;
      }
    }
    if (ev.key === "Escape" && ctx.scene?.drawingBox) {
      ev.preventDefault();
      setDrawingBox(false);
      return;
    }
    if (ev.key === "Escape" && ctx.scene?.measure.on) {
      ev.preventDefault();
      setMeasuring(false);
      return;
    }
    const step = nudge(ev.key, ev.shiftKey);
    if (step && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      if (nudgeSelection(...step)) ev.preventDefault();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "d") {
      ev.preventDefault();
      if (ctx.p.mode === "3d" && ctx.selected) ctx.actions["duplicate-art"]();
      return;
    }
    if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && ctx.scene && ctx.p.mode === "3d") {
      const key = ev.key.toLowerCase();
      if (key === "r" && rotateSelection(ev.shiftKey ? -15 : 15)) return ev.preventDefault();
      if (key === "v") return ctx.actions.select();
      if (key === "m") return ctx.actions.move();
      if (key === "h") return ctx.actions.pan();
      if (key === "t") return ctx.actions.measure();
      if (key === "w") return setWalking(true);
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      ctx.actions[ev.shiftKey ? "redo" : "undo"]();
    }
    if (ev.key === "Delete" || ev.key === "Backspace") {
      ev.preventDefault();
      if (ctx.p.mode === "photo" && ctx.photoSelected) ctx.actions["photo-delete"]();
      else if (ctx.p.mode === "3d" && ctx.selected) ctx.actions["delete-art"]();
    }
    // +/- zoom the viewport, matching the on-screen zoom buttons. Both rows of
    // keys count: "=" is the unshifted key "+" lives on, and the numpad sends
    // "Add"/"Subtract" as "+"/"-" already. Ctrl/Cmd is left alone so the
    // browser's own page zoom still works.
    if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      if (ev.key === "+" || ev.key === "=") {
        ev.preventDefault();
        ctx.actions["zoom-in"]();
      } else if (ev.key === "-" || ev.key === "_") {
        ev.preventDefault();
        ctx.actions["zoom-out"]();
      }
    }
  });
}
