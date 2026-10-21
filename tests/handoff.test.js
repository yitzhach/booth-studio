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
import { fileURLToPath } from "node:url";

// A path, not a URL's: a checkout in "My Projects" has a space in it.
const root = fileURLToPath(new URL("..", import.meta.url));
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

// Named in backticks there, but other repositories' files — Art-Talk-Back's,
// and the two upstream projects' that THIRD_PARTY.md credits — each excused
// only in the file that cites it.
const OTHER_REPOS = {
  "CLAUDE.md": ["docs/phase-5-booth.md", "docs/SHIPPING.md"],
  "docs/STUDIO-PLATFORM.md": ["docs/HANDOFF.md", "docs/phase-5-booth.md"],
  ".claude/skills/steward/SKILL.md": ["docs/SHIPPING.md"],
  ".claude/skills/THIRD_PARTY.md": ["docs/SHIPPING.md", "SKILL.md", "ITERATE.md"],
};
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
      if (!OTHER_REPOS[file]?.includes(path) && !existsSync(join(root, where))) missing.push(`${file}: ${path}`);
    }
  assert.ok(named > 150, `found ${named} pointers`);
  assert.deepEqual(missing, []);
});

test("every \"HANDOFF.md → <section>\" in the live docs, the skills, ROADMAP.md, FUTURE_BUILD.md and the code names a section HANDOFF.md has, and never an item by its number", () => {
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
  for (const file of [...LIVE_DOCS, "ROADMAP.md", "FUTURE_BUILD.md", ...code]) {
    const text = read(file);
    // `→ **Next**` and `→ "Next"` are the same pointer as `→ Next`.
    for (const [, said] of text.matchAll(/`?HANDOFF(?:\.md)?`?\s*→\s*(?:\*\*|")?([A-Z][^\n.;,)`*"]*)/g)) {
      named++;
      if (!names(said.trim())) wrong.push(`${file}: HANDOFF.md → ${said.trim()}`);
    }
    // Next's items are renumbered as they open and close: name the item.
    for (const [m] of text.matchAll(/HANDOFF(?:\.md)?`?\s*→\s*Next,?\s+item\s+\d+/g)) wrong.push(`${file}: ${m} (name the item, not its number)`);
  }
  assert.ok(named > 15, `found ${named} section pointers`);
  assert.deepEqual(wrong, []);
});

test("every `docs/<file>.md` → \"<heading>\" in the live docs and the skills names a heading that file has", () => {
  const wrong = [];
  let named = 0;
  for (const file of LIVE_DOCS)
    for (const [, doc, heading] of read(file).matchAll(/`(docs\/[\w-]+\.md)`\s*→\s*"([^"\n]+)"/g)) {
      named++;
      const headings = existsSync(join(root, doc)) ? [...read(doc).matchAll(/^#+ (.+)$/gm)].map((m) => m[1]) : [];
      if (!headings.some((h) => h.includes(`"${heading}"`) || h === heading)) wrong.push(`${file}: ${doc} → "${heading}"`);
    }
  assert.ok(named >= 2, `found ${named} heading pointers`);
  assert.deepEqual(wrong, []);
});
