// The batch queue in the Video tab: clips and stills rendered in one go, each
// with the general export settings or its own (src/batch.js is the model),
// its folding sections, and the panel's settings as a job. The render loop
// itself, runClips, stays in main.js for now. Moved out of src/main.js's
// boot() as it was (MAIN_SPLIT_PHASE.md, seam 5): `ctx` is boot's state, read
// through it, and the helpers this calls.
import { escapeHTML as e, uid } from "../model.js";
import { MOVES, CUSTOM_MOVE, resolveMove } from "../camera-path.js";
import { normalKit, cleanSettings, resolveJob, overridden, MAX_JOBS, CUSTOM as KIT_CUSTOM } from "../batch.js";
import { SIZES, FPS, videoSupported } from "../video.js";
import { FRAMES, DEFAULT_FRAME, STILL_SIZES } from "../framing.js";

export function createBatch(ctx) {
  const { btn, progressHTML, renderInspector, renderTimelineDialog, scheduleSave, timeline, timelineOpen, toast } = ctx;
  // The batch list. A clip is queued with a copy of the settings it was queued
  // with — including a snapshot of the timeline where the move is Custom —
  // because the point of a batch is to compose four different shots and then
  // walk away, and settings that followed the panel would render the last one
  // four times.
  // The batch queue: clips and stills rendered in one go, each with the
  // general export settings or its own. See src/batch.js for the model. It
  // is saved with the project (so it survives a reload and travels in a
  // backup) but it is not the booth, so an edit to it is saved without an
  // undo step and an undo leaves it alone.
  const kit = () => normalKit(ctx.p.exportKit);
  function setKit(next) {
    ctx.p.exportKit = { defaults: next.defaults, presets: next.presets, queue: next.queue };
    scheduleSave();
    refreshPanels();
  }
  // Which of the batch's folding sections are open. The panel is redrawn on
  // every change, and a tweak panel that folded shut each time one of its
  // menus was used would be unusable.
  const openFolds = new Set();
  const fold = (id, fallback = false) => ((openFolds.has(id) || (fallback && !openFolds.has(`-${id}`))) ? " open" : "");
  const remember = (id, open) => {
    openFolds.delete(open ? `-${id}` : id);
    openFolds.add(open ? id : `-${id}`);
  };
  // Both: the click, because a redraw can land before the browser's queued
  // toggle event does and the new state would be lost with the old element;
  // the toggle, for anything that opens a section some other way.
  document.addEventListener(
    "click",
    (ev) => {
      const summary = ev.target?.closest?.("summary");
      const details = summary?.parentElement;
      if (details?.dataset?.fold) remember(details.dataset.fold, !details.open);
    },
    true,
  );
  document.addEventListener(
    "toggle",
    (ev) => {
      if (ev.target?.dataset?.fold && ev.target.isConnected) remember(ev.target.dataset.fold, ev.target.open);
    },
    true,
  );
  function addJobs(jobs) {
    if (!ctx.scene) return toast("3D is not available, so there is nothing to export.", true);
    const k = kit();
    if (k.queue.length + jobs.length > MAX_JOBS) return toast(`${MAX_JOBS} items is the limit for one batch.`, true);
    setKit({ ...k, queue: [...k.queue, ...jobs] });
    toast(jobs.length === 1 ? `Queued ${batchLabel(jobs[0], kit())}.` : `Queued ${jobs.length} items.`);
  }
  /** The Video tab and, when it is open, the timeline, which share controls. */
  function refreshPanels() {
    renderInspector();
    if (timelineOpen()) renderTimelineDialog();
  }
  const shortFrame = (id) => FRAMES[id]?.label.split(" · ").at(-1) || id;
  const shortSize = (size) => SIZES[size]?.label.split(" · ")[0] || size;
  function batchLabel(job, k = kit()) {
    const r = resolveJob(job, k);
    const frame = r.frame && r.frame !== DEFAULT_FRAME ? ` · ${shortFrame(r.frame)}` : "";
    if (r.kind === "still") return `${job.name ? `${job.name} · ` : ""}Still · ${r.long} px${frame}`;
    const preset = job.preset && k.presets.find((x) => x.id === job.preset);
    const move = preset ? `Preset “${preset.name}”` : job.move === KIT_CUSTOM ? "Custom timeline" : resolveMove(job.move).label;
    return `${job.name ? `${job.name} · ` : ""}${move} · ${r.seconds}s · ${r.fps} fps · ${shortSize(r.size)}${frame}`;
  }
  /** Everything the Video tab is set to now, as batch settings. */
  const panelSettings = () =>
    cleanSettings({ fps: ctx.videoFps, size: ctx.videoSize, long: ctx.exportLong, frame: ctx.videoFrameShape, custom: ctx.customFrame, place: ctx.framePlace.video, settle: ctx.videoSettle });
  /**
   * A clip from what the panel is set to. `frozen` keeps every setting as it
   * is now — "add each one individually" — and otherwise the clip follows
   * the general settings until one of its own is tweaked. A Custom move
   * carries a frozen copy of the timeline, so the next keyframe someone adds
   * does not quietly rewrite a queued clip.
   */
  function clipJob(frozen) {
    const custom = ctx.videoMove === CUSTOM_MOVE;
    return {
      id: uid(),
      kind: "clip",
      move: custom ? KIT_CUSTOM : ctx.videoMove,
      seconds: custom ? timeline().seconds : ctx.videoSeconds,
      ...(custom ? { timeline: structuredClone(timeline()) } : {}),
      set: frozen ? panelSettings() : {},
    };
  }
  function stillJob(frozen, pose = ctx.scene?.pose(), set) {
    return {
      id: uid(),
      kind: "still",
      pose: { position: [...pose.position], target: [...pose.target] },
      set: set || (frozen ? cleanSettings({ long: ctx.exportLong, frame: ctx.exportFrame, custom: ctx.customFrame, place: ctx.framePlace.export }) : {}),
    };
  }
  function kitSelect(key, value, options, attrs, general) {
    const opts = [
      general !== undefined ? `<option value="" ${value === undefined ? "selected" : ""}>General · ${e(general)}</option>` : "",
      ...options.map(([v, label]) => `<option value="${e(String(v))}" ${value !== undefined && String(value) === String(v) ? "selected" : ""}>${e(label)}</option>`),
    ].join("");
    return `<select ${attrs}>${opts}</select>`;
  }
  const FPS_OPTIONS = FPS.map((f) => [f, `${f} fps`]);
  const SIZE_OPTIONS = Object.keys(SIZES).map((k) => [k, shortSize(k)]);
  const LONG_OPTIONS = STILL_SIZES.map((n) => [n, `${n} px`]);
  const FRAME_OPTIONS = Object.keys(FRAMES).map((k) => [k, FRAMES[k].label]);
  function generalSettingsHTML(k) {
    const d = k.defaults;
    const field = (label, key, options) =>
      `<label class="setting-label">${label}${kitSelect(key, d[key], options, `data-kit-default="${key}" aria-label="General ${label.toLowerCase()}"`)}</label>`;
    const placed = d.place.scale !== 1 || d.place.x !== 0 || d.place.y !== 0;
    return `<details class="batch-general" data-fold="general"${fold("general")}><summary>General export settings</summary><p class="muted">What every item uses unless it has its own. Change one here and every item still on the general setting follows.</p><div class="field-pair">${field("Frame rate", "fps", FPS_OPTIONS)}${field("Clip size", "size", SIZE_OPTIONS)}</div><div class="field-pair">${field("Still size", "long", LONG_OPTIONS)}${field("Frame", "frame", FRAME_OPTIONS)}</div><p class="muted">Frame ${d.frame === "custom" ? `${d.custom.width} × ${d.custom.height}` : e(shortFrame(d.frame))}${placed ? `, placed at ${Math.round(d.place.scale * 100)}% size` : ", centred at full size"}.</p>${btn("kit-take-frame", "Use the Video tab's frame and placement", "crop", "wide")}<label class="check-field"><input type="checkbox" data-kit-default="settle" ${d.settle ? "checked" : ""}/>Careful rendering</label></details>`;
  }
  function presetsHTML(k) {
    const rows = k.presets
      .map(
        (x) =>
          `<div class="batch-row preset-row" data-preset="${x.id}"><div class="key-head"><strong>${e(x.name)}</strong><span class="muted">${x.timeline.keys.length} keyframes · ${x.timeline.seconds}s · ${k.queue.filter((j) => j.preset === x.id).length} using it</span></div><div class="button-row">${btn("preset-load", "Load into timeline", "folder-open")}${btn("preset-overwrite", "Save the timeline over it", "save")}${btn("preset-apply", "Use for every clip", "copy")}${btn("preset-delete", "Delete", "trash-2")}</div></div>`,
      )
      .join("");
    return `<details class="batch-presets" data-fold="presets"${fold("presets", true)}><summary>Timeline presets <span>${k.presets.length}</span></summary><p class="muted">A saved timeline. Clips that use one follow it, so one move can go out as a 16:9, a 9:16 and a square — and every later change to the preset reaches all of them.</p><div class="preset-new"><input type="text" data-preset-name maxlength="120" placeholder="Preset name" aria-label="New preset name"/>${btn("preset-save", "Save timeline as preset", "save")}</div>${rows}</details>`;
  }
  function jobRow(job, i, k) {
    const state = ctx.busyVideo && ctx.videoBatchAt === i ? "Rendering…" : ctx.busyVideo && ctx.videoBatchAt > i ? "Done" : "Queued";
    const d = k.defaults;
    const own = (key) => (overridden(job, key) ? job.set[key] : undefined);
    const tweakSel = (key, label, options, general) =>
      `<label class="setting-label">${label}${kitSelect(key, own(key), options, `data-job-set="${key}" aria-label="${label} for item ${i + 1}"`, general)}</label>`;
    let what = "";
    if (job.kind === "clip") {
      const moves = [
        ...Object.entries(MOVES).map(([id, v]) => [id, v.label]),
        ...(job.timeline ? [["own", "Its own timeline"]] : []),
        ...k.presets.map((x) => [`preset:${x.id}`, `Preset · ${x.name}`]),
      ];
      const value = job.preset ? `preset:${job.preset}` : job.move === KIT_CUSTOM ? "own" : job.move;
      what = `<label class="setting-label">Move${kitSelect("move", value, moves, `data-job-move aria-label="Move for item ${i + 1}"`)}</label><div class="field-pair">${tweakSel("fps", "Frame rate", FPS_OPTIONS, `${d.fps} fps`)}${tweakSel("size", "Size", SIZE_OPTIONS, shortSize(d.size))}</div>`;
    } else what = `<div class="field-pair">${tweakSel("long", "Size", LONG_OPTIONS, `${d.long} px`)}</div>`;
    const framed = overridden(job, "frame") || overridden(job, "place");
    const frame = `${tweakSel("frame", "Frame", FRAME_OPTIONS, shortFrame(d.frame))}<div class="button-row">${btn("job-take-frame", job.kind === "still" ? "Use the Export tab's frame here" : "Use the Video tab's frame here", "crop")}${framed ? btn("job-general-frame", "Frame: back to general", "rotate-ccw") : ""}</div>`;
    const actions = `${job.kind === "clip" ? btn("batch-use", "Load these settings", "rotate-ccw") : btn("job-show", "Show this view", "camera")}${ctx.busyVideo ? "" : `${i > 0 ? btn("job-up", "Move up", "arrow-up", "icon-only") : ""}${btn("batch-remove", "Remove", "trash-2")}`}`;
    return `<div class="batch-row" data-job="${job.id}"><div class="key-head"><strong>${i + 1}. ${e(batchLabel(job, k))}</strong><span class="muted">${state}</span></div><details class="job-tweak" data-fold="job-${job.id}"${fold(`job-${job.id}`)}><summary>Tweak${Object.keys(job.set).length ? ` · ${Object.keys(job.set).length} own` : " · general"}</summary><label class="setting-label">Name<input type="text" data-job-name maxlength="120" value="${e(job.name || "")}" placeholder="Used in the file name" aria-label="Name for item ${i + 1}"/></label>${what}${frame}${Object.keys(job.set).length ? btn("job-general", "Use the general settings for all of it", "rotate-ccw", "wide") : ""}</details><div class="button-row">${actions}</div></div>`;
  }
  function batchSection() {
    if (!videoSupported()) return "";
    const k = kit();
    const n = k.queue.length;
    const clips = k.queue.filter((j) => j.kind === "clip").length;
    const rows = k.queue.map((job, i) => jobRow(job, i, k)).join("");
    const custom = ctx.videoMove === CUSTOM_MOVE;
    return `<section class="batch"><h3>Batch export <span>${n} ${n === 1 ? "item" : "items"}</span></h3><p class="muted">Queue clips and stills and render them in one go. Add each exactly as it is set now, or add it on the general settings and tweak it in the list. They render in order and download as they finish; the list is saved with the booth.</p>${generalSettingsHTML(k)}${presetsHTML(k)}<h4>Add to the batch</h4><div class="button-row">${btn("batch-add", "Clip · as set now", "plus")}${btn("batch-add-general", "Clip · general settings", "plus")}</div><div class="button-row">${btn("batch-add-still", "Still · as set now", "image-plus")}${btn("batch-add-still-general", "Still · general settings", "image-plus")}</div>${btn("batch-add-autopan", "Auto pan from this view", "plus", "wide")}${custom ? btn("batch-add-key-stills", "A still of every keyframe", "images", "wide") : ""}${n && !ctx.busyVideo ? btn("batch-clear", "Clear list", "trash-2", "wide") : ""}${rows}${n ? (ctx.busyVideo ? btn("cancel-video", "Cancel", "x", "wide") : btn("batch-export", `Export all ${n}`, "download", "primary wide")) : ""}${n ? `<div class="video-progress" role="status" aria-live="polite">${ctx.busyVideo && ctx.videoBatchAt >= 0 ? progressHTML() : ""}</div><p class="muted">A batch renders every frame of every clip, so it takes as long as the clips add up to — several minutes for four 1080p moves. ${clips < n ? "Stills take a second or two each. " : ""}The camera comes back where you left it.</p>` : ""}</section>`;
  }

  // The panel's settings as a renderable clip, resolved the way a batch item is.
  function currentClip() {
    const job = clipJob(true);
    return { ...resolveJob(job, kit()), timeline: job.timeline || null };
  }
  return { kit, setKit, refreshPanels, batchSection, currentClip, addJobs, clipJob, stillJob };
}
