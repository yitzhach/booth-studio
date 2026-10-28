// The booth itself: its walls, panels, artwork, lights, ground and models,
// rebuilt by `update`, with the show floor staged round it, the selection
// drawn on it and the view's hidden tags applied. Moved out of src/scene.js's
// BoothScene as it was (SCENE_SPLIT_PHASE.md, seam 9): `this` is the scene,
// and src/scene.js installs these on its prototype with `mixin`.
import * as T from "three";
import { makeTent, environment } from "../environment.js";
import { signTexture } from "../signage.js";
import { edgeMaterial } from "../edge-material.js";
import { artEnvIntensity, DEFAULT_FIDELITY, showFixtures } from "../lighting.js";
import { GROUND_CONSUMER, TENT_CONSUMER, TENT_WEAVE, WALL_CONSUMER, WALL_SET, UV_METRE } from "../surfaces.js";
import { editedAspect, hasImageEdits } from "../image-edit.js";
import { applyImageEdits } from "../image-paint.js";
import { decodeAt, isPreflipped } from "../image-source.js";
import { IN, isShown, edgeColorOf, lightVisible, groundKind, groundUpload, findPanel, findPedestal, isArtShow, isPanelKey, wallKeys, wallSpec } from "../model.js";
import { temperature } from "./light-rig.js";
import { BACKDROP_FRAMING } from "./render-loop.js";
import { WALL_SLAB_OFFSET, frameKey, placePanelFrame } from "./shared.js";
import { makePerson, placePerson } from "../people.js";
import { rowLayout } from "../row.js";
import { tagShown } from "../views.js";
import { buildShow, homeBooth } from "../show-scene.js";
import { floorOf } from "../show.js";
/**
 * The longest edge a preview texture is decoded to. An original stays whole
 * in the project and in a backup; this is what the wall is shown at, and it
 * is already more than a 2048-wide export can use on a panel that fills a
 * third of the frame.
 */
export const ART_TEXTURE_MAX = 2048;
/**
 * A .glb held as a data URL, parsed into a three object. GLTFLoader is loaded
 * on first use, so a booth with no models never downloads it.
 */
async function parseModel(dataUrl) {
  const [{ GLTFLoader }, buffer] = await Promise.all([
    import("three/addons/loaders/GLTFLoader.js"),
    fetch(dataUrl).then((r) => r.arrayBuffer()),
  ]);
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  return gltf.scene;
}
export const build = {
  box(w, h, d, x, y, z, mat, parent = this.group) {
    const o = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  },
  /**
   * A wall's local frame: origin at its bottom-left corner, +x along its
   * width, +z out of its front (inside) face. The three perimeter walls are
   * three fixed callers; a free-standing panel supplies its own centre and
   * rotation, and the corner is that centre stepped back half a width along
   * the frame's own +x.
   */
  wallFrame(wall) {
    const p = this.p.booth,
      W = p.width * IN,
      D = p.depth * IN;
    const g = new T.Group();
    const panel = findPanel(this.p, wall);
    if (panel) return placePanelFrame(g, panel);
    if (wall === "back") g.position.set(-W / 2, 0, -D / 2);
    if (wall === "left") {
      g.position.set(-W / 2, 0, D / 2);
      g.rotation.y = Math.PI / 2;
    }
    if (wall === "right") {
      g.position.set(W / 2, 0, -D / 2);
      g.rotation.y = -Math.PI / 2;
    }
    return g;
  },
  async texture(id, edits = null) {
    const edited = hasImageEdits(edits);
    const asset = this.p.assets[id];
    return this.textureCache.get(id, edits, asset.data, async () => {
      // Decoded straight to the size the wall wants. This used to unpack the
      // whole original — up to 100 megapixels of it — and then shrink it on a
      // 2D canvas, which is most of what made a booth full of uploads heavy
      // on an older machine.
      //
      // An unedited original goes straight onto the GPU, so it is decoded
      // already flipped: WebGL does not apply `texture.flipY` to an
      // ImageBitmap, which is what hung every uploaded photograph upside
      // down. An edited one is drawn onto a canvas first — rotating a
      // pre-flipped image turns the wrong way — so it is decoded the way up
      // it was taken and the texture flips it in the usual way.
      let src = await decodeAt(asset.data, asset.width, asset.height, ART_TEXTURE_MAX, {
        upload: !edited,
      });
      const preflipped = isPreflipped(src);
      if (edited) src = applyImageEdits(src, edits);
      const texture = new T.Texture(src);
      texture.flipY = !preflipped;
      texture.colorSpace = T.SRGBColorSpace;
      texture.anisotropy = Math.min(
        8,
        this.renderer.capabilities.getMaxAnisotropy(),
      );
      texture.needsUpdate = true;
      // An ImageBitmap holds its pixels outside the JavaScript heap, so the
      // garbage collector cannot see what it costs. The cache disposes a
      // texture it is done with; this hands the pixels back at the same
      // moment. A canvas or an `<img>` has no `close` and needs none.
      texture.addEventListener("dispose", () => texture.image?.close?.());
      return texture;
    });
  },
  update(p, selected, selectedPanel = null, selectedPedestal = null) {
    this.renderer.shadowMap.needsUpdate = true;
    this.p = p;
    this.selected = selected;
    this.selectedPanel = findPanel(p, selectedPanel) ? selectedPanel : null;
    this.selectedPedestal = findPedestal(p, selectedPedestal) ? selectedPedestal : null;
    if (this.scaleId !== selected) this.scaleId = null;
    this.revision = (this.revision || 0) + 1;
    const rev = this.revision;
    this.disposeGroup();
    this.textureCache.retain([
      ...p.art.filter(a => a.asset).map(a => ({ id: a.asset, edits: a.edits, data: p.assets[a.asset]?.data })),
      ...[p.booth.surroundAsset, groundUpload(p)].filter(Boolean)
        .map(id => ({ id, edits: null, data: p.assets[id]?.data })),
    ]);
    this.artObjects = [];
    this.artGroups = new Map();
    this.wallObjects = [];
    // The other booths' walls. Kept apart from this booth's, which are what
    // the wall picker and the selection outline are about, but offered to a
    // drop so an original can be dragged straight onto a neighbour's wall.
    this.rowWallObjects = [];
    this.pedestalObjects = [];
    this.pedestalFrames = {};
    this.personFrames = {};
    this.resizeHandles = [];
    // The old outlines went with the group that was just disposed.
    this.selectionObjects = [];
    this.frames = {};
    const W = p.booth.width * IN,
      D = p.booth.depth * IN,
      H = p.booth.height * IN;
    const rough = (c) =>
      new T.MeshStandardMaterial({ color: c, roughness: 0.92 });
    const beforeEnvironment = this.group.children.length;
    environment(this.scene, this.group, p.booth);
    // Everything environment() stood around the booth is the Surroundings
    // tag — except the ground, which the booth stands on.
    for (const o of this.group.children.slice(beforeEnvironment))
      if (o.name !== "environment-ground") o.userData.tag = "surroundings";
    // environment() has just put the procedural sky back on the scene, so the
    // backdrop settings it knows nothing about are reset here, before anything
    // that loads an image can claim them. Resetting afterwards would undo the
    // rotation a still-loaded preset backdrop re-applies synchronously.
    // YXZ so the two backdrop controls compose the way a tripod head does:
    // pan swings around the world's vertical, then tilt lifts from there. Under
    // the default XYZ order a pan applied after a tilt rolls the horizon, which
    // reads as the whole hall leaning.
    this.scene.backgroundRotation.order = "YXZ";
    this.scene.backgroundRotation.set(0, 0, 0);
    this.scene.backgroundIntensity = 1;
    this.backdropFraming = p.booth.backdropFraming ?? BACKDROP_FRAMING;
    // On by default, including for a backup saved before this existed: a
    // horizon that slides against the floor is a bug, not a look someone chose.
    this.backdropLock = p.booth.backdropLock ?? true;
    // The preset only supplies image-based lighting and a backdrop; the
    // procedural horizon above stays in place when its assets are missing.
    this.lighting
      .apply(this.scene, p.booth.envPreset, {
        background: !p.booth.surroundAsset && !this.show,
        rotation: p.booth.surroundRotation || 0,
      })
      .then(() => {
        if (this.revision !== rev) return;
        // Tilt rides on top of whatever yaw the preset backdrop applied.
        this.scene.backgroundRotation.x = (p.booth.backdropTilt || 0) * Math.PI / 180;
        this.renderer.shadowMap.needsUpdate = true;
      })
      .catch(() => {});
    if (p.booth.surroundAsset && !this.show) this.texture(p.booth.surroundAsset).then(t => {
      if (this.revision !== rev) return;
      t.mapping = T.EquirectangularReflectionMapping;
      this.scene.background = t;
      this.scene.backgroundRotation.y = (p.booth.surroundRotation || 0) * Math.PI / 180;
      this.scene.backgroundRotation.x = (p.booth.backdropTilt || 0) * Math.PI / 180;
      this.scene.fog = null;
    }).catch(() => {});
    // A photographed ground surface, when its files are present. The floor is
    // one choice from one list, so a shipped kind and the user's own
    // photograph are alternatives here rather than one overriding the other;
    // with no files the procedural canvas above stays.
    const groundPhoto = groundUpload(p);
    if (!groundPhoto) this.surfaces.load(groundKind(p)).then(set => {
      if (this.revision !== rev || !set) return;
      const floor = this.group.getObjectByName("environment-ground");
      if (this.surfaces.applyTo(floor, set)) this.renderer.shadowMap.needsUpdate = true;
    }).catch(() => {});
    // A photograph is showing, so the texture set the ground was holding is
    // handed back rather than left on the GPU behind it.
    if (groundPhoto) this.surfaces.release(GROUND_CONSUMER);
    if (groundPhoto) this.texture(groundPhoto).then(t => {
      if (this.revision !== rev) return;
      const floor = this.group.getObjectByName("environment-ground"), map = t.clone();
      map.mapping = T.UVMapping;
      map.wrapS = map.wrapT = T.RepeatWrapping;
      map.repeat.setScalar(180 / ((p.booth.groundTile || 48) * IN));
      map.needsUpdate = true;
      floor.material.map = map; floor.material.color.set("#ffffff");
      floor.material.bumpMap = null; floor.material.userData.ownedMap = true;
      floor.material.needsUpdate = true;
    }).catch(() => {});
    this.buildUnderlay(p, rev);
    this.buildModels(p, rev);
    const ambient = new T.HemisphereLight("#e9f1ff", "#858079", p.ambient);
    ambient.name = "booth-ambient";
    this.group.add(ambient);
    const fill = new T.DirectionalLight("#fff4df", 0.6);
    fill.name = "booth-fill";
    fill.position.set(-3, 6, 5);
    fill.castShadow = true;
    fill.shadow.mapSize.set(1024, 1024);
    fill.shadow.camera.left = -5;
    fill.shadow.camera.right = 5;
    fill.shadow.camera.top = 5;
    fill.shadow.camera.bottom = -5;
    fill.shadow.normalBias = 0.015;
    this.group.add(fill);
    const wallConsumers = new Set();
    for (const wall of wallKeys(p)) {
      const g = this.wallFrame(wall);
      if (isPanelKey(wall)) g.userData.tag = "panels";
      this.frames[wall] = g;
      this.group.add(g);
      const config = wallSpec(p, wall),
        width = config.width * IN,
        height = config.height * IN;
      if (!config.enabled) continue;
      const wallMesh = this.box(
        width,
        height,
        0.055,
        width / 2,
        height / 2,
        -WALL_SLAB_OFFSET,
        rough(p.booth.color),
        g,
      );
      wallMesh.userData.wall = wall;
      this.wallObjects.push(wallMesh);
      // The blue outline it gets when selected is drawn by applySelection(),
      // so that picking a wall does not rebuild the scene to show it.
      // A fabric pro-panel finish: the weave, not the carpet's own colour. The
      // user picked that colour and this is a tool for judging artwork against
      // it, so only the relief and the sheen are taken and `keepColor` leaves
      // the colour exactly as chosen. The panel's UVs run 0..1 over a face that
      // is wider than it is tall, so the span is given per axis.
      if (p.booth.wallFinish === "fabric") {
        const consumer = WALL_CONSUMER + wall;
        wallConsumers.add(consumer);
        const strength = Math.max(0, Math.min(100, p.booth.wallTexture ?? 60)) / 100;
        this.surfaces.load(WALL_SET, consumer).then(set => {
          if (this.revision !== rev || !set) return;
          if (this.surfaces.applyTo(wallMesh, set, {
            consumer, strength, keepColor: true,
            metres: [width, height],
            slots: ["normalMap", "roughnessMap"],
          })) this.renderer.shadowMap.needsUpdate = true;
        }).catch(() => {});
      } else this.surfaces.release(WALL_CONSUMER + wall);
      const exterior = new T.Group();
      exterior.position.set(width, 0, -0.063);
      exterior.rotation.y = Math.PI;
      g.add(exterior);
      this.frames[wall + "-outside"] = exterior;
      // An art-show wall is one continuous surface — that is what a
      // pro-panel wall is, and "no seams on these walls" is a measurement of
      // the thing being planned, not a finish. The outdoor pop-up keeps its
      // 30″ seam posts, feet and cap rail, because that is what it is made of.
      if (isArtShow(p)) continue;
      const count = Math.ceil(width / (30 * IN));
      for (let i = 0; i <= count; i++) {
        const x = Math.min(width, i * 30 * IN);
        this.box(
          0.009,
          height,
          0.01,
          x,
          height / 2,
          0.001,
          rough("#343638"),
          g,
        );
        this.box(0.09, 0.025, 0.24, x, 0.012, -0.02, rough("#33363a"), g);
      }
      this.box(width, 0.025, 0.08, width / 2, height, 0.0, rough("#26292b"), g);
    }
    this.surfaces.releaseMatching(WALL_CONSUMER, wallConsumers);
    // The rest of the aisle. Every other booth in the row is this booth's
    // size and stands on the same line, offset along X; its three walls are
    // real geometry with real frames, so artwork hung in it is positioned,
    // picked and dragged by exactly the code that hangs artwork at home.
    // They are drawn plain — no seam posts, no fabric weave, no light bar —
    // because they are the neighbours, and the booth being planned is the
    // one that deserves the detail.
    for (const slot of rowLayout(p.booth)) {
      if (slot.kind !== "booth" || slot.home) continue;
      const stand = new T.Group();
      stand.name = "row-booth-" + slot.id;
      stand.position.x = slot.x * IN;
      this.group.add(stand);
      for (const wall of ["back", "left", "right"]) {
        const config = p.booth.walls[wall];
        if (!config?.enabled) continue;
        const g = this.wallFrame(wall);
        stand.add(g);
        this.frames[slot.id + ":" + wall] = g;
        const width = config.width * IN,
          height = config.height * IN;
        const slab = this.box(width, height, 0.055, width / 2, height / 2, -WALL_SLAB_OFFSET, rough(p.booth.color), g);
        slab.userData.wall = wall;
        slab.userData.booth = slot.id;
        this.rowWallObjects.push(slab);
        const exterior = new T.Group();
        exterior.position.set(width, 0, -0.063);
        exterior.rotation.y = Math.PI;
        g.add(exterior);
        this.frames[slot.id + ":" + wall + "-outside"] = exterior;
      }
    }
    for (const a of p.art) {
      const frame = this.frames[frameKey(a)];
      if (!frame || !wallSpec(p, a.wall)?.enabled) continue;
      const art = new T.Group();
      this.artGroups.set(a.id, { group: art, initial: { ...a } });
      art.userData.tag = "art";
      art.position.set(
        (a.x + a.w / 2) * IN,
        (a.y + a.h / 2) * IN,
        (a.offset + a.thickness / 2) * IN + 0.003,
      );
      frame.add(art);
      const box = this.box(
        a.w * IN,
        a.h * IN,
        a.thickness * IN,
        0,
        0,
        0,
        edgeMaterial(a, edgeColorOf(p.booth, a)),
        art,
      );
      box.userData.artId = a.id;
      this.artObjects.push(box);
      this.artShadows(p, a, art);
      // applySelection() outlines this box and places the handles against the
      // size it was built at, since the group carries the live scale.
      this.artGroups.get(a.id).box = box;
      let iw = a.w,
        ih = a.h;
      const asset = p.assets[a.asset];
      if (asset && !a.stretch) {
        const ratio = editedAspect(asset, a.edits);
        if (iw / ih > ratio) iw = ih * ratio;
        else ih = iw / ratio;
      }
      const plane = new T.Mesh(
        new T.PlaneGeometry(iw * IN, ih * IN),
        rough(
          a.asset
            ? "#ffffff"
            : [
                "#dddbcd",
                "#947d61",
                "#c0b6a2",
                "#716e65",
                "#d3c8ad",
                "#8b8277",
              ][p.art.indexOf(a) % 6],
        ),
      );
      plane.material.envMapIntensity = artEnvIntensity(
        p.booth.artFidelity || DEFAULT_FIDELITY,
      );
      plane.position.z = (a.thickness * IN) / 2 + 0.0005;
      plane.receiveShadow = true;
      plane.userData.artId = a.id;
      art.add(plane);
      Object.assign(this.artGroups.get(a.id), { plane, imageWidth: iw, imageHeight: ih });
      this.artObjects.push(plane);
      if (a.kind === "sign" || a.kind === "label") {
        plane.material.color.set("#ffffff");
        plane.material.map = signTexture(a);
        plane.material.userData.ownedMap = true;
      } else if (a.asset) {
        // Bind completed textures synchronously: never render a white placeholder
        // during selection, deselection, or handle activation.
        plane.material.map = this.textureCache.peek(a.asset, a.edits, asset?.data) || null;
        this.texture(a.asset, a.edits)
          .then((t) => {
            if (this.revision === rev) {
              plane.material.map = t;
              plane.material.needsUpdate = true;
            }
          })
          .catch(() => {});
      }
    }
    const fixtures = showFixtures(p.booth.fixtures, p.booth.envPreset, p.booth.venue);
    for (const l of p.lights) {
      // A hidden spotlight is still in the list, still carries its position,
      // its aim and its power, and is simply not built. That is the whole
      // difference between hiding one and deleting one: deleting was the only
      // way to take a light out of a composition, and it threw away the aim
      // that took the longest to set.
      if (!lightVisible(l)) continue;
      const light = new T.SpotLight(
        temperature(l.kelvin),
        l.power,
        20,
        Math.PI / 5,
        0.65,
        2,
      );
      light.position.set(l.x * IN, l.y * IN, l.z * IN);
      light.target.position.set(l.tx * IN, l.ty * IN, l.tz * IN);
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -0.00008;
      light.shadow.normalBias = 0.003;
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = 20;
      this.group.add(light, light.target);
      // The housing and its glow are the fixture, not the light: hiding them
      // indoors changes what the picture shows, never what it is lit by.
      if (!fixtures) continue;
      const housing = new T.Mesh(
        new T.CylinderGeometry(0.045, 0.055, 0.13, 16),
        rough("#25282b"),
      );
      housing.userData.tag = "fixtures";
      housing.position.copy(light.position);
      housing.quaternion.setFromUnitVectors(
        new T.Vector3(0, -1, 0),
        light.target.position.clone().sub(light.position).normalize(),
      );
      this.group.add(housing);
      const glow = new T.Mesh(
        new T.SphereGeometry(0.033, 12, 8),
        new T.MeshBasicMaterial({ color: temperature(l.kelvin) }),
      );
      glow.position
        .copy(light.position)
        .add(
          light.target.position
            .clone()
            .sub(light.position)
            .normalize()
            .multiplyScalar(0.07),
        );
      glow.userData.tag = "fixtures";
      this.group.add(glow);
    }
    // The pop-up's front header rail. An art-show booth has no canopy frame
    // to carry one; it gets the light bar below instead.
    if (!isArtShow(p))
      this.box(W, 0.025, 0.025, 0, H - 0.025, D * 0.2, rough("#2e3032"));
    this.buildLightBar(p, rough);
    this.buildPedestals(p);
    // Figures for scale. They are part of the picture, not of the booth: the
    // hanging guide ignores them and nothing can be hung on one.
    //
    // Hidden rather than deleted when the switch is off: a figure is placed to
    // sit beside a particular wall, and making someone rebuild that placement
    // to take one clean shot without a person in it is the reason the switch
    // exists. The list is kept, so switching back restores where they stood.
    for (const person of (p.booth.showPeople === false ? [] : (p.booth.people || []).filter(isShown))) {
      const figure = makePerson(person.kind, person.height, this.cutoutFor(person.kind));
      figure.name = "person:" + person.id;
    figure.userData.tag = "people";
      figure.userData.tag = "people";
      placePerson(figure, person);
      this.group.add(figure);
      this.personFrames[person.id] = figure;
    }
    if (p.booth.tent) this.group.add(makeTent(W,D,H,p.booth.tentStyle || "classic"));
    // Photographed canvas on every fabric panel in the scene, when its files
    // are present. Asked of the whole group rather than of the tent just added,
    // because the neighbouring booths environment() built are canopies too and
    // a textured tent beside two procedural ones looks worse than three
    // procedural ones. The panels carry their UVs in metres, so one UV unit is
    // one metre: the same repeatFor() the ground uses, with a span of one
    // instead of 180.
    const fabric = [];
    this.group.traverse(o => { if (o.userData?.fabric) fabric.push(o); });
    if (!fabric.length) this.surfaces.release(TENT_CONSUMER);
    else this.surfaces.load("canvas", TENT_CONSUMER).then(set => {
      if (this.revision !== rev || !set) return;
      let applied = false;
      for (const panel of fabric)
        applied = this.surfaces.applyTo(panel, set, {
          planeMetres: UV_METRE, consumer: TENT_CONSUMER,
          // A tent roof is white, lit from a bright sky and tone-mapped: a
          // weave at its literal depth washes out to nothing. This is a
          // rendering choice, not a measurement, so the relief is exaggerated
          // until the fabric reads as fabric.
          strength: TENT_WEAVE,
        }) || applied;
      if (applied) this.renderer.shadowMap.needsUpdate = true;
    }).catch(() => {});
    if (this.show) this.stageShow(p);
    this.applyTags();
    this.applySelection();
    this.refreshGuides();
    if (!this.initialized || this.showChanged) {
      this.initialized = true;
      this.showChanged = false;
      this.setView("perspective");
    }
  },
  /**
   * The show floor in 3D, or back to the booth. `hall` is `p.hall` — the plan
   * to stand up — or null. Takes effect on the next `update`, which main.js
   * makes straight after; the view is reframed then, because a camera placed
   * for a 10′ booth sees nothing of a 200′ hall.
   */
  setShow(hall) {
    if (!!hall !== !!this.show) this.showChanged = true;
    this.show = hall || null;
  },
  /**
   * Turn the booth just built into the show: its surroundings, its own
   * ground and any row neighbours go offstage (an invisible group, so they
   * are still disposed with the booth), the floor of `src/show-scene.js` is
   * added round it, and — when no booth on the floor is the one whose design
   * is open — the booth itself goes offstage too, leaving only its two
   * general lights to light the hall.
   */
  stageShow(p) {
    const h = this.show;
    const home = homeBooth(h);
    const offstage = new T.Group();
    offstage.name = "offstage";
    offstage.visible = false;
    const keep = (o) => o.name === "booth-ambient" || o.name === "booth-fill";
    for (const o of [...this.group.children]) {
      const surroundings = o.userData?.tag === "surroundings" || o.name === "environment-ground" || o.name.startsWith("row-booth-") || o.name === "underlay";
      if (surroundings || (!home && !keep(o))) offstage.add(o);
    }
    this.group.add(offstage);
    const show = buildShow(h);
    this.group.add(show);
    this.showGroup = show;
    const f = floorOf(h);
    this.scene.background = new T.Color(f.kind === "outdoor" ? "#bcd3e6" : "#dcd9d3");
    this.scene.fog = null;
    // Every other booth is drawn without shadows, and the booth's own fill
    // light is fitted to the booth: a floor that big would blur it to nothing.
    this.renderer.shadowMap.needsUpdate = true;
  },
  /**
   * Selection visuals, and nothing else: the blue outline on a work, its eight
   * scale handles, and the outline a free-standing wall or a pedestal gets.
   * Selecting used to go through `update()`, which disposes and rebuilds the
   * scene — every wall, every texture, the HDRI — so a double-click on a
   * picture cost a full rebuild before the handles appeared. It is the same
   * rule `movePanel` follows: a rebuild is for a change of what is in the
   * scene, not for a change of what is selected.
   */
  setSelection(selected, selectedPanel = null, selectedPedestal = null, also = []) {
    this.selected = selected;
    // The rest of a multiple selection: outlined, but only the primary one —
    // `selected` — carries handles and an inspector.
    this.also = also.filter((id) => id !== selected);
    this.selectedPanel = findPanel(this.p, selectedPanel) ? selectedPanel : null;
    this.selectedPedestal = findPedestal(this.p, selectedPedestal) ? selectedPedestal : null;
    if (this.scaleId !== selected) this.scaleId = null;
    this.applySelection();
    this.refreshGuides();
  },
  /** Redraw the outlines from the current selection. Cheap and idempotent. */
  applySelection() {
    for (const object of this.selectionObjects || []) {
      object.parent?.remove(object);
      object.geometry?.dispose();
      object.material?.dispose();
    }
    this.selectionObjects = [];
    this.resizeHandles = [];
    const outline = (geometry, parent) => {
      const edge = new T.LineSegments(
        geometry,
        new T.LineBasicMaterial({ color: "#78b4ff" }),
      );
      edge.userData.editorOnly = true;
      parent.add(edge);
      this.selectionObjects.push(edge);
      return edge;
    };
    this.selectionEdge = null;
    const entry = this.selected && this.artGroups.get(this.selected);
    const a = entry && this.p.art.find((x) => x.id === this.selected);
    if (entry?.box && a) {
      this.selectionEdge = outline(new T.EdgesGeometry(entry.box.geometry), entry.group);
      this.selectionEdge.scale.set(1.007, 1.007, 1.007);
      if (this.scaleId === a.id) {
        for (const [sx, sy] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) {
          const handle = new T.Mesh(new T.SphereGeometry(.045, 16, 10),
            new T.MeshBasicMaterial({color:"#91beff"}));
          // The group carries the work's scale, so the handles are placed in
          // the unscaled geometry the box was built at.
          handle.position.set(sx*entry.initial.w*IN/2, sy*entry.initial.h*IN/2, entry.initial.thickness*IN/2 + .008);
          handle.userData = {artId:a.id, editorOnly:true, sx, sy, stretch: sx === 0 || sy === 0};
          handle.renderOrder = 10;
          entry.group.add(handle);
          this.selectionObjects.push(handle);
          this.resizeHandles.push(handle);
        }
      }
    }
    for (const id of this.also || []) {
      const other = this.artGroups.get(id);
      if (!other?.box) continue;
      const edge = outline(new T.EdgesGeometry(other.box.geometry), other.group);
      edge.material.color.set("#f2a0ff");
      edge.scale.set(1.007, 1.007, 1.007);
    }
    const wallMesh = this.wallObjects.find((m) => m.userData.wall === this.selectedPanel);
    if (this.selectedPanel && wallMesh?.parent) {
      const edge = outline(new T.EdgesGeometry(wallMesh.geometry), wallMesh.parent);
      edge.position.copy(wallMesh.position);
      edge.scale.set(1.004, 1.004, 1.2);
    }
    const ped = this.selectedPedestal && findPedestal(this.p, this.selectedPedestal);
    const pedFrame = ped && this.pedestalFrames[ped.id];
    if (pedFrame) {
      const edge = outline(
        new T.EdgesGeometry(new T.BoxGeometry(ped.width * IN, ped.height * IN, ped.depth * IN)),
        pedFrame,
      );
      edge.position.set(0, (ped.height * IN) / 2, 0);
      edge.scale.setScalar(1.02);
    }
    // No frame drawn here. This used to end in `renderFrame()`, from before
    // the viewport drew on demand; it is wrapped in `watchForChanges`, so the
    // loop draws the outline on its next turn — and a synchronous frame on
    // top of that was a third full render for every click and every rebuild,
    // inside the click handler, on the machine least able to afford it.
  },
  updateArtwork(a) {
    const entry = this.artGroups.get(a.id);
    if (!entry) return;
    const { group, initial } = entry;
    group.position.set((a.x + a.w / 2) * IN, (a.y + a.h / 2) * IN,
      (a.offset + a.thickness / 2) * IN + 0.003);
    group.scale.set(a.w / initial.w, a.h / initial.h, a.thickness / initial.thickness);
    if (a.stretch && entry.plane) {
      entry.plane.scale.set(initial.w / entry.imageWidth, initial.h / entry.imageHeight, 1);
    }
    this.touchShadows();
  },
  /**
   * The venue's floor plan, laid on the floor at its real width: an image
   * plane just above the ground, under everything else, half see-through.
   * Editor-only — a planning aid, never in an export — and not pickable, so
   * the tape measures through it to the floor, which is the same place.
   */
  buildUnderlay(p, rev) {
    const u = p.booth.underlay;
    const asset = u && p.assets[u.asset];
    // The booth's venue plan means nothing laid under a whole show floor.
    if (!asset || u.on === false || this.show) return;
    this.texture(u.asset).then((t) => {
      if (this.revision !== rev) return;
      const aspect = (asset.height || 1) / (asset.width || 1);
      const map = t.clone();
      map.needsUpdate = true;
      const plane = new T.Mesh(
        new T.PlaneGeometry(u.width * IN, u.width * aspect * IN),
        new T.MeshBasicMaterial({ map, transparent: true, opacity: u.opacity ?? 0.6, depthWrite: false, toneMapped: false }),
      );
      plane.material.userData.ownedMap = true;
      plane.rotation.order = "YXZ";
      plane.rotation.set(-Math.PI / 2, ((u.rotation || 0) * Math.PI) / 180, 0);
      plane.position.set(u.x * IN, 0.004, u.z * IN);
      plane.renderOrder = -2;
      plane.name = "underlay";
      plane.userData.editorOnly = true;
      this.group.add(plane);
      this.invalidate();
    }).catch(() => {});
  },
  /**
   * The .glb models brought in (booth.models), each stood on the floor at its
   * typed height: scaled uniformly so its tallest point is that height, its
   * footprint centred on its X/Z and its lowest point on the floor. A model
   * file is parsed once per asset and cloned per placement.
   */
  buildModels(p, rev) {
    this.modelFrames = {};
    const list = (p.booth.models || []).filter(isShown);
    if (!list.length) return;
    this.modelCache ||= new Map();
    for (const m of list) {
      const asset = p.assets[m.asset];
      if (!asset) continue;
      let parsed = this.modelCache.get(m.asset);
      if (!parsed) {
        parsed = parseModel(asset.data);
        this.modelCache.set(m.asset, parsed);
        // A model that will not parse is forgotten, so a fixed file can try again.
        parsed.catch(() => this.modelCache.delete(m.asset));
      }
      this.loadingModel(parsed).then((source) => {
        if (this.revision !== rev) return;
        const g = new T.Group();
        g.name = "model:" + m.id;
        g.userData.tag = "furniture";
        const model = source.clone(true);
        const box = new T.Box3().setFromObject(model);
        const size = box.getSize(new T.Vector3());
        const k = size.y > 0 ? (m.height * IN) / size.y : 1;
        model.scale.setScalar(k);
        const centre = box.getCenter(new T.Vector3());
        model.position.set(-centre.x * k, -box.min.y * k, -centre.z * k);
        model.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        g.add(model);
        g.position.set(m.x * IN, 0, m.z * IN);
        g.rotation.y = ((m.rotation || 0) * Math.PI) / 180;
        // On a show floor with no booth of its own, the booth is offstage.
        (this.show && !homeBooth(this.show) ? this.group.getObjectByName("offstage") || this.group : this.group).add(g);
        this.modelFrames[m.id] = g;
        this.applyTags(g);
      }).catch(() => {});
    }
  },
  /** A model load in flight, counted like every other load (watchForChanges). */
  loadingModel(promise) {
    return promise;
  },
  /**
   * Hide every object whose tag is hidden, and show the rest. Hidden means
   * moved to layer 1, which the camera, every shadow camera and the raycaster
   * all leave out — so a hidden work is out of the picture, casts nothing and
   * cannot be clicked. Lights are never moved: the Light fixtures tag hides
   * the housings and the bar, not the light they give.
   */
  applyTags(root = this.group) {
    const hidden = this.hiddenTags;
    const walk = (o, off) => {
      const tag = o.userData?.tag;
      const hide = off || (!!tag && !tagShown(hidden, tag));
      if (!o.isLight) o.layers.set(hide ? 1 : 0);
      for (const child of o.children) walk(child, hide);
    };
    let parentHidden = false;
    for (let o = root.parent; o; o = o.parent) if (o.userData?.tag && !tagShown(hidden, o.userData.tag)) parentHidden = true;
    walk(root, parentHidden);
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  },
  setHiddenTags(tags) {
    this.hiddenTags = new Set(tags);
    this.applyTags();
  },
};
