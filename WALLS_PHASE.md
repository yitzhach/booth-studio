# Free-standing walls — plan

Requested: *"add another wall or two if needed and be able to place them in the
booth, and then hang art on that section."*

Not built. This file is the plan, written so a fresh chat can execute it
without rediscovering the constraints. Everything else from that round shipped.

## Why it was held back

The three walls are not a list. They are a fixed record, `booth.walls.back`,
`.left` and `.right`, and that shape is load-bearing in six places:

| Place | What assumes three fixed walls |
| - | - |
| `model.js` defaults | `walls: {back, left, right}` |
| `model.js` `validate()` | `for (const wall of ["back","left","right"])` |
| `model.js` `constrain()` | clamps art to `walls[a.wall]` bounds |
| `scene.js` `wallFrame()` | hardcodes each wall's position and rotation |
| `scene.js` `update()` | `for (const wall of ["back","left","right"])` |
| `main.js` inspector | wall rows, and the artwork Location dropdown |

Artwork references its wall by that key (`a.wall`, plus `a.face` for
inside/outside). So this is a change to the project schema that every saved
project and every downloaded backup passes through.

**The hard constraint, from the rules that are easy to break:** schema-1 backup
compatibility must be preserved. Adding optional fields and widening enums is
fine; changing meaning is not. A user's backup from today must open unchanged
after this lands. That is what makes it a phase rather than an afternoon, and
why it was not rushed alongside five rendering fixes.

## The shape that keeps compatibility

Keep `booth.walls` exactly as it is — three fixed perimeter walls, same keys,
same meaning. Add a **separate** optional list beside it:

```js
booth.panels = [
  { id, width, height, x, z, rotation }   // metres from booth centre, degrees
]
```

- Absent in every existing backup, so old files load untouched.
- `a.wall` widens from `"back"|"left"|"right"` to also accept `"panel:<id>"`.
  A widened enum, not a changed one: old values keep their meaning.
- `validate()` gains a `panels` branch and an `a.wall` check that a referenced
  panel exists — the same treatment `groundAsset` already gets.
- Deleting a panel must decide what happens to art on it. Proposal: move that
  art to the back wall rather than dropping it, and say so in a toast. Silently
  deleting someone's placement is the kind of thing that loses trust.

## Order of work

1. **Schema + validation + a backup round-trip test first.** `tests/e2e.mjs`
   already covers a portable backup round-trip; extend it with a panel before
   touching the renderer. Also load a schema-1 backup with no `panels` key and
   assert it still opens.
2. **`wallFrame()` generalised** to take a position and rotation instead of a
   hardcoded side. The three perimeter walls then become three callers of it
   with their current values, unchanged.
3. **Scene build**: panels are walls with their own frame, same mesh, same
   `userData.wall`, so the fabric finish and art placement come along free.
   Each panel is its own surfaces consumer, keyed `wall:panel:<id>` — the
   per-consumer cache already supports this, and a panel is a different width
   from the perimeter walls so it needs its own repeat.
4. **Art placement**: the Location dropdown lists panels; `constrain()` clamps
   to the panel's own width and height.
5. **Placement UI**: X and Z in inches from booth centre, plus rotation. Reuse
   the existing numeric `field()` rather than inventing a drag interaction —
   this is a measured tool, and a typed inch is the thing being measured.
   Dragging a panel in the viewport is a later refinement, not the first cut.
6. **The hanging guide** (`Export → Download hanging guide`) must gain the new
   panels, or the booth on screen and the booth being built diverge.

## Watch out for

- `disposeGroup()` frees materials by walking the group. Panels are in the same
  group, so nothing special is needed — but a panel removed while art is
  selected must not leave `selected` pointing at a dead object.
- The neighbouring-booths layout reads `booth.width`/`depth`. Panels are
  interior and must not affect it.
- 2048/4096 export walks the same scene, so panels come along for free. Worth
  asserting once rather than assuming.
