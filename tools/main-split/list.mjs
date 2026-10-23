// Usage: node list.mjs <main.js> <from> <to> — boot()'s top-level statements
// numbered <from>..<to>, with their lines: the indices extract.mjs takes.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.cwd() + "/");
const espree = require("espree");
const src = readFileSync(process.argv[2], "utf8"); const lines = src.split("\n");
const ast = espree.parse(src, { ecmaVersion: "latest", sourceType: "module", loc: true });
const boot = ast.body.find((d) => d.type === "FunctionDeclaration" && d.id.name === "boot");
const [a, b] = process.argv.slice(3).map(Number);
boot.body.body.forEach((s, i) => { if (i >= a && i <= b) console.log(i, s.type, s.loc.start.line, s.loc.end.line, lines[s.loc.start.line - 1].slice(0, 70)); });
