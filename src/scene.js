import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { makeTent, environment } from "./environment.js";
import { signTexture } from "./signage.js";
import { edgeMaterial } from "./edge-material.js";
import { TextureCache } from "./texture-cache.js";
import { EnvironmentLighting, artEnvIntensity, DEFAULT_FIDELITY } from "./lighting.js";
import { applyImageEdits, editedAspect, hasImageEdits } from "./image-edit.js";
import { IN, constrain, scalePanel } from "./model.js";
// The orbit camera may drop below the booth's centre of interest to give a
// low, looking-up perspective. It is stopped by the ground, not by a fixed
// angle: MIN_CAMERA_Y keeps the eye just above the floor plane, and
// MAX_POLAR avoids the up-vector flip OrbitControls suffers near 180 degrees.
const MIN_CAMERA_Y = 0.12;
const MAX_POLAR = Math.PI * 0.82;
export function temperature(k) {
  const t = (k - 2700) / 3800;
  return new T.Color().setRGB(
    1,
    0.7 + 0.28 * t,
    0.43 + 0.57 * t,
    T.SRGBColorSpace,
  );
}
export class BoothScene {
  constructor(host, onSelect, onMove, onStart, onEnd = () => {}) {
    this.host = host;
    this.onSelect = onSelect;
    this.onMove = onMove;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.view = "perspective";
    this.move = false;
    this.snap = false;
    this.textureCache = new TextureCache();
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#b5b4b0");
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.lighting = new EnvironmentLighting(this.renderer);
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive measured 3D booth",
    );
    this.camera = new T.PerspectiveCamera(44, 1, 0.02, 100);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = MAX_POLAR;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 18;
    this.ray = new T.Raycaster();
    this.pointer = new T.Vector2();
    this.group = new T.Group();
    this.scene.add(this.group);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.bind();
    this.renderer.setAnimationLoop(() => {
      if (!this.host.hidden) {
        this.clampToGround();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
      }
    });
  }
  // Allow the lowest polar angle that still keeps the camera above the floor
  // at its current distance, so orbiting down slides along the ground instead
  // of stopping at eye level or punching through the ground plane.
  clampToGround() {
    if (!this.camera.isPerspectiveCamera || !this.controls.enableRotate) return;
    const radius = this.camera.position.distanceTo(this.controls.target);
    if (!(radius > 0)) return;
    const cos = (MIN_CAMERA_Y - this.controls.target.y) / radius;
    const limit = Math.acos(Math.max(-1, Math.min(1, cos)));
    this.controls.maxPolarAngle = Math.min(MAX_POLAR, limit);
  }
  resize() {
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    if (!w || !h) return;
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
      const span =
        this.view === "plan"
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
  }
  disposeGroup() {
    this.group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          { if (m.userData.ownedMap) m.map?.dispose(); m.dispose(); },
        );
      }
      if (o.isLight) o.shadow?.dispose();
    });
    this.scene.remove(this.group);
    this.group = new T.Group();
    this.scene.add(this.group);
  }
  box(w, h, d, x, y, z, mat, parent = this.group) {
    const o = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  wallFrame(wall) {
    const p = this.p.booth,
      W = p.width * IN,
      D = p.depth * IN;
    const g = new T.Group();
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
  }
  async texture(id, edits = null) {
    const edited = hasImageEdits(edits);
    const asset = this.p.assets[id];
    return this.textureCache.get(id, edits, asset.data, () => new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => {
        try {
        let src = im;
        if (Math.max(im.width, im.height) > 2048) {
          const canvas = document.createElement("canvas"),
            scale = 2048 / Math.max(im.width, im.height);
          canvas.width = Math.round(im.width * scale);
          canvas.height = Math.round(im.height * scale);
          canvas.getContext("2d").drawImage(im, 0, 0, canvas.width, canvas.height);
          src = canvas;
        }
        if (edited) src = applyImageEdits(src, edits);
        const texture = new T.Texture(src);
        texture.colorSpace = T.SRGBColorSpace;
        texture.anisotropy = Math.min(
          8,
          this.renderer.capabilities.getMaxAnisotropy(),
        );
        texture.needsUpdate = true;
        resolve(texture);
        } catch (error) { reject(error); }
      };
      im.onerror = reject;
      im.src = asset.data;
    }));
  }
  update(p, selected) {
    this.renderer.shadowMap.needsUpdate = true;
    this.p = p;
    this.selected = selected;
    if (this.scaleId !== selected) this.scaleId = null;
    this.revision = (this.revision || 0) + 1;
    const rev = this.revision;
    this.disposeGroup();
    this.textureCache.retain([
      ...p.art.filter(a => a.asset).map(a => ({ id: a.asset, edits: a.edits, data: p.assets[a.asset]?.data })),
      ...[p.booth.surroundAsset, p.booth.groundAsset].filter(Boolean)
        .map(id => ({ id, edits: null, data: p.assets[id]?.data })),
    ]);
    this.artObjects = [];
    this.artGroups = new Map();
    this.wallObjects = [];
    this.resizeHandles = [];
    this.frames = {};
    const W = p.booth.width * IN,
      D = p.booth.depth * IN,
      H = p.booth.height * IN;
    const rough = (c) =>
      new T.MeshStandardMaterial({ color: c, roughness: 0.92 });
    environment(this.scene, this.group, p.booth);
    // The preset only supplies image-based lighting and a backdrop; the
    // procedural horizon above stays in place when its assets are missing.
    this.lighting
      .apply(this.scene, p.booth.envPreset, { background: !p.booth.surroundAsset })
      .then(() => {
        if (this.revision === rev) this.renderer.shadowMap.needsUpdate = true;
      })
      .catch(() => {});
    if (p.booth.surroundAsset) this.texture(p.booth.surroundAsset).then(t => {
      if (this.revision !== rev) return;
      t.mapping = T.EquirectangularReflectionMapping;
      this.scene.background = t;
      this.scene.backgroundRotation.y = (p.booth.surroundRotation || 0) * Math.PI / 180;
      this.scene.fog = null;
    }).catch(() => {});
    else this.scene.backgroundRotation.set(0, 0, 0);
    if (p.booth.groundAsset) this.texture(p.booth.groundAsset).then(t => {
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
    const ambient = new T.HemisphereLight("#e9f1ff", "#858079", p.ambient);
    this.group.add(ambient);
    const fill = new T.DirectionalLight("#fff4df", 0.6);
    fill.position.set(-3, 6, 5);
    fill.castShadow = true;
    fill.shadow.mapSize.set(1024, 1024);
    fill.shadow.camera.left = -5;
    fill.shadow.camera.right = 5;
    fill.shadow.camera.top = 5;
    fill.shadow.camera.bottom = -5;
    fill.shadow.normalBias = 0.015;
    this.group.add(fill);
    for (const wall of ["back", "left", "right"]) {
      const g = this.wallFrame(wall);
      this.frames[wall] = g;
      this.group.add(g);
      const config = p.booth.walls[wall],
        width = config.width * IN,
        height = config.height * IN;
      if (!config.enabled) continue;
      const wallMesh = this.box(
        width,
        height,
        0.055,
        width / 2,
        height / 2,
        -0.031,
        rough(p.booth.color),
        g,
      );
      wallMesh.userData.wall = wall;
      this.wallObjects.push(wallMesh);
      const exterior = new T.Group();
      exterior.position.set(width, 0, -0.063);
      exterior.rotation.y = Math.PI;
      g.add(exterior);
      this.frames[wall + "-outside"] = exterior;
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
    for (const a of p.art) {
      const frame = this.frames[a.wall + (a.face === "outside" ? "-outside" : "")];
      if (!p.booth.walls[a.wall].enabled) continue;
      const art = new T.Group();
      this.artGroups.set(a.id, { group: art, initial: { ...a } });
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
        edgeMaterial(a),
        art,
      );
      box.userData.artId = a.id;
      this.artObjects.push(box);
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
      if (a.id === selected) {
        const edge = new T.LineSegments(
          new T.EdgesGeometry(box.geometry),
          new T.LineBasicMaterial({ color: "#78b4ff" }),
        );
        edge.scale.set(1.007, 1.007, 1.007);
        art.add(edge);
        this.selectionEdge = edge;
        if (this.scaleId === a.id) {
          for (const [sx, sy] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]) {
            const handle = new T.Mesh(new T.SphereGeometry(.045, 16, 10),
              new T.MeshBasicMaterial({color:"#91beff"}));
            handle.position.set(sx*a.w*IN/2, sy*a.h*IN/2, a.thickness*IN/2 + .008);
            handle.userData = {artId:a.id, editorOnly:true, sx, sy, stretch: sx === 0 || sy === 0};
            handle.renderOrder = 10; art.add(handle); this.resizeHandles.push(handle);
          }
        }
      }
    }
    for (const l of p.lights) {
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
      const housing = new T.Mesh(
        new T.CylinderGeometry(0.045, 0.055, 0.13, 16),
        rough("#25282b"),
      );
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
      this.group.add(glow);
    }
    this.box(W, 0.025, 0.025, 0, H - 0.025, D * 0.2, rough("#2e3032"));
    if (p.booth.tent) this.group.add(makeTent(W,D,H,p.booth.tentStyle || "classic"));
    if (!this.initialized) {
      this.initialized = true;
      this.setView("perspective");
    }
  }
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
    this.renderer.shadowMap.needsUpdate = true;
  }
  setView(view) {
    this.view = view;
    const W = this.p.booth.width * IN,
      D = this.p.booth.depth * IN,
      H = this.p.booth.height * IN;
    const perspective = view === "perspective";
    this.camera = perspective
      ? new T.PerspectiveCamera(44, 1, 0.02, 100)
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
  }
  zoom(factor) {
    if (this.camera.isPerspectiveCamera) {
      const offset=this.camera.position.clone().sub(this.controls.target);
      offset.setLength(Math.max(this.controls.minDistance,Math.min(this.controls.maxDistance,offset.length()/factor)));
      this.camera.position.copy(this.controls.target).add(offset);
    } else { this.camera.zoom=Math.max(.3,Math.min(8,this.camera.zoom*factor));this.camera.updateProjectionMatrix(); }
    this.clampToGround();
    this.controls.update();
  }
  point(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.camera);
  }
  artFrame(a) {
    return this.frames[a.wall + (a.face === "outside" ? "-outside" : "")];
  }
  pickArt() {
    this.group.updateMatrixWorld(true);
    const hits = this.ray.intersectObjects([...this.artObjects, ...this.wallObjects], false);
    return hits[0]?.object.userData.artId ? hits[0] : null;
  }
  wallDrop(e, a) {
    this.point(e); this.group.updateMatrixWorld(true);
    const hit = this.ray.intersectObjects(this.wallObjects, false)[0];
    if (!hit || Math.abs(hit.face.normal.z) < .9) return null;
    const wall = hit.object.userData.wall, face = hit.face.normal.z > 0 ? "inside" : "outside";
    const frame = this.frames[wall + (face === "outside" ? "-outside" : "")];
    const local = frame.worldToLocal(hit.point.clone());
    const grid = this.snap ? 1 : .01;
    return constrain(this.p, {...a, wall, face,
      x:Math.round((local.x/IN-a.w/2)/grid)*grid,
      y:Math.round((local.y/IN-a.h/2)/grid)*grid});
  }
  focusWall(wall, face = "inside") {
    this.setView(wall);
    if (face !== "outside") return;
    const f = this.frames[wall + "-outside"];
    if (!f) return;
    f.updateWorldMatrix(true, false);
    const w = this.p.booth.walls[wall];
    const target = f.localToWorld(new T.Vector3(w.width*IN/2, w.height*IN/2, 0));
    const normal = new T.Vector3(0,0,1).applyQuaternion(f.getWorldQuaternion(new T.Quaternion()));
    this.controls.target.copy(target);
    this.camera.position.copy(target).addScaledVector(normal, 5);
    this.controls.update();
  }
  bind() {
    const c = this.renderer.domElement;
    const activateTransform = (id) => {
      this.scaleId = id;
      this.onSelect(id);
    };
    c.addEventListener("dblclick", e => {
      this.point(e);
      const hit = this.pickArt();
      if (!hit) return;
      e.preventDefault();
      activateTransform(hit.object.userData.artId);
    });
    c.addEventListener("pointerdown", e => {
      if (e.button !== 0 || this.drag) return;
      this.point(e); this.group.updateMatrixWorld(true);
      this.down = [e.clientX, e.clientY];
      const nearest = this.ray.intersectObjects([...this.resizeHandles, ...this.wallObjects, ...this.artObjects], false)[0];
      const handle = nearest?.object.userData.editorOnly ? nearest : null;
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
    c.addEventListener("pointermove", e => {
      if (!this.drag) return;
      this.point(e);
      const point = this.ray.ray.intersectPlane(this.drag.plane, new T.Vector3());
      if (!point) return;
      const d = this.drag, local = d.frame.worldToLocal(point);
      if (d.resizing) {
        const a = d.initial;
        if (d.stretch) {
          const horizontal = d.sx !== 0;
          const width = this.p.booth.walls[a.wall].width;
          const height = this.p.booth.walls[a.wall].height;
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
        this.onMove(constrain(this.p, {...a,
          x:Math.round((local.x/IN-d.dx)/grid)*grid,
          y:Math.round((local.y/IN-d.dy)/grid)*grid}));
      }
    });
    c.addEventListener("pointerup", e => {
      if (this.drag) {
        this.drag = null; this.down = null; this.controls.enabled = true;
        if (c.hasPointerCapture(e.pointerId)) c.releasePointerCapture(e.pointerId);
        this.onEnd();
        return;
      }
      if (this.down && Math.hypot(e.clientX-this.down[0], e.clientY-this.down[1]) < 7) {
        this.point(e);
        const hit = this.pickArt();
        const id = hit?.object.userData.artId || null;
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
          this.lastTap = id ? { id, time: now, x: e.clientX, y: e.clientY } : null;
          this.onSelect(id);
        }
      }
      this.down = null;
    });
    c.addEventListener("pointercancel", () => {
      this.drag = null; this.controls.enabled = true; this.down = null;
      this.onEnd();
    });
  }
  async export(width) {
    await Promise.allSettled(this.textureCache.pending());
    const canvas = this.renderer.domElement,
      w = canvas.width,
      h = canvas.height,
      ratio = w / h;
    const max = this.renderer.capabilities.maxTextureSize;
    if (width > max || width / ratio > max)
      throw new Error(
        "This device cannot render that export size. Choose 2048 px.",
      );
    const pixel = this.renderer.getPixelRatio();
    const hidden = [];
    this.group.traverse((o) => {
      if (o.isLineSegments || o.userData.editorOnly) {
        hidden.push(o);
        o.visible = false;
      }
    });
    try {
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(width, Math.round(width / ratio), false);
      this.renderer.render(this.scene, this.camera);
      return await new Promise((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("Export failed. Try 2048 px."))),
          "image/png",
        ),
      );
    } finally {
      hidden.forEach((o) => (o.visible = true));
      this.renderer.setPixelRatio(pixel);
      this.resize();
    }
  }
}
