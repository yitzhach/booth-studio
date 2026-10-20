---
name: steward
description: How a booth-studio pull request ships — merging to main deploys production, which checks must be green, the merge order with Art-Talk-Back, and what to do after a merge. Read on every PR, CI or review event for a booth-studio PR, and before opening or merging one.
---

# Steward — shipping a booth-studio pull request

This repository's own rules for driving a pull request to merged and live. The
cloud harness reads this file on PR, CI and review events; a session that opens
or merges a PR here should read it too. It adds this repo's conventions to the
harness's PR rules and never loosens them: nothing here permits skipping or
disabling a test, rewriting someone else's history, or merging on red.

## What a merge does

- **`main` is production.** Cloudflare's Git integration builds every push to
  `main` and deploys it as the `booth-studio` Worker
  (https://booth-studio.bobdylan2000.workers.dev). There is no other deploy
  step. GitHub Actions only checks (`.github/workflows/ci.yml`, job `booth`).
- **Every other branch gets a preview** at
  `https://<branch, with "/" as "-">-booth-studio.bobdylan2000.workers.dev`. A
  preview has no service bindings: `/v1/*` answers 503 and share links fail.
  Studio sign-in is tested on staging (`studio-booth-studio-staging`, deployed
  by Art-Talk-Back's "Deploy staging" workflow), never on a preview.
- **Merge commits**, not squash or rebase: the history reads "Merge pull
  request #N from …".

## Who may merge

CLAUDE.md → Shipping: Claude may merge its own pull requests once tests pass
and let the deploy run. Still the owner's: secrets, spending money, deleting
data or Workers, a new Worker's first deploy. A pull request that needs one of
those says so in its description and waits for the owner.

## Order across the two repositories

- App before platform, as a rule (CLAUDE.md → Shipping). It flips when this
  app needs a contract `studio-api` doesn't have yet (a route, a table, a
  field): then the Art-Talk-Back pull request merges and deploys first,
  because this app's `main` talks to production `studio-api`. Every pull
  request's description states its order.
- Two files are compared byte for byte by both repositories' CI:
  `src/vendor/studio-sdk.js` (generated in Art-Talk-Back; never edited here)
  and the platform's `workers/studio-api/src/vendor/booth-scene.js` (this
  repo's `npm run bundle:scene`). A change to `src/scene-ops.js` or anything it
  bundles (`model.js`, `quickstart.js`, `arrange.js`, `placement.js`) needs the
  platform's copy updated on the Art-Talk-Back branch of the same name; CI
  checks out that branch by itself. Such pairs merge back to back, then re-run
  whichever default-branch CI went red in between (Art-Talk-Back
  `docs/SHIPPING.md`).

## Ready to merge

1. CI `booth` is green on the head commit: node suites, build, the vendored
   SDK and scene checks, the two-device runs (offline), all view suites, the
   end-to-end checks.
2. The Cloudflare preview build passed (its check or comment on the PR).
3. No conflict with `main`. If there is one, merge `main` into the branch
   (never rebase a branch someone else has checked out) and let CI run again.
4. Every review thread is answered or resolved, and the `review-loop` skill's
   last round found nothing new.
5. The description says what changed, how it was verified (suites and
   counts), the cross-repo order, and what only a person can judge — by eye,
   on a phone, on the owner's machine.

## When CI is red

- Read the failing step's log first. The view-suite step runs every suite and
  names each one that failed, so one run shows every failure.
- Reproduce with the same command here (`BOOTH_TEST_CHROMIUM` comes from the
  session-start hook). Run browser suites one at a time: two at once on this
  sandbox's four cores time out with errors that are not bugs.
- Use the `root-cause` skill before changing code. A timeout with no code near
  it is not a flake until it has been reproduced or re-run once, as the
  harness's own rules say.

## After the merge

1. `node tools/verify-deploy.mjs --commit <merge sha>` waits until the live
   site serves that commit (or a later one containing it), then opens it in
   Chromium and checks that it starts. Report what it printed, including a
   failure. Exit 1 is a live page that did not start; exit 2, a deploy that
   never arrived; exit 3 is no verdict at all (the site or the browser could
   not be reached) — never roll back on a 3.
2. Hand off: what shipped, dated, as a bullet at the top of
   `docs/HISTORY.md`; any answer the owner gave in `docs/DECISIONS.md`; and in
   `HANDOFF.md`, Now where what is true changed and Next (what the owner must
   look at in person).
3. A bad deploy: on GitHub, the merged pull request → **Revert** → merge the
   revert; the old code deploys itself. Faster: Cloudflare → Workers & Pages →
   `booth-studio` → Deployments → **Rollback**, then revert on GitHub anyway,
   or the next merge brings the bad code back.
