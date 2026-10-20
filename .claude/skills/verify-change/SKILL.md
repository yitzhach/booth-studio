---
name: verify-change
description: Use before saying a booth-studio change works, is fixed or passes, and before every commit, push or pull request. Picks the suites the change needs, runs each one directly, reads its own exit status, and reports numbers — evidence before claims.
---

# Verify a change

Adapted from superpowers' verification-before-completion (see
`../THIRD_PARTY.md`) and this repository's testing rules (CLAUDE.md, HANDOFF.md
→ Testing).

**The rule:** nothing is called working, passing or fixed without a command run
in this session whose output says so. An earlier run, "it should pass", or a
subagent's report of success is not evidence; check the diff and run the suite.

## Pick what the change needs

| The change touches | Run |
| --- | --- |
| anything | `npm test` (Node suites) and `npm run build` |
| a panel, the scene, export, the page | the view suites that cover it — `grep -l <feature> tests/view-*.mjs`; the whole `npm run test:view` before merging |
| storage, sync, studio sign-in, `worker/` | `node tests/two-devices.mjs` with `STUDIO_PLATFORM=../Art-Talk-Back` (after `npm run build`; `pnpm install` there first) |
| `src/scene-ops.js` or a module it bundles | `npm run bundle:scene`, then compare with Art-Talk-Back's `workers/studio-api/src/vendor/booth-scene.js` |
| `worker/`, `wrangler.jsonc` | `npx wrangler deploy --dry-run --outdir /tmp/wd` (no credentials needed; lists the bindings) |
| a flow across tabs, downloads | `npm run test:browser` |
| only documentation | nothing to run; say so |

## Run each one directly

- **Never through a pipe.** `npm test | grep PASS` exits 0 when the suite
  fails. Write the log, then read the suite's own status at once:
  `node tests/view-roles.mjs > /tmp/v.log 2>&1; echo "exit=$?"`.
  `cmd > log; grep … log; echo $?` reports grep's status, not the suite's.
- **Count.** N suites means N PASS lines. A chain that died halfway leaves a
  log with PASS lines in it from the suites that ran before it.
- **One browser suite at a time**, and don't edit `src/` while a view suite
  runs: the suites drive a live Vite server, and a save reloads the page
  mid-assertion. To keep working during the full chain (about 25 minutes), run
  it in a snapshot: HANDOFF.md → Testing has the `git worktree` recipe.
- `BOOTH_TEST_CHROMIUM` is set by the session-start hook; if it is empty,
  prefix the command with `BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium`.

## A bug fix proves itself twice

Red, then green: the new test fails on the old code and passes on the new.
Show both runs (take the fix out, run, put it back, run), or say why the bug
cannot be caught by a test.

## What a test cannot settle

How a booth looks, how a drag feels, speed on the owner's 2014 iMac, a real
phone, a real H.264 file in QuickTime. Don't claim them. List them for
HANDOFF.md → Next as the owner's to check.

## Report

Numbers, not adjectives: "479 Node tests, 41/41 view suites, build exit 0".
Say what was skipped and why. Quote what failed.
