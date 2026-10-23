// Usage: node imports.mjs <main.js> <names,...> → import lines (../ paths) for names main imports.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const espree = require("espree");
const [, , file, namesArg] = process.argv;
const want = new Set(namesArg.split(","));
const ast = espree.parse(readFileSync(file, "utf8"), { ecmaVersion: "latest", sourceType: "module" });
const out = [], found = new Set();
for (const d of ast.body) {
  if (d.type !== "ImportDeclaration") continue;
  const specs = d.specifiers.filter((s) => s.type === "ImportSpecifier" && want.has(s.local.name));
  if (!specs.length) continue;
  specs.forEach((s) => found.add(s.local.name));
  const src = d.source.value.replace(/^\.\//, "../");
  out.push(`import { ${specs.map((s) => (s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`)).join(", ")} } from "${src}";`);
}
console.log(out.join("\n"));
const miss = [...want].filter((n) => !found.has(n));
if (miss.length) console.error("not imported by main:", miss.join(" "));
