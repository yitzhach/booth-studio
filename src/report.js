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
// (`window.BOOTH_ASSETS`) and the recent errors — with any quoted text and
// any link's query taken out of them, since an error can quote what someone
// typed (JSON.parse does) or a booth link's id. Sending it anywhere by
// itself would be server-side work, which is the owner's call (ROADMAP.md
// phase 0). Pure apart from the ring it keeps, so it is tested in Node.

/** The most different errors kept; the oldest go first. The same error again is counted, not kept twice. */
export const MAX_ERRORS = 20;
const MAX_MESSAGE = 300;
const ring = [];

const clip = (text, n) => {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
// What someone typed stays out. Double-quoted text goes from the first quote
// to the last, since what JSON.parse quotes of its input can hold quotes of
// its own. Single-quoted text, first quote to last, goes when it holds a
// space, which a property name or token the code quotes ('length', 'x') never
// does and a typed name usually does. A link keeps its address and a stack
// frame's :line:col, and loses its query or fragment (a booth link's id).
const redact = (s) =>
  s
    .replace(/"[\s\S]*"/, '"…"')
    .replace(/'[\s\S]*'/, (quoted) => (/\s/.test(quoted) ? "'…'" : quoted))
    .replace(/(\bhttps?:\/\/[^\s?#)]+)[?#][^\s)]*?((?::\d+){1,2})?(?=[\s)]|$)/g, "$1$2");

/**
 * The first two frames of a stack. V8 opens a stack with the message, which
 * can run to several lines, and writes each frame as `at …`; Firefox and
 * Safari start at the frame that threw and write `fn@url:line:col`. Only the
 * lines that are frames are kept.
 */
function frames(stack) {
  const lines = stack.split("\n").map((l) => l.trim());
  // A V8 stack's frames are its `at` lines; anything else in it is message.
  const v8 = lines.some((l) => /^at\s/.test(l));
  const isFrame = (l) => (v8 ? /^at\s/.test(l) : /@\S*:\d+/.test(l));
  return lines.filter(isFrame).slice(0, 2).join(" ← ");
}

/**
 * What an `error` or `unhandledrejection` event says, as { message, where }:
 * the message, and the first two frames of the stack or the file and line.
 */
export function errorEntry(event) {
  const reason = event?.reason ?? event?.error;
  const message = clip(redact(String(reason?.message ?? event?.message ?? reason ?? "Unknown error")), MAX_MESSAGE);
  const kind = event?.type === "unhandledrejection" ? "Unhandled rejection: " : "";
  const stack = typeof reason?.stack === "string" ? frames(reason.stack) : "";
  const where = stack || (event?.filename ? `${event.filename.replace(/[?#].*$/, "").replace(/^.*\//, "")}:${event.lineno ?? "?"}:${event.colno ?? "?"}` : "");
  return { message: kind + message, where: clip(redact(where), MAX_MESSAGE) };
}

/**
 * Keep an error. The same error again (a broken frame loop throws sixty a
 * second) is counted on the one entry and moved to the newest, so it can
 * never push out the different, earlier error that is usually the cause.
 */
export function recordError(entry, now = new Date()) {
  if (!entry?.message) return;
  const where = entry.where || "";
  const at = now.toISOString();
  const i = ring.findIndex((r) => r.message === entry.message && r.where === where);
  const same = i >= 0 ? ring.splice(i, 1)[0] : null;
  ring.push(same ? { ...same, at, count: same.count + 1 } : { at, first: at, count: 1, message: entry.message, where });
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
  for (const err of list)
    lines.push(`- ${err.at.slice(11, 19)} UTC ${err.message}${err.where ? ` (${err.where})` : ""}${err.count > 1 ? ` — ${err.count} times since ${err.first.slice(11, 19)} UTC` : ""}`);
  return lines.join("\n");
}
