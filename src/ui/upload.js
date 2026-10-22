// Upload and import: images chosen or dropped (artwork, the booth photo, the
// surround, ground and wall textures), an exhibitor's booth design onto a
// floor booth (chosen, or dropped on the 2D floor), and a project backup.
// It only wires the file inputs and the floor's drop; nothing else calls it.
// Moved out of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam 8):
// `ctx` is boot's state, read and set through it, and the helpers this calls.
import { uid, validateProject } from "../model.js";
import { readImage } from "../storage.js";
import { importDesign, readDesignFile } from "../booth-file.js";
import { mergeFloorTemplates } from "./templates.js";
import { hasDesign, liveNumber } from "../linked.js";

export function createUpload(ctx) {
  const { backfillThumbnails, backup, confirmAction, mutate, renderInspector, tagAssetRoles, toast } = ctx;
  async function upload(files, type) {
    if (!files.length) return;
    try {
      toast("Reading original images…");
      const assets = [];
      for (const file of files) assets.push(await readImage(file));
      if (Object.keys(ctx.p.assets).length + assets.length > 250) throw new Error("This prototype supports up to 250 images.");
      mutate(() => {
        if (type === "photo") {
          const id = uid();
          assets[0].role = "photo";
          ctx.p.assets[id] = assets[0];
          ctx.p.photo.asset = id;
          ctx.p.photo.layers = [];
          ctx.p.photo.lights = [];
          ctx.p.mode = "photo";
          ctx.tab = "art";
          return;
        }
        // Uploading is filing, not hanging. Every upload used to push a
        // placement per file onto the back wall at the same x and y, so
        // choosing five images from a phone put five coplanar panels in one
        // spot: they z-fight, and the wall flashes through all five. The
        // library already lists an original that has no placement — see
        // `libraryItems` — so the files land there and the wall stays as it
        // was until someone taps one.
        for (const asset of assets) {
          const id = uid();
          asset.role = "artwork";
          ctx.p.assets[id] = asset;
          if (type === "replace") {
            const a = ctx.p.art.find((a) => a.id === ctx.selected);
            if (a) {
              a.asset = id;
              a.title = asset.name.replace(/\.[^.]+$/, "");
              a.edits = undefined;
            }
            break;
          }
        }
        ctx.tab = "art";
      });
      toast(
        type === "photo"
          ? "Booth photo ready. Select an uploaded artwork to add it."
          : type === "replace"
            ? "Image replaced. The original stays in your library."
            : `${assets.length} original${assets.length > 1 ? "s" : ""} added to your library. Tap one to hang it on a wall.`,
      );
    } catch (err) {
      toast(err.message, true);
    }
  }
  for (const [id, type] of [
    ["art-input", "art"],
    ["replace-input", "replace"],
    ["photo-input", "photo"],
  ])
    document.querySelector("#" + id).onchange = async (ev) => {
      const files = [...ev.target.files];
      if (type === "photo" && ctx.p.photo.asset) {
        confirmAction(
          "Replace booth photograph?",
          "A backup will download first. Photo artwork and lighting overlays will reset for the new photograph.",
          () => {
            backup();
            upload(files, type);
          },
        );
      } else await upload(files, type);
      ev.target.value = "";
    };
  // An exhibitor's booth design file, onto the floor booth chosen when Import
  // was pressed (src/booth-file.js), or the one it was dropped on.
  document.querySelector("#design-input").onchange = async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = "";
    const n = ctx.designTarget;
    ctx.designTarget = null;
    await importDesignFile(f, n);
  };
  // A file dragged over the 2D floor: the booth under the pointer is where it
  // will land, and is outlined while it is held there.
  const floorHost = document.querySelector("#show-floor");
  const boothUnder = (ev) => document.elementsFromPoint(ev.clientX, ev.clientY).map((el) => el.closest?.("#show-floor [data-hall-booth]")).find(Boolean) || null;
  const markDrop = (g) => {
    for (const x of floorHost.querySelectorAll(".sf-drop")) if (x !== g) x.classList.remove("sf-drop");
    g?.classList.add("sf-drop");
  };
  floorHost.addEventListener("dragover", (ev) => {
    if (!ctx.showFloor || ctx.show3d || !ctx.p.hall || ![...ev.dataTransfer.types].includes("Files")) return;
    ev.preventDefault();
    const g = boothUnder(ev);
    ev.dataTransfer.dropEffect = g ? "copy" : "none";
    markDrop(g);
  });
  floorHost.addEventListener("dragleave", (ev) => {
    if (!floorHost.contains(ev.relatedTarget)) markDrop(null);
  });
  floorHost.addEventListener("drop", async (ev) => {
    if (!ctx.showFloor || ctx.show3d || !ctx.p.hall || ![...ev.dataTransfer.types].includes("Files")) return;
    ev.preventDefault();
    const g = boothUnder(ev);
    markDrop(null);
    const f = ev.dataTransfer.files[0];
    if (!f) return;
    if (!g) return toast("Drop a booth design file on a booth.", true);
    const n = Number(g.dataset.hallBooth);
    ctx.hallSelected = n;
    ctx.showEditor?.select([g.dataset.id]);
    await importDesignFile(f, n);
  });
  async function importDesignFile(f, n) {
    if (!f || !ctx.p.hall || !Number.isInteger(n)) return;
    let file;
    try {
      if (f.size > 200 * 1024 * 1024) throw new Error("That file is over the 200 MB limit.");
      file = readDesignFile(JSON.parse(await f.text()));
    } catch (err) {
      return toast(err instanceof SyntaxError ? "This is not a Booth Studio booth design file." : err.message, true);
    }
    const from = file.name ? `“${file.name}”` : "The design";
    const go = () => {
      let err = null;
      const live = liveNumber(ctx.p.hall) === n;
      mutate(() => {
        err = importDesign(ctx.p, n, file);
        if (!err && live) ctx.selected = null;
      });
      if (err) toast(err, true);
      else toast(`${from} is on booth ${n}. ${live ? "It is open in the booth editor." : "Open this booth to edit it; See it in 3D shows it on the floor."}`);
    };
    if (hasDesign(ctx.p.hall, n)) confirmAction(`Replace booth ${n}'s design?`, `${from} replaces the design booth ${n} has now. Undo brings it back.`, go);
    else go();
  }
  document.querySelector("#backup-input").onchange = async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    try {
      if (f.size > 200 * 1024 * 1024)
        throw new Error("Backup exceeds the 200 MB prototype limit.");
      const raw = JSON.parse(await f.text());
      const carried = raw && typeof raw === "object" && Array.isArray(raw.floorTemplates) ? raw.floorTemplates : [];
      if (raw && typeof raw === "object") delete raw.floorTemplates;
      const imported = validateProject(raw);
      confirmAction(
        "Open this project?",
        "Your current project will download as a backup before the imported project opens.",
        () => {
          backup();
          mutate(() => {
            ctx.p = imported;
            tagAssetRoles(ctx.p);
            ctx.selected = ctx.p.art[0]?.id;
            ctx.photoSelected = null;
            ctx.lightIndex = 0;
            ctx.photoLightIndex = 0;
          });
          ctx.scene?.setView("perspective");
          // A backup written before thumbnails existed brings none with it.
          backfillThumbnails();
          const added = mergeFloorTemplates(carried);
          if (added) renderInspector();
          toast(`Project restored with its original images.${added ? ` ${added} floor template${added === 1 ? "" : "s"} from the backup added to this browser.` : ""}`);
        },
      );
    } catch (err) {
      toast(err.message, true);
    }
  };
}
