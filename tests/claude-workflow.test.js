// The development workflow's own files (docs/WORKFLOW.md): the project skills
// in .claude/skills and the session-start hook in .claude/settings.json.
//
// A skill with broken front matter is not loaded at all, and nothing says so:
// it is simply missing from the next session's list. `claude plugin validate`
// does not catch that (it passed a SKILL.md whose name was `[broken`), so this
// suite reads each one the way the loader needs it. It also keeps the names
// clear of Claude Code's own: a project skill named like a bundled one is
// shadowed or shadows it, and either way the wrong instructions run.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const skillsDir = path.join(root, ".claude", "skills");

// Claude Code's bundled skills and built-in commands, and the skills this
// cloud environment adds, that a project skill must not reuse. The bundled
// list was read from the CLI (2.1.304); the rest are the ones a session sees
// most. It goes stale as Claude Code grows: add a name when one appears.
// `site-qa` is left out on purpose: ROADMAP.md 1.10 brings yitzhach/site-qa's
// own skill into this repository under that name.
const TAKEN = new Set([
  "artifact-diagramming", "batch", "claude-code-docs", "code-review", "commit",
  "dataviz", "debug", "explain-usage", "fewer-permission-prompts",
  "keybindings-help", "loop", "memory-types", "plugin-authoring", "pr",
  "simplify", "update-config", "verify", "workflow-authoring",
  "plan", "init", "review", "security-review", "run", "help", "clear",
  "compact", "config", "doctor", "memory", "model", "status", "hooks",
  "session-start-hook", "skill-creator", "artifact-design",
  "artifact-capabilities", "claude-api", "deep-research", "docs",
]);

const skills = readdirSync(skillsDir).filter((d) =>
  statSync(path.join(skillsDir, d)).isDirectory(),
);

/**
 * The front matter as the loader reads it: a `---` block of `key: value`
 * lines. Values here are plain YAML scalars, so one may not contain ": " or
 * " #", nor start with a character that opens another YAML form.
 */
function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text.replace(/\r\n/g, "\n"));
  assert.ok(m, "starts with a --- front-matter block");
  const fields = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([a-z-]+): (.*)$/.exec(line);
    assert.ok(kv, `front-matter line is "key: value": ${line}`);
    const value = kv[2];
    assert.ok(!/^[[\]{}&*!|>'"%@`]/.test(value), `${kv[1]} starts as a plain scalar`);
    assert.ok(!value.includes(": ") && !value.includes(" #"), `${kv[1]} has no ": " or " #"`);
    fields[kv[1]] = value;
  }
  return fields;
}

test("the six workflow skills are there", () => {
  for (const name of ["plan-phase", "product-strategy", "review-loop", "root-cause", "steward", "verify-change"]) {
    assert.ok(skills.includes(name), `.claude/skills/${name}`);
  }
});

for (const dir of skills) {
  test(`skill ${dir} loads`, () => {
    const text = readFileSync(path.join(skillsDir, dir, "SKILL.md"), "utf8");
    const { name, description } = frontMatter(text);
    assert.equal(name, dir, "name matches its directory");
    assert.match(name, /^[a-z0-9-]{1,64}$/);
    assert.ok(!TAKEN.has(name), `${name} is not a Claude Code name`);
    assert.ok(description && description.length <= 1024, "description present, at most 1024 characters");
    // Every file a skill points at relative to itself exists.
    for (const [, rel] of text.matchAll(/`(\.{1,2}\/[^`\s]+)`/g)) {
      assert.ok(existsSync(path.join(skillsDir, dir, rel)), `${dir} → ${rel} exists`);
    }
  });
}

test("the session-start hook is registered and executable", () => {
  const settings = JSON.parse(readFileSync(path.join(root, ".claude", "settings.json"), "utf8"));
  const commands = settings.hooks.SessionStart.flatMap((h) => h.hooks.map((x) => x.command));
  assert.deepEqual(commands, ['"$CLAUDE_PROJECT_DIR"/.claude/hooks/session-start.sh']);
  const hook = path.join(root, ".claude", "hooks", "session-start.sh");
  assert.ok(statSync(hook).mode & 0o111, "the hook is executable");
  assert.match(readFileSync(hook, "utf8"), /CLAUDE_CODE_REMOTE/, "it runs in cloud sessions only");
});
