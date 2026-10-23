// Usage: node extract.mjs <main.js> <#i,#j,...> <out-moved.js> <out-main.js> [placeholder line]
// Cuts boot()'s top-level statements by index (from list.mjs), each with the
// comment lines directly above it, out of main.js as whole lines, in source
// order. The placeholder line, if given, stands where the first one stood.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const espree = require("espree");
const [, , file, namesArg, outMoved, outMain, placeholder] = process.argv;
const want = new Set(namesArg.split(","));
const src = readFileSync(file, "utf8");
const lines = src.split("\n");
const ast = espree.parse(src, { ecmaVersion: "latest", sourceType: "module", range: true, loc: true });
const boot = ast.body.find((d) => d.type === "FunctionDeclaration" && d.id.name === "boot");
const stmts = boot.body.body;
const cuts = [],
  found = new Set();
stmts.forEach((s, i) => {
  if (!want.has("#" + i)) return;
  found.add("#" + i);
  const prevEnd = i ? stmts[i - 1].loc.end.line : boot.body.loc.start.line;
  let start = s.loc.start.line;
  // Walk up over the comment lines between the previous statement and this one.
  while (start - 1 > prevEnd && /^\s*(\/\/|\/\*|\*)/.test(lines[start - 2])) start--;
  cuts.push([start, s.loc.end.line]);
});
const miss = [...want].filter((n) => !found.has(n));
if (miss.length) {
  console.error("not found:", miss.join(" "));
  process.exit(1);
}
const moved = [],
  keep = [];
let placed = false;
for (let ln = 1; ln <= lines.length; ln++) {
  if (cuts.some(([a, b]) => ln >= a && ln <= b)) {
    moved.push(lines[ln - 1]);
    if (!placed && placeholder) {
      keep.push(placeholder);
      placed = true;
    }
  } else keep.push(lines[ln - 1]);
}
writeFileSync(outMoved, moved.join("\n") + "\n");
writeFileSync(outMain, keep.join("\n"));
console.log(cuts.map(([a, b]) => `${a}-${b}`).join(" "), "| moved", moved.length, "lines");
