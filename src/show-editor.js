// The show floor's drawing board: the plan of a whole show, full-screen in
// the viewport, edited the way a floor-plan drawing tool edits one.
//
// It is an SVG in real inches, panned and zoomed through its viewBox, so a
// thousand booths are a thousand DOM groups the browser already knows how to
// hit-test, and their numbers stay crisp at any zoom. The pieces are drawn by
// src/show.js; this file is the gestures:
//
// - a piece dragged moves the whole selection, snapping to the other pieces'
//   edges and centres and otherwise to the grid, with the line it snapped to
//   drawn while it happens;
// - a lone selection has eight handles to resize it (in its own turned frame)
//   and the grid snaps its size;
// - an empty drag with a mouse draws a selection box, and so does a right-
//   drag anywhere, over pieces or not — the box drawn as it goes; with a
//   finger an empty drag pans; two fingers pinch; the wheel zooms about the
//   pointer; Space, the middle button, ⌘/Ctrl with the right button, or the
//   Pan tool (`panTool()`) pans;
// - a shape pressed in the library and dragged onto the floor lands where it
//   is let go, and a shape tapped lands in the middle of the view.
//
// During a gesture only the moving groups' transforms change; the plan itself
// is written once, when the gesture ends, as one undo step — through `edit`,
// which the app wraps in its own checkpoint and redraw.
import { KINDS, boundsOf, boxOf, floorOf, floorSVG, makePiece, pieceSVG, piecesSVG, showItems, snapMove, toGrid } from "./show.js";

const NS = "http://www.w3.org/2000/svg";
const HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
const MIN_SIZE = 6;
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * `host` is the element to fill. `hall()` returns the plan (always one with
 * pieces while the board is open), `edit(fn)` makes a change to it as one undo
 * step, `onSelect(ids)` hears every change of selection, `grid()` is the snap
 * grid in inches (0 for none).
 */
export function createShowEditor(host, { hall, edit, onSelect = () => {}, grid = () => 12, panTool = () => false }) {
  host.innerHTML = `<svg class="show-svg" xmlns="${NS}" tabindex="0" aria-label="Show floor plan"><g class="sf-floor"></g><g class="sf-pieces"></g><g class="sf-guides"></g><rect class="sf-marquee" hidden fill="rgba(47,125,225,0.10)" stroke="#2f7de1" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/><g class="sf-handles"></g></svg><div class="sf-ghost" hidden></div>`;
  const svg = host.querySelector("svg");
  const layers = { floor: svg.querySelector(".sf-floor"), pieces: svg.querySelector(".sf-pieces"), guides: svg.querySelector(".sf-guides"), handles: svg.querySelector(".sf-handles") };
  const marquee = svg.querySelector(".sf-marquee");
  // An SVG element has no `hidden` property — setting one is a plain
  // expando and the attribute stays, which the page's [hidden] rule obeys —
  // so the box is shown and hidden by its attribute.
  const showMarquee = (on) => marquee.toggleAttribute("hidden", !on);
  const ghost = host.querySelector(".sf-ghost");
  let view = null; // { x, y, s }: the top-left corner in inches and pixels per inch
  let selection = new Set();
  let gesture = null;
  let spaceDown = false;
  const pointers = new Map();

  const items = () => showItems(hall());
  const size = () => ({ w: host.clientWidth || 1, h: host.clientHeight || 1 });
  const byId = (id) => items().find((i) => i.id === id);
  const groupOf = (id) => layers.pieces.querySelector(`[data-id="${CSS.escape(id)}"]`);

  function applyView() {
    const { w, h } = size();
    svg.setAttribute("viewBox", `${r1(view.x)} ${r1(view.y)} ${r1(w / view.s)} ${r1(h / view.s)}`);
    drawHandles();
  }
  /** Fit the floor and every piece into view. */
  function fit() {
    const h = hall();
    const f = floorOf(h);
    const box = boundsOf(items()) || { l: 0, r: f.width, t: 0, b: f.depth };
    const l = Math.min(0, box.l);
    const t = Math.min(0, box.t);
    const w = Math.max(f.width, box.r) - l;
    const d = Math.max(f.depth, box.b) - t;
    const s0 = size();
    const s = Math.min(s0.w / (w * 1.12), s0.h / (d * 1.16));
    view = { s, x: l + w / 2 - s0.w / s / 2, y: t + d / 2 - s0.h / s / 2 };
    applyView();
  }
  /** Zoom by `factor` about a point on screen (the middle when not given). */
  function zoom(factor, cx, cy) {
    const { w, h } = size();
    const r = svg.getBoundingClientRect();
    cx = cx ?? r.left + w / 2;
    cy = cy ?? r.top + h / 2;
    const at = toWorld(cx, cy);
    view.s = Math.max(0.02, Math.min(40, view.s * factor));
    view.x = at.x - (cx - r.left) / view.s;
    view.y = at.y - (cy - r.top) / view.s;
    applyView();
  }
  function toWorld(cx, cy) {
    const r = svg.getBoundingClientRect();
    return { x: view.x + (cx - r.left) / view.s, y: view.y + (cy - r.top) / view.s };
  }

  function render() {
    const h = hall();
    if (!h) return;
    const ids = new Set(items().map((i) => i.id));
    for (const id of selection) if (!ids.has(id)) selection.delete(id);
    layers.floor.innerHTML = floorSVG(h);
    layers.pieces.innerHTML = piecesSVG(h, selection);
    if (!view) fit();
    else applyView();
  }
  /** Redraw just the pieces whose selection changed, not the whole floor. */
  function redrawPieces(ids) {
    const h = hall();
    for (const id of ids) {
      const g = groupOf(id);
      const it = byId(id);
      if (!g || !it) continue;
      g.outerHTML = pieceSVG(it, h, { selected: selection.has(id) });
    }
  }
  function select(ids, { silent = false } = {}) {
    const before = selection;
    selection = new Set(ids);
    redrawPieces(new Set([...before, ...selection]));
    drawHandles();
    if (!silent) onSelect([...selection]);
  }

  /** The eight resize handles, a fixed size on screen, for a lone piece. */
  function drawHandles() {
    layers.handles.innerHTML = "";
    if (selection.size !== 1 || !view) return;
    const it = byId([...selection][0]);
    if (!it) return;
    const px = (window.matchMedia?.("(pointer: coarse)").matches ? 22 : 11) / view.s;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("transform", `translate(${r1(it.x)} ${r1(it.y)}) rotate(${it.rot || 0})`);
    for (const [sx, sy] of HANDLES) {
      if (it.kind === "column" && (sx === 0 || sy === 0)) continue;
      const hnd = document.createElementNS(NS, "rect");
      hnd.setAttribute("x", r1((sx * it.w) / 2 - px / 2));
      hnd.setAttribute("y", r1((sy * it.d) / 2 - px / 2));
      hnd.setAttribute("width", r1(px));
      hnd.setAttribute("height", r1(px));
      hnd.setAttribute("class", "sf-handle");
      hnd.dataset.handle = `${sx},${sy}`;
      g.appendChild(hnd);
    }
    layers.handles.appendChild(g);
  }
  function drawGuides(guides) {
    const f = floorOf(hall());
    const far = Math.max(f.width, f.depth) * 3;
    layers.guides.innerHTML = guides
      .map((g) => (g.axis === "x" ? `<line x1="${g.at}" y1="${-far}" x2="${g.at}" y2="${far}"/>` : `<line x1="${-far}" y1="${g.at}" x2="${far}" y2="${g.at}"/>`))
      .join("");
  }

  // ---- Gestures -----------------------------------------------------------
  function down(ev) {
    if (!view) return;
    svg.focus({ preventScroll: true });
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    svg.setPointerCapture?.(ev.pointerId);
    if (pointers.size === 2) {
      // A second finger: whatever the first began becomes a pinch.
      cancelGesture();
      const [a, b] = [...pointers.values()];
      gesture = { type: "pinch", dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      return;
    }
    if (pointers.size > 2) return;
    const at = toWorld(ev.clientX, ev.clientY);
    const start = { cx: ev.clientX, cy: ev.clientY, at };
    // Right-drag draws the selection box, over pieces or not; with ⌘ or
    // Ctrl held it pans instead.
    if (ev.button === 1 || (ev.button === 2 && (ev.metaKey || ev.ctrlKey)) || spaceDown || (ev.button === 0 && panTool())) {
      gesture = { type: "pan", ...start, view: { ...view }, tap: ev.button === 0 };
      return;
    }
    if (ev.button === 2) {
      gesture = { type: "marquee", ...start, add: ev.shiftKey ? new Set(selection) : null, right: true };
      return;
    }
    const handle = ev.target.closest?.("[data-handle]");
    if (handle) {
      const it = byId([...selection][0]);
      const [sx, sy] = handle.dataset.handle.split(",").map(Number);
      gesture = { type: "resize", ...start, id: it.id, from: { ...it }, sx, sy };
      return;
    }
    const g = ev.target.closest?.("[data-id]");
    if (g) {
      const id = g.dataset.id;
      if (ev.shiftKey || ev.metaKey || ev.ctrlKey) {
        const next = new Set(selection);
        next.has(id) ? next.delete(id) : next.add(id);
        select(next);
        if (!next.has(id)) return;
      } else if (!selection.has(id)) select([id]);
      const moving = items().filter((i) => selection.has(i.id)).map((i) => ({ ...i }));
      gesture = { type: "move", ...start, id, moving, others: items().filter((i) => !selection.has(i.id)), moved: false };
      return;
    }
    if (ev.pointerType === "mouse") gesture = { type: "marquee", ...start, add: ev.shiftKey ? new Set(selection) : null };
    else gesture = { type: "pan", ...start, view: { ...view }, tap: true };
  }
  function move(ev) {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (!gesture) return;
    if (gesture.type === "pinch") {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      view.x -= (mid.x - gesture.mid.x) / view.s;
      view.y -= (mid.y - gesture.mid.y) / view.s;
      zoom(dist / gesture.dist, mid.x, mid.y);
      gesture.dist = dist;
      gesture.mid = mid;
      return;
    }
    const dxPx = ev.clientX - gesture.cx;
    const dyPx = ev.clientY - gesture.cy;
    if (gesture.type === "pan") {
      if (Math.hypot(dxPx, dyPx) > 4) gesture.tap = false;
      view.x = gesture.view.x - dxPx / view.s;
      view.y = gesture.view.y - dyPx / view.s;
      applyView();
      return;
    }
    const at = toWorld(ev.clientX, ev.clientY);
    let dx = at.x - gesture.at.x;
    let dy = at.y - gesture.at.y;
    if (gesture.type === "move") {
      if (!gesture.moved && Math.hypot(dxPx, dyPx) < 4) return;
      gesture.moved = true;
      // Snap range is 8 px on screen, whatever the zoom.
      const snapped = ev.altKey ? { dx, dy, guides: [] } : snapMove(gesture.moving, gesture.others, dx, dy, { grid: grid(), range: 8 / view.s });
      gesture.dx = snapped.dx;
      gesture.dy = snapped.dy;
      for (const it of gesture.moving) groupOf(it.id)?.setAttribute("transform", `translate(${r1(it.x + snapped.dx)} ${r1(it.y + snapped.dy)})${it.rot ? ` rotate(${it.rot})` : ""}`);
      layers.handles.innerHTML = "";
      drawGuides(snapped.guides);
      return;
    }
    if (gesture.type === "resize") {
      const f = gesture.from;
      const a = ((f.rot || 0) * Math.PI) / 180;
      const lx = dx * Math.cos(a) + dy * Math.sin(a);
      const ly = -dx * Math.sin(a) + dy * Math.cos(a);
      const g = grid();
      const w = gesture.sx ? Math.max(MIN_SIZE, toGrid(f.w + gesture.sx * lx, g) || MIN_SIZE) : f.w;
      const d = gesture.sy ? Math.max(MIN_SIZE, toGrid(f.d + gesture.sy * ly, g) || MIN_SIZE) : f.d;
      // The opposite side stays put: the centre moves half the growth.
      const ox = (gesture.sx * (w - f.w)) / 2;
      const oy = (gesture.sy * (d - f.d)) / 2;
      const next = { ...f, w, d, x: f.x + ox * Math.cos(a) - oy * Math.sin(a), y: f.y + ox * Math.sin(a) + oy * Math.cos(a) };
      gesture.next = next;
      const el = groupOf(f.id);
      if (el) el.outerHTML = pieceSVG(next, hall(), { selected: true });
      layers.handles.innerHTML = "";
      return;
    }
    if (gesture.type === "marquee") {
      const l = Math.min(at.x, gesture.at.x);
      const t = Math.min(at.y, gesture.at.y);
      gesture.box = { l, t, r: Math.max(at.x, gesture.at.x), b: Math.max(at.y, gesture.at.y) };
      showMarquee(true);
      marquee.setAttribute("x", l);
      marquee.setAttribute("y", t);
      marquee.setAttribute("width", gesture.box.r - l);
      marquee.setAttribute("height", gesture.box.b - t);
    }
  }
  function up(ev) {
    pointers.delete(ev.pointerId);
    const g = gesture;
    if (!g) return;
    if (g.type === "pinch") {
      if (pointers.size === 0) gesture = null;
      return;
    }
    gesture = null;
    layers.guides.innerHTML = "";
    showMarquee(false);
    if (g.type === "move") {
      if (!g.moved) {
        // A click on one of several selected pieces picks just that one.
        if (selection.size > 1 && !(ev.shiftKey || ev.metaKey || ev.ctrlKey)) select([g.id]);
        else drawHandles();
        return;
      }
      if (!g.dx && !g.dy) return render();
      const ids = new Set(g.moving.map((i) => i.id));
      edit((h) => {
        for (const it of h.items) if (ids.has(it.id)) (it.x = r1(it.x + g.dx)), (it.y = r1(it.y + g.dy));
      });
      return;
    }
    if (g.type === "resize") {
      if (!g.next) return drawHandles();
      edit((h) => {
        const it = h.items.find((i) => i.id === g.id);
        if (it) Object.assign(it, { x: r1(g.next.x), y: r1(g.next.y), w: g.next.w, d: g.next.d });
      });
      return;
    }
    if (g.type === "marquee") {
      // A right-click that drew nothing leaves the selection alone.
      const tiny = !g.box || ((g.box.r - g.box.l) * view.s < 3 && (g.box.b - g.box.t) * view.s < 3);
      if (tiny && g.right) return;
      if (!g.box) return select(g.add ? [...g.add] : []);
      // A box too small to see is a click on the floor.
      if (tiny) return select(g.add ? [...g.add] : []);
      const hit = items().filter((it) => {
        const b = boxOf(it);
        return b.l >= g.box.l && b.r <= g.box.r && b.t >= g.box.t && b.b <= g.box.b;
      });
      select([...(g.add || []), ...hit.map((i) => i.id)]);
      return;
    }
    if (g.type === "pan" && g.tap) select([]);
  }
  function cancelGesture() {
    if (gesture && (gesture.type === "move" || gesture.type === "resize")) render();
    gesture = null;
    layers.guides.innerHTML = "";
    showMarquee(false);
  }
  function wheel(ev) {
    if (!view) return;
    ev.preventDefault();
    // A trackpad's two-finger scroll pans; a wheel click or a pinch zooms.
    if (!ev.ctrlKey && ev.deltaMode === 0 && Math.abs(ev.deltaX) + Math.abs(ev.deltaY) < 40 && ev.deltaX !== 0) {
      view.x += ev.deltaX / view.s;
      view.y += ev.deltaY / view.s;
      return applyView();
    }
    zoom(Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0015)), ev.clientX, ev.clientY);
  }
  svg.addEventListener("pointerdown", down);
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerup", up);
  svg.addEventListener("pointercancel", (ev) => {
    pointers.delete(ev.pointerId);
    cancelGesture();
  });
  svg.addEventListener("wheel", wheel, { passive: false });
  svg.addEventListener("contextmenu", (ev) => ev.preventDefault());
  const keySpace = (ev) => {
    if (ev.code === "Space" && !ev.target.matches?.("input,textarea,select,button")) {
      spaceDown = ev.type === "keydown";
      svg.classList.toggle("panning", spaceDown);
    }
  };
  window.addEventListener("keydown", keySpace);
  window.addEventListener("keyup", keySpace);
  const resizer = new ResizeObserver(() => view && applyView());
  resizer.observe(host);

  // ---- The library -------------------------------------------------------
  /**
   * A shape pressed in the library: dragged past a few pixels, a ghost of it
   * follows the pointer and it lands where it is let go over the floor;
   * tapped, it lands in the middle of the view. Either way it is selected.
   */
  function libraryPress(ev, shape) {
    ev.preventDefault();
    const sx = ev.clientX;
    const sy = ev.clientY;
    let dragging = false;
    const k = KINDS[shape.kind];
    const onMove = (e2) => {
      if (!dragging && Math.hypot(e2.clientX - sx, e2.clientY - sy) < 6) return;
      dragging = true;
      const w = (shape.w ?? k.w) * view.s;
      const d = (shape.d ?? k.d) * view.s;
      const hr = host.getBoundingClientRect();
      Object.assign(ghost.style, { width: `${Math.max(8, w)}px`, height: `${Math.max(4, d)}px`, left: `${e2.clientX - hr.left - w / 2}px`, top: `${e2.clientY - hr.top - d / 2}px` });
      ghost.hidden = false;
    };
    const onUp = (e2) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      ghost.hidden = true;
      if (!dragging) return add(shape);
      const r = svg.getBoundingClientRect();
      if (e2.clientX < r.left || e2.clientX > r.right || e2.clientY < r.top || e2.clientY > r.bottom) return;
      add(shape, toWorld(e2.clientX, e2.clientY));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }
  /** Put a new piece of `shape` on the floor, at `at` or the view's middle. */
  function add(shape, at) {
    const { w, h } = size();
    at ||= { x: view.x + w / view.s / 2, y: view.y + h / view.s / 2 };
    const k = KINDS[shape.kind];
    const g = grid();
    // Its top-left corner on the grid, like everything else put down.
    const x = toGrid(at.x - (shape.w ?? k.w) / 2, g) + (shape.w ?? k.w) / 2;
    const y = toGrid(at.y - (shape.d ?? k.d) / 2, g) + (shape.d ?? k.d) / 2;
    let id;
    edit((plan) => {
      const it = makePiece(plan.items, shape, x, y, plan.start);
      id = it.id;
      plan.items.push(it);
    });
    select([id]);
  }

  return {
    render,
    fit,
    zoom,
    select,
    add,
    libraryPress,
    get selection() {
      return [...selection];
    },
    get view() {
      return view && { ...view };
    },
    /** The middle of what is on screen, in floor inches. */
    center() {
      const { w, h } = size();
      return { x: view.x + w / view.s / 2, y: view.y + h / view.s / 2 };
    },
    destroy() {
      resizer.disconnect();
      window.removeEventListener("keydown", keySpace);
      window.removeEventListener("keyup", keySpace);
      host.innerHTML = "";
    },
  };
}
