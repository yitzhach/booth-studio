// The linter (ROADMAP.md 1.5): ESLint's recommended rules, run in CI by
// `npm run lint`. What it is for here: a name that is not defined
// (`no-undef`) is a crash waiting on a code path no suite walks, and an
// import or variable nobody reads (`no-unused-vars`) is code a reader has to
// work out is dead. Two of the recommended rules are loosened, each for a
// reason this code has:
//
// - an empty `catch {}` is allowed: storage, the clipboard and the browser's
//   persist() all throw where a browser blocks them, and the app's answer is
//   to carry on — the block is empty on purpose, and a comment beside it
//   says why where it is not plain;
// - a parameter, a caught error, or a name starting with `_` may go unused:
//   handlers take arguments they don't read, and `const { assets: _a,
//   ...rest } = p` is how a field is dropped from a copy.
//
// `src/vendor/` is generated in Art-Talk-Back and never edited here; the
// build outputs and the folders .gitignore keeps out (local tools write
// there) are not source. The modules the scene build ships to studio-api
// are held to a Worker's globals by `npm run typecheck` (tsconfig.json),
// which follows their imports; here they share the app's.
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**", "dist-scene/**", "public/**", "src/vendor/**", ".studio-platform/**",
      ".wrangler/**", ".tmp-scratch/**", ".probe/**", "test-results/**",
    ],
  },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2024, sourceType: "module" },
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  // The app, in the browser. vite.config.js defines the build's stamp.
  {
    files: ["src/**/*.js"],
    languageOptions: { globals: { ...globals.browser, __APP_VERSION__: "readonly", __COMMIT_SHA__: "readonly", __BUILD_TIME__: "readonly" } },
  },
  // Node: the node suites and the config files.
  { files: ["tests/**/*.test.js", "*.js"], languageOptions: { globals: { ...globals.node } } },
  // Node driving a browser: the view and end-to-end suites and the tools,
  // whose page.evaluate callbacks run in the page.
  { files: ["tests/**/*.mjs", "tools/**/*.mjs"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  // The Cloudflare Worker.
  { files: ["worker/**/*.js"], languageOptions: { globals: { ...globals.serviceworker } } },
];
