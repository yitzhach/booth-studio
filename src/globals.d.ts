// What the app puts on `window` for a person or a test to read in the
// browser (HANDOFF.md → Deployment, docs/DIAGNOSING.md), for the type check
// (tsconfig.app.json). Nothing here is imported; it only describes.
interface Window {
  /** Per texture set: whether it loaded, and what it found (src/surfaces.js). */
  BOOTH_ASSETS?: Record<string, { state: string; detail?: string; at: string }>;
}
