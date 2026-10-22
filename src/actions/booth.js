// The booth's own actions, from the Layout, Walls and Lighting tabs: the
// surroundings, the ground and the backdrop, the booth row, the light
// presets and spotlights, the light bar's default, the figures, free-
// standing walls and pedestals, the Box tool, 3D models, the floor plan
// underlay and saved views. Merged back into main.js's one action table
// with Object.assign. Moved out of src/main.js's boot() as it was
// (MAIN_SPLIT_PHASE.md, seam 15): `ctx` is boot's state, read and set
// through it, and the helpers these call.
import { flipFacing } from "../people.js";
import { uid, groundUpload, removeGroundUpload, constrainPedestal, MAX_PANELS, panelKey, LIGHT_BAR, MAX_PEDESTALS, FURNITURE, furnitureKind, artShowPanel, lightBarSpec, relinkArtShowWalls } from "../model.js";
import { BACKDROP_FRAMING } from "../scene.js";
import { distanceInches, formatLength } from "../measure.js";
import { MAX_VIEWS, newView } from "../views.js";
import { assetInDesigns } from "../linked.js";

export function createBoothActions(ctx) {
  const { addPerson, addRowBooths, addRowSpace, mutate, renderInspector, rowCount, setDrawingBox, syncTools, toast } = ctx;
  return {
    "upload-surround": () => document.querySelector("#surround-input").click(),
    "upload-ground": () => document.querySelector("#ground-input").click(),
    "clear-surround": () => mutate(()=>{ctx.p.booth.surroundAsset=null;}),
    // Removing an upload deletes that library entry; the floor falls back to
    // the last preset rather than leaving an empty slot behind.
    "remove-ground-upload": () => {
      const id = groundUpload(ctx.p);
      if (id) mutate(()=>removeGroundUpload(ctx.p, id));
    },
    // Zoom in steps of 5 points. Lower framing is a wider lens, so "zoom out"
    // subtracts; the clamp matches the slider and the schema.
    "backdrop-out": () => mutate(()=>{ctx.p.booth.backdropFraming=Math.max(25,(ctx.p.booth.backdropFraming ?? BACKDROP_FRAMING)-5);}),
    "backdrop-in": () => mutate(()=>{ctx.p.booth.backdropFraming=Math.min(100,(ctx.p.booth.backdropFraming ?? BACKDROP_FRAMING)+5);}),
    "backdrop-reset": () => mutate(()=>{ctx.p.booth.backdropFraming=BACKDROP_FRAMING;ctx.p.booth.surroundRotation=0;ctx.p.booth.backdropTilt=0;}),
    "row-booth-left": () => addRowBooths("left", 1),
    "row-booth-right": () => addRowBooths("right", 1),
    "row-count-left": () => addRowBooths("left", rowCount()),
    "row-count-right": () => addRowBooths("right", rowCount()),
    "row-space-left": () => addRowSpace("left"),
    "row-space-right": () => addRowSpace("right"),
    daylight: () =>
      mutate(() => {
        ctx.p.ambient = 1.6;
        for (const l of ctx.p.mode === "photo" ? ctx.p.photo.lights : ctx.p.lights) {
          l.kelvin = 5500;
          l.power = ctx.p.mode === "photo" ? 0.4 : 70;
        }
      }),
    warm: () =>
      mutate(() => {
        ctx.p.ambient = 0.7;
        for (const l of ctx.p.mode === "photo" ? ctx.p.photo.lights : ctx.p.lights) {
          l.kelvin = 3000;
          l.power = ctx.p.mode === "photo" ? 0.55 : 100;
        }
      }),
    "add-light": () =>
      mutate(() => {
        if (ctx.p.mode === "photo" && ctx.p.photo.lights.length < 8) {
          ctx.p.photo.lights.push({
            id: uid(),
            x: 0.5,
            y: 0.3,
            radius: 0.3,
            power: 0.5,
            kelvin: 4000,
          });
          ctx.photoLightIndex = ctx.p.photo.lights.length - 1;
        } else if (ctx.p.mode === "3d" && ctx.p.lights.length < 4) {
          ctx.p.lights.push({
            id: uid(),
            x: 0,
            y: 91,
            z: 24,
            tx: 0,
            ty: 55,
            tz: -59,
            power: 80,
            kelvin: 4000,
          });
          ctx.lightIndex = ctx.p.lights.length - 1;
        }
      }),
    "delete-light": () =>
      mutate(() => {
        if (ctx.p.mode === "photo") {
          ctx.p.photo.lights.splice(ctx.photoLightIndex, 1);
          ctx.photoLightIndex = 0;
        } else {
          ctx.p.lights.splice(ctx.lightIndex, 1);
          ctx.lightIndex = 0;
        }
      }),
    "add-woman": () => addPerson("woman"),
    "add-man": () => addPerson("man"),
    "add-child": () => addPerson("child"),
    "add-pair": () => addPerson("group"),
    "add-wheelchair": () => addPerson("wheelchair"),
    // Turn the figure round to face the other way; the cut-out picture
    // mirrors with its facing (people.js), so this is the one-click flip.
    "flip-person": (button) => {
      const id = button?.closest("[data-person]")?.dataset.person;
      mutate(() => {
        const person = (ctx.p.booth.people || []).find((x) => x.id === id);
        if (person) person.rotation = flipFacing(person.rotation ?? 0);
      });
    },
    "delete-person": (button) => {
      const id = button?.closest("[data-person]")?.dataset.person;
      mutate(() => (ctx.p.booth.people = (ctx.p.booth.people || []).filter((x) => x.id !== id)));
    },
    "add-panel": () =>
      mutate(() => {
        const panels = (ctx.p.booth.panels ||= []);
        if (panels.length >= MAX_PANELS) {
          toast(`This prototype supports up to ${MAX_PANELS} free-standing walls.`, true);
          return;
        }
        // A new panel stands across the middle of the booth, facing the
        // entrance like the back wall, so it is visible the moment it appears
        // rather than needing three numbers typed before anything shows.
        panels.push({
          id: uid(),
          name: "Panel " + (panels.length + 1),
          width: Math.min(ctx.p.booth.width, 72),
          height: ctx.p.booth.walls.back.height,
          x: 0,
          z: 0,
          rotation: 0,
        });
        // Selected on arrival: the next thing anyone does with a new wall is
        // move it, and a selected wall can be dragged straight away.
        ctx.selectedPanel = panelKey(panels[panels.length - 1].id);
        toast("Free-standing wall added at the centre of the booth. Drag it in the booth or use the sliders below.");
      }),
    "open-walls": () => {
      ctx.tab = "walls";
      renderInspector();
    },
    "add-pedestal": () =>
      mutate(() => {
        const list = (ctx.p.booth.pedestals ||= []);
        if (list.length >= MAX_PEDESTALS) {
          toast(`This prototype supports up to ${MAX_PEDESTALS} pieces of furniture.`, true);
          return;
        }
        const kind = ctx.furnitureChoice,
          { label, ...size } = FURNITURE[kind],
          same = list.filter((x) => furnitureKind(x) === kind).length;
        // Near the entrance on the right, where a card table usually stands,
        // rather than in the middle of the floor where it would be in the way
        // of the first thing anyone looks at. Measured from the piece's own
        // size, so an 8′ table lands inside the booth and a pedestal lands
        // exactly where it always did.
        list.push({
          id: uid(),
          name: (kind === "pedestal" ? "Pedestal" : label) + " " + (same + 1),
          ...size,
          ...(kind === "pedestal" ? {} : { kind }),
          x: Math.round(ctx.p.booth.width / 2 - size.width / 2 - 6),
          z: Math.round(ctx.p.booth.depth / 2 - size.depth / 2 - 18),
          rotation: 0,
        });
        list[list.length - 1] = constrainPedestal(ctx.p, list[list.length - 1]);
        ctx.selectedPedestal = list[list.length - 1].id;
        ctx.selectedPanel = null;
        toast(`${label} added near the entrance. Double-click it in the booth to pick it up, or use the sliders.`);
      }),
    "draw-box": () => setDrawingBox(!ctx.scene?.drawingBox),
    "upload-model": () => document.querySelector("#model-input").click(),
    "upload-underlay": () => document.querySelector("#underlay-input").click(),
    "remove-underlay": () =>
      mutate(() => {
        const id = ctx.p.booth.underlay?.asset;
        delete ctx.p.booth.underlay;
        // The image is only the plan's: nothing else can be using it.
        if (id && !ctx.p.art.some((a) => a.asset === id) && !assetInDesigns(ctx.p, id)) delete ctx.p.assets[id];
      }),
    "underlay-scale": () => {
      const u = ctx.p.booth.underlay;
      const pts = ctx.scene?.measure.points;
      if (!u || pts?.length !== 2) return toast("Measure a known distance on the plan with the tape (T) first.", true);
      const taped = distanceInches(pts[0], pts[1], 0.0254);
      const real = Number(document.querySelector("#underlay-real")?.value);
      if (!(taped > 0.5) || !(real > 0)) return toast("Type the real length of the distance you taped.", true);
      const factor = real / taped;
      const width = Math.max(12, Math.min(24000, u.width * factor));
      // Scaled about the tape's start, so the point that was measured from
      // stays under the cursor and the booth does not slide off the plan.
      const ox = pts[0].x / 0.0254, oz = pts[0].z / 0.0254;
      mutate(() => {
        u.width = Math.round(width * 100) / 100;
        u.x = Math.round((ox + (u.x - ox) * factor) * 100) / 100;
        u.z = Math.round((oz + (u.z - oz) * factor) * 100) / 100;
      });
      ctx.scene.setMeasuring(false);
      syncTools();
      toast(`Plan scaled ×${factor.toFixed(3)}: the taped distance now measures ${formatLength(real)}.`);
    },
    "view-save": () => {
      if (!ctx.scene) return;
      const views = ctx.p.views || [];
      if (views.length >= MAX_VIEWS) return toast(`${MAX_VIEWS} views is the limit.`, true);
      const v = newView(ctx.scene.pose(), uid(), views);
      mutate(() => (ctx.p.views = [...views, v]));
      toast(`Saved as “${v.name}”. Rename it in the list; the View menu under the booth goes back to it.`);
    },
    // The one drag back for a booth carrying the brightness default from
    // before the slider was a percentage. It writes the stored unit, not the
    // slider point, because the stored unit is what the light reads.
    "bar-default": () =>
      mutate(() => {
        ctx.p.booth.lightBar = { ...lightBarSpec(ctx.p.booth), power: LIGHT_BAR.power };
        toast("Fixture brightness set to 50.");
      }),
    "relink-walls": () =>
      mutate(() => {
        relinkArtShowWalls(ctx.p);
        const module = artShowPanel(ctx.p.booth);
        toast(
          `Walls rebuilt from ${Number(module.width.toFixed(2))}″ × ${module.height}″ panels: back ${ctx.p.booth.walls.back.width}″, sides ${ctx.p.booth.walls.left.width}″.`,
        );
      }),
  };
}
