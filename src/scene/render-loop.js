// The render loop and what it costs: drawing a frame only when something
// asked for one (invalidate, the heartbeat, startLoop and tick), the draft
// quality a drag or an edit drops to and lets go of, the adaptive quality
// that measures its way down, the backdrop's wider lens, the lens flare
// overlay, the drawn drop shadows, and releasing a rebuilt booth's old group
// from the GPU. Moved out of src/scene.js's BoothScene as it was, with the
// module-level helpers only these methods read (SCENE_SPLIT_PHASE.md, seam
// 8): `this` is the scene, and src/scene.js installs these on its prototype
// with `mixin`.
import * as T from "three";
import { SHADOW_GLSL, SHADOW_KINDS, shadowPlan, shadowSpec } from "../dropshadow.js";
import { IN, lightVisible } from "../model.js";
import { showReach } from "../show-scene.js";
import { flareGhosts, flareOrigin } from "../flare.js";
import { AUTO_QUALITY, stepDown } from "../adaptive.js";
// One soft disc, drawn once into a canvas and shared by every ghost. A flare is
// the only thing in this app that wants a texture nothing else can supply, and
// a 128px gradient is cheaper to make here than to ship as a file.
let RADIAL;
function radialTexture() {
  if (RADIAL) return RADIAL;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  RADIAL = new T.CanvasTexture(canvas);
  RADIAL.colorSpace = T.SRGBColorSpace;
  return RADIAL;
}

// The backdrop is drawn in a pass of its own, with a field of view wider than
// the camera's. Two problems share that one cause. A spherical photograph sits
// at infinity, so field of view alone frames it — which is why a 62 degree
// view of a 1024px equirectangular image shows only 62/360 of it, about 176
// pixels, stretched across the whole canvas. Everything in it therefore looks
// both magnified and soft, and no camera move can pull it back. Widening the
// view of the backdrop alone pulls the environment back and cuts the
// magnification with it, without putting a wide-angle lens on the booth, which
// is the thing actually being measured. `framing` is a percentage: 100 matches
// the camera exactly, and smaller is wider.
//
// This buys back magnification; it cannot add detail the file never had. The
// backdrops are prepped from Poly Haven's 1K HDRIs, so bg.jpg is 1024x512.
// Re-prepping from the 4K download is the rest of the fix — see
// docs/HDRI-ASSETS.md.
export const BACKDROP_FRAMING = 65;
// How far the zoom can be pulled back. Tried at 15 and rejected by eye: a lens
// that wide shears an equirectangular lookup badly enough that the hall ceiling
// smears into streaks. 25 is the widest that still reads as a room.
export const BACKDROP_FRAMING_MIN = 25;
// ...but 25 was judged on a level camera, and that is only half the rule.
//
// What shears an equirectangular lookup is not the lens on its own: it is how
// far from the horizon the frame's edge reaches. The edge sits at
// |pitch| + fov/2, so a 135 degree backdrop lens is fine looking straight out
// and catastrophic tilted 12 degrees down — the frame edge passes 79 degrees,
// into the pole, where a whole row of pixels is one point and the ceiling
// smears into radial streaks. That is the "weird artifact" the wide zoom
// produced in practice, and no framing percentage alone can prevent it.
//
// So the limit is stated where it actually lives, as an angle from the
// horizon, and the backdrop lens is narrowed per frame to respect it. Tilt
// far enough and the backdrop simply stops widening — it falls back towards
// the camera's own lens, which is the one-pass behaviour that never shears.
export const BACKDROP_EDGE_LIMIT = 52;
export function safeBackdropFov(cameraFov, wideFov, pitch, limit = BACKDROP_EDGE_LIMIT) {
  const pitchDegrees = Math.abs(((Number(pitch) || 0) * 180) / Math.PI);
  const allowed = 2 * Math.max(0, (Number(limit) || BACKDROP_EDGE_LIMIT) - pitchDegrees);
  // Never narrower than the camera's own lens: the backdrop pass exists to
  // widen, and matching the camera is the same picture the single pass draws.
  return Math.max(cameraFov, Math.min(wideFov, allowed));
}
// Drawing the backdrop through a wider lens has a side effect that reads as a
// second bug: the horizon slides.
//
// A direction at angle θ from the lens axis lands at tan(θ)/tan(fov/2) of the
// way to the frame edge. The booth is drawn at the camera's own field of view
// and the backdrop at a wider one, so the same pitch moves the booth further up
// the screen than it moves the backdrop — tilt the camera down and the
// photographed horizon appears to climb out of the floor, which is the one
// thing in the frame that should be nailed to it.
//
// The fix is to over-rotate the backdrop camera by exactly the ratio of those
// two tangents, so a world direction lands in the same place in both passes.
// It is exact at the centre of frame and very close across it; nothing can be
// exact everywhere, because two lenses are two projections.
//
// Only pitch. Yaw could be scaled by the same argument, but a 360 degree orbit
// would then spin the backdrop nearly twice — the horizon is what drifts and
// the horizon is what this locks.
//
// The correction is bounded by the same edge limit, and for the same reason:
// over-rotating a wide lens is the fastest way into the pole. Where the bound
// bites, the horizon drifts a little rather than shearing a lot — a compromise
// that only appears at tilts where there was no un-sheared answer anyway.
export const lockedPitch = (pitch, fov, wideFov, limit = BACKDROP_EDGE_LIMIT) => {
  const narrow = Math.tan((Math.min(179, Math.max(1, fov)) * Math.PI) / 360);
  const wide = Math.tan((Math.min(179, Math.max(1, wideFov)) * Math.PI) / 360);
  if (!(narrow > 0) || !(wide > 0)) return pitch;
  // No widening, nothing to correct: the backdrop is the camera's own lens and
  // the single pass already agrees with itself.
  if (wide <= narrow) return pitch;
  // Clamped to a quarter turn: past that the scaling is asking a lens to show
  // something behind it, and atan would fold the image over.
  const clamped = Math.min(Math.PI / 2.2, Math.max(-Math.PI / 2.2, pitch));
  const corrected = Math.atan(Math.tan(clamped) * (wide / narrow));
  const ceiling = Math.max(0, (((Number(limit) || BACKDROP_EDGE_LIMIT) * Math.PI) / 180) - (wideFov * Math.PI) / 360);
  return Math.min(ceiling, Math.max(-ceiling, corrected));
};
export const backdropFov = (fov, framing = BACKDROP_FRAMING) => {
  const clamped = Math.min(100, Math.max(BACKDROP_FRAMING_MIN, Number(framing) || BACKDROP_FRAMING));
  const half = Math.atan(Math.tan((fov * Math.PI) / 360) / (clamped / 100));
  return Math.min(160, (half * 360) / Math.PI);
};
// Only a spherical photograph is framed by field of view. A flat colour or the
// procedural sky gradient has nothing to reframe, so it stays in the one pass.
export const isPanorama = (background) =>
  !!background &&
  background.isTexture === true &&
  (background.mapping === T.EquirectangularReflectionMapping ||
    background.mapping === T.EquirectangularRefractionMapping);
// Quality is a supersampling factor, not a ceiling: on a 1x monitor asking for
// min(devicePixelRatio, 2) renders at 1 and aliases. Capped at 3 because the
// cost is per pixel and a phone does not need 9x the fragments.
// "auto" asks for the same factor Balanced does; the scene then measures its
// way down from there (see src/adaptive.js).
export const renderScale = (quality = 2) =>
  Math.min(Math.max(devicePixelRatio || 1, quality === AUTO_QUALITY ? 2 : quality), 3);
// How long the viewport keeps a once-a-second heartbeat after the last thing
// that asked it to draw. See `startLoop`.
const HEARTBEAT_MS = 1000;
const HEARTBEAT_FOR_MS = 15000;
// During a drag every shadow map is redrawn every other frame, and a map's
// cost is its pixel count: a 1024 map drawn at 512 is a quarter of the work.
// The shadow is softer while the piece moves and sharp again the moment it is
// let go, which is when anyone judges it.
const DRAG_SHADOW_SIZE = 512;
// How long an asked-for frame may wait on the browser before a timer draws it.
const KICK_MS = 50;
// The longest a rebuilt booth's old group waits on a load before it is
// released anyway. See `disposeGroup`.
const RETIRE_MAX_MS = 10000;
// And the most retired groups held at once.
const RETIRE_KEEP = 3;
/**
 * A drawn drop shadow's material: black, with its alpha computed per
 * fragment from the plane's own position (src/dropshadow.js, SHADOW_GLSL).
 * MeshBasicMaterial rather than a ShaderMaterial so opacity, fog, tone
 * mapping and the colour space all work as they do for every other
 * material; the hook only multiplies the alpha. Each material carries its
 * own uniforms, and the fixed cache key makes every shadow share one program,
 * which is what lets a rebuild keep it (see `disposeGroup`).
 */
function shadowMaterial() {
  const material = new T.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    // On the wall, not in it: writing depth would make the plane fight the
    // artwork in front of it at grazing angles.
    depthWrite: false,
  });
  material.userData.shadow = {
    shadowExtent: { value: new T.Vector2() },
    shadowPlane: { value: new T.Vector2() },
    shadowSigma: { value: 0.01 },
  };
  material.onBeforeCompile = shadowShader;
  material.customProgramCacheKey = shadowProgramKey;
  return material;
}
function shadowShader(shader) {
  Object.assign(shader.uniforms, this.userData.shadow);
  shader.vertexShader =
    "uniform vec2 shadowPlane;\nvarying vec2 vShadowPos;\n" +
    shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n\tvShadowPos = position.xy * shadowPlane;",
    );
  shader.fragmentShader =
    SHADOW_GLSL +
    shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\n\tdiffuseColor.a *= shadowBox(vShadowPos, shadowExtent, shadowSigma);",
    );
}
function shadowProgramKey() {
  return "booth-drop-shadow-1";
}
/**
 * Stand one shadow plane where its plan says, relative to the centre of the
 * work at its wall gap: back to the wall face and a hair in front of it. The
 * shadow under sits a hair nearer than the one behind, so the two never
 * trade places at a grazing angle.
 */
function placeShadow(mesh, spec, a) {
  const plan = shadowPlan(spec, a);
  const u = mesh.material.userData.shadow;
  u.shadowExtent.value.set(plan.halfW * IN, plan.halfH * IN);
  u.shadowPlane.value.set(plan.width * IN, plan.height * IN);
  u.shadowSigma.value = plan.sigma * IN;
  mesh.scale.set(plan.width * IN, plan.height * IN, 1);
  mesh.material.opacity = plan.opacity;
  mesh.visible = plan.on;
  mesh.position.set(
    plan.dx * IN,
    plan.dy * IN,
    -((a.offset + a.thickness / 2) * IN + 0.003) + (mesh.userData.shadowKind === "under" ? 0.002 : 0.0015),
  );
}
/** Release everything a retired booth group holds on the GPU. */
function disposeTree(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        { if (m.userData.ownedMap) m.map?.dispose(); m.dispose(); },
      );
    }
    if (o.isLight) o.shadow?.dispose();
    o.userData.dispose?.();
  });
}
export const renderLoop = {
  // The live loop, in one place: the video recorder stops it so that nothing
  // renders between the frames it is encoding, and starts it again afterwards.
  /**
   * Draft mode: the viewport's quality escape hatch, and the honest answer to
   * "dragging still stutters on my machine".
   *
   * Two things cost a nine-head art-show booth most of its frame, and neither
   * of them is the geometry:
   *
   * - **Every shadow-casting light is a depth pass.** A drag refreshes the
   *   shadow maps once a drawn frame (`touchShadows`), so the cast shadow
   *   follows the work — and every one of those frames pays for them all.
   * - **Quality is a supersampling factor.** At Balanced the renderer draws
   *   four fragments for every pixel on the 1x monitor most desktops have.
   *
   * Draft mode drops both. It is a view setting and not a project one: it is
   * not in the backup, not in the undo history and not in schema 1, because
   * how fast someone's laptop is has nothing to do with what their booth
   * looks like. For the same reason it cannot reach an export — see
   * `export()` and `recordMp4()`, which both put full quality back first.
   *
   * What it deliberately does not touch: the backdrop's own pass. Skipping it
   * would change how the hall is framed, and a picture that reframes itself
   * when you pick up a tool is worse than one that renders a little slower.
   */
  setDraft(on) {
    const draft = !!on;
    if (draft === this.draft) return;
    this.draft = draft;
    this.renderer.shadowMap.enabled = !draft;
    this.renderer.setPixelRatio(draft ? 1 : this.previewScale());
    // Whether a material samples a shadow map is compiled into its program,
    // so flipping `shadowMap.enabled` under a built scene is not enough on its
    // own: without this the booth keeps drawing the shadows it was compiled
    // with, and turning them back on leaves them missing. One recompile on a
    // button press is a hitch nobody minds; per frame it would be the bug.
    this.scene.traverse((o) => {
      const m = o.material;
      if (!m) return;
      if (Array.isArray(m)) m.forEach((one) => (one.needsUpdate = true));
      else m.needsUpdate = true;
    });
    if (!draft) this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  },
  /**
   * Who decides when fast edit is on. **auto** is the default and is the
   * gesture answering for itself: arming a work's handles turns it on,
   * letting go of that work turns it off, so the quality drop lasts exactly
   * as long as the arranging does. **on** and **off** are the lock beside the
   * toolbar button — someone who has judged it for their own machine should
   * not have it changed back under them, in either direction.
   *
   * The policy is a view setting like the mode it governs: not in the backup,
   * not in the undo history, not in schema 1.
   */
  setDraftPolicy(policy) {
    this.draftPolicy = ["auto", "on", "off"].includes(policy) ? policy : "auto";
    if (this.draftPolicy === "on") this.setDraft(true);
    if (this.draftPolicy === "off") this.setDraft(false);
    return this.draftPolicy;
  },
  /**
   * The armed work is no longer being arranged. Under the auto policy that is
   * the end of fast edit; under a lock it changes nothing but the handles.
   */
  letGoOfArt() {
    this.scaleId = null;
    this.releaseDraft();
  },
  /** A gesture is starting on a piece of artwork. */
  armDraft() {
    if ((this.draftPolicy || "auto") === "auto") this.setDraft(true);
  },
  /** That artwork has been let go of. */
  releaseDraft() {
    if ((this.draftPolicy || "auto") === "auto") this.setDraft(false);
  },
  /**
   * Preview quality, remembered so draft mode can restore the right one.
   * `AUTO_QUALITY` hands the factor to the frame budget, starting from
   * `autoScale` — which the caller may seed from what an earlier session on
   * this display measured. High detail is also the one setting that draws the
   * light bar's shadows live; see `setBarShadows`.
   */
  setQuality(quality, autoScale) {
    this.quality = quality;
    if (autoScale) this.autoScale = autoScale;
    this.budget.reset();
    if (!this.draft) this.renderer.setPixelRatio(this.previewScale());
    this.setBarShadows(quality === 3);
    this.invalidate();
  },
  /** The supersampling factor the live viewport draws at, outside fast edit. */
  previewScale() {
    return this.quality === AUTO_QUALITY ? this.autoScale : renderScale(this.quality);
  },
  /**
   * Something that casts a shadow has moved: redraw the shadow maps with the
   * next frame.
   *
   * This used to hold the maps still for the length of a drag and refresh
   * them once on release, from when every pointer event re-rendered nine
   * shadow-casting heads. With fast edit off, that left a dragged work's cast
   * shadow on the wall where the work had been until the button came up —
   * reported as "the shadow stays in the original space". Neither reason
   * survives: a drag is applied once per drawn frame (`flushDrag`), so this
   * is at most one refresh a frame, and the light bar's heads cast only at
   * High detail. Fast edit is the answer for a machine that cannot keep up,
   * and it has no shadow maps to refresh at all.
   *
   * During a drag the maps refresh every other drawn frame. On the real
   * machine a refresh on every frame read as "slight stutter, but decent";
   * halving it keeps the shadow following the work (a frame behind at most)
   * rather than holding it until release, which is the bug that was
   * reported. A skipped refresh is owed: the next frame without a move pays
   * it, and so does letting go, so a drag always ends on true shadows.
   */
  touchShadows() {
    if (this.drag) {
      this.dragShadowSkip = !this.dragShadowSkip;
      if (this.dragShadowSkip) {
        this.shadowsOwed = true;
        return;
      }
    }
    this.shadowsOwed = false;
    this.renderer.shadowMap.needsUpdate = true;
  },
  /**
   * Smaller shadow maps for the length of a drag, full size after it. The
   * loop calls this when a drag starts or ends, so no gesture handler has to
   * remember it. A map is reallocated at its new size only when it is thrown
   * away, hence the dispose; the full size is kept on the light so a rebuild
   * mid-drag (which makes new lights at full size) is left alone.
   */
  dragShadowMaps(small) {
    this.smallShadows = small;
    this.scene.traverse((o) => {
      if (!o.isLight || !o.castShadow || !o.shadow) return;
      const size = o.shadow.mapSize;
      if (small) {
        if (size.x <= DRAG_SHADOW_SIZE || o.userData.fullShadow) return;
        o.userData.fullShadow = size.x;
        size.set(DRAG_SHADOW_SIZE, DRAG_SHADOW_SIZE);
      } else {
        const full = o.userData.fullShadow;
        if (!full) return;
        delete o.userData.fullShadow;
        size.set(full, full);
      }
      o.shadow.map?.dispose();
      o.shadow.map = null;
    });
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate(2);
  },
  /** Apply the most recent pointer move, if one arrived since the last frame. */
  flushDrag() {
    const e = this.pendingMove;
    if (!e) return;
    this.pendingMove = null;
    this.applyDrag?.(e);
  },
  /**
   * Ask for the viewport to be drawn. The live loop draws on demand: a booth
   * nobody is touching is the same picture sixty times a second, and drawing
   * it anyway kept a slow machine's GPU pinned — and its inspector sluggish —
   * while nothing moved. `frames` is how many consecutive frames to draw; two
   * covers a change whose effect lands one frame late (a shadow map, a
   * texture upload).
   */
  invalidate(frames = 2) {
    this.framesOwed = Math.max(this.framesOwed || 0, frames);
    this.touchedAt = performance.now();
    // A browser only promises animation frames while it has a reason to make
    // them; with the loop idle, headless Chromium was measured handing out
    // three a second, so a change could wait most of a second to appear. A
    // timer draws the frame if the loop has not within KICK_MS; when frames
    // are flowing the loop gets there first and the timer finds nothing owed.
    if (!this.kick && this.looping)
      this.kick = setTimeout(() => {
        this.kick = null;
        if (this.looping && this.framesOwed > 0) this.tick(performance.now());
      }, KICK_MS);
  },
  /**
   * Everything that can change the picture, wired to `invalidate`. Nothing
   * about how the booth is built had to change for on-demand drawing; what
   * has to be right is this list, so it is deliberately broad:
   *
   * - Any input anywhere on the page. Every inspector control, toolbar
   *   button, key and gesture ends in a scene call synchronously from its
   *   event, so a document-level listener catches all of them, including the
   *   ones main.js makes by assigning to a field.
   * - Every public method that changes what is drawn, wrapped once here
   *   rather than remembered in each of them.
   * - Every asynchronous load that lands in the scene: artwork textures,
   *   surface sets and the lighting preset, on settling either way.
   * - The camera controls' own change event, and a shadow map flagged stale.
   *
   * And a safety net: for fifteen seconds after the last of those, the
   * viewport still draws once a second, so a change nothing above announced
   * shows up late rather than never. After that an idle booth costs nothing.
   */
  watchForChanges() {
    const touch = () => this.invalidate();
    for (const type of ["pointerdown", "pointerup", "click", "dblclick", "input", "change", "keydown", "keyup", "wheel"])
      document.addEventListener(type, touch, { capture: true, passive: true });
    this.controls.addEventListener("change", touch);
    // A scrubbed fade is for looking at, not for orbiting under.
    this.controls.addEventListener("start", () => this.clearMoment());
    for (const name of ["update", "updateArtwork", "updateShadows", "setSelection", "applySelection", "setView", "zoom", "resize",
      "movePerson", "movePedestal", "movePanel", "focusWall", "applyPose", "setDraft", "letGoOfArt", "touchShadows"]) {
      const method = this[name];
      this[name] = (...args) => {
        const result = method.apply(this, args);
        this.invalidate();
        return result;
      };
    }
    // Loads in flight, which `releaseRetired` also waits on. Settling runs
    // before the caller's own `.then` — registered first — and both before the
    // next frame, so the frame that sees zero already has what landed.
    this.loading = 0;
    const done = () => {
      this.loading--;
      touch();
    };
    const settle = (owner, name) => {
      const load = owner[name];
      owner[name] = (...args) => {
        const result = load.apply(owner, args);
        this.loading++;
        Promise.resolve(result).then(done, done);
        return result;
      };
    };
    settle(this, "texture");
    settle(this, "loadCutout");
    settle(this, "loadingModel");
    settle(this.surfaces, "load");
    settle(this.lighting, "apply");
  },
  startLoop() {
    this.looping = true;
    this.invalidate();
    this.lastTick = 0;
    this.renderer.setAnimationLoop((now) => this.tick(now));
  },
  /** Stop the live loop, for a recording or a preview that draws its own frames. */
  stopLoop() {
    this.looping = false;
    this.renderer.setAnimationLoop(null);
  },
  /** One turn of the live loop: draw if anything asked for it. */
  tick(now) {
    const moved = !!this.pendingMove;
    this.flushDrag();
    if (!!this.drag !== !!this.smallShadows) this.dragShadowMaps(!!this.drag);
    if (this.shadowsOwed && (!moved || !this.drag)) {
      this.dragShadowSkip = true;
      this.touchShadows();
    }
    if (this.host.hidden) return;
    this.clampToGround();
    const moving = this.controls.update();
    const due =
      this.framesOwed > 0 ||
      moving ||
      this.renderer.shadowMap.needsUpdate ||
      (now - this.touchedAt < HEARTBEAT_FOR_MS && now - (this.drawnAt || 0) >= HEARTBEAT_MS);
    if (!due) {
      this.lastTick = 0;
      return;
    }
    if (this.framesOwed > 0) this.framesOwed--;
    this.renderFrame();
    // three clears this flag only when it actually redraws a shadow map. With
    // the maps switched off (fast edit) or no light casting, it stays up, and
    // `due` above read it as a frame owed on every tick — so one moved piece
    // in fast edit kept the viewport drawing flat out until fast edit ended,
    // in exactly the mode meant for a machine that cannot afford it. Nothing
    // is lost by dropping it: leaving fast edit and a new caster (a rebuild,
    // `setBarShadows`) each raise it again.
    this.renderer.shadowMap.needsUpdate = false;
    this.drawnAt = now;
    // Only back-to-back frames measure the machine: the gap after an idle
    // stretch is how long nobody touched it, not how long a frame took.
    if (this.lastTick) this.adapt(now - this.lastTick);
    this.lastTick = now;
  },
  /** One measured frame interval, for auto quality. */
  adapt(ms) {
    if (this.quality !== AUTO_QUALITY || this.draft) return;
    if (!this.budget.sample(ms)) return;
    const next = stepDown(this.autoScale);
    if (next === this.autoScale) return;
    this.autoScale = next;
    this.renderer.setPixelRatio(next);
    this.resize();
    this.onAdapt(next);
  },
  // One frame. A spherical backdrop is drawn first, through a wider lens of its
  // own, then the booth over the top of it; see BACKDROP_FRAMING. Anything else
  // — a flat colour, the procedural sky, the orthographic plan view — has
  // nothing to reframe and takes the single pass it always did.
  renderFrame() {
    // The show's booth numbers follow the camera: only the nearest are drawn.
    if (this.show) this.showGroup?.userData.placeLabels?.(this.camera);
    const background = this.scene.background;
    if (
      !this.camera.isPerspectiveCamera ||
      !isPanorama(background) ||
      backdropFov(this.camera.fov, this.backdropFraming) <= this.camera.fov
    ) {
      this.renderer.render(this.scene, this.camera);
      this.renderOverlay();
      this.groupDrawn = true;
      this.releaseRetired(false);
      this.placeAnnotations();
      return;
    }
    this.backdropScene.background = background;
    this.backdropScene.backgroundIntensity = this.scene.backgroundIntensity;
    this.backdropScene.backgroundRotation.copy(this.scene.backgroundRotation);
    this.backdropScene.backgroundRotation.order = this.scene.backgroundRotation.order;
    this.backdropCamera.aspect = this.camera.aspect;
    this.camera.updateMatrixWorld();
    // The lens is chosen with the camera's tilt in hand, not from the framing
    // alone: see BACKDROP_EDGE_LIMIT. A wide lens plus a tilt is what reaches
    // the pole, so the two are bounded together or not at all.
    const tilt = new T.Euler().setFromQuaternion(this.camera.quaternion, "YXZ").x;
    const asked = backdropFov(this.camera.fov, this.backdropFraming);
    // The lens and the lock settle together. The lock rotates the backdrop
    // further than the camera, which pushes the frame edge closer to the pole,
    // so a lens chosen from the camera's own tilt would leave no room for it
    // and the limit would silently switch the lock off at exactly the wide
    // framings that need it. Two passes converge: each narrower lens asks for
    // less correction, and less correction needs less room.
    let lens = safeBackdropFov(this.camera.fov, asked, tilt, this.backdropEdgeLimit);
    if (this.backdropLock)
      for (let i = 0; i < 2; i++)
        lens = safeBackdropFov(
          this.camera.fov,
          asked,
          lockedPitch(tilt, this.camera.fov, lens, this.backdropEdgeLimit),
          this.backdropEdgeLimit,
        );
    this.backdropCamera.fov = lens;
    // An export renders one rectangle of the view (see frameRect); the
    // backdrop pass has to crop the same rectangle or the surroundings would
    // be the whole panorama squeezed into it.
    if (this.camera.view?.enabled) this.backdropCamera.view = { ...this.camera.view };
    else this.backdropCamera.view = null;
    this.backdropCamera.updateProjectionMatrix();
    this.backdropCamera.quaternion.copy(this.camera.quaternion);
    // Horizon lock: see lockedPitch. YXZ, so pitch can be scaled on its own
    // without the yaw rolling the image — the same reason backgroundRotation is
    // a YXZ Euler.
    if (this.backdropLock) {
      const euler = new T.Euler().setFromQuaternion(this.camera.quaternion, "YXZ");
      euler.x = lockedPitch(tilt, this.camera.fov, this.backdropCamera.fov, this.backdropEdgeLimit);
      this.backdropCamera.quaternion.setFromEuler(euler);
    }
    // The booth has to draw over the backdrop rather than clear it away, so
    // autoClear goes off for the second pass. three draws a background with
    // depth writes disabled, so the depth buffer is already clean; clearing it
    // anyway keeps this honest if that ever changes.
    const autoClear = this.renderer.autoClear;
    try {
      this.renderer.autoClear = true;
      this.renderer.render(this.backdropScene, this.backdropCamera);
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.scene.background = null;
      this.renderer.render(this.scene, this.camera);
    } finally {
      this.scene.background = background;
      this.backdropScene.background = null;
      this.renderer.autoClear = autoClear;
    }
    this.renderOverlay();
    this.groupDrawn = true;
    this.releaseRetired(false);
    this.placeAnnotations();
  },
  // The fade and the flare, drawn over a finished frame.
  //
  // After tone mapping, on purpose. A fade implemented by scaling exposure
  // never reaches black — ACES rolls off rather than cutting — so a clip that
  // "ends on black" would end on a dark grey wash that reads as an encoding
  // fault. Drawing actual black over the rendered pixels is the fade a cut is.
  //
  // Nothing is built until something asks for it, so a booth that never records
  // a clip never pays for the geometry or the two textures.
  renderOverlay() {
    const fade = this.overlay?.fade ?? 1;
    const flare = this.overlay?.flare;
    if (fade >= 1 && !flare) return;
    const parts = this.overlayParts();
    parts.fade.material.opacity = Math.min(1, Math.max(0, 1 - fade));
    parts.fade.visible = parts.fade.material.opacity > 0.001;
    const ghosts = flare ? flareGhosts(flare.ndc, { strength: flare.strength, aspect: this.camera.aspect || 1.6 }) : [];
    parts.ghosts.forEach((sprite, i) => {
      const g = ghosts[i];
      sprite.visible = !!g;
      if (!g) return;
      sprite.position.set(g.x, g.y, 0);
      sprite.scale.set(Math.max(0.001, g.width), Math.max(0.001, g.height), 1);
      sprite.material.opacity = g.alpha;
      // Warm at the source, cool down the chain: uncoated glass scatters the
      // long wavelengths first, which is why a real flare is not one colour.
      sprite.material.color.setRGB(1, 0.72 + 0.28 * g.warm, 0.45 + 0.5 * g.warm);
    });
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    try {
      this.renderer.render(parts.scene, parts.camera);
    } finally {
      this.renderer.autoClear = autoClear;
    }
  },
  overlayParts() {
    if (this.overlayCache) return this.overlayCache;
    const scene = new T.Scene();
    // -1..1 in both axes, which is the space src/flare.js computes in.
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    camera.position.z = 0.5;
    const fade = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
    );
    fade.renderOrder = 1;
    scene.add(fade);
    const texture = radialTexture();
    const ghosts = Array.from({ length: 8 }, () => {
      const sprite = new T.Mesh(
        new T.PlaneGeometry(1, 1),
        new T.MeshBasicMaterial({
          map: texture,
          transparent: true,
          // Additive, because a flare is light arriving at the sensor on top of
          // the image, not paint over it.
          blending: T.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          opacity: 0,
        }),
      );
      sprite.visible = false;
      // Under the fade: a flare in a frame that is fading to black fades too.
      sprite.renderOrder = 0;
      scene.add(sprite);
      return sprite;
    });
    this.overlayCache = { scene, camera, fade, ghosts };
    return this.overlayCache;
  },
  // Where the flare comes from this frame, projected into the same -1..1 space
  // the ghosts are placed in. Either the brightest spotlight — which may not
  // exist, and then there is no flare — or the unseen overhead source, which
  // always does: see OVERHEAD in src/flare.js.
  flareState(strength, source) {
    // Hidden spotlights are not in the picture, so a flare cannot come from
    // one: the ghosts would trail from a light nothing is lit by.
    const origin = flareOrigin(source, (this.p?.lights || []).filter(lightVisible));
    if (!origin) return null;
    const ndc = new T.Vector3(origin.x * IN, origin.y * IN, origin.z * IN).project(this.camera);
    return { ndc: { x: ndc.x, y: ndc.y, z: ndc.z }, strength };
  },
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
    // setSize writes the canvas's width and height, and a browser reallocates
    // the drawing buffer on that write even when the numbers have not
    // changed. main.js calls this after every edit, so an unchanged size is
    // left alone; an export, which sizes the canvas behind the renderer's
    // back, still reads as a change.
    const canvas = this.renderer.domElement,
      ratio = this.renderer.getPixelRatio(),
      size = this.renderer.getSize(new T.Vector2());
    if (size.x !== w || size.y !== h || canvas.width !== Math.floor(w * ratio) || canvas.height !== Math.floor(h * ratio))
      this.renderer.setSize(w, h);
    if (this.camera.isPerspectiveCamera) {
      const factor = Math.max(1, h / w);
      if (this.fitAspectFactor)
        this.camera.position
          .sub(this.controls.target)
          .multiplyScalar(factor / this.fitAspectFactor)
          .add(this.controls.target);
      this.fitAspectFactor = factor;
      this.camera.aspect = w / h;
    } else {
      const W = this.p?.booth.width * IN || 3,
        D = this.p?.booth.depth * IN || 3,
        H = this.p?.booth.height * IN || 2.4;
      const reach = this.show ? showReach(this.show) * 1.1 : 0;
      const span = this.show
        ? Math.max(reach * 2, ((reach * 2 * h) / w))
        : this.view === "plan"
          ? Math.max(D * 1.3, ((W * h) / w) * 1.3)
          : Math.max(
              H * 1.25,
              (((this.view === "back" ? W : D) * h) / w) * 1.2,
            );
      this.camera.left = (-span * w) / h / 2;
      this.camera.right = (span * w) / h / 2;
      this.camera.top = span / 2;
      this.camera.bottom = -span / 2;
    }
    this.camera.updateProjectionMatrix();
  },
  /**
   * The drawn shadows a hung work throws onto the wall behind it: one plane
   * per shadow that is switched on, each a child of the work's own group, so
   * it moves, scales and hides with the work and needs nothing per frame.
   *
   * Drawn rather than lit, for the reason src/dropshadow.js states. The shape
   * is computed in the fragment shader — a rectangle blurred by a Gaussian,
   * exactly — so there is no texture to build, cache or size: a thin shadow
   * stays crisp at 4096 px, and every shadow in the booth shares one program
   * (see `shadowMaterial`). A plane is built whenever its shadow is on, even
   * at 0% opacity, so a slider can bring it up without a rebuild.
   */
  artShadows(p, a, parent) {
    for (const kind of SHADOW_KINDS) {
      const spec = shadowSpec(p.booth, kind);
      if (!spec.on) continue;
      const mesh = new T.Mesh(new T.PlaneGeometry(1, 1), shadowMaterial());
      mesh.userData.artShadow = a.id;
      mesh.userData.shadowKind = kind;
      mesh.renderOrder = -1;
      placeShadow(mesh, spec, a);
      parent.add(mesh);
    }
  },
  /**
   * Re-plan every shadow in place from the booth's current settings — what a
   * shadow slider does while it is being dragged. Only numbers change, so no
   * program, geometry or texture is touched; switching a shadow on or off is
   * a rebuild, because that adds or removes planes.
   */
  updateShadows() {
    const specs = Object.fromEntries(SHADOW_KINDS.map((kind) => [kind, shadowSpec(this.p.booth, kind)]));
    for (const [id, entry] of this.artGroups) {
      // The work as its group was built: a group mid-resize carries the rest
      // as its own scale, and the shadow is its child.
      for (const mesh of entry.group.children)
        if (mesh.userData.artShadow === id && specs[mesh.userData.shadowKind])
          placeShadow(mesh, specs[mesh.userData.shadowKind], entry.initial);
    }
  },
  /**
   * Retire the booth's current group and start an empty one.
   *
   * The old group is taken out of the scene at once but its geometry and
   * materials are released only after the new group has been drawn (see
   * `releaseRetired`, called from `renderFrame`). The order is the whole
   * point: three deletes a shader program as soon as the last material using
   * it is disposed, so disposing first threw away every program the booth
   * uses and the next frame compiled them all again — measured at about half
   * of what an edit cost, and on an old GPU the most expensive half. Drawn
   * first, the new materials pick up the same programs and disposing the old
   * ones only lowers a count.
   *
   * Not at the first frame, though: a work's texture lands a moment after the
   * build, and a material that gains a map needs a different program — one
   * the old group was still holding. So the old group waits for every load
   * the build started to settle (counted in `watchForChanges`) and goes with
   * the first frame drawn after that, or after `RETIRE_MAX_MS` if a load
   * never does.
   */
  disposeGroup() {
    this.scene.remove(this.group);
    this.retired ||= [];
    if (this.retired.length && !this.groupDrawn) {
      // Two builds with no frame between them (a burst of edits, a hidden
      // viewport). The group being replaced never drew, so it holds no
      // programs and can go at once; the ones that did draw stay.
      disposeTree(this.group);
    } else {
      this.retired.push(this.group);
      // A long burst of drawn edits while a load is pending is the one way
      // the list could grow; past a few booths the oldest goes regardless.
      while (this.retired.length > RETIRE_KEEP) disposeTree(this.retired.shift());
    }
    this.retiredAt = performance.now();
    this.groupDrawn = false;
    this.group = new T.Group();
    this.scene.add(this.group);
  },
  releaseRetired(force = true) {
    if (!this.retired?.length) return;
    if (!force && this.loading > 0 && performance.now() - this.retiredAt < RETIRE_MAX_MS) return;
    this.retired.splice(0).forEach(disposeTree);
  },
};
