// What stands in the booth besides its walls: the figures and their
// cut-outs, the pedestals and the furniture on them, and the free-standing
// panels — each built, picked, dragged and restood without a rebuild. Moved
// out of src/scene.js's BoothScene as it was (SCENE_SPLIT_PHASE.md, seam 5):
// `this` is the scene, and src/scene.js installs these on its prototype with
// `mixin`.
import * as T from "three";
import { IN, PEDESTAL, FURNITURE, furnitureKind, boothPedestals, isShown, constrainPanel, constrainPedestal, findPanel, findPedestal, isPanelKey } from "../model.js";
import { PEOPLE, makePerson, placePerson, resolvePerson } from "../people.js";
import { buildFurniture } from "../furniture.js";
import { FLOOR, placePanelFrame } from "./shared.js";
/**
 * Stand a pedestal where its measurements say. Unlike a wall, a pedestal's
 * X/Z is its own centre in plan and there is no frame-plane offset to undo,
 * so this is the whole of it — but it is still one function the build and a
 * drag both go through, for the same reason `placePanelFrame` is.
 */
function placePedestal(g, ped) {
  g.position.set(ped.x * IN, 0, ped.z * IN);
  g.rotation.y = ((ped.rotation || 0) * Math.PI) / 180;
  return g;
}
export const props = {
  /**
   * Pedestals: a plinth with a solid top for cards, a tablet or a guest book.
   * Each is its own group so `movePedestal` can restand one without the scene
   * rebuild `update()` performs, exactly as a free-standing wall's frame does.
   */
  buildPedestals(p) {
    for (const ped of boothPedestals(p).filter(isShown)) {
      const g = new T.Group();
      g.name = "pedestal:" + ped.id;
      g.userData.tag = "furniture";
      placePedestal(g, ped);
      this.group.add(g);
      this.pedestalFrames[ped.id] = g;
      const kind = furnitureKind(ped);
      // A locked piece is drawn but never picked: a click on it goes through
      // to whatever is behind it, or orbits. Its controls in the Walls tool
      // are the only way to change it until it is unlocked.
      const pick = ped.locked ? [] : this.pedestalObjects;
      if (kind === "box") {
        // A drawn box is exactly its measurements: one block, no reveal.
        const block = this.box(ped.width * IN, ped.height * IN, ped.depth * IN, 0, (ped.height * IN) / 2, 0,
          new T.MeshStandardMaterial({ color: ped.color || FURNITURE.box.color, roughness: 0.8 }), g);
        block.userData.pedestal = ped.id;
        pick.push(block);
        continue;
      }
      if (kind !== "pedestal") {
        // Furniture: the same group, placement and drag, another shape.
        for (const part of buildFurniture(kind, { ...ped, color: ped.color || FURNITURE[kind].color }, g, this.box.bind(this))) {
          part.userData.pedestal = ped.id;
          pick.push(part);
        }
        continue;
      }
      const color = ped.color || PEDESTAL.color;
      const body = new T.MeshStandardMaterial({ color, roughness: 0.78 });
      const w = ped.width * IN, d = ped.depth * IN, h = ped.height * IN;
      // The top is a separate slab, slightly proud of the body on every side:
      // a solid top is the point of the thing, and the reveal is what stops it
      // reading as a plain extruded box.
      const TOP = 0.02;
      const column = this.box(w, h - TOP, d, 0, (h - TOP) / 2, 0, body, g);
      column.userData.pedestal = ped.id;
      pick.push(column);
      const top = this.box(
        w + 0.01,
        TOP,
        d + 0.01,
        0,
        h - TOP / 2,
        0,
        new T.MeshStandardMaterial({ color, roughness: 0.55 }),
        g,
      );
      top.userData.pedestal = ped.id;
      pick.push(top);
    }
  },
  /**
   * Restand one pedestal without a rebuild — the drag counterpart of
   * `movePanel`, and the reason a pedestal is a group of its own.
   */
  /**
   * Restand one figure without the scene rebuild `update()` performs, so a
   * placement slider tracks the cursor instead of disposing every wall and
   * texture in the booth per pixel.
   *
   * Unlike a pedestal this may rebuild the figure itself, because a person's
   * height is in the geometry: a 5'6" figure is not a 6'0" one scaled down —
   * the head stays an eighth of the height and the hip stays at the halfway
   * mark, which is what keeps a shorter figure reading as shorter rather than
   * as further away. Rebuilding one figure is a handful of primitives, and
   * still nothing beside a whole-scene rebuild. Position and facing skip even
   * that.
   *
   * Same rule as `movePanel`: this is the one path a drag and a typed number
   * both take, so a dragged figure lands where a typed one would.
   */
  movePerson(person) {
    const list = this.p.booth.people || [];
    const index = list.findIndex((x) => x.id === person.id);
    if (index < 0) return;
    const before = list[index];
    list[index] = person;
    let figure = this.personFrames[person.id];
    if (!figure) return;
    if (before.height !== person.height || before.kind !== person.kind) figure = this.rebuildFigure(person);
    placePerson(figure, person);
    this.touchShadows();
  },
  /** Replace one figure's meshes, in place, for a new height, kind or picture. */
  rebuildFigure(person) {
    const old = this.personFrames[person.id];
    old.traverse((o) => {
      o.geometry?.dispose();
      // The material is owned by the figure. A cut-out's picture is not — it
      // is shared through `this.cutouts` — and disposing a material leaves
      // its map alone.
      if (o.material) o.material.dispose();
    });
    this.group.remove(old);
    const figure = makePerson(person.kind, person.height, this.cutoutFor(person.kind));
    figure.name = "person:" + person.id;
    figure.userData.tag = "people";
    placePerson(figure, person);
    this.group.add(figure);
    this.personFrames[person.id] = figure;
    this.applyTags(figure);
    return figure;
  },
  /** A figure kind's cut-out picture, or null while it loads or if it is missing. */
  cutoutFor(kind) {
    const id = resolvePerson(kind);
    if (!this.cutouts[id]) {
      this.cutouts[id] = { texture: null };
      this.loadCutout(id);
    }
    return this.cutouts[id].texture;
  },
  /**
   * Load a cut-out, then swap every figure of that kind from mannequin to
   * picture. A missing file is not an error: the mannequin is the fallback,
   * and the app must run with `public/assets` empty.
   */
  loadCutout(id) {
    return new T.TextureLoader().loadAsync(PEOPLE[id].cutout.file).then((texture) => {
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.cutouts[id].texture = texture;
      let swapped = false;
      for (const person of this.p?.booth.people || []) {
        if (resolvePerson(person.kind) !== id || !this.personFrames[person.id]) continue;
        this.rebuildFigure(person);
        swapped = true;
      }
      if (swapped) this.touchShadows();
    }, () => {});
  },
  movePedestal(ped) {
    const list = this.p.booth.pedestals || [];
    const index = list.findIndex((x) => x.id === ped.id);
    if (index < 0) return;
    list[index] = ped;
    const g = this.pedestalFrames[ped.id];
    if (!g) return;
    placePedestal(g, ped);
    this.touchShadows();
    this.refreshGuides();
  },
  /** The pedestal under the pointer, or null. Artwork and walls win the pick. */
  pickPedestal() {
    this.group.updateMatrixWorld(true);
    const hit = this.ray.intersectObjects(
      [...this.artObjects, ...this.wallObjects, ...this.pedestalObjects],
      false,
    )[0];
    return hit?.object.userData.pedestal ? hit : null;
  },
  /**
   * The figure under the pointer, as its person id, or null. Figures are
   * groups (a cut-out picture, or a mannequin of several meshes, plus a drawn
   * shadow), so the pick is recursive and walks back up to the group whose
   * name carries the id. Artwork, walls and pedestals in front of a figure
   * win, the same rule `pickPedestal` keeps.
   */
  pickPerson() {
    this.group.updateMatrixWorld(true);
    const figures = Object.values(this.personFrames).filter((f) => f.parent && f.visible);
    if (!figures.length) return null;
    // A cut-out only turns to face the camera as it is drawn (people.js
    // onBeforeRender); updateMatrixWorld above laid it back along the figure's
    // own facing, which seen side-on is a card edge-on and unpickable. Turn
    // each to this camera again first, so the pick sees what the eye does.
    for (const f of figures)
      for (const m of f.children) if (m.userData.cutout) m.onBeforeRender(this.renderer, this.scene, this.camera);
    const hits = this.ray.intersectObjects(
      [...this.artObjects, ...this.wallObjects, ...this.pedestalObjects, ...figures],
      true,
    );
    for (const hit of hits) {
      if (!hit.object.visible) continue;
      let o = hit.object;
      while (o && !o.name?.startsWith("person:")) o = o.parent;
      return o ? o.name.slice(7) : null;
    }
    return null;
  },
  /**
   * A dragged pedestal's new position, measured on the floor plane the same
   * way a wall's is, so both read identically from any orbit.
   */
  pedestalDragTarget(d) {
    const point = this.ray.ray.intersectPlane(FLOOR, new T.Vector3());
    if (!point) return null;
    const grid = this.snap ? 1 : 0.01;
    const ped = findPedestal(this.p, d.pedestal);
    if (!ped) return null;
    return constrainPedestal(this.p, {
      ...ped,
      x: Math.round((point.x / IN - d.dx) / grid) * grid,
      z: Math.round((point.z / IN - d.dz) / grid) * grid,
    });
  },
  /**
   * The free-standing wall under the pointer, or null. Artwork wins: the walls
   * are raycast in the same pass, so a work hanging on a panel is picked
   * rather than the panel behind it, which is what clicking a picture means.
   */
  pickPanel() {
    this.group.updateMatrixWorld(true);
    const hit = this.ray.intersectObjects([...this.artObjects, ...this.wallObjects], false)[0];
    if (!hit || hit.object.userData.artId) return null;
    return isPanelKey(hit.object.userData.wall) ? hit : null;
  },
  /**
   * A dragged panel's new position, from the pointer's own point on the floor.
   * The floor is the plane a plan view is measured in, so an X/Z drag reads
   * the same from any orbit — and a grab keeps its offset, so a panel does not
   * jump its centre to the cursor on the first pixel of movement.
   */
  panelDragTarget(d) {
    const point = this.ray.ray.intersectPlane(FLOOR, new T.Vector3());
    if (!point) return null;
    const grid = this.snap ? 1 : 0.01;
    const panel = findPanel(this.p, d.key);
    if (!panel) return null;
    return constrainPanel(this.p, {
      ...panel,
      x: Math.round((point.x / IN - d.dx) / grid) * grid,
      z: Math.round((point.z / IN - d.dz) / grid) * grid,
    });
  },
  /**
   * Restand one panel without rebuilding the scene. `update()` disposes and
   * rebuilds everything, which is far too much for every pixel of a drag —
   * and the exterior frame, the art hanging on both faces and the posts are
   * all children of the panel's own frame, so moving that group moves the lot.
   */
  movePanel(panel) {
    const index = (this.p.booth.panels || []).findIndex((x) => x.id === panel.id);
    if (index < 0) return;
    this.p.booth.panels[index] = panel;
    const frame = this.frames["panel:" + panel.id];
    if (!frame) return;
    placePanelFrame(frame, panel);
    this.touchShadows();
    this.refreshGuides();
  },
};
