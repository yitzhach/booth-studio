// Usage: node members.mjs <scene.js> — BoothScene's members, in order: first line,
// length, name, and the module-level names (imports, top-level consts and
// functions) each one reads. What cut.mjs takes by name.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const espree = require("espree");
const scope = require("eslint-scope");
const ast = espree.parse(readFileSync(process.argv[2], "utf8"), { ecmaVersion: "latest", sourceType: "module", range: true, loc: true });
const mod = scope.analyze(ast, { ecmaVersion: 2022, sourceType: "module" }).scopes.find((s) => s.type === "module");
const cls = ast.body.map((n) => n.declaration ?? n).find((d) => d.type === "ClassDeclaration");
for (const m of cls.body.body) {
  const used = new Set();
  for (const v of mod.variables)
    for (const r of v.references) if (r.identifier.range[0] >= m.range[0] && r.identifier.range[0] < m.range[1]) used.add(v.name);
  console.log(`${m.loc.start.line}\t${m.loc.end.line - m.loc.start.line + 1}\t${m.key.name}\t${[...used].sort().join(" ")}`);
}
