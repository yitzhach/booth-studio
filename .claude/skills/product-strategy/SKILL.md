---
name: product-strategy
description: Use when asked what would make Booth Studio worth paying for, what to build next, who the competitors are, how to price it, or at each ROADMAP.md phase gate. Measures where the app stands, researches competitors with labelled sources, maps each buyer's workflow, ranks work by evidence, and updates ROADMAP.md in place with the owner's decisions.
---

# Product strategy

The mission: make Booth Studio software that show organizers, galleries and
museums, display companies and working artists pay for and keep using —
because it finishes their jobs, not because it has more tools. `ROADMAP.md` is
the strategy; this skill keeps it true. It never starts a second plan.

## When to use it

- The owner asks what next, what would make it sell, who else does this, or
  what it should cost.
- A ROADMAP.md gate passes or fails.
- About once a month while a phase runs, to refresh the market table.

Not for every pull request: that is the build loop (docs/WORKFLOW.md).

## Steps

1. **Where it stands, in numbers from the repository, not memory.** Test counts
   (`npm test`, the view suites), first-load size (`npm run build`), what
   shipped since the last refresh (`git log`), what the owner has and hasn't
   seen (HANDOFF.md → Next), and what is live (`node tools/verify-deploy.mjs
   --check-only`).
2. **Competitors.** Search, then open the vendor's own pricing and feature
   pages. Label every fact **opened** (page read, with the date) or **search
   only** (a result snippet; the page could not be opened). This sandbox's
   network policy blocks some vendor sites; name them. A price from a snippet
   is never quoted to a customer. Update ROADMAP.md → The market: the table,
   its date, its sources.
3. **Buyers and their jobs.** For each buyer in ROADMAP.md → Positioning
   (organizer, artist, institution, partner): the job from what sets it off to
   done, step by step; where time or money is lost today; which steps Booth
   Studio already covers. A feature earns its place by finishing a job someone
   pays to have finished.
4. **Rank by evidence.** For each candidate: the buyer, the step of the job,
   the evidence (an owner's answer, a watched session, a customer
   conversation, a number, a competitor's gap from a page you opened), the cost
   in pull requests, what it needs from the owner, and the risk. No evidence
   means an experiment (a watched session, a mock-up, a conversation), not a
   feature.
5. **Premium and business checks**, for anything sold to a business:
   - *Premium UX:* a good first result in under five minutes; every empty,
     loading and error state written; undo everywhere; works offline; works
     on a phone and from the keyboard; nothing lost on a reload.
   - *Business readiness:* single sign-on, roles, audit log, export and
     deletion of a customer's data, uptime and a status page, an
     accessibility conformance report (WCAG 2.1 AA), a data-processing
     agreement, support with a stated reply time, invoices.
6. **Write it down in place.** Edit ROADMAP.md: reorder within a phase, add or
   drop items, refresh the market table, sharpen the gates. A decision that is
   the owner's goes in the phase as **Owner:** with a default. Add a dated line
   to HANDOFF.md → Now saying what changed in the roadmap and why.

## Rules that do not move

Local-first: signed out, everything works with no network, free. Schema 1 only
gains optional fields. A rendering is labelled as a rendering. Nothing leaves
the device or moves money without a confirm. Extend the app; don't rebuild it.
Payments and more server-side work are the owner's call (CLAUDE.md).

## Report

In chat, per CLAUDE.md: the three to five changes to the plan and the
decisions needed, in a few lines. The reasoning lives in ROADMAP.md.
