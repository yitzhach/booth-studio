// HANDOFF.md is the file every new session reads first, all of it (ROADMAP.md
// 1.1). It reached 3,496 lines because each round appended to it; since
// 2026-10-20 a round's bullet goes at the top of docs/HISTORY.md and the
// owner's answers in docs/DECISIONS.md. These keep it short, and keep every
// file it, CLAUDE.md, the reference docs and the skills point to in
// existence, so a split or a rename can't leave a session following a
// pointer to nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("HANDOFF.md stays under 500 lines: a round's detail goes to docs/HISTORY.md", () => {
  const lines = read("HANDOFF.md").split("\n").length;
  assert.ok(lines <= 500, `HANDOFF.md is ${lines} lines`);
});

// Named in backticks there, but Art-Talk-Back's files, not this repository's.
const PLATFORM_PATHS = new Set(["DECISIONS.md", "docs/HANDOFF.md", "docs/phase-5-booth.md", "docs/SHIPPING.md"]);
const POINTER = /`((?:\.claude|\.github|docs|src|tests|tools|worker|public)\/[\w./-]+\.\w+|[A-Z][A-Z_]+\.md)`/g;

test("every file HANDOFF.md, CLAUDE.md, the reference docs and the skills name exists", () => {
  const skills = readdirSync(new URL(".claude/skills/", root), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => `.claude/skills/${d.name}/SKILL.md`);
  const files = ["HANDOFF.md", "CLAUDE.md", "docs/WORKFLOW.md", "docs/STUDIO-PLATFORM.md", "docs/DIAGNOSING.md", "docs/DECISIONS.md", ...skills];
  const missing = [];
  let named = 0;
  for (const file of files)
    for (const [, path] of read(file).matchAll(POINTER)) {
      named++;
      if (!PLATFORM_PATHS.has(path) && !existsSync(new URL(path, root))) missing.push(`${file}: ${path}`);
    }
  assert.ok(named > 100, `found ${named} pointers`);
  assert.deepEqual(missing, []);
});
