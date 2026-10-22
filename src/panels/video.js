// The Video tab's builders: the clip's settings — the camera move, its
// length, rate, size, frame and settle — and what this browser can encode.
// The same section stands in Export too. The timeline dialog and the batch
// are src/ui/; what the controls do stays in main.js with the action table,
// which moves later. Moved out of src/main.js's boot() as it was
// (MAIN_SPLIT_PHASE.md, seam 11): `ctx` is boot's state, read through it,
// and the helpers this calls.
import { MOVES, CUSTOM_MOVE, resolveMove } from "../camera-path.js";
import { SIZES, FPS, videoSupported } from "../video.js";
import { escapeHTML as e } from "../model.js";

export function createVideoPanel(ctx) {
  const { btn, frameFields, frameNote, probeCodec, progressHTML, timelineSummary } = ctx;
  // Video export. Offered only where it can actually be delivered: the encoder
  // is WebCodecs, and saying up front what it will produce is kinder than a
  // failure — or a file QuickTime refuses — after someone has waited through a
  // render.
  function videoSection() {
    const custom = ctx.videoMove === CUSTOM_MOVE;
    const move = resolveMove(ctx.videoMove);
    const supported = videoSupported();
    // Fire and forget: the probe re-renders this panel when it answers, and it
    // no-ops for a size and rate it has already asked about, so this cannot
    // loop.
    if (supported) probeCodec();
    if (!supported)
      return `<section><h3>Video</h3><p class="muted">Video export needs the WebCodecs video encoder, which this browser does not offer. Chrome, Edge and Safari 16.4 or newer have it. Export PNG works everywhere.</p></section>`;
    const moveOptions = [
      ...Object.entries(MOVES).map(([k, v]) => `<option value="${k}" ${ctx.videoMove === k ? "selected" : ""}>${e(v.label)}</option>`),
      `<option value="${CUSTOM_MOVE}" ${custom ? "selected" : ""}>Custom · your own keyframes</option>`,
    ].join("");
    // A custom clip's length lives in the timeline, with the keyframe times it
    // has to agree with; offering a second length control beside it would let
    // the two contradict each other.
    const lengthField = custom
      ? `${btn("edit-timeline", "Edit timeline…", "sliders-horizontal", "wide")}<p class="muted">${e(timelineSummary())}</p>`
      : `<label class="setting-label">Length<select id="video-seconds" aria-label="Clip length">${[6, 8, 10, 12, 14, 16, 20]
          .map((sec) => `<option value="${sec}" ${ctx.videoSeconds === sec ? "selected" : ""}>${sec} seconds</option>`)
          .join("")}</select></label>${btn("edit-timeline", "Edit timeline…", "sliders-horizontal", "wide")}<p class="muted">Opens your own keyframed move, and switches the camera move to Custom.</p>`;
    const describe = custom
      ? "Your own keyframes, in the order you set them. Compose a shot in the viewport, add it as a keyframe, and repeat — each one is the exact view you captured, not a gesture applied to the current framing."
      : `${e(move.describe)} The move starts and ends on the view you have now, so compose the shot first.`;
    return `<section><h3>Video</h3><label class="setting-label">Camera move<select id="video-move" aria-label="Camera move">${moveOptions}</select></label><p class="muted">${describe}</p>${lengthField}<label class="setting-label">Frame rate<select id="video-fps" aria-label="Frame rate">${FPS.map(
      (f) => `<option value="${f}" ${ctx.videoFps === f ? "selected" : ""}>${f} fps</option>`,
    ).join("")}</select></label><label class="setting-label">Resolution<select id="video-size" aria-label="Video resolution">${Object.entries(SIZES)
      .map(([k, v]) => `<option value="${k}" ${String(ctx.videoSize) === k ? "selected" : ""}>${e(v.label)}</option>`)
      .join("")}</select></label>${frameFields("video")}<label class="check-field"><input type="checkbox" data-video-settle ${ctx.videoSettle ? "checked" : ""}/>Careful rendering</label><p class="muted">${ctx.videoSettle ? "Each frame is drawn twice, the second time after the browser has caught up, so nothing is captured half-finished. It roughly doubles the render and it is what fixes glitches in an exported clip." : "Off: each frame is captured as soon as it is drawn. Faster, and the setting to turn back on if a clip comes out with a wall, a shadow or the backdrop from the frame before."}</p><p class="muted">MP4 · H.264 where this browser can encode it, which is what QuickTime Player and phones want. ${e(frameNote("video"))} Every frame is rendered in full before it is encoded, so the clip runs at the frame rate you chose however fast this machine is — which is why it takes longer than the clip lasts.</p>${videoCodecLine()}${ctx.busyPreview ? btn("stop-preview", "Stop preview", "x", "wide") : btn("preview-move", "Preview the move", "play", "wide")}<p class="muted">Plays the move in the viewport at its real length, without rendering anything. Judge it here first: a 14-second 1440p clip is minutes of encoding.</p>${btn("export-video", "Export MP4", "download", "primary wide")}${ctx.busyVideo ? btn("cancel-video", "Cancel", "x", "wide") : ""}<div class="video-progress" role="status" aria-live="polite">${ctx.busyVideo ? progressHTML() : ""}</div></section>`;
  }
  // Says what will come out, in the terms that matter: whether QuickTime
  // Player will open it. Nothing is claimed until the probe has answered.
  function videoCodecLine() {
    if (!ctx.videoCodec) return `<p class="muted">Checking what this browser can encode…</p>`;
    if (ctx.videoCodec.kind === "vp09")
      return `<p class="warn-note">This browser has no H.264 encoder, so the clip will be <strong>VP9 in an MP4</strong>. It plays in Chrome, Edge and VLC, but <strong>QuickTime Player cannot open it</strong>. Record in Chrome or Safari for a QuickTime-ready file.</p>`;
    return `<p class="muted">This browser will encode <strong>${e(ctx.videoCodec.label)}</strong> — the codec QuickTime Player, phones and upload forms expect.</p>`;
  }
  return { videoSection };
}
