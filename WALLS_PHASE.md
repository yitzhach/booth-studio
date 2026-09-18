# Free-standing walls — built

Requested: *"add another wall or two if needed and be able to place them in the
booth, and then hang art on that section."*

**Done.** Layout → Free-standing walls. Add one, type its width, height,
position and rotation in inches, and hang art on either face through the usual
Location dropdown. This file is now the record of what was decided and why,
not a plan.

## The constraint that shaped it

The three walls were never a list. They are a fixed record — `booth.walls.back`,
`.left`, `.right` — and artwork names its wall by that key. Widening that record
would have changed the meaning of every saved project, and schema-1 backup
compatibility is one of the rules that must not break: a backup written
yesterday has to open unchanged today.

So `booth.walls` was left exactly as it is, and a separate optional list was
added beside it:

```js
booth.panels = [{ id, name, width, height, x, z, rotation }]
```

- Absent in every older backup, so those load untouched. `validateProject`
  treats `undefined` as "none", the same treatment `groundAsset` gets.
- `a.wall` **widened** from `"back"|"left"|"right"` to also accept
  `"panel:<id>"`. Old values keep their meaning exactly; a key naming a panel
  that is not in `booth.panels` is rejected, so a backup cannot describe art
  hanging on nothing.
- A panel id may not contain a colon, or `"panel:<id>"` would be ambiguous.

`tests/e2e.mjs` round-trips a project with a panel through a downloaded backup,
and then opens a backup with the `panels` key stripped — the two halves of the
compatibility promise, checked in a real browser.

## `wallSpec()` is the whole generalisation

Six places assumed three fixed walls. Rather than teach each of them about
panels, one function in `model.js` answers "what am I measuring against":

```js
wallSpec(p, key) -> { enabled, width, height, panel? } | null
```

`constrain`, `boundWarning`, `scalePanel`, the scene build, the drag handler
and the hanging guide all go through it, and `wallKeys(p)` is the list they
iterate. A key whose panel has been deleted returns `null`, and every caller
treats that the way it already treated a hidden wall — nothing throws.

## Decisions worth keeping

- **A panel's X/Z is the centre of its slab, not its face.** A perimeter wall's
  frame plane sits on the footprint line, so its slab hangs just outside it.
  A free-standing wall has no line to sit on and is used from both sides, so
  the frame is pushed forward by `WALL_SLAB_OFFSET` and the typed position is
  where the wall actually is. `tests/view-panels.mjs` reads the mesh's world
  matrix back and pins this.
- **Deleting a panel moves its art to the back wall** and says so in a toast.
  Silently deleting someone's placement is the kind of thing that loses trust,
  and the alternative — refusing to delete a panel with art on it — makes the
  user do the moving by hand for no gain.
- **A panel is a wall, so everything else came along free.** Same mesh, same
  `userData.wall`, same `frames[key]` and `frames[key + "-outside"]`. The
  fabric finish, drag-to-place, drop-from-library, the 4096 export and the
  hanging guide all work on panels without knowing they exist. Each panel is
  its own surfaces consumer, `wall:panel:<id>`, because it is a different width
  from the perimeter walls and so needs its own texture repeat.
- **`surfaces.releaseMatching()` exists because a deleted panel is a leak.**
  The per-consumer cache is claimed by key; a panel that goes away without
  releasing would hold its texture set alive for the rest of the session. The
  build loop now releases every `wall:` consumer that is not in the current
  wall list.
- **`focusWall` frames a panel from its own face.** There is no fixed elevation
  to switch to — a panel stands anywhere at any angle — so "View wall face"
  keeps the perspective camera and aims it down the panel's normal, the way an
  exterior face was already framed.
- **A panel keeps its own height.** Changing the booth's Wall height sets all
  three perimeter walls; a free-standing wall is a separate piece of kit and is
  not swept along with them.
- **Position is typed, not dragged.** This is a measured tool and a typed inch
  is the thing being measured. Dragging a panel around the floor is a
  reasonable later refinement; it is not what was asked for.
- **The hanging guide names where a panel stands.** A builder can read a
  perimeter wall's position off the footprint; a free-standing wall's position
  is part of the measurement, so its section carries the X, Z and rotation, and
  its two faces are called front and back rather than inside and outside.
- **Eight panels is the limit**, and a panel does not affect `booth.width` or
  `booth.depth`, so the neighbouring-booths layout is untouched.

## What is not covered

Nobody has looked at a booth with free-standing walls in it on real hardware.
The geometry is pinned by a test that reads the world matrix back, so *where*
a panel stands is not a guess — but whether a 72″ divider at the centre of a
10 × 10 booth reads as useful, and whether the fabric weave at a panel's width
looks right, are judgements that need eyes.
