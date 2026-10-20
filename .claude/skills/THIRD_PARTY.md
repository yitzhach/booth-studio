# Where these skills come from

Six skills live here. All six were written for this repository; four carry
ideas and some wording adapted from two MIT-licensed projects, read at the
commits below. **Nothing from either project is installed, and none of their
code or scripts was run** — not a plugin, not a hook, not an installer, not a
command-line tool. Only the text was read, and only what fits this repository
was rewritten into it.

| Skill | Written here from | Adapted from |
| --- | --- | --- |
| `steward` | CLAUDE.md → Shipping, HANDOFF.md → Deployment, Art-Talk-Back `docs/SHIPPING.md` | — |
| `verify-change` | CLAUDE.md, HANDOFF.md → Testing | superpowers `skills/verification-before-completion` |
| `root-cause` | HANDOFF.md → the two Diagnosing sections, Rules, Things learned | superpowers `skills/systematic-debugging` |
| `review-loop` | HANDOFF.md → Rules that are easy to break; the built-in `/code-review`, `/simplify`, `/security-review` | iterate-skill `SKILL.md` and `config/dimensions/*.yaml`; superpowers `skills/receiving-code-review` |
| `plan-phase` | the repo's `*_PHASE.md` habit, ROADMAP.md | superpowers `skills/brainstorming`, `skills/writing-plans`, `skills/executing-plans` |
| `product-strategy` | ROADMAP.md and its method | — |

## The sources

- **obra/superpowers** — https://github.com/obra/superpowers at
  `bb92a77741419a4ab5f06e711a283343f1ada0c3` (2026-10-09, version 7.0.0).
  MIT licence, Copyright (c) 2025 Jesse Vincent.
  Left out on purpose: the `using-superpowers` session-start hook (it tells
  every session that a skill with a 1% chance of applying *must* be invoked
  before any reply, which works against CLAUDE.md's short replies and costs
  context in every session); subagent-driven development and parallel agents
  (this sandbox runs one browser suite at a time, and a subagent per task
  multiplies the cost); git worktrees and finishing-a-development-branch (this
  repo's branch and merge rules come from the harness and `steward`); the
  brainstorming visual companion (a local web server the owner cannot open
  from a phone, whose logo is fetched from the author's site as a usage
  count); test-driven-development as a separate skill (its red-then-green rule
  lives in `verify-change` and `root-cause`); diagnosing-superpowers and
  writing-skills.
- **jingzhao-l/iterate-skill** — https://github.com/jingzhao-l/iterate-skill at
  `d8c62bae11093cb39d77b5b89a536c6983995cf2` (2026-10-20, version 3.6.0).
  MIT licence, Copyright (c) 2026 iterate-skill contributors.
  Its method is kept (dimensions, rounds until nothing new, small fixes direct
  and large ones approved, no finding on unread code). Its installation is
  not: `npx iterate-skill-installer` puts a Python command-line tool on the
  machine, which a cloud container would lose at every new session; each
  round starts nine reviewers that read the whole repository, for up to seven
  rounds; it works on its own `iterate/*` branches, which the harness's branch
  rules don't allow; it writes `ITERATE.md`, `iterate.config.yaml` and
  `.iterate_decisions.md` into the repository root next to CLAUDE.md and
  HANDOFF.md; and its companion harness sends code through a third-party model
  gateway.

## Updating

To take in a newer version: read the source skill at the new commit, compare it
with the one at the commit above, carry over what still fits this repository,
and change the commit here. Never copy a skill whole without reading it, and
never run a script from either project without reviewing it first.

## The licence

Both projects use the MIT licence, with the copyright lines given above:

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.
