---
name: review-loop
description: Use when a booth-studio change is ready for review — before opening or merging a pull request, or when asked to iterate, "review until clean", or check bugs, security, performance, architecture and UX. Runs the built-in reviewers over the branch's diff in rounds until a round finds nothing new (three at most), fixing small findings and asking about large ones.
---

# Review loop

The method comes from jingzhao-l/iterate-skill (see `../THIRD_PARTY.md`):
review across several dimensions in rounds until a round finds nothing new, fix
small things directly and ask before large ones, and never report on code
nobody read. None of its code is used: no installer, no command-line tool, no
nine parallel reviewers, no `iterate/*` branches, no files in the repository
root. The built-in review skills do the reviewing, on this branch.

## Scope

The branch against `origin/main` (`git diff origin/main...HEAD`, plus anything
uncommitted). Not the whole repository: the clean-up of `main.js` and
`scene.js` is ROADMAP.md phase 1, not something a review round drifts into.

## Dimensions, and what checks each

| Dimension | Check |
| --- | --- |
| Correctness, efficiency, reuse | `/code-review medium` on the diff; `high` when it touches storage, sync, export or `worker/` |
| Simplicity | `/simplify` when the diff adds more than about 100 lines |
| Security | `/security-review` when it touches `worker/`, sign-in or sync, share links, file import, or anything that reads outside input |
| Tests | every changed behaviour has a test that fails without it (`verify-change`) |
| UI and accessibility | the view suites for the panels touched, at desktop size and at 390 px; site-qa once it is set up here (ROADMAP.md 1.10) |
| This repo's rules | schema 1 only gains optional fields; the app runs with `public/assets` empty; a view setting never reaches an export; images stay out of per-edit copies; signed out, nothing needs the network (HANDOFF.md → Rules that are easy to break) |
| The promise | the phase doc or ROADMAP.md item the pull request claims: everything it promises is there, and nothing it doesn't |

## One round

1. Run the checks that apply.
2. **Verify each finding before acting on it** (from superpowers'
   receiving-code-review). Open the code it names; trace a real path from a
   person's action or an input to the failure. A finding about code nobody
   opened is dropped. Reviewers, bots included, can be wrong: answer with the
   reason, not with agreement.
3. **Small and local** — one file, about 20 lines or fewer, no change to the
   schema, an API, the platform contract or the file layout: fix it now.
4. **Larger, or a design question:** not in the loop. Put it to the owner with
   a recommendation (one batched question, as `plan-phase` does), or record it
   as a follow-up in the pull request's description.
5. Run `verify-change` for what this round changed.

Stop when a round brings no new confirmed finding, or after three rounds, and
say what is still open. A finding that keeps coming back has its cause
somewhere else: use `root-cause`.

## Record

A short **Review** section in the pull request's description: rounds run, what
was fixed, what was left and why — one line each. No separate log file.
