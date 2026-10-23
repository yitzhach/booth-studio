// Usage: node prune.mjs <file> <names,...> — drops those import specifiers (by local name);
// an import left with none is removed whole. Prints what it dropped.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const espree = require("espree");
const [, , file, namesArg] = process.argv;
const drop = new Set(namesArg.split(","));
let src = readFileSync(file, "utf8");
const ast = espree.parse(src, { ecmaVersion: "latest", sourceType: "module", range: true });
const edits = [], done = new Set();
for (const d of ast.body) {
  if (d.type !== "ImportDeclaration" || !d.specifiers.length) continue;
  const gone = d.specifiers.filter((s) => drop.has(s.local.name));
  if (!gone.length) continue;
  gone.forEach((s) => done.add(s.local.name));
  if (gone.length === d.specifiers.length) {
    let [a, b] = d.range; if (src[b] === "\n") b++;
    edits.push([a, b, ""]);
    continue;
  }
  // One line: write the kept specifiers back as they were spelled.
  if (!src.slice(...d.range).includes("\n")) {
    const keep = d.specifiers.filter((s) => !drop.has(s.local.name)).map((s) => src.slice(...s.range));
    const open = src.indexOf("{", d.range[0]), close = src.indexOf("}", open);
    edits.push([open, close + 1, "{ " + keep.join(", ") + " }"]);
    continue;
  }
  // remove each specifier with its following comma and spaces (or preceding, if last)
  for (const s of gone) {
    let [a, b] = s.range;
    const after = src.slice(b).match(/^\s*,[ \t]*\n?[ \t]*/);
    if (after) b += after[0].length;
    else { const before = src.slice(0, a).match(/,\s*$/); if (before) a -= before[0].length; }
    edits.push([a, b, ""]);
  }
}
for (const [a, b, t] of edits.sort((x, y) => y[0] - x[0])) src = src.slice(0, a) + t + src.slice(b);
writeFileSync(file, src);
const miss = [...drop].filter((n) => !done.has(n));
console.log("dropped", done.size, miss.length ? "| not found: " + miss.join(" ") : "");
