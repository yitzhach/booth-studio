// The app's own actions: the project (open and download a backup, a new or
// duplicated booth, templates, Quick start), the toolbar's tools and the
// view (select, move, snap, pan, walk, measure, fast edit, zoom, undo and
// redo), the modes, and the welcome, help, the assistant's doors, the
// workspace and its roles, the looks, Find a tool, the plan and the phone's
// panel. Merged back into main.js's one action table with Object.assign.
// Moved out of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam
// 15): `ctx` is boot's state, read and set through it, and the helpers
// these call.
import { blankProject, uid } from "../model.js";
import { MAX_TEMPLATES, readTemplates, writeTemplates } from "../ui/templates.js";
import { templateOf } from "../quickstart.js";
import { LOOKS } from "../polish.js";

export function createAppActions(ctx) {
  const { applyRole, backup, btn, chooseRole, confirmAction, describeToAssistant, fromSnapshot, keepKit, loadStudio, mutate, openQuickStart, openWelcome, refreshIcons, render, renderInspector, runLook, runPolish, runQuickStart, scheduleSave, setDraft, setDraftPolicy, setMeasuring, setPanTool, setSheet, setShow3d, setTier, setWalking, shortcutHelp, snapshot, toast, welcomeDismissed } = ctx;
  return {
    import: () => document.querySelector("#backup-input").click(),
    backup,
    pan: () => setPanTool(!ctx.panTool),
    "clear-tapes": () => ctx.scene?.clearTapes(),
    select: () => {
      if (ctx.panTool) setPanTool(false);
      ctx.scene.move = false;
      document.querySelector('[data-action="select"]').classList.add("active");
      document.querySelector('[data-action="move"]').classList.remove("active");
      render();
    },
    move: () => {
      if (ctx.panTool) setPanTool(false);
      ctx.scene.move = true;
      document.querySelector('[data-action="move"]').classList.add("active");
      document
        .querySelector('[data-action="select"]')
        .classList.remove("active");
      render();
    },
    snap: () => {
      ctx.scene.snap = !ctx.scene.snap;
      document
        .querySelector('[data-action="snap"]')
        .classList.toggle("active", ctx.scene.snap);
      render();
    },
    // The tape measure. Its reading goes in the status bar as well as on the
    // tape, so it can be read without hunting for the label.
    measure: () => setMeasuring(!ctx.scene?.measure.on),
    draft: () => setDraft(!ctx.scene?.draft),
    "draft-lock": () =>
      setDraftPolicy({ auto: "on", on: "off", off: "auto" }[ctx.draftPolicy] || "auto"),
    undo: () => {
      if (!ctx.history.length) return;
      ctx.future.push(snapshot());
      ctx.p = keepKit(fromSnapshot(ctx.history.pop()));
      render();
      scheduleSave();
    },
    redo: () => {
      if (!ctx.future.length) return;
      ctx.history.push(snapshot());
      ctx.p = keepKit(fromSnapshot(ctx.future.pop()));
      render();
      scheduleSave();
    },
    "mode-3d": () => {
      if (ctx.show3d) setShow3d(false);
      ctx.showFloor = false;
      mutate(() => (ctx.p.mode = "3d"));
    },
    "mode-photo": () =>
      (ctx.show3d && setShow3d(false), mutate(() => {
        ctx.showFloor = false;
        ctx.p.mode = "photo";
        ctx.tab = ctx.p.photo.asset ? "art" : "layout";
      })),
    "export-tab": () => {
      ctx.tab = "export";
      renderInspector();
    },
    "zoom-in": () => (ctx.showFloor && !ctx.show3d ? ctx.showEditor?.zoom(1.25) : ctx.p.mode === "3d" && ctx.scene?.zoom(1.2)),
    "zoom-out": () => (ctx.showFloor && !ctx.show3d ? ctx.showEditor?.zoom(1 / 1.25) : ctx.p.mode === "3d" && ctx.scene?.zoom(1/1.2)),
    "reset-view": () => {
      if (ctx.showFloor && !ctx.show3d) return ctx.showEditor?.fit();
      ctx.scene?.setView("perspective");
      document
        .querySelectorAll("[data-view]")
        .forEach((b) =>
          b.classList.toggle("active", b.dataset.view === "perspective"),
        );
    },
    "quick-start": () => openQuickStart(),
    "qs-go": () => runQuickStart(),
    "qs-cancel": () => document.querySelector("#dialog").close(),
    "welcome-describe": () => describeToAssistant(),
    "welcome-sign-in": () => {
      document.querySelector("#dialog").close();
      welcomeDismissed();
      ctx.actions["studio-account"]();
    },
    "welcome-close": () => {
      document.querySelector("#dialog").close();
      welcomeDismissed();
    },
    "save-template": () => {
      const list = readTemplates();
      const t = templateOf(ctx.p, ctx.p.name);
      const next = [t, ...list.filter((x) => x.label !== t.label)];
      if (writeTemplates(next))
        toast(`Saved “${t.label}” as a template${next.length > MAX_TEMPLATES ? `; the oldest of ${MAX_TEMPLATES} was dropped` : ""}. Quick start offers it next time. Artwork and images are not included.`);
      else toast("This browser would not store the template. Download a project backup instead.", true);
    },
    "studio-account": () =>
      loadStudio()
        .then((b) => b.openPanel())
        .catch((err) => toast(`Studio account couldn't open: ${err.message}`, true)),
    "new-project": () =>
      confirmAction(
        "Start an empty booth?",
        "A backup of your current project will download before it is replaced.",
        () => {
          backup();
          mutate(() => {
            ctx.p = blankProject();
            ctx.selected = null;
            ctx.tab = "layout";
          });
          ctx.scene?.setView("perspective");
        },
      ),
    "copy-project": () => {
      backup();
      mutate(() => {
        ctx.p.id = uid();
        ctx.p.name = ctx.p.name.replace(/ · Alternative$/, "") + " · Alternative";
      });
      toast(
        "Alternative created. The previous layout was downloaded as a backup.",
      );
    },
    help: () => {
      const d = document.querySelector("#dialog");
      document.querySelector("#dialog-content").innerHTML =
        `<div class="panel-heading"><h2>Welcome to Booth Studio</h2>${btn("close-help", "Close", "x", "icon-only")}</div><p>Start with Layout, upload your original artwork, and enter its actual dimensions. Sample panels are dimension placeholders, not artwork.</p><ol><li><strong>Arrange:</strong> select a work in the library. Set its wall, left edge, and bottom edge. Use Move to drag along the wall, or Center to align.</li><li><strong>Art show booth:</strong> the Art show tool switches this booth to an indoor convention booth — seamless white walls, a light bar with directional heads spotting each wall, and a white exhibition hall around you. Booth size, wall sizes and the individual display panel are all typed in inches there.</li><li><strong>Free-standing walls and pedestals:</strong> add them in the Walls tool, then click a wall — or double-click a pedestal — in the booth to pick it up. Drag it across the floor, or use its left/right and front/back sliders. Snap keeps a drag on whole inches.</li><li><strong>Navigate:</strong> drag empty space to orbit, scroll to zoom, right-drag to pan. On touch, use one finger to orbit and two to pan/zoom. Wall and Plan views give precise views.</li><li><strong>Light:</strong> adjust ambient light and each spotlight’s position, target, power, and temperature.</li><li><strong>Photo:</strong> upload a booth shot, select uploaded library artwork to add it, then drag its four corners. Lighting is a visual overlay. Existing photo objects remain baked in.</li><li><strong>Keep:</strong> autosave is on this browser/device only. Download a full backup to transfer or archive a project.</li><li><strong>Export:</strong> PNG captures the current view; the hanging guide gives measured artwork edges.</li></ol><p class="muted">Ctrl/⌘ Z: undo · Ctrl/⌘ Shift Z: redo · Delete: remove selected artwork · Arrows: nudge 1″ (Shift: 1′) · R / Shift R: turn a pedestal or wall 15° · Ctrl/⌘ D: duplicate · V: select · M: move · T: tape measure · Esc: put the tape away · / or Ctrl/⌘ K: find a tool.</p>${shortcutHelp()}<p class="muted">No AI calls. Single images do not supply surface relief; baked-in lighting remains. Photorealism and exact display color are not guaranteed.</p>`;
      refreshIcons();
      d.showModal();
    },
    "close-help": () => document.querySelector("#dialog").close(),
    // The phone's way into search: the box is in the header, out of a
    // thumb's reach, so a button in the viewport's corner focuses it.
    // The studio assistant's other two doors (src/studio-assistant.js): the
    // header's button and, on a phone, the icon above Find a tool. Both show
    // only while the panel's own button would (body.assistant-on).
    assistant: () => document.querySelector("studio-assistant")?.toggle(),
    // The inspector's More: every tab, then back to the workspace's own.
    "tabs-more": () => {
      ctx.tabsMore = !ctx.tabsMore;
      applyRole();
    },
    workspace: () => openWelcome(),
    polish: () => runPolish(),
    ...Object.fromEntries(Object.keys(LOOKS).map((k) => [`look-${k}`, () => runLook(k)])),
    "role-artist": () => chooseRole("artist"),
    "role-organizer": () => chooseRole("organizer"),
    "role-all": () => chooseRole("all"),
    // Phones only (the button is hidden wider): the toolbar shows Select,
    // Move, Walk and Undo, and this opens the rest in the same row.
    "tools-more": () => {
      const open = document.body.classList.toggle("tools-open");
      document.querySelector('.toolbar [data-action="tools-more"]').setAttribute("aria-expanded", String(open));
    },
    "find-tool": () => {
      const box = document.querySelector("#tool-search");
      box.focus();
      box.select();
    },
    "tier-pro": () => setTier("pro"),
    walk: () => setWalking(!ctx.walking),
    "sheet-toggle": () => setSheet(!document.body.classList.contains("sheet-collapsed")),
  };
}
