// The studio's host: what the studio bridge (src/studio.js) and the
// assistant's panel may ask of the page, the lazy load of both, and the
// notice for a chunk that would not load. Moved out of src/main.js's boot()
// as it was (MAIN_SPLIT_PHASE.md, seam 18): `ctx` is boot's state, read and
// set through it, and the helpers these call. Only the two `import()` paths
// changed, to reach the same files from src/ui/.
import { save } from "../storage.js";
import { readSession } from "../studio-session.js";

export function createStudioHost(ctx) {
  const { appMapText, backfillThumbnails, backup, buildToolIndex, confirmAction, fromSnapshot, mutate, openTool, placeHit, snapshot, tagAssetRoles, toast } = ctx;
  // The studio (src/studio.js): sign-in and sync through the studio platform.
  // Its code and the SDK load only when this browser is signed in, or when the
  // artist opens Studio account; signed out, nothing here runs and /v1 is
  // never called.
  // A chunk loaded on demand that would not load. Online, it is nearly always
  // a tab left open across a deploy: it asks for the old names of the
  // chunks (the studio, the assistant), and the Worker answers a missing
  // file with the page itself. Offline, it is a part never loaded here yet.
  // Either way say what to do, and keep saying it for its 15 seconds over the
  // error toasts that follow from the same failure (toast); the error itself
  // still reaches the problem report.
  ctx.chunkFailed = () => {
    toast(
      navigator.onLine === false
        ? "That part of Booth Studio hasn't been loaded on this device yet, and needs a connection: try again when you're online."
        : "Booth Studio was updated while this tab was open, so that part couldn't load. Reload the page: your work is saved on this device.",
      true,
      15000,
    );
    ctx.chunkNoticeUntil = Date.now() + 15000;
  };
  let studioLoading = null;
  function loadStudio() {
    return (studioLoading ||= import("../studio.js")
      .then((m) => {
        ctx.studioBridge = m.connect(studioHost);
        // The assistant's panel comes with the studio, and shows only where an
        // assistant is connected (src/studio-assistant.js).
        import("../studio-assistant.js")
          .then((a) => a.mount(ctx.studioBridge, studioHost))
          .catch((err) => console.error(err));
        return ctx.studioBridge;
      })
      .catch((err) => {
        // Not kept: a load that failed (offline, a deploy) is tried again next time.
        studioLoading = null;
        throw err;
      }));
  }
  const studioHost = {
    project: () => ctx.p,
    // The assistant panel's 🖼: the booth as it is drawn now — clean, without
    // controls or outlines, in the window's own shape — as a PNG `long` px on
    // its long side, for the panel to shrink and send with the next message.
    // Photo mode gives the photo composition (photo.export takes a width).
    // Null while an export or a previewed move holds the renderer; an error
    // in the panel's words otherwise (the exports' own speak of a size menu
    // the panel doesn't have).
    viewPicture: async (long) => {
      if (ctx.busy || ctx.busyVideo || ctx.busyPreview) return null;
      // The show floor's plan is drawn by the show editor, not the 3D scene;
      // a render would be the booth hidden behind it.
      if (ctx.showFloor && !ctx.show3d) throw new Error("The show floor's plan can't be pictured yet. Open The show in 3D, or attach a screenshot with 📷.");
      const a = ctx.p.mode === "photo" ? ctx.p.assets[ctx.p.photo.asset] : null;
      if (ctx.p.mode === "photo" && !a) throw new Error("Upload a booth photo first, or switch to 3D booth.");
      if (ctx.p.mode !== "photo" && !ctx.scene) throw new Error("3D isn't available on this browser, so there is no view to send. A screenshot works too: 📷.");
      ctx.busy = true;
      try {
        return ctx.p.mode === "photo" ? await ctx.photo.export(a.height > a.width ? Math.round((long * a.width) / a.height) : long) : await ctx.scene.export(long);
      } catch {
        throw new Error("This device couldn't draw the booth just now. A screenshot works too: 📷.");
      } finally {
        ctx.busy = false;
      }
    },
    // For the assistant: every control the tool search knows, as "where: names",
    // so it can tell the artist which tab or bar and which button (Art-Talk-Back D-072).
    appMap: () => appMapText(ctx.toolIndex || (ctx.toolIndex = buildToolIndex())),
    // "Take me to …" from the assistant (Art-Talk-Back D-075): open the tab and
    // show the control, never press it. False when nothing matched.
    openPlace(place, control) {
      const hit = placeHit(place, control);
      if (!hit) return false;
      openTool(hit, { press: false });
      return true;
    },
    // A version from the studio replaces the project on screen, like an
    // opened backup: one step, and Undo brings back what was here.
    open(next) {
      mutate(() => {
        ctx.p = next;
        tagAssetRoles(ctx.p);
        ctx.selected = ctx.p.art[0]?.id;
        ctx.photoSelected = null;
        ctx.lightIndex = 0;
        ctx.photoLightIndex = 0;
      });
      const name = document.querySelector("#project-name");
      if (name) name.value = ctx.p.name;
      backfillThumbnails();
    },
    saveNow: () => save(fromSnapshot(snapshot())),
    backup,
    toast,
    confirm: confirmAction,
    dialog: () => document.querySelector("#dialog"),
    setNetwork(text) {
      const n = document.querySelector("#network");
      if (n) n.textContent = text;
    },
  };
  if (readSession())
    loadStudio()
      .then((b) => b.boot())
      .catch((err) => console.error(err));
  return { loadStudio, studioHost };
}
