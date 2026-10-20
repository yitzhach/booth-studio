# How work is done here

Set up 2026-10-20 at the owner's request: a permanent way of working for
Claude Code cloud sessions on this repository — product assessment,
competitive research, a commercial roadmap, phased building, review in rounds,
tests, a checked deploy, and an updated HANDOFF.md. Two loops carry it, six
project skills hold the method, a session-start hook makes the tests runnable,
and one script checks a deploy. Nothing here changes the app.

## In a new cloud session

- **The skills load with the repository.** `.claude/skills/` is read from the
  branch the session checks out, and a new session checks out `main`, so they
  are in every session once merged. Call one by typing `/<name>`, or just ask
  in words: each skill's description says when it applies, and the session
  picks it up from that.
- **The session-start hook** (`.claude/hooks/session-start.sh`, registered in
  `.claude/settings.json`) runs `npm ci` when `node_modules` is missing or
  older than the lockfile, and sets `BOOTH_TEST_CHROMIUM` for the browser
  suites. It runs in cloud sessions only, and the session starts whatever
  happens: it reports in one line, "booth-studio session start: …", which
  arrives in the session's context. A session started above several
  repositories may not run this repository's hook; when that line is missing,
  run `CLAUDE_CODE_REMOTE=true booth-studio/.claude/hooks/session-start.sh`
  and prefix browser suites with `BOOTH_TEST_CHROMIUM=/opt/pw-browsers/chromium`.

| Skill | Use it when | Say, for example |
| --- | --- | --- |
| `/plan-phase` | before a ROADMAP.md item, or anything bigger than a small fix | "plan ROADMAP 1.2" |
| `/verify-change` | before saying something works; before a commit, push or pull request | "verify this" |
| `/root-cause` | a bug report, a red test, a red CI run | "why does the hero set fail on a phone?" |
| `/review-loop` | a change is ready for review, or before merging | "review this until it's clean" |
| `/steward` | opening, driving or merging a pull request; the harness also reads it on PR events | "ship it" |
| `/product-strategy` | what to build next, who competes, what to charge, at every phase gate | "what should we build next?" |

## The strategy loop — at each phase gate, or about monthly

Assess where the app stands in numbers → research competitors with labelled
sources → map each buyer's job → rank work by evidence → edit ROADMAP.md in
place → put the owner's decisions to the owner with defaults. The
`product-strategy` skill carries it. It is not run for every pull request:
market research per change would cost much and change little.

## The build loop — every pull request

1. **Plan** (`plan-phase`): the owner's few decisions in one batch, then a
   `<NAME>_PHASE.md` for anything larger than a small change.
2. **Build**, with the failing test first wherever a test can show it.
3. **Review** (`review-loop`): rounds over the diff until one finds nothing
   new, three at most.
4. **Verify** (`verify-change`): the suites the change needs, each run
   directly, reported in numbers.
5. **Ship** (`steward`): pull request, CI and the Cloudflare preview green,
   merge (merging is deploying).
6. **Check the deploy**: `node tools/verify-deploy.mjs` waits until the live
   site serves the merge commit, then opens it in Chromium and checks that the
   app starts.
7. **Hand off**: HANDOFF.md → Now (what shipped) and Next (what the owner must
   see in person).

Whenever something fails along the way: `root-cause` before any fix.

## Installed, adapted, written

| What | Status |
| --- | --- |
| The six skills in `.claude/skills/` | Written for this repository. Four adapt ideas and wording from obra/superpowers and jingzhao-l/iterate-skill, pinned to commits, MIT — `.claude/skills/THIRD_PARTY.md` says which skill took what. |
| `.claude/hooks/session-start.sh`, `.claude/settings.json` | Written here. |
| `tools/verify-deploy.mjs` | Written here. Proven 2026-10-20 against production (`fe7305d`: live, and the page starts) and, read-only, a branch preview. |
| `tests/claude-workflow.test.js` | Written here. Fails if a skill's front matter would stop it loading, or if a skill takes a name Claude Code already uses (`claude plugin validate` checks neither). |
| The superpowers plugin | **Not installed.** Its session-start hook makes every session invoke a skill before any reply, and its subagent-per-task method doesn't fit a sandbox that runs one browser suite at a time. Its best skills are adapted instead. |
| iterate-skill | **Not installed.** Its installer puts a Python tool on the machine (lost with each new container), runs nine whole-repository reviewers per round on its own branches, and writes config files into the root. Its method lives in `review-loop`. |
| Built-in skills relied on | Claude Code's `/code-review`, `/simplify` and `/security-review`; site-qa (yitzhach/site-qa) once ROADMAP.md 1.10 brings it here. |

## Limits

- Skills on a feature branch are not in new sessions until the branch merges.
- No session can judge a render by eye or reach polyhaven.com. Since
  2026-10-20 a session can load the live site and branch previews over HTTP
  and in Chromium; if a session finds `*.workers.dev` blocked, the
  environment's network policy has changed — say so rather than guess.
- Several competitors' sites are blocked in this sandbox, so some market
  facts are search results only, and are labelled that way.
