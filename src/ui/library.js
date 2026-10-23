// The library down the left and what it puts on the walls: `libraryItems`
// (the uploaded originals and the samples, as cards), `renderLibrary` (the
// library, or the show floor's pieces while the floor is open),
// `addCatalogPlacement` (a card tapped: a new copy hung beside the selected
// work) and the card's drag onto the 3D stage, which hangs the copy where it
// is dropped. `libraryItems`, `addCatalogPlacement` and `renderLibrary` are
// returned. Called once: it adds the `dragstart` and `dragend` listeners to
// the document and `dragover`, `dragleave` and `drop` to #scene. Moved out
// of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam 20): `ctx` is
// boot's state, read and set through it, and the helpers these call.
import { boothSlots, slotLabel } from "../row.js";
import { uid, groundLibrary, constrain, openSpot, PLACEMENT_GAP, wallLabel } from "../model.js";

export function createLibrary(ctx) {
  const { activeSlot, addPhotoLayer, libraryHTML, mutate, showLibraryHTML, toast } = ctx;
  function libraryItems() {
    const excluded = new Set([
      ctx.p.photo.asset,
      ctx.p.booth.surroundAsset,
      ...groundLibrary(ctx.p).map((g) => g.id),
    ].filter(Boolean));
    const originals = Object.entries(ctx.p.assets)
.filter(([id, asset]) => !excluded.has(id) && (asset.role === "artwork" || ctx.p.art.some((item) => item.asset === id)))
      .map(([assetId, asset]) => {
        const existing = ctx.p.art.find((item) => item.asset === assetId);
        if (existing) return { ...existing, sourceKey: "asset:" + assetId };
        const h = Math.min(48, (36 * asset.height) / asset.width);
        return {
          id: "catalog-" + assetId,
          sourceKey: "asset:" + assetId,
          asset: assetId,
          title: asset.name.replace(/\.[^.]+$/, ""),
          wall: "back",
          face: "inside",
          x: 12,
          y: 30,
          w: +((h * asset.width) / asset.height).toFixed(3),
          h: +h.toFixed(3),
          thickness: 1.5,
          offset: 0.75,
        };
      });
    const samples = ctx.p.art
      .filter((item) => !item.asset && !item.kind && !item.sourceId)
      .map((item) => ({ ...item, sourceKey: "sample:" + item.id }));
    return [...originals, ...samples];
  }
  function templateFromSource(sourceKey) {
    return libraryItems().find((item) => item.sourceKey === sourceKey);
  }
  function placementFromTemplate(template, keepEdits = false) {
    // Which booth of the row this is going into, and therefore which works
    // count as "already there": a work in another booth is not something to
    // start beside, and openSpot ignores it too.
    const booth = activeSlot();
    const current = ctx.p.art.find(
      (item) => item.id === ctx.selected && (item.booth || null) === booth,
    );
    const wall = current?.wall || template.wall || "back";
    const face = current?.face || template.face || "inside";
    // `openSpot` is what keeps a second tap on the same original from landing
    // exactly on the first one. The starting point is still beside whatever is
    // selected; it only moves on from there if that spot is occupied.
    return openSpot(
      ctx.p,
      constrain(ctx.p, {
        ...template,
        id: uid(),
        sourceKey: undefined,
        sourceId: template.asset ? undefined : template.sourceId || template.id,
        booth: booth || undefined,
        wall,
        face,
        x: current ? current.x + PLACEMENT_GAP : template.x ?? 12,
        y: current ? current.y : template.y ?? 30,
        // The finish the last work was given. Only ever a starting value, and
        // only for a work that does not already carry one of its own — a
        // second copy of something already hung keeps what that one has.
        ...(ctx.lastEdge && !template.edgeColor
          ? {
              edgeColor: ctx.lastEdge.edgeColor,
              edgeTexture: ctx.lastEdge.edgeTexture,
              thickness: Number.isFinite(ctx.lastEdge.thickness) ? ctx.lastEdge.thickness : template.thickness,
            }
          : {}),
        edits: keepEdits && template.edits ? structuredClone(template.edits) : undefined,
      }),
    );
  }
  function addCatalogPlacement(sourceKey) {
    const template = templateFromSource(sourceKey);
    if (!template) return;
    if (ctx.p.art.length >= 200) {
      toast("This prototype supports up to 200 wall placements.", true);
      return;
    }
    if (ctx.p.mode === "photo") {
      addPhotoLayer(template);
      return;
    }
    let placed;
    mutate(() => {
      placed = placementFromTemplate(template);
      ctx.p.art.push(placed);
      ctx.selected = placed.id;
      ctx.tab = "art";
    });
    const inBooth = placed.booth
      ? " of " + slotLabel(boothSlots(ctx.p.booth).find((b) => b.id === placed.booth) || {})
      : "";
    toast(
      `Hung on the ${wallLabel(ctx.p, placed.wall)}${inBooth} · ${placed.face === "outside" ? "outside" : "inside"}. Double-tap it on the wall to move or scale it.`,
    );
  }
  function renderLibrary() {
    document.querySelector("#library").innerHTML = ctx.showFloor ? showLibraryHTML() : libraryHTML();
  }
  function placeCopyAt(sourceKey, ev) {
    const template = templateFromSource(sourceKey);
    if (!template || !ctx.scene || ctx.p.mode !== "3d") return false;
    if (ctx.p.art.length >= 200) {
      toast("This prototype supports up to 200 wall placements.", true);
      return false;
    }
    const copy = placementFromTemplate(template);
    const placed = ctx.scene.wallDrop(ev, copy);
    if (!placed) {
      toast("Drop directly on an enabled interior or exterior booth wall.", true);
      return false;
    }
    mutate(() => {
      ctx.p.art.push(placed);
      ctx.selected = placed.id;
      ctx.tab = "art";
    });
    toast("New copy placed on " + wallLabel(ctx.p, placed.wall) + " · " + placed.face + ". Double-tap to adjust.");
    return true;
  }
  document.addEventListener("dragstart", (ev) => {
    const card = ev.target.closest("[data-source]");
    if (!card || ctx.p.mode !== "3d") return;
    ev.dataTransfer.setData("application/x-booth-original", card.dataset.source);
    ev.dataTransfer.effectAllowed = "copy";
  });
  const stage = document.querySelector("#scene");
  stage.addEventListener("dragover", (ev) => {
    if (ctx.p.mode === "3d" && [...ev.dataTransfer.types].includes("application/x-booth-original")) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "copy";
      stage.classList.add("drop-ready");
    }
  });
  stage.addEventListener("dragleave", () => stage.classList.remove("drop-ready"));
  document.addEventListener("dragend", () => stage.classList.remove("drop-ready"));
  stage.addEventListener("drop", (ev) => {
    const sourceKey = ev.dataTransfer.getData("application/x-booth-original");
    stage.classList.remove("drop-ready");
    if (!sourceKey) return;
    ev.preventDefault();
    placeCopyAt(sourceKey, ev);
  });
  return { libraryItems, addCatalogPlacement, renderLibrary };
}
