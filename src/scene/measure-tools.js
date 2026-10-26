// Measuring and drawing on the booth: the plan view's dimension lines and the
// tape measure with its kept tapes, the smart guides' snap lines, the box
// tool's preview, and the labels placed over them. Moved out of
// src/scene.js's BoothScene as it was (SCENE_SPLIT_PHASE.md, seam 6): `this`
// is the scene, and src/scene.js installs these on its prototype with `mixin`.
import * as T from "three";
import { IN, findPanel, findPedestal } from "../model.js";
import { distanceInches, formatLength, planDimensions } from "../measure.js";
import { FLOOR } from "./shared.js";
// How many kept tapes the tape measure shows at once (Keep every tape).
export const MAX_TAPES = 24;
export const measureTools = {
  /**
   * The plan view's dimension lines and the tape measure, rebuilt from the
   * booth and the measure's two points. Cheap — a few line segments — so it
   * is simply redone whenever anything they depend on moves. The lines are
   * LineSegments in the booth group, which `export()` and `recordVideo()`
   * already hide; the labels are DOM, which neither ever sees.
   */
  refreshGuides() {
    if (!this.p) return;
    if (this.guides) {
      this.guides.parent?.remove(this.guides);
      this.guides.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    }
    this.guides = new T.Group();
    this.guides.name = "guides";
    this.group.add(this.guides);
    this.annotations = [];
    const segments = [];
    const tight = [];
    const Y = 0.006;
    if (this.view === "plan") {
      const ped = this.selectedPedestal && findPedestal(this.p, this.selectedPedestal);
      const panel = this.selectedPanel && findPanel(this.p, this.selectedPanel);
      const item = ped ? ped : panel ? { ...panel, depth: 3 } : null;
      // Clearance: each gap narrower than a wheelchair needs, in red. Set by
      // main.js from src/clearance.js, and only in Pro.
      for (const issue of this.clearance || []) {
        if (issue.kind !== "tight") continue;
        const a = new T.Vector3(issue.from[0] * IN, Y, issue.from[1] * IN),
          b = new T.Vector3(issue.to[0] * IN, Y, issue.to[1] * IN);
        tight.push(a, b);
        this.annotations.push({ at: a.clone().lerp(b, 0.5), text: formatLength(issue.inches), kind: "clearance" });
      }
      for (const line of planDimensions(this.p.booth, item)) {
        const a = new T.Vector3(line.from.x * IN, Y, line.from.z * IN),
          b = new T.Vector3(line.to.x * IN, Y, line.to.z * IN);
        segments.push(a, b);
        this.annotations.push({ at: a.clone().lerp(b, 0.5), text: formatLength(line.inches), kind: "dimension " + line.kind });
      }
    }
    const [m0, m1] = this.measure.points;
    if (m0) {
      // A small cross marks where the tape starts until the second click.
      const s = 0.03;
      segments.push(m0.clone().add(new T.Vector3(-s, 0, 0)), m0.clone().add(new T.Vector3(s, 0, 0)),
        m0.clone().add(new T.Vector3(0, 0, -s)), m0.clone().add(new T.Vector3(0, 0, s)));
    }
    for (const [a, b] of [...this.measure.kept, ...(m0 && m1 ? [[m0, m1]] : [])]) {
      segments.push(a, b);
      this.annotations.push({ at: a.clone().lerp(b, 0.5), text: formatLength(distanceInches(a, b, IN)), kind: "tape" });
    }
    if (tight.length) {
      const red = new T.LineSegments(
        new T.BufferGeometry().setFromPoints(tight),
        new T.LineBasicMaterial({ color: "#ff4d4d", depthTest: false, transparent: true }),
      );
      red.renderOrder = 10;
      red.userData.editorOnly = true;
      this.guides.add(red);
    }
    if (segments.length) {
      const lines = new T.LineSegments(
        new T.BufferGeometry().setFromPoints(segments),
        new T.LineBasicMaterial({ color: "#91beff", depthTest: false, transparent: true }),
      );
      lines.renderOrder = 10;
      lines.userData.editorOnly = true;
      this.guides.add(lines);
    }
    this.invalidate();
  },
  /**
   * The Box tool: press on the floor, drag out a rectangle, let go. Snapped
   * to whole inches with Snap on. The finished footprint goes to `onDrawBox`,
   * which makes it a box piece; a click without a drag draws nothing.
   */
  setDrawingBox(on) {
    this.drawingBox = on ? { start: null } : null;
    this.showBoxPreview(null);
    this.controls.enabled = true;
  },
  boxFrom(a, b) {
    const grid = this.snap ? 1 : 0.25;
    const q = (m) => Math.round(m / IN / grid) * grid;
    const x0 = q(a.x), z0 = q(a.z), x1 = q(b.x), z1 = q(b.z);
    return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, width: Math.abs(x1 - x0), depth: Math.abs(z1 - z0) };
  },
  showBoxPreview(r) {
    if (this.boxPreview) {
      this.boxPreview.parent?.remove(this.boxPreview);
      this.boxPreview.geometry.dispose();
      this.boxPreview.material.dispose();
      this.boxPreview = null;
    }
    this.snapNotes = [];
    if (!r) return this.invalidate();
    const Y = 0.008, x0 = (r.x - r.width / 2) * IN, x1 = (r.x + r.width / 2) * IN, z0 = (r.z - r.depth / 2) * IN, z1 = (r.z + r.depth / 2) * IN;
    const pts = [[x0, z0], [x1, z0], [x1, z0], [x1, z1], [x1, z1], [x0, z1], [x0, z1], [x0, z0]].map(([x, z]) => new T.Vector3(x, Y, z));
    this.boxPreview = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: "#ff5fa2", depthTest: false, transparent: true }));
    this.boxPreview.renderOrder = 11;
    this.boxPreview.userData.editorOnly = true;
    this.group.add(this.boxPreview);
    this.snapNotes = [{ at: new T.Vector3(r.x * IN, Y, r.z * IN), text: `${formatLength(r.width).split(" · ")[0]} × ${formatLength(r.depth).split(" · ")[0]}`, kind: "snap" }];
    this.invalidate();
  },
  /**
   * The smart guides of the drag in progress: pink lines on the wall the
   * work is being dragged along, and a readout for each equal gap. Lines are
   * editor-only, labels are DOM, so neither can reach an export; both go when
   * the drag ends. `frame` null clears them.
   */
  showSnap(frame, snapped = null) {
    if (this.snapGuides) {
      this.snapGuides.parent?.remove(this.snapGuides);
      this.snapGuides.geometry.dispose();
      this.snapGuides.material.dispose();
      this.snapGuides = null;
    }
    this.snapNotes = [];
    this.lastSnap = snapped && (snapped.guides.length || snapped.gaps.length) ? snapped : null;
    if (!frame || !this.lastSnap) return;
    const Z = 0.03;
    const points = [];
    for (const g of snapped.guides) {
      if (g.axis === "x") points.push(new T.Vector3(g.at * IN, g.from * IN, Z), new T.Vector3(g.at * IN, g.to * IN, Z));
      else points.push(new T.Vector3(g.from * IN, g.at * IN, Z), new T.Vector3(g.to * IN, g.at * IN, Z));
    }
    frame.updateWorldMatrix(true, false);
    for (const gap of snapped.gaps) {
      const a = new T.Vector3(gap.from * IN, gap.at * IN, Z), b = new T.Vector3(gap.to * IN, gap.at * IN, Z);
      points.push(a, b);
      const tick = 1.5 * IN;
      for (const end of [a, b]) points.push(end.clone().setY(end.y - tick), end.clone().setY(end.y + tick));
      this.snapNotes.push({ at: frame.localToWorld(a.clone().lerp(b, 0.5)), text: formatLength(gap.inches), kind: "snap" });
    }
    const lines = new T.LineSegments(
      new T.BufferGeometry().setFromPoints(points),
      new T.LineBasicMaterial({ color: "#ff5fa2", depthTest: false, transparent: true }),
    );
    lines.renderOrder = 11;
    lines.userData.editorOnly = true;
    lines.name = "snap-guides";
    frame.add(lines);
    this.snapGuides = lines;
    this.invalidate();
  },
  /** Stand each label over its point on screen. Called after every frame. */
  placeAnnotations() {
    const layer = this.labelLayer;
    if (!layer) return;
    const list = this.snapNotes?.length ? [...this.annotations, ...this.snapNotes] : this.annotations;
    while (layer.children.length > list.length) layer.lastChild.remove();
    while (layer.children.length < list.length) layer.append(document.createElement("span"));
    if (!list.length) return;
    const w = this.host.clientWidth, h = this.host.clientHeight, v = new T.Vector3();
    list.forEach((note, i) => {
      const el = layer.children[i];
      v.copy(note.at).project(this.camera);
      el.className = "scene-label-note " + note.kind;
      if (el.textContent !== note.text) el.textContent = note.text;
      el.hidden = v.z > 1;
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
    });
  },
  /**
   * The tape measure. While it is on, a click on the booth sets a point
   * instead of selecting: the first click is where the tape starts, the
   * second where it ends and shows the distance, and a third starts over.
   * Points land on whatever surface is under the pointer — a wall, a
   * pedestal top, a work — or the floor, so a diagonal across the booth and
   * the height of a work off the floor are both one gesture.
   */
  setMeasuring(on) {
    this.measure.on = !!on;
    if (!on) {
      // Kept tapes stay on screen after the tape is put away, to be read;
      // the one half laid does not.
      if (this.measure.keep && this.measure.points.length === 2) this.keepTape();
      this.measure.points = [];
    }
    this.refreshGuides();
  },
  /**
   * Keep every tape: each finished tape stays on screen, with its reading,
   * when the next is started — several distances read at once. Off clears
   * them. At most MAX_TAPES; the oldest goes first.
   */
  setKeepTapes(on) {
    this.measure.keep = !!on;
    if (!on) this.measure.kept = [];
    this.refreshGuides();
  },
  keepTape() {
    const [a, b] = this.measure.points;
    if (!a || !b) return;
    this.measure.kept.push([a, b]);
    if (this.measure.kept.length > MAX_TAPES) this.measure.kept.shift();
  },
  /** Every tape off the screen, kept or being laid. */
  clearTapes() {
    this.measure.kept = [];
    this.measure.points = [];
    this.refreshGuides();
    this.onMeasure(null);
  },
  measurePoint(e) {
    this.point(e);
    this.group.updateMatrixWorld(true);
    const targets = [];
    this.group.traverse((o) => { if (o.isMesh && o.visible && !o.userData.editorOnly) targets.push(o); });
    const hit = this.ray.intersectObjects(targets, false)[0];
    let at = hit?.point || this.ray.ray.intersectPlane(FLOOR, new T.Vector3());
    if (!at) return;
    // Snap is a measurement tool's friend: 1″ on, left raw when snap is off.
    if (this.snap) at = new T.Vector3(...at.toArray().map((m) => Math.round(m / IN) * IN));
    const pts = this.measure.points;
    if (pts.length === 2 && this.measure.keep) this.keepTape();
    this.measure.points = pts.length === 1 ? [pts[0], at] : [at];
    this.refreshGuides();
    const [a, b] = this.measure.points;
    this.onMeasure(b ? distanceInches(a, b, IN) : null);
  },
};
