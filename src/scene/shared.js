// What more than one of src/scene/'s areas reads (SCENE_SPLIT_PHASE.md):
// where a free-standing wall's frame stands, the floor plane a drag is
// measured in, and which wall frame a work hangs on. Moved out of
// src/scene.js as they were.
import * as T from "three";
import { IN } from "../model.js";
// How far behind its frame plane a wall's slab sits, in metres. Half the
// slab's thickness plus the sliver that keeps art from z-fighting the face.
export const WALL_SLAB_OFFSET = 0.031;
/**
 * Stand a free-standing wall's frame where its measurements say. A perimeter
 * wall's frame plane sits on the footprint line, so its slab hangs just
 * outside it. A panel has no line to sit on and is used from both sides, so
 * its typed X/Z is the centre of the slab: the frame is pushed forward by the
 * same offset the slab is pushed back, and the corner is that centre stepped
 * back half a width along the frame's own +x.
 *
 * Both the build and a drag go through here, so a dragged panel lands exactly
 * where typing the same numbers would have put it.
 */
// The plan-view plane every free-standing wall drag is measured in.
export const FLOOR = new T.Plane(new T.Vector3(0, 1, 0), 0);
export function placePanelFrame(g, panel) {
  const r = ((panel.rotation || 0) * Math.PI) / 180,
    half = (panel.width * IN) / 2;
  g.position.set(
    panel.x * IN - Math.cos(r) * half + Math.sin(r) * WALL_SLAB_OFFSET,
    0,
    panel.z * IN + Math.sin(r) * half + Math.cos(r) * WALL_SLAB_OFFSET,
  );
  g.rotation.y = r;
  return g;
}
/**
 * Which wall frame a piece of artwork hangs on. A work in the home booth
 * names no booth and keys by its wall alone, which is exactly what every
 * frame was keyed by before rows existed; a work in a row booth is prefixed
 * with that booth's slot id, because the same three walls stand once per
 * booth in the aisle.
 */
export const frameKey = (a) =>
  (a.booth ? a.booth + ":" : "") + a.wall + (a.face === "outside" ? "-outside" : "");
