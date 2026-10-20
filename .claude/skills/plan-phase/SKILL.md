---
name: plan-phase
description: Use before building a ROADMAP.md item or any booth-studio change bigger than a small fix. Settles what is the agent's to decide, asks the owner the few decisions that are the owner's in one batch with a default each, writes the phase plan (<NAME>_PHASE.md) as small test-first tasks with exact files and commands, and ticks ROADMAP.md as work lands.
---

# Plan a phase

Adapted from superpowers' brainstorming, writing-plans and executing-plans (see
`../THIRD_PARTY.md`), shaped to how this owner works: the owner's decisions in one
batch with a default each, the plan as a file in the repository, chat replies
short (CLAUDE.md).

## 1. Know before asking

Read the ROADMAP.md item, HANDOFF.md → Now and Next, and the code it touches.
Decide everything that is yours to decide. What is left for the owner is what
changes what gets built and only the owner can answer: money, server work, a rule in
CLAUDE.md, a look or a feel, a name, a price.

## 2. One batch of questions

At most four, in one message (the AskUserQuestion tool), each with options and
the recommended one first. If none are needed, say in one line which defaults
were taken. Never one question per message: the owner often reads on a
phone. Record each answer, dated, in the phase doc and in `docs/DECISIONS.md`.

## 3. Size it

- A quick, clear task: do it; no plan file.
- A small change: the plan is a few lines in the pull request's description.
- A ROADMAP.md item, or anything longer than a day: a phase doc.

## 4. The phase doc

`<NAME>_PHASE.md` at the root, like `ART_SHOW_PHASE.md` and `WALLS_PHASE.md`.

- **Goal** in one sentence, the ROADMAP.md item it delivers, and its gate.
- **Constraints**, copied exactly: schema 1 only gains optional fields;
  local-first signed out; the app runs with `public/assets` empty; any budget
  the item sets (lines, kilobytes, minutes).
- **Decisions:** the owner's, dated; yours, each marked as your call.
- **Files:** which are created or changed, and what each is responsible for.
- **Tasks**, each one pull request or smaller, each with: the files; the
  failing test first (its name and what it asserts); the command that shows it
  failing; the change (function, file, exact values); the command that shows
  it passing; the commit.
- **Review focus:** the situations no task's test covers that are most likely
  to bite a real person — a phone, a backup from September, no network, a
  25 MB photograph — each given a test in the task that owns it.
- **For the owner:** what only a person can check, to go into HANDOFF.md →
  Next when the phase lands.

Before handing it over, read it as a stranger would: every promise in the
ROADMAP.md item has a task; no line says "TBD" or "handle edge cases"; names
agree from task to task; the plan is shorter than the code it describes.

## 5. Carry it out

Inline, task by task, in this session — not a subagent per task: this sandbox
runs one browser suite at a time. Keep a **Rulings** list in the phase doc for
every judgement call made on the way: what was decided, why, and what it costs
if wrong. Tick the ROADMAP.md box when the pull request has merged, not
before.
