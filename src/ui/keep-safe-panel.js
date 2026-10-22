// Export → Keep your work, and the reminder to download a backup: what the
// browser says about keeping this project, drawn into the Export tab, and the
// once-a-month toast (src/keep-safe.js decides both). Moved out of
// src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam 3): `ctx` is
// boot's state, read through it, and the helpers this calls.
import { escapeHTML as e } from "../model.js";
import { readSession } from "../studio-session.js";
import { backupDue, keepSafeLines, keepSafeOf, noteKeepSafe } from "../keep-safe.js";

export function createKeepSafePanel(ctx) {
  const { btn, refreshIcons, toast } = ctx;
  // What the browser last said about keeping this project (paintKeepSafe),
  // and which question is the newest.
  let keepSafeAnswer = null;
  let keepSafeAsking = 0;
  /**
   * Export → Keep your work: whether this browser keeps this device's copy,
   * how much room it takes, and when a backup was last downloaded here
   * (src/keep-safe.js). The Export tab redraws on every edit made in it, so
   * the browser's last answer is kept (`keepSafeAnswer`) and the lines are
   * drawn from it straight away, with what this page knows itself — the
   * last backup, signed in or not — read fresh each time. The browser is
   * asked again when its answer is 10 seconds old, or at once after a backup
   * or a persist(); the questions are cheap and prompt nobody.
   */
  function keepSafeHTML() {
    if (keepSafeAnswer?.id !== ctx.p.id) return '<p class="muted">Checking how this browser keeps your work…</p>';
    const { persisted, usage, quota } = keepSafeAnswer;
    const { lines, ask } = keepSafeLines({ persisted, usage, quota, backup: keepSafeOf(ctx.deviceStore(), ctx.p.id).backup, signedIn: !!readSession() });
    return lines.map((line) => `<p class="muted">${e(line)}</p>`).join("") + (ask ? btn("keep-device-copy", "Ask the browser to keep it", "shield-check", "wide") : "");
  }
  async function paintKeepSafe(force = false) {
    const id = ctx.p.id;
    if (!force && keepSafeAnswer?.id === id && Date.now() - keepSafeAnswer.at < 10000) return;
    // Only the newest question's answer is drawn: an older one finishing
    // after a persist() must not put "may clear" back.
    const asking = ++keepSafeAsking;
    let persisted = null;
    let usage;
    let quota;
    try {
      if (navigator.storage?.persisted) persisted = await navigator.storage.persisted();
    } catch {}
    try {
      if (navigator.storage?.estimate) ({ usage, quota } = await navigator.storage.estimate());
    } catch {}
    if (ctx.p.id !== id || asking !== keepSafeAsking) return;
    keepSafeAnswer = { id, at: Date.now(), persisted, usage, quota };
    const el = document.querySelector("#keep-safe");
    if (!el) return;
    el.innerHTML = keepSafeHTML();
    refreshIcons();
  }
  /**
   * A booth that holds the artist's own images and lives only in this
   * browser is worth a reminder to download a backup — at most once a month
   * per project (src/keep-safe.js decides). Not over the welcome, and a few
   * seconds after opening, so it is not lost under the start's own toasts.
   */
  function remindBackup() {
    try {
      const { backup, reminded } = keepSafeOf(ctx.deviceStore(), ctx.p.id);
      if (!backupDue({ hasOwnImages: Object.keys(ctx.p.assets || {}).length > 0, signedIn: !!readSession(), backup, reminded })) return;
      const id = ctx.p.id;
      const said = "This booth and its images live only in this browser. Download a backup now and then: Export → Keep your work.";
      const seen = () => document.visibilityState !== "hidden";
      setTimeout(() => {
        if (document.querySelector("dialog[open]") || ctx.p.id !== id || !seen()) return;
        toast(said, false, 12000);
        // There is one toast, and the start has toasts of its own: a reminder
        // counts as given only once it has stayed on screen for 8 seconds,
        // in a tab someone is looking at, or it comes back at the next start
        // rather than in a month.
        setTimeout(() => {
          const t = document.querySelector("#toast");
          if (t?.textContent === said && t.classList.contains("show") && seen()) noteKeepSafe(ctx.deviceStore(), id, "reminded");
        }, 8000);
      }, 4000);
    } catch {
      // A reminder is never worth stopping the start for.
    }
  }
  return { keepSafeHTML, paintKeepSafe, remindBackup };
}
