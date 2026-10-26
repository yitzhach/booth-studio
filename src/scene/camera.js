// The camera: the preset views and the show floor's overview, the orbit's
// floor limit, zoom, focusing a wall, auto-pan and the pan tool, and walking
// the booth or the show. Moved out of src/scene.js's BoothScene as it was
// (SCENE_SPLIT_PHASE.md, seam 4): `this` is the scene, and src/scene.js
// installs these on its prototype with `mixin`.
import * as T from "three";
import { IN, findPanel, wallSpec } from "../model.js";
import { walkStart, walkStep } from "../views.js";
import { showOverview, showReach, showWalkStart } from "../show-scene.js";
// The orbit camera may drop below the booth's centre of interest to give a
// low, looking-up perspective. It is stopped by the ground, not by a fixed
// angle: MIN_CAMERA_Y keeps the eye just above the floor plane, and
// MAX_POLAR avoids the up-vector flip OrbitControls suffers near 180 degrees.
const MIN_CAMERA_Y = 0.12;
export const MAX_POLAR = Math.PI * 0.82;
// An equirectangular backdrop is sampled by view direction, so the field of
// view is the only thing that decides how much of it you see — moving the
// camera cannot pull it back. 62 degrees against the old 44 shows about half
// as much again, and frames more of the booth with it.
export const FOV = 62;
export const camera = {
  // Allow the lowest polar angle that still keeps the camera above the floor
  // at its current distance, so orbiting down slides along the ground instead
  // of stopping at eye level or punching through the ground plane.
  clampToGround() {
    // Walking, the camera is at eye height by construction and the head is
    // free to look up at a high work.
    if (this.walking) return;
    if (!this.camera.isPerspectiveCamera || !this.controls.enableRotate) return;
    const radius = this.camera.position.distanceTo(this.controls.target);
    if (!(radius > 0)) return;
    const cos = (MIN_CAMERA_Y - this.controls.target.y) / radius;
    const limit = Math.acos(Math.max(-1, Math.min(1, cos)));
    this.controls.maxPolarAngle = Math.min(MAX_POLAR, limit);
  },
  setView(view) {
    // Any fixed view ends a walk; stopWalk itself comes back through here.
    if (this.walking) this.stopWalk();
    if (this.show) return this.setShowView(view);
    this.controls.maxDistance = 18;
    this.view = view;
    const W = this.p.booth.width * IN,
      D = this.p.booth.depth * IN,
      H = this.p.booth.height * IN;
    const perspective = view === "perspective";
    this.camera = perspective
      ? new T.PerspectiveCamera(FOV, 1, 0.02, 100)
      : new T.OrthographicCamera(-3, 3, 3, -3, 0.01, 100);
    this.controls.object = this.camera;
    this.controls.enableRotate = perspective;
    this.camera.up.set(0, 1, 0);
    if (perspective) {
      this.fitAspectFactor = 1;
      this.camera.position.set(0.25, H * 1.1, D / 2 + Math.max(W, D) * 1.85);
      this.controls.target.set(0, H * 0.62, -D * 0.2);
    } else if (view === "plan") {
      this.camera.position.set(0, 12, 0);
      this.camera.up.set(0, 0, -1);
      this.controls.target.set(0, 0, 0);
      this.orthoSpan = Math.max(W, D) * 1.32;
    } else {
      this.orthoSpan = Math.max(
        H * 1.25,
        (((view === "back" ? W : D) * this.host.clientHeight) /
          Math.max(1, this.host.clientWidth)) *
          1.2,
      );
      if (view === "back") {
        this.camera.position.set(0, H / 2, D / 2 + 0.3);
        this.controls.target.set(0, H / 2, -D / 2);
      }
      if (view === "left") {
        this.camera.position.set(W / 2 - 0.05, H / 2, 0);
        this.controls.target.set(-W / 2, H / 2, 0);
      }
      if (view === "right") {
        this.camera.position.set(-W / 2 + 0.05, H / 2, 0);
        this.controls.target.set(W / 2, H / 2, 0);
      }
    }
    this.controls.update();
    this.resize();
    this.refreshGuides();
  },
  /**
   * The show's two views: the whole floor from above the entrance, in
   * perspective, and the plan from straight overhead. Back, left and right
   * are about one booth's walls and mean nothing on a floor, so they are the
   * perspective view here. The far plane and the orbit's reach grow with
   * the floor.
   */
  setShowView(view) {
    const reach = showReach(this.show);
    this.view = view === "plan" ? "plan" : "perspective";
    const far = Math.max(100, reach * 4);
    if (this.view === "perspective") {
      this.camera = new T.PerspectiveCamera(FOV, 1, 0.02, far);
      this.fitAspectFactor = 1;
    } else {
      this.camera = new T.OrthographicCamera(-3, 3, 3, -3, 0.01, far);
      this.orthoSpan = reach * 2;
    }
    this.controls.object = this.camera;
    this.controls.enableRotate = this.view === "perspective";
    this.controls.maxDistance = reach * 2.5;
    this.camera.up.set(0, 1, 0);
    const pose = showOverview(this.show);
    if (this.view === "perspective") {
      this.camera.position.set(...pose.position);
      this.controls.target.set(...pose.target);
    } else {
      this.camera.position.set(pose.target[0], reach * 2, pose.target[2]);
      this.camera.up.set(0, 0, -1);
      this.controls.target.set(pose.target[0], 0, pose.target[2]);
    }
    this.controls.update();
    this.resize();
    this.refreshGuides();
  },
  /**
   * Walk mode: the camera at a visitor's eye height in the aisle, looking at
   * the booth. The orbit controls orbit a target a centimetre ahead, which is
   * looking round from where you stand; zoom and pan are off, because a
   * visitor walks rather than zooms. `walk(forward, right, inches)` steps.
   * Leaving puts the controls and the view back.
   */
  /**
   * The Pan tool on or off. On, one mouse button or one finger slides the
   * view across the screen the way SketchUp's hand does; the right button
   * and two fingers keep doing what they did. A walk looks round with the
   * left button whatever the tool, so walking puts orbit back for its
   * duration and stopping puts the tool back.
   */
  setPanTool(on) {
    this.panTool = !!on;
    const pan = this.panTool && !this.walking;
    this.controls.mouseButtons.LEFT = pan ? T.MOUSE.PAN : T.MOUSE.ROTATE;
    this.controls.touches.ONE = pan ? T.TOUCH.PAN : T.TOUCH.ROTATE;
  },
  /**
   * The key a walk is remembered under: the show floor's walk and the
   * booth's are different places, and a floor's walk means nothing in a
   * booth.
   */
  walkKey() {
    return this.show ? "show" : "booth";
  },
  startWalk() {
    if (this.walking) return;
    // The orbit view walked away from, so Done comes back to it rather than
    // to the default view.
    const before = this.view === "perspective" && !this.walking ? this.pose() : null;
    this.setView("perspective");
    this.walking = {
      minDistance: this.controls.minDistance,
      maxDistance: this.controls.maxDistance,
      maxPolar: this.controls.maxPolarAngle,
      before,
    };
    this.controls.minDistance = 0.001;
    this.controls.maxDistance = 0.05;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.enableDamping = false;
    this.controls.rotateSpeed = -0.35;
    this.setPanTool(this.panTool);
    // Walking again takes up where the last walk stopped; the first walk
    // starts where a visitor would.
    const last = this.lastWalk[this.walkKey()];
    this.applyPose(last || (this.show ? showWalkStart(this.show) : walkStart(this.p.booth)));
  },
  walk(forward, right, inches) {
    if (!this.walking) return;
    this.applyPose(walkStep(this.pose(), forward, right, inches));
  },
  stopWalk() {
    if (!this.walking) return;
    const w = this.walking;
    this.lastWalk[this.walkKey()] = this.pose();
    this.walking = null;
    this.controls.minDistance = w.minDistance;
    this.controls.maxDistance = w.maxDistance;
    this.controls.maxPolarAngle = w.maxPolar;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.enableDamping = true;
    this.controls.rotateSpeed = 1;
    this.setPanTool(this.panTool);
    this.setView("perspective");
    if (w.before) this.applyPose(w.before);
  },
  /**
   * Auto pan: slide the camera and what it looks at sideways together, at a
   * steady speed, `inches` in `seconds` — to the right (`dir` 1, the view
   * travels left to right) or the left (-1). Sideways is the camera's own
   * right, kept level, so the horizon never tilts. `ease` maps time to
   * distance (linear by default; timeline.js EASES for the others). Any press, wheel or key
   * in the viewport stops it where it is; `onDone(finished)` says whether it
   * ran its full distance. Returns a stop function.
   */
  autoPan({ inches, seconds, dir = 1, ease = (t) => t }, onDone = () => {}) {
    this.stopAutoPan();
    const right = new T.Vector3(...this.panRight());
    const total = Math.max(0, inches) * IN * (dir < 0 ? -1 : 1);
    const ms = Math.max(0.1, seconds) * 1000;
    const start = performance.now();
    let done = 0, raf = 0;
    const c = this.renderer.domElement;
    const stop = (finished = false) => {
      cancelAnimationFrame(raf);
      for (const type of ["pointerdown", "wheel", "keydown"]) c.removeEventListener(type, interrupt);
      if (this.autoPanStop === stop) this.autoPanStop = null;
      onDone(finished);
    };
    const interrupt = () => stop(false);
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const move = total * ease(t) - done;
      done += move;
      this.camera.position.addScaledVector(right, move);
      this.controls.target.addScaledVector(right, move);
      this.controls.update();
      this.invalidate();
      if (t < 1) raf = requestAnimationFrame(step);
      else stop(true);
    };
    for (const type of ["pointerdown", "wheel", "keydown"]) c.addEventListener(type, interrupt);
    this.autoPanStop = stop;
    raf = requestAnimationFrame(step);
    return () => stop(false);
  },
  /** The camera's own right, kept level: the way Auto pan slides. */
  panRight() {
    this.camera.updateMatrixWorld();
    const right = new T.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    right.y = 0;
    if (right.lengthSq() < 1e-9) right.set(1, 0, 0);
    return right.normalize().toArray();
  },
  stopAutoPan() {
    this.autoPanStop?.(false);
  },
  zoom(factor) {
    if (this.camera.isPerspectiveCamera) {
      const offset=this.camera.position.clone().sub(this.controls.target);
      offset.setLength(Math.max(this.controls.minDistance,Math.min(this.controls.maxDistance,offset.length()/factor)));
      this.camera.position.copy(this.controls.target).add(offset);
    } else { this.camera.zoom=Math.max(.3,Math.min(8,this.camera.zoom*factor));this.camera.updateProjectionMatrix(); }
    this.clampToGround();
    this.controls.update();
  },
  focusWall(wall, face = "inside") {
    // A panel stands anywhere and at any angle, so there is no fixed
    // elevation to switch to: frame it from its own face instead, the way an
    // exterior face is already framed.
    const panel = findPanel(this.p, wall);
    if (panel) this.setView("perspective");
    else this.setView(wall);
    if (face !== "outside" && !panel) return;
    const f = this.frames[wall + (face === "outside" ? "-outside" : "")];
    if (!f) return;
    f.updateWorldMatrix(true, false);
    const w = wallSpec(this.p, wall);
    if (!w) return;
    const target = f.localToWorld(new T.Vector3(w.width*IN/2, w.height*IN/2, 0));
    const normal = new T.Vector3(0,0,1).applyQuaternion(f.getWorldQuaternion(new T.Quaternion()));
    this.controls.target.copy(target);
    this.camera.position.copy(target).addScaledVector(normal, 5);
    this.controls.update();
  },
};
