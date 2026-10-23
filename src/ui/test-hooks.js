// `window.__booth`, the development-only inspection hook the view suites
// read; Vite drops it from a production build. Called once for its effect.
// Moved out of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam
// 18): `ctx` is boot's state, read through it, and the helpers these call.
import { lightBarFixtures } from "../lightbar.js";
import { save } from "../storage.js";

export function createTestHooks(ctx) {
  const { buildToolIndex, fromSnapshot, mutate, snapshot, timeline } = ctx;
  // Development-only inspection hook for integration tests; absent from production.
  if (import.meta.env.DEV)
    window.__booth = {
      // The assistant's "take me to …" on the real index, for tests/view-assistant.mjs.
      openPlace: (place, control) => ctx.studioHost.openPlace(place, control),
      viewPicture: (long) => ctx.studioHost.viewPicture(long),
      get project() {
        return ctx.p;
      },
      get scene() {
        return ctx.scene;
      },
      // The undo history, so a test can check what a snapshot costs as well
      // as what it restores. An entry is {structure, assets}: the layout as
      // text, and the images by reference.
      get history() {
        return ctx.history;
      },
      get selectedPanel() {
        return ctx.selectedPanel;
      },
      get selectedPedestal() {
        return ctx.selectedPedestal;
      },
      get tab() {
        return ctx.tab;
      },
      get framePlace() {
        return ctx.framePlace;
      },
      get videoTimeline() {
        return ctx.videoTimeline;
      },
      get livePlace() {
        return ctx.livePlace;
      },
      get frames() {
        return { video: ctx.videoFrameShape, export: ctx.exportFrame, custom: ctx.customFrame };
      },
      get tier() {
        return ctx.tier;
      },
      // What tool search can find, without the elements, so a test can hold
      // every shortcut to a real control.
      toolIndex: () => buildToolIndex().map(({ label, where, tab }) => ({ label, where, tab: tab || null })),
      get picked() {
        return ctx.picked;
      },
      get walking() {
        return ctx.walking;
      },
      get hallSelected() {
        return ctx.hallSelected;
      },
      get showEditor() {
        return ctx.showEditor;
      },
      get show3d() {
        return ctx.show3d;
      },
      // What the light bar would hang, computed from the booth. The view test
      // reads it against the lights the scene actually built.
      get fixtures() {
        return lightBarFixtures(ctx.p);
      },
      get photo() {
        return ctx.photo;
      },
      mutate,
      // The custom video timeline, normalised — what the export would render.
      // tests/view-timeline.mjs reads it to check that Add really captured the
      // view the viewport was showing.
      timeline,
      save: () => save(fromSnapshot(snapshot())),
    };
}
