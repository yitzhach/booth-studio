---
name: root-cause
description: Use on any booth-studio bug report, failing test, red CI run or "it doesn't work", before proposing a fix — reproduce it, find the root cause with evidence, then fix it behind a failing test. Includes this app's known first checks (the deployed commit, BOOTH_ASSETS, the video codec, on-demand drawing).
---

# Root cause first

Adapted from superpowers' systematic-debugging (see `../THIRD_PARTY.md`).
HANDOFF.md records reports here that were guessed at twice before anyone
measured; this skill is so that the third time is not a guess.

**The rule:** no fix until the cause can be said as "X happens because Y",
backed by something observed in this session.

## 1. Read it and reproduce it

- Read the whole message, stack trace or CI step log. Note the file and line.
- Reproduce with the smallest thing that shows it: one Node test, one view
  suite, a short Playwright script. If it can't be reproduced, gather more
  data; don't guess.
- What changed since it last worked: `git log -p`, a dependency bump, the
  Art-Talk-Back branch CI picked, a new Chromium.

## 2. This app's first questions

- **"It's broken on the live site" or "my fix didn't ship":** compare the live
  commit with `main` before anything else — `node tools/verify-deploy.mjs
  --check-only`, or `window.BOOTH_BUILD` in the browser that sees it. A
  Cloudflare build takes minutes, and two reports were a build still running.
- **A texture, ground or HDRI not showing:** `window.BOOTH_ASSETS` from the
  browser that sees it. HANDOFF.md → Diagnosing "the texture isn't showing"
  lists the causes already ruled out; don't re-investigate them.
- **A video that won't play:** which codec it used. VP9 in MP4 does not open
  in QuickTime (HANDOFF.md → Diagnosing "the video won't play").
- **Something that appears late, or only after the mouse moves:** the
  viewport draws on demand, and the change never reached `invalidate()`
  (HANDOFF.md → Rules that are easy to break).
- **Passes the suites, fails for the owner:** the suites start every panel on
  All, with the section chips off (`navigator.webdriver`). Anything that
  scrolls to a control must go through `reveal()` / `showSection`.
- **Sync, sign-in, two devices:** `reconcile()` in `src/studio.js` is the rule
  book; reproduce with `tests/two-devices.mjs`.
- **Red in CI only:** the same Chromium (build 1194)? The same Art-Talk-Back
  branch? Two browser suites at once on this machine?

## 3. Compare with what works

Find the nearest path that works — another panel, another export, the last
good commit — and list every difference, however small.

## 4. One hypothesis at a time

Write it down, test it with the smallest change, one variable at a time. If it
doesn't hold, form a new one; don't stack a second fix on the first.

## 5. Fix behind a failing test

Write the test that fails because of the root cause (a Node test for a pure
module, the view suite for the page), watch it fail, fix the cause where it
starts, watch the test pass, then run `verify-change`. No "while I'm here"
changes in the same commit.

## Three failed fixes: stop

If three fixes have each failed or moved the problem somewhere else, the design
is the question, not the next fix. Stop and put it to the owner — what was
found, what was tried, the options — before a fourth.

## No root cause after all

When it really is the environment (a device, a browser version, the network),
write down what was ruled out, add what will make it visible next time (a
toast, a `window.BOOTH_*` diagnostic), and put the check that needs a person in
HANDOFF.md → Next.
