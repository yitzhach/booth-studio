// Report a problem (ROADMAP.md 1.9): what went wrong on this device, in a
// form the artist can paste into a message, with nothing sent anywhere.
//
// main.js records the page's uncaught errors and unhandled promise
// rejections here from its first line, so a failure while the app starts is
// in the report too. Export → Something wrong? copies a plain-text report:
// the build (the first thing HANDOFF.md says to compare, since a stale
// deploy has twice looked like a bug), the page without its query (a booth
// link's id stays out), the browser and screen, the project in counts only
// (no names, titles or images), what each texture set reported
// (`window.BOOTH_ASSETS`) and the recent errors. Sending it anywhere by
// itself would be server-side work, which is the owner's call (ROADMAP.md
// phase 0). Pure apart from the ring it keeps, so it is tested in Node.

/** The most errors kept; the oldest go first. */
export const MAX_ERRORS = 20;
const MAX_MESSAGE = 300;
const ring = [];

const clip = (text, n) => {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/**
 * What an `error` or `unhandledrejection` event says, as { message, where }:
 * the message, and the first two frames of the stack or the file and line.
 */
export function errorEntry(event) {
  const reason = event?.reason ?? event?.error;
  const message = clip(reason?.message ?? event?.message ?? reason ?? "Unknown error", MAX_MESSAGE);
  const kind = event?.type === "unhandledrejection" ? "Unhandled rejection: " : "";
  const stack = typeof reason?.stack === "string" ? reason.stack.split("\n").slice(1, 3).map((l) => l.trim()).join(" ← ") : "";
  const where = stack || (event?.filename ? `${event.filename.replace(/^.*\//, "")}:${event.lineno ?? "?"}:${event.colno ?? "?"}` : "");
  return { message: kind + message, where: clip(where, MAX_MESSAGE) };
}

export function recordError(entry, now = new Date()) {
  if (!entry?.message) return;
  ring.push({ at: now.toISOString(), message: entry.message, where: entry.where || "" });
  while (ring.length > MAX_ERRORS) ring.shift();
}

/** Newest first. */
export const recentErrors = () => [...ring].reverse();
export const clearErrors = () => void (ring.length = 0);

const ft = (inches) => `${Math.round((inches / 12) * 10) / 10}`;

/** The project as counts and settings only: nothing anyone typed or uploaded. */
export function projectSummary(p) {
  if (!p) return "none open";
  const parts = [`${(p.art || []).length} placements`, `${Object.keys(p.assets || {}).length} images or files`];
  if (p.booth?.width && p.booth?.depth) parts.push(`${ft(p.booth.width)} × ${ft(p.booth.depth)} ft`);
  if (p.booth?.venue) parts.push(`venue ${p.booth.venue}`);
  if (p.mode) parts.push(`mode ${p.mode}`);
  const pieces = p.hall?.items?.length;
  if (pieces) parts.push(`show floor of ${pieces} pieces`);
  return parts.join(", ");
}

/** The report, as plain text to paste into a message. */
export function reportText({ build, href, userAgent, viewport, signedIn, project, assets, errors, now = new Date() }) {
  let page = "";
  try {
    const u = new URL(href);
    page = u.origin + u.pathname;
  } catch {}
  const lines = [
    "Booth Studio problem report",
    `Written: ${now.toISOString()}`,
    `Build: v${build?.version ?? "?"} · built ${build?.time ?? "?"} · commit ${build?.commit ?? "?"}`,
    `Page: ${page || "unknown"}`,
    `Browser: ${userAgent || "unknown"}`,
    `Screen: ${viewport || "unknown"}`,
    `Signed in to the studio: ${signedIn ? "yes" : "no"}`,
    `Project: ${projectSummary(project)}`,
  ];
  const sets = Object.entries(assets || {});
  lines.push(sets.length ? `Texture sets: ${sets.map(([id, a]) => `${id} ${a?.state ?? "?"}`).join(", ")}` : "Texture sets: none reported");
  const list = errors || [];
  lines.push(list.length ? `Recent errors on this page, newest first (${list.length}):` : "Recent errors on this page: none");
  for (const err of list) lines.push(`- ${err.at.slice(11, 19)} UTC ${err.message}${err.where ? ` (${err.where})` : ""}`);
  return lines.join("\n");
}
