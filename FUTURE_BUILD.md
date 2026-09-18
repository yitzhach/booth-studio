# Future build — requested, deliberately not started

Ideas that have been asked for and are worth doing, but which are not the next
phase. Each entry says enough to be picked up cold. Nothing here is in
progress; if you start one, give it its own phase document first.

## Two ground-texture sets: presets and a user library

**Reported:** *"if I manually load a ground texture it overrides the other
presets — if you select grass, it won't switch."*

That is today's behaviour and it is intentional: `booth.groundAsset`, an
uploaded photograph, outranks `booth.ground`, the preset kind, and the Layout
panel says so while it is happening. It is still the wrong model. An upload and
a preset are two different things competing for one slot, so choosing a preset
appears to do nothing, and the only way back is Remove ground texture.

**The shape to build instead — two sets, not one slot:**

- **Preset grounds** — the six shipped PBR kinds (`studio`, `grass`, `concrete`,
  `asphalt`, `carpet`, `wood`). They live in `public/assets` and are what
  `src/surfaces.js` already loads.
- **Uploaded grounds** — the user's own photographs, each a named entry in a
  library, not a single anonymous override.

Both appear in **one picker as two labelled groups** (an `<optgroup>` each is
enough). Selecting any entry from either group switches the floor, because they
are then the same kind of choice. There is no override and nothing to remove
before a preset will work again; removing an upload deletes that library entry
and falls back to the last preset.

**Storage.** Today an upload is one asset on `booth.groundAsset`. A library is a
list, and a list of photographs is the kind of thing that outgrows local
storage — so it belongs in the user's Cloudflare-backed library once that
exists, alongside artwork originals. Until then it can live locally in the same
place artwork assets do.

**The schema-1 constraint applies.** Keep `booth.groundAsset` readable: an old
backup that carries one must open and keep showing that floor. The migration is
to read it as the first entry of the new list, never to drop it. Widening
`booth.ground` from an enum of kinds to also accept an upload id (`upload:<id>`)
is the widened-enum move `WALLS_PHASE.md` uses for `a.wall`, and is the reason
this is a phase rather than an afternoon.

**Do not start this without reading** the "Diagnosing the texture isn't
showing" section of `HANDOFF.md`. The upload-outranks-preset behaviour is one
of the two known causes of every "the ground selector is broken" report, and
this change removes it — which also means the diagnosis notes will need
rewriting when it lands.
