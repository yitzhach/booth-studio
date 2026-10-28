// Picking and interaction: the pointer and touch listeners on the canvas
// (`bind`), the ray into the scene, which artwork a point lands on, and where
// a dragged piece may drop on a wall. Moved out of src/scene.js's BoothScene
// as it was (SCENE_SPLIT_PHASE.md, seam 7): `this` is the scene, and
// src/scene.js installs these on its prototype with `mixin`.
import * as T from "three";
import { IN, constrain, findPanel, findPedestal, isPanelKey, scalePanel, wallSpec } from "../model.js";
import { smartSnap } from "../guides.js";
import { sameWall } from "../arrange.js";
import { FLOOR, frameKey } from "./shared.js";
export const interaction = {
  point(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
  },
  artFrame(a) {
    return this.frames[frameKey(a)];
  },
  pickArt() {
    this.group.updateMatrixWorld(true);
    const hits = this.ray.intersectObjects([...this.artObjects, ...this.wallObjects], false);
    return hits[0]?.object.userData.artId ? hits[0] : null;
  },
  wallDrop(e, a) {
    this.point(e); this.group.updateMatrixWorld(true);
    const hit = this.ray.intersectObjects([...this.wallObjects, ...(this.rowWallObjects || [])], false)[0];
    if (!hit || Math.abs(hit.face.normal.z) < .9) return null;
    const wall = hit.object.userData.wall, face = hit.face.normal.z > 0 ? "inside" : "outside";
    // Dropping onto a wall says which booth as well as which wall: the work
    // belongs to the booth it was let go of over, whichever one the row
    // picker happened to be pointing at.
    const booth = hit.object.userData.booth || undefined;
    const frame = this.frames[frameKey({ booth, wall, face })];
    const local = frame.worldToLocal(hit.point.clone());
    const grid = this.snap ? 1 : .01;
    return constrain(this.p, {...a, booth, wall, face,
      x:Math.round((local.x/IN-a.w/2)/grid)*grid,
      y:Math.round((local.y/IN-a.h/2)/grid)*grid});
  },
  bind() {
    const c = this.renderer.domElement;
    // Double-clicking artwork arms its move-and-scale handles, which is the
    // start of a drag, and a drag is the one thing fast edit exists for. So
    // the gesture that says "I am about to arrange this" turns it on. It is
    // still only a view setting — nothing about the booth changed, exports
    // put full quality back — and the toolbar toggle turns it off again.
    const activateTransform = (id) => {
      this.scaleId = id;
      this.armDraft();
      this.onSelect(id);
    };
    c.addEventListener("dblclick", e => {
      // The show floor is looked at and walked, never edited, in 3D.
      if (this.show) return;
      this.point(e);
      // Double-clicking a pedestal selects it, so one gesture both picks it
      // up and arms the drag — the single click that selects is the same
      // click a double-click starts with, so this only has to catch the case
      // where the first click landed on something else.
      const ped = this.pickPedestal();
      if (ped) {
        e.preventDefault();
        const id = ped.object.userData.pedestal;
        this.selectedPedestal = id;
        this.onSelectPedestal(id);
        return;
      }
      // A figure is not dragged in the viewport — its sliders place it — but
      // double-clicking one opens its controls, which is the part of picking
      // it up that was asked for. Tried before artwork only when no artwork
      // is in front of it; `pickPerson` keeps that order itself.
      const person = this.pickPerson();
      if (person) {
        e.preventDefault();
        this.onSelectPerson(person);
        return;
      }
      const hit = this.pickArt();
      if (!hit) return;
      e.preventDefault();
      activateTransform(hit.object.userData.artId);
    });
    c.addEventListener("pointerdown", e => {
      if (e.button !== 0 || this.drag || this.show || (this.panTool && !this.walking)) return;
      if (this.drawingBox) {
        this.point(e);
        const at = this.ray.ray.intersectPlane(FLOOR, new T.Vector3());
        if (!at) return;
        this.drawingBox.start = at;
        this.controls.enabled = false;
        c.setPointerCapture(e.pointerId);
        return;
      }
      if (this.measure.on) {
        this.measurePoint(e);
        return;
      }
      this.point(e); this.group.updateMatrixWorld(true);
      this.down = [e.clientX, e.clientY];
      const nearest = this.ray.intersectObjects([...this.resizeHandles, ...this.wallObjects, ...this.artObjects, ...this.pedestalObjects], false)[0];
      const handle = nearest?.object.userData.editorOnly ? nearest : null;
      const pedestalHit = !handle && nearest?.object.userData.pedestal ? nearest : null;
      if (pedestalHit) {
        const id = pedestalHit.object.userData.pedestal,
          ped = findPedestal(this.p, id);
        // The same rule a free-standing wall gets: a first click selects, and
        // only a selected pedestal — or the Move tool — drags. A pedestal in
        // the middle of the booth is otherwise something you shove across the
        // floor on the way to orbiting.
        if (ped && (this.move || this.selectedPedestal === id)) {
          const floor = this.ray.ray.intersectPlane(FLOOR, new T.Vector3());
          if (floor) {
            this.drag = { pedestal: id, dx: floor.x / IN - ped.x, dz: floor.z / IN - ped.z };
            this.controls.enabled = false;
            this.onStart();
            c.setPointerCapture(e.pointerId);
          }
        }
        this.selectedPedestal = id;
        this.onSelectPedestal(id);
        return;
      }
      const panelHit =
        !handle && nearest && !nearest.object.userData.artId &&
        isPanelKey(nearest.object.userData.wall)
          ? nearest
          : null;
      if (panelHit) {
        const key = panelHit.object.userData.wall,
          panel = findPanel(this.p, key);
        // A first click selects; only a selected wall — or the Move tool —
        // drags. Otherwise every click on a panel on the way to orbiting the
        // booth would shove it across the floor.
        if (panel && (this.move || this.selectedPanel === key)) {
          const floor = this.ray.ray.intersectPlane(FLOOR, new T.Vector3());
          if (floor) {
            this.drag = { key, dx: floor.x / IN - panel.x, dz: floor.z / IN - panel.z };
            this.controls.enabled = false;
            this.onStart();
            c.setPointerCapture(e.pointerId);
          }
        }
        this.selectedPanel = key;
        this.onSelectPanel(key);
        return;
      }
      const hit = handle || this.pickArt();
      if (!hit || (!handle && !this.move && this.scaleId !== hit.object.userData.artId)) return;
      const id = hit.object.userData.artId, a = this.p.art.find(x => x.id === id);
      const frame = this.artFrame(a);
      frame.updateWorldMatrix(true, false);
      const local = frame.worldToLocal(hit.point.clone());
      const normal = new T.Vector3(0,0,1).applyQuaternion(frame.getWorldQuaternion(new T.Quaternion()));
      const plane = new T.Plane().setFromNormalAndCoplanarPoint(normal, hit.point);
      this.drag = {id, frame, plane, initial:{...a}, resizing:!!handle,
        stretch: handle?.object.userData.stretch,
        sx: handle?.object.userData.sx, sy: handle?.object.userData.sy,
        dx:local.x/IN-a.x, dy:local.y/IN-a.y,
        radius:Math.hypot(local.x/IN-a.x-a.w/2, local.y/IN-a.y-a.h/2)};
      this.controls.enabled = false;
      this.onStart();
      c.setPointerCapture(e.pointerId);
      this.onSelect(id);
    }, true);
    // A high-rate mouse or trackpad fires several pointermove events per
    // displayed frame, and each one here raycasts, restands the thing being
    // dragged and re-renders its shadows. Only the last one before a frame is
    // drawn can be seen, so the rest is work thrown away: the event is stored
    // and applied once, from the render loop.
    c.addEventListener("pointermove", e => {
      if (this.drawingBox?.start) {
        this.point(e);
        const at = this.ray.ray.intersectPlane(FLOOR, new T.Vector3());
        if (at) this.showBoxPreview(this.boxFrom(this.drawingBox.start, at));
        return;
      }
      if (!this.drag) return;
      this.pendingMove = e;
    });
    this.applyDrag = (e) => {
      if (!this.drag) return;
      this.point(e);
      if (this.drag.key) {
        const next = this.panelDragTarget(this.drag);
        if (next) {
          this.movePanel(next);
          this.onMovePanel(next);
        }
        return;
      }
      if (this.drag.pedestal) {
        const next = this.pedestalDragTarget(this.drag);
        if (next) {
          this.movePedestal(next);
          this.onMovePedestal(next);
        }
        return;
      }
      const point = this.ray.ray.intersectPlane(this.drag.plane, new T.Vector3());
      if (!point) return;
      const d = this.drag, local = d.frame.worldToLocal(point);
      if (d.resizing) {
        const a = d.initial;
        if (d.stretch) {
          const horizontal = d.sx !== 0;
          const spec = wallSpec(this.p, a.wall);
          const width = spec.width;
          const height = spec.height;
          const x = horizontal && d.sx < 0 ? Math.max(0, Math.min(a.x+a.w-1, local.x/IN)) : a.x;
          const y = !horizontal && d.sy < 0 ? Math.max(0, Math.min(a.y+a.h-1, local.y/IN)) : a.y;
          const w = horizontal ? d.sx < 0 ? a.x+a.w-x : Math.max(1,Math.min(360,width-a.x,local.x/IN-a.x)) : a.w;
          const h = !horizontal ? d.sy < 0 ? a.y+a.h-y : Math.max(1,Math.min(360,height-a.y,local.y/IN-a.y)) : a.h;
          this.onMove({...a,x,y,w,h,stretch:true});
          return;
        }
        const radius = Math.hypot(local.x/IN-a.x-a.w/2, local.y/IN-a.y-a.h/2);
        this.onMove(scalePanel(this.p, a, radius / Math.max(.01,d.radius)));
      } else {
        const a = this.p.art.find(x => x.id === d.id), grid = this.snap ? 1 : .01;
        let next = constrain(this.p, {...a,
          x:Math.round((local.x/IN-d.dx)/grid)*grid,
          y:Math.round((local.y/IN-d.dy)/grid)*grid});
        // Smart guides: with Snap on, an edge or a centre that comes within
        // two inches of another work's, the wall's centre or the hang line
        // jumps to it, and the line it jumped to is drawn. Alt holds them off
        // for one drag, the way it does in every drawing program.
        const wall = wallSpec(this.p, a.wall);
        if (this.snap && !e.altKey && wall) {
          const snapped = smartSnap(next, sameWall(this.p.art, a).filter((b) => b.id !== a.id), wall);
          next = constrain(this.p, { ...next, x: snapped.x, y: snapped.y });
          this.showSnap(d.frame, snapped);
        } else this.showSnap(null);
        this.onMove(next);
      }
    };
    c.addEventListener("pointerup", e => {
      if (this.drawingBox?.start) {
        this.point(e);
        const at = this.ray.ray.intersectPlane(FLOOR, new T.Vector3());
        const r = at && this.boxFrom(this.drawingBox.start, at);
        this.drawingBox.start = null;
        this.controls.enabled = true;
        this.showBoxPreview(null);
        if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
        if (r && r.width >= 4 && r.depth >= 4) this.onDrawBox?.(r);
        return;
      }
      if (this.drag) {
        // The last move still pending has to land before the drag ends, or a
        // quick flick finishes an inch short of where it was released.
        this.flushDrag();
        this.drag = null; this.down = null; this.controls.enabled = true;
        this.showSnap(null);
        if (this.shadowsOwed) this.touchShadows();
        if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
        this.onEnd();
        return;
      }
      if (this.down && Math.hypot(e.clientX-this.down[0], e.clientY-this.down[1]) < 7) {
        this.point(e);
        const pedestalHit = this.pickPedestal();
        if (pedestalHit) {
          const id = pedestalHit.object.userData.pedestal;
          this.lastTap = null;
          this.down = null;
          this.letGoOfArt();
          this.selectedPedestal = id;
          this.onSelectPedestal(id);
          return;
        }
        const panelHit = this.pickPanel();
        if (panelHit) {
          const key = panelHit.object.userData.wall;
          this.lastTap = null;
          this.down = null;
          this.letGoOfArt();
          this.selectedPanel = key;
          this.onSelectPanel(key);
          return;
        }
        const hit = this.pickArt();
        const id = hit?.object.userData.artId || null;
        // Clicking anything that is not a free-standing wall lets go of the
        // one that was selected, so the sliders never point at a wall the
        // pointer has moved on from.
        if (this.selectedPanel) {
          this.selectedPanel = null;
          this.onSelectPanel(null);
        }
        const now = performance.now();
        if (
          id &&
          this.lastTap?.id === id &&
          now - this.lastTap.time < 380 &&
          Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 24
        ) {
          this.lastTap = null;
          activateTransform(id);
        } else {
          // Clicking anywhere but the work whose handles are armed is letting
          // go of it — the floor, the wall behind it, or another work. In
          // auto that is what turns fast edit back off, so the shadows and the
          // supersampling come back the moment the arranging stops.
          if (id !== this.scaleId) this.letGoOfArt();
          this.lastTap = id ? { id, time: now, x: e.clientX, y: e.clientY } : null;
          // Shift adds to the selection rather than replacing it; main.js
          // keeps the set, because the set is about the inspector.
          this.onSelect(id, { add: e.shiftKey });
        }
      }
      this.down = null;
    });
    c.addEventListener("pointercancel", () => {
      this.drag = null; this.controls.enabled = true; this.down = null;
      this.showSnap(null);
      this.onEnd();
    });
  },
};
