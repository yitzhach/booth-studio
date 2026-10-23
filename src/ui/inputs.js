// The inspector's controls as they are used: the one `change` listener that
// every select, checkbox and typed number in the panels reaches (and the
// end of a slider's gesture), the `input` listener that moves the booth
// live while a slider or a colour is dragged, the show floor library's
// press, and the drop-shadow dial. Called once for its effect. Moved out of
// src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam 16): `ctx` is
// boot's state, read and set through it, and the helpers these call.
import { MOVES, CUSTOM_MOVE, resolveMove } from "../camera-path.js";
import { normalizeTimeline, timelineSeconds, keySchedule, keyTAt } from "../timeline.js";
import { cleanSettings, tweak, CUSTOM as KIT_CUSTOM } from "../batch.js";
import { FRAMES, DEFAULT_FRAME, FRAME_MIN, FRAME_MAX, STILL_SIZES, normalPlace } from "../framing.js";
import { SHADOW_FIELD, SHADOW_KINDS, globalAngle } from "../dropshadow.js";
import { rememberColor } from "../swatches.js";
import { normalizeImageEdits } from "../image-edit.js";
import { MAX_GAP, normalizeRow, setSpaceWidth } from "../row.js";
import { selectGround, constrain, constrainPanel, constrainPedestal, scalePanel, convex, boothPanels, findPanel, panelKey, wallSpec, FURNITURE, applyVenue, boothPedestals, findPedestal, relinkArtShowWalls } from "../model.js";
import { AUTO_QUALITY, startScale } from "../adaptive.js";
import { MAX_HALL_BOOTHS } from "../hall.js";
import { SHAPES } from "../show.js";
import { HALL_OFF_NOTE } from "./polish-panel.js";
import { applyEnvPreset } from "../polish.js";

export function createInputs(ctx) {
  const { checkpoint, currentArtwork, endShadowGesture, fieldTarget, getPlace, goToView, kit, mutate, placeSettled, probeCodec, refreshIcons, refreshPanels, refreshScene, rememberEdge, renderInspector, renderLibrary, renderStatus, renderTimelineDialog, saveViewPrefs, scheduleSave, setDraft, setDraftPolicy, setKit, setPlace, setShadowLive, setTier, showChange, syncArtInputs, syncPanelInputs, syncPedestalInputs, syncQuality, syncShadowInputs, timeline, toast, updateFrameGuide } = ctx;
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (showChange(el)) return;
    // The slider's own input handler has already made the move and taken the
    // one checkpoint the gesture gets; this only closes it out. Falling
    // through to the generic field handler would checkpoint the finished
    // position, which is undo pointing at the wrong thing.
    if (
      el.type === "range" &&
      (el.dataset.scope || "").startsWith("panel-") &&
      ["x", "z"].includes(el.dataset.field)
    ) {
      ctx.panelGesture = false;
      refreshScene();
      scheduleSave();
      return;
    }
    if (
      el.type === "range" &&
      (el.dataset.scope || "").startsWith("pedestal-") &&
      ["x", "z"].includes(el.dataset.field)
    ) {
      ctx.pedestalGesture = false;
      refreshScene();
      scheduleSave();
      return;
    }
    if (el.id === "art-scale") {
      ctx.scaleGesture = false;
      scheduleSave();
      return;
    }
    // A drawn shadow's slider or typed number: the input handler already
    // made the change live and took its checkpoint.
    if (el.dataset.fxLive !== undefined) {
      setShadowLive(el.dataset.scope, el.dataset.field, el.value, el);
      endShadowGesture();
      syncShadowInputs();
      return;
    }
    // The work's own position sliders: the move already happened live, so
    // this closes the gesture out and saves it, exactly as a panel's does.
    if (el.type === "range" && el.dataset.scope === "art-position") {
      ctx.artGesture = false;
      scheduleSave();
      return;
    }
    // A figure's sliders, the same way: the scene is already up to date, so
    // this only ends the gesture and redraws the panel's own readouts.
    if (el.type === "range" && el.dataset.scope?.startsWith("person-")) {
      ctx.personGesture = false;
      renderInspector();
      scheduleSave();
      return;
    }
    if (el.id === "project-name") {
      mutate(() => (ctx.p.name = el.value.trim() || "Untitled booth"));
      return;
    }
    if (el.id === "furniture-kind") {
      if (FURNITURE[el.value]) ctx.furnitureChoice = el.value;
      renderInspector();
      return;
    }
    if (el.id === "quality" || el.id === "quality-quick") {
      ctx.quality = el.value === AUTO_QUALITY ? AUTO_QUALITY : +el.value;
      // Choosing Auto again starts it over from the top, so a machine that
      // has since been freed up gets to measure its way back to sharp.
      if (ctx.quality === AUTO_QUALITY) ctx.autoScale = null;
      ctx.scene?.setQuality(ctx.quality, ctx.quality === AUTO_QUALITY ? startScale(devicePixelRatio) : undefined);
      ctx.scene?.resize();
      saveViewPrefs();
      syncQuality();
      return;
    }
    // Video settings are view state, not project state: they are not saved
    // with the booth and do not belong in the undo history.
    // The batch queue's settings. Saved with the project, outside the undo
    // history: see setKit.
    if (el.dataset.kitDefault) {
      const k = kit();
      const key = el.dataset.kitDefault;
      setKit({ ...k, defaults: { ...k.defaults, ...cleanSettings({ [key]: key === "settle" ? el.checked : el.value }) } });
      return;
    }
    if (el.dataset.jobSet || el.dataset.jobMove !== undefined || el.dataset.jobName !== undefined) {
      const k = kit();
      const id = el.closest("[data-job]")?.dataset.job;
      const job = k.queue.find((j) => j.id === id);
      if (!job) return;
      let next = job;
      if (el.dataset.jobSet) next = tweak(job, el.dataset.jobSet, el.value === "" ? undefined : el.value);
      else if (el.dataset.jobName !== undefined) next = { ...job, name: el.value.trim().slice(0, 120) || undefined };
      else if (el.value.startsWith("preset:")) next = { ...job, move: KIT_CUSTOM, preset: el.value.slice(7) };
      else if (el.value === "own") next = { ...job, move: KIT_CUSTOM, preset: undefined };
      else if (MOVES[el.value]) next = { ...job, move: el.value, preset: undefined, seconds: job.move === el.value ? job.seconds : resolveMove(el.value).seconds };
      setKit({ ...k, queue: k.queue.map((j) => (j.id === id ? next : j)) });
      return;
    }
    if (el.id === "timeline-frame-keys") {
      const tl = timeline();
      // On: every keyframe starts from the frame as it is now, and is then
      // its own. Off: the keyframes' frames are dropped and the Video tab's
      // placement holds for the whole clip.
      const keys = el.checked ? tl.keys.map((k) => ({ ...k, place: { ...ctx.framePlace.video } })) : tl.keys;
      ctx.videoTimeline = normalizeTimeline({ ...tl, keys, frameKeys: el.checked });
      ctx.livePlace = null;
      placeSettled();
      return;
    }
    if (el.id === "timeline-seconds") {
      ctx.videoTimeline = normalizeTimeline({ ...timeline(), seconds: +el.value });
      renderTimelineDialog();
      return;
    }
    if (el.id === "timeline-fade-in" || el.id === "timeline-fade-out") {
      const tl = timeline();
      const fade = { ...tl.fade, [el.id === "timeline-fade-in" ? "in" : "out"]: +el.value };
      ctx.videoTimeline = normalizeTimeline({ ...tl, fade });
      renderTimelineDialog();
      return;
    }
    if (el.id === "timeline-flow") {
      ctx.videoTimeline = normalizeTimeline({ ...timeline(), flow: el.value });
      renderTimelineDialog();
      return;
    }
    if (el.id === "timeline-flare") {
      const tl = timeline();
      ctx.videoTimeline = normalizeTimeline({ ...tl, flare: { ...tl.flare, on: el.checked } });
      renderTimelineDialog();
      return;
    }
    if (el.id === "timeline-flare-source") {
      const tl = timeline();
      ctx.videoTimeline = normalizeTimeline({ ...tl, flare: { ...tl.flare, source: el.value } });
      renderTimelineDialog();
      return;
    }
    if (el.dataset.keyField) {
      const tl = timeline();
      const keys = tl.keys.map((k) => {
        if (k.id !== el.dataset.key) return k;
        // Times are entered in seconds — the unit on screen — and stored as a
        // fraction of the clip, so changing the clip length moves the keys with
        // it rather than stranding them past the end.
        if (el.dataset.keyField === "t") return { ...k, t: keyTAt(tl, tl.keys.indexOf(k), +el.value) };
        if (el.dataset.keyField === "hold") return { ...k, hold: +el.value };
        return { ...k, ease: el.value };
      });
      ctx.videoTimeline = normalizeTimeline({ ...tl, keys });
      // The playhead goes with a retimed key, as it does when one is dragged,
      // so the previous / next arrows count from where the key now is.
      if (el.dataset.keyField === "t") {
        const i = ctx.videoTimeline.keys.findIndex((k) => k.id === el.dataset.key);
        if (i >= 0) ctx.tlPlayhead = keySchedule(ctx.videoTimeline)[i].arrive;
      }
      renderTimelineDialog();
      return;
    }
    if (el.id === "video-move") {
      ctx.videoMove = el.value;
      // Each move has a length it was designed around, so choosing a move
      // proposes its own length rather than keeping the last one. A custom
      // timeline carries its own, set in the dialog.
      ctx.videoSeconds = ctx.videoMove === CUSTOM_MOVE ? timelineSeconds(timeline()) : resolveMove(ctx.videoMove).seconds;
      renderInspector();
      return;
    }
    if (el.id === "video-seconds") {
      ctx.videoSeconds = +el.value;
      return;
    }
    // Both of these change the H.264 level, so the codec is re-probed and the
    // panel re-rendered once the browser has answered.
    if (el.id === "video-fps") {
      ctx.videoFps = +el.value;
      probeCodec();
      return;
    }
    if (el.id === "export-size") {
      const value = Number(el.value);
      if (STILL_SIZES.includes(value)) ctx.exportLong = value;
      saveViewPrefs();
      renderInspector();
      return;
    }
    if (el.id === "video-size") {
      ctx.videoSize = el.value;
      probeCodec();
      renderInspector();
      return;
    }
    // The frame, the custom pixel size and careful rendering. All three are
    // view settings: they say what the delivered file is, never what the
    // booth is, so none of them goes through `mutate` or marks anything dirty.
    if (el.dataset.frame) {
      const value = FRAMES[el.value] ? el.value : DEFAULT_FRAME;
      if (el.dataset.frame === "video") ctx.videoFrameShape = value;
      else ctx.exportFrame = value;
      saveViewPrefs();
      refreshPanels();
      return;
    }
    if (el.dataset.framePlace) {
      saveViewPrefs();
      placeSettled();
      return;
    }
    if (el.dataset.frameCustom) {
      const side = Math.max(FRAME_MIN, Math.min(FRAME_MAX, Math.round(Number(el.value) || 0)));
      ctx.customFrame = { ...ctx.customFrame, [el.dataset.frameCustom]: side };
      saveViewPrefs();
      refreshPanels();
      return;
    }
    if (el.dataset.videoSettle !== undefined) {
      ctx.videoSettle = el.checked;
      saveViewPrefs();
      renderInspector();
      return;
    }
    // Fast edit is not a field: it is a view setting with no home in the
    // project, so it never reaches `mutate` and never marks anything dirty.
    if (el.dataset.draft !== undefined) {
      setDraft(el.checked);
      return;
    }
    if (el.id === "power-outlets") {
      ctx.powerOutlets = Math.max(0, Math.min(20, Math.round(Number(el.value) || 0)));
      renderInspector();
      return;
    }
    if (el.dataset.tag !== undefined) {
      if (el.checked) ctx.hiddenTags.delete(el.dataset.tag);
      else ctx.hiddenTags.add(el.dataset.tag);
      ctx.scene?.setHiddenTags(ctx.hiddenTags);
      return;
    }
    if (el.dataset.viewName !== undefined) {
      const name = el.value.trim().slice(0, 120);
      if (name) mutate(() => (ctx.p.views = (ctx.p.views || []).map((v) => (v.id === el.dataset.viewName ? { ...v, name } : v))));
      else renderInspector();
      return;
    }
    if (el.id === "saved-view") {
      if (el.value) goToView(el.value);
      el.value = "";
      return;
    }
    if (el.dataset.tier !== undefined) {
      setTier(el.value);
      return;
    }
    if (el.dataset.draftPolicy !== undefined) {
      setDraftPolicy(el.value);
      return;
    }
    // Which booth of the row the next original is hung in. A view setting too:
    // it is where the next tap lands, not anything about the booth.
    if (el.dataset.rowActive !== undefined) {
      const row = normalizeRow(ctx.p.booth);
      ctx.activeBooth = el.value === row.home ? null : el.value;
      renderInspector();
      renderStatus();
      return;
    }
    if (!el.dataset.field) return;
    const key = el.dataset.field,
      scope = el.dataset.scope;
    if (el.type === "number" && !el.checkValidity()) {
      toast("Enter a value within the displayed range.", true);
      renderInspector();
      return;
    }
    // A slider may show a scale of its own rather than the stored unit —
    // Fixture brightness is a percentage of a bar that reads right, where the
    // stored unit is a light's power and always will be. `data-scale` is how
    // many stored units one point of the slider is worth, so this is the one
    // place the two meet and everything past it sees the stored number.
    const scale = Number(el.dataset.scale) || 1;
    const value =
      el.type === "checkbox"
        ? el.checked
        : ["number", "range"].includes(el.type)
          ? Number(el.value) * scale
          : el.value;
    mutate(() => {
      // Switching venue rewrites the footprint, the walls and the finish
      // together: half an art-show booth — 12ft walls under a canopy — is not
      // a booth anyone is planning.
      // The row: the gap between slots, and a space's own width. Both rewrite
      // the whole row record, because a row is one value and normalizing it
      // is what guarantees a home booth is still in it.
      if (scope === "row" && key === "gap") {
        ctx.p.booth.row = { ...normalizeRow(ctx.p.booth), gap: Math.max(0, Math.min(MAX_GAP, Number(value))) };
        return;
      }
      if (String(scope).startsWith("space-") && key === "width") {
        ctx.p.booth.row = setSpaceWidth(ctx.p.booth, String(scope).slice(6), Number(value));
        return;
      }
      if (scope === "booth" && key === "venue") {
        applyVenue(ctx.p, String(value));
        ctx.selectedPanel = null;
        ctx.selectedPedestal = null;
        ctx.scene?.setView("perspective");
        toast(
          value === "artshow"
            ? "Art-show booth: 144″ back wall, 120″ sides, seamless white, nine-head light bar."
            : "Outdoor pop-up booth restored.",
        );
        return;
      }
      // The one place a floor is chosen, so the picker and the preset it
      // remembers cannot disagree.
      if (scope === "booth" && key === "ground") {
        selectGround(ctx.p, String(value));
        return;
      }
      if (key === "preset") {
        ctx.p.booth.width = +value;
        ctx.p.booth.depth = 120;
        ctx.p.booth.walls.back.width = +value;
        ctx.scene?.setView("perspective");
        return;
      }
      if (scope === "corner") {
        const layer = ctx.p.photo.layers.find((l) => l.id === ctx.photoSelected),
          q = structuredClone(layer.corners),
          [i, j] = key.split("-").map(Number);
        q[i][j] = value / 100;
        if (convex(q)) layer.corners = q;
        else toast("Keep corners in order without crossing edges.", true);
        return;
      }
      const a = ctx.p.art.find((a) => a.id === ctx.selected);
      // Moving a work from one booth of the row to another. The walls are the
      // same measurements in every booth, so it keeps its wall, its face and
      // its position on that wall — only which booth is drawing it changes.
      if (scope === "art" && key === "inBooth" && a) {
        const home = normalizeRow(ctx.p.booth).home;
        a.booth = String(value) === home ? undefined : String(value);
        ctx.activeBooth = a.booth || null;
        return;
      }
      if (scope === "art" && key === "location" && a) {
        const raw = String(value),
          cut = raw.lastIndexOf("-"),
          wall = raw.slice(0, cut),
          face = raw.slice(cut + 1);
        const currentFace = a.face || "inside";
        let x = a.x;
        if (currentFace !== face) x = (wallSpec(ctx.p, wall)?.width ?? a.x + a.w) - a.x - a.w;
        Object.assign(a, constrain(ctx.p, {...a, wall, face, x}));
        return;
      }
      const target = fieldTarget(scope, a);
      // The colour this control held before the one it is about to hold, for
      // the Previous button beside it, and the edge finish the next work
      // inherits. Both are per browser and neither is part of the edit.
      if (target && el.type === "color") ctx.colorHistory = rememberColor(ctx.colorHistory, `${scope}|${key}`, target[key]);
      if (target) target[key] = value;
      if (scope === "art" && ["edgeColor", "edgeTexture", "thickness"].includes(key)) rememberEdge(target);
      if (el.type === "color" || scope === "art") saveViewPrefs();
      // A preset carries a matching floor and horizon; the user can still
      // override either afterwards, and that choice is not overwritten until
      // the preset itself changes again.
      if (scope === "booth" && key === "envPreset") {
        // The preset's floor and horizon come with it, and an art-show booth
        // in a photographed environment leaves its white hall, whose back
        // wall would cut across the photograph as a white band. The rule is
        // applyEnvPreset in src/polish.js, which the looks follow too; its
        // comment says why each part is so. The test there is whether the
        // preset shows a photograph, not which preset it is: this once read
        // `value !== "studio"`, and switched off a white hall's own hall.
        if (applyEnvPreset(ctx.p, value).hallOff) toast(HALL_OFF_NOTE);
      }
      // Use Global Light: switched on, the shadow takes the shared angle;
      // switched off, it keeps that angle as its own — Photoshop's rule. The
      // record was written back resolved, so both already hold.
      if (SHADOW_KINDS.some((kind) => SHADOW_FIELD[kind] === scope) && key === "global" && value)
        target.angle = globalAngle(ctx.p.booth);
      if (scope === "booth" && key === "tentStyle") ctx.p.booth.tent = true;
      if (scope === "booth" && key === "height")
        Object.values(ctx.p.booth.walls).forEach((w) => (w.height = value));
      // A typed footprint is the art-show tool's "custom booth dimensions".
      // A wall may be narrower than the side it stands on, but never wider:
      // the schema says so and a wall poking out of the booth is not a plan.
      if (scope === "booth" && (key === "width" || key === "depth")) {
        for (const wall of key === "width" ? ["back"] : ["left", "right"])
          ctx.p.booth.walls[wall].width = Math.max(
            12,
            Math.min(ctx.p.booth.walls[wall].width, value),
          );
        ctx.p.art = ctx.p.art.map((a) => constrain(ctx.p, a));
        ctx.p.booth.panels = boothPanels(ctx.p).map((panel) => constrainPanel(ctx.p, panel));
        ctx.p.booth.pedestals = boothPedestals(ctx.p).map((ped) => constrainPedestal(ctx.p, ped));
      }
      // A hall has at most MAX_HALL_BOOTHS booths: whichever of rows and
      // booths per row was just typed wins, and the other gives way.
      if (scope === "hallplan" && (key === "rows" || key === "perRow")) {
        const other = key === "rows" ? "perRow" : "rows";
        ctx.p.hall[other] = Math.min(ctx.p.hall[other], Math.floor(MAX_HALL_BOOTHS / ctx.p.hall[key]));
      }
      // The panel module is what the walls are rebuilt from, and a linked
      // booth rebuilds as it is typed rather than waiting for the button.
      if (scope === "artShow" && ctx.p.booth.artShow.linked) relinkArtShowWalls(ctx.p);
    });
  });
  document.addEventListener("input", (ev) => {
    // The frame's size and position sliders: live on the guide, saved on change.
    if (ev.target.dataset?.framePlace) {
      const which = ev.target.dataset.frameWhich === "export" ? "export" : "video";
      const key = ev.target.dataset.framePlace;
      const v = Number(ev.target.value) / 100;
      setPlace(which, normalPlace({ ...getPlace(which), [key]: v }));
      // The same slider can be in the Video tab and in the timeline at once;
      // both follow.
      document.querySelectorAll(`[data-frame-place="${key}"][data-frame-which="${which}"]`).forEach((input) => {
        if (input !== ev.target) input.value = ev.target.value;
        input.closest("label")?.querySelector("output")?.replaceChildren(`${Math.round(Number(ev.target.value))}%`);
      });
      updateFrameGuide();
      return;
    }
    if (ev.target.dataset?.fxLive !== undefined) {
      setShadowLive(ev.target.dataset.scope, ev.target.dataset.field, ev.target.value, ev.target);
      return;
    }
    if (ev.target.id === "art-scale") {
      const a = currentArtwork();
      if (!a || ctx.scaleBase?.id !== a.id) return;
      if (!ctx.scaleGesture) { checkpoint(); ctx.scaleGesture = true; }
      const next = scalePanel(ctx.p, ctx.scaleBase, Number(ev.target.value) / 100);
      Object.assign(a, next);
      ctx.scene?.updateArtwork(a);
      ev.target.closest("label").querySelector("output").textContent = Math.round(a.w / ctx.scaleBase.w * 100) + "%";
      for (const key of ["w", "h", "x", "y"]) {
        const input = document.querySelector('[data-scope="art"][data-field="' + key + '"]');
        if (input) input.value = Number(a[key].toFixed(3));
      }
      return;
    }
    // A position slider for the selected work: the same edit as typing into
    // the field beside it, through the same constraint, and moved with
    // updateArtwork rather than a rebuild.
    if (ev.target.type === "range" && ev.target.dataset.scope === "art-position") {
      const a = currentArtwork();
      if (!a) return;
      if (!ctx.artGesture) { checkpoint(); ctx.artGesture = true; }
      Object.assign(a, constrain(ctx.p, { ...a, [ev.target.dataset.field]: Number(ev.target.value) }));
      ctx.scene?.updateArtwork(a);
      syncArtInputs(a, ev.target);
      ev.target
        .closest("label")
        ?.querySelector("output")
        ?.replaceChildren(Number(a[ev.target.dataset.field].toFixed(2)) + "in");
      return;
    }
    // A figure's placement and height sliders. Same deal as the artwork's:
    // one checkpoint for the whole gesture, and `movePerson` restands the
    // figure rather than disposing and rebuilding the booth per pixel.
    if (ev.target.type === "range" && ev.target.dataset.scope?.startsWith("person-")) {
      const id = ev.target.dataset.scope.slice(7);
      const person = (ctx.p.booth.people || []).find((x) => x.id === id);
      if (!person) return;
      if (!ctx.personGesture) { checkpoint(); ctx.personGesture = true; }
      const key = ev.target.dataset.field;
      ctx.scene?.movePerson({ ...person, [key]: Number(ev.target.value) });
      // The typed field beside the slider, and the slider's own readout.
      // `.value`, not setAttribute: the attribute is the initial value and an
      // input the user has already touched ignores it.
      const typed = document.querySelector(
        `input[type="number"][data-field="${key}"][data-scope="person-${CSS.escape(id)}"]`,
      );
      if (typed) typed.value = String(Number(ev.target.value));
      ev.target
        .closest("label")
        ?.querySelector("output")
        ?.replaceChildren(Number(ev.target.value) + "in");
      return;
    }
    // A position slider for a free-standing wall. Handled live, and entirely
    // here: one checkpoint at the start of the gesture rather than one per
    // pixel, and the scene restands the panel without a rebuild — the same
    // deal the artwork scale slider gets, for the same reason.
    const panelScope = ev.target.dataset.scope || "";
    if (
      ev.target.type === "range" &&
      panelScope.startsWith("panel-") &&
      ["x", "z"].includes(ev.target.dataset.field)
    ) {
      const panel = findPanel(ctx.p, panelKey(panelScope.slice(6)));
      if (!panel) return;
      if (!ctx.panelGesture) { checkpoint(); ctx.panelGesture = true; }
      panel[ev.target.dataset.field] = Number(ev.target.value);
      ctx.scene?.movePanel({ ...panel });
      syncPanelInputs(panel, ev.target);
      ev.target
        .closest("label")
        ?.querySelector("output")
        ?.replaceChildren(Number(panel[ev.target.dataset.field].toFixed(2)) + "in");
      return;
    }
    const pedScope = ev.target.dataset.scope || "";
    if (
      ev.target.type === "range" &&
      pedScope.startsWith("pedestal-") &&
      ["x", "z"].includes(ev.target.dataset.field)
    ) {
      const ped = findPedestal(ctx.p, pedScope.slice(9));
      if (!ped) return;
      if (!ctx.pedestalGesture) { checkpoint(); ctx.pedestalGesture = true; }
      ped[ev.target.dataset.field] = Number(ev.target.value);
      ctx.scene?.movePedestal({ ...ped });
      syncPedestalInputs(ped, ev.target);
      ev.target
        .closest("label")
        ?.querySelector("output")
        ?.replaceChildren(Number(ped[ev.target.dataset.field].toFixed(2)) + "in");
      return;
    }
    if (ev.target.dataset.scope === "timeline" && ev.target.dataset.field === "flare-strength") {
      const tl = timeline();
      ctx.videoTimeline = { ...tl, flare: { ...tl.flare, strength: Number(ev.target.value) / 100 } };
      ev.target.closest("label")?.querySelector("output")?.replaceChildren(ev.target.value + "%");
      return;
    }
    if (ev.target.dataset.edit) {
      const a = currentArtwork();
      if (!ctx.editingStart || !a?.asset) return;
      a.edits = normalizeImageEdits(a.edits);
      a.edits[ev.target.dataset.edit] = Number(ev.target.value);
      ev.target.closest("label")?.querySelector("output")?.replaceChildren(ev.target.value);
      ctx.scheduleEditedPreview();
      return;
    }
    if (ev.target.id === "search") {
      ctx.search = ev.target.value;
      const pos = ev.target.selectionStart;
      renderLibrary();
      const s = document.querySelector("#search");
      s.focus();
      s.setSelectionRange(pos, pos);
      refreshIcons();
    }
    if (ev.target.type === "range")
      ev.target.closest("label").querySelector("output").textContent =
        ev.target.value;
  });
  // A shape in the show floor's library: pressed, it is dragged onto the
  // floor or, tapped, dropped in the middle of the view.
  document.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest?.("[data-show-shape]");
    if (!b || !ctx.showEditor || ev.button > 0) return;
    const shape = SHAPES.find((sh) => sh.key === b.dataset.showShape);
    if (shape) ctx.showEditor.libraryPress(ev, shape);
  });
  // Photoshop's angle dial: press anywhere on it and drag round. The angle
  // is where the light comes from, so the line points at the pointer.
  document.addEventListener("pointerdown", (ev) => {
    const dial = ev.target.closest?.("[data-dial]");
    if (!dial || ev.button !== 0) return;
    ev.preventDefault();
    dial.focus();
    const scope = dial.dataset.dial;
    const aim = (e2) => {
      const r = dial.getBoundingClientRect();
      const deg = Math.atan2(r.top + r.height / 2 - e2.clientY, e2.clientX - (r.left + r.width / 2)) * (180 / Math.PI);
      setShadowLive(scope, "angle", Math.round(deg));
    };
    const done = () => {
      dial.removeEventListener("pointermove", aim);
      dial.removeEventListener("pointerup", done);
      dial.removeEventListener("pointercancel", done);
      endShadowGesture();
    };
    dial.setPointerCapture?.(ev.pointerId);
    dial.addEventListener("pointermove", aim);
    dial.addEventListener("pointerup", done);
    dial.addEventListener("pointercancel", done);
    aim(ev);
  });
}
