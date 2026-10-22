// The show floor: an organizer's plan of numbered booths, edited on the
// drawing board (src/show-editor.js) — the selection's moves, templates and
// sales left without a booth, the keys, the inspector's fields, the shape
// library and the designs linked to floor booths. Its buttons stay in the
// action table, which moves later. Moved out of src/main.js's boot() as it
// was (MAIN_SPLIT_PHASE.md, seam 6): `ctx` is boot's state, read and set
// through it, and the helpers this calls.
import { escapeHTML as e } from "../model.js";
import { STEP, STRIDE } from "../views.js";
import { HALL_LIMITS, STATUSES, boothOf, hallTotals, orphanSales } from "../hall.js";
import { BOOTH_STYLES, DEFAULT_DRAPE, DRAPES, FLOOR_TEMPLATES, KINDS, offFloor, SHAPES, VENUES as SHOW_VENUES, boundsOf, copyPieces, feet, floorOf, mirrorPieces, showBooths, showItems, toFloor } from "../show.js";
import { MAX_FLOOR_TEMPLATES, readFloorTemplates } from "./templates.js";
import { MAX_DESIGNS, OWN, deleteEffect, liveNumber, renumberDesigns, setOpen } from "../linked.js";

export function createShowFloorPanel(ctx) {
  const { btn, confirmAction, field, gated, icon, mutate, renderInspector, setPanTool, setShow3d, setWalking, toast } = ctx;
  /** The selected pieces of the show floor, as stored. */
  const showPieces = () => {
    const ids = new Set(ctx.showEditor?.selection || []);
    return ctx.p.hall?.items ? ctx.p.hall.items.filter((i) => ids.has(i.id)) : [];
  };
  /** The drawing board's selection changed: follow it with the panel. */
  function showSelected(ids) {
    const one = ids.length === 1 ? ctx.p.hall.items?.find((i) => i.id === ids[0]) : null;
    ctx.hallSelected = one?.kind === "booth" ? one.number : null;
    renderInspector();
  }
  /**
   * Give booths new numbers, taking each one's exhibitor, status and price —
   * which `p.hall.booths` keeps by number — and "your booth" with it.
   */
  function renumberBooths(changes) {
    const h = ctx.p.hall;
    const byId = new Map(h.items.map((i) => [i.id, i]));
    const moved = changes.filter((c) => byId.get(c.id)?.number !== c.number);
    const records = {};
    let mine = h.mine;
    const moves = moved.map((c) => ({ from: byId.get(c.id).number, to: c.number }));
    for (const c of moved) {
      const it = byId.get(c.id);
      if (h.booths[it.number]) records[c.number] = h.booths[it.number];
      if (h.mine === it.number) mine = c.number;
    }
    for (const c of moved) delete h.booths[byId.get(c.id).number];
    for (const c of moved) byId.get(c.id).number = c.number;
    Object.assign(h.booths, records);
    if (mine === undefined) delete h.mine;
    else h.mine = mine;
    // A linked design is kept by number too, and follows its booth.
    renumberDesigns(h, moves);
  }
  function showRotate(deg) {
    const ids = new Set(ctx.showEditor?.selection || []);
    if (!ids.size) return;
    mutate(() => {
      for (const it of ctx.p.hall.items) if (ids.has(it.id)) {
        const r = ((it.rot || 0) + deg) % 360;
        if (r) it.rot = r;
        else delete it.rot;
      }
    });
  }
  /**
   * Flip the selection as a mirror would: left for right ("x") or front for
   * back ("y"), about the middle of the selection, each piece's turn
   * mirrored with it (`mirrorPieces`). One undo step; the selection stays.
   */
  function showMirror(axis) {
    const moved = mirrorPieces(showPieces(), axis);
    if (!moved.length) return;
    const by = new Map(moved.map((m) => [m.id, m]));
    mutate(() => {
      for (const it of ctx.p.hall.items) {
        const m = by.get(it.id);
        if (!m) continue;
        it.x = m.x;
        it.y = m.y;
        if (m.rot) it.rot = m.rot;
        else delete it.rot;
      }
    });
  }
  /** Copies of the selection laid right beside it, selected. */
  function showDuplicate() {
    const pieces = showPieces();
    if (!pieces.length) return;
    const box = boundsOf(pieces);
    let ids = [];
    mutate(() => {
      const copies = copyPieces(ctx.p.hall.items, pieces, box.r - box.l, 0, ctx.p.hall.start);
      ctx.p.hall.items.push(...copies);
      ids = copies.map((c) => c.id);
    });
    ctx.showEditor.select(ids);
  }
  function showDelete() {
    const pieces = showPieces();
    if (!pieces.length) return;
    const ids = new Set(pieces.map((i) => i.id));
    const numbers = pieces.filter((i) => i.kind === "booth").map((i) => i.number);
    const effect = deleteEffect(ctx.p.hall, numbers);
    if (effect.refuse) return toast(`Booth ${liveNumber(ctx.p.hall)} holds the design you are editing, and your own booth's design is parked, so there is nowhere to keep this one. Open another booth first.`, true);
    mutate(() => {
      const live = liveNumber(ctx.p.hall);
      for (const it of pieces) if (it.kind === "booth") {
        delete ctx.p.hall.booths[it.number];
        if (ctx.p.hall.mine === it.number) delete ctx.p.hall.mine;
        if (ctx.p.hall.designs) delete ctx.p.hall.designs[it.number];
      }
      if (ctx.p.hall.designs && !Object.keys(ctx.p.hall.designs).length) delete ctx.p.hall.designs;
      // The design being edited loses its booth and becomes your own booth's.
      if (effect.orphan) setOpen(ctx.p.hall, OWN);
      else if (live !== undefined) setOpen(ctx.p.hall, live);
      ctx.p.hall.items = ctx.p.hall.items.filter((i) => !ids.has(i.id));
    });
    if (effect.drop.length) toast(`The linked design${effect.drop.length === 1 ? "" : "s"} of booth ${effect.drop.join(", ")} went with ${effect.drop.length === 1 ? "it" : "them"}. Undo brings ${effect.drop.length === 1 ? "it" : "them"} back.`);
    ctx.hallSelected = null;
    ctx.showEditor.select([]);
    toast(`${pieces.length} piece${pieces.length === 1 ? "" : "s"} deleted. Undo brings ${pieces.length === 1 ? "it" : "them"} back.`);
  }
  /**
   * Start the floor again from a saved template (show.js FLOOR_TEMPLATES):
   * its size and pieces replace the floor's. Sales, "my booth" and linked
   * designs are kept by booth number, so a booth that exists in both keeps
   * everything; undo brings the old floor back whole.
   */
  function applyTemplate(key) {
    const t = FLOOR_TEMPLATES[key];
    if (!t || !ctx.p.hall) return;
    startFrom(t.label, (h) => t.build(h.start));
  }
  /**
   * Sales kept for booth numbers no longer on the floor (hall.js orphanSales),
   * each with a choice of the floor's booths that have no sale of their own
   * to move it to, or Forget.
   */
  function orphanHTML(h) {
    const orphans = orphanSales(h);
    if (!orphans.length) return "";
    const free = showBooths(h).map((b) => b.number).filter((n) => { const r = h.booths[n]; return !r || (!(r.status && r.status !== "open") && !r.name && !r.note); }).sort((a, b) => a - b);
    return `<div class="warning"><strong>${orphans.length} sale${orphans.length === 1 ? "" : "s"} on booths no longer on the floor.</strong> Kept so nothing is lost: move each to a booth on the floor, or forget it.${orphans.map((o) => `<div class="orphan-sale" data-orphan="${o.number}"><p>Booth ${o.number} · ${e(STATUSES[o.status || "open"].label)}${o.name ? " · " + e(o.name) : ""}${o.price ? ` · $${Math.round(o.price).toLocaleString("en-US")}` : ""}</p>${free.length ? `<label class="setting-label">Move to booth<select data-orphan-to="${o.number}" aria-label="Move booth ${o.number}'s sale to">${free.map((n) => `<option value="${n}">${n}</option>`).join("")}</select></label>` : ""}<div class="button-row">${free.length ? btn("hall-orphan-move-" + o.number, "Move", "list-ordered") : ""}${btn("hall-orphan-forget-" + o.number, "Forget", "trash-2")}</div></div>`).join("")}${free.length ? "" : `<p class="muted">Every booth on the floor has a sale of its own; add a booth to move one onto.</p>`}</div>`;
  }
  function startFrom(label, build) {
    const t = { label };
    confirmAction(`Start from “${t.label}”?`, "Every piece on the floor, and its size, is replaced by the template's. Sales, your booth and linked designs stay with their booth numbers. Undo brings this floor back.", () => {
      const h = toFloor(ctx.p.hall);
      const built = build(h);
      mutate(() => {
        h.items = built.items;
        h.venue = built.venue;
      });
      ctx.showEditor?.select([]);
      if (!ctx.show3d) ctx.showEditor?.fit();
      const booths = built.items.filter((i) => i.kind === "booth");
      const orphans = orphanSales(ctx.p.hall).length;
      toast(`“${t.label}”: ${booths.length} booths${booths.length ? `, numbered from ${Math.min(...booths.map((b) => b.number))}` : ""}.${orphans ? ` ${orphans} sale${orphans === 1 ? " is" : "s are"} on booth numbers no longer on the floor — kept, and listed under Sales to move.` : ""}`);
    });
  }
  /** Line the selection up on its top or left edge. */
  function showAlign(edge) {
    const pieces = showPieces();
    if (pieces.length < 2) return toast("Select two or more pieces to line them up.");
    const box = boundsOf(pieces);
    mutate(() => {
      for (const it of pieces) {
        const b = boundsOf([it]);
        if (edge === "t") it.y += box.t - b.t;
        else it.x += box.l - b.l;
      }
    });
  }
  /** A key on the show floor: true when it did something. */
  /** Keys while the show is in 3D: walk (W, then WASD / arrows), Esc, undo. */
  function show3dKey(ev) {
    const mod = ev.ctrlKey || ev.metaKey;
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (mod && k === "z") return ctx.actions[ev.shiftKey ? "redo" : "undo"](), true;
    if (mod || ev.altKey) return false;
    if (ctx.walking) {
      const move = { w: [1, 0], ArrowUp: [1, 0], s: [-1, 0], ArrowDown: [-1, 0], a: [0, -1], ArrowLeft: [0, -1], d: [0, 1], ArrowRight: [0, 1] }[k];
      if (move) return ctx.scene.walk(move[0], move[1], ev.shiftKey ? STRIDE : STEP), true;
      if (k === "Escape") return setWalking(false), true;
      return false;
    }
    if (k === "w") return setWalking(true), true;
    if (k === "h") return setPanTool(!ctx.panTool), true;
    if (k === "Escape") return setShow3d(false), true;
    return false;
  }
  function showFloorKey(ev) {
    const mod = ev.ctrlKey || ev.metaKey;
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (mod && key === "z") return ctx.actions[ev.shiftKey ? "redo" : "undo"](), true;
    if (mod && key === "y") return ctx.actions.redo(), true;
    if (mod && key === "d") return showDuplicate(), true;
    if (mod && key === "a") return ctx.showEditor.select(ctx.p.hall.items.map((i) => i.id)), true;
    if (mod && key === "c") return (ctx.showClipboard = showPieces().map((i) => ({ ...i }))), true;
    if (mod && key === "v") {
      if (!ctx.showClipboard?.length) return false;
      let ids = [];
      mutate(() => {
        const copies = copyPieces(ctx.p.hall.items, ctx.showClipboard, ctx.showGrid || 12, ctx.showGrid || 12, ctx.p.hall.start);
        ctx.p.hall.items.push(...copies);
        ids = copies.map((c) => c.id);
      });
      ctx.showClipboard = ctx.showClipboard.map((i) => ({ ...i, x: i.x + (ctx.showGrid || 12), y: i.y + (ctx.showGrid || 12) }));
      ctx.showEditor.select(ids);
      return true;
    }
    if (mod || ev.altKey) return false;
    if (key === "Delete" || key === "Backspace") return showDelete(), true;
    if (key === "Escape") return ctx.showEditor.select([]), true;
    if (key === "r") return showRotate(ev.shiftKey ? 270 : 90), true;
    if (key === "h") return setPanTool(!ctx.panTool), true;
    if (key === "0") return ctx.showEditor.fit(), true;
    if (key === "+" || key === "=") return ctx.showEditor.zoom(1.25), true;
    if (key === "-") return ctx.showEditor.zoom(1 / 1.25), true;
    const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    if (arrow) {
      const ids = new Set(ctx.showEditor.selection);
      if (!ids.size) return false;
      const step = (ctx.showGrid || 1) * (ev.shiftKey ? 10 : 1);
      mutate(() => {
        for (const it of ctx.p.hall.items) if (ids.has(it.id)) (it.x += arrow[0] * step), (it.y += arrow[1] * step);
      });
      return true;
    }
    return false;
  }
  /**
   * A control of the show floor's panel changed: the selected piece, the
   * floor, the snap grid, the gap or the "Add booths" settings. True when it
   * was one of them.
   */
  function showChange(el) {
    const ds = el.dataset || {};
    const n = Number(el.value);
    const clamp = (v) => Math.min(Number(el.max || Infinity), Math.max(Number(el.min || -Infinity), v));
    if (el.id === "show-grid") {
      ctx.showGrid = n;
      return true;
    }
    if (el.id === "show-gap") {
      ctx.showGap = Number.isFinite(n) ? clamp(n) : 0;
      return true;
    }
    if (ds.showBlock) {
      const k = ds.showBlock;
      if (k === "backToBack") ctx.showBlock.backToBack = el.checked;
      else if (k === "style") ctx.showBlock.style = el.value;
      else if (Number.isFinite(n)) ctx.showBlock[k] = clamp(Math.round(n));
      renderInspector();
      return true;
    }
    if (ds.showVenue) {
      mutate(() => {
        const h = toFloor(ctx.p.hall);
        if (ds.showVenue === "kind") h.venue.kind = el.value;
        else if (ds.showVenue === "drape") {
          if (DRAPES[el.value]) h.venue.drape = el.value;
        }
        else if (Number.isFinite(n)) h.venue[ds.showVenue] = Math.round(clamp(n) * 12);
      });
      return true;
    }
    if (ds.showField) {
      const it = showPieces()[0];
      if (!it) return true;
      const k = ds.showField;
      if (k === "number") {
        const v = Math.round(clamp(n));
        if (!Number.isFinite(v) || v === it.number) return renderInspector(), true;
        if (ctx.p.hall.items.some((i) => i.kind === "booth" && i.number === v)) {
          toast(`Booth ${v} is already on the floor.`, true);
          renderInspector();
          return true;
        }
        mutate(() => renumberBooths([{ id: it.id, number: v }]));
        ctx.hallSelected = v;
        return true;
      }
      mutate(() => {
        if (k === "style") {
          if (el.value === "pipe") delete it.style;
          else it.style = el.value;
        } else if (k === "text") {
          if (el.value.trim()) it.text = el.value.trim().slice(0, 120);
          else delete it.text;
        } else if (Number.isFinite(n)) {
          const v = clamp(n);
          if (k === "rot") {
            const r = ((Math.round(v) % 360) + 360) % 360;
            if (r) it.rot = r;
            else delete it.rot;
          } else it[k] = Math.round(v * 10) / 10;
        }
      });
      return true;
    }
    return false;
  }
  /** The shape library, in the left sidebar while the show floor is open. */
  function showLibraryHTML() {
    const swatch = (sh) => {
      const k = KINDS[sh.kind];
      const w = sh.w ?? k.w;
      const d = sh.d ?? k.d;
      const s = 34 / Math.max(w, d);
      const rw = Math.max(3, w * s);
      const rd = Math.max(3, d * s);
      return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="${20 - rw / 2}" y="${20 - rd / 2}" width="${rw}" height="${rd}" rx="${sh.kind === "column" ? rw / 2 : 1}" fill="${k.fill === "none" ? "#fff" : k.fill}" stroke="${k.line === "none" ? "#9aa3ad" : k.line}"/>${sh.style === "tent" ? `<path d="M${20 - rw / 2} ${20 - rd / 2}L${20 + rw / 2} ${20 + rd / 2}M${20 + rw / 2} ${20 - rd / 2}L${20 - rw / 2} ${20 + rd / 2}" stroke="#aab3bd"/>` : ""}${sh.kind === "label" ? '<text x="20" y="25" font-size="13" text-anchor="middle" fill="#1d232b">Aa</text>' : ""}</svg>`;
    };
    const groups = [["Booths", SHAPES.filter((sh) => sh.kind === "booth")], ["Floor", SHAPES.filter((sh) => ["aisle", "pavilion", "wall", "door", "column"].includes(sh.kind))], ["Features", SHAPES.filter((sh) => ["stage", "table", "desk", "food", "restroom", "label"].includes(sh.kind))]];
    return `<div class="panel-heading"><h2>Shapes</h2>${icon("shapes")}</div><p class="muted show-lib-note">Drag a shape onto the floor, or tap it to drop it in the middle.</p>${groups.map(([name, list]) => `<section class="show-lib"><h3>${name}</h3><div class="show-shapes">${list.map((sh) => `<button class="show-shape" data-show-shape="${sh.key}" title="${e(sh.label || KINDS[sh.kind].label)}">${swatch(sh)}<span>${e(sh.label || KINDS[sh.kind].label)}</span></button>`).join("")}</div></section>`).join("")}`;
  }
  /** The inspector while the show floor is open. */
  /**
   * A selected floor booth's own design: open it in the booth editor, as a
   * new design sized from the piece or the one it already has.
   */
  /** The designs linked to floor booths, and the way back to your own. */
  function linkedHTML() {
    const h = ctx.p.hall;
    const numbers = Object.keys(h.designs || {}).map(Number).filter((n) => n !== OWN).sort((a, b) => a - b);
    const live = liveNumber(h);
    if (!numbers.length && live === undefined && !h.designs?.[OWN]) return "";
    return `<section><h3>Booth designs <span>${numbers.length + (live !== undefined ? 1 : 0)} linked</span></h3><p class="muted">${live !== undefined ? `Booth ${live} is open in the booth editor.` : "The booth editor holds your own booth, on no booth of this floor."}${numbers.length ? ` Also linked: ${numbers.map((n) => "booth " + n).join(", ")} — select one and open it.` : ""}</p>${h.designs?.[OWN] ? `${btn("show-open-own", "Open my own booth", "door-open", "wide")}<p class="muted">The design that was open before any floor booth was, kept on no booth.</p>` : ""}</section>`;
  }
  function designHTML(it) {
    const h = ctx.p.hall;
    const live = liveNumber(h) === it.number;
    const parked = !!h.designs?.[it.number];
    const count = Object.keys(h.designs || {}).length;
    const note = live
      ? "This booth's design is the one open in the booth editor."
      : parked
      ? "This booth has its own design, kept with it. Opening it parks the one open now with its booth."
      : `Opens this booth in the booth editor as a new design, ${feet(Math.min(360, Math.max(48, it.w)))} × ${feet(Math.min(360, Math.max(48, it.d)))} and built as it is on the floor. The one open now is kept with its booth.`;
    return `<section class="show-design"><h3>Design${live ? ' <span class="badge">Open</span>' : parked ? ' <span class="badge">Linked</span>' : ""}</h3>${btn("show-open-booth", live ? "Edit this booth" : parked ? "Open this booth's design" : "Open this booth", "door-open", "primary wide")}<p class="muted">${note}${!live && !parked && count >= MAX_DESIGNS ? ` ${MAX_DESIGNS} linked designs is the limit.` : ""}</p>${btn("import-design", "Import a booth design", "upload", "wide")}<p class="muted">An exhibitor's own design, from the file their Export tab downloads (Send to the show → Download it as a file instead) — or drop that file straight on a booth on the floor. A link they send opens straight onto the floor. It lands on this booth${live || parked ? ", replacing the design it has" : ""}.</p></section>`;
  }
  /**
   * The show in 3D: walk it, have a walkthrough made from its aisles, edit
   * that as a timeline and export it — the booth's own tools, pointed at the
   * floor.
   */
  function show3dPanel() {
    const h = ctx.p.hall;
    const booths = showItems(h).filter((i) => i.kind === "booth").length;
    const home = h.open ?? h.mine;
    return `<div class="button-row">${btn("show-3d", "Back to the plan", "map")}${btn("show-exit", "Back to my booth", "arrow-left")}</div><section class="show-3d"><h3>The show in 3D <span>${booths} booths</span></h3><p class="muted">${Number.isInteger(home) && showItems(h).some((i) => i.number === home) ? `Booth ${home} is drawn as your full design; every other booth is its floor, its drape, walls or tent, and its number.` : "Every booth is drawn light — its floor, its drape, walls or tent, and its number. Mark one “This is my booth” in the plan to see your own design standing in it."} Numbers show for the booths nearest the camera.</p>${btn("show-walk", ctx.walking ? "Stop walking" : "Walk the show", "footprints", ctx.walking ? "primary wide" : "wide")}<p class="muted">From the entrance, at eye height: WASD or the arrows step, Shift strides, drag to look round.</p></section>${gated("video", `<section><h3>Walkthrough video</h3>${btn("show-walkthrough", "Make a walkthrough", "route", "primary wide")}<p class="muted">Lays a camera path down the aisles from the entrance — walkway pieces if the floor has them, otherwise the gaps between rows — as keyframes in the timeline, at a visitor's pace. Play it, move any keyframe, then Export MP4.</p>${btn("edit-timeline", "Edit timeline…", "sliders-horizontal", "wide")}</section>`, "Walkthrough videos of the show are made with the camera timeline. Part of Booth Studio Pro.")}<section><h3>Stills</h3>${btn("export-image", "Export PNG", "download", "wide")}<p class="muted">The view as it is, at the size set in Export.</p>${btn("ai-pack", "Download AI render pack", "sparkles", "wide")}<p class="muted">This view, its depth, a mask of every surface and the show described in words — for repainting with an image model. No model is called.</p></section>`;
  }
  function showFloorPanel() {
    if (ctx.show3d) return show3dPanel();
    const h = ctx.p.hall;
    const f = floorOf(h);
    const pieces = showPieces();
    const t = hallTotals(h);
    const num = (label, key, value, min, max, step, unit, attr) => `<label class="field"><span>${label}</span><div><input type="number" ${attr}="${key}" aria-label="${e(label)}" value="${Number(Number(value).toFixed(2))}" min="${min}" max="${max}" step="${step}"/><small>${unit}</small></div></label>`;
    const pf = (label, key, value, min, max, step = 1, unit = "in") => num(label, key, value, min, max, step, unit, "data-show-field");
    let selectedHTML = `<p class="muted">Tap a piece to select it; drag it to move it. Shift-click, drag a box round several on empty floor, or right-drag a box anywhere. ${ctx.PAN_KEY} right-drag, Space-drag, the Pan tool (H) or a finger on empty floor pans; scroll or pinch to zoom.</p>`;
    if (pieces.length === 1) {
      const it = pieces[0];
      const k = KINDS[it.kind];
      const rec = it.kind === "booth" ? boothOf(h, it.number) : null;
      selectedHTML = `<section class="show-piece"><h3>${it.kind === "booth" ? `Booth ${it.number}${h.mine === it.number ? ' <span class="badge">Yours</span>' : ""}` : e(k.label)} <span>${feet(it.w)} × ${feet(it.d)}</span></h3><div class="field-pair">${pf("Width", "w", it.w, 6, 12000)}${pf("Depth", "d", it.d, 6, 12000)}</div><div class="field-pair">${pf("Across", "x", it.x, -24000, 48000)}${pf("From back", "y", it.y, -24000, 48000)}</div>${pf("Turn", "rot", it.rot || 0, 0, 359, 15, "°")}${it.kind === "booth" ? `${pf("Booth number", "number", it.number, 1, 99999, 1, "#")}<label class="setting-label">Built as<select data-show-field="style" aria-label="Booth built as">${Object.entries(BOOTH_STYLES).map(([key, v]) => `<option value="${key}" ${(it.style || "pipe") === key ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label>` : `<label class="setting-label">Text<input type="text" data-show-field="text" aria-label="Piece text" maxlength="120" value="${e(it.text || "")}" placeholder="${e(k.label)}"/></label>`}<div class="button-row">${btn("show-rotate", "Turn 90°", "rotate-cw")}${btn("show-duplicate", "Duplicate", "copy")}${btn("show-delete", "Delete", "trash-2")}</div><div class="button-row">${btn("show-flip-x", "Flip horizontal", "flip-horizontal-2")}${btn("show-flip-y", "Flip vertical", "flip-vertical-2")}</div></section>${rec ? `<section class="hall-booth"><h3>Sale</h3><label class="setting-label">Status<select data-field="status" data-scope="hallbooth" aria-label="Booth status">${Object.entries(STATUSES).map(([key, v]) => `<option value="${key}" ${rec.status === key ? "selected" : ""}>${e(v.label)}</option>`).join("")}</select></label><label class="setting-label">Exhibitor<input type="text" data-field="name" data-scope="hallbooth" aria-label="Exhibitor" maxlength="120" value="${e(rec.name)}"/></label>${field("Price", "price", rec.price || 0, ...HALL_LIMITS.price, 1, "$", "hallbooth", "Booth price")}<label class="setting-label">Note<input type="text" data-field="note" data-scope="hallbooth" aria-label="Booth note" maxlength="300" value="${e(rec.note)}"/></label>${btn("hall-mine", h.mine === it.number ? "Not my booth" : "This is my booth", "box", "wide")}</section>${designHTML(it)}` : ""}`;
    } else if (pieces.length > 1) {
      selectedHTML = `<section class="show-piece"><h3>${pieces.length} selected <span>${pieces.filter((i) => i.kind === "booth").length} booths</span></h3><div class="button-row">${btn("show-rotate", "Turn 90°", "rotate-cw")}${btn("show-duplicate", "Duplicate", "copy")}${btn("show-delete", "Delete", "trash-2")}</div><div class="button-row">${btn("show-flip-x", "Flip horizontal", "flip-horizontal-2")}${btn("show-flip-y", "Flip vertical", "flip-vertical-2")}</div><div class="button-row">${btn("show-align-top", "Line up tops", "align-start-horizontal")}${btn("show-align-left", "Line up lefts", "align-start-vertical")}</div>${num("Gap between", "show-gap", ctx.showGap, 0, 2400, 1, "in", "id")}${btn("show-space", "Space them evenly", "columns-2", "wide")}<p class="muted">Lays them side by side along the way they run, this far apart, the first staying put. A gap of 0 butts them together; a single booth can then be dragged to break the rhythm.</p>${btn("show-renumber", "Renumber these", "list-ordered", "wide")}${btn("show-deselect", "Done", "check", "wide")}</section>`;
    }
    const b = ctx.showBlock;
    const bf = (label, key, min, max, step = 1, unit = "in") => num(label, key, b[key], min, max, step, unit, "data-show-block");
    return `<div class="button-row">${btn("show-exit", "Back to my booth", "arrow-left")}${btn("show-fit", "Fit floor", "maximize")}</div>${btn("show-3d", "See it in 3D", "box", "primary wide")}${selectedHTML}<div class="mobile-library">${showLibraryHTML()}</div><section><h3>Add booths</h3><div class="field-pair">${bf("How many", "count", 1, 400, 1, "")}${bf("Per row", "perRow", 1, 60, 1, "")}</div><div class="field-pair">${bf("Booth width", "w", 48, 480)}${bf("Booth depth", "d", 48, 480)}</div><div class="field-pair">${bf("Gap in a row", "gap", 0, 480)}${bf("Aisle", "aisle", 36, 480)}</div><label class="check-field"><input type="checkbox" data-show-block="backToBack" ${b.backToBack ? "checked" : ""}/>Rows back to back, in pairs</label><label class="setting-label">Built as<select data-show-block="style" aria-label="New booths built as">${Object.entries(BOOTH_STYLES).map(([key, v]) => `<option value="${key}" ${b.style === key ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label>${btn("show-add-block", "Add booths", "plus", "primary wide")}<p class="muted">Numbered on from the highest booth on the floor, placed below everything already on the floor and selected, ready to drag. The floor grows to take them if it has to.</p></section><section><h3>Floor</h3><label class="setting-label">Venue<select data-show-venue="kind" aria-label="Show venue">${Object.entries(SHOW_VENUES).map(([key, v]) => `<option value="${key}" ${f.kind === key ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label><label class="setting-label">Drape colour<select data-show-venue="drape" aria-label="Drape colour">${Object.entries(DRAPES).map(([c, v]) => `<option value="${c}" ${(h.venue?.drape || DEFAULT_DRAPE) === c ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label><div class="field-pair">${num("Floor width", "width", f.width / 12, 10, 2000, 1, "ft", "data-show-venue")}${num("Floor depth", "depth", f.depth / 12, 10, 2000, 1, "ft", "data-show-venue")}</div><label class="setting-label">Snap grid<select id="show-grid" aria-label="Snap grid">${[[0, "Off"], [1, "1″"], [6, "6″"], [12, "1′"], [24, "2′"], [60, "5′"]].map(([v, l]) => `<option value="${v}" ${ctx.showGrid === v ? "selected" : ""}>${l}</option>`).join("")}</select></label><p class="muted">Pieces snap to each other's edges first, then to this grid. Hold Alt while dragging to place freely. Drape colour is the pipe and drape's in See it in 3D.</p>${(() => {
      const off = offFloor(h).length;
      return off ? `<div class="warning">${off} piece${off === 1 ? " lies" : "s lie"} off the floor's edge, and stand${off === 1 ? "s" : ""} outside the hall in 3D.${btn("show-grow", "Grow the floor to fit", "maximize", "wide")}</div>` : "";
    })()}${btn("show-renumber", "Renumber every booth", "list-ordered", "wide")}</section><section><h3>Start from a template</h3>${Object.entries(FLOOR_TEMPLATES).map(([key, t]) => `${btn("show-template-" + key, t.label, "layout-template", "wide")}<p class="muted">${e(t.note)}</p>`).join("")}${readFloorTemplates().map((t) => `<div class="button-row">${btn("show-mytemplate-" + t.id, "Mine · " + t.label, "layout-template")}${btn("show-forget-template-" + t.id, "Remove", "trash-2")}</div><p class="muted">${t.items.filter((i) => i.kind === "booth").length} booths, ${Math.round(t.venue.width / 12)}′ × ${Math.round(t.venue.depth / 12)}′, saved on this browser.</p>`).join("")}${btn("show-save-template", "Save this floor as a template", "save", "wide")}<p class="muted">Its size and every piece, booth numbers and all — not the sales, your booth or its designs. Kept on this browser, up to ${MAX_FLOOR_TEMPLATES}, and carried in a project backup.</p></section>${linkedHTML()}<section><h3>Sales <span>${t.booths} booths</span></h3><p class="hall-totals">${t.sold} sold · ${t.held} held · ${t.open} open${t.soldValue ? ` · sold $${Math.round(t.soldValue).toLocaleString("en-US")}` : ""}${t.heldValue ? ` · held $${Math.round(t.heldValue).toLocaleString("en-US")}` : ""}</p>${orphanHTML(h)}${field("Default price", "price", h.price, ...HALL_LIMITS.price, 1, "$", "hallplan", "Hall Default price")}<div class="button-row">${btn("hall-map", "Download hall map", "download")}${btn("hall-csv", "Exhibitor list (CSV)", "download")}</div>${btn("hall-delete", "Delete the hall plan", "trash-2", "wide")}</section><section><h3>Keys</h3><p class="muted">Delete removes · Ctrl+D duplicates · R turns 90° · arrows nudge by the grid (Shift: 10×) · Ctrl+A selects all · Esc lets go · 0 fits the floor.</p></section>`;
  }
  return { showPieces, showSelected, renumberBooths, showRotate, showMirror, showDuplicate, showDelete, applyTemplate, startFrom, showAlign, show3dKey, showFloorKey, showChange, showLibraryHTML, showFloorPanel };
}
