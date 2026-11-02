# The typing pass (ROADMAP 1.4, second half)

**Goal:** `npm run typecheck` checks every module in `src/` but the vendored
files, with the JSDoc as the types, and the bugs older than the two splits
that their reviews found are fixed, each behind a test. It delivers ROADMAP
1.4's "Left: those three" (`main.js`, `scene.js`, `studio.js`) and the
modules the splits made out of them (`src/ui/`, `src/panels/`,
`src/actions/`, `src/scene/`).

**Gate:** `tsconfig.app.json` excludes only `src/vendor/**`, and
`npm run typecheck` exits 0 in CI. `tests/typecheck-scope.test.js` holds the
exclude list at what is left, so it can only shrink. Every suite green on
every pull request.

## Constraints

- Schema 1 only gains optional fields. Nothing here touches the schema.
- Local-first: signed out, the app works with no network, as it always has.
- The app runs with `public/assets` empty.
- `npm run bundle:scene` is untouched: what it ships (`scene-ops.js` and
  its imports) is already checked by `tsconfig.json`, and a change there
  would need the Art-Talk-Back copy updated.
- **A typing pull request changes no behaviour.** It adds JSDoc, casts and
  declarations only. A finding whose fix would change what runs is a bug:
  it is recorded in Rulings and fixed in its own commit behind a failing
  test (tasks 7–9), never folded into a type fix.

## Measured (2026-11-02, `main` at 2b2fb17)

Everything in `src/` but `src/vendor/` against tsconfig.app.json's settings:
570 findings. By area: `src/ui/` 343 (`inputs.js` 188), `main.js` 108,
`src/vendor/studio-sdk.js` 48 (pulled in by `studio.js`), `src/actions/`
41, `src/scene/` 16, `studio.js` 9, `scene.js` 5, `src/panels/` 0. By
kind: 362 are DOM narrowing (`.value`, `.dataset`, `.closest` on an
`EventTarget` or `Element`), 57 spreads of an untyped array, 33
`dialog.close` on an `Element`; the rest are JSDoc that went stale (an
options object documented with half its keys), defaults that typed a
parameter too narrowly (`quality = 2` compared with `"auto"`), the build's
globals and `window` additions, and the scene's mixins, which the class
does not know about. None of the 570 was a bug; the three that looked like
one (`render-loop.js` comparing a number with a string, two callbacks
"called with an argument they take none of") are inferred defaults.

## Decisions (all the agent's; the owner has none to make here)

- **The scene's mixins are typed by declaration merging, not rewritten.**
  `src/scene/types.d.ts` declares `interface BoothScene extends …` with
  `typeof lightRig` and the other eight, in a `declare module "../scene.js"`
  block, and each mixin's object gets
  `/** @satisfies {ThisType<import("../scene.js").BoothScene>} */`. So
  `this.x` inside a mixin and `scene.x()` from `src/ui/` are both checked
  against the whole scene, and no moved line changes. Proven in a spike
  before planning: an unknown `this.nope()` and a wrong argument type are
  both reported. *My call.* Cost if wrong: a declaration file to delete.
- **A DOM target is cast once, where it is first named**
  (`const el = /** @type {HTMLInputElement} */ (ev.target);`), never at
  each use, and never through a typed `$` helper that would hide a wrong
  element kind. Where one handler serves several kinds of control, the
  cast is to the union it serves. *My call.*
- **`ctx` stays untyped** (`any`), as the factories receive it today.
  Typing it is a declaration of ~200 names that would restate `boot()`;
  each factory's own code is checked either way. *My call; cost if wrong:
  a wrong `ctx.` name is still caught by ESLint's no-undef only where
  destructured, and by the view suites.*
- **The build's globals and `window` additions** (`__APP_VERSION__`,
  `__COMMIT_SHA__`, `__BUILD_TIME__`, `window.BOOTH_BUILD`,
  `window.__booth`) are declared in `src/globals.d.ts`, beside
  `BOOTH_ASSETS`. `import.meta.env` comes from `vite/client`'s types in
  `tsconfig.app.json` only, so the Worker-side check stays free of it.
- **`studio.js` waits for the SDK's own declarations.** The vendored
  `src/vendor/studio-sdk.js` is compared byte for byte with Art-Talk-Back's
  build, so a hand-written `.d.ts` here would drift. Art-Talk-Back's
  `bundle:esm` writes `studio-sdk.d.ts` beside it from the SDK's own
  TypeScript, both repositories' CI compare it, and then `studio.js` leaves
  the exclude list. Platform first (its contract is new), app second, on
  branches of the same name. *My call.* (Reversed in task 6, for a
  hand-written declaration held to the module by a test: Rulings.)
- **Order: smallest and most separate first,** so the declarations each
  later area needs exist when it arrives: the scene, the actions, the
  panels, `src/ui/` but `inputs.js` and `studio-host.js`, `inputs.js`, and
  last `main.js` with `studio.js`; then the bugs. (`main.js` comes last
  because a checked module's imports are checked too, excluded or not, and
  `main.js` imports all of `src/ui/` and, through `studio-host.js`,
  `studio.js` and the SDK: Rulings, 2026-11-02, task 3.)

## Files

- `tsconfig.app.json` — each task removes its area from `exclude`; the
  header comment says what is left.
- `tests/typecheck-scope.test.js` (new) — the exclude list equals the
  `LEFT` it names; each task shrinks `LEFT` first (red), then its area
  type-checks (green).
- `src/scene/types.d.ts` (new) — `BoothScene` gains the mixins' methods.
- `src/globals.d.ts` — the build's globals and `window` additions.
- The area's own modules: JSDoc and casts only.

## Tasks

Each is one pull request. Each: `LEFT` shrinks in
`tests/typecheck-scope.test.js` and `node --test
tests/typecheck-scope.test.js` is red; the area leaves `exclude`;
`npm run typecheck` shows its findings; they are fixed;
`npm run typecheck`, `npm run lint`, `npm test` and `npm run build` exit 0;
the area's view suites run here one at a time (the whole chain in a
snapshot for 4–6); `git diff` adds only comments, casts and declarations.

1. **The scene** — `src/scene.js`, `src/scene/**`. `src/scene/types.d.ts`,
   the nine `@satisfies` lines, the stale option JSDoc of `recordVideo`,
   `previewMove`, `export` and the defaults' types. Suites: view-video,
   view-timeline, view-frame, view-lighting, view-measure, view-people.
2. **The actions** — `src/actions/**`. Mostly `dialog.close` on an
   `Element` and timeline keys the JSDoc misses. Suites: view-tier,
   view-batch, view-timeline, view-video, view-share.
3. **The panels** — `src/panels/**`: no findings, so it rides task 2's
   pull request.
4. **`src/ui/` but `inputs.js` and `studio-host.js`.** Exclude becomes
   those two by name. Suites: the whole chain.
5. **`src/ui/inputs.js`.** Suites: the whole chain.
6. **`studio.js`, `studio-host.js` and `main.js`.** Art-Talk-Back first:
   `bundle:esm` writes `studio-sdk.d.ts` and its `--check` compares it;
   then here, vendored beside the `.js`, CI's comparison step covers both
   files. `src/globals.d.ts` gains the build's globals and `window`
   additions, and tsconfig.app.json `vite/client`. Gate: `LEFT` is
   `src/vendor/**`. Suites: two-devices, view-share, the chain.
7. **Undo steps with nothing in them.** At the 200-placement limit,
   `duplicate-art` refuses inside `mutate()` and leaves an empty undo step;
   "Renumber these" with no booth among the pieces does the same and is
   offered anyway. Test first: a view-suite check that undo's depth is
   unchanged after each refusal, and that the button is hidden with no
   booth selected.
8. **The Box tool and the frame guide.** The Box tool stays armed after it
   refuses (Lite, or the piece limit), so every later drag repeats the
   refusal; a click or a drag under 1″ saves a box of no width, because
   only the limit's maximum is applied; a frame-guide corner dragged within
   40 px of the viewport's edge lets the 40 px minimum push the frame past
   it. Tests first in view-box and view-frame.
9. **The rest.** The Video tab's "Export PNG · 4096 px" exports at Export's
   remembered size, not 4096 px, as its comment says; a saved view's
   "Update" toasts "View replaced" with no scene to take a pose from;
   Delete and Backspace cancel the key's default with nothing selected; a
   studio version opened resets the selected work and lights but not the
   selected wall, pedestal or figure, the multiple selection or the row's
   booth; the document's `dragstart` calls `ev.target.closest` on a Text
   node and throws; `editor-cancel` clears `scheduleEditedPreview.timer`,
   which nothing sets (the pending frame is `.frame`); the icon table
   registers `Grid2X2` twice. A test first for each that a person could
   meet (all but the last two).

## Review focus

- **A cast that lies.** `/** @type {HTMLInputElement} */` on a target that
  can be a `<select>` or a `<button>` compiles and hides a wrong `.checked`.
  The cast names every kind the handler serves; the review reads each
  against the selector or the listener it guards.
- **A type fix that changes behaviour.** A `?.` added, a `String()` around
  a value, a default changed to satisfy a type: each changes what runs.
  None is allowed in tasks 1–6; `git diff` of a typing PR is read for any
  line that is not a comment, a cast or a declaration.
- **The Worker-side check.** `tsconfig.json` keeps `"types": []` and a
  worker's globals; nothing added for the page reaches it.

## For the owner

Tasks 1–6: nothing to check, nothing changes. Tasks 7–9 change what a
person meets, each as the control already says it should: HANDOFF.md →
Next gets the list when they land.

## Rulings

(Each judgement call made on the way: what was decided, why, and its cost if
wrong.)

- **2026-11-02, the plan: no questions for the owner.** Every decision
  above is the agent's: the typing changes nothing a person sees, and each
  bug fix makes a control do what its own label or comment already says.
- **2026-11-02, task 1: the scene's own state is declared beside its
  methods.** With `this` typed as the scene, 319 findings were the 52
  fields an area assigns first inside a method (`this.p`, `this.drag`,
  `this.revision`, …), which the class alone does not declare.
  `src/scene/types.d.ts` declares them in the same interface as the
  mixins, each with the type its assignments give it, loose (`any`) only
  where the value is a project's own shape, which `validateProject` checks
  at run time. The constructor's callbacks and `quality` get JSDoc in
  `scene.js` (a callback defaulting to `() => {}` otherwise types as taking
  no argument, and `quality = 2` as never `"auto"`), as do the options of
  `previewMove`, `recordVideo`, `export` and `autoPan`. One cast, in the
  annotation layer's loop. Everything else in the diff is comments and
  declarations. `scene.js` grew 15 lines of JSDoc, so its size ratchet
  (`tests/scene-size.test.js`) goes from 183 to 198, noted there; the
  split's gate is 1,000. The scene had 21 findings before `this` was
  typed and 0 after; none was a bug.
- **2026-11-02, task 2: the actions, by cast alone.** 41 findings, all but
  one a `querySelector` read as an `Element` where the code calls a
  dialog's `close`/`showModal`, an input's `click`/`value`, or an
  element's `dataset`/`style`/`hidden`. Each is cast once, to the kind the
  markup has (`#export-size` is a `<select>`, `.report-text` a
  `<textarea>`, `#underlay-real` an `<input>`), and `<studio-assistant>`,
  a custom element with no declaration, to `any`. The one other: a
  timeline key added in the dialog may carry `place`, which `keyFrom`'s
  return type does not name, so `added` is typed with it. No bug.
- **2026-11-02, task 3: `main.js` goes last, and the panels ride task 2.**
  Taking `main.js` out of the exclude list brought 508 findings, not its
  108: a module the check reads has its imports read too, excluded or
  not, and `main.js` imports all of `src/ui/` and, through
  `studio-host.js`'s `import("../studio.js")`, the vendored SDK (48 of
  them). So `main.js` moves to the last typing task, with `studio.js`, and
  `studio-host.js` waits with it; nothing else in `src/` imports either
  (checked). `src/panels/` alone has no findings, so it left the exclude
  list in task 2's pull request rather than one of its own. *Cost if
  wrong:* none; the order only decides which pull request carries which
  casts.
- **2026-11-02, task 4: `src/ui/` by cast, and the globals come early.**
  154 findings in 18 modules, all DOM narrowing but five inference
  artifacts: a `let` assigned only inside `mutate`'s callback types as
  `never` (`polish-panel.js`, `library.js`; typed with the function's
  `ReturnType`), an array of `[name, list]` pairs inferred as one array of
  either (`show-floor-panel.js`; typed as pairs), and two flags kept as
  properties of a function (`render.resizing`,
  `scheduleEditedPreview.frame`), which a checker does not follow on a
  nested function declaration (cast to `any` where read). No bug. Two
  ways of casting, both changing nothing that runs: a cast around the
  expression, or, for an `Element` method's result (`closest`,
  `querySelector`), a JSDoc type on the `const` it is assigned to, from
  which TypeScript infers the method's type argument. `sync-inputs.js`
  writes numbers to `.value`, which the browser turns into the string
  `.value` holds; that stays, with the number cast to `any`, because
  `String()` or `valueAsNumber` would change what runs. `test-hooks.js`
  reads `import.meta.env` and sets `window.__booth`, so `src/globals.d.ts`
  gains the `window` additions and the build's three globals now rather
  than in task 6, and tsconfig.app.json reads `vite/client`'s types (the
  Worker-side tsconfig.json still reads none). A diff check: with every
  JSDoc comment and parenthesis removed, each changed line in `src/` is
  the line it replaced, but the declarations in `globals.d.ts`.
- **2026-11-02, task 5: `inputs.js`'s two handlers read their target as an
  input.** 188 findings, all but three in the document's `change` and
  `input` listeners, which serve every form control in the panels. The
  target is read as an `HTMLInputElement` (a cast on `change`'s `el`, and
  a JSDoc type on `input`'s `ev` parameter, which types its 51 reads of
  `ev.target` at once) rather than the union of input, select and
  textarea: every property they read is one an input has, and `checked`
  and `files` are read only once `type` or a data attribute has said
  which control it is. A comment above each says so. The setting's
  `value` is a checkbox's boolean, a number's number or a text's string,
  so it is typed `any`, with a comment. Two more numbers written to
  `.value` are cast as in task 4. No bug; with JSDoc and parentheses
  removed, no changed line differs from the one it replaced.
- **2026-11-02, task 6: the SDK's types are written here, and a test holds
  them to the module.** The plan had Art-Talk-Back's `bundle:esm` write
  the declaration. Looked at, that is a declaration bundler added to the
  platform as a dependency (the SDK's types name `@studio/core`'s zod
  schemas, which a `.d.ts` here could not resolve), a paired pull request
  on both repositories, and the platform's default branch, which is not
  `main` (`claude/next-steps-y4vrwv`). Instead `src/vendor/studio-sdk.d.ts`
  is written by hand from the SDK's source (`client.ts`, `store.ts`,
  `studio.ts`), the platform's own shapes loose, and
  `tests/studio-sdk-types.test.js` imports the vendored module and fails
  if an export or a class member the declaration names is missing, or the
  module exports one it leaves out (checked against a mutant: a declared
  `nope()` fails it). A changed argument or answer is not seen by the type
  check; `tests/two-devices.mjs` runs the real SDK against studio-api and
  is what catches that. *Cost if wrong:* an SDK update that changes a
  signature but no name passes the type check until someone updates the
  declaration. With it, the vendored module's own 48 findings leave the
  check, since its import now resolves to the declaration. `main.js`'s 102
  findings: 57 `ctx` wrappers spreading `...args` into functions with
  fixed parameters, which only a cast of the function called silences (a
  type on `ctx`, or on the rest parameter, does not: tried); the rest DOM
  narrowing, and `toast.timer`, a property on a function, as in task 4.
  `main.js` stays at 1,438 lines, its size ratchet's number, because the
  casts that would have taken a line of their own are inline. The gate is
  met: `tsconfig.app.json` excludes `src/vendor/**` alone. With JSDoc and
  parentheses removed, no changed line differs from the one it replaced.
