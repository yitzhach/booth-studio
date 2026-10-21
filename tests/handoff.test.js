// HANDOFF.md is the file every new session reads first, all of it (ROADMAP.md
// 1.1). It reached 3,496 lines because each round appended to it; since
// 2026-10-21 a round's bullet goes at the top of docs/HISTORY.md and the
// owner's answers in docs/DECISIONS.md. These keep it short, and keep the
// live files' pointers whole — every file they name exists, and every
// "HANDOFF.md → <section>" names a section it has — so a split or a rename
// can't leave a session following a pointer to nothing. The record files
// (docs/HISTORY.md, docs/OPEN-CHECKS.md, docs/LESSONS.md, ROADMAP.md's notes)
// name files and sections as they were when written, and are left as they are.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const read = (path) => readFileSync(join(root, path), "utf8");
const lineCount = (text) => text.split("\n").length - (text.endsWith("\n") ? 1 : 0);

// Aim under 500, as it was split; past 600 the next round moves detail out
// (a round's to docs/HISTORY.md, an old Next item to docs/OPEN-CHECKS.md)
// instead of adding to it.
test("HANDOFF.md stays at 600 lines or fewer: a round's detail goes to docs/HISTORY.md", () => {
  const lines = lineCount(read("HANDOFF.md"));
  assert.ok(lines <= 600, `HANDOFF.md is ${lines} lines: move detail to docs/HISTORY.md or docs/OPEN-CHECKS.md`);
});

const skills = readdirSync(join(root, ".claude/skills"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => `.claude/skills/${d.name}/SKILL.md`);
const LIVE_DOCS = ["HANDOFF.md", "CLAUDE.md", "README.md", "docs/WORKFLOW.md", "docs/STUDIO-PLATFORM.md", "docs/DIAGNOSING.md", "docs/DECISIONS.md", ".claude/skills/THIRD_PARTY.md", ...skills];

// Named in backticks there, but other repositories' files: Art-Talk-Back's,
// and the two upstream projects' that .claude/skills/THIRD_PARTY.md credits.
const OTHER_REPOS = new Set(["docs/HANDOFF.md", "docs/phase-5-booth.md", "docs/SHIPPING.md", "SKILL.md", "ITERATE.md"]);
// A path in one of the repository's folders, an ALL-CAPS root document, or
// one of the root config files by name (a bare `main.js` means src/main.js).
const POINTER = /`((?:\.\.\/)*(?:(?:\.claude|\.github|docs|src|tests|tools|worker|public)\/[\w./-]+\.\w+|[A-Z][A-Z_]+\.md|(?:package|tsconfig(?:\.app)?)\.json|(?:eslint|vite|vite\.scene)\.config\.js|wrangler\.jsonc|index\.html))`/g;

test("every file the live docs and the skills name exists", () => {
  const missing = [];
  let named = 0;
  for (const file of LIVE_DOCS)
    for (const [, path] of read(file).matchAll(POINTER)) {
      named++;
      // `../THIRD_PARTY.md` from a skill is relative to the skill's folder.
      const where = path.startsWith("../") ? normalize(join(dirname(file), path)) : path;
      if (!OTHER_REPOS.has(path) && !existsSync(join(root, where))) missing.push(`${file}: ${path}`);
    }
  assert.ok(named > 150, `found ${named} pointers`);
  assert.deepEqual(missing, []);
});

test("every \"HANDOFF.md → <section>\" in the live docs, the skills, ROADMAP.md and the code names a section HANDOFF.md has", () => {
  const sections = [...read("HANDOFF.md").matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  // The whole name, then the end or a space: "Next, item 2" and "Testing has
  // the …" name Next and Testing; "Rules" alone names nothing. "Now and Next"
  // is two.
  const names = (said) => said.split(/ and /).every((part) => sections.some((h) => part === h || part.startsWith(`${h} `)));
  const code = ["src", "worker", "tools", "tests"].flatMap((dir) =>
    readdirSync(join(root, dir), { recursive: true })
      .map(String)
      .filter((f) => /\.m?js$/.test(f) && !f.startsWith("vendor"))
      .map((f) => `${dir}/${f}`),
  );
  const wrong = [];
  let named = 0;
  for (const file of [...LIVE_DOCS, "ROADMAP.md", ...code])
    for (const [, said] of read(file).matchAll(/`?HANDOFF(?:\.md)?`?\s*→\s*([A-Z][^\n.;,)`*]*)/g)) {
      named++;
      if (!names(said.trim())) wrong.push(`${file}: HANDOFF.md → ${said.trim()}`);
    }
  assert.ok(named > 15, `found ${named} section pointers`);
  assert.deepEqual(wrong, []);
});
