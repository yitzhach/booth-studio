// The Custom camera move's timeline: the one it renders, always normalised,
// the frame's placement routed to the selected keyframe, and the dialog that
// draws it as a track of keyframes with their pictures, scrubbed and retimed
// by pointer. Its buttons stay in the action table, which moves later. Moved
// out of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam 5): `ctx`
// is boot's state, read and set through it, and the helpers this calls.
import { escapeHTML as e } from "../model.js";
import { CUSTOM_MOVE } from "../camera-path.js";
import {
  EASES, MAX_KEYS, MIN_KEYS, MIN_SECONDS, MAX_SECONDS,
  emptyTimeline, normalizeTimeline, segmentSpeed,
  keySchedule, keyTAt, sampleTimeline, easeFn, FLOWS,
} from "../timeline.js";
import { FLARE_SOURCES, OVERHEAD } from "../flare.js";
import { videoSupported } from "../video.js";
import { FRAMES, guideRect, placeRect } from "../framing.js";

export function createTimelineDialog(ctx) {
  const { batchSection, btn, frameFields, frameNote, progressHTML, range, refreshIcons, refreshPanels, renderInspector, updateFrameGuide } = ctx;
  // The timeline the export will render, always normalised: the dialog edits a
  // plain object and everything else reads it through here, so no caller has to
  // defend itself against an unordered or half-built one.
  function timeline() {
    ctx.videoTimeline = normalizeTimeline(ctx.videoTimeline || emptyTimeline(...currentPose()), {
      position: currentPose()[0],
      target: currentPose()[1],
    });
    return ctx.videoTimeline;
  }
  const currentPose = () => {
    const pose = ctx.scene?.pose();
    return [pose?.position || [3, 1.6, 4], pose?.target || [0, 1.2, 0]];
  };
  // The frame's placement, routed. With the timeline open on a keyframed
  // frame, the clip's placement is the selected keyframe's — or, while
  // scrubbing or playing, the one sampled at the playhead — so the Video
  // tab's sliders, the timeline's and the guide's handles all edit that key.
  // Otherwise it is the Video tab's own, for the whole clip.
  const timelineOpen = () => !!document.querySelector("#timeline-dialog")?.open;
  const frameKeyed = () => ctx.videoMove === CUSTOM_MOVE && !!ctx.videoTimeline?.frameKeys && (timelineOpen() || ctx.busyPreview);
  const selectedKey = () => ctx.videoTimeline?.keys.find((k) => k.id === ctx.tlSelected) || ctx.videoTimeline?.keys[0];
  function selectedKeyName() {
    const tl = timeline();
    return keyName(Math.max(0, tl.keys.findIndex((k) => k.id === ctx.tlSelected)), tl.keys.length);
  }
  function getPlace(which) {
    if (which === "video" && frameKeyed()) return ctx.livePlace || selectedKey()?.place || ctx.framePlace.video;
    return ctx.framePlace[which];
  }
  function setPlace(which, place) {
    if (!(which === "video" && frameKeyed())) {
      ctx.framePlace[which] = place;
      return;
    }
    const id = selectedKey().id;
    ctx.videoTimeline = normalizeTimeline({ ...ctx.videoTimeline, keys: ctx.videoTimeline.keys.map((k) => (k.id === id ? { ...k, place } : k)) });
    ctx.livePlace = place;
    // Setting a keyframe's frame is looking at that keyframe: the camera and
    // the playhead go to it, so the frame is judged against its own shot.
    const i = ctx.videoTimeline.keys.findIndex((k) => k.id === id);
    const arrive = keySchedule(ctx.videoTimeline)[i].arrive;
    if (Math.abs(ctx.tlPlayhead - arrive) > 1e-3) {
      ctx.tlPlayhead = arrive;
      ctx.scene?.applyPose(ctx.videoTimeline.keys[i]);
    }
  }
  /** Once a frame edit lands: the panels redrawn, and a keyframe's picture retaken. */
  function placeSettled() {
    if (frameKeyed()) {
      const key = selectedKey();
      if (key) ctx.keyThumbs.set(key.id, grabThumb(key.place));
    }
    refreshPanels();
  }
  /** The playhead's frame, for the guide, while a keyframed clip is scrubbed or played. */
  function followPlayhead(tl, t) {
    ctx.livePlace = tl.frameKeys ? sampleTimeline(tl, t).place || null : null;
    if (tl.frameKeys) updateFrameGuide();
  }
  // A one-line answer to "what will this export?", which is the question the
  // panel is actually being asked once the timeline is closed.
  function timelineSummary() {
    const tl = timeline();
    const holds = tl.keys.reduce((sum, k) => sum + (k.hold || 0), 0);
    const parts = [`${tl.keys.length} keyframes`, `${tl.seconds} seconds`];
    if (holds > 0) parts.push(`${holds.toFixed(1)}s held`);
    if (tl.fade.in > 0 || tl.fade.out > 0) parts.push(`fade ${tl.fade.in}s / ${tl.fade.out}s`);
    if (tl.flare.on) parts.push("lens flare");
    return parts.join(" · ") + ".";
  }
  // The timeline dialog. It reuses #dialog rather than owning one, because two
  // modal dialogs in one app is two sets of focus and escape-key behaviour to
  // keep in step.
  // The timeline dialog, drawn as a timeline: a track with a ruler, each
  // keyframe a diamond at the second the camera arrives there, holds as solid
  // blocks, every segment carrying a drawing of its ramp, the fades as
  // shading at the ends, and a playhead. Under the track, a strip of the
  // keyframes' own pictures. Asked for 2026-09-24 as "more visual, so I can
  // see the keyframes — easier to use, more intuitive". Drag a middle diamond
  // to retime it; drag anywhere else on the track to scrub the camera
  // through the move; click a picture to select that keyframe and see its
  // view. The selected keyframe's settings are the one card below the strip.
  /** A small picture of what the viewport shows right now. */
  function grabThumb(place = getPlace("video")) {
    const src = ctx.scene?.renderer?.domElement;
    if (!src?.width) return null;
    // Cropped to the clip's frame, so a keyframe's picture is the shot the
    // file will have rather than the whole window around it.
    const aspect =
      ctx.videoFrameShape === "custom"
        ? ctx.customFrame.width / ctx.customFrame.height
        : FRAMES[ctx.videoFrameShape]?.aspect || src.width / src.height;
    const r = ctx.videoFrameShape === "view" ? guideRect(src.width, src.height, aspect) : placeRect(src.width, src.height, aspect, place);
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = Math.max(1, Math.round((160 * r.height) / r.width));
    c.getContext("2d").drawImage(src, r.x, r.y, r.width, r.height, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  }
  /**
   * A picture for every key that has none — a timeline carried over from a
   * batch, or one opened before any were taken. Each is the key's own view,
   * drawn once and read back; the camera goes back where it was afterwards.
   */
  function fillThumbs() {
    if (!ctx.scene || ctx.busyPreview || ctx.busyVideo) return;
    const missing = timeline().keys.filter((k) => !ctx.keyThumbs.has(k.id));
    if (!missing.length) return;
    const home = ctx.scene.pose();
    for (const k of missing) {
      ctx.scene.applyPose(k);
      ctx.keyThumbs.set(k.id, grabThumb(k.place || getPlace("video")));
    }
    ctx.scene.applyPose(home);
  }
  /** The track's contents, in percent of the clip: redrawn on its own while dragging. */
  function timelineTrackHTML() {
    const tl = timeline();
    const S = tl.seconds;
    const at = (sec) => `${((Math.min(S, Math.max(0, sec)) / S) * 100).toFixed(3)}%`;
    const sched = keySchedule(tl);
    const step = S <= 8 ? 1 : S <= 20 ? 2 : S <= 40 ? 5 : 10;
    let ticks = "";
    for (let t = 0; t <= S + 1e-9; t += step) ticks += `<span class="tl-tick" style="left:${at(t)}">${t}s</span>`;
    let segs = "";
    for (let i = 0; i < tl.keys.length - 1; i++) {
      const from = sched[i].leave,
        to = sched[i + 1].arrive;
      if (to - from <= 1e-6) continue;
      // The ramp, drawn: speed would be its slope, so an ease-in visibly
      // starts flat and an ease-out lands flat.
      // In a glide the segments are walked at the run's own speed, so each
      // is drawn straight and the ease lives at the run's two ends.
      const f = easeFn(tl.flow === "glide" ? "linear" : tl.keys[i].ease);
      const pts = Array.from({ length: 21 }, (_, n) => `${n * 5},${(30 - f(n / 20) * 26).toFixed(2)}`).join(" ");
      segs += `<div class="tl-seg" style="left:${at(from)};width:calc(${at(to)} - ${at(from)})" title="${e(tl.flow === "glide" ? FLOWS.glide.label : EASES[tl.keys[i].ease]?.label || "")}"><svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg></div>`;
    }
    const holds = sched
      .filter((x) => x.leave - x.arrive > 1e-6)
      .map((x) => `<div class="tl-hold" style="left:${at(x.arrive)};width:calc(${at(x.leave)} - ${at(x.arrive)})" title="Hold ${(x.leave - x.arrive).toFixed(1)}s"></div>`)
      .join("");
    const fades =
      (tl.fade.in > 0 ? `<div class="tl-fade in" style="left:0;width:${at(tl.fade.in)}" title="Fade in"></div>` : "") +
      (tl.fade.out > 0 ? `<div class="tl-fade out" style="right:0;width:${at(tl.fade.out)}" title="Fade out"></div>` : "");
    // An end key slid inward holds its shot out to the clip's edge: drawn
    // like a hold, paler, because nothing about it is the key's own hold.
    const first = sched[0].arrive,
      lastLeave = sched.at(-1).leave;
    const ends =
      (first > 1e-6 ? `<div class="tl-hold tl-end" style="left:0;width:${at(first)}" title="Holds the first shot until ${first.toFixed(1)}s"></div>` : "") +
      (S - lastLeave > 1e-6 ? `<div class="tl-hold tl-end" style="left:${at(lastLeave)};width:calc(100% - ${at(lastLeave)})" title="Holds the last shot from ${lastLeave.toFixed(1)}s"></div>` : "");
    // Every diamond drags now, the two ends included: "allow sliding of end
    // key frames".
    const keys = tl.keys
      .map((k, i) => {
        const end = i === 0 || i === tl.keys.length - 1;
        return `<button class="tl-key${k.id === ctx.tlSelected ? " selected" : ""}${end ? " end" : ""}" data-tl-key="${k.id}" style="left:${at(sched[i].arrive)}" title="${e(keyName(i, tl.keys.length))} · ${sched[i].arrive.toFixed(1)}s · drag to retime" aria-label="${e(keyName(i, tl.keys.length))} at ${sched[i].arrive.toFixed(1)} seconds"><span>${i + 1}</span></button>`;
      })
      .join("");
    return `<div class="tl-ruler">${ticks}</div><div class="tl-lane">${fades}${ends}${segs}${holds}${keys}</div><div class="tl-playhead" style="left:${at(ctx.tlPlayhead)}"><span>${ctx.tlPlayhead.toFixed(1)}s</span></div>`;
  }
  const keyName = (i, n) => (i === 0 ? "Start" : i === n - 1 ? "End" : `Keyframe ${i + 1}`);
  function renderTimelineDialog() {
    const tl = timeline();
    const seconds = tl.seconds;
    const noLights = !(ctx.p.lights || []).length;
    const sched = keySchedule(tl);
    if (!tl.keys.some((k) => k.id === ctx.tlSelected)) ctx.tlSelected = tl.keys[0].id;
    ctx.tlPlayhead = Math.min(seconds, Math.max(0, ctx.tlPlayhead));
    fillThumbs();
    const strip = tl.keys
      .map((k, i) => {
        const thumb = ctx.keyThumbs.get(k.id);
        return `<button class="key-card${k.id === ctx.tlSelected ? " selected" : ""}" data-action="timeline-select" data-key="${k.id}" aria-label="Select ${e(keyName(i, tl.keys.length))}" aria-pressed="${k.id === ctx.tlSelected}">${thumb ? `<img src="${thumb}" alt=""/>` : `<span class="key-thumb-none">${i + 1}</span>`}<strong>${i + 1}. ${e(keyName(i, tl.keys.length))}</strong><small>${sched[i].arrive.toFixed(1)}s${k.hold ? ` · holds ${k.hold.toFixed(1)}s` : ""}</small></button>`;
      })
      .join("");
    const i = tl.keys.findIndex((k) => k.id === ctx.tlSelected);
    const k = tl.keys[i];
    const last = i === tl.keys.length - 1;
    const speed = last ? null : segmentSpeed(tl, i);
    const card = `<div class="key-row" data-key="${k.id}"><div class="key-head"><strong>${e(keyName(i, tl.keys.length))}</strong><span class="muted">arrives at ${sched[i].arrive.toFixed(1)}s</span></div><div class="key-fields"><label class="setting-label">At (s)<input type="number" data-key-field="t" data-key="${k.id}" min="0" max="${seconds}" step="0.1" value="${sched[i].arrive.toFixed(1)}" aria-label="Keyframe time in seconds"/></label><label class="setting-label">Hold (s)<input type="number" data-key-field="hold" data-key="${k.id}" min="0" max="10" step="0.1" value="${(k.hold || 0).toFixed(1)}" aria-label="Seconds held on this pose"/></label>${
      last || tl.flow === "glide"
        ? ""
        : `<label class="setting-label">Ramp to next<select data-key-field="ease" data-key="${k.id}" aria-label="Segment ramp">${Object.entries(EASES)
            .map(([id, v]) => `<option value="${id}" ${k.ease === id ? "selected" : ""}>${e(v.label)}</option>`)
            .join("")}</select></label>`
    }</div>${speed === null ? "" : `<p class="muted">Then travels ${speed.toFixed(2)} m/s to the next keyframe.</p>`}<div class="button-row">${btn("timeline-go", "Show this view", "camera")}${btn("timeline-recapture", "Replace with current view", "rotate-ccw")}${tl.keys.length > MIN_KEYS ? btn("timeline-delete", "Delete", "trash-2") : ""}</div></div>`;
    document.querySelector("#timeline-content").innerHTML =
      `<div class="panel-heading"><h2>Camera timeline</h2>${btn("close-timeline", "Close", "x", "icon-only")}</div><ol class="tl-steps"><li>Frame a shot in the booth behind this panel.</li><li>Press <strong>Add keyframe</strong>. Repeat for each shot.</li><li>Drag a diamond to change when the camera gets there; drag the track to scrub.</li></ol><div class="tl-bar">${tl.keys.length < MAX_KEYS ? btn("timeline-add", "Add keyframe", "plus", "primary") : `<span class="muted">${MAX_KEYS} keyframes max</span>`}${videoSupported() ? (ctx.busyVideo ? btn("cancel-video", "Cancel export", "x") : btn("export-video", "Export MP4", "download")) : ""}<span class="tl-transport">${btn("timeline-prev", "Previous keyframe", "skip-back", "icon-only")}${ctx.busyPreview ? btn("timeline-pause", "Pause", "pause", "primary") : btn("timeline-play", ctx.tlPlayhead > 0.05 && ctx.tlPlayhead < seconds - 0.05 ? "Play from here" : "Play", "play")}${btn("timeline-next", "Next keyframe", "skip-forward", "icon-only")}</span><label class="setting-label tl-length">Length (s)<input type="number" id="timeline-seconds" min="${MIN_SECONDS}" max="${MAX_SECONDS}" step="1" value="${seconds}" aria-label="Clip length in seconds"/></label></div><div class="tl-track" data-tl-track role="group" aria-label="Timeline track">${timelineTrackHTML()}</div><div class="tl-legend"><span><i class="tl-sw seg"></i>move · curve = ramp</span><span><i class="tl-sw hold"></i>hold</span><span><i class="tl-sw fade"></i>fade</span></div><div class="tl-strip">${strip}</div>${card}${timelineFrameSection(tl)}<section><h3>Motion</h3><label class="setting-label">Camera flow<select id="timeline-flow" aria-label="Camera flow">${Object.entries(FLOWS).map(([id, v]) => `<option value="${id}" ${tl.flow === id ? "selected" : ""}>${e(v.label)}</option>`).join("")}</select></label><p class="muted">${tl.flow === "glide" ? "The camera eases in once, moves at a steady speed through every keyframe without stopping, and eases out at the end — the look of a slider or a gimbal. A hold still stops it." : "Each move has its own ramp, so the camera settles on every keyframe. Choose the glide for one unbroken move."}</p>${tl.keys.length > 2 ? btn("timeline-auto", "Auto timing · even speed", "zap", "wide") : ""}<p class="muted">${tl.keys.length > 2 ? "Respaces the middle keyframes so the camera covers the same distance every second." : "Auto timing spaces middle keyframes; add one to use it."}</p>${ctx.tlBeforeAuto ? btn("timeline-auto-undo", "Put the timing back", "undo-2", "wide") : ""}</section><section><h3>Fades</h3><div class="field-pair"><label class="setting-label">Fade in<input type="number" id="timeline-fade-in" min="0" max="${(seconds / 2).toFixed(1)}" step="0.1" value="${tl.fade.in.toFixed(1)}" aria-label="Fade in seconds"/></label><label class="setting-label">Fade out<input type="number" id="timeline-fade-out" min="0" max="${(seconds / 2).toFixed(1)}" step="0.1" value="${tl.fade.out.toFixed(1)}" aria-label="Fade out seconds"/></label></div><p class="muted">Seconds of black at each end. Zero disables. The fade is drawn over the finished frame, so it reaches real black rather than a dark wash.</p></section><section><h3>Lens flare</h3><label class="check-field"><input type="checkbox" id="timeline-flare" ${tl.flare.on ? "checked" : ""}/>Lens flare during the move</label><label class="setting-label">Comes from<select id="timeline-flare-source" aria-label="Lens flare source">${Object.entries(FLARE_SOURCES).map(([k, v]) => `<option value="${k}" ${tl.flare.source === k ? "selected" : ""} ${k === "spot" && noLights ? "disabled" : ""}>${e(v)}</option>`).join("")}</select></label>${tl.flare.source === "spot" && noLights ? `<p class="warn-note">This booth has no spotlights, so a flare from one would never appear. Use the overhead source, or add a spotlight in Lighting.</p>` : ""}${range("Flare strength", "flare-strength", Math.round(tl.flare.strength * 100), 0, 100, 1, "timeline", "%")}<p class="muted">${tl.flare.source === "overhead" ? `An unseen light ${Math.round(OVERHEAD.y / 12)} ft over the centre of the booth, standing in for the sun or a hall's high bay. Nothing is drawn there and nothing is lit by it — only the flare says it is there.` : "The brightest spotlight in the booth."} The flare tracks the camera: its ghosts sit on the line from that light through the centre of frame, and it fades out as the light leaves the shot.</p></section>${timelineExportSection()}${batchSection()}<div class="button-row">${btn("close-timeline", "Done", "check", "primary")}</div>`;
    refreshIcons();
  }
  /**
   * The frame, in the timeline: the same Frame menu and size / left-right /
   * up-down sliders as the Video tab, plus the switch that keyframes them.
   * Asked for as "add the frame up / down slider also in the timeline, and
   * make it keyframeable so the frame can move too".
   */
  function timelineFrameSection(tl) {
    const note = tl.frameKeys
      ? `Each keyframe keeps its own frame. The sliders and the guide's handles set the selected keyframe's; between keyframes the frame travels on the same ramp as the camera, so a frame can rise, fall, pan or zoom during the move.`
      : `Off: the frame stays where it is for the whole clip. On, each keyframe keeps its own frame size and position, and the frame moves between them with the camera.`;
    const toggle = `<label class="check-field"><input type="checkbox" id="timeline-frame-keys" ${tl.frameKeys ? "checked" : ""} ${ctx.videoFrameShape === "view" ? "disabled" : ""}/>Keyframe the frame</label><p class="muted">${ctx.videoFrameShape === "view" ? "“This window” is the whole viewport and has nowhere to move. Choose a frame shape to keyframe it." : note}</p>`;
    return `<section><h3>Frame</h3>${frameFields("video")}${toggle}</section>`;
  }
  /** Export from the timeline itself, so the clip can go out without leaving it. */
  function timelineExportSection() {
    if (!videoSupported()) return "";
    return `<section><h3>Export</h3><p class="muted">${e(frameNote("video"))} ${ctx.videoFps} fps. Frame rate and resolution are in the Video tab; the batch below can give each item its own.</p>${ctx.busyVideo ? btn("cancel-video", "Cancel", "x", "wide") : btn("export-video", "Export MP4", "download", "primary wide")}<div class="video-progress" role="status" aria-live="polite">${ctx.busyVideo ? progressHTML() : ""}</div></section>`;
  }
  /** Selects key `index`: the playhead, the camera and the frame all go to it. */
  function showKey(index) {
    const tl = timeline();
    const key = tl.keys[index];
    if (!key) return;
    ctx.tlSelected = key.id;
    ctx.tlPlayhead = keySchedule(tl)[index].arrive;
    ctx.scene?.applyPose(key);
    ctx.livePlace = key.place || null;
    renderTimelineDialog();
    renderInspector();
  }
  /** Scrub: put the playhead at `sec` and show the camera there. */
  function scrubTo(sec) {
    const tl = timeline();
    ctx.tlPlayhead = Math.min(tl.seconds, Math.max(0, sec));
    ctx.scene?.showMoment(tl, ctx.tlPlayhead / tl.seconds);
    followPlayhead(tl, ctx.tlPlayhead / tl.seconds);
  }
  // The track's pointer handling, bound once on the dialog's content (which
  // is never replaced) and capturing on the track itself, whose children are
  // redrawn on every move of a drag.
  {
    const content = document.querySelector("#timeline-content");
    let dragging = null;
    const secondsAt = (ev, track) => {
      const r = track.getBoundingClientRect();
      return (Math.min(1, Math.max(0, (ev.clientX - r.left) / Math.max(1, r.width)))) * timeline().seconds;
    };
    const redraw = () => {
      const track = content.querySelector("[data-tl-track]");
      if (track) track.innerHTML = timelineTrackHTML();
    };
    content.addEventListener("pointerdown", (ev) => {
      const track = ev.target.closest?.("[data-tl-track]");
      if (!track || ev.button !== 0) return;
      ev.preventDefault();
      const keyEl = ev.target.closest("[data-tl-key]");
      const tl = timeline();
      const index = keyEl ? tl.keys.findIndex((k) => k.id === keyEl.dataset.tlKey) : -1;
      if (index >= 0) {
        ctx.tlSelected = tl.keys[index].id;
        dragging = { key: tl.keys[index].id, moved: false };
        ctx.tlPlayhead = keySchedule(tl)[index].arrive;
        ctx.scene?.applyPose(tl.keys[index]);
        ctx.livePlace = tl.keys[index].place || null;
        if (tl.frameKeys) updateFrameGuide();
      } else {
        dragging = { scrub: true };
        scrubTo(secondsAt(ev, track));
      }
      track.setPointerCapture(ev.pointerId);
      redraw();
    });
    content.addEventListener("pointermove", (ev) => {
      if (!dragging || dragging.select) return;
      const track = content.querySelector("[data-tl-track]");
      if (!track) return;
      const sec = secondsAt(ev, track);
      if (dragging.scrub) scrubTo(sec);
      else {
        const tl = timeline();
        const index = tl.keys.findIndex((k) => k.id === dragging.key);
        if (index < 0) return;
        dragging.moved = true;
        const keys = tl.keys.map((k, n) => (n === index ? { ...k, t: keyTAt(tl, index, sec) } : k));
        ctx.videoTimeline = normalizeTimeline({ ...tl, keys });
        // Found again by id: a key dragged past its neighbour changes place.
        const now = ctx.videoTimeline.keys.findIndex((k) => k.id === dragging.key);
        ctx.tlPlayhead = keySchedule(ctx.videoTimeline)[now].arrive;
      }
      redraw();
    });
    const end = () => {
      if (!dragging) return;
      const was = dragging;
      dragging = null;
      // A drag ends with the whole dialog redrawn: the card's times and the
      // strip's labels follow the key that moved.
      if (!was.scrub) renderTimelineDialog();
    };
    content.addEventListener("pointerup", end);
    content.addEventListener("pointercancel", end);
  }
  return { getPlace, setPlace, placeSettled, frameKeyed, selectedKeyName, timelineSummary, timeline, keyName, renderTimelineDialog, currentPose, grabThumb, showKey, followPlayhead, timelineOpen };
}
