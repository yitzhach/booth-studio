# Booth Studio on the studio platform

Moved verbatim on 2026-10-21 (ROADMAP 1.1) from what was the Studio platform
section of HANDOFF.md. "Next" in it means `HANDOFF.md` → Next.

Booth Studio is an app on the studio platform (owner-approved 2026-10-05).
The platform — `studio-api`, its database, the SDK, and later the assistant —
lives in **`yitzhach/Art-Talk-Back`**: read its `docs/HANDOFF.md`, its
`docs/phase-5-booth.md` (this app's plan, gate and what still needs the
owner) and its decisions D-061…D-067 before changing anything here that
talks to it. The two repos stay separate (its D-042).

**What a signed-in artist gets.** Studio account (the avatar, or Export →
Keep your work) signs in with the studio's emailed code, on this origin.
Signed in, the open project is kept in the studio as a *placement* and
opens on any other signed-in device; its images go up as studio files.
"Import my existing projects" moves the project that was on the device
before signing in (nothing goes up until the artist asks). Signed out,
nothing of this runs.

**Where it lives.**

- `worker/index.js` `forwardToStudio`: `/v1/*` → the `API` service binding
  (same origin; the session cookie is first-party). No binding, or the
  platform down → 503 in the API's error shape.
- `src/studio-session.js`: the one thing main.js reads at start — whether
  this browser is signed in. Only a yes (or opening Studio account) loads
  `src/studio.js` and the SDK, a separate chunk.
- `src/placement.js` (pure, `tests/placement.test.js`): a project as a
  placement and back. `scene` is the schema-1 project with `assets` taken
  out; `images` is the manifest (asset id → studio file id, size, type,
  role). So a synced project *is* a project, and its backup is the backup
  it always was.
- `src/studio.js`: sign-in, the sync loop, `reconcile()` (the comment at the
  top of the file is the rule book: who wins when the project on screen
  and the studio's copy differ), image upload and download, the review card,
  an ended sign-in, the import, and the list of the studio's booths.
  Exposes `window.BoothStudio` (sync, status, pendingCount) for the
  two-device test and for debugging on a phone.
- `src/vendor/studio-sdk.js`: **generated** — Art-Talk-Back `pnpm --filter
  @studio/sdk bundle:esm --out <this file>`. Never edit it; CI in both repos
  fails when it is out of date.
- `src/scene-ops.js` (pure, `tests/scene-ops.test.js`): a booth changed by
  name — `describe`, `applyOps`, `build` and `OPS`, the op catalog with
  each op's JSON Schema. Booth ops (size, venue, furniture, walls, art) and
  show-floor ops (`start_floor`, `add_booths`, pieces, exhibitors, "my
  booth"; the floor's own frame is inches from the venue's back-left
  corner, booths named by number). **studio-api runs this file**: `npm run
  bundle:scene` builds it (and model.js, quickstart.js, arrange.js,
  placement.js under it) into `dist-scene/booth-scene.js`, which
  Art-Talk-Back vendors as `workers/studio-api/src/vendor/booth-scene.js`
  for `placement.edit`, `placement.build` and `describe_booth` (its D-070).
  So the studio assistant, or any agent, edits a booth with this app's own
  helpers and validator. Change an op, or anything those modules export
  that it uses, and the platform's copy must be rebuilt on the branch of
  the same name: CI in both repos compares the two byte for byte.
- `src/studio-assistant.js`: the assistant's chat panel (the Show
  Tracker's, as an ES module), mounted with the studio bridge. It asks
  `GET /assistant/status` (answered by `worker/index.js`
  `forwardToAssistant`) whether an assistant is connected, sends the booth
  on screen as the chat's `record`, shows confirm cards in the studio's own
  lines, and calls the bridge's `sync()` after Confirm and Undo so the
  change reaches the screen; a booth the assistant made gets "Open it".
  `/assistant/*` goes to the `ASSISTANT` service binding: only
  `env.staging` has `studio-assistant-staging`; production (top-level
  `services`) has `studio-assistant` since 2026-10-06.
  `tests/view-assistant.mjs` proves it with the studio and the assistant
  routed (no model runs).
- main.js touches it in three places only: `studioHost` + `loadStudio`
  (near the end of `boot`), `studioBridge?.saved()` after each save, and
  the `studio-account` action.

**Rules that bite.**

- **Keep the Worker name `booth-studio`.** The projects people saved are in
  IndexedDB on its origin; the import can only read them from here.
- **Schema 1 still rules the scene.** The studio stores the project as it is;
  a new project field needs nothing on the platform, but the platform caps a
  scene at 600,000 characters of JSON and 400 images (its D-062). A bigger
  project stays on the device and the footer says why.
- **One project open at a time, as ever.** The studio holds many; Studio
  account lists them and opens one in place of the current project (a
  backup downloads first if the current one isn't in the studio).
- **Two devices, one booth:** the whole scene is one field, so edits on two
  devices at once don't merge: the studio keeps its copy and the second
  device gets a card with "Use this device's" (its D-064).
- **The `name` column wins over the scene's name.** The app writes both
  together, but anything else on the platform (the studio assistant, the
  API) renames a booth by the column alone. `sceneFromRecord` puts the
  column's name into the scene before comparing or opening it, so that
  rename reaches the screen (until this was fixed, the next save sent the
  old name back over it). The size columns (`width`, `depth`, `height`) are
  still only read from the scene: a change to them alone is overwritten.
- **A booth deleted from the studio stays on the device and is never sent
  back.** The assistant or the API can delete a placement the app has open.
  `reconcile()` knows it was there (`applied` holds a version the studio
  gave), keeps the project, stops syncing it and the footer says "deleted
  from the studio · kept on this device". An Alternative (a new project id)
  goes up as a new booth. Any create the studio refuses (an id already used,
  e.g. a backup from another studio's booth) is remembered in
  `booth.studio.refused` and not resent until the project changes. Until
  this was fixed, the device re-created the booth, the studio refused the
  id, the SDK dropped it, and the two went round about three times a
  second for as long as the booth was open.
- **The scene code has one author: this app.** studio-api never edits a
  Booth Studio scene by itself; it runs `src/scene-ops.js` as built here.
  Keep those modules pure (no DOM, no storage): the bundle runs in a
  Worker. Every op result passes `validateProject`, so an edit made by the
  assistant opens here like one made by hand.
- **Merge order across the repos:** when this app needs a platform change,
  the platform merges and deploys first, because `main` here is production
  and talks to production `studio-api`. Each PR says its order.

**Testing.** `tests/two-devices.mjs` runs the built app behind its real Worker
and a real studio-api from an Art-Talk-Back checkout under `wrangler dev`,
two (and more) browser contexts as devices:

```sh
npm run build
STUDIO_PLATFORM=../Art-Talk-Back node tests/two-devices.mjs
BOOTH_COMPAT_DATE=2026-08-15 STUDIO_PLATFORM=... node tests/two-devices.mjs   # the platform's pinned date
E2E_LOG=/tmp/wr.log ...   # on a failure, the dev server's log (studio-api's errors) goes here
```

The checkout needs `pnpm install`. The test writes its own copy of
studio-api's dev config with a throwaway `SIGNING_KEY` (image links need
one) and wraps `worker/index.js` in a default-export-only entry, because
`wrangler dev` with several Workers rejects its exported constants as
entrypoints (the deployed Worker is unaffected).
