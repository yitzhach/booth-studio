// What the app puts on `window` for a person or a test to read in the
// browser (HANDOFF.md → Deployment, docs/DIAGNOSING.md), for the type check
// (tsconfig.app.json). Nothing here is imported; it only describes.
interface Window {
  /** Per texture set: whether it loaded, and what it found (src/surfaces.js). */
  BOOTH_ASSETS?: Record<string, { state: string; detail?: string; at: string }>;
  /** The deployed build, as the footer names it (src/main.js). */
  BOOTH_BUILD?: { version: string; commit: string; time: string; short: string };
  /** Development only: the hooks the browser suites drive (src/ui/test-hooks.js). */
  __booth?: any;
}
// The build's stamp, replaced by Vite's `define` (vite.config.js).
declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;
declare const __BUILD_TIME__: string;
