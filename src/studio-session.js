// Whether this browser is signed in to the studio, read without loading
// anything else. main.js asks this at start; only a "yes" (or the artist
// opening Studio account) loads src/studio.js and the SDK, so a signed-out
// Booth Studio runs exactly as it did before the studio existed and never
// calls /v1 (Art-Talk-Back docs/phase-5-booth.md, gate 1).
export const STUDIO_KEY = "booth.studio";

/** { signedIn, email, studioId, expired?, local? } or null. */
export function readSession(storage = globalThis.localStorage) {
  try {
    const s = JSON.parse(storage.getItem(STUDIO_KEY) || "null");
    return s && s.signedIn ? s : null;
  } catch {
    return null;
  }
}

export function writeSession(value, storage = globalThis.localStorage) {
  try {
    if (value == null) storage.removeItem(STUDIO_KEY);
    else storage.setItem(STUDIO_KEY, JSON.stringify(value));
  } catch {}
}
