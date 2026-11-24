// The guided booth on screen (DEMO_PHASE.md, task A2): the steps of
// src/guided.js drawn in the inspector in place of the tab strip, with Back,
// Next and All tools.
//
// The steps are the inspector's "guided" view, a tab with no button of its
// own: `ctx.tab` is "guided" while they show. That is what lets everything
// that already opens a tab — tool search, the assistant's "take me to", the
// toolbar's Export — go on working unchanged: it opens its tab, the strip
// comes back, and the Guided button beside More is the way back to the step.
// Only the Artist workspace has the steps; in any other the view falls back
// to Layout. Where the artist is (src/guided.js `booth.guided`) is a view
// setting per browser, so a reload comes back to the same step.
//
// A step's controls are names (src/guided.js); CONTROLS below draws each.
// Where a tab already has the control the markup is the tab's own — the
// same data-action, the same data-field — so the step's control runs through
// the same handlers and the same undo as the tab's. A name with no drawing
// yet draws nothing, which is how a later task (A3–A6) adds its control.
import { escapeHTML as e, isArtShow } from "../model.js";
import { FOOTPRINTS, SHOWS } from "../quickstart.js";
import { resolveRole } from "../roles.js";
import { GUIDED_OFF, GUIDED_SIZES, GUIDED_TAB, STEPS, applyBoothChoice, boothChoiceOf, firstStep, hungWorks, readGuided, stepAfter, stepBefore, stepIndex, stepOf, writeGuided } from "../guided.js";
import { lookGrid } from "./polish-panel.js";

/**
 * Open a tab because of a selection or a new piece — a work clicked, a
 * picture added — which is not a reason to leave the guided steps. A tab
 * pressed, searched for or asked for still leaves them, by setting ctx.tab.
 */
export const followTab = (ctx, tab) => {
  if (ctx.tab !== GUIDED_TAB) ctx.tab = tab;
};
/**
 * The tab All tools opens from each step: where that step's tools live. An
 * indoor booth's footprint and walls are in Art show, not Layout.
 */
const TAB_FOR = { booth: "layout", walls: "walls", light: "lighting", hang: "art", share: "export" };
const tabFor = (key, p) => (key === "booth" && isArtShow(p) ? "show" : TAB_FOR[key] || "layout");

export function createGuidedPanel(ctx) {
  const { btn, mutate } = ctx;
  let step = readGuided();
  const onStep = () => stepIndex(step) >= 0;
  /** The step on screen, or step 1 when none is. */
  const current = () => (onStep() ? step : firstStep);
  const remember = (v) => {
    step = v;
    writeGuided(v);
  };
  const artist = () => resolveRole(ctx.role) === "artist";
  // A browser part-way through the steps opens on its step.
  if (artist() && onStep()) ctx.tab = GUIDED_TAB;

  /** @param {string} attrs @param {string} label @param {string} options */
  const select = (attrs, label, options) => `<label class="setting-label">${e(label)}<select ${attrs} aria-label="${e(label)}">${options}</select></label>`;
  const option = (value, label, on) => `<option value="${e(value)}"${on ? " selected" : ""}>${e(label)}</option>`;

  /** Each control a step may name, as markup. */
  const CONTROLS = {
    "booth-kind": (p) => {
      const now = boothChoiceOf(p).show;
      return select('data-guided="show"', "Kind of show", Object.entries(SHOWS).map(([k, s]) => option(k, s.label, k === now)).join(""));
    },
    "booth-size": (p) => {
      const now = boothChoiceOf(p).size;
      // A booth of another size says so, rather than showing a size it is not.
      const other = GUIDED_SIZES.includes(now) ? "" : option("", `${Math.round(p.booth.width / 12)} × ${Math.round(p.booth.depth / 12)} ft, as it is`, true);
      return select('data-guided="size"', "Size", other + GUIDED_SIZES.map((k) => option(k, FOOTPRINTS[k].label, k === now)).join(""));
    },
    "project-name": (p) => `<label class="setting-label">Name<input type="text" data-guided="name" maxlength="120" value="${e(p.name)}" aria-label="Booth name"/></label>`,
    "panel-color": (p) => `<label class="color-field">Panel colour<input type="color" data-field="color" data-scope="booth" aria-label="Panel colour" value="${e(p.booth.color)}"/></label>`,
    "wall-finish": (p) => select('data-field="wallFinish" data-scope="booth"', "Panel finish", option("smooth", "Smooth", (p.booth.wallFinish || "smooth") === "smooth") + option("fabric", "Fabric", p.booth.wallFinish === "fabric")),
    polish: () => btn("polish", "Make it beautiful", "sparkles", "primary wide"),
    "add-pictures": () => btn("upload-art", "Add my pictures", "image-plus", "primary wide"),
    "hung-list": (p) => {
      const n = hungWorks(p).length;
      return `<p class="muted guided-count">${n ? `${n} work${n === 1 ? "" : "s"} on the walls.` : "Nothing on the walls yet."}</p>`;
    },
    "save-picture": () => btn("export-image", "Save a picture", "download", "wide"),
    guide: () => btn("guide", "Hanging guide", "ruler", "wide"),
    "share-design": () => btn("share-design", "Send a link", "send", "wide"),
    "studio-account": () => btn("studio-account", "Open it on my phone", "user-round", "wide"),
  };

  /**
   * The step's controls. The four looks are one card grid, the Lighting
   * tab's own (src/ui/polish-panel.js), drawn where the first look is named.
   */
  function controlsHTML(s, p) {
    const firstLook = s.controls.find((c) => c.startsWith("look-"));
    return s.controls.map((c) => (c === firstLook ? lookGrid(p) : c.startsWith("look-") ? "" : CONTROLS[c]?.(p) || "")).join("");
  }

  /** The inspector's markup while the steps show. */
  function guidedHTML() {
    const p = ctx.p;
    const s = stepOf(current());
    const i = stepIndex(s.key);
    const after = stepAfter(s.key);
    const steps = STEPS.map((x, n) => {
      const done = x.done(p);
      const cls = [n === i ? "current" : "", done ? "done" : ""].filter(Boolean).join(" ");
      return `<li class="${cls}"${n === i ? ' aria-current="step"' : ""}><span class="guided-dot" aria-hidden="true">${done ? "✓" : n + 1}</span><span class="guided-name">${e(x.title)}</span>${done && n !== i ? '<span class="sr-only"> (done)</span>' : ""}</li>`;
    }).join("");
    const body =
      p.mode === "3d"
        ? `<div class="guided-controls">${controlsHTML(s, p)}</div>`
        : `<p class="muted">The steps work on the 3D booth.</p>${btn("mode-3d", "Back to the 3D booth", "box", "wide")}`;
    return `<div class="guided" data-step="${s.key}"><ol class="guided-steps" aria-label="Steps">${steps}</ol><div class="panel-heading"><h2><small>Step ${i + 1} of ${STEPS.length}</small> ${e(s.title)}</h2></div><p class="muted guided-help">${e(s.help)}</p>${body}<div class="guided-nav">${i > 0 ? btn("guided-back", "Back", "arrow-left") : "<span></span>"}${after ? btn("guided-next", `Next: ${stepOf(after).title}`, null, "primary") : ""}</div>${btn("guided-all", "All tools", null, "text-button guided-all")}</div>`;
  }

  /** Show a step: remembered, and drawn. */
  function go(key) {
    remember(key);
    ctx.tab = GUIDED_TAB;
    ctx.tabsMore = false;
    ctx.renderInspector();
    const root = document.querySelector("#inspector-content");
    if (root) root.scrollTop = 0;
  }

  /**
   * Quick start's ending in the Artist workspace: step 1 instead of the
   * Layout tab. Only for a first visit's Quick start (welcome, My booth,
   * Start this booth) or a browser that has been in the steps before —
   * never one that chose All tools, and never someone who came with a booth
   * of their own and opened Quick start from Layout. Returns whether the
   * steps took over.
   * @param {boolean} firstVisit
   */
  function startAfterQuickStart(firstVisit) {
    if (!artist() || step === GUIDED_OFF || (step === null && !firstVisit)) return false;
    remember(firstStep);
    ctx.tab = GUIDED_TAB;
    return true;
  }

  /**
   * Before each draw: the steps only in the Artist workspace (a switch to any
   * other leaves them for Layout), the strip hidden while they show, and the
   * Guided button beside More (in the strip's markup, src/main.js) whenever
   * an artist is on a tab.
   */
  const guidedButton = /** @type {HTMLElement | null} */ (document.querySelector(".inspector-tabs .tabs-guided"));
  function applyGuided() {
    if (ctx.tab === GUIDED_TAB && !(artist() && onStep())) ctx.tab = "layout";
    const on = ctx.tab === GUIDED_TAB;
    document.body.classList.toggle("guided-on", on);
    if (guidedButton) guidedButton.hidden = on || !artist();
    return on;
  }

  // Step 1's own controls: a change of kind or size keeps the work, and a
  // name. Heard here, before the page-wide handler, which has no field for them.
  document.querySelector("#inspector-content")?.addEventListener("change", (ev) => {
    const el = /** @type {HTMLInputElement} */ (ev.target);
    const which = el.dataset?.guided;
    if (!which) return;
    ev.stopPropagation();
    if (which === "name") {
      const name = el.value.trim().slice(0, 120);
      // An empty or unchanged name is no edit: nothing to undo, nothing to save.
      if (!name || name === ctx.p.name) el.value = ctx.p.name;
      else mutate(() => (ctx.p.name = name));
    }
    else if (which === "show" || which === "size") {
      if (!el.value) return;
      mutate(() => applyBoothChoice(ctx.p, { [which]: el.value }));
      ctx.scene?.setView?.("perspective");
    }
  });

  const actions = {
    "guided-next": () => {
      const n = stepAfter(step);
      if (n) go(n);
    },
    "guided-back": () => {
      const b = stepBefore(step);
      if (b) go(b);
    },
    // All tools: the tabs as they always were, opened where this step's
    // tools live, and remembered, so the steps do not come back by themselves.
    "guided-all": () => {
      const from = current();
      remember(GUIDED_OFF);
      ctx.tab = tabFor(from, ctx.p);
      ctx.renderInspector();
    },
    "tabs-guided": () => go(current()),
    // Not a button: how Quick start (src/ui/welcome.js) hands over to step 1.
    "guided-from-quick-start": (opts) => startAfterQuickStart(opts?.firstVisit === true),
  };

  return { guidedHTML, applyGuided, actions };
}
