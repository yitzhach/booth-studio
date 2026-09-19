import { TENTS } from "./environment.js";
import { ENV_PRESETS, ART_FIDELITY, DEFAULT_PRESET, DEFAULT_FIDELITY, resolvePreset, FIXTURE_MODES, DEFAULT_FIXTURES, isIndoor, showFixtures } from "./lighting.js";
import { MOVES, DEFAULT_MOVE, CUSTOM_MOVE, resolveMove, frameTimes } from "./camera-path.js";
import {
  EASES, MAX_KEYS, MIN_KEYS, MIN_SECONDS, MAX_SECONDS,
  emptyTimeline, keyFrom, normalizeTimeline, segmentSpeed, timelineSeconds,
} from "./timeline.js";
import { SIZES, DEFAULT_SIZE, FPS, DEFAULT_FPS, videoSupported, pickCodec } from "./video.js";
import { applyImageEdits, DEFAULT_IMAGE_EDITS, normalizeImageEdits } from "./image-edit.js";
import { PEOPLE, MAX_PEOPLE, MIN_HEIGHT, MAX_HEIGHT, newPerson, personHeight } from "./people.js";
import { FLARE_SOURCES, DEFAULT_FLARE_SOURCE, OVERHEAD } from "./flare.js";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "./style.css";
// Injected by vite.config.js at build time so the footer always names the exact
// deployment being viewed. Also exposed globally: window.__booth is DEV-only,
// and the deployed build is precisely where this needs to be checkable.
const BUILD = {
  version: __APP_VERSION__,
  commit: __COMMIT_SHA__,
  time: __BUILD_TIME__,
  short: __BUILD_TIME__.slice(0, 16).replace("T", " "),
};
window.BOOTH_BUILD = BUILD;
import {
  createIcons,
  Box,
  ImagePlus,
  LayoutPanelLeft,
  Lightbulb,
  Download,
  Undo2,
  Redo2,
  MousePointer2,
  Move,
  Grid2X2,
  Copy,
  Trash2,
  Plus,
  Minus,
  ChevronDown,
  Maximize,
  FolderOpen,
  Save,
  HelpCircle,
  Camera,
  Image as ImageIcon,
  Check,
  Sun,
  PanelLeftClose,
  X,
  AlignCenter,
  ArrowUpToLine,
  Layers,
  RotateCcw,
  Play,
  Building2,
  Columns2,
  Ruler,
} from "lucide";
import {
  demoProject,
  blankProject,
  uid,
  validateProject,
  escapeHTML as e,
  boundWarning,
  mismatch,
  GROUND_KINDS,
  GROUND_UPLOAD,
  groundKind,
  groundLibrary,
  groundUpload,
  removeGroundUpload,
  selectGround,
  constrain,
  constrainPanel,
  constrainPedestal,
  scalePanel,
  convex,
  MAX_PANELS,
  boothPanels,
  findPanel,
  panelKey,
  panelIdOf,
  panelRange,
  wallKeys,
  wallLabel,
  wallSpec,
  ART_SHOW_PANEL,
  LIGHT_BAR,
  MAX_PEDESTALS,
  PEDESTAL,
  VENUES,
  applyVenue,
  artShowPanel,
  boothPedestals,
  findPedestal,
  hallSpec,
  isArtShow,
  lightBarSpec,
  panelCount,
  relinkArtShowWalls,
} from "./model.js";
import { fixtureShare, lightBarFixtures } from "./lightbar.js";
import { load, save, download, readImage } from "./storage.js";
import { BoothScene, renderScale, BACKDROP_FRAMING } from "./scene.js";
import { PhotoEditor } from "./photo.js";
import { hangingGuide } from "./guide.js";
async function boot() {
  const icons = {
    Grid2x2: Grid2X2,
    Box,
    ImagePlus,
    LayoutPanelLeft,
    Lightbulb,
    Download,
    Undo2,
    Redo2,
    MousePointer2,
    Move,
    Grid2X2,
    Copy,
    Trash2,
    Plus,
  Minus,
    ChevronDown,
    Maximize,
    FolderOpen,
    Save,
    HelpCircle,
    Camera,
    Image: ImageIcon,
    Check,
    Sun,
    PanelLeftClose,
    X,
    AlignCenter,
    ArrowUpToLine,
    Layers,
    RotateCcw,
    Play,
    Building2,
    Columns2,
    Ruler,
  };
  const icon = (n) => `<i data-lucide="${n}"></i>`;
  const btn = (action, label, ic, cls = "") =>
    `<button data-action="${action}" class="${cls}" title="${e(label)}" aria-label="${e(label)}">${ic ? icon(ic) : ""}<span>${label}</span></button>`;
  let p,
    selected = null,
    // The free-standing wall the mouse and the position sliders are about to
    // move, by its "panel:<id>" key. Independent of `selected`: a panel is not
    // artwork, and its inspector is Layout rather than Artwork.
    selectedPanel = null,
    // The pedestal the mouse and the position sliders are about to move, by
    // its id. Exclusive with `selectedPanel` and with `selected`: one
    // inspector, one thing being moved.
    selectedPedestal = null,
    photoSelected = null,
    tab = "art",
    history = [],
    future = [],
    saveTimer,
    saveVersion = 0,
    search = "",
    lightIndex = 0,
    photoLightIndex = 0,
    busy = false,
    quality = 2,
    editingStart = null,
    // Video export state. It lives here rather than in the DOM because a
    // recording survives re-renders of the inspector and has to be cancellable
    // from a button the inspector redraws.
    videoMove = DEFAULT_MOVE,
    // The user's own keyframed move, built in the timeline dialog. Like every
    // other video setting this is view state: it is not saved with the booth,
    // is not in the undo history and does not touch schema 1.
    videoTimeline = null,
    // The batch list: clips queued with the settings they were queued with, so
    // a list built over ten minutes of composing still renders what was asked
    // for rather than whatever the panel says when Export all is pressed.
    videoBatch = [],
    videoBatchAt = -1,
    videoSeconds = MOVES[DEFAULT_MOVE].seconds,
    videoFps = DEFAULT_FPS,
    videoSize = DEFAULT_SIZE,
    videoProgress = 0,
    videoFrame = 0,
    videoFrames = 0,
    videoAbort = null,
    busyVideo = false,
    busyPreview = false,
    // What this browser will actually encode, probed rather than assumed. It
    // decides whether the file opens in QuickTime, so it is worth knowing
    // before spending minutes rendering rather than after.
    videoCodec = null,
    videoCodecFor = "";
  try {
    p = await load();
    if (p) validateProject(p);
  } catch (err) {
    p = null;
    console.error(err);
    setTimeout(
      () =>
        toast(
          "Saved project could not be opened. Import a backup if available.",
          true,
        ),
      500,
    );
  }
  function tagAssetRoles(project) {
    for (const item of project.art)
      if (item.asset && project.assets[item.asset]) project.assets[item.asset].role = "artwork";
    if (project.photo.asset && project.assets[project.photo.asset]) project.assets[project.photo.asset].role = "photo";
    if (project.booth.surroundAsset && project.assets[project.booth.surroundAsset]) project.assets[project.booth.surroundAsset].role = "surround";
    const ground = groundUpload(project);
    if (ground) project.assets[ground].role = "ground";
  }
  p ||= demoProject();
  tagAssetRoles(p);
  selected = p.art[0]?.id;
  document.querySelector("#app").innerHTML =
    `<header><a class="brand" href="#" aria-label="Booth Studio">${icon("box")}<span>Artist OS</span></a><span class="app-badge">Booth Studio</span><div class="project"><input id="project-name" aria-label="Project name" maxlength="120" value="${e(p.name)}"/>${icon("chevron-down")}</div><div class="save-status" id="save-status" role="status">Opening…</div>${btn("help", "Help", "help-circle", "icon-only")}<div class="avatar">IA</div></header>
<div class="workspace"><aside class="library" id="library"></aside><main class="editor"><div class="toolbar"><div class="toolgroup">${btn("select", "Select", "mouse-pointer-2", "active")}${btn("move", "Move", "move")}${btn("snap", "Snap 1″", "grid-2x2", "active")}</div><div class="toolgroup">${btn("undo", "Undo", "undo-2", "icon-only")}${btn("redo", "Redo", "redo-2", "icon-only")}</div><div class="mode-switch"><button data-action="mode-3d">3D booth</button><button data-action="mode-photo">Photo</button></div>${btn("export-tab", "Export", "download", "export-top")}</div><div class="viewport"><div id="scene"></div><div id="photo" hidden></div><div class="scene-label"><span class="eyebrow" id="mode-label">MEASURED WORKSPACE</span><strong id="scene-title"></strong><span id="scene-subtitle"></span></div><div id="photo-empty" hidden><div>${icon("image-plus")}<h2>Start with your booth shot</h2><p>Add artwork and adjust its four corners to match the wall perspective.</p>${btn("upload-photo", "Upload booth photo", "plus", "primary")}</div></div><div class="viewport-bottom"><div class="view-switch" id="view-switch"><button data-view="perspective" class="active">Perspective</button><button data-view="back">Back</button><button data-view="left">Left</button><button data-view="right">Right</button><button data-view="plan">Plan</button></div><div class="zoom-controls"><span class="zoom-label">Zoom</span>${btn("zoom-out", "Zoom out", "minus", "icon-only")}${btn("zoom-in", "Zoom in", "plus", "icon-only")}${btn("reset-view", "Reset view", "rotate-ccw", "icon-only")}</div></div></div><div class="statusbar"><span id="gesture-hint">Drag to orbit · scroll or +/− to zoom · right-drag to pan</span><span id="selection-status"></span></div></main><aside class="inspector"><div class="inspector-tabs">${["art", "layout", "show", "walls", "lighting", "video", "export"].map((t, i) => `<button data-tab="${t}">${icon(["image", "layout-panel-left", "building-2", "columns-2", "lightbulb", "video", "download"][i])}<span>${["Artwork", "Layout", "Art show", "Walls", "Lighting", "Video", "Export"][i]}</span></button>`).join("")}</div><div id="inspector-content"></div></aside></div><footer><span class="footer-brand">${icon("box")} BOOTH STUDIO <small>Prototype 01</small><small id="build-stamp" title="Version ${BUILD.version} · built ${BUILD.time} · commit ${BUILD.commit}">v${BUILD.version} · ${BUILD.short} UTC · ${BUILD.commit}</small></span><span>Your images. Your space. Your arrangement.</span><span id="network">Local workspace</span></footer><input type="file" id="art-input" accept="image/jpeg,image/png" multiple hidden/><input type="file" id="replace-input" accept="image/jpeg,image/png" hidden/><input type="file" id="photo-input" accept="image/jpeg,image/png" hidden/><input type="file" id="surround-input" accept="image/jpeg,image/png" hidden/><input type="file" id="ground-input" accept="image/jpeg,image/png" hidden/><input type="file" id="backup-input" accept=".json,.booth" hidden/><div id="toast" role="status"></div><dialog id="dialog"><div id="dialog-content"></div></dialog><dialog id="image-editor"><div id="image-editor-content"></div></dialog><dialog id="timeline-dialog" class="timeline-dialog"><div id="timeline-content"></div></dialog>`;
  let scene;
  try {
    scene = new BoothScene(
      document.querySelector("#scene"),
      (id) => {
        selected = id;
        // Artwork and a free-standing wall are two selections with one pair of
        // arrow-free controls between them; holding both at once would leave
        // the sliders pointing at a wall nobody is looking at.
        if (id) { selectedPanel = null; selectedPedestal = null; }
        tab = "art";
        render();
      },
      (a) => {
        const index = p.art.findIndex((x) => x.id === a.id);
        if (index < 0) return;
        p.art[index] = a;
        scene.updateArtwork(a);
      },
      checkpoint,
      () => {
        refreshScene();
        renderInspector();
        scheduleSave();
      },
      // Clicking a free-standing wall in the viewport opens Layout on it, the
      // way clicking artwork opens Artwork on that. The scene is the thing
      // that knows what was clicked; where its controls live is this file's.
      (key) => {
        if (selectedPanel === key) return;
        selectedPanel = key;
        if (key) { selectedPedestal = null; tab = "walls"; }
        render();
        if (key) revealPanelFields();
      },
      // Mid-drag. The scene has already restood the panel, so this only keeps
      // the project and the two sliders in step; the checkpoint came from
      // onStart and the save from onEnd, exactly as an artwork drag does.
      (panel) => {
        const list = boothPanels(p),
          index = list.findIndex((x) => x.id === panel.id);
        if (index < 0) return;
        list[index] = panel;
        syncPanelInputs(panel);
      },
      // Clicking a pedestal in the viewport opens the Walls tool on it, the
      // same deal a free-standing wall gets.
      (id) => {
        if (selectedPedestal === id) return;
        selectedPedestal = id;
        if (id) { selectedPanel = null; selected = null; tab = "walls"; }
        render();
        if (id) revealPedestalFields();
      },
      // Mid-drag: the scene has already restood the pedestal, so this keeps
      // the project and the two sliders in step and nothing else.
      (ped) => {
        const list = boothPedestals(p),
          index = list.findIndex((x) => x.id === ped.id);
        if (index < 0) return;
        list[index] = ped;
        syncPedestalInputs(ped);
      },
    );
  } catch (err) {
    document.querySelector("#scene").innerHTML =
      '<div class="webgl-error"><h2>3D is unavailable on this browser</h2><p>Enable hardware acceleration or try another browser. Photo editing, project backups, and hanging guides remain available.</p></div>';
    console.error(err);
  }
  const photo = new PhotoEditor(
    document.querySelector("#photo"),
    (id) => {
      photoSelected = id;
      tab = "art";
      renderInspector();
    },
    (id, q) => {
      p.photo.layers.find((l) => l.id === id).corners = q;
      photo.update(p, photoSelected);
      scheduleSave();
    },
    checkpoint,
  );
  function checkpoint() {
    history.push(JSON.stringify(p));
    if (history.length > 35) history.shift();
    future = [];
    document.querySelector('[data-action="undo"]').disabled = false;
    document.querySelector('[data-action="redo"]').disabled = true;
  }
  function mutate(fn) {
    checkpoint();
    fn();
    render();
    scheduleSave();
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    const v = ++saveVersion;
    document.querySelector("#save-status").textContent = "Saving…";
    saveTimer = setTimeout(async () => {
      try {
        await save(structuredClone(p));
        if (v === saveVersion)
          document.querySelector("#save-status").textContent =
            "✓ Saved on this device";
      } catch (err) {
        document.querySelector("#save-status").textContent = "Not saved";
        toast(
          "Browser storage is full or unavailable. Download a project backup now.",
          true,
        );
      }
    }, 350);
  }
  function toast(message, error = false) {
    const t = document.querySelector("#toast");
    t.textContent = message;
    t.className = "show" + (error ? " error" : "");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.className = ""), 6000);
  }
  function refreshIcons() {
    createIcons({ icons, attrs: { "stroke-width": 1.6 } });
  }
  function refreshScene() {
    if (selectedPanel && !findPanel(p, selectedPanel)) selectedPanel = null;
    if (selectedPedestal && !findPedestal(p, selectedPedestal)) selectedPedestal = null;
    scene?.update(p, selected, selectedPanel, selectedPedestal);
    photo.update(p, photoSelected);
  }
  function field(
    label,
    key,
    value,
    min = 0,
    max = 360,
    step = 0.25,
    unit = "in",
    scope = "art",
    // Several panels each show a "Width" and a "Position X". The visible label
    // is right as it is; the accessible name has to say which panel.
    aria = label,
  ) {
    return `<label class="field"><span>${label}</span><div><input type="number" data-field="${key}" data-scope="${scope}" aria-label="${e(aria)}" value="${Number(value.toFixed(3))}" min="${min}" max="${max}" step="${step}"/><small>${unit}</small></div></label>`;
  }
  // Every face a placement can hang on: the three perimeter walls inside and
  // out, then each free-standing panel front and back. The value keeps the
  // existing "<wall>-<face>" shape, and a panel key carries its own colon, so
  // the split is limited to the last dash.
  function locationOptions(a) {
    const rows = [];
    for (const face of ["inside", "outside"])
      for (const key of wallKeys(p)) {
        const panel = findPanel(p, key);
        const label = panel
          ? `${wallLabel(p, key)} · ${face === "outside" ? "Back" : "Front"}`
          : `${wallLabel(p, key).replace(" wall", "")} · ${face === "outside" ? "Exterior" : "Interior"}`;
        rows.push(
          `<option value="${e(key)}-${face}" ${a.wall === key && (a.face || "inside") === face ? "selected" : ""}>${e(label)}</option>`,
        );
      }
    return rows.join("");
  }
  // A position slider's travel is the booth's own footprint, so the whole
  // length of it is somewhere a wall can usefully stand. A panel already
  // outside that — typed, or in an older backup, both of which the schema
  // allows — widens its own slider instead of being dragged back in the
  // moment these controls are drawn.
  function panelSlider(panel, name, key, label) {
    const reach = Math.max(panelRange(p)[key], Math.abs(panel[key])),
      min = -Math.ceil(reach),
      max = Math.ceil(reach);
    return `<label class="range"><span>${label}<output>${Number(panel[key].toFixed(2))}in</output></span><input type="range" data-field="${key}" data-scope="panel-${e(panel.id)}" aria-label="${e(name + " " + label + " slider")}" min="${min}" max="${max}" step="1" value="${panel[key]}"/></label>`;
  }
  function panelFields() {
    const panels = boothPanels(p);
    return `<section><h3>Free-standing walls</h3><p class="muted">Interior panels you can stand anywhere in the booth and hang art on either side. Position is measured in inches from the centre of the floor: X is right, Z is toward the entrance. They do not change the booth footprint.</p><p class="muted">Click a free-standing wall in the booth to select it, then drag it across the floor or use the sliders. Snap keeps a drag on whole inches.</p>${panels.map((panel, i) => {
      const name = panel.name || "Panel " + (i + 1),
        scope = "panel-" + panel.id,
        chosen = selectedPanel === panelKey(panel.id),
        f = (label, key, value, min, max, step, unit) =>
          field(label, key, value, min, max, step, unit, scope, name + " " + label);
      return `<div class="wall-setting${chosen ? " selected" : ""}" data-panel="${e(panel.id)}"><div class="panel-heading"><h4>${e(name)}${chosen ? ' <span class="badge">Selected</span>' : ""}</h4>${btn("delete-panel-" + panel.id, "Remove " + name, "trash-2", "icon-only")}</div>${f("Width", "width", panel.width, 12, 360, 1, "in")}${f("Height", "height", panel.height, 24, 144, 1, "in")}${f("Position X", "x", panel.x, -360, 360, 1, "in")}${panelSlider(panel, name, "x", "Slide left / right")}${f("Position Z", "z", panel.z, -360, 360, 1, "in")}${panelSlider(panel, name, "z", "Slide front / back")}${f("Rotation", "rotation", panel.rotation, -180, 180, 5, "°")}</div>`;
    }).join("")}${panels.length < MAX_PANELS ? btn("add-panel", "Add free-standing wall", "plus", "wide") : `<p class="muted">${MAX_PANELS} free-standing walls is the limit.</p>`}</section>`;
  }
  // One panel's X and Z, in both controls at once. A drag in the viewport and
  // a pull on either slider are the same edit, so whichever one is not being
  // touched has to follow rather than sit at a stale number.
  function syncPanelInputs(panel, except = null) {
    for (const key of ["x", "z"]) {
      for (const input of document.querySelectorAll(
        `[data-scope="panel-${CSS.escape(panel.id)}"][data-field="${key}"]`,
      )) {
        if (input === except) continue;
        input.value = Number(panel[key].toFixed(3));
        input
          .closest("label")
          ?.querySelector("output")
          ?.replaceChildren(Number(panel[key].toFixed(2)) + "in");
      }
    }
  }
  // Selecting a wall in the viewport is only useful if its controls are on
  // screen; the Layout panel is long enough that they usually are not.
  function revealPanelFields() {
    const id = panelIdOf(selectedPanel);
    if (!id) return;
    document
      .querySelector(`.wall-setting[data-panel="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }
  /** One pedestal's X and Z, in both its number field and its slider. */
  function syncPedestalInputs(ped, except = null) {
    for (const key of ["x", "z"]) {
      for (const input of document.querySelectorAll(
        `[data-scope="pedestal-${CSS.escape(ped.id)}"][data-field="${key}"]`,
      )) {
        if (input === except) continue;
        input.value = Number(ped[key].toFixed(3));
        input
          .closest("label")
          ?.querySelector("output")
          ?.replaceChildren(Number(ped[key].toFixed(2)) + "in");
      }
    }
  }
  function revealPedestalFields() {
    if (!selectedPedestal) return;
    document
      .querySelector(`.wall-setting[data-pedestal="${CSS.escape(selectedPedestal)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }
  /** A position slider for a pedestal. Same travel rule a free-standing wall's gets. */
  function pedestalSlider(ped, name, key, label) {
    const reach = Math.max(panelRange(p)[key], Math.abs(ped[key])),
      min = -Math.ceil(reach),
      max = Math.ceil(reach);
    return `<label class="range"><span>${label}<output>${Number(ped[key].toFixed(2))}in</output></span><input type="range" data-field="${key}" data-scope="pedestal-${e(ped.id)}" aria-label="${e(name + " " + label + " slider")}" min="${min}" max="${max}" step="1" value="${ped[key]}"/></label>`;
  }
  function pedestalFields() {
    const list = boothPedestals(p);
    return `<section><h3>Pedestals</h3><p class="muted">A plinth with a solid top for business cards, a tablet or a guest book. Double-click one in the booth to pick it up, then drag it across the floor or use the sliders. Position is inches from the centre of the floor: X is right, Z is toward the entrance.</p>${list.map((ped, i) => {
      const name = ped.name || "Pedestal " + (i + 1),
        scope = "pedestal-" + ped.id,
        chosen = selectedPedestal === ped.id,
        f = (label, key, value, min, max, step, unit) =>
          field(label, key, value, min, max, step, unit, scope, name + " " + label);
      return `<div class="wall-setting${chosen ? " selected" : ""}" data-pedestal="${e(ped.id)}"><div class="panel-heading"><h4>${e(name)}${chosen ? ' <span class="badge">Selected</span>' : ""}</h4>${btn("delete-pedestal-" + ped.id, "Remove " + name, "trash-2", "icon-only")}</div>${f("Height", "height", ped.height, 6, 96, 1, "in")}${f("Width", "width", ped.width, 4, 96, 1, "in")}${f("Depth", "depth", ped.depth, 4, 96, 1, "in")}<label class="color-field">Finish<input type="color" data-field="color" data-scope="${scope}" aria-label="${e(name + " finish")}" value="${ped.color || PEDESTAL.color}"/></label>${f("Position X", "x", ped.x, -360, 360, 1, "in")}${pedestalSlider(ped, name, "x", "Slide left / right")}${f("Position Z", "z", ped.z, -360, 360, 1, "in")}${pedestalSlider(ped, name, "z", "Slide front / back")}${f("Rotation", "rotation", ped.rotation, -180, 180, 5, "°")}</div>`;
    }).join("")}${list.length < MAX_PEDESTALS ? btn("add-pedestal", "Add pedestal", "plus", "wide") : `<p class="muted">${MAX_PEDESTALS} pedestals is the limit.</p>`}</section>`;
  }
  /**
   * The art-show tool. Everything an indoor convention booth is measured by,
   * in one place, so the Layout tab stays the outdoor booth's own list rather
   * than growing a second booth inside it.
   */
  function artShowHTML() {
    const b = p.booth,
      show = isArtShow(p),
      module = artShowPanel(b),
      bar = lightBarSpec(b),
      hall = hallSpec(b),
      share = fixtureShare(bar.count);
    const venue = `<section><h3>Booth type</h3><label class="setting-label">Venue<select aria-label="Venue" data-field="venue" data-scope="booth">${Object.entries(VENUES).map(([k, v]) => `<option value="${k}" ${(b.venue || "outdoor") === k ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label><p class="muted">${show ? "An indoor art-show booth: seamless white walls, no canopy, and a light bar across the front. Switching venue rewrites the footprint, the walls and the finish to this venue's defaults — every one of them is still yours to change below." : "The outdoor pop-up: a canopy, seam posts every 30″ and the surroundings in Layout. Choose the art show to plan an indoor convention booth instead."}</p></section>`;
    if (!show)
      return `<div class="panel-heading"><h2>Art show booth</h2>${icon("building-2")}</div>${venue}<div class="empty-inspector"><h2>Not an art-show booth yet.</h2><p>Choose <strong>Art show · indoor booth</strong> above to plan 144″ white walls, a nine-head light bar and an exhibition hall around you. Nothing in this project is thrown away — the artwork keeps its walls.</p></div>`;
    const wallRow = (key, label) => {
      const max = key === "back" ? b.width : b.depth;
      return `<div class="wall-setting"><label class="check-field"><input type="checkbox" data-field="enabled" data-scope="wall-${key}" ${b.walls[key].enabled ? "checked" : ""}/>${label}</label>${field("Width", "width", b.walls[key].width, 12, max, 1, "in", "wall-" + key, label + " width")}${field("Height", "height", b.walls[key].height, 24, 144, 1, "in", "wall-" + key, label + " height")}<p class="muted">${panelCount(p, key)} × ${Number(module.width.toFixed(2))}″ panels</p></div>`;
    };
    return `<div class="panel-heading"><h2>Art show booth</h2>${icon("building-2")}</div>${venue}<section><h3>Booth dimensions <span>inches</span></h3><p class="muted">The whole footprint, yours to type. The side walls run along the depth; the back wall runs along the width.</p>${field("Booth width", "width", b.width, 48, 360, 1, "in", "booth", "Booth width")}${field("Booth depth", "depth", b.depth, 48, 360, 1, "in", "booth", "Booth depth")}${field("Booth height", "height", b.height, 48, 144, 1, "in", "booth", "Booth height")}<p class="muted">Changing the booth height sets all three walls to match. A wall wider than the side it stands on is clamped to fit.</p></section><section><h3>Walls</h3><p class="muted">Seamless white panels: no seam posts, no feet and no cap rail, because that is what a pro-panel art-show wall is.</p><label class="color-field">Wall finish<input type="color" data-field="color" data-scope="booth" value="${b.color}"/></label><div class="swatches">${["#f4f3f0", "#ffffff", "#e8e6e0", "#d8d4ca"].map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Wall finish ${c}"></button>`).join("")}</div>${wallRow("back", "Back wall")}${wallRow("left", "Left wall")}${wallRow("right", "Right wall")}</section><section><h3>Individual panel</h3><p class="muted">The display panel a wall is built from. Set its size here, then rebuild the walls from it — or leave the walls at their own measurements and use this as the module you are counting.</p>${field("Panel width", "width", module.width, 6, 360, 0.5, "in", "artShow", "Panel width")}${field("Panel height", "height", module.height, 24, 144, 1, "in", "artShow", "Panel height")}<p class="muted">Back ${panelCount(p, "back")} · left ${panelCount(p, "left")} · right ${panelCount(p, "right")} panels at this width.</p><label class="check-field"><input type="checkbox" data-field="linked" data-scope="artShow" ${module.linked ? "checked" : ""}/>Keep the walls built from this panel</label>${btn("relink-walls", "Rebuild walls from this panel", "ruler", "wide")}<p class="muted">Each wall keeps the number of panels it is nearest to now and takes this width and height. The footprint follows the walls.</p></section><section><h3>Light bar</h3><label class="check-field"><input type="checkbox" data-field="on" data-scope="lightBar" ${bar.on ? "checked" : ""}/>Light bar across the booth</label>${bar.on ? `${field("Fixtures", "count", bar.count, 1, 24, 1, "", "lightBar", "Light bar fixtures")}${field("Bar height", "height", bar.height, 24, 240, 1, "in", "lightBar", "Light bar height")}${range("Fixture brightness", "power", bar.power, 0, 300, 5, "lightBar")}${range("Temperature", "kelvin", bar.kelvin, 2700, 6500, 100, "lightBar", " K")}${range("Diffusion", "diffusion", bar.diffusion, 0, 1, 0.05, "lightBar")}<p class="muted">Diffusion stands in for the frost over each head and the bounce off a white hall: it opens the beams until they overlap into a wash, fades their edges, fills the shadows behind pedestals and art instead of stacking nine hard ones, and trims the fixtures back as they widen. 0 is a bare source.</p><p class="muted">${bar.count} head${bar.count === 1 ? "" : "s"} spotting the walls: ${share.left} left, ${share.back} back, ${share.right} right. Each is aimed at its own section of wall from the booth's own measurements, so they re-aim when a wall moves. A hidden wall takes none.</p>` : `<p class="muted">No bar. The spotlights in Lighting still light this booth.</p>`}</section><section><h3>Exhibition hall</h3><label class="check-field"><input type="checkbox" data-field="on" data-scope="hall" ${hall.on ? "checked" : ""}/>Stand this booth in a white exhibition hall</label>${hall.on ? `${field("Ceiling height", "ceiling", hall.ceiling, 96, 720, 12, "in", "hall", "Hall ceiling height")}<label class="check-field"><input type="checkbox" data-field="showCeiling" data-scope="hall" ${hall.showCeiling ? "checked" : ""}/>Draw the ceiling</label><p class="muted">${Number((hall.ceiling / 12).toFixed(1))} ft. The ceiling is off by default: at this height it is almost always out of frame, and drawing it puts a grey wash over the booth.</p>` : ""}<label class="check-field"><input type="checkbox" data-field="neighbors" data-scope="booth" ${b.neighbors ? "checked" : ""}/>Surround with other booths</label>${b.neighbors ? `<p class="muted">Indoors the neighbouring booths are the same white walls as yours, without canopies. Their spacing is in Layout → Surroundings.</p>` : ""}</section><section><h3>Walls and pedestals</h3><p class="muted">Free-standing walls and pedestals have a tool of their own, so neither list has to live in here.</p>${btn("open-walls", "Open the Walls tool", "columns-2", "wide")}</section>`;
  }
  function range(
    label,
    key,
    value,
    min,
    max,
    step,
    scope = "global",
    unit = "",
  ) {
    return `<label class="range"><span>${label}<output>${Number(value.toFixed(2))}${unit}</output></span><input type="range" data-field="${key}" data-scope="${scope}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${value}"/></label>`;
  }
  function artThumb(a) {
    if (a.kind === "sign" || a.kind === "label")
      return `<div class="sign-thumb"><strong>${e(a.kind === "sign" ? a.artistName || "Artist name" : a.title)}</strong><span>${e(a.kind === "sign" ? a.city || "City, State" : a.medium || "")}</span></div>`;
    const asset = p.assets[a.asset];
    return asset
      ? `<img src="${asset.data}" alt="${e(a.title)}"/>`
      : `<div class="sample-thumb sample-${p.art.indexOf(a) % 6}"><span>${a.w} × ${a.h}</span></div>`;
  }
  function libraryItems() {
    const excluded = new Set([
      p.photo.asset,
      p.booth.surroundAsset,
      ...groundLibrary(p).map((g) => g.id),
    ].filter(Boolean));
    const originals = Object.entries(p.assets)
.filter(([id, asset]) => !excluded.has(id) && (asset.role === "artwork" || p.art.some((item) => item.asset === id)))
      .map(([assetId, asset]) => {
        const existing = p.art.find((item) => item.asset === assetId);
        if (existing) return { ...existing, sourceKey: "asset:" + assetId };
        const h = Math.min(48, (36 * asset.height) / asset.width);
        return {
          id: "catalog-" + assetId,
          sourceKey: "asset:" + assetId,
          asset: assetId,
          title: asset.name.replace(/\.[^.]+$/, ""),
          wall: "back",
          face: "inside",
          x: 12,
          y: 30,
          w: +((h * asset.width) / asset.height).toFixed(3),
          h: +h.toFixed(3),
          thickness: 1.5,
          offset: 0.75,
        };
      });
    const samples = p.art
      .filter((item) => !item.asset && !item.kind && !item.sourceId)
      .map((item) => ({ ...item, sourceKey: "sample:" + item.id }));
    return [...originals, ...samples];
  }
  function templateFromSource(sourceKey) {
    return libraryItems().find((item) => item.sourceKey === sourceKey);
  }
  function placementFromTemplate(template, keepEdits = false) {
    const current = p.art.find((item) => item.id === selected);
    const wall = current?.wall || template.wall || "back";
    const face = current?.face || template.face || "inside";
    return constrain(p, {
      ...template,
      id: uid(),
      sourceKey: undefined,
      sourceId: template.asset ? undefined : template.sourceId || template.id,
      wall,
      face,
      x: current ? current.x + 6 : template.x ?? 12,
      y: current ? current.y : template.y ?? 30,
      edits: keepEdits && template.edits ? structuredClone(template.edits) : undefined,
    });
  }
  function addCatalogPlacement(sourceKey) {
    const template = templateFromSource(sourceKey);
    if (!template) return;
    if (p.art.length >= 200) {
      toast("This prototype supports up to 200 wall placements.", true);
      return;
    }
    if (p.mode === "photo") {
      addPhotoLayer(template);
      return;
    }
    mutate(() => {
      const placed = placementFromTemplate(template);
      p.art.push(placed);
      selected = placed.id;
      tab = "art";
    });
    toast("Added another placement. Double-tap it on the wall to move or scale.");
  }
  function libraryHTML(mobile = false) {
    const items = libraryItems();
    const active = p.art.find((item) => item.id === selected);
    return `<div class="panel-heading"><h2>Original panels <small>${items.length}</small></h2>${btn("upload-art", "Add original", "plus", "icon-only")}</div>${!mobile ? '<label class="search"><span>⌕</span><input id="search" placeholder="Find an original…" aria-label="Find an original" value="' + e(search) + '"/></label>' : ""}<div class="library-caption">REUSABLE ORIGINALS <span>${p.art.length} placed</span></div><div class="art-list">${
      items
        .filter((item) => mobile || item.title.toLowerCase().includes(search.toLowerCase()))
        .map((item) => {
          const copies = item.asset
            ? p.art.filter((placed) => placed.asset === item.asset).length
            : p.art.filter((placed) => placed.id === item.id).length;
          const activeSource = item.asset
            ? active?.asset === item.asset
            : active?.id === item.id;
          return `<button class="art-card ${activeSource ? "selected" : ""}" draggable="${p.mode === "3d"}" data-source="${e(item.sourceKey)}" title="Click or drag to add another placement"><div class="thumb">${artThumb(item)}</div><div><strong>${e(item.title)}</strong><span>${item.w} × ${item.h} × ${item.thickness} in</span><small>${item.asset ? copies + " placement" + (copies === 1 ? "" : "s") : "Reusable sample panel"}</small></div></button>`;
        })
        .join("") || '<p class="muted">Upload JPG or PNG artwork to begin.</p>'
    }</div><p class="library-drag-note">Drag an original onto any interior or exterior wall. Each drop creates a new placement; the original stays here.</p>${p.mode === "3d" ? `<div class="asset-tools"><h3>Booth assets</h3><div class="button-row">${btn("add-sign", "Artist sign", "plus")}${btn("add-label", "Artwork label", "plus")}</div></div>` : ""}<div class="library-bottom">${btn("upload-art", "Upload originals", "image-plus", "wide")}${p.art.some((item) => !item.asset && !item.kind) ? btn("clear-samples", "Remove sample panels", null, "wide text-button") : ""}<p>Original files stay intact.<br>Saved only on this browser/device.</p></div>`;
  }
  function renderLibrary() {
    document.querySelector("#library").innerHTML = libraryHTML();
  }
  function signFields(a) {
    const input = (label, key, value) => `<label class="setting-label">${label}<input type="text" data-field="${key}" data-scope="art" aria-label="${label}" maxlength="200" value="${e(value || "")}"/></label>`;
    if (a.kind === "sign") return `<section><h3>Artist sign</h3>${input("Artist name","artistName",a.artistName)}${input("City / State","city",a.city)}${input("Medium","medium",a.medium)}</section>`;
    if (a.kind === "label") return `<section><h3>Artwork label</h3><p class="muted">Use Artwork title above for the first line.</p>${input("Medium","medium",a.medium)}${input("Price / detail","price",a.price)}</section>`;
    return "";
  }
  // One picker, two labelled groups. Selecting anything from either group
  // switches the floor, because a shipped kind and an uploaded photograph are
  // now the same kind of choice — there is nothing to remove first.
  function groundFields() {
    const labels = { studio: "Studio floor", grass: "Grass", concrete: "Concrete", asphalt: "Asphalt", carpet: "Carpet", wood: "Wood floor" };
    const upload = groundUpload(p), library = groundLibrary(p);
    const current = upload ? GROUND_UPLOAD + upload : groundKind(p);
    const option = (value, label) => `<option value="${e(value)}" ${current === value ? "selected" : ""}>${e(label)}</option>`;
    return `<label class="setting-label">Ground<select aria-label="Ground" data-field="ground" data-scope="booth"><optgroup label="Preset grounds">${GROUND_KINDS.map((k) => option(k, labels[k])).join("")}</optgroup>${library.length ? `<optgroup label="Your photographs">${library.map((g) => option(GROUND_UPLOAD + g.id, g.name.replace(/\.[^.]+$/, ""))).join("")}</optgroup>` : ""}</select></label>
      ${upload ? `${field("Ground tile size","groundTile",p.booth.groundTile||48,12,240,1,"in","booth")}${btn("remove-ground-upload","Delete this ground photograph",null,"wide")}` : ""}
      ${btn("upload-ground","Add ground photograph","image-plus","wide")}
      <p class="muted">Presets are the shipped surfaces; your own photographs join the list beneath them. A ground photograph should be top-down and ideally seamless. It stays on this device and enters backups. Deleting one returns the floor to the last preset.</p>`;
  }
  function surroundingsFields() {
    const b=p.booth;
    return `${b.neighbors ? `<label class="setting-label">Booth position<select aria-label="Booth position" data-field="neighborLayout" data-scope="booth">${Object.entries({inline:"Inline · both sides","corner-left":"Left corner · left side open","corner-right":"Right corner · right side open",island:"Island · no adjoining booths"}).map(([k,v])=>`<option value="${k}" ${(b.neighborLayout||"inline")===k?"selected":""}>${v}</option>`).join("")}</select></label>${field("Side spacing","neighborGap",b.neighborGap ?? 24,0,240,1,"in","booth")}${(b.neighborLayout||"inline") !== "island" ? `<label class="check-field"><input type="checkbox" data-field="neighborRear" data-scope="booth" ${b.neighborRear?"checked":""}/>Booth behind</label>${b.neighborRear ? field("Rear spacing","rearGap",b.rearGap ?? 24,0,240,1,"in","booth") : ""}` : ""}<p class="muted">Gaps are between nominal footprint edges. Left/right are viewed from the entrance. Tent overhangs and artwork can extend into the gap.</p>` : ""}
      <h4>Photographic materials</h4>
      ${btn("upload-surround",b.surroundAsset?"Replace panorama":"Upload 360° panorama","image-plus","wide")}
      ${b.surroundAsset || resolvePreset(b.envPreset).hdri ? `<h3>Backdrop</h3><div class="backdrop-zoom"><span>Zoom</span>${btn("backdrop-out","Zoom backdrop out","minus","icon-only")}${btn("backdrop-in","Zoom backdrop in","plus","icon-only")}${btn("backdrop-reset","Reset backdrop","rotate-ccw","icon-only")}</div>${range("Backdrop zoom","backdropFraming",b.backdropFraming ?? BACKDROP_FRAMING,25,100,1,"booth","%")}${field("Pan · horizontal","surroundRotation",b.surroundRotation||0,-180,180,1,"°","booth")}${field("Tilt · vertical","backdropTilt",b.backdropTilt||0,-45,45,1,"°","booth")}<label class="check-field"><input type="checkbox" data-field="backdropLock" data-scope="booth" ${(b.backdropLock ?? true) ? "checked" : ""}/>Lock backdrop to the horizon</label><p class="muted">On, the photographed horizon stays fixed against the floor as you orbit up and down. Off, the backdrop moves with its own wider lens, so the horizon drifts against the booth as the camera pitches.</p><p class="muted">A spherical backdrop sits at infinity, so only the lens frames it — orbiting cannot pull it back. Lower zoom draws it through a wider lens, which pushes the surroundings away and makes them sharper, while the booth keeps its own perspective. 100% matches the camera. Pan swings it sideways; tilt aims it up or down.</p>` : ""}
      ${b.surroundAsset ? btn("clear-surround","Remove panorama",null,"wide") : ""}
      <p class="muted">Panorama: 2:1 full-sphere JPG/PNG, not an ordinary flat photo. Your own panorama replaces the environment preset's backdrop; rotation turns whichever of the two is showing, and has nothing to turn while a preset's image files are missing. Ground photographs are chosen with the Ground picker above. Images stay on this device and enter backups/exports. Scenery is a backdrop, not reconstructed 3D.</p>`;
  }
  // Asks the browser which codec it will encode, for the size and rate
  // currently chosen, and re-renders the panel once it knows. Keyed so that
  // changing the resolution or frame rate re-probes: the H.264 level depends
  // on both, and a machine can support one and refuse another.
  async function probeCodec() {
    const key = `${videoSize}/${videoFps}`;
    if (videoCodecFor === key) return;
    videoCodecFor = key;
    const preset = SIZES[videoSize] || SIZES[DEFAULT_SIZE];
    try {
      videoCodec = await pickCodec({
        width: preset.width,
        height: preset.height,
        framerate: videoFps,
        bitrate: preset.bitrate,
      });
    } catch {
      videoCodec = null;
    }
    if (tab === "export" || tab === "video") renderInspector();
  }

  // A figure lands in front of the back wall and a little to the side of the
  // ones already there, so two in a row do not stand inside each other.
  function addPerson(kind) {
    const people = p.booth.people || [];
    if (people.length >= MAX_PEOPLE) return toast(`${MAX_PEOPLE} figures is the limit.`, true);
    const person = { ...newPerson(kind, uid()), x: (people.length % 3) * 30 - 30, z: 18 + Math.floor(people.length / 3) * 24 };
    mutate(() => (p.booth.people = [...people, person]));
    toast(`${kind === "man" ? "Man" : "Woman"} added at ${Math.floor(person.height / 12)}′${person.height % 12}″.`);
  }
  // Figures for scale. A wall height in inches is hard to read; the same wall
  // beside a 5'6" visitor is not. They are a drawing aid, so they live in the
  // Layout panel beside the surroundings rather than in the artwork list, and
  // they are excluded from the hanging guide.
  function peopleSection() {
    const people = p.booth.people || [];
    const rows = people
      .map((person, i) => {
        const label = person.kind === "man" ? "Man" : "Woman";
        return `<div class="person-row" data-person="${person.id}"><div class="key-head"><strong>${label} ${i + 1}</strong><span class="muted">${Math.floor(person.height / 12)}′${Math.round(person.height % 12)}″</span></div>${field("Height", "height", person.height, MIN_HEIGHT, MAX_HEIGHT, 1, "in", "person-" + person.id)}<div class="field-pair">${field("Left / right", "x", person.x, -600, 600, 1, "in", "person-" + person.id)}${field("Front / back", "z", person.z, -600, 600, 1, "in", "person-" + person.id)}</div>${field("Facing", "rotation", person.rotation ?? 0, -180, 180, 5, "°", "person-" + person.id)}<div class="button-row">${btn("delete-person", "Remove", "trash-2")}</div></div>`;
      })
      .join("");
    return `<section><h3>People for scale <span>${people.length} / ${MAX_PEOPLE}</span></h3><p class="muted">Stand-ins so the booth reads at human size. ${Object.values(PEOPLE).map((v) => e(v.label)).join(" · ")} by default, and every figure's height is editable. They are excluded from the hanging guide.</p>${people.length < MAX_PEOPLE ? `<div class="button-row">${btn("add-woman", "Add woman", "user-round")}${btn("add-man", "Add man", "user-round")}</div>` : `<p class="muted">${MAX_PEOPLE} figures is the limit.</p>`}${rows}</section>`;
  }

  // Video export. Offered only where it can actually be delivered: the encoder
  // is WebCodecs, and saying up front what it will produce is kinder than a
  // failure — or a file QuickTime refuses — after someone has waited through a
  // render.
  function videoSection() {
    const custom = videoMove === CUSTOM_MOVE;
    const move = resolveMove(videoMove);
    const supported = videoSupported();
    // Fire and forget: the probe re-renders this panel when it answers, and it
    // no-ops for a size and rate it has already asked about, so this cannot
    // loop.
    if (supported) probeCodec();
    if (!supported)
      return `<section><h3>Video</h3><p class="muted">Video export needs the WebCodecs video encoder, which this browser does not offer. Chrome, Edge and Safari 16.4 or newer have it. Export PNG works everywhere.</p></section>`;
    const moveOptions = [
      ...Object.entries(MOVES).map(([k, v]) => `<option value="${k}" ${videoMove === k ? "selected" : ""}>${e(v.label)}</option>`),
      `<option value="${CUSTOM_MOVE}" ${custom ? "selected" : ""}>Custom · your own keyframes</option>`,
    ].join("");
    // A custom clip's length lives in the timeline, with the keyframe times it
    // has to agree with; offering a second length control beside it would let
    // the two contradict each other.
    const lengthField = custom
      ? `${btn("edit-timeline", "Edit timeline…", "sliders-horizontal", "wide")}<p class="muted">${e(timelineSummary())}</p>`
      : `<label class="setting-label">Length<select id="video-seconds" aria-label="Clip length">${[6, 8, 10, 12, 14, 16, 20]
          .map((sec) => `<option value="${sec}" ${videoSeconds === sec ? "selected" : ""}>${sec} seconds</option>`)
          .join("")}</select></label>`;
    const describe = custom
      ? "Your own keyframes, in the order you set them. Compose a shot in the viewport, add it as a keyframe, and repeat — each one is the exact view you captured, not a gesture applied to the current framing."
      : `${e(move.describe)} The move starts and ends on the view you have now, so compose the shot first.`;
    return `<section><h3>Video</h3><label class="setting-label">Camera move<select id="video-move" aria-label="Camera move">${moveOptions}</select></label><p class="muted">${describe}</p>${lengthField}<label class="setting-label">Frame rate<select id="video-fps" aria-label="Frame rate">${FPS.map(
      (f) => `<option value="${f}" ${videoFps === f ? "selected" : ""}>${f} fps</option>`,
    ).join("")}</select></label><label class="setting-label">Resolution<select id="video-size" aria-label="Video resolution">${Object.entries(SIZES)
      .map(([k, v]) => `<option value="${k}" ${String(videoSize) === k ? "selected" : ""}>${e(v.label)}</option>`)
      .join("")}</select></label><p class="muted">MP4 · H.264 where this browser can encode it, which is what QuickTime Player and phones want. Width comes from the setting, height from the viewport's aspect ratio. Every frame is rendered in full before it is encoded, so the clip runs at the frame rate you chose however fast this machine is — which is why it takes longer than the clip lasts.</p>${videoCodecLine()}${busyPreview ? btn("stop-preview", "Stop preview", "x", "wide") : btn("preview-move", "Preview the move", "play", "wide")}<p class="muted">Plays the move in the viewport at its real length, without rendering anything. Judge it here first: a 14-second 1440p clip is minutes of encoding.</p>${btn("export-video", "Export MP4", "download", "primary wide")}${busyVideo ? btn("cancel-video", "Cancel", "x", "wide") : ""}<div class="video-progress" role="status" aria-live="polite">${busyVideo ? `<progress max="1" value="${videoProgress}"></progress><span>${Math.round(videoProgress * 100)}% · frame ${videoFrame} of ${videoFrames}</span>` : ""}</div></section>`;
  }
  // The timeline the export will render, always normalised: the dialog edits a
  // plain object and everything else reads it through here, so no caller has to
  // defend itself against an unordered or half-built one.
  function timeline() {
    videoTimeline = normalizeTimeline(videoTimeline || emptyTimeline(...currentPose()), {
      position: currentPose()[0],
      target: currentPose()[1],
    });
    return videoTimeline;
  }
  const currentPose = () => {
    const pose = scene?.pose();
    return [pose?.position || [3, 1.6, 4], pose?.target || [0, 1.2, 0]];
  };
  // A one-line answer to "what will this export?", which is the question the
  // panel is actually being asked once the timeline is closed.
  function timelineSummary() {
    const tl = timeline();
    const holds = tl.keys.reduce((sum, k) => sum + (k.hold || 0), 0);
    const parts = [`${tl.keys.length} keyframes`, `${tl.seconds} seconds`];
    if (holds > 0) parts.push(`${holds.toFixed(1)}s held`);
    if (tl.fade.in > 0 || tl.fade.out > 0) parts.push(`fade ${tl.fade.in}s / ${tl.fade.out}s`);
    if (tl.flare.on) parts.push("lens flare");
    return parts.join(" · ") + ".";
  }
  // The timeline dialog. It reuses #dialog rather than owning one, because two
  // modal dialogs in one app is two sets of focus and escape-key behaviour to
  // keep in step.
  function renderTimelineDialog() {
    const tl = timeline();
    const seconds = tl.seconds;
    const noLights = !(p.lights || []).length;
    const rows = tl.keys
      .map((k, i) => {
        const first = i === 0;
        const last = i === tl.keys.length - 1;
        const speed = last ? null : segmentSpeed(tl, i);
        return `<div class="key-row" data-key="${k.id}"><div class="key-head"><strong>${first ? "Start" : last ? "End" : `Keyframe ${i + 1}`}</strong><span class="muted">${(k.t * seconds).toFixed(1)}s</span></div><div class="key-fields"><label class="setting-label">At<input type="number" data-key-field="t" data-key="${k.id}" min="0" max="${seconds}" step="0.1" value="${(k.t * seconds).toFixed(1)}" ${first || last ? "disabled" : ""} aria-label="Keyframe time in seconds"/></label><label class="setting-label">Hold<input type="number" data-key-field="hold" data-key="${k.id}" min="0" max="10" step="0.1" value="${(k.hold || 0).toFixed(1)}" aria-label="Seconds held on this pose"/></label>${
          last
            ? ""
            : `<label class="setting-label">Ramp<select data-key-field="ease" data-key="${k.id}" aria-label="Segment ramp">${Object.entries(EASES)
                .map(([id, v]) => `<option value="${id}" ${k.ease === id ? "selected" : ""}>${e(v.label)}</option>`)
                .join("")}</select></label>`
        }</div>${speed === null ? "" : `<p class="muted">Then travels ${speed.toFixed(2)} m/s to the next keyframe.</p>`}<div class="button-row">${btn("timeline-go", "Go to this view", "camera")}${btn("timeline-recapture", "Recapture", "rotate-ccw")}${tl.keys.length > MIN_KEYS ? btn("timeline-delete", "Delete", "trash-2") : ""}</div></div>`;
      })
      .join("");
    document.querySelector("#timeline-content").innerHTML =
      `<div class="panel-heading"><h2>Custom camera timeline</h2>${btn("close-timeline", "Close", "x", "icon-only")}</div><p class="muted">Compose a shot in the viewport behind this panel, then add it as a keyframe. Each keyframe is the exact view you captured. Times set the speed between them; the ramp is what makes a move read as a camera rather than a scrub.</p><label class="setting-label">Clip length<input type="number" id="timeline-seconds" min="${MIN_SECONDS}" max="${MAX_SECONDS}" step="1" value="${seconds}" aria-label="Clip length in seconds"/></label><div class="key-list">${rows}</div>${tl.keys.length < MAX_KEYS ? btn("timeline-add", "Add keyframe from this view", "plus", "primary wide") : `<p class="muted">${MAX_KEYS} keyframes is the limit. Delete one to add another.</p>`}<section><h3>Fades</h3><div class="field-pair"><label class="setting-label">Fade in<input type="number" id="timeline-fade-in" min="0" max="${(seconds / 2).toFixed(1)}" step="0.1" value="${tl.fade.in.toFixed(1)}" aria-label="Fade in seconds"/></label><label class="setting-label">Fade out<input type="number" id="timeline-fade-out" min="0" max="${(seconds / 2).toFixed(1)}" step="0.1" value="${tl.fade.out.toFixed(1)}" aria-label="Fade out seconds"/></label></div><p class="muted">Seconds of black at each end. Zero disables. The fade is drawn over the finished frame, so it reaches real black rather than a dark wash.</p></section><section><h3>Lens flare</h3><label class="check-field"><input type="checkbox" id="timeline-flare" ${tl.flare.on ? "checked" : ""}/>Lens flare during the move</label><label class="setting-label">Comes from<select id="timeline-flare-source" aria-label="Lens flare source">${Object.entries(FLARE_SOURCES).map(([k, v]) => `<option value="${k}" ${tl.flare.source === k ? "selected" : ""} ${k === "spot" && noLights ? "disabled" : ""}>${e(v)}</option>`).join("")}</select></label>${tl.flare.source === "spot" && noLights ? `<p class="warn-note">This booth has no spotlights, so a flare from one would never appear. Use the overhead source, or add a spotlight in Lighting.</p>` : ""}${range("Flare strength", "flare-strength", Math.round(tl.flare.strength * 100), 0, 100, 1, "timeline", "%")}<p class="muted">${tl.flare.source === "overhead" ? `An unseen light ${Math.round(OVERHEAD.y / 12)} ft over the centre of the booth, standing in for the sun or a hall's high bay. Nothing is drawn there and nothing is lit by it — only the flare says it is there.` : "The brightest spotlight in the booth."} The flare tracks the camera: its ghosts sit on the line from that light through the centre of frame, and it fades out as the light leaves the shot.</p></section><div class="button-row">${busyPreview ? btn("stop-preview", "Stop preview", "x") : btn("preview-move", "Preview", "play")}${btn("close-timeline", "Done", "check", "primary")}</div>`;
    refreshIcons();
  }
  // The batch list. A clip is queued with a copy of the settings it was queued
  // with — including a snapshot of the timeline where the move is Custom —
  // because the point of a batch is to compose four different shots and then
  // walk away, and settings that followed the panel would render the last one
  // four times.
  function batchLabel(job) {
    const move = job.move === CUSTOM_MOVE ? "Custom timeline" : resolveMove(job.move).label;
    return `${move} · ${job.seconds}s · ${job.fps} fps · ${SIZES[job.size]?.label.split(" · ")[0] || job.size}`;
  }
  function batchSection() {
    if (!videoSupported()) return "";
    const rows = videoBatch
      .map((job, i) => {
        const state = busyVideo && videoBatchAt === i ? "Rendering…" : videoBatchAt > i ? "Done" : "Queued";
        return `<div class="batch-row" data-job="${job.id}"><div class="key-head"><strong>${i + 1}. ${e(batchLabel(job))}</strong><span class="muted">${state}</span></div><div class="button-row">${btn("batch-use", "Load these settings", "rotate-ccw")}${busyVideo ? "" : btn("batch-remove", "Remove", "trash-2")}</div></div>`;
      })
      .join("");
    return `<section><h3>Batch <span>${videoBatch.length} ${videoBatch.length === 1 ? "clip" : "clips"}</span></h3><p class="muted">Queue several clips and render them in one go. Each one keeps the settings it was queued with, including its own timeline, so you can compose a shot, add it, recompose and add another. They render in order and download as they finish.</p><div class="button-row">${btn("batch-add", "Add current settings", "plus")}${videoBatch.length && !busyVideo ? btn("batch-clear", "Clear list", "trash-2") : ""}</div>${rows}${videoBatch.length ? (busyVideo ? btn("cancel-video", "Cancel", "x", "wide") : btn("batch-export", `Export all ${videoBatch.length}`, "download", "primary wide")) : ""}${videoBatch.length ? `<p class="muted">A batch renders every frame of every clip, so it takes as long as the clips add up to — several minutes for four 1080p moves. The camera comes back where you left it.</p>` : ""}</section>`;
  }

  // The panel's settings as a renderable clip. A Custom move carries a frozen
  // copy of the timeline rather than a reference to it, so a queued clip is not
  // quietly rewritten by the next keyframe someone adds.
  function currentClip() {
    const custom = videoMove === CUSTOM_MOVE;
    const tl = custom ? structuredClone(timeline()) : null;
    return {
      move: videoMove,
      timeline: tl,
      seconds: custom ? tl.seconds : videoSeconds,
      fps: videoFps,
      size: videoSize,
    };
  }
  // Renders one clip or a whole batch, in order, downloading each as it lands.
  // A batch is not a different code path: it is this loop with more than one
  // entry, which is what keeps a single export and a batch honest with each
  // other.
  async function runClips(jobs) {
    busy = busyVideo = true;
    videoAbort = new AbortController();
    videoBatchAt = jobs === videoBatch ? 0 : -1;
    renderInspector();
    // The progress element is written to directly rather than through
    // renderInspector: redrawing the whole panel a few hundred times would
    // itself slow the render it is reporting on.
    const status = (note) => {
      const bar = document.querySelector(".video-progress progress");
      const label = document.querySelector(".video-progress span");
      if (bar) bar.value = videoProgress;
      if (label)
        label.textContent = `${note}${Math.round(videoProgress * 100)}% · frame ${videoFrame} of ${videoFrames}`;
    };
    let done = 0;
    let vp9 = false;
    try {
      for (const [index, job] of jobs.entries()) {
        videoBatchAt = jobs === videoBatch ? index : -1;
        videoProgress = 0;
        videoFrame = 0;
        videoFrames = frameTimes(job.seconds, job.fps).count;
        const note = jobs.length > 1 ? `Clip ${index + 1} of ${jobs.length} · ` : "";
        status(note);
        const recorded = await scene.recordVideo({
          // A timeline where the move is Custom, one of the fixed moves
          // otherwise. Everything downstream — the recorder, the encoder, the
          // muxer — sees the same (t) -> pose contract either way.
          move: job.move === CUSTOM_MOVE ? normalizeTimeline(job.timeline) : job.move,
          seconds: job.seconds,
          fps: job.fps,
          size: job.size,
          signal: videoAbort.signal,
          onProgress: (fraction) => {
            videoProgress = fraction;
            videoFrame = Math.round(fraction * videoFrames);
            status(note);
          },
        });
        const suffix = jobs.length > 1 ? `-${index + 1}` : "";
        download(recorded.blob, `${safeName()}-${job.move}${suffix}.mp4`);
        vp9 = vp9 || recorded.kind === "vp09";
        done += 1;
      }
      // Which codec landed decides what can open the file, so it is said out
      // loud. VP9 is the fallback for a browser with no H.264 encoder, and
      // QuickTime Player cannot open VP9 — someone handed that file without
      // being told just sees their player refuse their own export.
      if (vp9)
        toast(
          "Exported as VP9, because this browser cannot encode H.264. It plays in Chrome, Edge and VLC, but not in QuickTime Player — use Chrome or Safari for a QuickTime-ready file.",
          true,
        );
      else if (done > 1) toast(`${done} clips exported.`);
      else toast(`${jobs[0].seconds}s MP4 exported · ${videoFrames} frames at ${jobs[0].fps} fps.`);
    } catch (err) {
      // A cancelled batch keeps the clips it already wrote: they are on disk
      // and saying otherwise would be a lie.
      if (err?.name === "AbortError")
        toast(done ? `Cancelled after ${done} ${done === 1 ? "clip" : "clips"}.` : "Recording cancelled.");
      else toast(err.message, true);
    } finally {
      busy = busyVideo = false;
      videoAbort = null;
      videoProgress = 0;
      videoBatchAt = -1;
      renderInspector();
    }
  }

  // Says what will come out, in the terms that matter: whether QuickTime
  // Player will open it. Nothing is claimed until the probe has answered.
  function videoCodecLine() {
    if (!videoCodec) return `<p class="muted">Checking what this browser can encode…</p>`;
    if (videoCodec.kind === "vp09")
      return `<p class="warn-note">This browser has no H.264 encoder, so the clip will be <strong>VP9 in an MP4</strong>. It plays in Chrome, Edge and VLC, but <strong>QuickTime Player cannot open it</strong>. Record in Chrome or Safari for a QuickTime-ready file.</p>`;
    return `<p class="muted">This browser will encode <strong>${e(videoCodec.label)}</strong> — the codec QuickTime Player, phones and upload forms expect.</p>`;
  }
  function renderInspector() {
    const root = document.querySelector("#inspector-content"),
      a = p.art.find((a) => a.id === selected),
      l = p.photo.layers.find((l) => l.id === photoSelected);
    document
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    let html = "";
    if (tab === "art" && p.mode === "photo") {
      html = `<div class="panel-heading"><h2>Photo artwork</h2>${btn("upload-art", "Upload artwork", "plus", "icon-only")}</div><p class="muted">Select a library work to add it to this photo. Drag its corners to match the wall. Placement is visual, not measured.</p><div class="mobile-library">${libraryHTML(true)}</div>${l ? `<section><h3>${e(l.title)}</h3>${range("Cast-shadow overlay", "shadow", l.shadow, 0, 60, 1, "photoLayer")}<p class="muted">Drag inside to move. Blue corner handles control perspective.</p>${l.corners.map((c, i) => `<h4>${["Top left", "Top right", "Bottom right", "Bottom left"][i]}</h4><div class="field-pair">${field("X %", i + "-0", c[0] * 100, 0, 100, 0.1, "%", "corner")}${field("Y %", i + "-1", c[1] * 100, 0, 100, 0.1, "%", "corner")}</div>`).join("")}<div class="button-row">${btn("photo-front", "Bring to front", "layers")}${btn("photo-delete", "Remove", "trash-2")}</div></section>` : '<div class="empty-inspector"><p>Choose an uploaded work from your library, or upload a new one.</p></div>'}<section><h3>Photo layers</h3>${p.photo.layers.map((x) => `<button class="wide layer-row ${x.id === photoSelected ? "active" : ""}" data-layer="${x.id}">${e(x.title)}</button>`).join("")}</section>`;
    } else if (tab === "art") {
      html = `<div class="mobile-library">${libraryHTML(true)}</div>${a ? `<div class="panel-heading"><h2>Artwork properties</h2><span class="badge">${a.kind === "sign" ? "Sign" : a.kind === "label" ? "Label" : a.asset ? "Original" : "Sample"}</span></div><div class="selected-art"><div class="thumb">${artThumb(a)}</div><div><input class="title-input" data-field="title" data-scope="art" aria-label="Artwork title" maxlength="120" value="${e(a.title)}"/><span>${a.kind === "sign" || a.kind === "label" ? "Editable wall asset" : a.asset ? "Original image preserved" : "Measured placeholder panel"}</span>${a.kind === "sign" || a.kind === "label" ? "" : btn("replace-art", a.asset ? "Replace image" : "Add original image", "image-plus", "text-button")}</div></div>${signFields(a)}${a.asset ? `<section><h3>Image adjustments</h3><p class="muted">Edits affect this placement only. The uploaded original stays unchanged.</p>${btn("edit-image", "Edit image", "image", "primary wide")}<div class="button-row">${btn("copy-edits", "Copy edits", "copy")}${btn("paste-edits", "Paste edits", "layers", p.editClipboard ? "" : "disabled")}</div></section>` : ""}<section><h3>Dimensions <span>inches</span></h3><p class="muted">Double-tap artwork to adjust. Corners scale proportionally; middle edge handles stretch width or height.</p>${scaleControl(a)}<label class="setting-label"><input type="checkbox" data-field="stretch" data-scope="art" ${a.stretch ? "checked" : ""}/> Stretch image to panel dimensions</label>${field("Width", "w", a.w, 1, 360)}${field("Height", "h", a.h, 1, 360)}${!a.stretch && mismatch(p, a) ? `<div class="warning">Image proportions differ from the panel. The full image is fitted inside without stretching.${btn("match-ratio", "Match height to image", null, "wide")}</div>` : ""}${field("Thickness", "thickness", a.thickness, 0.1, 12, 0.1)}<label class="setting-label">Edge material<select data-field="edgeTexture" data-scope="art" aria-label="Edge material">${["plain","concrete","wood","metal"].map(k=>`<option value="${k}" ${(a.edgeTexture || "plain") === k ? "selected" : ""}>${k === "wood" ? "Wood grain" : k[0].toUpperCase()+k.slice(1)}</option>`).join("")}</select></label><label class="setting-label">Edge color<input type="color" data-field="edgeColor" data-scope="art" aria-label="Edge color" value="${a.edgeColor || "#b7a68b"}"/></label>${field("Wall gap", "offset", a.offset, 0, 12, 0.1)}</section><section><h3>Placement</h3><div class="exterior-callout"><strong>Interior and exterior walls</strong><span>Artwork can hang on either face of the three booth walls and of any free-standing wall.</span></div><label class="select-field">Wall location<select data-field="location" data-scope="art" aria-label="Wall location">${locationOptions(a)}</select></label><div class="button-row">${btn("face-view", "View wall face", "camera")}</div>${field("Left edge", "x", a.x, -360, 360)}${field("Bottom edge", "y", a.y, -360, 360)}<p class="muted">From the bottom-left corner, facing the ${a.face === "outside" ? "outside" : "inside"} of this wall.</p>${boundWarning(p, a) ? `<div class="warning">${boundWarning(p, a)}</div>` : ""}<div class="button-row">${btn("center", "Center", "align-center")}${btn("eye-level", "Center at 60″", "arrow-up-to-line")}</div></section><section><h3>Actions</h3><div class="button-row">${btn("duplicate-art", "Duplicate", "copy")}${btn("delete-art", "Remove", "trash-2", "danger")}</div></section>` : `<div class="empty-inspector"><h2>Make room for your work.</h2><p>Upload artwork and set its dimensions, then arrange it on the booth walls.</p>${btn("upload-art", "Upload artwork", "image-plus", "primary")}</div>`}`;
    }
    if (tab === "layout") {
      html = `<div class="panel-heading"><h2>${p.mode === "photo" ? "Booth photograph" : "Booth layout"}</h2>${icon("layout-panel-left")}</div>${p.mode === "photo" ? `<p class="muted">The original photo stays intact. Added art and light overlays are saved separately. Existing objects in the photograph cannot be moved or erased in this prototype.</p>${btn("upload-photo", p.photo.asset ? "Replace booth photo" : "Upload booth photo", "image-plus", "wide")}${range("Photo exposure", "exposure", p.photo.exposure, -1, 1, 0.05, "photo")}` : `<section><h3>Footprint</h3><select data-field="preset" aria-label="Booth preset"><option value="120" ${p.booth.width === 120 ? "selected" : ""}>10 × 10 ft · Standard</option><option value="240" ${p.booth.width === 240 ? "selected" : ""}>10 × 20 ft · Double</option></select><p class="muted">Nominal footprint. Panels and 1.4″ canopy legs reduce usable space near edges.</p>${isArtShow(p) ? `<div class="warning">This is an art-show booth. Its footprint, walls and light bar are in the <strong>Art show</strong> tool, and a preset or a canopy here would put it back to an outdoor pop-up.</div>` : ""}${field("Wall height", "height", p.booth.height, 48, 144, 1, "in", "booth")}<label class="check-field"><input type="checkbox" data-field="tent" data-scope="booth" ${p.booth.tent ? "checked" : ""}/>White canopy & frame</label><label class="setting-label">Tent style<select aria-label="Tent style" data-field="tentStyle" data-scope="booth">${Object.entries(TENTS).map(([k,v])=>`<option value="${k}" ${(p.booth.tentStyle||'classic')===k?'selected':''}>${v}</option>`).join('')}</select></label><p class="muted">12″ fabric valance, rounded hems, roof ribs and folding frame. Inspired shapes; not manufacturer-certified models.</p></section><section><h3>Surroundings</h3><label class="setting-label">Environment<select aria-label="Environment" data-field="envPreset" data-scope="booth">${Object.entries(ENV_PRESETS).map(([k,v])=>`<option value="${k}" ${(p.booth.envPreset||DEFAULT_PRESET)===k?'selected':''}>${v.label}</option>`).join('')}</select></label><p class="muted">Presets light the booth from a photographed environment. Without its image files a preset keeps the procedural surroundings below.</p><label class="setting-label">Artwork colour<select aria-label="Artwork colour" data-field="artFidelity" data-scope="booth">${Object.entries(ART_FIDELITY).map(([k,v])=>`<option value="${k}" ${(p.booth.artFidelity||DEFAULT_FIDELITY)===k?'selected':''}>${v}</option>`).join('')}</select></label>${groundFields()}<label class="setting-label">Horizon<select aria-label="Horizon" data-field="horizon" data-scope="booth">${Object.entries({studio:'Neutral studio',open:'Open sky',park:'Park · trees',urban:'Urban plaza'}).map(([k,v])=>`<option value="${k}" ${(p.booth.horizon||'studio')===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="check-field"><input type="checkbox" data-field="neighbors" data-scope="booth" ${p.booth.neighbors?'checked':''}/>Surround with other booths</label>${surroundingsFields()}</section>${peopleSection()}<section><h3>Display walls</h3><label class="color-field">Fabric finish<input type="color" data-field="color" data-scope="booth" value="${p.booth.color}"/></label><label class="setting-label">Panel surface<select aria-label="Panel surface" data-field="wallFinish" data-scope="booth">${Object.entries({smooth:"Smooth print",fabric:"Fabric pro-panel"}).map(([k,v])=>`<option value="${k}" ${(p.booth.wallFinish||"smooth")===k?"selected":""}>${v}</option>`).join("")}</select></label>${(p.booth.wallFinish||"smooth")==="fabric"?`${range("Weave depth","wallTexture",p.booth.wallTexture??60,0,100,1,"booth","%")}<p class="muted">The weave only. Panels keep the colour above, so artwork is still judged against the finish you chose. Without the carpet texture files the panels stay smooth.</p>`:""}<div class="swatches">${["#45474a", "#25282b", "#b1aea4", "#d8d4ca"].map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Wall finish ${c}"></button>`).join("")}</div>${["back", "left", "right"].map((w) => `<div class="wall-setting"><label class="check-field"><input type="checkbox" data-field="enabled" data-scope="wall-${w}" ${p.booth.walls[w].enabled ? "checked" : ""}/>${w[0].toUpperCase() + w.slice(1)} wall</label>${field("Width", "width", p.booth.walls[w].width, 12, w === "back" ? p.booth.width : p.booth.depth, 1, "in", "wall-" + w)}${field("Height", "height", p.booth.walls[w].height, 24, 144, 1, "in", "wall-" + w)}</div>`).join("")}</section><section><h3>Free-standing walls and pedestals</h3><p class="muted">Interior panels and pedestals live in the Walls tool, so this list stays the booth itself.</p>${btn("open-walls", "Open the Walls tool", "columns-2", "wide")}</section>`}<section><h3>Project</h3>${btn("copy-project", "Duplicate as alternative", "copy", "wide")}${btn("new-project", "New empty booth", "plus", "wide")}${btn("backup", "Download project backup", "save", "wide")}${btn("import", "Open project backup", "folder-open", "wide")}<p class="muted">Backups include all original images. Download before switching projects.</p></section>`;
    }
    if (tab === "show") {
      html = p.mode === "photo"
        ? `<div class="panel-heading"><h2>Art show booth</h2>${icon("building-2")}</div><div class="empty-inspector"><p>Switch to the 3D booth to plan an art-show booth. Photo mode composes a photograph, which has its own walls already.</p></div>`
        : artShowHTML();
    }
    if (tab === "walls") {
      html = p.mode === "photo"
        ? `<div class="panel-heading"><h2>Walls and pedestals</h2>${icon("columns-2")}</div><div class="empty-inspector"><p>Free-standing walls and pedestals are measured objects in the 3D booth. Switch to the 3D booth to place them.</p></div>`
        : `<div class="panel-heading"><h2>Walls and pedestals</h2>${icon("columns-2")}</div><p class="muted">Everything that stands on the booth floor: interior display walls you can hang art on, and pedestals you cannot. Both are placed in inches and both can be dragged.</p>${panelFields()}${pedestalFields()}`;
    }
    if (tab === "lighting") {
      const photoMode = p.mode === "photo",
        lights = photoMode ? p.photo.lights : p.lights,
        index = photoMode ? photoLightIndex : lightIndex,
        light = lights[index];
      html = `<div class="panel-heading"><h2>${photoMode ? "Photo lighting" : "Lighting studio"}</h2>${icon("lightbulb")}</div><p class="muted">${photoMode ? "Reversible light overlays. A single photo cannot recover geometry or physically relight the booth." : "Light your real geometry. Wall gaps and panel thickness shape the cast shadows."}</p><div class="button-row">${btn("daylight", "Daylight", "sun")}${btn("warm", "Warm", "lightbulb")}</div>${!photoMode ? `<section>${range("Ambient illumination", "ambient", p.ambient, 0, 4, 0.05)}<label class="setting-label">Spotlight fixtures<select aria-label="Spotlight fixtures" data-field="fixtures" data-scope="booth">${Object.entries(FIXTURE_MODES).map(([k, v]) => `<option value="${k}" ${(p.booth.fixtures || DEFAULT_FIXTURES) === k ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label><p class="muted">${showFixtures(p.booth.fixtures, p.booth.envPreset, p.booth.venue) ? "The housings are drawn where each spotlight sits." : `Housings are hidden${isIndoor(p.booth.envPreset, p.booth.venue) ? (p.booth.venue === "artshow" ? " because an art-show booth has its own light bar overhead" : " because this is an indoor environment, where the hall's own track lighting is already in the picture") : ""}. The rail above the booth stays, and the light itself is unchanged.`}</p></section>` : ""}<section><h3>${photoMode ? "Light overlays" : "Spotlights"} <span>${lights.length} / ${photoMode ? 8 : 4}</span></h3><div class="light-picker">${lights.map((l, i) => `<button data-light="${i}" class="${index === i ? "active" : ""}">${i + 1}</button>`).join("")}${lights.length < (photoMode ? 8 : 4) ? btn("add-light", "Add", "plus", "icon-only") : ""}</div>${light ? `${range("Brightness", "power", light.power, 0, photoMode ? 1 : 300, photoMode ? 0.05 : 5, photoMode ? "photoLight" : "light")}${range("Temperature", "kelvin", light.kelvin, 2700, 6500, 100, photoMode ? "photoLight" : "light", " K")}${photoMode ? `${range("Horizontal", "x", light.x, 0, 1, 0.01, "photoLight")}${range("Vertical", "y", light.y, 0, 1, 0.01, "photoLight")}${range("Radius", "radius", light.radius, 0.02, 0.8, 0.01, "photoLight")}` : `<h4>Light position · inches</h4>${field("Left / right", "x", light.x, -360, 360, 1, "in", "light")}${field("Height", "y", light.y, 0, 160, 1, "in", "light")}${field("Front / back", "z", light.z, -360, 360, 1, "in", "light")}<h4>Aim at · inches</h4>${field("Target X", "tx", light.tx, -360, 360, 1, "in", "light")}${field("Target height", "ty", light.ty, 0, 160, 1, "in", "light")}${field("Target Z", "tz", light.tz, -360, 360, 1, "in", "light")}<p class="muted">Origin: center of floor. +X right, +Z toward the entrance. Height starts at the floor.</p>`}${btn("delete-light", "Remove light", "trash-2", "wide")}` : ""}</section>`;
    }
    if (tab === "video") {
      html = p.mode === "photo"
        ? `<div class="panel-heading"><h2>Video</h2>${icon("video")}</div><div class="empty-inspector"><p>Video records a camera move through the 3D booth. Photo mode has a single photograph and no camera to move, so there is nothing to record. Switch to the 3D booth.</p></div>`
        : `<div class="panel-heading"><h2>Video</h2>${icon("video")}</div><p class="muted">Everything about moving pictures in one place: the move, the clip, the timeline and a batch list. The Export tab keeps the same controls beside the PNG and the guide, and they are the same settings — this is not a second set.</p>${videoSection()}${batchSection()}<section><h3>Stills</h3><p class="muted">The frame you are looking at, as a PNG, without controls or outlines. The full image options are in Export.</p>${btn("export-image", "Export PNG · 4096 px", "download", "wide")}</section>`;
    }
    if (tab === "export") {
      html = `<div class="panel-heading"><h2>Export your booth</h2>${icon("download")}</div><p class="muted">A clean image of the current ${p.mode === "photo" ? "photo composition" : "camera view"}, without controls or selection outlines.</p><section><h3>Image size</h3><select id="export-size" aria-label="Export image width"><option value="2048">2048 px wide · Fast</option><option value="4096" selected>4096 px wide · High resolution</option></select><p class="muted">PNG · Current aspect ratio${p.mode === "photo" ? ". Enlarging a small source cannot restore missing detail." : ". Preview textures are capped at 2048 px per artwork; originals remain in the backup."}</p>${btn("export-image", "Export PNG", "download", "primary wide")}</section>${p.mode === "photo" ? "" : videoSection()}<section><h3>Installation guide</h3><p class="muted">Measured wall elevations, panel sizes, and left/bottom placement references. Open the downloaded HTML to print or save as PDF. Photo overlays are excluded.</p>${btn("guide", "Download hanging guide", "layout-panel-left", "wide")}</section><section><h3>Keep your work</h3>${btn("backup", "Download project backup", "save", "wide")}${btn("import", "Open project backup", "folder-open", "wide")}<p class="muted">Includes original artwork and photo files, booth layout, and lighting.</p></section><section><h3>Preview quality</h3><select id="quality" aria-label="Preview quality"><option value="1" ${quality === 1 ? "selected" : ""}>Efficient · Older devices</option><option value="2" ${quality === 2 ? "selected" : ""}>Balanced</option><option value="3" ${quality === 3 ? "selected" : ""}>High detail</option></select></section>`;
    }
    root.innerHTML = html;
    refreshIcons();
  }
  function render() {
    document.querySelector("#project-name").value = p.name;
    document.querySelector("#scene").hidden = p.mode !== "3d";
    document.querySelector("#photo").hidden = p.mode !== "photo";
    document.querySelector("#photo-empty").hidden =
      p.mode !== "photo" || !!p.photo.asset;
    document.querySelector("#view-switch").hidden = p.mode === "photo";
    document.querySelector(".zoom-controls").hidden = p.mode === "photo";
    document.querySelector("#mode-label").textContent =
      p.mode === "photo" ? "PHOTO COMPOSITION" : "MEASURED WORKSPACE";
    document.querySelector("#scene-title").textContent =
      p.mode === "photo"
        ? "Your booth, reimagined"
        : `${p.booth.width / 12} × ${p.booth.depth / 12} ft / ${p.booth.tent ? "Canopy" : "Open booth"}`;
    document.querySelector("#scene-subtitle").textContent =
      p.mode === "photo"
        ? "Original photo + editable overlays"
        : `${p.art.length} panels · ${p.lights.length} spotlights`;
    document.querySelector("#gesture-hint").textContent =
      p.mode === "photo"
        ? "Drag artwork to move · drag corners for perspective"
        : scene?.move
          ? scene.snap
            ? "Drag artwork along its wall · snap in 1-inch increments"
            : "Drag artwork along its wall · snapping off"
          : "Drag to orbit · scroll or +/− to zoom · right-drag to pan";
    const selectedArt = p.art.find((a) => a.id === selected);
    document.querySelector("#selection-status").textContent =
      p.mode === "3d"
        ? selectedArt
          ? selectedArt.title + (scene?.scaleId === selected ? " · Drag to move · blue corners scale" : " · Double-tap to adjust")
          : "No selection"
        : "";
    document
      .querySelector('[data-action="mode-3d"]')
      .classList.toggle("active", p.mode === "3d");
    document
      .querySelector('[data-action="mode-photo"]')
      .classList.toggle("active", p.mode === "photo");
    document.querySelector('[data-action="undo"]').disabled = !history.length;
    document.querySelector('[data-action="redo"]').disabled = !future.length;
    for (const name of ["move", "select", "snap"])
      document.querySelector(`[data-action="${name}"]`).disabled =
        p.mode === "photo" || !scene;
    renderLibrary();
    renderInspector();
    refreshScene();
    document.querySelector('[data-action="snap"]').classList.toggle("active", !!scene?.snap);
    scene?.resize();
  }
  function confirmAction(title, text, run) {
    const d = document.querySelector("#dialog");
    document.querySelector("#dialog-content").innerHTML =
      `<h2>${e(title)}</h2><p>${e(text)}</p><div class="button-row"><button id="confirm-cancel">Cancel</button><button class="primary" id="confirm-go">Continue</button></div>`;
    document.querySelector("#confirm-cancel").onclick = () => d.close();
    document.querySelector("#confirm-go").onclick = () => {
      d.close();
      run();
    };
    d.showModal();
  }
  function backup() {
    download(
      new Blob([JSON.stringify(p)], { type: "application/json" }),
      `${safeName()}.booth.json`,
    );
    toast("Project backup downloaded with original images.");
  }
  function safeName() {
    return (
      p.name.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "") ||
      "booth-studio"
    );
  }
  function addPhotoLayer(a) {
    if (!p.photo.asset) {
      toast("Upload a booth photo first.", true);
      return;
    }
    if (a.kind === "sign" || a.kind === "label") {
      toast("Signs and labels are currently available in measured 3D mode.", true); return;
    }
    if (!a.asset) {
      toast("Add an original image to this sample panel first.", true);
      return;
    }
    const asset = p.assets[a.asset],
      bg = p.assets[p.photo.asset],
      h = Math.min(
        0.6,
        (0.25 * bg.width) / bg.height / (asset.width / asset.height),
      );
    const l = {
      id: uid(),
      asset: a.asset,
      title: a.title,
      corners: [
        [0.35, 0.25],
        [0.6, 0.25],
        [0.6, 0.25 + h],
        [0.35, 0.25 + h],
      ],
      shadow: 18,
    };
    mutate(() => {
      p.photo.layers.push(l);
      photoSelected = l.id;
      tab = "art";
    });
  }
  function addWallAsset(kind) {
    if (p.art.length >= 200) { toast("This prototype supports up to 200 panels.", true); return; }
    const source = p.art.find(a=>a.id===selected);
    const a = {id:uid(), asset:null, kind,
      title:kind==="sign"?"Artist sign":source?.title || "Artwork title",
      artistName:"", city:"", medium:source?.medium || "", price:"",
      wall:source?.wall || "back", face:source?.face || "inside",
      w:kind==="sign"?30:4, h:kind==="sign"?12:2.5,
      x:source ? source.x : 12, y:kind==="sign"?78:source ? Math.max(0,source.y-4) : 48,
      thickness:.1, offset:.2};
    mutate(()=>{p.art.push(constrain(p,a));selected=a.id;tab="art";});
  }
  let scaleBase = null, scaleGesture = false;
  // One undo step per slider gesture, not one per pixel.
  let panelGesture = false;
  let pedestalGesture = false;
  function scaleControl(a) {
    scaleBase = { ...a };
    scaleGesture = false;
    return '<label class="range"><span>Scale <output>100%</output></span><input type="range" id="art-scale" aria-label="Artwork scale" min="1" max="200" step="1" value="100"/></label><p class="muted">Arrow keys adjust by 1%. 100% is the size when these controls opened.</p>';
  }
  function scaleSelected(factor) {
    const index=p.art.findIndex(a=>a.id===selected);
    if(index<0)return;
    checkpoint();
    p.art[index]=scalePanel(p,p.art[index],factor);
    scene?.updateArtwork(p.art[index]);
    renderInspector();
    scheduleSave();
  }
  let editPreviewRevision = 0;
  const editPreviewSources = new WeakMap();
  function currentArtwork() {
    return p.art.find((item) => item.id === selected);
  }
  function drawImageEditorPreview(a) {
    const preview = document.querySelector("#image-edit-preview");
    const asset = p.assets[a.asset];
    if (!preview || !asset) return;
    const revision = ++editPreviewRevision;
    const paint = (source) => {
      if (revision !== editPreviewRevision || !document.querySelector("#image-editor").open) return;
      const edited = applyImageEdits(source, a.edits);
      const box = preview.getBoundingClientRect();
      const pixelRatio = Math.min(devicePixelRatio, 2);
      preview.width = Math.max(1, Math.round(box.width * pixelRatio));
      preview.height = Math.max(1, Math.round(box.height * pixelRatio));
      const ctx = preview.getContext("2d");
      ctx.fillStyle = "#11161b";
      ctx.fillRect(0, 0, preview.width, preview.height);
      const fit = Math.min(preview.width / edited.width, preview.height / edited.height) * 0.92;
      const width = edited.width * fit, height = edited.height * fit;
      ctx.drawImage(edited, (preview.width - width) / 2, (preview.height - height) / 2, width, height);
    };
    const cached = editPreviewSources.get(asset);
    if (cached) { paint(cached); return; }
    const image = new Image();
    image.onerror = () => {
      if (revision === editPreviewRevision) toast("Could not load the editor preview. Your original is still saved.", true);
    };
    image.onload = () => {
      const scale = Math.min(1, 720 / Math.max(image.width, image.height));
      const source = document.createElement("canvas");
      source.width = Math.max(1, Math.round(image.width * scale));
      source.height = Math.max(1, Math.round(image.height * scale));
      source.getContext("2d").drawImage(image, 0, 0, source.width, source.height);
      editPreviewSources.set(asset, source);
      paint(source);
    };
    image.src = asset.data;
  }
  function editRange(label, key, value, min, max, step, unit = "") {
    return `<label class="range"><span>${label}<output>${Number(value.toFixed(2))}${unit}</output></span><input type="range" data-edit="${key}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${value}"/></label>`;
  }
  function renderImageEditor() {
    const a = currentArtwork();
    const dialog = document.querySelector("#image-editor");
    if (!a?.asset) {
      dialog.close();
      return;
    }
    a.edits = normalizeImageEdits(a.edits);
    const edits = a.edits;
    document.querySelector("#image-editor-content").innerHTML = `
      <div class="image-editor-heading"><div><span class="eyebrow">NON-DESTRUCTIVE</span><h2>Edit ${e(a.title)}</h2></div><button data-action="editor-cancel" class="icon-only" aria-label="Cancel image edits">${icon("x")}<span>Cancel</span></button></div>
      <div class="image-editor-grid">
        <div class="image-preview-wrap"><canvas id="image-edit-preview" aria-label="Edited image preview"></canvas><p>The uploaded original is preserved. These adjustments apply only to this wall placement.</p></div>
        <div class="image-adjustments">
          <section><h3>Orientation</h3><div class="button-row"><button data-action="rotate-left" aria-label="Rotate 90° counterclockwise">↶ 90°</button><button data-action="rotate-right" aria-label="Rotate 90° clockwise">↷ 90°</button></div><div class="button-row"><button data-action="flip-horizontal" class="${edits.flipX ? "active" : ""}">Flip horizontal</button><button data-action="flip-vertical" class="${edits.flipY ? "active" : ""}">Flip vertical</button></div></section>
          <section><h3>Light and color</h3>
            ${editRange("Exposure","exposure",edits.exposure,-2,2,.05," EV")}
            ${editRange("Contrast","contrast",edits.contrast,-100,100,1)}
            ${editRange("Saturation","saturation",edits.saturation,-100,100,1)}
            ${editRange("Temperature","temperature",edits.temperature,-100,100,1)}
            ${editRange("Tint","tint",edits.tint,-100,100,1)}
          </section>
          <button data-action="reset-image-edits" class="wide">Reset adjustments</button>
        </div>
      </div>
      <div class="image-editor-footer"><button data-action="editor-cancel">Cancel</button><button data-action="editor-save" class="primary">Save edits</button></div>`;
    refreshIcons();
    requestAnimationFrame(() => drawImageEditorPreview(a));
  }
  function scheduleEditedPreview() {
    const a = currentArtwork();
    if (!a) return;
    cancelAnimationFrame(scheduleEditedPreview.frame);
    scheduleEditedPreview.frame = requestAnimationFrame(() => drawImageEditorPreview(a));
  }
  function updateEditorEdits(run) {
    const a = currentArtwork();
    if (!editingStart || !a?.asset) return;
    a.edits = normalizeImageEdits(a.edits);
    run(a.edits);
    renderImageEditor();
  }
  const actions = {
    "edit-image": () => {
      const a = currentArtwork();
      if (!a?.asset) return;
      editingStart = JSON.stringify(p);
      a.edits = normalizeImageEdits(a.edits);
      renderImageEditor();
      document.querySelector("#image-editor").showModal();
      requestAnimationFrame(() => drawImageEditorPreview(a));
    },
    "editor-save": () => {
      if (!editingStart) return;
      history.push(editingStart);
      if (history.length > 35) history.shift();
      future = [];
      editingStart = null;
      document.querySelector("#image-editor").close();
      render();
      scheduleSave();
      toast("Image edits saved to this placement.");
    },
    "editor-cancel": () => {
      if (!editingStart) return;
      p = JSON.parse(editingStart);
      editingStart = null;
      clearTimeout(scheduleEditedPreview.timer);
      document.querySelector("#image-editor").close();
      render();
      toast("Image edits canceled.");
    },
    "rotate-left": () => updateEditorEdits((edits) => (edits.rotation = (edits.rotation + 270) % 360)),
    "rotate-right": () => updateEditorEdits((edits) => (edits.rotation = (edits.rotation + 90) % 360)),
    "flip-horizontal": () => updateEditorEdits((edits) => (edits.flipX = !edits.flipX)),
    "flip-vertical": () => updateEditorEdits((edits) => (edits.flipY = !edits.flipY)),
    "reset-image-edits": () => updateEditorEdits((edits) => Object.assign(edits, DEFAULT_IMAGE_EDITS)),
    "copy-edits": () => {
      const a = currentArtwork();
      if (!a?.asset) return;
      p.editClipboard = normalizeImageEdits(a.edits);
      scheduleSave();
      renderInspector();
      toast("Image adjustments copied.");
    },
    "paste-edits": () => {
      const a = currentArtwork();
      if (!a?.asset || !p.editClipboard) {
        toast("Copy adjustments from another image first.", true);
        return;
      }
      mutate(() => (a.edits = structuredClone(p.editClipboard)));
      toast("Image adjustments pasted.");
    },
    "add-sign": () => addWallAsset("sign"),
    "add-label": () => addWallAsset("label"),
    "scale-smaller": () => scaleSelected(.9),
    "scale-larger": () => scaleSelected(1.1),
    "face-view": () => {
      const a=p.art.find(a=>a.id===selected); if(!a)return;
      scene?.focusWall(a.wall,a.face);
      document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",a.face!=="outside"&&b.dataset.view===a.wall));
    },
    "upload-surround": () => document.querySelector("#surround-input").click(),
    "upload-ground": () => document.querySelector("#ground-input").click(),
    "clear-surround": () => mutate(()=>{p.booth.surroundAsset=null;}),
    // Removing an upload deletes that library entry; the floor falls back to
    // the last preset rather than leaving an empty slot behind.
    "remove-ground-upload": () => {
      const id = groundUpload(p);
      if (id) mutate(()=>removeGroundUpload(p, id));
    },
    // Zoom in steps of 5 points. Lower framing is a wider lens, so "zoom out"
    // subtracts; the clamp matches the slider and the schema.
    "backdrop-out": () => mutate(()=>{p.booth.backdropFraming=Math.max(25,(p.booth.backdropFraming ?? BACKDROP_FRAMING)-5);}),
    "backdrop-in": () => mutate(()=>{p.booth.backdropFraming=Math.min(100,(p.booth.backdropFraming ?? BACKDROP_FRAMING)+5);}),
    "backdrop-reset": () => mutate(()=>{p.booth.backdropFraming=BACKDROP_FRAMING;p.booth.surroundRotation=0;p.booth.backdropTilt=0;}),
    "clear-samples": () =>
      mutate(() => {
        p.art = p.art.filter((a) => a.asset || a.kind);
        selected = p.art[0]?.id;
      }),
    "upload-art": () => document.querySelector("#art-input").click(),
    "replace-art": () => document.querySelector("#replace-input").click(),
    "upload-photo": () => document.querySelector("#photo-input").click(),
    import: () => document.querySelector("#backup-input").click(),
    backup,
    select: () => {
      scene.move = false;
      document.querySelector('[data-action="select"]').classList.add("active");
      document.querySelector('[data-action="move"]').classList.remove("active");
      render();
    },
    move: () => {
      scene.move = true;
      document.querySelector('[data-action="move"]').classList.add("active");
      document
        .querySelector('[data-action="select"]')
        .classList.remove("active");
      render();
    },
    snap: () => {
      scene.snap = !scene.snap;
      document
        .querySelector('[data-action="snap"]')
        .classList.toggle("active", scene.snap);
      render();
    },
    undo: () => {
      if (!history.length) return;
      future.push(JSON.stringify(p));
      p = JSON.parse(history.pop());
      render();
      scheduleSave();
    },
    redo: () => {
      if (!future.length) return;
      history.push(JSON.stringify(p));
      p = JSON.parse(future.pop());
      render();
      scheduleSave();
    },
    "mode-3d": () => mutate(() => (p.mode = "3d")),
    "mode-photo": () =>
      mutate(() => {
        p.mode = "photo";
        tab = p.photo.asset ? "art" : "layout";
      }),
    "export-tab": () => {
      tab = "export";
      renderInspector();
    },
    "zoom-in": () => p.mode === "3d" && scene?.zoom(1.2),
    "zoom-out": () => p.mode === "3d" && scene?.zoom(1/1.2),
    "reset-view": () => {
      scene?.setView("perspective");
      document
        .querySelectorAll("[data-view]")
        .forEach((b) =>
          b.classList.toggle("active", b.dataset.view === "perspective"),
        );
    },
    "duplicate-art": () =>
      mutate(() => {
        const a = p.art.find((a) => a.id === selected);
        if (!a) return;
        if (p.art.length >= 200) { toast("This prototype supports up to 200 panels.", true); return; }
        const copy = { ...a, id: uid(), title: (a.title + " copy").slice(0,200), x: a.x + 6, edits: a.edits ? structuredClone(a.edits) : undefined };
        p.art.push(copy);
        selected = copy.id;
      }),
    "delete-art": () =>
      mutate(() => {
        p.art = p.art.filter((a) => a.id !== selected);
        selected = p.art[0]?.id;
      }),
    center: () =>
      mutate(() => {
        const a = p.art.find((a) => a.id === selected);
        a.x = ((wallSpec(p, a.wall)?.width ?? a.w) - a.w) / 2;
      }),
    "eye-level": () =>
      mutate(() => {
        const a = p.art.find((a) => a.id === selected);
        a.y = 60 - a.h / 2;
      }),
    "match-ratio": () =>
      mutate(() => {
        const a = p.art.find((a) => a.id === selected),
          s = p.assets[a.asset];
        a.h = +((a.w * s.height) / s.width).toFixed(3);
      }),
    "new-project": () =>
      confirmAction(
        "Start an empty booth?",
        "A backup of your current project will download before it is replaced.",
        () => {
          backup();
          mutate(() => {
            p = blankProject();
            selected = null;
            tab = "layout";
          });
          scene?.setView("perspective");
        },
      ),
    "copy-project": () => {
      backup();
      mutate(() => {
        p.id = uid();
        p.name = p.name.replace(/ · Alternative$/, "") + " · Alternative";
      });
      toast(
        "Alternative created. The previous layout was downloaded as a backup.",
      );
    },
    daylight: () =>
      mutate(() => {
        p.ambient = 1.6;
        for (const l of p.mode === "photo" ? p.photo.lights : p.lights) {
          l.kelvin = 5500;
          l.power = p.mode === "photo" ? 0.4 : 70;
        }
      }),
    warm: () =>
      mutate(() => {
        p.ambient = 0.7;
        for (const l of p.mode === "photo" ? p.photo.lights : p.lights) {
          l.kelvin = 3000;
          l.power = p.mode === "photo" ? 0.55 : 100;
        }
      }),
    "add-light": () =>
      mutate(() => {
        if (p.mode === "photo" && p.photo.lights.length < 8) {
          p.photo.lights.push({
            id: uid(),
            x: 0.5,
            y: 0.3,
            radius: 0.3,
            power: 0.5,
            kelvin: 4000,
          });
          photoLightIndex = p.photo.lights.length - 1;
        } else if (p.mode === "3d" && p.lights.length < 4) {
          p.lights.push({
            id: uid(),
            x: 0,
            y: 91,
            z: 24,
            tx: 0,
            ty: 55,
            tz: -59,
            power: 80,
            kelvin: 4000,
          });
          lightIndex = p.lights.length - 1;
        }
      }),
    "delete-light": () =>
      mutate(() => {
        if (p.mode === "photo") {
          p.photo.lights.splice(photoLightIndex, 1);
          photoLightIndex = 0;
        } else {
          p.lights.splice(lightIndex, 1);
          lightIndex = 0;
        }
      }),
    "photo-delete": () =>
      mutate(() => {
        p.photo.layers = p.photo.layers.filter((l) => l.id !== photoSelected);
        photoSelected = null;
      }),
    "photo-front": () =>
      mutate(() => {
        const l = p.photo.layers.find((l) => l.id === photoSelected);
        p.photo.layers = p.photo.layers.filter((l) => l.id !== photoSelected);
        p.photo.layers.push(l);
      }),
    guide: () => {
      download(
        new Blob([hangingGuide(p)], { type: "text/html" }),
        safeName() + "-hanging-guide.html",
      );
      toast("Hanging guide downloaded. Open it to print or save as PDF.");
    },
    "export-image": async () => {
      if (busy) return;
      busy = true;
      const b = document.querySelector('[data-action="export-image"]');
      b.disabled = true;
      b.textContent = "Rendering…";
      try {
        // The Video tab offers the same PNG without the size menu beside it,
        // so the menu is read when it is there and the high setting assumed
        // when it is not.
        const width = Number(document.querySelector("#export-size")?.value) || 4096,
          blob = await (p.mode === "photo"
            ? photo.export(width)
            : scene?.export(width));
        if (!blob)
          throw new Error(
            "3D is not available. Photo exports and guides still work.",
          );
        download(blob, safeName() + "-" + p.mode + ".png");
        toast(`${width} px PNG exported.`);
      } catch (err) {
        toast(err.message, true);
      } finally {
        busy = false;
        renderInspector();
      }
    },
    "export-video": async () => {
      if (busy || busyVideo) return;
      if (!scene) return toast("3D is not available, so there is no view to record.", true);
      // One clip is a batch of one. Everything below it — the progress
      // reporting, the codec warning, the camera coming back — is the same
      // work either way, so it is written once.
      await runClips([currentClip()]);
    },
    "batch-add": () => {
      if (!scene) return toast("3D is not available, so there is no view to record.", true);
      videoBatch = [...videoBatch, { id: uid(), ...currentClip() }];
      renderInspector();
      toast(`Queued ${batchLabel(videoBatch.at(-1))}.`);
    },
    "batch-remove": (button) => {
      if (busyVideo) return;
      const id = button?.closest("[data-job]")?.dataset.job;
      videoBatch = videoBatch.filter((job) => job.id !== id);
      renderInspector();
    },
    "batch-clear": () => {
      if (busyVideo) return;
      videoBatch = [];
      renderInspector();
    },
    // Puts a queued clip's settings back in the panel, which is how you check
    // what you queued — and how you edit a queued timeline: load it, change it,
    // remove the old row and add it again.
    "batch-use": (button) => {
      const job = videoBatch.find((x) => x.id === button?.closest("[data-job]")?.dataset.job);
      if (!job) return;
      videoMove = job.move;
      videoSeconds = job.seconds;
      videoFps = job.fps;
      videoSize = job.size;
      if (job.timeline) videoTimeline = normalizeTimeline(job.timeline);
      probeCodec();
      renderInspector();
      toast("Settings loaded into the panel.");
    },
    "batch-export": async () => {
      if (busy || busyVideo) return;
      if (!scene) return toast("3D is not available, so there is no view to record.", true);
      if (!videoBatch.length) return toast("The batch list is empty.", true);
      await runClips(videoBatch);
    },
    "add-woman": () => addPerson("woman"),
    "add-man": () => addPerson("man"),
    "delete-person": (button) => {
      const id = button?.closest("[data-person]")?.dataset.person;
      mutate(() => (p.booth.people = (p.booth.people || []).filter((x) => x.id !== id)));
    },
    "cancel-video": () => videoAbort?.abort(),
    "edit-timeline": () => {
      if (!scene) return toast("3D is not available, so there is no view to keyframe.", true);
      timeline();
      renderTimelineDialog();
      // show(), not showModal(). A modal would block the viewport, and the
      // viewport is where keyframes come from: the whole loop is compose a
      // shot, press Add, orbit, press Add again.
      const panel = document.querySelector("#timeline-dialog");
      if (!panel.open) panel.show();
    },
    "close-timeline": () => {
      document.querySelector("#timeline-dialog").close();
      renderInspector();
    },
    "timeline-add": () => {
      const tl = timeline();
      if (tl.keys.length >= MAX_KEYS) return toast(`${MAX_KEYS} keyframes is the limit.`, true);
      const [position, target] = currentPose();
      // A new key lands halfway between the last one and the end, which is
      // where someone building a move in order wants it — and never on top of
      // the end key, which would be a zero-length segment.
      const previous = tl.keys.at(-2).t;
      videoTimeline = normalizeTimeline({ ...tl, keys: [...tl.keys, { ...keyFrom(position, target), t: (previous + 1) / 2 }] });
      renderTimelineDialog();
      toast(`Keyframe ${videoTimeline.keys.length} captured from this view.`);
    },
    "timeline-go": (button) => {
      const key = timeline().keys.find((k) => k.id === button?.closest("[data-key]")?.dataset.key);
      if (key) scene?.applyPose(key);
    },
    "timeline-recapture": (button) => {
      const id = button?.closest("[data-key]")?.dataset.key;
      const [position, target] = currentPose();
      videoTimeline = normalizeTimeline({
        ...timeline(),
        keys: timeline().keys.map((k) => (k.id === id ? { ...k, position, target } : k)),
      });
      renderTimelineDialog();
      toast("Keyframe replaced with this view.");
    },
    "timeline-delete": (button) => {
      const id = button?.closest("[data-key]")?.dataset.key;
      const tl = timeline();
      if (tl.keys.length <= MIN_KEYS) return toast("A move needs a start and an end.", true);
      videoTimeline = normalizeTimeline({ ...tl, keys: tl.keys.filter((k) => k.id !== id) });
      renderTimelineDialog();
    },
    "preview-move": async () => {
      if (busy || busyVideo || busyPreview) return;
      if (!scene) return toast("3D is not available, so there is no view to preview.", true);
      busyPreview = true;
      renderInspector();
      try {
        const custom = videoMove === CUSTOM_MOVE ? timeline() : null;
        const { cancelled } = await scene.previewMove({
          move: custom || videoMove,
          seconds: custom ? custom.seconds : videoSeconds,
        });
        if (!cancelled) toast("That is the move. Export MP4 renders it.");
      } catch (err) {
        toast(err.message, true);
      } finally {
        busyPreview = false;
        renderInspector();
      }
    },
    "stop-preview": () => scene?.stopPreview?.(),
    help: () => {
      const d = document.querySelector("#dialog");
      document.querySelector("#dialog-content").innerHTML =
        `<div class="panel-heading"><h2>Welcome to Booth Studio</h2>${btn("close-help", "Close", "x", "icon-only")}</div><p>Start with Layout, upload your original artwork, and enter its actual dimensions. Sample panels are dimension placeholders, not artwork.</p><ol><li><strong>Arrange:</strong> select a work in the library. Set its wall, left edge, and bottom edge. Use Move to drag along the wall, or Center to align.</li><li><strong>Art show booth:</strong> the Art show tool switches this booth to an indoor convention booth — seamless white walls, a light bar with directional heads spotting each wall, and a white exhibition hall around you. Booth size, wall sizes and the individual display panel are all typed in inches there.</li><li><strong>Free-standing walls and pedestals:</strong> add them in the Walls tool, then click a wall — or double-click a pedestal — in the booth to pick it up. Drag it across the floor, or use its left/right and front/back sliders. Snap keeps a drag on whole inches.</li><li><strong>Navigate:</strong> drag empty space to orbit, scroll to zoom, right-drag to pan. On touch, use one finger to orbit and two to pan/zoom. Wall and Plan views give precise views.</li><li><strong>Light:</strong> adjust ambient light and each spotlight’s position, target, power, and temperature.</li><li><strong>Photo:</strong> upload a booth shot, select uploaded library artwork to add it, then drag its four corners. Lighting is a visual overlay. Existing photo objects remain baked in.</li><li><strong>Keep:</strong> autosave is on this browser/device only. Download a full backup to transfer or archive a project.</li><li><strong>Export:</strong> PNG captures the current view; the hanging guide gives measured artwork edges.</li></ol><p class="muted">Ctrl/⌘ Z: undo · Ctrl/⌘ Shift Z: redo · Delete: remove selected artwork. No AI calls. Single images do not supply surface relief; baked-in lighting remains. Photorealism and exact display color are not guaranteed.</p>`;
      refreshIcons();
      d.showModal();
    },
    "close-help": () => document.querySelector("#dialog").close(),
    "add-panel": () =>
      mutate(() => {
        const panels = (p.booth.panels ||= []);
        if (panels.length >= MAX_PANELS) {
          toast(`This prototype supports up to ${MAX_PANELS} free-standing walls.`, true);
          return;
        }
        // A new panel stands across the middle of the booth, facing the
        // entrance like the back wall, so it is visible the moment it appears
        // rather than needing three numbers typed before anything shows.
        panels.push({
          id: uid(),
          name: "Panel " + (panels.length + 1),
          width: Math.min(p.booth.width, 72),
          height: p.booth.walls.back.height,
          x: 0,
          z: 0,
          rotation: 0,
        });
        // Selected on arrival: the next thing anyone does with a new wall is
        // move it, and a selected wall can be dragged straight away.
        selectedPanel = panelKey(panels[panels.length - 1].id);
        toast("Free-standing wall added at the centre of the booth. Drag it in the booth or use the sliders below.");
      }),
    "open-walls": () => {
      tab = "walls";
      renderInspector();
    },
    "add-pedestal": () =>
      mutate(() => {
        const list = (p.booth.pedestals ||= []);
        if (list.length >= MAX_PEDESTALS) {
          toast(`This prototype supports up to ${MAX_PEDESTALS} pedestals.`, true);
          return;
        }
        // Near the entrance on the right, where a card table usually stands,
        // rather than in the middle of the floor where it would be in the way
        // of the first thing anyone looks at.
        list.push({
          id: uid(),
          name: "Pedestal " + (list.length + 1),
          ...PEDESTAL,
          x: Math.round(p.booth.width / 2 - PEDESTAL.width),
          z: Math.round(p.booth.depth / 2 - PEDESTAL.depth * 2),
          rotation: 0,
        });
        selectedPedestal = list[list.length - 1].id;
        selectedPanel = null;
        toast("Pedestal added near the entrance. Double-click it in the booth to pick it up, or use the sliders.");
      }),
    "relink-walls": () =>
      mutate(() => {
        relinkArtShowWalls(p);
        const module = artShowPanel(p.booth);
        toast(
          `Walls rebuilt from ${Number(module.width.toFixed(2))}″ × ${module.height}″ panels: back ${p.booth.walls.back.width}″, sides ${p.booth.walls.left.width}″.`,
        );
      }),
  };
  // Removing a pedestal takes nothing with it: nothing hangs on one.
  function deletePedestal(id) {
    mutate(() => {
      p.booth.pedestals = boothPedestals(p).filter((ped) => ped.id !== id);
      if (selectedPedestal === id) selectedPedestal = null;
      toast("Pedestal removed.");
    });
  }
  // Removing a panel must decide what happens to art hanging on it. Moving
  // that art to the back wall keeps the placement; deleting it silently would
  // lose work the user never asked to throw away.
  function deletePanel(id) {
    mutate(() => {
      const key = panelKey(id);
      p.booth.panels = boothPanels(p).filter((panel) => panel.id !== id);
      if (selectedPanel === key) selectedPanel = null;
      const moved = p.art.filter((a) => a.wall === key);
      for (const a of moved) Object.assign(a, constrain(p, { ...a, wall: "back" }));
      if (selected && !p.art.some((a) => a.id === selected)) selected = p.art[0]?.id;
      toast(
        moved.length
          ? `Free-standing wall removed. ${moved.length} placement${moved.length > 1 ? "s" : ""} moved to the back wall.`
          : "Free-standing wall removed.",
      );
    });
  }
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.action) {
      try {
        const action = b.dataset.action;
        if (action.startsWith("delete-panel-")) deletePanel(action.slice(13));
        else if (action.startsWith("delete-pedestal-")) deletePedestal(action.slice(16));
        else actions[action]?.(b);
      } catch (err) {
        toast(err.message, true);
      }
    }
    if (b.dataset.tab) {
      tab = b.dataset.tab;
      renderInspector();
    }
    if (b.dataset.source) addCatalogPlacement(b.dataset.source);
    if (b.dataset.layer) {
      photoSelected = b.dataset.layer;
      renderInspector();
      photo.update(p, photoSelected);
    }
    if (b.dataset.view) {
      scene?.setView(b.dataset.view);
      document
        .querySelectorAll("[data-view]")
        .forEach((x) => x.classList.toggle("active", x === b));
    }
    if (b.dataset.color) mutate(() => (p.booth.color = b.dataset.color));
    if (b.dataset.light !== undefined) {
      if (p.mode === "photo") photoLightIndex = +b.dataset.light;
      else lightIndex = +b.dataset.light;
      renderInspector();
    }
  });

  function placeCopyAt(sourceKey, ev) {
    const template = templateFromSource(sourceKey);
    if (!template || !scene || p.mode !== "3d") return false;
    if (p.art.length >= 200) {
      toast("This prototype supports up to 200 wall placements.", true);
      return false;
    }
    const copy = placementFromTemplate(template);
    const placed = scene.wallDrop(ev, copy);
    if (!placed) {
      toast("Drop directly on an enabled interior or exterior booth wall.", true);
      return false;
    }
    mutate(() => {
      p.art.push(placed);
      selected = placed.id;
      tab = "art";
    });
    toast("New copy placed on " + wallLabel(p, placed.wall) + " · " + placed.face + ". Double-tap to adjust.");
    return true;
  }
  document.addEventListener("dragstart", (ev) => {
    const card = ev.target.closest("[data-source]");
    if (!card || p.mode !== "3d") return;
    ev.dataTransfer.setData("application/x-booth-original", card.dataset.source);
    ev.dataTransfer.effectAllowed = "copy";
  });
  const stage = document.querySelector("#scene");
  stage.addEventListener("dragover", (ev) => {
    if (p.mode === "3d" && [...ev.dataTransfer.types].includes("application/x-booth-original")) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "copy";
      stage.classList.add("drop-ready");
    }
  });
  stage.addEventListener("dragleave", () => stage.classList.remove("drop-ready"));
  document.addEventListener("dragend", () => stage.classList.remove("drop-ready"));
  stage.addEventListener("drop", (ev) => {
    const sourceKey = ev.dataTransfer.getData("application/x-booth-original");
    stage.classList.remove("drop-ready");
    if (!sourceKey) return;
    ev.preventDefault();
    placeCopyAt(sourceKey, ev);
  });

  for(const [input,key] of [["surround-input","surroundAsset"],["ground-input","groundAsset"]]){
    document.querySelector("#"+input).onchange=async ev=>{
      const file=ev.target.files[0];ev.target.value="";if(!file)return;
      try{
        if(Object.keys(p.assets).length>=250)throw new Error("This prototype supports up to 250 images.");
        const asset=await readImage(file);
        if(key==="surroundAsset" && Math.abs(asset.width/asset.height-2)>.1)
          throw new Error("Choose a 2:1 full-sphere panorama for this 360° background. Ordinary booth photos belong in Photo mode.");
        mutate(()=>{
          const id=uid();
          asset.role=key==="surroundAsset"?"surround":"ground";
          p.assets[id]=asset;
          // A ground upload joins the library and is selected; it does not
          // take a slot of its own that the preset picker has to fight.
          if(key==="groundAsset") selectGround(p, GROUND_UPLOAD+id); else p.booth[key]=id;
        });
        toast(key==="groundAsset"
          ? "Ground photograph added to your library and selected."
          : "Photographic material added. Original image is included in backups.");
      }catch(err){toast(err.message,true);}
    };
  }

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    // The slider's own input handler has already made the move and taken the
    // one checkpoint the gesture gets; this only closes it out. Falling
    // through to the generic field handler would checkpoint the finished
    // position, which is undo pointing at the wrong thing.
    if (
      el.type === "range" &&
      (el.dataset.scope || "").startsWith("panel-") &&
      ["x", "z"].includes(el.dataset.field)
    ) {
      panelGesture = false;
      refreshScene();
      scheduleSave();
      return;
    }
    if (
      el.type === "range" &&
      (el.dataset.scope || "").startsWith("pedestal-") &&
      ["x", "z"].includes(el.dataset.field)
    ) {
      pedestalGesture = false;
      refreshScene();
      scheduleSave();
      return;
    }
    if (el.id === "art-scale") {
      scaleGesture = false;
      scheduleSave();
      return;
    }
    if (el.id === "project-name") {
      mutate(() => (p.name = el.value.trim() || "Untitled booth"));
      return;
    }
    if (el.id === "quality") {
      quality = +el.value;
      scene?.renderer.setPixelRatio(renderScale(+el.value));
      scene?.resize();
      return;
    }
    // Video settings are view state, not project state: they are not saved
    // with the booth and do not belong in the undo history.
    if (el.id === "timeline-seconds") {
      videoTimeline = normalizeTimeline({ ...timeline(), seconds: +el.value });
      renderTimelineDialog();
      return;
    }
    if (el.id === "timeline-fade-in" || el.id === "timeline-fade-out") {
      const tl = timeline();
      const fade = { ...tl.fade, [el.id === "timeline-fade-in" ? "in" : "out"]: +el.value };
      videoTimeline = normalizeTimeline({ ...tl, fade });
      renderTimelineDialog();
      return;
    }
    if (el.id === "timeline-flare") {
      const tl = timeline();
      videoTimeline = normalizeTimeline({ ...tl, flare: { ...tl.flare, on: el.checked } });
      renderTimelineDialog();
      return;
    }
    if (el.id === "timeline-flare-source") {
      const tl = timeline();
      videoTimeline = normalizeTimeline({ ...tl, flare: { ...tl.flare, source: el.value } });
      renderTimelineDialog();
      return;
    }
    if (el.dataset.keyField) {
      const tl = timeline();
      const keys = tl.keys.map((k) => {
        if (k.id !== el.dataset.key) return k;
        // Times are entered in seconds — the unit on screen — and stored as a
        // fraction of the clip, so changing the clip length moves the keys with
        // it rather than stranding them past the end.
        if (el.dataset.keyField === "t") return { ...k, t: +el.value / Math.max(0.001, tl.seconds) };
        if (el.dataset.keyField === "hold") return { ...k, hold: +el.value };
        return { ...k, ease: el.value };
      });
      videoTimeline = normalizeTimeline({ ...tl, keys });
      renderTimelineDialog();
      return;
    }
    if (el.id === "video-move") {
      videoMove = el.value;
      // Each move has a length it was designed around, so choosing a move
      // proposes its own length rather than keeping the last one. A custom
      // timeline carries its own, set in the dialog.
      videoSeconds = videoMove === CUSTOM_MOVE ? timelineSeconds(timeline()) : resolveMove(videoMove).seconds;
      renderInspector();
      return;
    }
    if (el.id === "video-seconds") {
      videoSeconds = +el.value;
      return;
    }
    // Both of these change the H.264 level, so the codec is re-probed and the
    // panel re-rendered once the browser has answered.
    if (el.id === "video-fps") {
      videoFps = +el.value;
      probeCodec();
      return;
    }
    if (el.id === "video-size") {
      videoSize = el.value;
      probeCodec();
      return;
    }
    if (!el.dataset.field) return;
    const key = el.dataset.field,
      scope = el.dataset.scope;
    if (el.type === "number" && !el.checkValidity()) {
      toast("Enter a value within the displayed range.", true);
      renderInspector();
      return;
    }
    const value =
      el.type === "checkbox"
        ? el.checked
        : ["number", "range"].includes(el.type)
          ? Number(el.value)
          : el.value;
    mutate(() => {
      // Switching venue rewrites the footprint, the walls and the finish
      // together: half an art-show booth — 12ft walls under a canopy — is not
      // a booth anyone is planning.
      if (scope === "booth" && key === "venue") {
        applyVenue(p, String(value));
        selectedPanel = null;
        selectedPedestal = null;
        scene?.setView("perspective");
        toast(
          value === "artshow"
            ? "Art-show booth: 144″ back wall, 120″ sides, seamless white, nine-head light bar."
            : "Outdoor pop-up booth restored.",
        );
        return;
      }
      // The one place a floor is chosen, so the picker and the preset it
      // remembers cannot disagree.
      if (scope === "booth" && key === "ground") {
        selectGround(p, String(value));
        return;
      }
      if (key === "preset") {
        p.booth.width = +value;
        p.booth.depth = 120;
        p.booth.walls.back.width = +value;
        scene?.setView("perspective");
        return;
      }
      if (scope === "corner") {
        const layer = p.photo.layers.find((l) => l.id === photoSelected),
          q = structuredClone(layer.corners),
          [i, j] = key.split("-").map(Number);
        q[i][j] = value / 100;
        if (convex(q)) layer.corners = q;
        else toast("Keep corners in order without crossing edges.", true);
        return;
      }
      const a = p.art.find((a) => a.id === selected);
      if (scope === "art" && key === "location" && a) {
        const raw = String(value),
          cut = raw.lastIndexOf("-"),
          wall = raw.slice(0, cut),
          face = raw.slice(cut + 1);
        const currentFace = a.face || "inside";
        let x = a.x;
        if (currentFace !== face) x = (wallSpec(p, wall)?.width ?? a.x + a.w) - a.x - a.w;
        Object.assign(a, constrain(p, {...a, wall, face, x}));
        return;
      }
      const target =
        scope === "art"
          ? a
          : scope === "booth"
            ? p.booth
            : scope?.startsWith("wall-")
              ? p.booth.walls[scope.slice(5)]
              : scope?.startsWith("person-")
                ? (p.booth.people || []).find((x) => x.id === scope.slice(7))
            : scope?.startsWith("panel-")
              ? findPanel(p, panelKey(scope.slice(6)))
            : scope?.startsWith("pedestal-")
              ? findPedestal(p, scope.slice(9))
            : scope === "artShow"
              ? (p.booth.artShow = artShowPanel(p.booth))
            : scope === "lightBar"
              ? (p.booth.lightBar = lightBarSpec(p.booth))
            : scope === "hall"
              ? (p.booth.hall = hallSpec(p.booth))
              : scope === "light"
                ? p.lights[lightIndex]
                : scope === "photoLight"
                  ? p.photo.lights[photoLightIndex]
                  : scope === "photoLayer"
                    ? p.photo.layers.find((l) => l.id === photoSelected)
                    : scope === "photo"
                      ? p.photo
                      : p;
      if (target) target[key] = value;
      // A preset carries a matching floor and horizon; the user can still
      // override either afterwards, and that choice is not overwritten until
      // the preset itself changes again.
      if (scope === "booth" && key === "envPreset") {
        const preset = resolvePreset(value);
        // A chosen photograph is a stronger statement than a preset's default
        // floor, so it stays; the preset is remembered for when it is deleted.
        if (groundUpload(p)) p.booth.groundPreset = preset.ground;
        else selectGround(p, preset.ground);
        p.booth.horizon = preset.horizon;
      }
      if (scope === "booth" && key === "tentStyle") p.booth.tent = true;
      if (scope === "booth" && key === "height")
        Object.values(p.booth.walls).forEach((w) => (w.height = value));
      // A typed footprint is the art-show tool's "custom booth dimensions".
      // A wall may be narrower than the side it stands on, but never wider:
      // the schema says so and a wall poking out of the booth is not a plan.
      if (scope === "booth" && (key === "width" || key === "depth")) {
        for (const wall of key === "width" ? ["back"] : ["left", "right"])
          p.booth.walls[wall].width = Math.max(
            12,
            Math.min(p.booth.walls[wall].width, value),
          );
        p.art = p.art.map((a) => constrain(p, a));
        p.booth.panels = boothPanels(p).map((panel) => constrainPanel(p, panel));
        p.booth.pedestals = boothPedestals(p).map((ped) => constrainPedestal(p, ped));
      }
      // The panel module is what the walls are rebuilt from, and a linked
      // booth rebuilds as it is typed rather than waiting for the button.
      if (scope === "artShow" && p.booth.artShow.linked) relinkArtShowWalls(p);
    });
  });
  document.addEventListener("input", (ev) => {
    if (ev.target.id === "art-scale") {
      const a = currentArtwork();
      if (!a || scaleBase?.id !== a.id) return;
      if (!scaleGesture) { checkpoint(); scaleGesture = true; }
      const next = scalePanel(p, scaleBase, Number(ev.target.value) / 100);
      Object.assign(a, next);
      scene?.updateArtwork(a);
      ev.target.closest("label").querySelector("output").textContent = Math.round(a.w / scaleBase.w * 100) + "%";
      for (const key of ["w", "h", "x", "y"]) {
        const input = document.querySelector('[data-scope="art"][data-field="' + key + '"]');
        if (input) input.value = Number(a[key].toFixed(3));
      }
      return;
    }
    // A position slider for a free-standing wall. Handled live, and entirely
    // here: one checkpoint at the start of the gesture rather than one per
    // pixel, and the scene restands the panel without a rebuild — the same
    // deal the artwork scale slider gets, for the same reason.
    const panelScope = ev.target.dataset.scope || "";
    if (
      ev.target.type === "range" &&
      panelScope.startsWith("panel-") &&
      ["x", "z"].includes(ev.target.dataset.field)
    ) {
      const panel = findPanel(p, panelKey(panelScope.slice(6)));
      if (!panel) return;
      if (!panelGesture) { checkpoint(); panelGesture = true; }
      panel[ev.target.dataset.field] = Number(ev.target.value);
      scene?.movePanel({ ...panel });
      syncPanelInputs(panel, ev.target);
      ev.target
        .closest("label")
        ?.querySelector("output")
        ?.replaceChildren(Number(panel[ev.target.dataset.field].toFixed(2)) + "in");
      return;
    }
    const pedScope = ev.target.dataset.scope || "";
    if (
      ev.target.type === "range" &&
      pedScope.startsWith("pedestal-") &&
      ["x", "z"].includes(ev.target.dataset.field)
    ) {
      const ped = findPedestal(p, pedScope.slice(9));
      if (!ped) return;
      if (!pedestalGesture) { checkpoint(); pedestalGesture = true; }
      ped[ev.target.dataset.field] = Number(ev.target.value);
      scene?.movePedestal({ ...ped });
      syncPedestalInputs(ped, ev.target);
      ev.target
        .closest("label")
        ?.querySelector("output")
        ?.replaceChildren(Number(ped[ev.target.dataset.field].toFixed(2)) + "in");
      return;
    }
    if (ev.target.dataset.scope === "timeline" && ev.target.dataset.field === "flare-strength") {
      const tl = timeline();
      videoTimeline = { ...tl, flare: { ...tl.flare, strength: Number(ev.target.value) / 100 } };
      ev.target.closest("label")?.querySelector("output")?.replaceChildren(ev.target.value + "%");
      return;
    }
    if (ev.target.dataset.edit) {
      const a = currentArtwork();
      if (!editingStart || !a?.asset) return;
      a.edits = normalizeImageEdits(a.edits);
      a.edits[ev.target.dataset.edit] = Number(ev.target.value);
      ev.target.closest("label")?.querySelector("output")?.replaceChildren(ev.target.value);
      scheduleEditedPreview();
      return;
    }
    if (ev.target.id === "search") {
      search = ev.target.value;
      const pos = ev.target.selectionStart;
      renderLibrary();
      const s = document.querySelector("#search");
      s.focus();
      s.setSelectionRange(pos, pos);
      refreshIcons();
    }
    if (ev.target.type === "range")
      ev.target.closest("label").querySelector("output").textContent =
        ev.target.value;
  });
  async function upload(files, type) {
    if (!files.length) return;
    try {
      toast("Reading original images…");
      const assets = [];
      for (const file of files) assets.push(await readImage(file));
      if (Object.keys(p.assets).length + assets.length > 250) throw new Error("This prototype supports up to 250 images.");
      if (p.art.length + assets.length > 200)
        throw new Error("This prototype supports up to 200 panels.");
      mutate(() => {
        if (type === "photo") {
          const id = uid();
          assets[0].role = "photo";
          p.assets[id] = assets[0];
          p.photo.asset = id;
          p.photo.layers = [];
          p.photo.lights = [];
          p.mode = "photo";
          tab = "art";
          return;
        }
        for (const asset of assets) {
          const id = uid();
          asset.role = "artwork";
          p.assets[id] = asset;
          if (type === "replace") {
            const a = p.art.find((a) => a.id === selected);
            if (a) {
              a.asset = id;
              a.title = asset.name.replace(/\.[^.]+$/, "");
              a.edits = undefined;
            }
            break;
          }
          const h = Math.min(48, (36 * asset.height) / asset.width),
            w = (h * asset.width) / asset.height;
          const a = {
            id: uid(),
            asset: id,
            title: asset.name.replace(/\.[^.]+$/, ""),
            wall: "back",
            x: 12,
            y: 30,
            w: +w.toFixed(3),
            h: +h.toFixed(3),
            thickness: 1.5,
            offset: 0.75,
          };
          p.art.push(a);
          selected = a.id;
        }
        tab = "art";
      });
      toast(
        type === "photo"
          ? "Booth photo ready. Select an uploaded artwork to add it."
          : `${assets.length} original image${assets.length > 1 ? "s" : ""} added. Enter the actual dimensions in Artwork.`,
      );
    } catch (err) {
      toast(err.message, true);
    }
  }
  for (const [id, type] of [
    ["art-input", "art"],
    ["replace-input", "replace"],
    ["photo-input", "photo"],
  ])
    document.querySelector("#" + id).onchange = async (ev) => {
      const files = [...ev.target.files];
      if (type === "photo" && p.photo.asset) {
        confirmAction(
          "Replace booth photograph?",
          "A backup will download first. Photo artwork and lighting overlays will reset for the new photograph.",
          () => {
            backup();
            upload(files, type);
          },
        );
      } else await upload(files, type);
      ev.target.value = "";
    };
  document.querySelector("#backup-input").onchange = async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    try {
      if (f.size > 200 * 1024 * 1024)
        throw new Error("Backup exceeds the 200 MB prototype limit.");
      const imported = validateProject(JSON.parse(await f.text()));
      confirmAction(
        "Open this project?",
        "Your current project will download as a backup before the imported project opens.",
        () => {
          backup();
          mutate(() => {
            p = imported;
            tagAssetRoles(p);
            selected = p.art[0]?.id;
            photoSelected = null;
            lightIndex = 0;
            photoLightIndex = 0;
          });
          scene?.setView("perspective");
          toast("Project restored with its original images.");
        },
      );
    } catch (err) {
      toast(err.message, true);
    }
  };
  document.addEventListener("keydown", (ev) => {
    if (document.querySelector("#image-editor").open) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        actions["editor-cancel"]();
      }
      return;
    }
    if (
      ev.target.matches("input,textarea,select") ||
      document.querySelector("#dialog").open
    )
      return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      actions[ev.shiftKey ? "redo" : "undo"]();
    }
    if (ev.key === "Delete" || ev.key === "Backspace") {
      ev.preventDefault();
      if (p.mode === "photo" && photoSelected) actions["photo-delete"]();
      else if (p.mode === "3d" && selected) actions["delete-art"]();
    }
    // +/- zoom the viewport, matching the on-screen zoom buttons. Both rows of
    // keys count: "=" is the unshifted key "+" lives on, and the numpad sends
    // "Add"/"Subtract" as "+"/"-" already. Ctrl/Cmd is left alone so the
    // browser's own page zoom still works.
    if (!ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      if (ev.key === "+" || ev.key === "=") {
        ev.preventDefault();
        actions["zoom-in"]();
      } else if (ev.key === "-" || ev.key === "_") {
        ev.preventDefault();
        actions["zoom-out"]();
      }
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save(editingStart ? JSON.parse(editingStart) : structuredClone(p)).catch(() => {});
  });
  render();
  scheduleSave();
  // Development-only inspection hook for integration tests; absent from production.
  if (import.meta.env.DEV)
    window.__booth = {
      get project() {
        return p;
      },
      get scene() {
        return scene;
      },
      get selectedPanel() {
        return selectedPanel;
      },
      get selectedPedestal() {
        return selectedPedestal;
      },
      // What the light bar would hang, computed from the booth. The view test
      // reads it against the lights the scene actually built.
      get fixtures() {
        return lightBarFixtures(p);
      },
      get photo() {
        return photo;
      },
      mutate,
      // The custom video timeline, normalised — what the export would render.
      // tests/view-timeline.mjs reads it to check that Add really captured the
      // view the viewport was showing.
      timeline,
      save: () => save(structuredClone(p)),
    };
}
boot().catch((err) => {
  console.error(err);
  document.querySelector("#app").innerHTML =
    "<div><h1>Booth Studio could not start</h1><p>Please reload or try another browser. Existing saved data has not been removed.</p></div>";
});
