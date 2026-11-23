# Continue Booth Studio — starting a new chat

Rewritten 2026-11-23. Until then this file held the very first session's
notes (September 2026), long out of date; they are in git history, and
`docs/ORIGINAL-HANDOFF.md` keeps the original requirements. `HANDOFF.md` is
what is true now. This file is only how to start the next chat.

## Where it stands (2026-11-23)

- **Live and quiet.** Production serves `a0062ac` (booth-studio#83, merged
  2026-11-13): the app unchanged since 2026-11-02, plus the plan below.
  No session has worked on this repository since.
- **The engine is built and tested**: measured booths (canopy tents and
  pro-panel booths), artwork hung to the inch, lighting, stills, film,
  hanging guides and the show pack; a show floor of up to 1,200 booths
  walked in 3D; share links; studio sign-in, sync and the assistant;
  offline and installable. 535 Node tests and 45 view suites, all green.
- **Nobody but the owner has used it** (B-101). That is the largest risk,
  and the plan below exists to retire it.
- **What is next: `DEMO_PHASE.md`**, a product the owner can demonstrate to
  an artist in five minutes and to a show director in ten. Stage A, the
  artist's guided booth (tasks A1–A8); stage B, the director's job on the
  device — the accepted list in, everyone placed by rule, a packet each, a
  visitor map (B1–B10); stage C, a front page (C1–C4). Not one task is
  started. Begin at A1.
- **How it is built** (B-102): hands-off. Sessions decide, open, review,
  merge and verify their own pull requests; the owner is asked only at the
  plan's three checkpoints, or first for money, secrets, payments, new
  server-side work, deleting anything, or the name and domain.
- **The owner's own half** runs beside it: five show directors to talk to
  (the questions are in `DEMO_PHASE.md`, "The owner's half").

## The repositories

- `yitzhach/booth-studio` — this app. Work here, on the branch the session
  is given; `main` is production (merging is deploying).
- `yitzhach/Art-Talk-Back` — the studio platform (`studio-api`, the
  assistant, the SDK). Needed from task B1 on: `src/hall.js` is bundled
  into the platform by `npm run bundle:scene`, so B1 is a paired change on
  an Art-Talk-Back branch of the same name. Its default branch is
  `claude/next-steps-y4vrwv`; it has no `main`. Booth-studio's CI checks out
  the platform branch whose name matches the pull request's, else that
  default.
- Not to be touched: `yitzhach/commission`.

## How to start

A new Claude Code chat on the web or the phone, with **both repositories
attached** (booth-studio and Art-Talk-Back). Model: Opus, effort high.
Paste this:

```text
Continue Booth Studio. Repositories: yitzhach/booth-studio (the app — work
here) and yitzhach/Art-Talk-Back (the studio platform; needed from task B1,
which is a paired change there). Don't touch yitzhach/commission.

Where it stands: production serves a0062ac (booth-studio#83, 2026-11-13).
The engine is built and green (535 Node tests, 45 view suites). Nobody but
me has used it. DEMO_PHASE.md is the plan — a product I can demo to an
artist in five minutes and to a show director in ten — and no task in it is
started. docs/CONTINUE.md says more.

CLAUDE.md and HANDOFF.md are loaded or first to read; DEMO_PHASE.md is the
plan. Start at its first unticked task (A1) and work down the list in
order, one pull request per task.

This is a hands-off build (decision B-102). You make the product and
engineering decisions; record each judgement call in DEMO_PHASE.md →
Rulings. For every task: write the failing test first, make the change, run
the suites the verify-change skill names (each directly, never through a
pipe), run review-loop, open the pull request, merge it yourself when CI is
green, then run node tools/verify-deploy.mjs and tick the task's box.
Follow the steward skill for shipping. Do not ask me to review pull
requests or choose between options you can weigh yourself.

Ask me first, in one batch, only for: spending money, secrets, payments,
new server-side work, deleting data or Workers, or the product's name and
domain.

When a stage is finished, write its checkpoint into HANDOFF.md → Next as a
short list for me to try on the live site, update docs/HISTORY.md, and
carry on with the next stage without waiting for me. Keep going across
tasks until you are blocked or the stage is done.

Before you stop for any reason, update HANDOFF.md, DEMO_PHASE.md and this
file's "Where it stands" so the next chat can pick up cold, and give me the
prompt for it.

Report in chat the way CLAUDE.md says: a few lines, bad news first, numbers.
```

## When a chat ends

Update "Where it stands" above, and the prompt if the next step changed,
in the same pull request as the chat's last work. `HANDOFF.md` → Now and
Next, `docs/HISTORY.md` and the plan's boxes are updated as always.
