// Keeping the work on this device safe (ROADMAP.md 1.7 and 1.8).
//
// Signed out, a project lives only in this browser's IndexedDB, and a browser
// may clear that by itself: when the disk runs low, or — Safari's rule since
// 13.1 — after seven days of using Safari without a visit to this site. A
// browser that has granted persistent storage (`navigator.storage.persist`)
// clears it only when the person does. A downloaded backup survives all of it.
//
// This module decides what Export → Keep your work says about that, and when
// a backup reminder is due; main.js asks the browser and draws the answer.
// Nothing here asks the browser for anything on its own: Firefox shows a
// permission prompt for persist(), so it is only ever called from the
// button. Pure apart from the storage handed in, so it is tested in Node.
//
// What is remembered is per browser and per project, never in a project or
// a backup: `localStorage["booth.keepSafe"]` = { [project id]: { backup?,
// reminded? } }, each an ISO time.

export const KEEP_SAFE_KEY = "booth.keepSafe";
/** Days between reminders, and how old a backup may be before one is due. */
export const REMIND_DAYS = 30;
/** Projects remembered; past this, the one not touched longest is forgotten. */
export const MAX_REMEMBERED = 50;
const DAY = 24 * 60 * 60 * 1000;

function readAll(storage) {
  try {
    const all = JSON.parse(storage?.getItem(KEEP_SAFE_KEY) || "{}");
    return all && typeof all === "object" && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

function writeAll(storage, all) {
  try {
    storage?.setItem(KEEP_SAFE_KEY, JSON.stringify(all));
  } catch {}
}

const asDate = (value) => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/** What this browser remembers about a project: { backup, reminded }, each a Date or null. */
export function keepSafeOf(storage, id) {
  const entry = readAll(storage)[id] || {};
  return { backup: asDate(entry.backup), reminded: asDate(entry.reminded) };
}

/** Records that a backup of the project was just downloaded, or a reminder shown. */
export function noteKeepSafe(storage, id, what, now = new Date()) {
  if (!id || (what !== "backup" && what !== "reminded")) return;
  const all = readAll(storage);
  const was = all[id] && typeof all[id] === "object" && !Array.isArray(all[id]) ? all[id] : {};
  all[id] = { ...was, [what]: now.toISOString() };
  // Every Alternative and quick start is a new project id: keep the newest.
  const last = (e) => Math.max(asDate(e?.backup)?.getTime() || 0, asDate(e?.reminded)?.getTime() || 0);
  const ids = Object.keys(all).filter((k) => k !== id).sort((a, b) => last(all[b]) - last(all[a]));
  for (const old of ids.slice(MAX_REMEMBERED - 1)) delete all[old];
  writeAll(storage, all);
}

/**
 * Whether to remind the artist to download a backup now. Only signed out
 * (signed in, the studio keeps the booth and its images), only for a project
 * holding images of their own (the example booth holds none), only when the
 * last backup is missing or REMIND_DAYS old, and never twice in REMIND_DAYS.
 */
export function backupDue({ hasOwnImages, signedIn, backup, reminded, now = new Date(), days = REMIND_DAYS }) {
  if (signedIn || !hasOwnImages) return false;
  // A time more than a day ahead was written by a clock that was wrong: due.
  const old = (d) => !d || now - d >= days * DAY || d - now > DAY;
  return old(backup) && old(reminded);
}

/** 512 KB, 37 MB, 2.1 GB — in 1024s, as the rest of the app counts (share.js). */
export function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n === 0) return "0 KB";
  if (n < 512) return "under 1 KB";
  // Up a unit wherever rounding would show 1024 of this one.
  if (n >= 1023.5 * 1024 ** 2) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1023.5 * 1024) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

const day = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/**
 * The lines Export → Keep your work shows, and whether to offer the button
 * that asks the browser to keep this device's copy. `persisted` is what
 * `navigator.storage.persisted()` said: true, false, or null where the
 * browser has no such question.
 */
export function keepSafeLines({ persisted, usage, quota, backup, signedIn }) {
  const lines = [];
  if (persisted === true) lines.push("This browser keeps this device's copy until you clear it yourself.");
  else if (persisted === false)
    lines.push("This browser may clear this device's copy by itself: when the disk runs low, or in Safari after a week without a visit.");
  else lines.push("This browser does not say whether it keeps this device's copy.");
  const used = formatBytes(usage);
  const room = formatBytes(quota);
  if (used && room) lines.push(`Using ${used} of about ${room} here.`);
  lines.push(backup ? `Last backup downloaded from this browser: ${day(backup)}.` : "No backup downloaded from this browser yet.");
  if (signedIn) lines.push("Signed in: your booths and their images are also kept in your studio.");
  return { lines, ask: persisted === false };
}
