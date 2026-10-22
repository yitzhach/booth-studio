// The Video tab's actions: recording a clip and cancelling it, the timeline
// dialog's buttons and its preview, auto pan, the batch list and its saved
// presets, and putting a frame back where it was. Merged back into main.js's
// one action table with Object.assign. Moved out of src/main.js's boot() as
// it was (MAIN_SPLIT_PHASE.md, seam 13): `ctx` is boot's state, read and set
// through it, and the helpers these call.
import { CUSTOM_MOVE } from "../camera-path.js";
import { MAX_KEYS, MIN_KEYS, MIN_SECONDS, MAX_SECONDS, keyFrom, normalizeTimeline, keySchedule, easeFn, autoTime, neighbourKey, autoPanTimeline } from "../timeline.js";
import { cleanSettings, resolveJob, tweak, applyPreset, removePreset, MAX_PRESETS, CUSTOM as KIT_CUSTOM } from "../batch.js";
import { videoSupported } from "../video.js";
import { FRAMES, normalPlace, DEFAULT_PLACE } from "../framing.js";
import { uid } from "../model.js";

export function createVideoActions(ctx) {
  const { addJobs, clipJob, currentClip, currentPose, followPlayhead, getPlace, grabThumb, keyName, kit, placeSettled, probeCodec, refreshPanels, renderInspector, renderTimelineDialog, runClips, saveViewPrefs, setKit, setPlace, showKey, stillJob, syncAutoPan, timeline, timelineOpen, toast, updateFrameGuide } = ctx;
  return {
    "autopan-menu": () => {
      const menu = document.querySelector(".autopan-menu");
      if (!menu) return;
      menu.hidden = !menu.hidden;
      if (!menu.hidden) syncAutoPan();
    },
    "autopan-record": async () => {
      if (ctx.busy || ctx.busyVideo) return;
      if (!ctx.scene) return toast("3D is not available, so there is no view to record.", true);
      if (!videoSupported()) return toast("This browser cannot encode video. Chrome, Edge or Safari can.", true);
      ctx.scene.stopAutoPan();
      const a = ctx.autoPanSettings, want = a.dist / a.speed;
      const tl = autoPanTimeline(ctx.scene.pose(), ctx.scene.panRight(), a.dist * 12 * 0.0254, want, a.dir, a.ease);
      if (Math.abs(tl.seconds - want) > 0.05) toast(`A clip runs ${MIN_SECONDS}–${MAX_SECONDS} s, so this one is ${tl.seconds} s: the same ${+a.dist.toFixed(2)}′ at ${+(a.dist / tl.seconds).toFixed(2)} ft/s.`);
      await runClips([{ ...currentClip(), move: CUSTOM_MOVE, timeline: tl, seconds: tl.seconds, fileTag: "auto-pan" }]);
    },
    // The same pan, queued: a clip whose timeline is the pan from the view
    // now, frozen at the panel's settings like "Clip · as set now".
    "batch-add-autopan": () => {
      if (!ctx.scene) return toast("3D is not available, so there is no view to pan.", true);
      const a = ctx.autoPanSettings, want = a.dist / a.speed;
      const tl = autoPanTimeline(ctx.scene.pose(), ctx.scene.panRight(), a.dist * 12 * 0.0254, want, a.dir, a.ease);
      addJobs([{ ...clipJob(true), move: KIT_CUSTOM, timeline: tl, seconds: tl.seconds, name: `Auto pan · ${+a.dist.toFixed(2)}′ ${a.dir < 0 ? "right to left" : "left to right"}` }]);
      if (Math.abs(tl.seconds - want) > 0.05) toast(`Queued at ${tl.seconds} s: a clip runs ${MIN_SECONDS}–${MAX_SECONDS} s.`);
    },
    "autopan-go": () => {
      if (!ctx.scene) return toast("3D is not available, so there is no view to pan.", true);
      if (ctx.autoPanRunning) return ctx.scene.stopAutoPan();
      const a = ctx.autoPanSettings;
      ctx.autoPanRunning = true;
      syncAutoPan();
      ctx.scene.autoPan({ inches: a.dist * 12, seconds: a.dist / a.speed, dir: a.dir, ease: easeFn(a.ease) }, (finished) => {
        ctx.autoPanRunning = false;
        syncAutoPan();
        if (!finished) toast("Auto pan stopped.");
      });
    },
    "export-video": async () => {
      if (ctx.busy || ctx.busyVideo) return;
      if (!ctx.scene) return toast("3D is not available, so there is no view to record.", true);
      // One clip is a batch of one. Everything below it — the progress
      // reporting, the codec warning, the camera coming back — is the same
      // work either way, so it is written once.
      await runClips([currentClip()]);
    },
    "batch-add": () => addJobs([clipJob(true)]),
    "batch-add-general": () => addJobs([clipJob(false)]),
    "batch-add-still": () => addJobs([stillJob(true)]),
    "batch-add-still-general": () => addJobs([stillJob(false)]),
    // One still per keyframe, each from that keyframe's own view — and its
    // own frame, when the frame is keyframed.
    "batch-add-key-stills": () => {
      const tl = timeline();
      addJobs(
        tl.keys.map((k, i) => ({
          ...stillJob(false, k, k.place ? cleanSettings({ frame: ctx.videoFrameShape, custom: ctx.customFrame, place: k.place }) : {}),
          name: keyName(i, tl.keys.length),
        })),
      );
    },
    "batch-remove": (button) => {
      if (ctx.busyVideo) return;
      const id = button?.closest("[data-job]")?.dataset.job;
      const k = kit();
      setKit({ ...k, queue: k.queue.filter((job) => job.id !== id) });
    },
    "batch-clear": () => {
      if (ctx.busyVideo) return;
      setKit({ ...kit(), queue: [] });
    },
    "job-up": (button) => {
      if (ctx.busyVideo) return;
      const k = kit();
      const i = k.queue.findIndex((j) => j.id === button?.closest("[data-job]")?.dataset.job);
      if (i < 1) return;
      const queue = [...k.queue];
      [queue[i - 1], queue[i]] = [queue[i], queue[i - 1]];
      setKit({ ...k, queue });
    },
    // Puts a queued clip's settings back in the panel, which is how you check
    // what you queued — and how you edit a queued timeline: load it, change it,
    // remove the old row and add it again.
    "batch-use": (button) => {
      const k = kit();
      const job = k.queue.find((x) => x.id === button?.closest("[data-job]")?.dataset.job);
      if (!job || job.kind !== "clip") return;
      const r = resolveJob(job, k);
      ctx.videoMove = r.move;
      ctx.videoSeconds = r.seconds;
      ctx.videoFps = r.fps;
      ctx.videoSize = r.size;
      if (FRAMES[r.frame]) ctx.videoFrameShape = r.frame;
      ctx.framePlace.video = normalPlace(r.place);
      ctx.customFrame = { ...r.custom };
      ctx.videoSettle = r.settle;
      saveViewPrefs();
      if (r.timeline) ctx.videoTimeline = normalizeTimeline(structuredClone(r.timeline));
      probeCodec();
      refreshPanels();
      toast("Settings loaded into the panel.");
    },
    "job-show": (button) => {
      const job = kit().queue.find((x) => x.id === button?.closest("[data-job]")?.dataset.job);
      if (job?.pose) ctx.scene?.applyPose(job.pose);
    },
    // The frame the panel is set to, onto one item: the Video tab's for a
    // clip, the Export tab's for a still.
    "job-take-frame": (button) => {
      const k = kit();
      const id = button?.closest("[data-job]")?.dataset.job;
      setKit({
        ...k,
        queue: k.queue.map((j) => {
          if (j.id !== id) return j;
          const still = j.kind === "still";
          const from = { frame: still ? ctx.exportFrame : ctx.videoFrameShape, custom: ctx.customFrame, place: still ? ctx.framePlace.export : ctx.framePlace.video };
          return Object.entries(from).reduce((job, [key, v]) => tweak(job, key, v), j);
        }),
      });
    },
    "job-general-frame": (button) => {
      const k = kit();
      const id = button?.closest("[data-job]")?.dataset.job;
      setKit({ ...k, queue: k.queue.map((j) => (j.id === id ? ["frame", "custom", "place"].reduce((job, key) => tweak(job, key, undefined), j) : j)) });
    },
    "job-general": (button) => {
      const k = kit();
      const id = button?.closest("[data-job]")?.dataset.job;
      setKit({ ...k, queue: k.queue.map((j) => (j.id === id ? { ...j, set: {} } : j)) });
    },
    "kit-take-frame": () => {
      const k = kit();
      setKit({ ...k, defaults: { ...k.defaults, ...cleanSettings({ frame: ctx.videoFrameShape, custom: ctx.customFrame, place: ctx.framePlace.video }) } });
      toast("The general frame is now the Video tab's.");
    },
    "preset-save": (button) => {
      const k = kit();
      if (k.presets.length >= MAX_PRESETS) return toast(`${MAX_PRESETS} presets is the limit.`, true);
      const input = button?.closest("section, .preset-new")?.querySelector("[data-preset-name]");
      const name = (input?.value || "").trim().slice(0, 120) || `Timeline ${k.presets.length + 1}`;
      setKit({ ...k, presets: [...k.presets, { id: uid(), name, timeline: structuredClone(timeline()) }] });
      toast(`Saved the timeline as “${name}”.`);
    },
    "preset-load": (button) => {
      const preset = kit().presets.find((x) => x.id === button?.closest("[data-preset]")?.dataset.preset);
      if (!preset) return;
      ctx.videoTimeline = normalizeTimeline(structuredClone(preset.timeline));
      ctx.videoMove = CUSTOM_MOVE;
      ctx.tlBeforeAuto = null;
      refreshPanels();
      toast(`“${preset.name}” loaded into the timeline.`);
    },
    "preset-overwrite": (button) => {
      const k = kit();
      const id = button?.closest("[data-preset]")?.dataset.preset;
      setKit({ ...k, presets: k.presets.map((x) => (x.id === id ? { ...x, timeline: structuredClone(timeline()) } : x)) });
      toast("Preset updated. Every clip using it follows.");
    },
    "preset-apply": (button) => {
      const k = kit();
      const id = button?.closest("[data-preset]")?.dataset.preset;
      const clips = k.queue.filter((j) => j.kind === "clip").length;
      if (!clips) return toast("There are no clips in the batch to give it to. Add one first.", true);
      setKit(applyPreset(k, id));
      toast(`${clips} ${clips === 1 ? "clip uses" : "clips use"} the preset now.`);
    },
    "preset-delete": (button) => {
      const k = kit();
      setKit(removePreset(k, button?.closest("[data-preset]")?.dataset.preset));
    },
    "batch-export": async () => {
      if (ctx.busy || ctx.busyVideo) return;
      if (!ctx.scene) return toast("3D is not available, so there is no view to record.", true);
      const k = kit();
      if (!k.queue.length) return toast("The batch list is empty.", true);
      // A clip on a preset is named after it in its file name, unless it has
      // a name of its own.
      const named = (job) => job.name || (job.preset && k.presets.find((x) => x.id === job.preset)?.name) || undefined;
      await runClips(k.queue.map((job) => ({ ...resolveJob(job, k), name: named(job) })), { batch: true });
    },
    "cancel-video": () => ctx.videoAbort?.abort(),
    "edit-timeline": () => {
      if (!ctx.scene) return toast("3D is not available, so there is no view to keyframe.", true);
      // Offered whatever move is chosen, not only once Custom is picked from
      // the menu: opening the timeline is choosing Custom.
      if (ctx.videoMove !== CUSTOM_MOVE) {
        ctx.videoMove = CUSTOM_MOVE;
        renderInspector();
      }
      timeline();
      renderTimelineDialog();
      // show(), not showModal(). A modal would block the viewport, and the
      // viewport is where keyframes come from: the whole loop is compose a
      // shot, press Add, orbit, press Add again.
      const panel = document.querySelector("#timeline-dialog");
      if (!panel.open) panel.show();
      updateFrameGuide();
    },
    "close-timeline": () => {
      document.querySelector("#timeline-dialog").close();
      ctx.scene?.clearMoment();
      ctx.livePlace = null;
      // Emptied, so the batch and frame controls it repeats are not in the
      // page twice while it is closed.
      document.querySelector("#timeline-content").innerHTML = "";
      renderInspector();
    },
    "timeline-add": () => {
      const tl = timeline();
      if (tl.keys.length >= MAX_KEYS) return toast(`${MAX_KEYS} keyframes is the limit.`, true);
      const [position, target] = currentPose();
      // A new key lands halfway between the last one and the end, which is
      // where someone building a move in order wants it — and never on top of
      // the end key, which would be a zero-length segment.
      const previous = tl.keys.at(-2).t;
      // Between the last two keys, wherever the end has been slid to.
      const added = { ...keyFrom(position, target), t: (previous + tl.keys.at(-1).t) / 2 };
      // A keyframed frame: the new key takes the frame as it is shown now.
      if (tl.frameKeys) added.place = { ...getPlace("video") };
      ctx.videoTimeline = normalizeTimeline({ ...tl, keys: [...tl.keys, added] });
      ctx.keyThumbs.set(added.id, grabThumb(added.place || getPlace("video")));
      ctx.tlSelected = added.id;
      ctx.livePlace = added.place || null;
      ctx.tlPlayhead = keySchedule(ctx.videoTimeline).find((x) => x.id === added.id)?.arrive ?? ctx.tlPlayhead;
      renderTimelineDialog();
      toast(`Keyframe ${ctx.videoTimeline.keys.length - 1} captured from this view.`);
    },
    "timeline-select": (button) => {
      const tl = timeline();
      const index = tl.keys.findIndex((k) => k.id === button?.closest("[data-key]")?.dataset.key);
      if (index < 0) return;
      showKey(index);
    },
    // Previous / next keyframe from the playhead: "have a next or prev
    // keyframe arrows to jump to the next keyframe".
    "timeline-prev": () => {
      const i = neighbourKey(timeline(), ctx.tlPlayhead, -1);
      if (i >= 0) showKey(i);
    },
    "timeline-next": () => {
      const i = neighbourKey(timeline(), ctx.tlPlayhead, 1);
      if (i >= 0) showKey(i);
    },
    "timeline-auto": () => {
      ctx.tlBeforeAuto = timeline().keys.map((k) => ({ id: k.id, t: k.t }));
      ctx.videoTimeline = autoTime(timeline());
      renderTimelineDialog();
      toast("Keyframes respaced for an even speed.");
    },
    // Auto timing's own undo: the key times from just before it, matched by
    // id so a key added or deleted since is left alone. The timeline is view
    // state outside the project's undo history, so it needs this one.
    "timeline-auto-undo": () => {
      if (!ctx.tlBeforeAuto) return;
      const was = new Map(ctx.tlBeforeAuto.map((k) => [k.id, k.t]));
      const tl = timeline();
      ctx.videoTimeline = normalizeTimeline({ ...tl, keys: tl.keys.map((k) => (was.has(k.id) ? { ...k, t: was.get(k.id) } : k)) });
      ctx.tlBeforeAuto = null;
      renderTimelineDialog();
    },
    "timeline-go": (button) => {
      const index = timeline().keys.findIndex((k) => k.id === button?.closest("[data-key]")?.dataset.key);
      if (index >= 0) showKey(index);
    },
    "timeline-recapture": (button) => {
      const id = button?.closest("[data-key]")?.dataset.key;
      const [position, target] = currentPose();
      ctx.videoTimeline = normalizeTimeline({
        ...timeline(),
        keys: timeline().keys.map((k) => (k.id === id ? { ...k, position, target } : k)),
      });
      ctx.keyThumbs.set(id, grabThumb(timeline().keys.find((k) => k.id === id)?.place || getPlace("video")));
      renderTimelineDialog();
      toast("Keyframe replaced with this view.");
    },
    "timeline-delete": (button) => {
      const id = button?.closest("[data-key]")?.dataset.key;
      const tl = timeline();
      if (tl.keys.length <= MIN_KEYS) return toast("A move needs a start and an end.", true);
      ctx.videoTimeline = normalizeTimeline({ ...tl, keys: tl.keys.filter((k) => k.id !== id) });
      renderTimelineDialog();
    },
    "preview-move": async () => {
      if (ctx.busy || ctx.busyVideo || ctx.busyPreview) return;
      if (!ctx.scene) return toast("3D is not available, so there is no view to preview.", true);
      ctx.busyPreview = true;
      renderInspector();
      try {
        const custom = ctx.videoMove === CUSTOM_MOVE ? timeline() : null;
        const { cancelled } = await ctx.scene.previewMove({
          move: custom || ctx.videoMove,
          seconds: custom ? custom.seconds : ctx.videoSeconds,
          // The timeline's playhead rides along with a custom preview.
          onProgress: custom
            ? (t) => {
                ctx.tlPlayhead = t * custom.seconds;
                followPlayhead(custom, t);
                const head = document.querySelector("#timeline-content .tl-playhead");
                if (head) {
                  head.style.left = `${(t * 100).toFixed(3)}%`;
                  head.firstElementChild.textContent = `${ctx.tlPlayhead.toFixed(1)}s`;
                }
              }
            : undefined,
        });
        if (!cancelled) toast("That is the move. Export MP4 renders it.");
      } catch (err) {
        toast(err.message, true);
      } finally {
        ctx.busyPreview = false;
        if (!timelineOpen()) ctx.livePlace = null;
        renderInspector();
      }
    },
    "stop-preview": () => ctx.scene?.stopPreview?.(),
    // The timeline's own transport: Play runs the clip from the playhead (from
    // the start when the playhead is at the end), Pause stops it where it is —
    // camera, playhead and fade all left on that moment — so the next Play
    // carries on from there.
    "timeline-play": async () => {
      if (ctx.busy || ctx.busyVideo || ctx.busyPreview || !ctx.scene) return;
      const tl = timeline();
      ctx.videoMove = CUSTOM_MOVE;
      const from = ctx.tlPlayhead >= tl.seconds - 0.05 ? 0 : ctx.tlPlayhead / tl.seconds;
      ctx.busyPreview = true;
      renderInspector();
      renderTimelineDialog();
      try {
        const { cancelled, t } = await ctx.scene.previewMove({
          move: tl,
          seconds: tl.seconds,
          from,
          onProgress: (t) => {
            ctx.tlPlayhead = t * tl.seconds;
            followPlayhead(tl, t);
            const head = document.querySelector("#timeline-content .tl-playhead");
            if (head) {
              head.style.left = `${(t * 100).toFixed(3)}%`;
              head.firstElementChild.textContent = `${ctx.tlPlayhead.toFixed(1)}s`;
            }
          },
        });
        ctx.tlPlayhead = (cancelled ? t : 1) * tl.seconds;
      } catch (err) {
        toast(err.message, true);
      } finally {
        ctx.busyPreview = false;
        renderInspector();
        if (document.querySelector("#timeline-dialog")?.open) {
          renderTimelineDialog();
          ctx.scene.showMoment(tl, ctx.tlPlayhead / tl.seconds);
          followPlayhead(tl, ctx.tlPlayhead / tl.seconds);
        }
      }
    },
    "timeline-pause": () => ctx.scene?.stopPreview?.({ keep: true }),
    "frame-reset-video": () => {
      setPlace("video", { ...DEFAULT_PLACE });
      saveViewPrefs();
      placeSettled();
    },
    "frame-reset-export": () => {
      ctx.framePlace.export = { ...DEFAULT_PLACE };
      saveViewPrefs();
      renderInspector();
    },
  };
}
