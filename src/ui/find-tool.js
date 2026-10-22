// Find a tool, in the header, and the app map the assistant reads: an index
// of every heading, label and button each tab would draw now, ranked as the
// artist types, and the way to a found one. Moved out of src/main.js's boot()
// as it was (MAIN_SPLIT_PHASE.md, seam 7): `ctx` is boot's state, read and
// set through it, and the helpers this calls.
// Tool search's `fold` comes in as `foldText`, the name this code has always
// used: in main.js, where it was written, `fold` is the inspector's
// open/closed helper.
import { typingIn } from "../typing.js";
import { escapeHTML as e } from "../model.js";
import { SHORTCUTS, dedupe, fold as foldText, rankTools, shortcutOf } from "../toolsearch.js";

export function createFindTool(ctx) {
  const { inspectorHTML, renderInspector, showSection } = ctx;
  // Tool search, in the header. The index is read from what each tab would
  // draw right now — the same markup the inspector renders — so a control
  // added to a panel is findable without anyone adding it to a list, and a
  // control the current booth does not show (the light bar on a pop-up) is
  // not offered. It is built when the box is focused and dropped on blur.
  const TAB_NAMES = { art: "Artwork", layout: "Layout", show: "Art show", walls: "Walls", lighting: "Lighting", video: "Video", hall: "Show floor", export: "Export" };
  const FINDABLE = "h3, h4, label, button[data-action]";
  /** What a heading, label or button is called, without the values beside it. */
  function findableName(el) {
    if (el.matches("button")) return el.getAttribute("aria-label") || el.textContent;
    const copy = el.cloneNode(true);
    copy.querySelectorAll("select, output, input, textarea, button, small, span.badge").forEach((x) => x.remove());
    if (el.matches("h3")) copy.querySelectorAll("span").forEach((x) => x.remove());
    const text = copy.textContent.replace(/\s+/g, " ").trim();
    if (text) return text;
    return el.querySelector("[aria-label]")?.getAttribute("aria-label") || "";
  }
  /** Help's table of tool shortcuts, grouped as `SHORTCUTS` groups them. */
  function shortcutHelp() {
    const groups = {};
    for (const [name, sc] of Object.entries(SHORTCUTS)) (groups[sc.group] ||= []).push(`<li><kbd>${e(name)}</kbd> ${e(sc.label)}</li>`);
    return `<h3>Tool shortcuts</h3><p class="muted">Type one in the search box and press Enter.</p><div class="shortcut-help">${Object.entries(groups).map(([g, items]) => `<section><h4>${e(g)}</h4><ul>${items.join("")}</ul></section>`).join("")}</div>`;
  }
  function buildToolIndex() {
    const list = [];
    for (const [t, name] of Object.entries(TAB_NAMES)) list.push({ label: name, where: "Inspector tab", tab: t });
    const outside = [
      [".toolbar [data-action]", "Toolbar"],
      ["#view-switch [data-view]", "View"],
      [".zoom-controls [data-action]", "View"],
      ["header [data-action]", "Header"],
    ];
    for (const [sel, where] of outside)
      for (const el of document.querySelectorAll(sel)) list.push({ label: findableName(el), where, el });
    list.push({ label: "Preview quality", where: "Status bar", el: document.querySelector("#quality-quick") });
    const keep = ctx.tab,
      tpl = document.createElement("template");
    try {
      for (const [t, name] of Object.entries(TAB_NAMES)) {
        ctx.tab = t;
        tpl.innerHTML = inspectorHTML();
        tpl.content.querySelectorAll(FINDABLE).forEach((el, index) => {
          const section = el.closest("section")?.querySelector("h3");
          const heading = section && section !== el ? findableName(section) : "";
          list.push({ label: findableName(el), where: heading ? `${name} · ${heading}` : name, tab: t, index });
        });
      }
    } finally {
      ctx.tab = keep;
    }
    return dedupe(list);
  }
  /** The tool index as lines grouped by place, e.g. "Export · Keep your work: Studio account, Import…". */
  function appMapText(list) {
    const byWhere = new Map();
    for (const x of list) {
      const label = String(x.label || "").replace(/\s+/g, " ").trim();
      if (!label) continue;
      const where = x.where === "Inspector tab" ? "Inspector tabs (bottom bar on a phone, side panel on a computer)" : x.where;
      const names = byWhere.get(where) || [];
      if (!names.includes(label)) names.push(label);
      byWhere.set(where, names);
    }
    return [...byWhere].map(([where, names]) => `${where}: ${names.join(", ")}`).join("\n").slice(0, 15000);
  }
  function renderToolHits() {
    const box = document.querySelector("#tool-search"),
      ul = document.querySelector("#tool-results");
    const q = box.value;
    ctx.toolHits = q.trim() ? rankTools(ctx.toolIndex || (ctx.toolIndex = buildToolIndex()), q) : [];
    ctx.toolAt = Math.min(ctx.toolAt, Math.max(0, ctx.toolHits.length - 1));
    const open = document.activeElement === box && !!q.trim();
    ul.hidden = !open;
    box.setAttribute("aria-expanded", String(open));
    ul.innerHTML = !open
      ? ""
      : ctx.toolHits.length
        ? ctx.toolHits.map((x, i) => `<li role="option" id="tool-hit-${i}" data-hit="${i}" aria-selected="${i === ctx.toolAt}" class="${i === ctx.toolAt ? "active" : ""}"><strong>${e(x.label)}${shortcutOf(x) ? `<kbd>${e(shortcutOf(x))}</kbd>` : ""}</strong><span>${e(x.where)}</span></li>`).join("")
        : `<li class="none">Nothing called “${e(q.trim())}”</li>`;
    if (ctx.toolHits.length) box.setAttribute("aria-activedescendant", "tool-hit-" + ctx.toolAt);
    else box.removeAttribute("aria-activedescendant");
    ul.querySelector("li.active")?.scrollIntoView({ block: "nearest" });
  }
  /** Take the user to a found tool: its tab, scrolled to, focused and flashed. */
  /** The tool index entry for a place in appMapText's words ("Layout · People for scale", "Add man"), or the closest by name. */
  function placeHit(place, control) {
    const list = ctx.toolIndex || (ctx.toolIndex = buildToolIndex());
    const where = (x) => foldText(x.where === "Inspector tab" ? "Inspector tabs (bottom bar on a phone, side panel on a computer)" : x.where);
    const p = foldText(place || ""),
      c = foldText(control || "");
    const here = list.filter((x) => where(x) === p);
    return (
      (c && here.find((x) => foldText(x.label) === c)) ||
      (c && rankTools(here, control, 1)[0]) ||
      here[0] ||
      rankTools(list, control || place, 1)[0] ||
      null
    );
  }
  function openTool(hit, { press = true } = {}) {
    const box = document.querySelector("#tool-search");
    box.value = "";
    box.blur();
    let target = hit.el || null;
    if (hit.tab) {
      ctx.tab = hit.tab;
      renderInspector();
      if (hit.index !== undefined) {
        const root = document.querySelector("#inspector-content");
        const all = [...root.querySelectorAll(FINDABLE)];
        target = all[hit.index];
        // The inspector redrew; if it came out different, find it by name.
        if (!target || foldText(findableName(target)) !== foldText(hit.label))
          target = all.find((el) => foldText(findableName(el)) === foldText(hit.label)) || null;
      } else target = document.querySelector(`.inspector-tabs [data-tab="${hit.tab}"]`);
    }
    if (!target) return;
    // A toolbar button is a tool in itself, so finding it uses it; anything in
    // the inspector is only shown and focused, because "Remove" found is not
    // "Remove" meant.
    if (press && !hit.tab && target.matches("button")) {
      target.click();
      return;
    }
    showSection(target);
    const control = target.matches("label") ? target.querySelector("input, select, textarea") : target.matches("button, select, input") ? target : null;
    const shown = target.matches("h3, h4") ? target.closest("section") || target : target;
    // A tab is already in sight (keepTabInSight); scrolling it into view would
    // move the page or a phone's sheet as well.
    if (!target.matches(".inspector-tabs [data-tab]")) shown.scrollIntoView({ block: "center", behavior: "smooth" });
    control?.focus({ preventScroll: true });
    shown.classList.remove("found");
    void shown.offsetWidth;
    shown.classList.add("found");
    setTimeout(() => shown.classList.remove("found"), 1800);
  }
  {
    const box = document.querySelector("#tool-search"),
      ul = document.querySelector("#tool-results");
    // Its own events stop here: the page's input and change handlers read
    // every field in the document as booth settings.
    for (const type of ["input", "change"]) box.addEventListener(type, (ev) => ev.stopPropagation());
    // Keep every tape: a view setting on the scene, not a booth field, so its
    // events stop here like the search box's.
    const keep = document.querySelector("#keep-tapes");
    keep.addEventListener("input", (ev) => ev.stopPropagation());
    keep.addEventListener("change", (ev) => {
      ev.stopPropagation();
      ctx.scene?.setKeepTapes(keep.checked);
    });
    box.addEventListener("input", () => {
      ctx.toolAt = 0;
      renderToolHits();
    });
    box.addEventListener("focus", () => {
      ctx.toolIndex = null;
      renderToolHits();
    });
    box.addEventListener("blur", () => {
      ctx.toolIndex = null;
      ul.hidden = true;
      box.setAttribute("aria-expanded", "false");
    });
    box.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        if (!ctx.toolHits.length) return;
        ctx.toolAt = (ctx.toolAt + (ev.key === "ArrowDown" ? 1 : -1) + ctx.toolHits.length) % ctx.toolHits.length;
        renderToolHits();
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        if (ctx.toolHits[ctx.toolAt]) openTool(ctx.toolHits[ctx.toolAt]);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        if (box.value) {
          box.value = "";
          renderToolHits();
        } else box.blur();
      }
      ev.stopPropagation();
    });
    // mousedown, not click: a click would blur the box first and the list
    // would be gone before it landed.
    ul.addEventListener("mousedown", (ev) => {
      const li = ev.target.closest("[data-hit]");
      ev.preventDefault();
      if (li) openTool(ctx.toolHits[Number(li.dataset.hit)]);
    });
    // "/" jumps to the box from anywhere that is not already typing, and so
    // does Ctrl/⌘-K, the other place people look for it.
    document.addEventListener("keydown", (ev) => {
      const typing = typingIn(ev);
      const k = (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k";
      if ((ev.key === "/" && !typing && !ev.ctrlKey && !ev.metaKey && !ev.altKey) || k) {
        if (document.querySelector("dialog[open]")) return;
        ev.preventDefault();
        box.focus();
        box.select();
      }
    });
  }
  return { findableName, shortcutHelp, buildToolIndex, appMapText, placeHit, openTool };
}
