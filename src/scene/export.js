// What leaves the app as a file: the booth as a .glb, the still export at
// its frame and size, and the AI render passes (depth, surfaces) — plus the
// frame guide the viewport shows while composing one. Moved out of
// src/scene.js's BoothScene as it was (SCENE_SPLIT_PHASE.md, seam 2): `this`
// is the scene, and src/scene.js installs these on its prototype with `mixin`.
import * as T from "three";
import { SURFACES, TAG_SURFACE } from "../ai-render.js";
import { DEFAULT_FRAME, FRAMES, frameSize, placeRect } from "../framing.js";
const FRAMES_WITH_SHAPE = (id) => !!FRAMES[id] && id !== DEFAULT_FRAME;
export const exportPasses = {
  /**
   * The booth as a binary glTF (.glb), for SketchUp, Blender, an AR viewer or
   * a fabricator: the booth, the work, the furniture, the figures and any
   * models — not the surroundings, the ground, the lights, the drawn drop
   * shadows or anything editor-only, and nothing a hidden tag has taken out.
   * Metres, which is glTF's unit.
   */
  async exportGLB() {
    const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
    const off = [];
    this.group.traverse((o) => {
      if (o === this.group || !o.visible) return;
      const drop =
        o.isLight ||
        o.userData.editorOnly ||
        o.userData.artShadow ||
        o.userData.tag === "surroundings" ||
        o.name === "environment-ground" ||
        o.name === "underlay" ||
        (!o.isGroup && (o.layers.mask & 1) === 0);
      if (drop) {
        o.visible = false;
        off.push(o);
      }
    });
    try {
      const result = await new GLTFExporter().parseAsync(this.group, { binary: true, onlyVisible: true });
      return new Blob([result], { type: "model/gltf-binary" });
    } finally {
      for (const o of off) o.visible = true;
    }
  },
  // Records a filmic camera move to an MP4.
  //
  // Frames are rendered offline, one at a time, and handed to the encoder with
  // exact presentation times — never captured from a live canvas. A booth with
  // a photographic backdrop and two spotlights does not render inside 33 ms on
  // most machines, and a live capture would bake that machine's frame rate into
  // the file as stutter or slow motion. Rendering offline costs the user a
  // progress bar and buys a clip that is the same on every machine.
  //
  // The camera, the controls and the editor's own overlays are all restored in
  // a finally block: this drives the same camera the user is holding, and
  // leaving it parked mid-move after a cancelled recording would look like the
  // viewport had broken.
  /**
   * The rectangle of a `viewW` x `viewH` viewport an export renders: the
   * whole viewport for "This window", otherwise the frame guide's rectangle —
   * the chosen shape, placed where it was dragged. See placeRect.
   */
  /**
   * While a file renders, the canvas's drawing buffer holds only the export's
   * rectangle of the view, and the browser stretches it over the whole
   * viewport — reported as the export "not showing the proper framing" while
   * it runs, though the file was right. The canvas is scaled into that
   * rectangle instead, so the picture sits exactly inside the frame guide,
   * and `onRenderRect` tells main.js where, so the guide follows a frame
   * that is keyframed. Fractions of the viewport; `clearRenderRect` undoes it.
   */
  showRenderRect(rect, viewW, viewH) {
    const style = this.renderer.domElement.style;
    style.transformOrigin = "0 0";
    style.transform = `translate(${(rect.x / viewW) * 100}%, ${(rect.y / viewH) * 100}%) scale(${rect.width / viewW}, ${rect.height / viewH})`;
    this.onRenderRect?.({ x: rect.x / viewW, y: rect.y / viewH, width: rect.width / viewW, height: rect.height / viewH });
  },
  clearRenderRect() {
    this.renderer.domElement.style.transform = "";
    this.onRenderRect?.(null);
  },
  frameRect(frame, viewW, viewH, aspect, place) {
    if (frame === DEFAULT_FRAME || !FRAMES_WITH_SHAPE(frame)) return { x: 0, y: 0, width: viewW, height: viewH };
    return placeRect(viewW, viewH, aspect, place);
  },
  /**
   * The AI-render hook's three pictures of one frame (src/ai-render.js):
   * the frame as rendered, its depth pass and its surface mask, each a PNG
   * Blob at the same size through the same camera and frame, so they line
   * up pixel for pixel. Returns them with the depth range used.
   */
  async renderPasses(long, options = {}) {
    const out = {};
    for (const pass of ["beauty", "depth", "mask"]) out[pass] = await this.export(long, { ...options, pass });
    return { ...out, depthRange: this.lastDepthRange };
  },
  /**
   * What one mesh is, for the mask: the nearest `userData.surface` up its
   * ancestry (the show floor sets them), else artwork by its art id, a tag's
   * surface, a wall the pickers know, the ground, or tent canvas; anything
   * else of the booth is its structure.
   */
  surfaceOf(o) {
    const walls = new Set([...(this.wallObjects || []), ...(this.rowWallObjects || [])]);
    for (let x = o; x && x !== this.group; x = x.parent) {
      if (x.userData?.surface) return x.userData.surface === "hall" ? "wall" : x.userData.surface;
      if (x.userData?.artId) return "artwork";
      if (walls.has(x)) return "wall";
      if (x.name === "environment-ground") return "floor";
      if (x.userData?.fabric) return "tent";
      if (x.userData?.tag && TAG_SURFACE[x.userData.tag]) return TAG_SURFACE[x.userData.tag];
    }
    return "booth";
  },
  /**
   * Turn the scene into a depth pass or a surface mask for one render, and
   * return what undoes it. Editor-only lines, sprites the mask has no class
   * for and the fade overlay are out; the backdrop is black, which is
   * "nothing" in both.
   */
  applyPass(pass) {
    const restore = [];
    const saved = { background: this.scene.background, fog: this.scene.fog, override: this.scene.overrideMaterial, overlay: this.overlay, env: this.scene.environment };
    this.scene.background = new T.Color("#000000");
    this.scene.fog = null;
    this.overlay = { fade: 1, flare: null };
    const made = [];
    if (pass === "depth") {
      // Linear depth between the nearest and farthest thing in view, near
      // white: measured from the camera to the scene's bounding sphere, so a
      // booth fills the whole grey range rather than the first centimetres.
      this.group.updateMatrixWorld(true);
      const box = new T.Box3();
      this.group.traverse((o) => {
        // The grounds run far past anything on them (the booth's is 180 m
        // across) and would squeeze the booth into the first few greys;
        // they are measured by what stands on them instead.
        const ground = o.name === "environment-ground" || o.name === "show-ground" || o.userData?.tag === "surroundings";
        if ((o.isMesh || o.isInstancedMesh) && !ground && o.visible && o.layers.test(this.camera.layers)) {
          let shown = true;
          for (let x = o; x; x = x.parent) if (!x.visible) shown = false;
          if (shown) box.expandByObject(o);
        }
      });
      const sphere = box.getBoundingSphere(new T.Sphere());
      const d = this.camera.position.distanceTo(sphere.center);
      const near = Math.max(0.05, d - sphere.radius),
        far = Math.max(near + 0.5, d + sphere.radius);
      this.lastDepthRange = { near, far };
      const m = new T.ShaderMaterial({
        uniforms: { uNear: { value: near }, uFar: { value: far } },
        vertexShader: "varying float vDepth;\n#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <project_vertex>\nvDepth = -mvPosition.z;\n}",
        fragmentShader: "uniform float uNear;\nuniform float uFar;\nvarying float vDepth;\nvoid main() {\nfloat d = clamp((vDepth - uNear) / (uFar - uNear), 0.0, 1.0);\ngl_FragColor = vec4(vec3(1.0 - d), 1.0);\n}",
        side: T.DoubleSide,
        toneMapped: false,
      });
      made.push(m);
      this.scene.overrideMaterial = m;
      this.group.traverse((o) => {
        if (o.isSprite && o.visible) (o.visible = false), restore.push(() => (o.visible = true));
      });
    } else {
      const byClass = {};
      const flat = (k) => (byClass[k] ||= (made.push(new T.MeshBasicMaterial({ color: SURFACES[k]?.color || SURFACES.booth.color, side: T.DoubleSide, toneMapped: false })), made.at(-1)));
      this.scene.environment = null;
      this.group.traverse((o) => {
        if (o.isSprite) {
          const m = o.material;
          const k = o.userData.surface === "label" ? "label" : null;
          if (!k) return;
          const sm = new T.SpriteMaterial({ color: SURFACES.label.color, toneMapped: false, depthWrite: false });
          made.push(sm);
          o.material = sm;
          restore.push(() => (o.material = m));
          return;
        }
        if (!o.isMesh) return;
        const m = o.material;
        o.material = flat(this.surfaceOf(o));
        restore.push(() => (o.material = m));
        if (o.instanceColor) {
          const c = o.instanceColor;
          o.instanceColor = null;
          restore.push(() => (o.instanceColor = c));
        }
      });
    }
    this.group.traverse((o) => {
      if ((o.isLine || o.isLineSegments || o.isPoints) && o.visible) (o.visible = false), restore.push(() => (o.visible = true));
    });
    return () => {
      for (const r of restore) r();
      Object.assign(this.scene, { background: saved.background, fog: saved.fog, overrideMaterial: saved.override, environment: saved.env });
      this.overlay = saved.overlay;
      for (const m of made) m.dispose();
    };
  },
  /**
   * A still.
   *
   * `long` is the longer side in pixels — the old "4096 px wide", generalised,
   * because a vertical phone frame at 4096 wide would be 7281 tall and no
   * device will render it. `frame` names the shape: "view" keeps the window's
   * own aspect, which is what this always did, and the rest state a ratio and
   * get the camera set up for it. A camera whose aspect is not the canvas's is
   * the whole bug behind a stretched export, so it is set here and restored in
   * the finally beside everything else.
   */
  async export(long, { frame = DEFAULT_FRAME, custom, place, pose, pass = "beauty" } = {}) {
    await Promise.allSettled(this.textureCache.pending());
    const canvas = this.renderer.domElement,
      w = canvas.width,
      h = canvas.height;
    const shape = frameSize(frame, { long, viewport: w / h, custom });
    const width = shape.width,
      height = shape.height;
    const max = this.renderer.capabilities.maxTextureSize;
    if (width > max || height > max)
      throw new Error(
        "This device cannot render that export size. Choose 2048 px.",
      );
    // An export is the artefact someone shows a jury. Draft mode is about how
    // this machine feels to drag on, and it has no business in a delivered
    // file: a booth exported with the shadows switched off is not the booth.
    // Below the size check, so a refused export leaves the mode as it found it.
    const wasDraft = this.draft;
    this.setDraft(false);
    const wasBarShadows = this.barShadows;
    this.setBarShadows(true);
    const pixel = this.renderer.getPixelRatio();
    const wasAspect = this.camera.aspect,
      wasFov = this.camera.fov;
    const hidden = [];
    this.group.traverse((o) => {
      if (o.isLineSegments || o.userData.editorOnly) {
        hidden.push(o);
        o.visible = false;
      }
    });
    // A queued still carries the view it was queued from. The camera is
    // put there for the one render and back afterwards, in the finally.
    const home = pose ? this.pose() : null;
    if (pose) {
      this.controls.target.set(...pose.target);
      this.camera.position.set(...pose.position);
      this.camera.lookAt(this.controls.target);
      this.camera.updateMatrixWorld();
    }
    try {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, height, false);
      // Same rule as a clip: the still is exactly what the frame guide
      // outlines, rendered as that rectangle of the viewport's own view. An
      // orthographic view gets it too, which also keeps a Plan export from
      // stretching when the frame is not the window's shape.
      const rect = this.frameRect(frame, w, h, width / height, place);
      this.camera.setViewOffset(w, h, rect.x, rect.y, rect.width, rect.height);
      this.showRenderRect(rect, w, h);
      // Once, unlike a recorded frame. `toBlob` reads the canvas back, and a
      // readback flushes everything the GPU still owed — so a still cannot
      // catch a half-finished frame the way a captured video frame can. A
      // second draw at 4096 px costs as much again as the first and buys
      // nothing; it also took the export past the browser suite's timeout,
      // which is how this was found.
      const undoPass = pass === "beauty" ? null : this.applyPass(pass);
      try {
        this.renderFrame();
      } finally {
        undoPass?.();
      }
      return await new Promise((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("Export failed. Try 2048 px."))),
          "image/png",
        ),
      );
    } finally {
      hidden.forEach((o) => (o.visible = true));
      if (home) {
        this.controls.target.set(...home.target);
        this.camera.position.set(...home.position);
        this.camera.lookAt(this.controls.target);
        this.controls.update();
      }
      this.renderer.setPixelRatio(pixel);
      this.camera.clearViewOffset();
      this.clearRenderRect();
      if (this.camera.isPerspectiveCamera) {
        this.camera.aspect = wasAspect;
        this.camera.fov = wasFov;
      }
      this.resize();
      this.setBarShadows(wasBarShadows);
      this.setDraft(wasDraft);
    }
  },
};
