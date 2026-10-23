// The 3D viewport's wiring: the scene itself, made with the callbacks that
// tell this app what was clicked or dragged in it (a work, a free-standing
// wall, a pedestal, a figure), the remembered Fast edit lock and view
// prefs, the frame guide and its drag, and the scene's later callbacks (the
// render rectangle, the Box tool, the tape, the auto quality). Called once
// for its effect. Moved out of src/main.js's boot() as it was
// (MAIN_SPLIT_PHASE.md, seam 18): `ctx` is boot's state, read and set
// through it, and the helpers these call.
import { FRAME_MIN, FRAME_MAX, placeRect, placeFromRect } from "../framing.js";
import { uid, constrainPedestal, boothPanels, MAX_PEDESTALS, FURNITURE, BOX_LIMITS, furnitureKind, boothPedestals } from "../model.js";
import { BoothScene } from "../scene.js";
import { AUTO_QUALITY, startScale } from "../adaptive.js";
import { formatLength } from "../measure.js";

export function createSceneWiring(ctx) {
  const { allowed, checkpoint, frameGuideShape, getPlace, loadViewPrefs, mutate, placeSettled, refreshScene, renderInspector, renderSelection, renderStatus, reveal, revealPanelFields, revealPedestalFields, saveViewPrefs, scheduleSave, setDrawingBox, setPlace, syncPanelInputs, syncPedestalInputs, syncQuality, toast, updateFrameGuide } = ctx;
  try {
    ctx.scene = new BoothScene(
      document.querySelector("#scene"),
      (id, opts = {}) => {
        const adding = !!(opts.add || ctx.addMode) && !!id;
        if (adding && ctx.selected && ctx.selected !== id && ctx.p.art.some((x) => x.id === ctx.selected) || adding && ctx.picked.length) {
          const set = new Set(ctx.picked.length ? ctx.picked : [ctx.selected]);
          // Tapping a work already in the set takes it out again.
          if (set.has(id) && set.size > 1) {
            set.delete(id);
            id = [...set].at(-1);
          } else set.add(id);
          ctx.picked = set.size > 1 ? [...set] : [];
        } else if (!adding) ctx.picked = [];
        ctx.selected = id;
        // Artwork and a free-standing wall are two selections with one pair of
        // arrow-free controls between them; holding both at once would leave
        // the sliders pointing at a wall nobody is looking at.
        if (id) { ctx.selectedPanel = null; ctx.selectedPedestal = null; ctx.selectedPerson = null; }
        // Selecting a work in another booth of the row points the row picker
        // at that booth, so the next original lands beside the one just
        // clicked rather than back at home.
        if (id) ctx.activeBooth = ctx.p.art.find((x) => x.id === id)?.booth || null;
        // A click on a work opens Artwork. A click on nothing used to as well,
        // which left the panel on "Make room for your work" — reported, and
        // asked to land on Layout instead. Any other tab stays where it is,
        // so orbiting from Video or Lighting does not throw the panel away.
        if (id) ctx.tab = "art";
        else if (ctx.tab === "art") ctx.tab = "layout";
        renderSelection();
      },
      (a) => {
        const index = ctx.p.art.findIndex((x) => x.id === a.id);
        if (index < 0) return;
        ctx.p.art[index] = a;
        ctx.scene.updateArtwork(a);
      },
      checkpoint,
      () => {
        refreshScene();
        renderInspector();
        scheduleSave();
      },
      // Clicking a free-standing wall in the viewport opens Layout on it, the
      // way clicking artwork opens Artwork on that. The scene is the thing
      // that knows what was clicked; where its controls live is this file's.
      (key) => {
        if (ctx.selectedPanel === key) return;
        ctx.selectedPanel = key;
        if (key) { ctx.selectedPedestal = null; ctx.selectedPerson = null; ctx.tab = "walls"; }
        renderSelection();
        if (key) revealPanelFields();
      },
      // Mid-drag. The scene has already restood the panel, so this only keeps
      // the project and the two sliders in step; the checkpoint came from
      // onStart and the save from onEnd, exactly as an artwork drag does.
      (panel) => {
        const list = boothPanels(ctx.p),
          index = list.findIndex((x) => x.id === panel.id);
        if (index < 0) return;
        list[index] = panel;
        syncPanelInputs(panel);
      },
      // Clicking a pedestal in the viewport opens the Walls tool on it, the
      // same deal a free-standing wall gets.
      (id) => {
        if (ctx.selectedPedestal === id) return;
        ctx.selectedPedestal = id;
        if (id) { ctx.selectedPanel = null; ctx.selected = null; ctx.selectedPerson = null; ctx.tab = "walls"; }
        renderSelection();
        if (id) revealPedestalFields();
      },
      // Mid-drag: the scene has already restood the pedestal, so this keeps
      // the project and the two sliders in step and nothing else.
      (ped) => {
        const list = boothPedestals(ctx.p),
          index = list.findIndex((x) => x.id === ped.id);
        if (index < 0) return;
        list[index] = ped;
        syncPedestalInputs(ped);
      },
    );
    // Double-clicking a figure opens its card: Layout, scrolled to it, lit.
    ctx.scene.onSelectPerson = (id) => {
      ctx.selectedPerson = id;
      ctx.selected = null;
      ctx.selectedPanel = null;
      ctx.selectedPedestal = null;
      ctx.tab = "layout";
      renderSelection();
      reveal(document.querySelector(`.person-row[data-person="${CSS.escape(id)}"]`));
    };
  } catch (err) {
    document.querySelector("#scene").innerHTML =
      '<div class="webgl-error"><h2>3D is unavailable on this browser</h2><p>Enable hardware acceleration or try another browser. Photo editing, project backups, and hanging guides remain available.</p></div>';
    console.error(err);
  }
  try {
    const saved = localStorage.getItem("booth.draftPolicy");
    if (saved) ctx.draftPolicy = ctx.scene ? ctx.scene.setDraftPolicy(saved) : saved;
  } catch {
    // No storage, no remembered lock: auto is the default and is correct.
  }
  loadViewPrefs();
  // The frame guide follows the viewport's size: a window resize, the
  // inspector folding away on a phone, the timeline dialog opening beside it.
  if (typeof ResizeObserver !== "undefined") {
    const host = document.querySelector("#scene");
    if (host) new ResizeObserver(() => updateFrameGuide()).observe(host);
  }
  // Dragging the frame guide. The label moves the frame; a corner resizes it
  // and keeps its shape; an edge changes its shape, which makes the frame a
  // custom size with the new ratio (the long side keeps the custom size's).
  // Live on the guide during the drag, saved and redrawn in the panel after.
  {
    const guide = document.querySelector(".frame-guide");
    const MIN = 40;
    let drag = null;
    guide?.addEventListener("pointerdown", (ev) => {
      const handle = ev.target.closest?.("[data-fg]");
      const shape = frameGuideShape();
      const host = document.querySelector("#scene");
      if (!handle || !shape || !host || ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      const W = host.clientWidth,
        H = host.clientHeight;
      drag = {
        kind: handle.dataset.fg,
        which: shape.which,
        aspect: shape.aspect,
        W,
        H,
        x0: ev.clientX,
        y0: ev.clientY,
        rect: placeRect(W, H, shape.aspect, getPlace(shape.which)),
        box: host.getBoundingClientRect(),
      };
      handle.setPointerCapture(ev.pointerId);
    });
    guide?.addEventListener("pointermove", (ev) => {
      if (!drag) return;
      const { kind, W, H, rect: r, aspect, box } = drag;
      const dx = ev.clientX - drag.x0,
        dy = ev.clientY - drag.y0;
      const px = Math.max(0, Math.min(W, ev.clientX - box.left)),
        py = Math.max(0, Math.min(H, ev.clientY - box.top));
      let next;
      if (kind === "move") next = { ...r, x: r.x + dx, y: r.y + dy };
      else if (kind.length === 2) {
        // Corner: the opposite corner stays put and the shape is kept.
        const ax = kind.includes("w") ? r.x + r.width : r.x,
          ay = kind.includes("n") ? r.y + r.height : r.y;
        const roomW = kind.includes("w") ? ax : W - ax,
          roomH = kind.includes("n") ? ay : H - ay;
        let w = Math.max(Math.abs(px - ax), Math.abs(py - ay) * aspect);
        w = Math.max(MIN, Math.min(w, roomW, roomH * aspect));
        const h = w / aspect;
        next = { x: kind.includes("w") ? ax - w : ax, y: kind.includes("n") ? ay - h : ay, width: w, height: h };
      } else {
        // Edge: only that side moves, so the ratio changes.
        next = { ...r };
        if (kind === "e") next.width = Math.max(MIN, px - r.x);
        if (kind === "w") (next.width = Math.max(MIN, r.x + r.width - px)), (next.x = r.x + r.width - next.width);
        if (kind === "s") next.height = Math.max(MIN, py - r.y);
        if (kind === "n") (next.height = Math.max(MIN, r.y + r.height - py)), (next.y = r.y + r.height - next.height);
      }
      const { aspect: shaped, place } = placeFromRect(W, H, next);
      if (kind.length === 1) {
        const long = Math.max(ctx.customFrame.width, ctx.customFrame.height, 1080);
        const wide = shaped >= 1;
        ctx.customFrame = {
          width: Math.max(FRAME_MIN, Math.min(FRAME_MAX, Math.round((wide ? long : long * shaped) / 2) * 2)),
          height: Math.max(FRAME_MIN, Math.min(FRAME_MAX, Math.round((wide ? long / shaped : long) / 2) * 2)),
        };
        if (drag.which === "video") ctx.videoFrameShape = "custom";
        else ctx.exportFrame = "custom";
      }
      setPlace(drag.which, place);
      updateFrameGuide();
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      saveViewPrefs();
      placeSettled();
    };
    guide?.addEventListener("pointerup", end);
    guide?.addEventListener("pointercancel", end);
  }
  let adaptToasted = false;
  if (ctx.scene) {
    ctx.scene.onRenderRect = (rect) => {
      ctx.renderRect = rect;
      updateFrameGuide();
    };
    // A footprint drawn with the Box tool becomes a box on the floor, 12″
    // high to start: selected, so the Walls tool's Pull up is right there.
    ctx.scene.onDrawBox = (r) => {
      if (!allowed("box")) return toast("Draw a box is part of Booth Studio Pro.", true);
      const list = boothPedestals(ctx.p);
      if (list.length >= MAX_PEDESTALS) return toast(`${MAX_PEDESTALS} pieces is the limit.`, true);
      const n = list.filter((x) => furnitureKind(x) === "box").length + 1;
      const piece = { id: uid(), name: "Box " + n, kind: "box", x: r.x, z: r.z, width: Math.min(BOX_LIMITS.width[1], r.width), depth: Math.min(BOX_LIMITS.depth[1], r.depth), height: FURNITURE.box.height, rotation: 0 };
      mutate(() => {
        ctx.p.booth.pedestals = [...list, constrainPedestal(ctx.p, piece)];
        ctx.selectedPedestal = piece.id;
        ctx.selectedPanel = null;
        ctx.selected = null;
        ctx.tab = "walls";
      });
      setDrawingBox(false);
      revealPedestalFields();
      toast(`${piece.name}: ${formatLength(piece.width).split(" · ")[0]} × ${formatLength(piece.depth).split(" · ")[0]}, 12″ high. Pull it up in the Walls tool.`);
    };
    ctx.scene.onMeasure = (inches) => {
      ctx.measureHint = inches == null ? ctx.MEASURE_HINT : "Measured " + formatLength(inches) + " · click to start a new tape · Esc to stop";
      renderStatus();
      // The underlay's Scale plan reads the tape; redraw it with the reading.
      if (ctx.p.booth.underlay && ctx.tab === "layout") renderInspector();
    };
    ctx.scene.setQuality(ctx.quality, ctx.quality === AUTO_QUALITY ? startScale(devicePixelRatio, ctx.autoScale) : undefined);
    // Auto stepping down is said once, so a softer picture is never a mystery,
    // and remembered for this display so the next visit starts where this one
    // settled rather than measuring its way down again.
    ctx.scene.onAdapt = (scale) => {
      ctx.autoScale = { dpr: devicePixelRatio || 1, scale };
      saveViewPrefs();
      syncQuality();
      if (!adaptToasted) {
        adaptToasted = true;
        toast("Preview detail lowered to keep up with this computer. Exports are unaffected; the Preview menu under the viewport sets it by hand.");
      }
    };
  }
}
