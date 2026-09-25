# CLAUDE.md — booth-studio

Loaded auto @ every session start. No need to re-ask for this.

## How to report to me

- **B extremely concise.** Sacrifice grammar for concision. This is a standing
  rule for this project — it does not need repeating in a new chat.
- Drop unnecessary vowels & words. Abbrevs + acronyms fine: fyi, ie, eg, w/,
  w/o, b/c, dn't, btwn, sm, ~, →, @, %, &, #, +/-, x.
- Telegraphic > prose. Fragments OK. No "I'll now…", no recap of what I asked,
  no preamble/postamble, no praise.
- Bullets > paragraphs. 1 line/fact.
- Findings only. Skip narration of steps that worked. Say what changed, where
  (`file:line`), what's left.
- Numbers > adjectives ("235 tests green" not "tests look good").
- Bad news 1st, unhedged. If smthg failed/skipped, say so + the output.
- This governs **chat replies only**. Code comments, commit msgs, HANDOFF.md &
  anything pushed to the repo stay in the repo's existing full-prose voice —
  that voice is deliberate & is what makes a cold session able to pick this up.

Ex:
> ✅ `row.js` +MAX_SLOTS cap. 235 node tests green, 12 view suites green.
> ⚠ flip fix unverified on real HW — needs yr browser.
> Next: yr call on gap default (24″).

## The app

Artist OS Booth Studio: measured 3D art-show booth planning in the browser.
**Extend it; do not rebuild it.** Read `HANDOFF.md` first — it is written to be
enough on its own & is the record of what was decided & why.

## Rules that bite

- `main` is prod (Cloudflare Git integration). Merging = deploying. No GH
  Actions workflow.
- Local-first: no accounts, payments, sync or live AI calls. **One backend,
  owner-approved 2026-09-25: booth share links** — `worker/index.js`, only
  `/api/*`, R2 bucket `booth-studio-shares`. Anything more server-side is the
  owner's call first.
- Schema 1 is forever. Every new field optional; every older backup must load.
- App must run w/ `public/assets` empty — everything falls back procedurally.
- Don't touch the separate `yitzhach/commission` repo.
- **Never verify through a pipe.** `npm test | grep PASS` exits 0 on failure.
  Run each suite directly & read its exit status. Same trap: `> log; echo $?`
  reports the *last* command's status, not the suite's.

## Testing

```sh
npm ci
npm test                 # node suites
npm run build
BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium npm run test:view
BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium npm run test:browser
```

Sandbox has WebGL via swiftshader but the pinned Playwright wants a newer
Chromium than is installed — hence `BOOTH_TEST_CHROMIUM`.

## What no session can do

Load the live site, reach polyhaven.com, or judge a render by eye. Anything
resting on those goes to HANDOFF.md → Next, not into a guess.
