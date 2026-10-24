// Usage: node cut.mjs <scene.js> <name,...> <export name> <out module> <out scene>
// Cuts those BoothScene members, each with the comment lines directly above
// it, out of the class as whole lines, in source order, into
// `export const <export name> = { … };` — the same text, but for the comma
// an object literal needs after each method's closing brace. Then reports,
// for the moved code: each module-level name it reads (imported, or declared
// in scene.js and whether anything left behind still reads it), and each
// `this.<name>(` it calls, so a call the class no longer answers is seen.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const espree = require("espree");
const scope = require("eslint-scope");
const [, , file, namesArg, exportName, outModule, outScene] = process.argv;
const want = namesArg.split(",");
const src = readFileSync(file, "utf8");
const lines = src.split("\n");
const ast = espree.parse(src, { ecmaVersion: "latest", sourceType: "module", range: true, loc: true });
const mod = scope.analyze(ast, { ecmaVersion: 2022, sourceType: "module" }).scopes.find((s) => s.type === "module");
const cls = ast.body.map((n) => n.declaration ?? n).find((d) => d.type === "ClassDeclaration");
const isComment = (l) => /^\s*(\/\/|\/\*|\*)/.test(l);
const cut = [];
for (const m of cls.body.body) {
  if (!want.includes(m.key.name)) continue;
  let first = m.loc.start.line - 1; // 0-based
  while (first > 0 && isComment(lines[first - 1])) first--;
  cut.push({ name: m.key.name, first, last: m.loc.end.line - 1, range: [first, m.range[1]] });
}
const missing = want.filter((n) => !cut.some((c) => c.name === n));
if (missing.length) { console.error("not members of the class:", missing.join(" ")); process.exit(1); }
const body = cut.map((c) => {
  const text = lines.slice(c.first, c.last + 1);
  if (!/^ {2}\}$/.test(text.at(-1))) throw new Error(`${c.name} does not end on a line of its own "  }"`);
  text[text.length - 1] = "  },";
  return text.join("\n");
});
writeFileSync(outModule, `export const ${exportName} = {\n${body.join("\n")}\n};\n`);
const gone = new Set(cut.flatMap((c) => Array.from({ length: c.last - c.first + 1 }, (_, i) => c.first + i)));
writeFileSync(outScene, lines.filter((_, i) => !gone.has(i)).join("\n"));
// What the moved code reads from the module's scope.
const inCut = (at) => cut.some((c) => at >= lineStart(c.first) && at < lineStart(c.last + 1));
const starts = [0]; for (const l of lines) starts.push(starts.at(-1) + l.length + 1);
function lineStart(i) { return starts[i]; }
const imported = new Map();
for (const d of ast.body) if (d.type === "ImportDeclaration") for (const s of d.specifiers) imported.set(s.local.name, d.source.value);
for (const v of mod.variables) {
  const refs = v.references.filter((r) => inCut(r.identifier.range[0]));
  if (!refs.length) continue;
  const left = v.references.filter((r) => !inCut(r.identifier.range[0])).length;
  const where = imported.has(v.name) ? `import from ${imported.get(v.name)}` : `declared in scene.js`;
  console.log(`${v.name.padEnd(22)} ${where}${left ? `; still read ${left}× by what stays` : "; read by nothing that stays"}`);
}
const movedText = body.join("\n");
const calls = [...new Set([...movedText.matchAll(/this\.([A-Za-z_$][\w$]*)\(/g)].map((x) => x[1]))].sort();
console.log("this.<name>( calls:", calls.join(" "));
