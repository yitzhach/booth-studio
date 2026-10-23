// Usage: node ctxify.mjs <in.js> <out.js> <state,names> <helper,names>
// Rewrites free references to state names as ctx.<name>; reports free names left.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const espree = require("espree"), scope = require("eslint-scope");
const [, , inp, out, stateArg, helperArg] = process.argv;
const state = new Set(stateArg.split(",")), helpers = new Set(helperArg.split(","));
const body = readFileSync(inp, "utf8");
const pre = "function __f(ctx) {\n", src = pre + body + "\n}";
const ast = espree.parse(src, { ecmaVersion: "latest", sourceType: "module", range: true });
const sm = scope.analyze(ast, { ecmaVersion: 2022, sourceType: "module" });
const parents = new Map();
(function walk(n, par) { if (!n || typeof n.type !== "string") return; parents.set(n, par);
  for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === "string" && walk(c, n)); else if (v && typeof v.type === "string") walk(v, n); } })(ast, null);
const edits = [], left = new Set();
for (const ref of sm.globalScope.through) {
  const id = ref.identifier, name = id.name;
  if (state.has(name)) {
    const par = parents.get(id);
    if (par?.type === "Property" && par.shorthand && par.value === id) edits.push([id.range[0], id.range[1], `${name}: ctx.${name}`]);
    else edits.push([id.range[0], id.range[1], `ctx.${name}`]);
  } else if (!helpers.has(name)) left.add(name);
}
let s = src;
for (const [a, b, t] of edits.sort((x, y) => y[0] - x[0])) s = s.slice(0, a) + t + s.slice(b);
writeFileSync(out, s.slice(pre.length, -2));
console.log("rewrote", edits.length, "| free names left:", [...left].sort().join(" "));
