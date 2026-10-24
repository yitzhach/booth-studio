// Recording video: `probeCodec` (which codec this browser can record the
// chosen size and frame rate in), `runClips` (one clip, or the batch's jobs
// one after another, with the progress, the stop and the download of each)
// and `progressHTML` (the progress bar it draws). All three are returned.
// Moved out of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam 21):
// `ctx` is boot's state, read and set through it, and the helpers these call.
import { CUSTOM_MOVE, frameTimes } from "../camera-path.js";
import { normalizeTimeline } from "../timeline.js";
import { jobSlug } from "../batch.js";
import { SIZES, DEFAULT_SIZE, pickCodec } from "../video.js";
import { download } from "../storage.js";

export function createClips(ctx) {
  const { refreshPanels, renderInspector, safeName, toast } = ctx;
  // Asks the browser which codec it will encode, for the size and rate
  // currently chosen, and re-renders the panel once it knows. Keyed so that
  // changing the resolution or frame rate re-probes: the H.264 level depends
  // on both, and a machine can support one and refuse another.
  async function probeCodec() {
    const key = `${ctx.videoSize}/${ctx.videoFps}`;
    if (ctx.videoCodecFor === key) return;
    ctx.videoCodecFor = key;
    const preset = SIZES[ctx.videoSize] || SIZES[DEFAULT_SIZE];
    try {
      ctx.videoCodec = await pickCodec({
        width: preset.width,
        height: preset.height,
        framerate: ctx.videoFps,
        bitrate: preset.bitrate,
      });
    } catch {
      ctx.videoCodec = null;
    }
    if (ctx.tab === "export" || ctx.tab === "video") renderInspector();
  }
  // Renders one clip or a whole batch, in order, downloading each as it lands.
  // A batch is not a different code path: it is this loop with more than one
  // entry, which is what keeps a single export and a batch honest with each
  // other.
  // A batch is the same loop with stills in it: a still is one frame, rendered
  // by the PNG export from the view it was queued with.
  async function runClips(jobs, { batch = false } = {}) {
    ctx.busy = ctx.busyVideo = true;
    ctx.videoAbort = new AbortController();
    ctx.videoBatchAt = batch ? 0 : -1;
    refreshPanels();
    // The progress element is written to directly rather than through
    // renderInspector: redrawing the whole panel a few hundred times would
    // itself slow the render it is reporting on. There can be one in the
    // Video tab and one in the timeline; both are kept.
    const status = (note) => {
      document.querySelectorAll(".video-progress").forEach((box) => {
        if (!batch && box.closest(".batch")) return;
        if (!box.querySelector("progress")) box.innerHTML = progressHTML();
        box.querySelector("progress").value = ctx.videoProgress;
        box.querySelector("span").textContent = `${note}${Math.round(ctx.videoProgress * 100)}% · frame ${ctx.videoFrame} of ${ctx.videoFrames}`;
      });
    };
    let done = 0;
    let stills = 0;
    let vp9 = false;
    try {
      for (const [index, job] of jobs.entries()) {
        ctx.videoBatchAt = batch ? index : -1;
        if (batch) refreshPanels();
        ctx.videoProgress = 0;
        ctx.videoFrame = 0;
        const note = jobs.length > 1 ? `${job.kind === "still" ? "Still" : "Clip"} ${index + 1} of ${jobs.length} · ` : "";
        const name = batch ? `${safeName()}-${jobSlug(job, index)}` : `${safeName()}-${job.fileTag || job.move}`;
        if (job.kind === "still") {
          ctx.videoFrames = 1;
          status(note);
          if (ctx.videoAbort.signal.aborted) throw new DOMException("Cancelled", "AbortError");
          const blob = await ctx.scene.export(job.long, { frame: job.frame, custom: job.custom, place: job.place, pose: job.pose || undefined });
          download(blob, `${name}.png`);
          ctx.videoProgress = 1;
          status(note);
          done += 1;
          stills += 1;
          continue;
        }
        if (job.move === CUSTOM_MOVE && !job.timeline) throw new Error(`Item ${index + 1} has no timeline to render. Load a preset into it or remove it.`);
        ctx.videoFrames = frameTimes(job.seconds, job.fps).count;
        status(note);
        const recorded = await ctx.scene.recordVideo({
          // A timeline where the move is Custom, one of the fixed moves
          // otherwise. Everything downstream — the recorder, the encoder, the
          // muxer — sees the same (t) -> pose contract either way.
          move: job.move === CUSTOM_MOVE ? normalizeTimeline(job.timeline) : job.move,
          seconds: job.seconds,
          fps: job.fps,
          size: job.size,
          frame: job.frame,
          custom: job.custom,
          place: job.place,
          settle: job.settle !== false,
          signal: ctx.videoAbort.signal,
          onProgress: (fraction) => {
            ctx.videoProgress = fraction;
            ctx.videoFrame = Math.round(fraction * ctx.videoFrames);
            status(note);
          },
        });
        download(recorded.blob, `${name}.mp4`);
        vp9 = vp9 || recorded.kind === "vp09";
        done += 1;
      }
      // Which codec landed decides what can open the file, so it is said out
      // loud. VP9 is the fallback for a browser with no H.264 encoder, and
      // QuickTime Player cannot open VP9 — someone handed that file without
      // being told just sees their player refuse their own export.
      if (vp9)
        toast(
          "Exported as VP9, because this browser cannot encode H.264. It plays in Chrome, Edge and VLC, but not in QuickTime Player — use Chrome or Safari for a QuickTime-ready file.",
          true,
        );
      else if (batch) toast(`${done} exported${stills ? ` · ${done - stills} ${done - stills === 1 ? "clip" : "clips"}, ${stills} ${stills === 1 ? "still" : "stills"}` : ""}.`);
      else toast(`${jobs[0].seconds}s MP4 exported · ${ctx.videoFrames} frames at ${jobs[0].fps} fps.`);
    } catch (err) {
      // A cancelled batch keeps the clips it already wrote: they are on disk
      // and saying otherwise would be a lie.
      if (err?.name === "AbortError")
        toast(done ? `Cancelled after ${done} ${done === 1 ? "item" : "items"}.` : "Recording cancelled.");
      else toast(err.message, true);
    } finally {
      ctx.busy = ctx.busyVideo = false;
      ctx.videoAbort = null;
      ctx.videoProgress = 0;
      ctx.videoBatchAt = -1;
      refreshPanels();
    }
  }
  const progressHTML = () =>
    `<progress max="1" value="${ctx.videoProgress}"></progress><span>${Math.round(ctx.videoProgress * 100)}% · frame ${ctx.videoFrame} of ${ctx.videoFrames}</span>`;
  return { probeCodec, runClips, progressHTML };
}
