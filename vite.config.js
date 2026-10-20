import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

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

export default {
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT_SHA__: JSON.stringify(commitSha()),
  },
  build: {
    rollupOptions: {
      output: {
        // three.js in a file of its own (ROADMAP.md 1.6). It is half of the
        // first load — about 550 KB of the 1.1 MB script — and changes only
        // when the dependency does, while the app's half changes with every
        // merge: on its own, its name and bytes stay the same from deploy to
        // deploy, so a returning browser has it already and fetches only the
        // app's half. Only the core: the loaders and the exporter
        // (three/examples) stay in the chunks they are loaded on demand with.
        manualChunks(id) {
          if (id.includes("/node_modules/three/build/")) return "three";
        },
      },
    },
  },
};
