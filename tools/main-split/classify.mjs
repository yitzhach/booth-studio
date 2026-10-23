// Usage: node classify.mjs <main.js> "<name name ...>" — says, for each name the moved
// code reads, whether main.js imports it, boot() declares it (let/const/fn, and
// whether after ctx) or it is a global.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const espree = require("espree");
const src = readFileSync(process.argv[2], "utf8");
const names = process.argv[3].split(" ");
const ast = espree.parse(src, { ecmaVersion: "latest", sourceType: "module", loc: true });
const kind = new Map();
for (const d of ast.body) {
  if (d.type === "ImportDeclaration") d.specifiers.forEach((s) => kind.set(s.local.name, "import"));
  if (d.type === "VariableDeclaration") d.declarations.forEach((x) => x.id.name && kind.set(x.id.name, "top-" + d.kind));
  if (d.type === "FunctionDeclaration") kind.set(d.id.name, d.id.name === "boot" ? "boot" : "top-fn");
}
const boot = ast.body.find((d) => d.type === "FunctionDeclaration" && d.id.name === "boot");
const ctxLine = boot.body.body.find((s) => s.type === "VariableDeclaration" && s.declarations[0].id.name === "ctx").loc.start.line;
for (const s of boot.body.body) {
  if (s.type === "FunctionDeclaration") kind.set(s.id.name, "fn");
  if (s.type === "VariableDeclaration") for (const x of s.declarations) {
    const ids = x.id.type === "Identifier" ? [x.id.name] : x.id.type === "ObjectPattern" ? x.id.properties.map((p) => p.value.name) : [];
    ids.forEach((n) => kind.set(n, `${s.kind}@${s.loc.start.line}${s.loc.start.line > ctxLine ? ">ctx" : ""}`));
  }
}
for (const n of names) console.log(n.padEnd(22), kind.get(n) || "global?");
