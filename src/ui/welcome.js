// The welcome and Quick start (Rev 1 parts A and C): which workspace a
// browser wants, the assistant's door from the welcome, and a booth set up
// from four answers or a saved template. Moved out of src/main.js's boot() as
// it was (MAIN_SPLIT_PHASE.md, seam 2): `ctx` is boot's state, read and set
// through it, and the helpers this calls.
import { FURNITURE, escapeHTML as e, isArtShow, validateProject } from "../model.js";
import { FOOTPRINTS, SHOWS, STARTERS, fromTemplate, quickStart } from "../quickstart.js";
import { ROLES, resolveRole, tabAfterSwitch, writeRole } from "../roles.js";

export function createWelcome(ctx) {
  const { applyRole, backup, btn, icon, mutate, readTemplates, refreshIcons, renderInspector, toast } = ctx;
  /**
   * The welcome, and the Workspace button's dialog: which tools to show
   * (src/roles.js). On a first visit it is the first thing on screen, and
   * closing it without a choice keeps every tool, so it asks only once.
   */
  function openWelcome({ first = false } = {}) {
    const d = document.querySelector("#dialog");
    const current = first ? null : resolveRole(ctx.role);
    const card = (k) => {
      const r = ROLES[k];
      return `<button type="button" class="role-card${current === k ? " active" : ""}" data-action="role-${k}" aria-pressed="${current === k}">${icon(r.icon)}<strong>${e(r.title)}</strong><span>${e(r.blurb)}</span></button>`;
    };
    document.querySelector("#dialog-content").innerHTML =
      `<div class="panel-heading"><h2>${first ? "What are you planning?" : "Workspace"}</h2>${btn("welcome-close", "Close", "x", "icon-only")}</div><p class="muted">${first ? "Booth Studio shows the tools for the job." : "Which tabs and tools to show."} Nothing is taken away: More, beside the tabs, shows the rest, and Workspace in the header (Layout → Project on a phone) switches at any time.</p><div class="role-cards">${card("artist")}${card("organizer")}${card("all")}</div>${describeBlock()}`;
    ctx.welcomeFirst = first;
    // Esc fires `cancel` at once, while `close` can wait for a frame, so both
    // are heard; the Close button says so itself (welcomeDismissed).
    if (first) for (const t of ["cancel", "close"]) d.addEventListener(t, welcomeDismissed, { once: true });
    refreshIcons();
    if (!d.open) d.showModal();
  }
  /**
   * The welcome's other door: say what the booth is, in words, and the studio
   * assistant builds it (Rev 1 part C). Only where the assistant is on — signed
   * in, with one connected (body.assistant-on, set by src/studio-assistant.js);
   * signed out, a line says what signing in adds and opens Studio account.
   */
  function describeBlock() {
    if (document.body.classList.contains("assistant-on"))
      return `<form class="welcome-describe" onsubmit="return false"><label class="setting-label" for="welcome-describe">Or describe it, and the assistant builds it</label><textarea id="welcome-describe" rows="3" maxlength="2000" placeholder="e.g. A 10 × 10 outdoor booth with a canopy, my twelve spring paintings on three walls, warm light"></textarea><div class="button-row">${btn("welcome-describe", "Ask the assistant", "message-circle", "primary")}</div><p class="muted">It shows what it will do before anything changes. A photo or a sketch works too: the 📷 in its panel.</p></form>`;
    return `<p class="muted welcome-describe">Signed in to the studio, you can also describe a booth in words, or show a photo or a sketch, and the assistant builds it. ${btn("welcome-sign-in", "Sign in", "user-round", "text-button")}</p>`;
  }
  /** Hand the description to the assistant, which shows a card before it changes anything. */
  function describeToAssistant() {
    const text = document.querySelector("#welcome-describe")?.value.trim() || "";
    const panel = document.querySelector("studio-assistant");
    if (!text) return document.querySelector("#welcome-describe")?.focus();
    if (!panel) return toast("The assistant isn't connected here.", true);
    const first = ctx.welcomeFirst;
    ctx.welcomeFirst = false;
    // Describing a booth is an artist's start; a choice already made stays.
    if (!ctx.role || first) {
      ctx.role = ctx.role || "artist";
      writeRole(ctx.role);
    }
    document.querySelector("#dialog").close();
    renderInspector();
    panel.toggle(true);
    void panel.send(text);
  }
  /** The welcome closed without a choice: every tool, and it is not asked again. */
  function welcomeDismissed() {
    ctx.welcomeFirst = false;
    if (ctx.role) return;
    ctx.role = "all";
    writeRole(ctx.role);
    applyRole();
  }
  function chooseRole(k) {
    const first = ctx.welcomeFirst;
    ctx.welcomeFirst = false;
    ctx.role = resolveRole(k);
    writeRole(ctx.role);
    ctx.tabsMore = false;
    const all = [...document.querySelectorAll(".inspector-tabs [data-tab]")].map((b) => b.dataset.tab);
    ctx.tab = tabAfterSwitch(ctx.role, ctx.tab, all, { artShow: isArtShow(ctx.p) });
    document.querySelector("#dialog").close();
    renderInspector();
    // An artist's first visit goes straight on to the booth; the example on
    // screen is not theirs, so there is nothing to back up first.
    if (first && ctx.role === "artist") openQuickStart({ backupFirst: false });
    else toast(ctx.role === "all" ? "Every tool is showing." : `${ROLES[ctx.role].label} workspace. More, beside the tabs, shows the rest.`);
  }
  /**
   * Quick start: show type, size, starter furniture and a name, and a booth
   * set up from them — or one of the user's saved templates. One form rather
   * than a sequence of steps, because four answers fit on one screen and a
   * wizard's Next button is three clicks nobody needs.
   */
  function openQuickStart({ backupFirst = true } = {}) {
    const d = document.querySelector("#dialog");
    const templates = readTemplates();
    const starterLabel = (k) => FURNITURE[k].label;
    document.querySelector("#dialog-content").innerHTML =
      `<div class="panel-heading"><h2>Quick start a booth</h2>${btn("qs-cancel", "Close", "x", "icon-only")}</div><form class="quick-start" id="quick-start" onsubmit="return false"><label class="setting-label">Name<input id="qs-name" maxlength="120" placeholder="e.g. Main Street Art Fair" aria-label="Booth name"/></label>${templates.length ? `<label class="setting-label">Start from<select id="qs-template" aria-label="Start from"><option value="">A new booth, set up below</option>${templates.map((t) => `<option value="${e(t.id)}">My template · ${e(t.label)}</option>`).join("")}</select></label>` : ""}<fieldset id="qs-fresh"><label class="setting-label">What kind of show<select id="qs-show" aria-label="Show type">${Object.entries(SHOWS).map(([k, v]) => `<option value="${k}">${e(v.label)}</option>`).join("")}</select></label><label class="setting-label">Booth size<select id="qs-size" aria-label="Booth size">${Object.entries(FOOTPRINTS).map(([k, v]) => `<option value="${k}">${e(v.label)}</option>`).join("")}</select></label><p class="setting-label">Starter furniture</p><div class="qs-starters">${STARTERS.map((k) => `<label class="check-field"><input type="checkbox" data-starter="${k}" ${k === "table6" || k === "chair" ? "checked" : ""}/>${e(starterLabel(k))}</label>`).join("")}</div></fieldset><label class="check-field"><input type="checkbox" id="qs-backup" ${backupFirst ? "checked" : ""}/>Download a backup of the current booth first</label><p class="muted">Everything here is a starting point: the size, the walls, the furniture and the lighting all stay editable. Your artwork library is not carried over.</p><div class="button-row"><button type="button" data-action="qs-cancel">Cancel</button><button type="button" class="primary" data-action="qs-go">Start this booth</button></div>${templates.length ? `<p class="muted">Remove a saved template: ${templates.map((t) => `<button type="button" class="text-button" data-action="qs-forget-${e(t.id)}">${e(t.label)} ×</button>`).join(" ")}</p>` : ""}</form>`;
    const sync = () => {
      const fresh = document.querySelector("#qs-fresh");
      if (fresh) fresh.disabled = !!document.querySelector("#qs-template")?.value;
    };
    document.querySelector("#qs-template")?.addEventListener("change", sync);
    refreshIcons();
    d.showModal();
  }
  function runQuickStart() {
    const d = document.querySelector("#dialog");
    const name = document.querySelector("#qs-name")?.value || "";
    const templateId = document.querySelector("#qs-template")?.value || "";
    const template = templateId && readTemplates().find((t) => t.id === templateId);
    const next = template
      ? fromTemplate(template, name)
      : quickStart({
          show: document.querySelector("#qs-show").value,
          size: document.querySelector("#qs-size").value,
          furniture: [...document.querySelectorAll("[data-starter]")].filter((x) => x.checked).map((x) => x.dataset.starter),
          name,
        });
    try {
      validateProject(next);
    } catch {
      toast("That template no longer opens in this version. Start a new booth instead.", true);
      return;
    }
    if (document.querySelector("#qs-backup")?.checked) backup();
    d.close();
    mutate(() => {
      ctx.p = next;
      ctx.selected = null;
      ctx.selectedPanel = null;
      ctx.selectedPedestal = null;
      ctx.tab = "layout";
    });
    ctx.scene?.setView("perspective");
    toast(`${ctx.p.name} is ready. Upload artwork to start hanging.`);
  }
  return { openWelcome, describeToAssistant, welcomeDismissed, chooseRole, openQuickStart, runQuickStart };
}
