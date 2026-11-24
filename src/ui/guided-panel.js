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
import { MAX_PANELS, escapeHTML as e, isArtShow } from "../model.js";
import { FOOTPRINTS, SHOWS } from "../quickstart.js";
import { resolveRole } from "../roles.js";
import { GUIDED_OFF, GUIDED_SIZES, GUIDED_TAB, STEPS, applyBoothChoice, boothChoiceOf, firstStep, hungWorks, readGuided, stepAfter, stepBefore, stepIndex, stepOf, writeGuided } from "../guided.js";
import { LAYOUTS, LAYOUT_KEYS, PANEL_COLORS, applyWallLayout, currentLayout, layoutFits, layoutPlan } from "../wall-layouts.js";
import { evenHang, heroShots } from "../polish.js";
import { download } from "../storage.js";
import { createHangDialog } from "./hang-dialog.js";
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
/** The long side of Save a picture, in pixels. */
const PICTURE_PX = 2048;
const tabFor = (key, p) => (key === "booth" && isArtShow(p) ? "show" : TAB_FOR[key] || "layout");

export function createGuidedPanel(ctx) {
  const { btn, mutate } = ctx;
  const hang = createHangDialog(ctx);
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
  /**
   * A choice of several drawn as cards or swatches: native radio buttons,
   * so the whole row is one stop for the keyboard (arrows move along it) and
   * one control for a screen reader, however many cards it shows.
   */
  const choice = (legend, cls, items) => `<fieldset class="guided-choice"><legend>${e(legend)}</legend><div class="${cls}">${items}</div></fieldset>`;
  const radio = (name, value, on, which) => `<input type="radio" name="${name}" value="${e(value)}" data-guided="${which}"${on ? " checked" : ""}/>`;
  /** A layout's plan from above, the back wall at the top: src/wall-layouts.js layoutPlan. */
  function planSVG(key, b) {
    const lines = layoutPlan(key, b);
    const pad = b.width / 16;
    return `<svg class="layout-plan" viewBox="${-pad} ${-pad} ${b.width + 2 * pad} ${b.depth + 2 * pad}" aria-hidden="true"><rect x="0" y="0" width="${b.width}" height="${b.depth}" class="plan-floor"/>${lines.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${pad * 0.9}"/>`).join("")}</svg>`;
  }

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
    "wall-layout": (p) => {
      const now = currentLayout(p);
      const b = { width: p.booth.width, depth: p.booth.depth };
      return choice(
        "Walls",
        "layout-grid",
        LAYOUT_KEYS.map((k) => `<label class="layout-card" title="${e(LAYOUTS[k].blurb)}">${radio("guided-layout", k, k === now, "layout")}${planSVG(k, b)}<span>${e(LAYOUTS[k].label)}</span></label>`).join(""),
      );
    },
    // Six plain colours, and Other for the colour a booth already has that
    // is none of them (the tab's own colour field, its handler and undo).
    "panel-color": (p) => {
      const now = (p.booth.color || "").toLowerCase();
      const swatches = PANEL_COLORS.map((c) => `<label class="swatch-choice">${radio("guided-color", c.hex, c.hex === now, "color")}<span class="chip" style="background:${c.hex}" aria-hidden="true"></span><span>${e(c.name)}</span></label>`).join("");
      return choice("Panel colour", "swatch-row", swatches + `<label class="swatch-choice swatch-other"><input type="color" data-field="color" data-scope="booth" aria-label="Another panel colour" value="${e(now)}"/><span>Other</span></label>`);
    },
    "wall-finish": (p) => select('data-field="wallFinish" data-scope="booth"', "Panel finish", option("smooth", "Smooth", (p.booth.wallFinish || "smooth") === "smooth") + option("fabric", "Fabric", p.booth.wallFinish === "fabric")),
    polish: () => btn("polish", "Make it beautiful", "sparkles", "primary wide"),
    "add-pictures": () => btn("guided-add-pictures", "Add my pictures", "image-plus", "primary wide"),
    "space-evenly": () => btn("guided-space", "Space them evenly", "align-horizontal-distribute-center", "wide"),
    "hung-list": (p) => {
      const n = hungWorks(p).length;
      return `<p class="muted guided-count">${n ? `${n} work${n === 1 ? "" : "s"} on the walls.` : "Nothing on the walls yet."}</p>`;
    },
    "save-picture": () => btn("guided-picture", "Save a picture", "image", "primary wide") + `<p class="muted guided-note">The front of your booth as the app draws it: a rendering, and its file name says so.</p>`,
    guide: () => btn("guide", "Hanging guide", "ruler", "wide"),
    "share-design": () => btn("guided-link", "Send a link", "send", "wide"),
    "studio-account": () => btn("studio-account", "Open it on my phone", "user-round", "wide") + `<p class="muted guided-note">With a studio account, this booth opens on your other devices.</p>`,
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
  const content = document.querySelector("#inspector-content");
  /** A layout, if it fits; the row redrawn either way, focus kept on it. */
  function useLayout(key) {
    // The layout it is in already, or one refused before anything changes:
    // no empty undo step either way.
    if (key === currentLayout(ctx.p)) ctx.renderInspector();
    else if (layoutFits(ctx.p, key)) mutate(() => applyWallLayout(ctx.p, key));
    else {
      ctx.toast(`A booth holds ${MAX_PANELS} free-standing walls at most. Take one out in the Walls tab first.`, true);
      ctx.renderInspector();
    }
    refocus("guided-layout");
  }
  // The redraw replaced the row; the keyboard stays where it was.
  const refocus = (name) => /** @type {HTMLElement | null} */ (content?.querySelector(`input[name="${name}"]:checked`))?.focus();
  // Arrow keys move the focus along the layouts without choosing any: a
  // layout moves work off the walls it takes away, so it is built only on a
  // click, Enter or Space, never on the way past. The browser's own arrow
  // keys would check each radio they pass, leaving the mark on a layout the
  // booth is not in, so they are taken over here (the roving focus of a
  // toolbar) and the mark always shows the booth as it is.
  content?.addEventListener("keydown", (/** @type {KeyboardEvent} */ ev) => {
    const el = /** @type {HTMLInputElement} */ (ev.target);
    if (el.dataset?.guided !== "layout") return;
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[ev.key];
    if (step) {
      ev.preventDefault();
      const row = /** @type {HTMLInputElement[]} */ ([...content.querySelectorAll('input[name="guided-layout"]')]);
      row[(row.indexOf(el) + step + row.length) % row.length]?.focus();
    } else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      useLayout(el.value);
    }
  });
  // A click or a tap builds the layout.
  content?.addEventListener("click", (ev) => {
    const el = /** @type {HTMLInputElement} */ (ev.target);
    if (el.dataset?.guided === "layout") useLayout(el.value);
  });
  content?.addEventListener("change", (ev) => {
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
    // A layout is built on its click (above), never on the change that follows.
    else if (which === "color") {
      mutate(() => (ctx.p.booth.color = el.value));
      refocus("guided-color");
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
    "guided-add-pictures": () => hang.pick(),
    // The hero set's front shot alone, at 2048 px: quick on a phone, and
    // named a rendering, since a picture made by the app must say so.
    "guided-picture": async () => {
      // A preview or a clip drives the same camera: one at a time, as every export does.
      if (ctx.busy || ctx.busyVideo || ctx.busyPreview) return ctx.toast("Another export is still running: try again in a moment.");
      if (!ctx.scene || ctx.p.mode !== "3d") return ctx.toast("3D is not available, so there is no booth to draw.", true);
      ctx.busy = true;
      const b = /** @type {HTMLButtonElement | null} */ (document.querySelector('#inspector-content [data-action="guided-picture"]'));
      if (b) {
        b.disabled = true;
        b.querySelector("span").textContent = "Drawing your booth…";
      }
      try {
        const host = document.querySelector("#scene");
        const aspect = host?.clientWidth && host?.clientHeight ? host.clientWidth / host.clientHeight : 16 / 9;
        const front = heroShots(ctx.p, { aspect })[0];
        const blob = await ctx.scene.export(PICTURE_PX, { frame: "desktop", pose: front.pose });
        if (!blob) throw new Error("The picture could not be drawn on this device.");
        const name = `${ctx.safeName()}-rendering-front.png`;
        download(blob, name);
        ctx.toast(`Saved ${name}: a rendering of your booth, not a photograph.`);
      } catch (err) {
        ctx.toast(err.message, true);
      } finally {
        ctx.busy = false;
        ctx.renderInspector();
      }
    },
    // The share link as it is (Export → Send my booth), asked first: it is
    // the one thing on this step that sends the booth off the device.
    "guided-link": () =>
      ctx.sharing
        ? ctx.toast("Already uploading your booth: the link comes when it is done.")
        : ctx.confirmAction("Send a link to this booth?", "The booth and its pictures are uploaded to Booth Studio's share service, and anyone with the link can open it. Nothing else leaves this device.", () => ctx.actions["share-design"]()),
    // Make it beautiful's even hang alone: each wall's work spaced evenly on the 60″ line.
    "guided-space": () => {
      // Counted on a copy first, so a booth with nothing evenHang would move
      // (no work, or each wall shared with a sign) gets no empty undo step.
      const dry = evenHang({ ...ctx.p, art: ctx.p.art.map((a) => ({ ...a })) });
      if (!hungWorks(ctx.p).length) return ctx.toast("Add your pictures first, then they can be spaced.", true);
      if (!dry) return ctx.toast("Nothing to space: each wall with work also holds a sign or a label, which stay where they are. Arrange those walls in the Artwork tab.", true);
      /** @type {number} */
      let walls = 0;
      mutate(() => (walls = evenHang(ctx.p)));
      ctx.toast(`${walls} wall${walls === 1 ? "" : "s"} spaced evenly on the 60″ line. Undo puts them back.`);
    },
    // Not a button: how Quick start (src/ui/welcome.js) hands over to step 1.
    "guided-from-quick-start": (opts) => startAfterQuickStart(opts?.firstVisit === true),
  };

  return { guidedHTML, applyGuided, actions };
}
