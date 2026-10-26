// The camera over time: a move or a timeline previewed in the viewport, a
// pose and a moment on the timeline applied to the scene, and the MP4 the
// Video tab records. Moved out of src/scene.js's BoothScene as it was
// (SCENE_SPLIT_PHASE.md, seam 3): `this` is the scene, and src/scene.js
// installs these on its prototype with `mixin`.
import { frameTimes, resolveMove, samplePath } from "../camera-path.js";
import { fadeAt, isTimeline, sampleTimeline, timelineSeconds } from "../timeline.js";
import { DEFAULT_SIZE, SIZES, evenSize, recordMp4, videoSupported } from "../video.js";
import { DEFAULT_FRAME, frameSize } from "../framing.js";
export const video = {
  // The framing as a keyframe would hold it, and the way back to one. Both are
  // here rather than in main.js because the camera and its controls are this
  // class's to touch — a panel that set camera.position itself would be fighting
  // OrbitControls for the same state.
  pose() {
    return { position: this.camera.position.toArray(), target: this.controls.target.toArray() };
  },
  /**
   * One moment of a timeline in the viewport — its pose, and its fade and
   * flare — for the scrub. Asked for so that scrubbing through the start or
   * the end of a clip shows the fade rather than a fully lit frame the file
   * will never contain. The fade stays until the camera is next moved by hand
   * (`clearMoment`, from the controls' start event) or the dialog closes, so
   * a scrub left at 0.4 s can be looked at.
   */
  showMoment(timeline, t) {
    const pose = sampleTimeline(timeline, t);
    this.applyPose(pose);
    this.overlay = {
      fade: fadeAt(timeline, t),
      flare: timeline.flare?.on ? this.flareState(timeline.flare.strength, timeline.flare.source) : null,
    };
    this.momentShown = true;
    this.renderFrame();
  },
  clearMoment() {
    if (!this.momentShown) return;
    this.momentShown = false;
    this.overlay = { fade: 1, flare: null };
    this.invalidate?.();
    this.renderFrame();
  },
  applyPose(pose) {
    if (!pose?.position || !pose?.target) return;
    this.stopPreview?.();
    if (this.momentShown) {
      this.momentShown = false;
      this.overlay = { fade: 1, flare: null };
    }
    this.controls.target.set(...pose.target);
    this.camera.position.set(...pose.position);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.renderFrame();
  },
  // Plays a camera move in the viewport at its real duration, so a move can be
  // judged before committing to a render — a 14-second 1440p clip is minutes of
  // encoding, and finding out afterwards that the move was wrong is the whole
  // cost of not having this.
  //
  // Unlike recordVideo this is driven by wall clock, not by frame index, and
  // that is correct here for the same reason it is wrong there: a preview
  // should take the number of seconds it claims even if the machine drops
  // frames doing it, whereas a file must contain every frame it promises.
  previewMove({ move, seconds, from = 0, onProgress = () => {}, signal } = {}) {
    // Any preview already running is stopped *before* the framing is read,
    // because stopping it is what puts the camera back. Reading first would
    // capture a camera halfway through the old move and make that the place
    // this one returns to, displacing the view permanently.
    this.stopPreview?.();
    const base = {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
    };
    // A timeline carries its own length, including its holds; a fixed move has
    // the length it was designed around.
    const duration = Math.max(0.5, seconds ?? (isTimeline(move) ? timelineSeconds(move) : resolveMove(move).seconds)) * 1000;
    const overlay = isTimeline(move) ? move : null;
    const restore = {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      enabled: this.controls.enabled,
    };
    // The live loop is stopped and frames are drawn here instead, for the same
    // reason recordVideo does it: OrbitControls.update() re-derives the camera
    // position from its own spherical state every frame and re-applies
    // minDistance, maxDistance and maxPolarAngle. It would quietly clamp a
    // move — a push-in that starts at 1.75x the orbit radius can exceed
    // maxDistance — and a preview that is clamped where the recording is not
    // is a preview of the wrong clip.
    this.stopLoop();
    // A drag mid-preview would still reach the controls and fight the path.
    this.controls.enabled = false;
    let done = false;
    // `keep` is a pause: the camera stays where the move had got to, for the
    // timeline's Play / Pause, instead of going back to where it started.
    const finish = (keep = false) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(this.previewFrame);
      this.stopPreview = null;
      // The live loop and export() share this renderer, so a fade left at 0.3
      // after a cancelled preview is a viewport that looks broken.
      this.overlay = { fade: 1, flare: null };
      if (!keep) {
        this.camera.position.copy(restore.position);
        this.controls.target.copy(restore.target);
      }
      this.camera.lookAt(this.controls.target);
      this.controls.enabled = restore.enabled;
      this.controls.update();
      this.startLoop();
    };
    return new Promise((resolve) => {
      // Starting part-way — Play from the timeline's playhead — is the same
      // clock started that much earlier.
      const start = Math.min(0.999, Math.max(0, from));
      const started = performance.now() - start * duration;
      let t = start;
      const step = () => {
        if (signal?.aborted) {
          finish();
          return resolve({ cancelled: true });
        }
        // Wall clock, not frame index — the opposite of recordVideo, and right
        // for the opposite reason: a preview should take the seconds it claims
        // even if the machine drops frames, whereas a file must contain every
        // frame it promises.
        t = Math.min(1, (performance.now() - started) / duration);
        const frame = samplePath(move, base, t);
        this.camera.position.set(...frame.position);
        this.controls.target.set(...frame.target);
        this.camera.lookAt(this.controls.target);
        // Fades and flares are functions of t, so the wall-clock preview and the
        // frame-indexed recording get the same answer without sharing a loop.
        this.overlay = overlay
          ? { fade: fadeAt(overlay, t), flare: overlay.flare?.on ? this.flareState(overlay.flare.strength, overlay.flare.source) : null }
          : { fade: 1, flare: null };
        this.renderFrame();
        onProgress(t);
        if (t >= 1) {
          finish();
          return resolve({ cancelled: false });
        }
        this.previewFrame = requestAnimationFrame(step);
      };
      // Cancellable from outside: someone who sees the wrong move in the first
      // second should not have to wait out the rest.
      this.stopPreview = ({ keep = false } = {}) => {
        finish(keep);
        resolve({ cancelled: true, t });
      };
      // The first frame now rather than on the next animation frame: with the
      // live loop drawing on demand, an idle page may be handed its next
      // frame late, and a preview should start the moment it is asked for.
      step();
    });
  },
  async recordVideo({ move, seconds, fps, size, frame = DEFAULT_FRAME, custom, place, settle = true, onProgress = () => {}, signal } = {}) {
    if (!videoSupported())
      throw new Error(
        "This browser cannot encode video. Chrome, Edge and Safari 16.4 or newer can; Export PNG works everywhere.",
      );
    // A preview drives the same camera, so it cannot be left running.
    this.stopPreview?.();
    await Promise.allSettled(this.textureCache.pending());
    const preset = SIZES[size] || SIZES[DEFAULT_SIZE];
    const canvas = this.renderer.domElement;
    // The frame is chosen now, not inherited from the window. "This window"
    // is still an option and still the default, and it is the old behaviour
    // exactly: the viewport's own aspect, height following width. The named
    // frames — widescreen, vertical, square — state their ratio instead, so a
    // clip for a phone is 1080 x 1920 whatever shape the browser is. Both
    // sides are forced even because H.264 encodes in macroblocks.
    const shape = frameSize(frame, {
      long: preset.height ? Math.max(preset.width, preset.height) : preset.width,
      viewport: canvas.width / canvas.height,
      custom,
    });
    const width = evenSize(shape.width);
    const height = evenSize(shape.height);
    const max = this.renderer.capabilities.maxTextureSize;
    if (width > max || height > max)
      throw new Error("This device cannot render that clip size. Choose 720p.");

    const base = {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
    };
    const clip = frameTimes(seconds ?? (isTimeline(move) ? timelineSeconds(move) : resolveMove(move).seconds), fps);
    // frameTimes still owns the frame count and the exact landing on t=1, even
    // for a timeline that knows its own length: two sources of frame times is
    // how a clip ends a frame early.
    const overlay = isTimeline(move) ? move : null;
    const pixelRatio = this.renderer.getPixelRatio();
    const restore = {
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      target: this.controls.target.clone(),
      aspect: this.camera.aspect,
      fov: this.camera.fov,
      enabled: this.controls.enabled,
      damping: this.controls.enableDamping,
      maxPolar: this.controls.maxPolarAngle,
    };
    const hidden = [];
    this.group.traverse((o) => {
      if (o.isLineSegments || o.userData.editorOnly) {
        hidden.push(o);
        o.visible = false;
      }
    });
    // The live loop must not render between frames: it would fight this method
    // for the camera and for the framebuffer the encoder is about to read.
    this.stopLoop();
    this.controls.enabled = false;
    // Damping interpolates towards a target over wall-clock time. On a path
    // driven frame by frame it would smear every frame towards the last one.
    this.controls.enableDamping = false;
    // Same rule as `export()`: a recording is a delivered file, so full
    // quality goes back before the first frame is drawn and draft mode is
    // restored afterwards. A clip is rendered offline anyway — nothing about
    // it is timed against this machine — so there is nothing to gain by
    // leaving the shadows off and a whole clip to lose.
    const wasDraft = this.draft;
    this.setDraft(false);
    const wasBarShadows = this.barShadows;
    this.setBarShadows(true);
    try {
      // The clip is exactly what the frame guide outlines in the viewport —
      // wherever it has been dragged to and however big — so the camera keeps
      // the viewport's own projection and renders only that rectangle of it.
      const viewW = canvas.width,
        viewH = canvas.height;
      const frameId = frame;
      const rect = this.frameRect(frameId, viewW, viewH, width / height, place);
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = viewW / viewH;
      this.camera.setViewOffset(viewW, viewH, rect.x, rect.y, rect.width, rect.height);
      this.showRenderRect(rect, viewW, viewH);
      const recorded = await recordMp4({
        count: clip.count,
        fps,
        width,
        height,
        bitrate: preset.bitrate,
        onProgress,
        signal,
        drawFrame: (i) => {
          const t = clip.at(i);
          const frame = samplePath(move, base, t);
          this.overlay = overlay
            ? { fade: fadeAt(overlay, t), flare: overlay.flare?.on ? this.flareState(overlay.flare.strength, overlay.flare.source) : null }
            : { fade: 1, flare: null };
          this.camera.position.set(...frame.position);
          this.controls.target.set(...frame.target);
          this.camera.lookAt(this.controls.target);
          // A timeline with a keyframed frame moves the frame too: this
          // frame's rectangle of the view, sampled with its pose.
          if (frame.place) {
            const r = this.frameRect(frameId, viewW, viewH, width / height, frame.place);
            this.camera.setViewOffset(viewW, viewH, r.x, r.y, r.width, r.height);
            this.showRenderRect(r, viewW, viewH);
          }
          this.camera.updateProjectionMatrix();
          // Shadows are static between edits, so the map is refreshed once per
          // frame here rather than never: the lights do not move, but the
          // camera does, and a cascade that was fit to the old view would
          // crawl across the floor.
          this.renderer.shadowMap.needsUpdate = true;
          this.renderFrame();
          return canvas;
        },
        // Careful rendering. Reported as glitches on export: a frame captured
        // while a texture upload, a shadow map or the backdrop's second pass
        // was still landing comes out with a wall, a shadow or the
        // surroundings from the frame before. Drawing each frame a second
        // time, after yielding to the browser, costs roughly double the
        // encode and buys a frame whose GPU work has certainly finished. It
        // is a setting rather than a rule because on a fast machine it is
        // paying twice for nothing.
        settleFrame: settle
          ? async () => {
              await new Promise((r) => setTimeout(r, 0));
              this.renderFrame();
            }
          : null,
      });
      return { ...recorded, width, height, fps, seconds: clip.count / fps };
    } finally {
      // Restored here and not on the happy path only: a cancelled recording
      // must not leave the viewport faded or flaring.
      this.overlay = { fade: 1, flare: null };
      hidden.forEach((o) => (o.visible = true));
      this.camera.position.copy(restore.position);
      this.camera.quaternion.copy(restore.quaternion);
      this.controls.target.copy(restore.target);
      this.camera.clearViewOffset();
      this.clearRenderRect();
      this.camera.aspect = restore.aspect;
      this.camera.fov = restore.fov;
      this.controls.maxPolarAngle = restore.maxPolar;
      this.controls.enableDamping = restore.damping;
      this.controls.enabled = restore.enabled;
      this.renderer.setPixelRatio(pixelRatio);
      this.resize();
      this.controls.update();
      this.renderer.shadowMap.needsUpdate = true;
      this.setBarShadows(wasBarShadows);
      this.setDraft(wasDraft);
      this.startLoop();
    }
  },
};
