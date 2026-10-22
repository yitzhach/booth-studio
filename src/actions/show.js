// The show floor's actions: opening and leaving it, the 3D show and its
// walk, the drawing board's selection (rotate, flip, duplicate, delete,
// space, align, renumber, blocks of booths), floor templates, the hall
// planner, a floor booth opened as a design, booth designs sent and
// imported, the map, the CSV and the power sheet. The keys and the panel are
// src/ui/show-floor-panel.js. Merged back into main.js's one action table
// with Object.assign. Moved out of src/main.js's boot() as it was
// (MAIN_SPLIT_PHASE.md, seam 14): `ctx` is boot's state, read and set
// through it, and the helpers these call.
import { MAX_KEYS, MIN_SECONDS, MAX_SECONDS, normalizeTimeline } from "../timeline.js";
import { download } from "../storage.js";
import { hallCSV, hallHTML, newHall } from "../hall.js";
import { floorTemplateOf, growToFit, boothBlock, boundsOf, floorOf, renumber, spacePieces, toFloor } from "../show.js";
import { showWalkthrough } from "../show-scene.js";
import { designFile } from "../booth-file.js";
import { rememberLink, shareLink, uploadShare } from "../share.js";
import { MAX_FLOOR_TEMPLATES, readFloorTemplates, writeFloorTemplates } from "../ui/templates.js";
import { OWN, hasDesign, liveNumber, openBooth, setMine } from "../linked.js";
import { powerHTML } from "../power.js";

export function createShowActions(ctx) {
  const { allowed, confirmAction, mutate, render, renderInspector, renumberBooths, safeName, setShow3d, setWalking, shareFile, showAlign, showDelete, showDuplicate, showMirror, showPieces, showRotate, showShareLink, toast } = ctx;
  return {
    "mode-show": () => {
      if (!allowed("hall")) {
        ctx.tab = "hall";
        return render();
      }
      if (!ctx.p.hall || !ctx.p.hall.items) {
        mutate(() => {
          ctx.p.hall = toFloor(ctx.p.hall || newHall());
        });
      }
      ctx.showFloor = true;
      ctx.tab = "hall";
      ctx.hallSelected = null;
      render();
      ctx.showEditor?.fit();
    },
    "show-exit": () => ctx.actions["mode-3d"](),
    "show-3d": () => setShow3d(!ctx.show3d),
    "show-walk": () => setWalking(!ctx.walking),
    "show-walkthrough": () => {
      if (!ctx.show3d) setShow3d(true);
      if (!ctx.scene || !ctx.show3d) return;
      ctx.videoTimeline = normalizeTimeline(showWalkthrough(ctx.p.hall, { maxKeys: MAX_KEYS, minSeconds: MIN_SECONDS, maxSeconds: MAX_SECONDS }));
      ctx.tlSelected = null;
      ctx.tlPlayhead = 0;
      ctx.tlBeforeAuto = null;
      ctx.actions["edit-timeline"]();
      toast(`A ${ctx.videoTimeline.seconds}-second walk through the aisles, ${ctx.videoTimeline.keys.length} keyframes. Play it, change any keyframe, then Export MP4.`);
    },
    "show-fit": () => ctx.showEditor?.fit(),
    "show-grow": () => {
      let grew = false;
      mutate(() => (grew = growToFit(ctx.p.hall)));
      if (!ctx.show3d) ctx.showEditor?.fit();
      const f = floorOf(ctx.p.hall);
      toast(grew ? `The floor is ${Math.round(f.width / 12)}′ × ${Math.round(f.depth / 12)}′ now, with every piece on it. Undo puts it back.` : "Every piece is already on the floor.");
    },
    "show-save-template": () => {
      const t = floorTemplateOf(JSON.parse(JSON.stringify(ctx.p.hall)), ctx.p.name || "My floor");
      const list = readFloorTemplates();
      const next = [t, ...list.filter((x) => x.label !== t.label)];
      if (writeFloorTemplates(next)) {
        renderInspector();
        toast(`Saved “${t.label}” as a floor template${next.length > MAX_FLOOR_TEMPLATES ? `; the oldest of ${MAX_FLOOR_TEMPLATES} was dropped` : ""}. Start from a template offers it on any floor.`);
      } else toast("This browser would not store the floor template. It may be too big; download a project backup instead.", true);
    },
    "show-rotate": () => showRotate(90),
    "show-flip-x": () => showMirror("x"),
    "show-flip-y": () => showMirror("y"),
    "show-duplicate": () => showDuplicate(),
    "show-delete": () => showDelete(),
    "show-deselect": () => ctx.showEditor?.select([]),
    "show-space": () => {
      const pieces = showPieces();
      const moves = spacePieces(pieces, ctx.showGap);
      if (!moves.length) return toast("Select two or more pieces to space them.");
      mutate(() => {
        for (const m of moves) Object.assign(ctx.p.hall.items.find((i) => i.id === m.id), { x: m.x, y: m.y });
      });
      toast(`${pieces.length} pieces spaced ${ctx.showGap}″ apart.`);
    },
    "show-align-top": () => showAlign("t"),
    "show-align-left": () => showAlign("l"),
    "show-renumber": () => {
      const pieces = showPieces().length > 1 ? showPieces() : toFloor(ctx.p.hall).items;
      const from = Math.min(...pieces.filter((i) => i.kind === "booth").map((i) => i.number));
      const start = pieces === ctx.p.hall.items ? ctx.p.hall.start : from;
      const next = renumber(pieces, start);
      // A new number already taken by a booth outside the renumbered ones would
      // be two booths with one number.
      const moving = new Set(next.map((n) => n.id));
      const clash = ctx.p.hall.items.some((i) => i.kind === "booth" && !moving.has(i.id) && next.some((n) => n.number === i.number));
      if (clash) return toast("Those numbers are taken by other booths. Renumber the whole floor with nothing selected.", true);
      mutate(() => renumberBooths(next));
      toast(`${next.length} booths renumbered from ${start}, row by row from the back.`);
    },
    "show-add-block": () => {
      const b = ctx.showBlock;
      const c = ctx.showEditor?.center() || { x: 0, y: 0 };
      const rows = Math.ceil(b.count / Math.max(1, b.perRow));
      const width = Math.min(b.count, b.perRow) * (b.w + b.gap) - b.gap;
      const depth = b.backToBack ? Math.ceil(rows / 2) * (2 * b.d + b.aisle) - b.aisle : rows * (b.d + b.aisle) - b.aisle;
      let ids = [], grew = false;
      mutate(() => {
        const h = toFloor(ctx.p.hall);
        // Below everything already on the floor, an aisle away, so a new block
        // never lands on top of booths already sold; an empty floor centres it.
        const box = boundsOf(h.items);
        const at = box ? { x: box.l, y: box.b + b.aisle } : { x: c.x - width / 2, y: c.y - depth / 2 };
        const block = boothBlock(h.items, { ...b, x: Math.round(at.x / 12) * 12, y: Math.round(at.y / 12) * 12, start: h.start });
        h.items.push(...block);
        ids = block.map((i) => i.id);
        // A block laid below the rest can run past the floor's edge; the floor
        // grows to take it, in the same step, so one Undo takes both back.
        grew = growToFit(h);
      });
      ctx.showEditor?.fit();
      ctx.showEditor?.select(ids);
      const f = floorOf(ctx.p.hall);
      toast(`${ids.length} booths added below the rest and selected — drag them into place.${grew ? ` The floor grew to ${Math.round(f.width / 12)}′ × ${Math.round(f.depth / 12)}′ to take them.` : ""}`);
    },
    "hall-start": () => {
      mutate(() => {
        ctx.p.hall = newHall();
        ctx.tab = "hall";
      });
      if (ctx.showFloor) return ctx.actions["mode-show"]();
      toast("Hall plan started: two back-to-back rows of eight 10 × 10s. Change the layout below; tap a booth to sell it.");
    },
    "hall-delete": () =>
      confirmAction("Delete the hall plan?", "Every booth's exhibitor, status and price goes with it, and every booth design opened from it except the one open now. Undo brings it back.", () => {
        mutate(() => delete ctx.p.hall);
        ctx.hallSelected = null;
      }),
    "hall-deselect": () => {
      ctx.hallSelected = null;
      renderInspector();
    },
    "hall-mine": () =>
      mutate(() => setMine(ctx.p.hall, ctx.p.hall.mine === ctx.hallSelected ? undefined : ctx.hallSelected)),
    "show-open-booth": () => {
      const n = ctx.hallSelected;
      if (!ctx.p.hall || !Number.isInteger(n)) return;
      if (liveNumber(ctx.p.hall) === n) return ctx.actions["mode-3d"]();
      let err = null;
      const fresh = !hasDesign(ctx.p.hall, n);
      if (ctx.show3d) setShow3d(false);
      mutate(() => {
        err = openBooth(ctx.p, n);
        if (err) return;
        ctx.showFloor = false;
        ctx.p.mode = "3d";
        ctx.selected = null;
        ctx.tab = "layout";
      });
      if (err) return toast(err, true);
      toast(fresh ? `Booth ${n} opened as a new design, sized from the floor. The booth you had open is kept with its booth; Show floor → any booth opens it again.` : `Booth ${n}'s design is open. The one you had open is kept with its booth.`);
    },
    "share-design": async () => {
      if (ctx.sharing) return;
      ctx.sharing = true;
      try {
        const file = await shareFile();
        toast("Uploading your booth…");
        const { id, key } = await uploadShare(file, (done, total) => total && toast(`Uploading your booth… ${done} of ${total} images`));
        rememberLink({ id, key, name: ctx.p.name });
        renderInspector();
        showShareLink(shareLink(id));
      } catch (err) {
        toast(`The booth could not be shared: ${err.message}`, true);
      } finally {
        ctx.sharing = false;
      }
    },
    "send-design": () => {
      download(new Blob([JSON.stringify(designFile(ctx.p))], { type: "application/json" }), safeName() + ".booth-design.json");
      toast("Booth design downloaded. Send the file to the show's promoter; they import it onto your booth number.");
    },
    "import-design": () => {
      if (!ctx.p.hall || !Number.isInteger(ctx.hallSelected)) return;
      ctx.designTarget = ctx.hallSelected;
      document.querySelector("#design-input").click();
    },
    "show-open-own": () => {
      if (!ctx.p.hall?.designs?.[OWN]) return;
      let err = null;
      if (ctx.show3d) setShow3d(false);
      mutate(() => {
        err = openBooth(ctx.p, OWN);
        if (!err) (ctx.showFloor = false), (ctx.p.mode = "3d"), (ctx.selected = null);
      });
      if (err) toast(err, true);
      else toast("Your own booth — the one on no booth of this floor — is open again.");
    },
    "hall-map": () => {
      if (!ctx.p.hall) return;
      download(new Blob([hallHTML(ctx.p.hall, ctx.p.name)], { type: "text/html" }), safeName() + "-hall-map.html");
      toast("Hall map downloaded: the map, a legend, totals and every booth. Open it to print.");
    },
    "hall-csv": () => {
      if (!ctx.p.hall) return;
      download(new Blob([hallCSV(ctx.p.hall)], { type: "text/csv" }), safeName() + "-exhibitors.csv");
      toast("Exhibitor list downloaded as CSV — it opens in any spreadsheet.");
    },
    "power-sheet": () => {
      download(new Blob([powerHTML(ctx.p, { outlets: ctx.powerOutlets })], { type: "text/html" }), safeName() + "-power-and-rentals.html");
      toast("Power and rentals sheet downloaded. Correct anything on the printout before sending it to the show.");
    },
  };
}
