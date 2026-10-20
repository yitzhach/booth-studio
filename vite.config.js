import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// A deployed build must be identifiable at a glance, so the footer carries the
// version, the UTC build time and the commit it came from. Cloudflare Workers
// Builds supplies the commit as an environment variable; a local build asks
// git; anything else reports "local" rather than failing the build.
function commitSha() {
  const fromCi =
    process.env.WORKERS_CI_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "local";
  }
}

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

// The service worker's list of the build's own files (public/sw.js keeps
// them all when it installs, the chunks loaded on demand included, so the app
// opens offline with everything it may load). Written once the bundle is on
// disk, when every chunk, stylesheet and font is known: every file the build
// writes to assets/, but the .woff fonts, which only a browser too old for
// .woff2 asks for, and no browser that old runs a service worker.
const swFiles = {
  name: "sw-files",
  apply: "build",
  writeBundle(options, bundle) {
    const files = Object.keys(bundle)
      .filter((f) => f.startsWith("assets/") && !/\.(?:woff|map)$/.test(f))
      .map((f) => `/${f}`)
      .sort();
    writeFileSync(join(options.dir, "sw-files.json"), JSON.stringify({ files }, null, 2) + "\n");
  },
};

export default {
  plugins: [swFiles],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT_SHA__: JSON.stringify(commitSha()),
  },
  build: {
    // Both first-load chunks are about 550 KB (the app, and three.js below):
    // known, so the warning starts past them, where a jump is news.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // three.js in a file of its own (ROADMAP.md 1.6). It is half of the
        // first load — about 550 KB of the 1.1 MB script — and changes only
        // with three, the build tools, or the set of three.js parts the app
        // uses (the chunk holds only those), while the app's half changes
        // with every merge: on its own, its name and bytes stay the same from
        // deploy to deploy, so a returning browser has it already and
        // fetches only the app's half. The core and the orbit controls,
        // which load with it; the loaders and the exporter (three/examples)
        // stay in the chunks they are loaded on demand with. CI checks the
        // split is there ("The first load is split", ci.yml).
        manualChunks(id) {
          if (id.includes("/node_modules/three/build/") || id.includes("/node_modules/three/examples/jsm/controls/")) return "three";
        },
      },
    },
  },
};
