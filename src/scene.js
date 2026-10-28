import * as T from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TextureCache } from "./texture-cache.js";
import { EnvironmentLighting } from "./lighting.js";
import { SurfaceTextures } from "./surfaces.js";
import { mixin } from "./scene/mixin.js";
import { lightRig, temperature } from "./scene/light-rig.js";
import { exportPasses } from "./scene/export.js";
import { video } from "./scene/video.js";
import { camera, FOV, MAX_POLAR } from "./scene/camera.js";
import { props } from "./scene/props.js";
import { measureTools, MAX_TAPES } from "./scene/measure-tools.js";
import { interaction } from "./scene/interaction.js";
import { renderLoop, BACKDROP_FRAMING, BACKDROP_FRAMING_MIN, BACKDROP_EDGE_LIMIT, safeBackdropFov, lockedPitch, backdropFov, isPanorama, renderScale } from "./scene/render-loop.js";
import { frameKey } from "./scene/shared.js";
import { build, ART_TEXTURE_MAX } from "./scene/build.js";
import { FrameBudget, startScale } from "./adaptive.js";
export class BoothScene {
  constructor(
    host,
    onSelect,
    onMove,
    onStart,
    onEnd = () => {},
    // A free-standing wall is selected and dragged the way artwork is, but it
    // is not artwork: it lives in booth.panels, its inspector is Layout, and
    // moving it changes X/Z rather than a placement. Two callbacks of its own
    // keep that separation, and default to nothing so every older caller —
    // the tests among them — still constructs a scene.
    onSelectPanel = () => {},
    onMovePanel = () => {},
    // A pedestal is placed and dragged exactly the way a free-standing wall
    // is, but it is not a wall: nothing hangs on it, it has no face, and its
    // controls are their own. Two more callbacks rather than overloading the
    // panel pair with a kind argument every existing caller would have to
    // start passing.
    onSelectPedestal = () => {},
    onMovePedestal = () => {},
  ) {
    this.host = host;
    this.onSelect = onSelect;
    this.onMove = onMove;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this.onSelectPanel = onSelectPanel;
    this.onMovePanel = onMovePanel;
    this.onSelectPedestal = onSelectPedestal;
    this.onMovePedestal = onMovePedestal;
    this.selectedPanel = null;
    this.selectedPedestal = null;
    this.pedestalObjects = [];
    this.pedestalFrames = {};
    this.personFrames = {};
    // Double-clicking a figure. Set by main.js after construction rather than
    // added to the constructor's long list of positional callbacks.
    this.onSelectPerson = () => {};
    // Tags hidden right now (see src/views.js). A view setting: main.js owns
    // the set and hands it over; `applyTags` does the hiding.
    this.hiddenTags = new Set();
    // Each figure kind's cut-out picture, loaded once and shared by every
    // figure of that kind across rebuilds. `texture` stays null while loading
    // and for good when the file is missing, which leaves the mannequin.
    this.cutouts = {};
    this.view = "perspective";
    // The show floor in 3D (src/show-scene.js): the hall plan being walked,
    // or null for the booth alone. View state, set by main.js through
    // `setShow` and read by `update`.
    this.show = null;
    this.move = false;
    // The Pan tool (SketchUp's hand): a left-drag slides the view across the
    // screen instead of orbiting, and a click picks nothing. See setPanTool.
    this.panTool = false;
    // Where each walk was left — the booth's and the show's — so walking
    // again takes up where the last walk stopped. See startWalk.
    this.lastWalk = {};
    // On by default, matching the toolbar button's own initial state: this is a
    // measured planning tool, and a drag that lands at 23.59 inches is not a
    // measurement. The button turns it off for fine placement.
    this.snap = true;
    this.textureCache = new TextureCache();
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#b5b4b0");
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    // Render above the display's own density and let the browser downsample.
    // antialias:true asks for MSAA, but on a 1x desktop monitor — which is most
    // of them — a white tent roof against a dark backdrop still stair-steps:
    // sample counts are the driver's choice and ANGLE often gives few.
    // Supersampling does not ask permission.
    // The Export panel's Preview quality, kept here rather than only in the
    // inspector because draft mode has to be able to put it back.
    this.quality = 2;
    // Auto quality's current rung and the frame budget that moves it. Set by
    // `setQuality(AUTO_QUALITY)`; unused at a fixed quality.
    this.autoScale = startScale(devicePixelRatio);
    this.budget = new FrameBudget();
    this.onAdapt = () => {};
    // Light-bar heads draw their shadows in exports always, and in the live
    // viewport only at High detail. See `setBarShadows`.
    this.barShadows = false;
    // Fast edit follows the gesture unless someone has locked it; see
    // setDraftPolicy.
    this.draftPolicy = "auto";
    // Draft mode is off on load: the booth should look like itself the first
    // time it is seen, and someone who never drags anything never needs this.
    this.draft = false;
    this.renderer.setPixelRatio(this.previewScale());
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.lighting = new EnvironmentLighting(this.renderer);
    this.surfaces = new SurfaceTextures(this.renderer);
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive measured 3D booth",
    );
    this.camera = new T.PerspectiveCamera(FOV, 1, 0.02, 100);
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
    // The backdrop's own pass needs somewhere to live. An empty scene carrying
    // nothing but the background reuses three's own background shader, so the
    // tone mapping and colour space stay identical to a one-pass render —
    // which a hand-written fullscreen shader would have to reproduce.
    this.backdropScene = new T.Scene();
    this.backdropCamera = new T.PerspectiveCamera(FOV, 1, 0.1, 10);
    this.backdropFraming = BACKDROP_FRAMING;
    this.backdropLock = true;
    this.backdropEdgeLimit = BACKDROP_EDGE_LIMIT;
    // What the overlay pass draws over a finished frame: a fade to black and an
    // optional lens flare. Both belong to a clip, not to the booth, so the
    // default is "nothing at all" and every recording restores it.
    this.overlay = { fade: 1, flare: null };
    // Dimension labels and the tape measure's reading: DOM over the canvas,
    // so they stay crisp at any quality and never reach an exported file.
    this.labelLayer = document.createElement("div");
    this.labelLayer.className = "scene-labels";
    host.append(this.labelLayer);
    this.annotations = [];
    // `points` is the tape being laid; with `keep` on, each finished tape is
    // kept in `kept` when the next one starts, so several can be read at once.
    this.measure = { on: false, points: [], kept: [], keep: false };
    this.onMeasure = () => {};
    this.watchForChanges();
    this.startLoop();
  }
}
// The class's methods, by area, moved out as they were (SCENE_SPLIT_PHASE.md).
mixin(BoothScene, lightRig);
mixin(BoothScene, exportPasses);
mixin(BoothScene, video);
mixin(BoothScene, camera);
mixin(BoothScene, props);
mixin(BoothScene, measureTools);
mixin(BoothScene, interaction);
mixin(BoothScene, renderLoop);
mixin(BoothScene, build);
// Moved with the light rig; still exported from here, where it always was.
export { temperature };
// Moved with the camera; still exported from here.
export { FOV };
// Moved with the tape measure; still exported from here.
export { MAX_TAPES };
// Moved to shared.js with picking (seam 7); still exported from here.
export { frameKey };
// Moved with the render loop (seam 8); still exported from here.
export { BACKDROP_FRAMING, BACKDROP_FRAMING_MIN, BACKDROP_EDGE_LIMIT, safeBackdropFov, lockedPitch, backdropFov, isPanorama, renderScale };
// Moved with the booth build (seam 9); still exported from here.
export { ART_TEXTURE_MAX };
