import { TENTS } from "./environment.js";
import { ENV_PRESETS, ART_FIDELITY, DEFAULT_PRESET, DEFAULT_FIDELITY, resolvePreset, FIXTURE_MODES, DEFAULT_FIXTURES, isIndoor, showFixtures } from "./lighting.js";
import { MOVES, DEFAULT_MOVE, CUSTOM_MOVE, resolveMove, frameTimes } from "./camera-path.js";
import {
  EASES, MAX_KEYS, MIN_KEYS, MIN_SECONDS, MAX_SECONDS,
  emptyTimeline, keyFrom, normalizeTimeline, segmentSpeed, timelineSeconds,
  keySchedule, keyTAt, sampleTimeline, easeFn, FLOWS, autoTime, neighbourKey,
} from "./timeline.js";
import { normalKit, cleanSettings, resolveJob, overridden, tweak, applyPreset, removePreset, jobSlug, MAX_JOBS, MAX_PRESETS, CUSTOM as KIT_CUSTOM } from "./batch.js";
import { SIZES, DEFAULT_SIZE, FPS, DEFAULT_FPS, videoSupported, pickCodec } from "./video.js";
import { FRAMES, DEFAULT_FRAME, DEFAULT_CLIP_FRAME, CUSTOM_FRAME, FRAME_MIN, FRAME_MAX, STILL_SIZES, frameSize, guideRect, placeRect, placeFromRect, normalPlace, DEFAULT_PLACE } from "./framing.js";
import { SHADOW_FIELD, SHADOW_KINDS, SHADOW_MAX, globalAngle, normalAngle, shadowSpec } from "./dropshadow.js";
import { MAX_SWATCHES, isColor, readPalette, savePalette, removeSwatch, rememberColor, previousColor } from "./swatches.js";
import { applyImageEdits, DEFAULT_IMAGE_EDITS, normalizeImageEdits } from "./image-edit.js";
import { PEOPLE, MAX_PEOPLE, MIN_HEIGHT, MAX_HEIGHT, MAX_LIFT, MIN_LIFT, LIFT_STEP, newPerson, personHeight, personName } from "./people.js";
import { FLARE_SOURCES, DEFAULT_FLARE_SOURCE, OVERHEAD } from "./flare.js";
import {
  DEFAULT_SPACE, MAX_GAP, MAX_SLOTS, MIN_SPACE, MAX_SPACE,
  addBooths, addSpace, boothSlots, hasRow, normalizeRow, removeSlot, rowLayout,
  setSpaceWidth, slotLabel,
} from "./row.js";
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
// The build time as the owner reads it: New York time, month, day, hour and
// minute run together — 24 September at 10:36 is "9241036". Asked for in
// place of the UTC timestamp so the footer can be checked against a clock at
// a glance. New York's own offset, so it is EDT in summer, labelled EST as
// asked. Falls back to the UTC form if this browser has no time zone data.
BUILD.stamp = (() => {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        month: "numeric",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(new Date(BUILD.time))
        .map((x) => [x.type, x.value]),
    );
    return `${parts.month}${parts.day}${parts.hour}${parts.minute} EST`;
  } catch {
    return `${BUILD.short} UTC`;
  }
})();
window.BOOTH_BUILD = BUILD;
import {
  createIcons,
  Shapes,
  RotateCw,
  AlignStartHorizontal,
  ListOrdered,
  ArrowLeft,
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
  Pause,
  Building2,
  Columns2,
  Ruler,
  Zap,
  Lock,
  LockOpen,
  ArrowLeftToLine,
  ArrowRightToLine,
  Eye,
  EyeOff,
  Video,
  UserRound,
  SlidersHorizontal,
  Footprints,
  Search,
  Bookmark,
  Tags,
  Magnet,
  Square,
  Map as MapIcon,
  Plug,
  Upload,
  Send,
  AlignHorizontalDistributeCenter,
  AlignStartVertical,
  SkipBack,
  SkipForward,
  Images,
  Crop,
  ArrowUp,
  Route,
  DoorOpen,
  LayoutTemplate,
  FlipHorizontal2,
  FlipVertical2,
  Hand,
  Sparkles,
} from "lucide";
import {
  demoProject,
  blankProject,
  DEFAULT_EDGE_COLOR,
  edgeColorOf,
  lightVisible,
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
  openSpot,
  PLACEMENT_GAP,
  constrainPanel,
  constrainPedestal,
  scalePanel,
  convex,
  MAX_PANELS,
  boothPanels,
  findPanel,
  panelKey,
  isShown,
  panelIdOf,
  panelRange,
  wallKeys,
  wallLabel,
  wallSpec,
  ART_SHOW_PANEL,
  DIFFUSION_MAX,
  LIGHT_BAR,
  LIGHT_BAR_POWER_SLIDER_MAX,
  LIGHT_BAR_POWER_STEP,
  MAX_PEDESTALS,
  PEDESTAL,
  FURNITURE,
  BOX_LIMITS,
  MAX_MODELS,
  furnitureKind,
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
import { load, save, download, readImage, thumbnailOf, THUMB_MAX } from "./storage.js";
import { decodeAt } from "./image-source.js";
import { BoothScene, BACKDROP_FRAMING } from "./scene.js";
import { AUTO_QUALITY, startScale } from "./adaptive.js";
import { distanceInches, formatLength } from "./measure.js";
import { hangAt, nudge, sameWall, spaceEvenly } from "./arrange.js";
import { ALIGN_MODES, alignWorks, distributeWorks } from "./align.js";
import { MAX_VIEWS, STEP, STRIDE, TAGS, newView } from "./views.js";
import { ACCESSIBLE, checkClearance } from "./clearance.js";
import { elevationsHTML } from "./elevations.js";
import { HALL_LIMITS, MAX_HALL_BOOTHS, STATUSES, boothOf, hallCSV, hallHTML, hallLayout, hallSVG, hallTotals, newHall } from "./hall.js";
import { BOOTH_STYLES, DEFAULT_DRAPE, DRAPES, FLOOR_TEMPLATES, KINDS, floorTemplateOf, growToFit, offFloor, validFloorTemplate, SHAPES, VENUES as SHOW_VENUES, boothBlock, boundsOf, copyPieces, feet, floorOf, mirrorPieces, renumber, showItems, showSVG, spacePieces, toFloor } from "./show.js";
import { createShowEditor } from "./show-editor.js";
import { showWalkthrough } from "./show-scene.js";
import { PACK_LONG, PACK_SIZES, SURFACES, describeScene, protectPass, provider as aiProvider, render as aiRender, renderPack } from "./ai-render.js";
import { designFile, importDesign, readDesignFile } from "./booth-file.js";
import { SHARE_DAYS_SHOWN, SHARE_PARAM, deleteShare, downloadShare, forgetLink, rememberLink, sentLinks, shareLink, updateShare, uploadShare } from "./share.js";
import { putDesign } from "./linked.js";
import { MAX_DESIGNS, OWN, assetInDesigns, deleteEffect, hasDesign, liveNumber, openBooth, renumberDesigns, setMine, setOpen } from "./linked.js";
import { CIRCUIT_WATTS, powerHTML, powerLines, powerTotals } from "./power.js";
import { FOOTPRINTS, SHOWS, STARTERS, fromTemplate, quickStart, templateOf } from "./quickstart.js";
import { PhotoEditor } from "./photo.js";
import { hangingGuide } from "./guide.js";
import { showPack } from "./showpack.js";
import { SHORTCUTS, dedupe, fold, rankTools, shortcutOf } from "./toolsearch.js";
import { PRO_FEATURES, TIERS, actionFeature, can, readTier, resolveTier, writeTier } from "./tier.js";
async function boot() {
  const icons = {
    FlipHorizontal2,
    FlipVertical2,
    Hand,
    Grid2x2: Grid2X2,
    SkipBack,
    SkipForward,
    Images,
    Crop,
    ArrowUp,
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
    Pause,
    Building2,
    Columns2,
    Ruler,
    Zap,
    Lock,
    LockOpen,
    Eye,
    EyeOff,
    ArrowLeftToLine,
    ArrowRightToLine,
    Video,
    UserRound,
    SlidersHorizontal,
    Footprints,
    Search,
    Bookmark,
    Tags,
    Magnet,
    Square,
    Map: MapIcon,
    Plug,
    Upload,
    Send,
    AlignHorizontalDistributeCenter,
    AlignStartVertical,
    Shapes,
    RotateCw,
    AlignStartHorizontal,
    ListOrdered,
    ArrowLeft,
    Route,
    DoorOpen,
    LayoutTemplate,
    Sparkles,
  };
  // An icon is written into the HTML as its finished SVG. lucide's
  // createIcons scans the whole document for placeholders and builds each
  // one as DOM nodes, and every inspector redraw paid for that again — a
  // visible share of what a click cost on a slow machine. The markup is built
  // once per icon name and reused as a string.
  const iconMarkup = new Map();
  const icon = (n) => {
    let svg = iconMarkup.get(n);
    if (svg === undefined) {
      const node = icons[n.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())];
      const attrs = (o) => Object.entries(o).map(([k, v]) => ` ${k}="${v}"`).join("");
      svg = node
        ? `<svg${attrs({ xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", class: `lucide lucide-${n}`, "aria-hidden": "true" })}>${node[2].map(([tag, a]) => `<${tag}${attrs(a)}/>`).join("")}</svg>`
        : "";
      iconMarkup.set(n, svg);
    }
    return svg;
  };
  const btn = (action, label, ic, cls = "") =>
    `<button data-action="${action}" class="${cls}" title="${e(label)}" aria-label="${e(label)}">${ic ? icon(ic) : ""}<span>${label}</span></button>`;
  let p,
    selected = null,
    // A multiple selection of artwork, by id, including `selected` — or empty
    // when one work (or none) is selected. Shift-click, or Select several on a
    // touch screen, builds it. View state: never saved, never in the history.
    picked = [],
    // Select several: while on, a tap adds to the selection the way a
    // shift-click does, because a phone has no Shift key.
    addMode = false,
    // Tags hidden right now — see src/views.js. View state of the moment,
    // never saved: a booth should never reopen with its art switched off.
    hiddenTags = new Set(),
    // The hall planner's selected booth, by number: view state.
    hallSelected = null,
    // The floor booth an exhibitor's design file is being imported onto,
    // between Import a booth design and the file picker's answer.
    designTarget = null,
    // A share upload in flight: one at a time.
    sharing = false,
    // The show floor (src/show.js): whether it fills the viewport, its
    // drawing board once made, the snap grid, and the "Add booths" settings.
    // All view state: the plan itself is `p.hall`.
    showFloor = false,
    // The show floor stood up in 3D (src/show-scene.js), walked and recorded
    // in the booth's own viewport. View state, like `showFloor`; a reload
    // opens the booth.
    show3d = false,
    // The camera timeline of the space not being looked at. A booth's keys
    // are poses round the booth and a floor's are poses in its aisles, so
    // each keeps its own and they swap when the 3D show is entered or left.
    otherTimeline = null,
    showEditor = null,
    showGrid = 12,
    showBlock = { count: 10, perRow: 10, w: 120, d: 120, gap: 0, aisle: 120, backToBack: false, style: "pipe" },
    showGap = 0,
    showClipboard = null,
    // General-purpose outlets the power sheet counts — a phone, a card reader.
    powerOutlets = 1,
    // Which booth of the row new artwork is hung in, by its slot id; null is
    // this booth. A view setting: it says where the next tap puts a work, not
    // anything about the booth itself.
    activeBooth = null,
    // Whether fast edit follows the gesture ("auto"), or is held on or off.
    // Remembered per browser rather than per project, because it is a
    // judgement about this machine.
    draftPolicy = "auto",
    // The free-standing wall the mouse and the position sliders are about to
    // move, by its "panel:<id>" key. Independent of `selected`: a panel is not
    // artwork, and its inspector is Layout rather than Artwork.
    selectedPanel = null,
    // The pedestal the mouse and the position sliders are about to move, by
    // its id. Exclusive with `selectedPanel` and with `selected`: one
    // inspector, one thing being moved.
    selectedPedestal = null,
    // The figure last double-clicked in the viewport, by its id. View state
    // only: it lights that figure's card in Layout → People for scale and
    // nothing else, because a figure is placed by its sliders, not dragged.
    selectedPerson = null,
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
    // Preview quality: "auto" (the default — see src/adaptive.js) or a fixed
    // supersampling factor. A view setting, remembered per browser in
    // booth.view with the rung auto last settled on for this display.
    quality = AUTO_QUALITY,
    // Which piece the Walls tool's Add button hangs next: view state.
    furnitureChoice = "pedestal",
    autoScale = null,
    editingStart = null,
    // Video export state. It lives here rather than in the DOM because a
    // recording survives re-renders of the inspector and has to be cancellable
    // from a button the inspector redraws.
    videoMove = DEFAULT_MOVE,
    // The user's own keyframed move, built in the timeline dialog. Like every
    // other video setting this is view state: it is not saved with the booth,
    // is not in the undo history and does not touch schema 1.
    videoTimeline = null,
    // Key times from before the last Auto timing, for its undo button.
    tlBeforeAuto = null,
    // The batch queue itself lives in the project, as `p.exportKit` (see
    // src/batch.js), so it survives a reload and travels in a backup. This is
    // only which of its items is rendering.
    videoBatchAt = -1,
    // Where a keyframed frame sits at the timeline's playhead: sampled while
    // scrubbing and playing, so the guide moves with the clip. Null when the
    // frame is not keyframed, and then the Video tab's placement is the one.
    livePlace = null,
    // Where the render in progress sits in the viewport (fractions), from the
    // scene's onRenderRect: the guide is drawn there while a file renders,
    // so it and the picture inside it always agree.
    renderRect = null,
    // True for the length of one drag of a figure's slider, so the gesture is
    // one entry in the undo history rather than one per pixel.
    personGesture = false,
    videoSeconds = MOVES[DEFAULT_MOVE].seconds,
    videoFps = DEFAULT_FPS,
    videoSize = DEFAULT_SIZE,
    // The shape a clip and a still are delivered in, and a custom pixel size
    // for the frame that asks for one. View settings, remembered per browser
    // beside the fast-edit lock: a frame is a judgement about where the file
    // is going, not about the booth.
    videoFrameShape = DEFAULT_CLIP_FRAME,
    // Where each frame sits in the viewport once dragged, resized or slid
    // (see placeRect). One for the clip and one for the still, like the
    // frames themselves. A view setting, remembered with the other export
    // choices, never part of the booth.
    framePlace = { video: { ...DEFAULT_PLACE }, export: { ...DEFAULT_PLACE } },
    // Whether each recorded frame is drawn a second time before it is
    // captured. On by default because the reported bug — glitches in an
    // exported MP4 — is what a frame captured mid-upload looks like, and a
    // clip that takes twice as long beats a clip that has to be rendered
    // twice anyway.
    videoSettle = true,
    exportFrame = DEFAULT_FRAME,
    exportLong = 4096,
    // The AI render pack's long side (src/ai-render.js PACK_SIZES). View state.
    aiLong = PACK_LONG,
    customFrame = { ...CUSTOM_FRAME },
    // Up to seven saved colours and the colour each control held before the
    // one it holds now. Per browser, never in a backup: see src/swatches.js.
    palette = [],
    colorHistory = {},
    // The edge colour, edge material and thickness the last work was given,
    // carried to the next original hung on a wall so a booth of matched
    // frames is set once rather than per piece.
    lastEdge = null,
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
    videoCodecFor = "",
    // Lite or Pro, per browser — see src/tier.js. Pro by default until the
    // owner decides how Pro is unlocked.
    tier = readTier();
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
    const plan = project.booth.underlay?.asset;
    if (plan && project.assets[plan]) project.assets[plan].role = "underlay";
  }
  p ||= demoProject();
  tagAssetRoles(p);
  selected = p.art[0]?.id;
  document.querySelector("#app").innerHTML =
    `<header><a class="brand" href="#" aria-label="Booth Studio">${icon("box")}<span>Artist OS</span></a><span class="app-badge">Booth Studio</span><div class="tool-search"><span aria-hidden="true">⌕</span><input id="tool-search" type="search" placeholder="Find a tool…" aria-label="Find a tool" title="Find a tool by name or shortcut · press / or Ctrl/⌘ K to jump here" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="tool-results" aria-expanded="false"/><ul id="tool-results" role="listbox" aria-label="Matching tools" hidden></ul></div><div class="project"><input id="project-name" aria-label="Project name" maxlength="120" value="${e(p.name)}"/>${icon("chevron-down")}</div><div class="save-status" id="save-status" role="status">Opening…</div>${btn("help", "Help", "help-circle", "icon-only")}<div class="avatar">IA</div></header>
<div class="workspace"><aside class="library" id="library"></aside><main class="editor"><div class="toolbar"><div class="toolgroup">${btn("select", "Select", "mouse-pointer-2", "active")}${btn("move", "Move", "move")}${btn("pan", "Pan", "hand")}${btn("snap", "Snap 1″", "grid-2x2", "active")}${btn("measure", "Measure", "ruler")}${btn("walk", "Walk", "footprints")}${btn("draw-box", "Box", "square")}${btn("draft", "Fast edit", "zap")}${btn("draft-lock", "Fast edit: follows the gesture", "lock", "draft-lock")}</div><div class="toolgroup floor-tools">${btn("pan", "Pan", "hand")}</div><div class="toolgroup">${btn("undo", "Undo", "undo-2", "icon-only")}${btn("redo", "Redo", "redo-2", "icon-only")}</div><div class="mode-switch"><button data-action="mode-3d">3D booth</button><button data-action="mode-photo">Photo</button><button data-action="mode-show">Show floor</button></div>${btn("export-tab", "Export", "download", "export-top")}</div><div class="viewport"><div id="scene"></div><div class="frame-guide" hidden><div class="frame-guide-box"><button class="fg-move" data-fg="move" title="Drag to move the frame" aria-label="Move the export frame"><span class="fg-label"></span></button>${["nw", "ne", "sw", "se"].map((c) => `<i class="fg-h fg-corner" data-fg="${c}" title="Drag to resize the frame"></i>`).join("")}${["n", "s", "e", "w"].map((c) => `<i class="fg-h fg-edge" data-fg="${c}" title="Drag to change the frame\'s shape"></i>`).join("")}</div></div><div id="photo" hidden></div><div id="show-floor" hidden></div><div class="scene-label"><span class="eyebrow" id="mode-label">MEASURED WORKSPACE</span><strong id="scene-title"></strong><span id="scene-subtitle"></span><small class="mobile-stamp" title="Built ${BUILD.time} · commit ${BUILD.commit}">${BUILD.stamp} · ${BUILD.commit}</small></div><div id="photo-empty" hidden><div>${icon("image-plus")}<h2>Start with your booth shot</h2><p>Add artwork and adjust its four corners to match the wall perspective.</p>${btn("upload-photo", "Upload booth photo", "plus", "primary")}</div></div><button class="find-tool" data-action="find-tool" aria-label="Find a tool" title="Find a tool">${icon("search")}</button><div class="walk-pad" hidden><button data-walk="forward" aria-label="Step forward">▲</button><button data-walk="left" aria-label="Step left">◀</button><button data-walk="back" aria-label="Step back">▼</button><button data-walk="right" aria-label="Step right">▶</button><button data-action="walk" class="walk-exit" aria-label="Stop walking">Done</button></div><div class="measure-bar" hidden><label><input type="checkbox" id="keep-tapes"/> Keep every tape</label><button data-action="clear-tapes">Clear tapes</button></div><div class="viewport-bottom"><div class="view-switch" id="view-switch"><button data-view="perspective" class="active">Perspective</button><button data-view="back">Back</button><button data-view="left">Left</button><button data-view="right">Right</button><button data-view="plan">Plan</button></div><label class="saved-view-pick" hidden><span>View</span><select id="saved-view" aria-label="Go to a saved view"></select></label><div class="zoom-controls"><span class="zoom-label">Zoom</span>${btn("zoom-out", "Zoom out", "minus", "icon-only")}${btn("zoom-in", "Zoom in", "plus", "icon-only")}${btn("reset-view", "Reset view", "rotate-ccw", "icon-only")}</div></div></div><div class="statusbar"><span id="gesture-hint">Drag to orbit · scroll or +/− to zoom · right-drag to pan</span><label class="preview-quality" title="Preview quality: how many pixels the viewport draws for each one on screen. Exports are never affected."><span>Preview</span><select id="quality-quick" aria-label="Preview quality"></select><output id="quality-now"></output></label><span id="selection-status"></span></div></main><aside class="inspector"><button class="sheet-toggle" data-action="sheet-toggle" aria-label="Fold the panel away" title="Fold the panel away"><span>Fold</span></button><div class="inspector-tabs">${["art", "layout", "show", "walls", "lighting", "video", "hall", "export"].map((t, i) => `<button data-tab="${t}">${icon(["image", "layout-panel-left", "building-2", "columns-2", "lightbulb", "video", "map", "download"][i])}<span>${["Artwork", "Layout", "Art show", "Walls", "Lighting", "Video", "Show floor", "Export"][i]}</span></button>`).join("")}</div><div id="inspector-content"></div></aside></div><footer><span class="footer-brand">${icon("box")} BOOTH STUDIO <small>Prototype 01</small><small id="build-stamp" title="Version ${BUILD.version} · built ${BUILD.time} · commit ${BUILD.commit}">v${BUILD.version} · ${BUILD.stamp} · ${BUILD.commit}</small></span><span>Your images. Your space. Your arrangement.</span><span id="network">Local workspace</span></footer><input type="file" id="art-input" accept="image/jpeg,image/png" multiple hidden/><input type="file" id="replace-input" accept="image/jpeg,image/png" hidden/><input type="file" id="photo-input" accept="image/jpeg,image/png" hidden/><input type="file" id="surround-input" accept="image/jpeg,image/png" hidden/><input type="file" id="ground-input" accept="image/jpeg,image/png" hidden/><input type="file" id="underlay-input" accept="image/jpeg,image/png" hidden/><input type="file" id="model-input" accept=".glb,model/gltf-binary" hidden/><input type="file" id="backup-input" accept=".json,.booth" hidden/><input type="file" id="design-input" accept=".json" hidden/><div id="toast" role="status"></div><dialog id="dialog"><div id="dialog-content"></div></dialog><dialog id="image-editor"><div id="image-editor-content"></div></dialog><dialog id="timeline-dialog" class="timeline-dialog"><div id="timeline-content"></div></dialog>`;
  let scene;
  try {
    scene = new BoothScene(
      document.querySelector("#scene"),
      (id, opts = {}) => {
        const adding = !!(opts.add || addMode) && !!id;
        if (adding && selected && selected !== id && p.art.some((x) => x.id === selected) || adding && picked.length) {
          const set = new Set(picked.length ? picked : [selected]);
          // Tapping a work already in the set takes it out again.
          if (set.has(id) && set.size > 1) {
            set.delete(id);
            id = [...set].at(-1);
          } else set.add(id);
          picked = set.size > 1 ? [...set] : [];
        } else if (!adding) picked = [];
        selected = id;
        // Artwork and a free-standing wall are two selections with one pair of
        // arrow-free controls between them; holding both at once would leave
        // the sliders pointing at a wall nobody is looking at.
        if (id) { selectedPanel = null; selectedPedestal = null; selectedPerson = null; }
        // Selecting a work in another booth of the row points the row picker
        // at that booth, so the next original lands beside the one just
        // clicked rather than back at home.
        if (id) activeBooth = p.art.find((x) => x.id === id)?.booth || null;
        // A click on a work opens Artwork. A click on nothing used to as well,
        // which left the panel on "Make room for your work" — reported, and
        // asked to land on Layout instead. Any other tab stays where it is,
        // so orbiting from Video or Lighting does not throw the panel away.
        if (id) tab = "art";
        else if (tab === "art") tab = "layout";
        renderSelection();
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
        if (key) { selectedPedestal = null; selectedPerson = null; tab = "walls"; }
        renderSelection();
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
        if (id) { selectedPanel = null; selected = null; selectedPerson = null; tab = "walls"; }
        renderSelection();
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
    // Double-clicking a figure opens its card: Layout, scrolled to it, lit.
    scene.onSelectPerson = (id) => {
      selectedPerson = id;
      selected = null;
      selectedPanel = null;
      selectedPedestal = null;
      tab = "layout";
      renderSelection();
      document
        .querySelector(`.person-row[data-person="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: "nearest" });
    };
  } catch (err) {
    document.querySelector("#scene").innerHTML =
      '<div class="webgl-error"><h2>3D is unavailable on this browser</h2><p>Enable hardware acceleration or try another browser. Photo editing, project backups, and hanging guides remain available.</p></div>';
    console.error(err);
  }
  try {
    const saved = localStorage.getItem("booth.draftPolicy");
    if (saved) draftPolicy = scene ? scene.setDraftPolicy(saved) : saved;
  } catch {
    // No storage, no remembered lock: auto is the default and is correct.
  }
  loadViewPrefs();
  // The frame guide follows the viewport's size: a window resize, the
  // inspector folding away on a phone, the timeline dialog opening beside it.
  if (typeof ResizeObserver !== "undefined") {
    const host = document.querySelector("#scene");
    if (host) new ResizeObserver(() => updateFrameGuide()).observe(host);
  }
  // Dragging the frame guide. The label moves the frame; a corner resizes it
  // and keeps its shape; an edge changes its shape, which makes the frame a
  // custom size with the new ratio (the long side keeps the custom size's).
  // Live on the guide during the drag, saved and redrawn in the panel after.
  {
    const guide = document.querySelector(".frame-guide");
    const MIN = 40;
    let drag = null;
    guide?.addEventListener("pointerdown", (ev) => {
      const handle = ev.target.closest?.("[data-fg]");
      const shape = frameGuideShape();
      const host = document.querySelector("#scene");
      if (!handle || !shape || !host || ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      const W = host.clientWidth,
        H = host.clientHeight;
      drag = {
        kind: handle.dataset.fg,
        which: shape.which,
        aspect: shape.aspect,
        W,
        H,
        x0: ev.clientX,
        y0: ev.clientY,
        rect: placeRect(W, H, shape.aspect, getPlace(shape.which)),
        box: host.getBoundingClientRect(),
      };
      handle.setPointerCapture(ev.pointerId);
    });
    guide?.addEventListener("pointermove", (ev) => {
      if (!drag) return;
      const { kind, W, H, rect: r, aspect, box } = drag;
      const dx = ev.clientX - drag.x0,
        dy = ev.clientY - drag.y0;
      const px = Math.max(0, Math.min(W, ev.clientX - box.left)),
        py = Math.max(0, Math.min(H, ev.clientY - box.top));
      let next;
      if (kind === "move") next = { ...r, x: r.x + dx, y: r.y + dy };
      else if (kind.length === 2) {
        // Corner: the opposite corner stays put and the shape is kept.
        const ax = kind.includes("w") ? r.x + r.width : r.x,
          ay = kind.includes("n") ? r.y + r.height : r.y;
        const roomW = kind.includes("w") ? ax : W - ax,
          roomH = kind.includes("n") ? ay : H - ay;
        let w = Math.max(Math.abs(px - ax), Math.abs(py - ay) * aspect);
        w = Math.max(MIN, Math.min(w, roomW, roomH * aspect));
        const h = w / aspect;
        next = { x: kind.includes("w") ? ax - w : ax, y: kind.includes("n") ? ay - h : ay, width: w, height: h };
      } else {
        // Edge: only that side moves, so the ratio changes.
        next = { ...r };
        if (kind === "e") next.width = Math.max(MIN, px - r.x);
        if (kind === "w") (next.width = Math.max(MIN, r.x + r.width - px)), (next.x = r.x + r.width - next.width);
        if (kind === "s") next.height = Math.max(MIN, py - r.y);
        if (kind === "n") (next.height = Math.max(MIN, r.y + r.height - py)), (next.y = r.y + r.height - next.height);
      }
      const { aspect: shaped, place } = placeFromRect(W, H, next);
      if (kind.length === 1) {
        const long = Math.max(customFrame.width, customFrame.height, 1080);
        const wide = shaped >= 1;
        customFrame = {
          width: Math.max(FRAME_MIN, Math.min(FRAME_MAX, Math.round((wide ? long : long * shaped) / 2) * 2)),
          height: Math.max(FRAME_MIN, Math.min(FRAME_MAX, Math.round((wide ? long / shaped : long) / 2) * 2)),
        };
        if (drag.which === "video") videoFrameShape = "custom";
        else exportFrame = "custom";
      }
      setPlace(drag.which, place);
      updateFrameGuide();
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      saveViewPrefs();
      placeSettled();
    };
    guide?.addEventListener("pointerup", end);
    guide?.addEventListener("pointercancel", end);
  }
  let adaptToasted = false;
  if (scene) {
    scene.onRenderRect = (rect) => {
      renderRect = rect;
      updateFrameGuide();
    };
    // A footprint drawn with the Box tool becomes a box on the floor, 12″
    // high to start: selected, so the Walls tool's Pull up is right there.
    scene.onDrawBox = (r) => {
      if (!allowed("box")) return toast("Draw a box is part of Booth Studio Pro.", true);
      const list = boothPedestals(p);
      if (list.length >= MAX_PEDESTALS) return toast(`${MAX_PEDESTALS} pieces is the limit.`, true);
      const n = list.filter((x) => furnitureKind(x) === "box").length + 1;
      const piece = { id: uid(), name: "Box " + n, kind: "box", x: r.x, z: r.z, width: Math.min(BOX_LIMITS.width[1], r.width), depth: Math.min(BOX_LIMITS.depth[1], r.depth), height: FURNITURE.box.height, rotation: 0 };
      mutate(() => {
        p.booth.pedestals = [...list, constrainPedestal(p, piece)];
        selectedPedestal = piece.id;
        selectedPanel = null;
        selected = null;
        tab = "walls";
      });
      setDrawingBox(false);
      revealPedestalFields();
      toast(`${piece.name}: ${formatLength(piece.width).split(" · ")[0]} × ${formatLength(piece.depth).split(" · ")[0]}, 12″ high. Pull it up in the Walls tool.`);
    };
    scene.onMeasure = (inches) => {
      measureHint = inches == null ? MEASURE_HINT : "Measured " + formatLength(inches) + " · click to start a new tape · Esc to stop";
      renderStatus();
      // The underlay's Scale plan reads the tape; redraw it with the reading.
      if (p.booth.underlay && tab === "layout") renderInspector();
    };
    scene.setQuality(quality, quality === AUTO_QUALITY ? startScale(devicePixelRatio, autoScale) : undefined);
    // Auto stepping down is said once, so a softer picture is never a mystery,
    // and remembered for this display so the next visit starts where this one
    // settled rather than measuring its way down again.
    scene.onAdapt = (scale) => {
      autoScale = { dpr: devicePixelRatio || 1, scale };
      saveViewPrefs();
      syncQuality();
      if (!adaptToasted) {
        adaptToasted = true;
        toast("Preview detail lowered to keep up with this computer. Exports are unaffected; the Preview menu under the viewport sets it by hand.");
      }
    };
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
  /**
   * A copy of the project for the undo history, a save or an export, made
   * without copying the images.
   *
   * Every edit used to run `JSON.stringify(p)`, and `p.assets` holds every
   * uploaded original as base64. A booth with a dozen 20-megapixel
   * photographs carries fifty-odd megabytes of string, so each nudge of a
   * slider built a fifty-megabyte string — and the history keeps thirty-five
   * of them. That is the single most expensive thing this app did, it cost
   * exactly what someone's own artwork was worth, and it explains why the
   * sample panels always felt quick.
   *
   * An original is never edited — `image-edit.js` edits belong to the
   * placement, and the rule is written down in HANDOFF.md — so the assets can
   * be shared by reference. A shallow copy of the map is one object with a
   * few string references in it, whatever the strings weigh, and it still
   * records exactly which assets existed at this point: deleting one later
   * cannot reach back into a snapshot that named it, and undoing to a
   * snapshot puts the entry back.
   */
  function snapshot() {
    const assets = p.assets;
    p.assets = {};
    // JSON.stringify, not structuredClone: the history has always held
    // strings, and an edit is judged equal by its text in a couple of places.
    const structure = JSON.stringify(p);
    p.assets = assets;
    return { structure, assets: { ...assets } };
  }
  /** The project a snapshot describes, whole again. */
  function fromSnapshot(snap) {
    const restored = JSON.parse(snap.structure);
    restored.assets = { ...snap.assets };
    return restored;
  }
  // The export queue is saved with the project but is not the booth: an undo
  // of a wall move must not also un-queue the clip added since.
  function keepKit(next) {
    if (p.exportKit) next.exportKit = p.exportKit;
    else delete next.exportKit;
    return next;
  }
  function checkpoint() {
    history.push(snapshot());
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
        await save(fromSnapshot(snapshot()));
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
  // Icons arrive as SVG already (see `icon`). This only converts a stray
  // lucide placeholder, should any markup still write one.
  function refreshIcons() {
    if (document.querySelector("i[data-lucide]")) createIcons({ icons, attrs: { "stroke-width": 1.6 } });
  }
  function refreshScene() {
    prunePicked();
    if (scene) scene.also = picked;
    if (selectedPanel && !findPanel(p, selectedPanel)) selectedPanel = null;
    if (selectedPedestal && !findPedestal(p, selectedPedestal)) selectedPedestal = null;
    // Read here, not only when the 3D show is entered: an undo hands back a
    // new `p.hall`, and the scene must stand up the plan that is current.
    scene?.setShow(showFloor && show3d && p.hall ? p.hall : null);
    scene?.update(p, selected, selectedPanel, selectedPedestal);
    syncClearance();
    photo.update(p, photoSelected);
  }
  /**
   * What a click costs. Nothing in the scene changed — only which thing is
   * outlined — so the panels are redrawn and the scene is told the new
   * selection, instead of going through render() and rebuilding every wall,
   * texture and light to show one blue outline.
   */
  /** Drop works that no longer exist from a multiple selection. */
  function prunePicked() {
    if (!picked.length) return;
    picked = picked.filter((id) => p.art.some((a) => a.id === id));
    if (selected && picked.length && !picked.includes(selected)) picked = [];
    if (picked.length < 2) picked = [];
  }
  /** The works of a multiple selection, as placements. */
  const pickedWorks = () => picked.map((id) => p.art.find((a) => a.id === id)).filter(Boolean);
  /**
   * Align or distribute the selection. Only the works on the same face of the
   * same wall as the primary one move — lining up a work on the back wall
   * with one on the left wall means nothing — and the rest are said.
   */
  function arrangePicked(fn, verb) {
    const primary = p.art.find((a) => a.id === selected);
    if (!primary || picked.length < 2) return toast("Select two or more works first: Shift-click, or Select several.", true);
    const works = sameWall(pickedWorks(), primary);
    const skipped = picked.length - works.length;
    const moves = fn(works);
    if (!Object.keys(moves).length) return toast(verb === "distribute" ? "Distributing needs three or more works on one wall." : "Nothing to align.", true);
    mutate(() => {
      for (const a of works) if (moves[a.id]) Object.assign(a, constrain(p, { ...a, ...moves[a.id] }));
    });
    toast(`${works.length} works ${verb === "distribute" ? "spaced evenly" : "aligned"}.${skipped ? ` ${skipped} on another wall left where ${skipped === 1 ? "it is" : "they are"}.` : ""}`);
  }
  function multiSection() {
    if (picked.length < 2) return "";
    const works = pickedWorks();
    const primary = p.art.find((a) => a.id === selected);
    const onWall = primary ? sameWall(works, primary).length : 0;
    return `<section class="multi-select"><h3>${works.length} works selected</h3><p class="muted">${onWall === works.length ? "All on one wall." : `${onWall} on this work's wall; the others are on other walls and stay put when these are aligned.`} Arrow keys move them together. Shift-click a work to add or remove it.</p>${gated("align", `<div class="button-row align-row">${Object.entries(ALIGN_MODES).map(([k, label]) => btn("align-" + k, label, null, "compact")).join("")}</div><div class="button-row">${btn("distribute-x", "Distribute across", "align-horizontal-distribute-center")}${btn("distribute-y", "Distribute up", "align-start-vertical")}</div>`, "Line several works up on an edge or a centre, or give them equal gaps, in one press. Part of Booth Studio Pro.")}<div class="button-row">${btn("clear-multi", "Clear selection", "x")}</div></section>`;
  }
  function renderSelection() {
    if (selectedPanel && !findPanel(p, selectedPanel)) selectedPanel = null;
    if (selectedPedestal && !findPedestal(p, selectedPedestal)) selectedPedestal = null;
    prunePicked();
    scene?.setSelection(selected, selectedPanel, selectedPedestal, picked);
    renderLibrary();
    renderInspector();
    renderStatus();
    syncTools();
  }
  /**
   * The toolbar toggles that mirror a flag on the scene rather than anything
   * in the project. Fast edit now comes on by itself when artwork is
   * double-clicked, and it is a checkbox in Layout as well as a button in the
   * toolbar, so all three are brought into step here — cheaply, without
   * rebuilding a panel to show that a button is lit.
   */
  const MEASURE_HINT = "Measure: click where the tape starts, then where it ends · Esc to stop";
  const DEFAULT_HINT = "Drag to orbit · scroll or +/− to zoom · right-drag to pan";
  // The key that turns a right-drag on the show floor into a pan: ⌘ on a
  // Mac, Ctrl elsewhere. Said by name in the status bar, as asked.
  const PAN_KEY = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
  const PAN_HINT = "Pan: drag to slide the view · scroll to zoom · V or Select to stop";
  // The Pan tool (the toolbar's hand): a left-drag pans the 3D view and the
  // show floor instead of orbiting or selecting.
  let panTool = false;
  function setPanTool(on) {
    panTool = !!on;
    if (panTool && scene?.measure.on) setMeasuring(false);
    scene?.setPanTool(panTool);
    document.querySelector("#scene")?.classList.toggle("pan-tool", panTool);
    document.querySelector("#show-floor")?.classList.toggle("pan-tool", panTool);
    renderStatus();
    syncTools();
  }
  let measureHint = MEASURE_HINT;
  function setMeasuring(on) {
    if (!scene) return;
    // The tape takes the left button; the hand would swallow its clicks.
    if (on && panTool) setPanTool(false);
    scene.setMeasuring(on);
    measureHint = MEASURE_HINT;
    const bar = document.querySelector(".measure-bar");
    if (bar) bar.hidden = !on;
    document.querySelector("#scene").classList.toggle("measuring", !!on);
    renderStatus();
    syncTools();
  }
  function arrangeWall(fn) {
    const a = p.art.find((x) => x.id === selected);
    const wall = a && wallSpec(p, a.wall);
    if (!wall) return;
    let message;
    mutate(() => {
      const works = sameWall(p.art, a);
      message = fn(works, wall);
      for (const w of works) Object.assign(w, constrain(p, w));
    });
    toast(message);
  }
  /**
   * Keyboard placement: an arrow key nudges whatever is selected by an inch,
   * Shift by a foot. Artwork moves along its wall (Up is up); a pedestal or a
   * free-standing wall moves across the floor (Up is away from the entrance).
   * Each press is one undo step, like a typed number.
   */
  function nudgeSelection(dx, dy) {
    if (p.mode !== "3d") return false;
    const art = p.art.find((x) => x.id === selected);
    const ped = selectedPedestal && findPedestal(p, selectedPedestal);
    const panel = selectedPanel && findPanel(p, selectedPanel);
    if (ped) mutate(() => Object.assign(ped, constrainPedestal(p, { ...ped, x: ped.x + dx, z: ped.z - dy })));
    else if (panel) mutate(() => Object.assign(panel, constrainPanel(p, { ...panel, x: panel.x + dx, z: panel.z - dy })));
    else if (art && picked.length > 1)
      mutate(() => {
        for (const w of pickedWorks()) Object.assign(w, constrain(p, { ...w, x: w.x + dx, y: w.y + dy }));
      });
    else if (art) mutate(() => Object.assign(art, constrain(p, { ...art, x: art.x + dx, y: art.y + dy })));
    else return false;
    return true;
  }
  /** R turns the selected pedestal or free-standing wall 15°, Shift+R back. */
  function rotateSelection(step) {
    const item = (selectedPedestal && findPedestal(p, selectedPedestal)) || (selectedPanel && findPanel(p, selectedPanel));
    if (!item || p.mode !== "3d") return false;
    mutate(() => {
      let r = (item.rotation || 0) + step;
      if (r > 180) r -= 360;
      if (r < -180) r += 360;
      item.rotation = r;
    });
    return true;
  }
  /**
   * The preview quality menu's options, with Auto saying which rung it has
   * settled on. Asked on the real machine: "when not editing, what preview
   * quality are we looking at? I don't see where the level is visible." It
   * was a setting at the bottom of Export and a toast said once when Auto
   * stepped down, and nothing else — so the menu now also sits under the
   * viewport, and Auto names where it is.
   */
  function qualityOptions() {
    const rung = scene?.autoScale;
    const autoText =
      quality === AUTO_QUALITY && rung
        ? `Auto · now ${rungName(rung)}`
        : "Auto · adapts to this computer";
    return [
      [AUTO_QUALITY, autoText],
      [1, "Efficient · older devices"],
      [2, "Balanced"],
      [3, "High detail · light-bar shadows"],
    ]
      .map(([value, text]) => `<option value="${value}" ${quality === value ? "selected" : ""}>${e(text)}</option>`)
      .join("");
  }
  /** What a supersampling factor is called, by the fixed setting that draws at it. */
  function rungName(scale) {
    return scale >= 3 ? "High detail, 3×" : scale >= 2 ? "Balanced, 2×" : scale > 1 ? `${scale}×` : "Efficient, 1×";
  }
  /**
   * The menu under the viewport and the one in Export, and beside the first
   * the factor the viewport is actually drawing at — which is not always the
   * setting: fast edit draws at 1× without shadows, and on a Retina display
   * Efficient still draws at the display's own 2×.
   */
  function syncQuality() {
    for (const select of document.querySelectorAll("#quality, #quality-quick")) select.innerHTML = qualityOptions();
    const now = document.querySelector("#quality-now");
    if (!now) return;
    const factor = scene ? Number(scene.renderer.getPixelRatio().toFixed(2)) : null;
    now.textContent = !scene ? "" : scene.draft ? "fast edit · softest, no shadows" : sharpness(factor);
  }
  /**
   * What the drawing scale looks like, in words rather than a supersampling
   * factor: asked for on the real machine, because "drawing at 2×" meant
   * nothing to someone who is not a graphics programmer. The factor stays in
   * the tooltip for whoever wants it.
   */
  function sharpness(factor) {
    const word = factor >= 3 ? "sharpest" : factor >= 2 ? "sharp" : factor > 1 ? "softer" : "softest";
    document.querySelector("#quality-now")?.setAttribute("title", `Drawing ${factor} pixels for each one on screen`);
    return word;
  }
  function syncTools() {
    syncQuality();
    const draft = !!scene?.draft;
    document.querySelector('[data-action="measure"]')?.classList.toggle("active", !!scene?.measure.on);
    for (const el of document.querySelectorAll('.toolbar [data-action="pan"]')) el.classList.toggle("active", panTool);
    const keep = document.querySelector("#keep-tapes");
    if (keep) keep.checked = !!scene?.measure.keep;
    document.querySelector('.toolbar [data-action="walk"]')?.classList.toggle("active", walking);
    document.querySelector('.toolbar [data-action="draw-box"]')?.classList.toggle("active", !!scene?.drawingBox);
    document
      .querySelector('[data-action="snap"]')
      ?.classList.toggle("active", !!scene?.snap);
    for (const el of document.querySelectorAll('[data-action="draft"]'))
      el.classList.toggle("active", draft);
    for (const el of document.querySelectorAll("[data-draft]")) el.checked = draft;
    const lockLabels = {
      auto: ["Auto", "Fast edit follows the gesture: on while you arrange a work, off when you let go."],
      on: ["On", "Fast edit is held on. Shadows and supersampling stay off until you unlock it."],
      off: ["Off", "Fast edit is held off. Arranging a work will not drop the quality."],
    };
    const [text, title] = lockLabels[draftPolicy] || lockLabels.auto;
    for (const el of document.querySelectorAll('[data-action="draft-lock"]')) {
      el.classList.toggle("active", draftPolicy !== "auto");
      el.classList.toggle("locked-off", draftPolicy === "off");
      el.title = title;
      el.setAttribute("aria-label", "Fast edit lock: " + text);
      const span = el.querySelector("span");
      if (span) span.textContent = text;
    }
    for (const el of document.querySelectorAll("[data-draft-policy]"))
      el.value = draftPolicy;
  }
  /**
   * The lock beside the Fast edit button, cycling auto → on → off. Auto is the
   * default and is the gesture deciding for itself; the two locks are for
   * someone who has judged it on their own machine and does not want it
   * changed back under them.
   */
  /**
   * The view settings that belong to this browser rather than to the booth:
   * the export frame, the clip's frame, careful rendering, the saved palette
   * and the last edge finish. None of them is in the backup, none is in the
   * undo history, and none is in schema 1 — the same rule the fast-edit lock
   * follows. Read defensively: a stored value that is no longer offered falls
   * back to the default rather than being trusted.
   */
  function loadViewPrefs() {
    let saved;
    try {
      saved = JSON.parse(localStorage.getItem("booth.view") || "{}");
    } catch {
      return;
    }
    if (!saved || typeof saved !== "object") return;
    if (FRAMES[saved.exportFrame]) exportFrame = saved.exportFrame;
    // Before 2026-09-25 every browser saved "This window" for a clip, because
    // that was the default, not because anyone chose it. Those are left at
    // the new widescreen default; a choice saved since (`clipFrame: 2`) is
    // kept, "This window" included.
    if (FRAMES[saved.videoFrameShape] && saved.clipFrame === 2) videoFrameShape = saved.videoFrameShape;
    if (STILL_SIZES.includes(Number(saved.exportLong))) exportLong = Number(saved.exportLong);
    if (typeof saved.videoSettle === "boolean") videoSettle = saved.videoSettle;
    if (saved.framePlace && typeof saved.framePlace === "object")
      framePlace = { video: normalPlace(saved.framePlace.video), export: normalPlace(saved.framePlace.export) };
    if (saved.customFrame) {
      const clamp = (n, fallback) =>
        Number.isFinite(Number(n)) ? Math.max(FRAME_MIN, Math.min(FRAME_MAX, Math.round(Number(n)))) : fallback;
      customFrame = {
        width: clamp(saved.customFrame.width, CUSTOM_FRAME.width),
        height: clamp(saved.customFrame.height, CUSTOM_FRAME.height),
      };
    }
    palette = readPalette(saved.palette);
    if (saved.colorHistory && typeof saved.colorHistory === "object") colorHistory = saved.colorHistory;
    if (saved.lastEdge && typeof saved.lastEdge === "object") lastEdge = saved.lastEdge;
    if (saved.quality === AUTO_QUALITY || [1, 2, 3].includes(saved.quality)) quality = saved.quality;
    if (saved.autoScale && typeof saved.autoScale === "object") autoScale = saved.autoScale;
  }
  function saveViewPrefs() {
    try {
      localStorage.setItem(
        "booth.view",
        JSON.stringify({ exportFrame, exportLong, customFrame, videoFrameShape, clipFrame: 2, framePlace, videoSettle, palette, colorHistory, lastEdge, quality, autoScale }),
      );
    } catch {
      // A browser with storage switched off keeps all of this for the
      // session; remembering it across one is the only thing lost.
    }
  }
  function setDraftPolicy(policy, announce = true) {
    draftPolicy = scene ? scene.setDraftPolicy(policy) : policy;
    try {
      localStorage.setItem("booth.draftPolicy", draftPolicy);
    } catch {
      // A browser with storage switched off still gets the setting for this
      // session; remembering it is the only thing that is lost.
    }
    syncTools();
    if (announce)
      toast(
        {
          auto: "Fast edit follows the gesture again: on while you arrange a work, off when you let go.",
          on: "Fast edit locked on. Exports are unaffected.",
          off: "Fast edit locked off. Arranging will not drop the quality.",
        }[draftPolicy],
      );
  }
  /**
   * Fast edit is the draft renderer: shadows off, supersampling off. It is a
   * view setting, so it is not pushed onto the undo history and does not mark
   * the project dirty — nothing about the booth changed, and every export
   * puts full quality back before it draws a frame.
   *
   * It deliberately does not go through `render()`. That rebuilds the library
   * and the whole inspector, which on a booth full of uploaded originals is
   * the most expensive thing this file does — so the button whose job is to
   * make the app faster used to cost a pause of its own on the way in.
   */
  function setDraft(on, announce = true) {
    if (!scene || scene.draft === !!on) {
      syncTools();
      return;
    }
    scene.setDraft(!!on);
    syncTools();
    if (announce)
      toast(
        scene.draft
          ? "Fast edit on. Shadows and supersampling are off while you arrange — exports are unaffected."
          : "Full quality. Shadows and supersampling are back.",
      );
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
  // A slider beside the typed edge, for the two placements a work has on its
  // wall. The travel is the wall it hangs on, less the work's own size, so
  // the far end of the slider is the work flush with the far edge rather than
  // a number the constraint will refuse.
  function artSlider(a, key, label) {
    const spec = wallSpec(p, a.wall);
    const span = key === "x" ? (spec?.width ?? 120) - a.w : (spec?.height ?? 96) - a.h;
    const max = Math.max(Math.ceil(span), Math.ceil(a[key]), 1);
    return `<label class="range"><span>${label}<output>${Number(a[key].toFixed(2))}in</output></span><input type="range" data-field="${key}" data-scope="art-position" aria-label="${e(label)} slider" min="0" max="${max}" step="0.25" value="${a[key]}"/></label>`;
  }
  /** One work's placement, in both its number field and its slider. */
  function syncArtInputs(a, except = null) {
    for (const key of ["x", "y"]) {
      for (const input of document.querySelectorAll(
        `[data-field="${key}"][data-scope="art"], [data-field="${key}"][data-scope="art-position"]`,
      )) {
        if (input === except) continue;
        input.value = Number(a[key].toFixed(3));
        input
          .closest("label")
          ?.querySelector("output")
          ?.replaceChildren(Number(a[key].toFixed(2)) + "in");
      }
    }
  }
  /**
   * The eye beside a piece someone added — a free-standing wall, a pedestal or
   * piece of furniture, a figure — asked for as "a hide button, so you don't
   * need to delete; you can just hide it". Hidden keeps its size and place;
   * see `isShown` in model.js for everything it is left out of.
   */
  function hideEye(kind, id, name, shown) {
    return `<button data-hide="${kind}" data-hide-id="${e(id)}" class="eye" title="${shown ? "Hide" : "Show"} ${e(name)}" aria-label="${shown ? "Hide" : "Show"} ${e(name)}" aria-pressed="${!shown}">${icon(shown ? "eye" : "eye-off")}</button>`;
  }
  /** Whether this browser's tier includes a feature. The only question asked. */
  const allowed = (feature) => can(tier, feature);
  /**
   * What a Pro section shows in Lite: its name, a lock, and the one way on.
   * The section's own controls are not drawn at all, so nothing in it can be
   * half-used; the booth itself still draws every Pro part it carries.
   */
  function proLock(feature, what = "") {
    const name = PRO_FEATURES[feature] || "This tool";
    return `<section class="pro-lock" data-pro-lock="${e(feature)}"><h3>${e(name)} <span class="pro-badge">${icon("lock")}Pro</span></h3><p class="muted">${e(what || name + " is part of Booth Studio Pro.")}</p>${btn("tier-pro", "Switch to Pro", "zap", "wide")}</section>`;
  }
  /** A Pro section's markup, or its lock in Lite. */
  const gated = (feature, html, what) => (allowed(feature) ? html : proLock(feature, what));
  /**
   * Fold the inspector down to its tab bar, on a phone, so the booth gets the
   * screen. A view setting of the moment: not remembered, not in the project.
   */
  function setSheet(folded) {
    document.body.classList.toggle("sheet-collapsed", !!folded);
    const toggle = document.querySelector(".sheet-toggle");
    if (toggle) {
      const text = folded ? "Unfold the panel" : "Fold the panel away";
      toggle.setAttribute("aria-label", text);
      toggle.title = text;
      toggle.setAttribute("aria-expanded", String(!folded));
    }
    requestAnimationFrame(() => scene?.resize());
  }
  function setTier(next) {
    tier = resolveTier(next);
    writeTier(tier);
    renderInspector();
    syncClearance();
    toast(tier === "pro" ? "Pro: every tool is unlocked." : "Lite: Pro tools show a lock. Anything already in this booth still draws.");
  }
  function panelFields() {
    const panels = boothPanels(p);
    return `<section><h3>Free-standing walls</h3><p class="muted">Interior panels you can stand anywhere in the booth and hang art on either side. Position is measured in inches from the centre of the floor: X is right, Z is toward the entrance. They do not change the booth footprint.</p><p class="muted">Click a free-standing wall in the booth to select it, then drag it across the floor or use the sliders. Snap keeps a drag on whole inches.</p>${panels.map((panel, i) => {
      const name = panel.name || "Panel " + (i + 1),
        scope = "panel-" + panel.id,
        chosen = selectedPanel === panelKey(panel.id),
        f = (label, key, value, min, max, step, unit) =>
          field(label, key, value, min, max, step, unit, scope, name + " " + label);
      return `<div class="wall-setting${chosen ? " selected" : ""}${isShown(panel) ? "" : " is-hidden"}" data-panel="${e(panel.id)}"><div class="panel-heading"><h4>${e(name)}${chosen ? ' <span class="badge">Selected</span>' : ""}${isShown(panel) ? "" : ' <span class="badge">Hidden</span>'}</h4><span class="piece-actions">${hideEye("panel", panel.id, name, isShown(panel))}${btn("delete-panel-" + panel.id, "Remove " + name, "trash-2", "icon-only")}</span></div>${f("Width", "width", panel.width, 12, 360, 1, "in")}${f("Height", "height", panel.height, 24, 144, 1, "in")}${f("Position X", "x", panel.x, -360, 360, 1, "in")}${panelSlider(panel, name, "x", "Slide left / right")}${f("Position Z", "z", panel.z, -360, 360, 1, "in")}${panelSlider(panel, name, "z", "Slide front / back")}${f("Rotation", "rotation", panel.rotation, -180, 180, 5, "°")}</div>`;
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
    return `<section><h3>Pedestals and furniture</h3><p class="muted">Pedestals, tables in their cloths, a counter, seating, a print bin, gridwall, a banner stand and a screen. Double-click one in the booth to pick it up, then drag it across the floor or use the sliders. Position is inches from the centre of the floor: X is right, Z is toward the entrance. Plan view shows the clear floor around the one selected.</p>${list.map((ped, i) => {
      const name = ped.name || "Pedestal " + (i + 1),
        scope = "pedestal-" + ped.id,
        chosen = selectedPedestal === ped.id,
        f = (label, key, value, min, max, step, unit) =>
          field(label, key, value, min, max, step, unit, scope, name + " " + label);
      return `<div class="wall-setting${chosen ? " selected" : ""}${isShown(ped) ? "" : " is-hidden"}" data-pedestal="${e(ped.id)}"><div class="panel-heading"><h4>${e(name)}${chosen ? ' <span class="badge">Selected</span>' : ""}${isShown(ped) ? "" : ' <span class="badge">Hidden</span>'}${ped.locked ? ' <span class="badge">Locked</span>' : ""}</h4><span class="piece-actions"><button data-lock-pedestal="${e(ped.id)}" class="eye" title="${ped.locked ? "Unlock" : "Lock"} ${e(name)}" aria-label="${ped.locked ? "Unlock" : "Lock"} ${e(name)}" aria-pressed="${!!ped.locked}">${icon(ped.locked ? "lock" : "lock-open")}</button>${hideEye("pedestal", ped.id, name, isShown(ped))}${btn("delete-pedestal-" + ped.id, "Remove " + name, "trash-2", "icon-only")}</span></div>${furnitureKind(ped) === "box" ? `${f("Height", "height", ped.height, ...BOX_LIMITS.height, 1, "in")}${range("Pull up", "height", ped.height, BOX_LIMITS.height[0], Math.max(96, Math.ceil(ped.height)), 1, scope, "in")}${f("Width", "width", ped.width, ...BOX_LIMITS.width, 1, "in")}${f("Depth", "depth", ped.depth, ...BOX_LIMITS.depth, 1, "in")}` : `${f("Height", "height", ped.height, 6, 96, 1, "in")}${f("Width", "width", ped.width, 4, 96, 1, "in")}${f("Depth", "depth", ped.depth, 4, 96, 1, "in")}`}${colorField("Finish", "color", scope, ped.color || PEDESTAL.color, name + " finish")}${f("Position X", "x", ped.x, -360, 360, 1, "in")}${pedestalSlider(ped, name, "x", "Slide left / right")}${f("Position Z", "z", ped.z, -360, 360, 1, "in")}${pedestalSlider(ped, name, "z", "Slide front / back")}${f("Rotation", "rotation", ped.rotation, -180, 180, 5, "°")}</div>`;
    }).join("")}${list.length < MAX_PEDESTALS ? `<label class="setting-label">Add to the floor<select id="furniture-kind" aria-label="Furniture to add">${Object.entries(FURNITURE).filter(([k]) => k !== "box" || allowed("box")).map(([k, f]) => `<option value="${k}" ${k === furnitureChoice ? "selected" : ""}>${e(f.label)} · ${f.width}×${f.depth}″</option>`).join("")}</select></label>${btn("add-pedestal", "Add " + FURNITURE[furnitureChoice].label.toLowerCase(), "plus", "wide")}` : `<p class="muted">${MAX_PEDESTALS} pieces is the limit.</p>`}</section>`;
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
    return `<div class="panel-heading"><h2>Art show booth</h2>${icon("building-2")}</div>${venue}<section><h3>Booth dimensions <span>inches</span></h3><p class="muted">The whole footprint, yours to type. The side walls run along the depth; the back wall runs along the width.</p>${field("Booth width", "width", b.width, 48, 360, 1, "in", "booth", "Booth width")}${field("Booth depth", "depth", b.depth, 48, 360, 1, "in", "booth", "Booth depth")}${field("Booth height", "height", b.height, 48, 144, 1, "in", "booth", "Booth height")}<p class="muted">Changing the booth height sets all three walls to match. A wall wider than the side it stands on is clamped to fit.</p></section><section><h3>Walls</h3><p class="muted">Seamless white panels: no seam posts, no feet and no cap rail, because that is what a pro-panel art-show wall is.</p>${colorField("Wall finish", "color", "booth", b.color, "Wall finish")}<div class="swatches">${["#f4f3f0", "#ffffff", "#e8e6e0", "#d8d4ca"].map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Wall finish ${c}"></button>`).join("")}</div>${wallRow("back", "Back wall")}${wallRow("left", "Left wall")}${wallRow("right", "Right wall")}</section><section><h3>Individual panel</h3><p class="muted">The display panel a wall is built from. Set its size here, then rebuild the walls from it — or leave the walls at their own measurements and use this as the module you are counting.</p>${field("Panel width", "width", module.width, 6, 360, 0.5, "in", "artShow", "Panel width")}${field("Panel height", "height", module.height, 24, 144, 1, "in", "artShow", "Panel height")}<p class="muted">Back ${panelCount(p, "back")} · left ${panelCount(p, "left")} · right ${panelCount(p, "right")} panels at this width.</p><label class="check-field"><input type="checkbox" data-field="linked" data-scope="artShow" ${module.linked ? "checked" : ""}/>Keep the walls built from this panel</label>${btn("relink-walls", "Rebuild walls from this panel", "ruler", "wide")}<p class="muted">Each wall keeps the number of panels it is nearest to now and takes this width and height. The footprint follows the walls.</p></section><section><h3>Light bar</h3><label class="check-field"><input type="checkbox" data-field="on" data-scope="lightBar" ${bar.on ? "checked" : ""}/>Light bar across the booth</label>${bar.on ? `${field("Fixtures", "count", bar.count, 1, 24, 1, "", "lightBar", "Light bar fixtures")}${field("Bar height", "height", bar.height, 24, 240, 1, "in", "lightBar", "Light bar height")}${lightBarLevels(bar)}<p class="muted">Fixture brightness is a percentage of a bar judged to read right: 50 is the default, 100 is twice it. Diffusion stands in for the frost over each head and the bounce off a white hall: it opens the beams until they overlap into a wash, fades their edges, fills the shadows behind pedestals and art instead of stacking nine hard ones, and trims the fixtures back as they widen. 0 is a bare source; 1 is a fully frosted head; past that the hall takes over and the bounce off its white walls does most of the lighting.</p><p class="muted">${bar.count} head${bar.count === 1 ? "" : "s"} spotting the walls: ${share.left} left, ${share.back} back, ${share.right} right. Each is aimed at its own section of wall from the booth's own measurements, so they re-aim when a wall moves. A hidden wall takes none.</p>` : `<p class="muted">No bar. The spotlights in Lighting still light this booth.</p>`}</section><section><h3>Exhibition hall</h3><label class="check-field"><input type="checkbox" data-field="on" data-scope="hall" ${hall.on ? "checked" : ""}/>Stand this booth in a white exhibition hall</label>${hall.on ? `${field("Ceiling height", "ceiling", hall.ceiling, 96, 720, 12, "in", "hall", "Hall ceiling height")}<label class="check-field"><input type="checkbox" data-field="showCeiling" data-scope="hall" ${hall.showCeiling ? "checked" : ""}/>Draw the ceiling</label><p class="muted">${Number((hall.ceiling / 12).toFixed(1))} ft. The ceiling is off by default: at this height it is almost always out of frame, and drawing it puts a grey wash over the booth.</p>` : ""}<label class="check-field"><input type="checkbox" data-field="neighbors" data-scope="booth" ${b.neighbors ? "checked" : ""}/>Surround with other booths</label>${b.neighbors ? `<p class="muted">Indoors the neighbouring booths are the same white walls as yours, without canopies. Their spacing is in Layout → Surroundings.</p>` : ""}</section><section><h3>Walls and pedestals</h3><p class="muted">Free-standing walls and pedestals have a tool of their own, so neither list has to live in here.</p>${btn("open-walls", "Open the Walls tool", "columns-2", "wide")}</section>`;
  }
  // The three light-bar levels that are worth reaching for while looking at the
  // booth. They appear in two panels — Art show, next to the bar's geometry,
  // and Lighting, next to the spotlights — and used to be written out twice.
  // Two copies of a slider is two ranges to widen and one of them will be
  // missed, which is the whole reason this is a function.
  function lightBarLevels(bar) {
    // Fixture brightness is shown as a percentage of a bar that reads right —
    // 50 is the default, 100 is twice it — while the stored value stays the
    // light's own power. A booth saved brighter than the slider offers widens
    // its own slider rather than being dragged down the moment these controls
    // are drawn. Same move as `panelSlider` and `artSlider`, same reason.
    const power = Math.max(
      LIGHT_BAR_POWER_SLIDER_MAX,
      Math.ceil(bar.power / LIGHT_BAR_POWER_STEP),
    );
    // A booth composed before the slider was a percentage carries the old
    // default, 60 stored units, which is 375 on this scale — a bar nobody
    // would now choose, on a slider stretched to reach it. Rather than
    // rewriting a stored number behind the owner's back, say where it is and
    // offer the one drag back.
    const over = bar.power > LIGHT_BAR_POWER_SLIDER_MAX * LIGHT_BAR_POWER_STEP;
    return `${range("Fixture brightness", "power", bar.power, 0, power, 1, "lightBar", "", LIGHT_BAR_POWER_STEP)}${over ? `<div class="warning">This booth's bar is stored above the scale, so the slider is stretched to ${power} to reach it. 50 is the default.${btn("bar-default", "Set brightness to 50", null, "wide")}</div>` : ""}${range("Temperature", "kelvin", bar.kelvin, 2700, 6500, 100, "lightBar", " K")}${range("Diffusion", "diffusion", Math.min(DIFFUSION_MAX, bar.diffusion), 0, DIFFUSION_MAX, 0.1, "lightBar")}`;
  }
  /**
   * A colour control, with the saved palette under it.
   *
   * The operating system's own colour window opens from the swatch and
   * nothing can be added inside it, so the seven saved colours and Previous
   * sit in the panel directly beneath — the same place the fixed finishes
   * already are, one gesture away either way. Saving is explicit: a colour is
   * kept because someone pressed Save, not because they passed through it.
   */
  function colorField(label, key, scope, value, aria = label) {
    const target = `${scope}|${key}`,
      current = (value || "#ffffff").toLowerCase(),
      previous = previousColor(colorHistory, target, current);
    const chip = (color, attrs, title, text = "") =>
      `<button ${attrs} style="background:${e(color)}" title="${e(title)}" aria-label="${e(title)}">${text}</button>`;
    const saved = palette
      .map((c) => chip(c, `data-swatch="${e(c)}" data-target="${e(target)}"`, `Use ${c} · shift-click to forget it`))
      .join("");
    return `<div class="color-block"><label class="color-field">${label}<input type="color" data-field="${e(key)}" data-scope="${e(scope)}" aria-label="${e(aria)}" value="${e(current)}"/></label><div class="swatches saved-swatches">${saved}${
      palette.length < MAX_SWATCHES
        ? `<button class="swatch-save" data-action="swatch-save" data-target="${e(target)}" title="Save ${current} to the palette" aria-label="Save this colour to the palette">+</button>`
        : ""
    }${
      previous
        ? chip(previous, `class="swatch-previous" data-swatch="${e(previous)}" data-target="${e(target)}"`, `Previous · ${previous}`, "<span>Previous</span>")
        : ""
    }</div></div>`;
  }
  /**
   * The edge colour, and the switch that makes one colour answer for every
   * work in the booth.
   *
   * Universal is a rule rather than a rewrite: each placement keeps the
   * `edgeColor` it has, and switching the rule off puts every one of them
   * back. "Paint every work" is the other thing someone might mean by
   * universal — change the works themselves — so both are offered and it is
   * said which is which.
   */
  function edgeColorFields(a) {
    const universal = !!p.booth.edgeUniversal;
    return `<label class="check-field"><input type="checkbox" data-field="edgeUniversal" data-scope="booth" ${universal ? "checked" : ""}/>Universal edge colour for every work</label>${
      universal
        ? `${colorField("Edge colour · whole booth", "edgeColor", "booth", p.booth.edgeColor || DEFAULT_EDGE_COLOR, "Universal edge colour")}<p class="muted">Every work in the booth is painted this, whatever it carries of its own. This one keeps ${e(a.edgeColor || DEFAULT_EDGE_COLOR)} and goes back to it when the switch comes off.</p>${btn("edges-to-all", "Paint every work this colour", null, "wide")}<p class="muted">That writes the colour into each work, so it survives the switch coming off. Undo puts them back.</p>`
        : `${colorField("Edge colour", "edgeColor", "art", a.edgeColor || DEFAULT_EDGE_COLOR, "Edge colour")}<p class="muted">This work's own edges. The colour, the edge material and the thickness you set here are what the next original you hang starts with.</p>`
    }`;
  }
  /**
   * The frame a delivered file comes out in, for a still and for a clip.
   *
   * Both used to inherit the viewport's shape, which meant an export was
   * whatever size someone's browser window happened to be — reported as "it
   * exports at the same dimensions I have the viewing window at". "This
   * window" is still offered and is still the default, because a shot
   * composed in the viewport is a real intention; the rest name their ratio.
   */
  function frameFields(which) {
    const value = which === "video" ? videoFrameShape : exportFrame;
    const options = Object.entries(FRAMES)
      .map(([k, v]) => `<option value="${k}" ${value === k ? "selected" : ""}>${e(v.label)}</option>`)
      .join("");
    const custom =
      value === "custom"
        ? `<div class="field-row"><label class="field"><span>Width</span><div><input type="number" data-frame-custom="width" data-frame-which="${which}" aria-label="Custom frame width" value="${customFrame.width}" min="${FRAME_MIN}" max="${FRAME_MAX}" step="2"/><small>px</small></div></label><label class="field"><span>Height</span><div><input type="number" data-frame-custom="height" data-frame-which="${which}" aria-label="Custom frame height" value="${customFrame.height}" min="${FRAME_MIN}" max="${FRAME_MAX}" step="2"/><small>px</small></div></label></div><p class="muted">One custom size, shared by the still and the clip. Sides are rounded to even numbers, which is what an H.264 encoder requires.</p>`
        : "";
    const place = getPlace(which);
    const keyed = which === "video" && frameKeyed();
    const slider = (key, label, min, v) =>
      `<label class="range"><span>${label}<output>${Math.round(v * 100)}%</output></span><input type="range" data-frame-place="${key}" data-frame-which="${which}" aria-label="${e(label)} (${which === "video" ? "video" : "still"})" min="${min}" max="100" step="1" value="${Math.round(v * 100)}"/></label>`;
    // The frame's place in the viewport: the same thing the guide's handles
    // drag, as sliders. Only for a frame with its own shape — "This window"
    // is the viewport and has nowhere to move.
    const placing =
      value === "view"
        ? ""
        : `${keyed ? `<p class="keyed-note">Keyframed: these set <strong>${e(selectedKeyName())}</strong>'s frame.</p>` : which === "video" && videoMove === CUSTOM_MOVE && videoTimeline?.frameKeys ? `<p class="keyed-note">This clip's frame is keyframed: each keyframe has its own, set in Edit timeline. These sliders do not move it.</p>` : ""}${slider("scale", "Frame size", 20, place.scale)}${slider("x", "Frame left / right", -100, place.x)}${slider("y", "Frame up / down", -100, place.y)}<p class="muted">Or drag the frame in the viewport: its label moves it, a corner resizes it, an edge changes its shape (and makes it a custom size).</p>${place.scale !== 1 || place.x !== 0 || place.y !== 0 ? btn(`frame-reset-${which}`, "Reset frame to fit", "rotate-ccw", "wide") : ""}`;
    return `<label class="setting-label">Frame<select data-frame="${which}" aria-label="${which === "video" ? "Video frame" : "Export frame"}">${options}</select></label>${custom}${placing}`;
  }
  /** What the chosen frame will actually produce, in pixels, said out loud. */
  function frameNote(which) {
    const viewport = scene?.renderer?.domElement
      ? scene.renderer.domElement.width / scene.renderer.domElement.height
      : 16 / 9;
    const shape =
      which === "video"
        ? frameSize(videoFrameShape, {
            long: Math.max(SIZES[videoSize]?.width || 1920, SIZES[videoSize]?.height || 1080),
            viewport,
            custom: customFrame,
          })
        : frameSize(exportFrame, { long: exportLong, viewport, custom: customFrame });
    const chosen = which === "video" ? videoFrameShape : exportFrame;
    return `${shape.width} × ${shape.height} px${chosen === "view" ? ", the shape of this window" : ""}. ${chosen === "view" ? "" : "The viewport outlines it while this tab is open: what is inside the outline is what the file shows."}`;
  }
  /**
   * The two drawn shadows, laid out the way Photoshop's Drop Shadow dialog is
   * — asked for with a screenshot of it: Opacity, Angle with its dial and
   * Use Global Light, Distance, Spread and Size, each a slider with the
   * number typed beside it. The eye in each heading shows or hides that
   * shadow without losing its settings. They live in Lighting because they
   * are light, even though they are drawn rather than cast; see
   * src/dropshadow.js for why.
   *
   * The sliders, the typed numbers and the dial move the shadows live
   * (`shadowGesture`, below) and take one undo step per gesture. The eye and
   * Use Global Light are ordinary edits.
   */
  function shadowSection(kind) {
    const s = shadowSpec(p.booth, kind),
      scope = SHADOW_FIELD[kind],
      name = kind === "behind" ? "Drop shadow" : "Under shadow";
    const heading =
      kind === "behind"
        ? `Drop shadow <span>behind the work</span>`
        : `Second shadow <span>under &amp; to the side</span>`;
    const eye = `<button data-shadow-eye="${kind}" class="eye${s.on ? "" : " off"}" title="${s.on ? "Hide" : "Show"} this shadow" aria-label="${s.on ? "Hide" : "Show"} ${e(name.toLowerCase())}" aria-pressed="${s.on}">${icon(s.on ? "eye" : "eye-off")}</button>`;
    const note =
      kind === "behind"
        ? `Photoshop's drop shadow, on the wall behind every hung work. Angle is where the light comes from; Distance and Size are inches on the wall, so a shadow reads the same at every export size. ${s.on ? "" : "Hidden: its settings are kept, and the eye brings it back."}`
        : `A stronger shadow thrown down and to the side, for weight on the wall. It draws over the one above, so the two read as a tight contact shadow and a soft cast one. ${s.on ? "" : "Hidden until the eye is switched on; set it up first if you like."}`;
    return `<section class="fx${s.on ? "" : " fx-off"}" data-fx="${kind}"><div class="fx-head"><h3>${heading}</h3>${eye}</div>${fxRow(name, "Opacity", "opacity", s.opacity, 0, 100, 1, scope, "%")}${angleRow(name, s, scope)}${fxRow(name, "Distance", "distance", s.distance, 0, SHADOW_MAX, 0.05, scope, "in", 6)}${fxRow(name, "Spread", "spread", s.spread, 0, 100, 1, scope, "%")}${fxRow(name, "Size", "size", s.size, 0, SHADOW_MAX, 0.05, scope, "in", 6)}<p class="muted">${note}</p></section>`;
  }
  /**
   * One Photoshop-style row: the label, a slider, the number and its unit.
   * Both inputs are the same field, so either can be used and the other
   * follows. A slider's travel stops at `reach` where the typed number may
   * go further — fine control over the first few inches matters more than
   * dragging to a foot — unless the value is already past it.
   */
  function fxRow(name, label, key, value, min, max, step, scope, unit, reach = max) {
    const top = Math.max(reach, value);
    const shown = Number(value.toFixed(2));
    return `<div class="fx-row"><span class="fx-label">${label}</span><input type="range" data-field="${key}" data-scope="${scope}" data-fx-live aria-label="${e(name + " " + label.toLowerCase())}" min="${min}" max="${top}" step="${step}" value="${shown}"/><input type="number" data-field="${key}" data-scope="${scope}" data-fx-live aria-label="${e(name + " " + label.toLowerCase() + " value")}" min="${min}" max="${max}" step="${step}" value="${shown}"/><span class="fx-unit">${unit === "in" ? "″" : unit}</span></div>`;
  }
  /** Photoshop's angle row: a dial to drag, the degrees, and Use Global Light. */
  function angleRow(name, s, scope) {
    return `<div class="fx-row fx-angle"><span class="fx-label">Angle</span><span class="fx-dial" data-dial="${scope}" role="slider" tabindex="0" aria-label="${e(name)} angle dial" aria-valuemin="-180" aria-valuemax="180" aria-valuenow="${s.angle}">${dialSVG(s.angle)}</span><input type="number" data-field="angle" data-scope="${scope}" data-fx-live aria-label="${e(name)} angle value" min="-180" max="180" step="1" value="${Math.round(s.angle)}"/><span class="fx-unit">°</span></div><label class="check-field fx-global"><input type="checkbox" data-field="global" data-scope="${scope}" ${s.global ? "checked" : ""}/>Use global light</label>`;
  }
  /** The dial's face: a line from the centre toward the light. */
  function dialSVG(angle) {
    const r = (angle * Math.PI) / 180,
      x = 12 + 8.5 * Math.cos(r),
      y = 12 - 8.5 * Math.sin(r);
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5"/><line x1="12" y1="12" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"/><circle class="hub" cx="12" cy="12" r="1.5"/></svg>`;
  }
  /**
   * Every shadow control on the page, set from the booth — after a live
   * change, so the typed number follows its slider, and the other shadow's
   * angle follows a global light that just moved. The control being used is
   * left alone: rewriting an input under the cursor fights the person typing.
   */
  function syncShadowInputs(except = null) {
    for (const kind of SHADOW_KINDS) {
      const s = shadowSpec(p.booth, kind),
        scope = SHADOW_FIELD[kind];
      for (const input of document.querySelectorAll(`[data-fx-live][data-scope="${scope}"]`)) {
        if (input === except) continue;
        const v = s[input.dataset.field];
        if (typeof v === "number") input.value = input.dataset.field === "angle" ? Math.round(v) : Number(v.toFixed(2));
      }
      const dial = document.querySelector(`[data-dial="${scope}"]`);
      if (dial) {
        dial.innerHTML = dialSVG(s.angle);
        dial.setAttribute("aria-valuenow", String(Math.round(s.angle)));
      }
    }
  }
  /**
   * One live change to a shadow, from a slider, a typed number or the dial.
   * The record is written back whole the first time — which is what upgrades
   * an older booth's `dropShadow` — and an angle under the global light moves
   * the global light, so every shadow using it turns together.
   */
  function setShadowLive(scope, key, raw, source = null) {
    const kind = SHADOW_KINDS.find((k) => SHADOW_FIELD[k] === scope);
    if (!kind) return;
    const limits = { opacity: [0, 100], spread: [0, 100], distance: [0, SHADOW_MAX], size: [0, SHADOW_MAX], angle: [-180, 180] }[key];
    const value = Number(raw);
    if (!limits || raw === "" || !Number.isFinite(value)) return;
    const v = key === "angle" ? normalAngle(Math.round(value)) : Math.max(limits[0], Math.min(limits[1], value));
    if (shadowSpec(p.booth, kind)[key] === v) return;
    if (!shadowGesture) {
      checkpoint();
      shadowGesture = true;
    }
    const record = (p.booth[scope] = shadowSpec(p.booth, kind));
    record[key] = v;
    if (key === "angle" && record.global) p.booth.shadowAngle = v;
    scene?.updateShadows();
    syncShadowInputs(source);
  }
  /** The end of a live shadow gesture: saved, and one undo step behind it. */
  function endShadowGesture() {
    if (!shadowGesture) return;
    shadowGesture = false;
    scheduleSave();
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
    // How many stored units one point of this slider is worth. 1 — every
    // slider but one — means the control is the stored number itself.
    scale = 1,
  ) {
    const shown = value / scale;
    return `<label class="range"><span>${label}<output>${Number(shown.toFixed(2))}${unit}</output></span><input type="range" data-field="${key}" data-scope="${scope}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${shown}"${scale === 1 ? "" : ` data-scale="${scale}"`}/></label>`;
  }
  function artThumb(a) {
    if (a.kind === "sign" || a.kind === "label")
      return `<div class="sign-thumb"><strong>${e(a.kind === "sign" ? a.artistName || "Artist name" : a.title)}</strong><span>${e(a.kind === "sign" ? a.city || "City, State" : a.medium || "")}</span></div>`;
    const asset = p.assets[a.asset];
    // The thumbnail, not the original. This markup is rebuilt on every click
    // — a selection redraws the library and the inspector — and pointing a
    // dozen of these at a dozen 20-megapixel originals is what made a booth
    // full of uploads feel heavy. An asset saved before thumbnails existed
    // still shows its original until the backfill reaches it.
    return asset
      ? `<img src="${asset.thumb || asset.data}" alt="${e(a.title)}" loading="lazy" decoding="async"/>`
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
    // Which booth of the row this is going into, and therefore which works
    // count as "already there": a work in another booth is not something to
    // start beside, and openSpot ignores it too.
    const booth = activeSlot();
    const current = p.art.find(
      (item) => item.id === selected && (item.booth || null) === booth,
    );
    const wall = current?.wall || template.wall || "back";
    const face = current?.face || template.face || "inside";
    // `openSpot` is what keeps a second tap on the same original from landing
    // exactly on the first one. The starting point is still beside whatever is
    // selected; it only moves on from there if that spot is occupied.
    return openSpot(
      p,
      constrain(p, {
        ...template,
        id: uid(),
        sourceKey: undefined,
        sourceId: template.asset ? undefined : template.sourceId || template.id,
        booth: booth || undefined,
        wall,
        face,
        x: current ? current.x + PLACEMENT_GAP : template.x ?? 12,
        y: current ? current.y : template.y ?? 30,
        // The finish the last work was given. Only ever a starting value, and
        // only for a work that does not already carry one of its own — a
        // second copy of something already hung keeps what that one has.
        ...(lastEdge && !template.edgeColor
          ? {
              edgeColor: lastEdge.edgeColor,
              edgeTexture: lastEdge.edgeTexture,
              thickness: Number.isFinite(lastEdge.thickness) ? lastEdge.thickness : template.thickness,
            }
          : {}),
        edits: keepEdits && template.edits ? structuredClone(template.edits) : undefined,
      }),
    );
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
    let placed;
    mutate(() => {
      placed = placementFromTemplate(template);
      p.art.push(placed);
      selected = placed.id;
      tab = "art";
    });
    const inBooth = placed.booth
      ? " of " + slotLabel(boothSlots(p.booth).find((b) => b.id === placed.booth) || {})
      : "";
    toast(
      `Hung on the ${wallLabel(p, placed.wall)}${inBooth} · ${placed.face === "outside" ? "outside" : "inside"}. Double-tap it on the wall to move or scale it.`,
    );
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
          return `<button class="art-card ${activeSource ? "selected" : ""} ${item.asset && !copies ? "unplaced" : ""}" draggable="${p.mode === "3d"}" data-source="${e(item.sourceKey)}" title="Tap to hang this on a wall${p.mode === "3d" ? ", or drag it onto the wall you want" : ""}"><div class="thumb">${artThumb(item)}</div><div><strong>${e(item.title)}</strong><span>${item.w} × ${item.h} × ${item.thickness} in</span><small>${item.asset ? (copies ? copies + " on the walls" : "Tap to hang it") : "Reusable sample panel"}</small></div></button>`;
        })
        .join("") || '<p class="muted">Upload JPG or PNG artwork to begin.</p>'
    }</div><p class="library-drag-note">Tap an original to hang it on a wall — uploading only files it here. On a mouse you can also drag one onto the interior or exterior wall you want. Each one creates a new placement; the original stays here.</p>${p.mode === "3d" ? `<div class="asset-tools"><h3>Booth assets</h3><div class="button-row">${btn("add-sign", "Artist sign", "plus")}${btn("add-label", "Artwork label", "plus")}</div></div>` : ""}<div class="library-bottom">${btn("upload-art", "Upload originals", "image-plus", "wide")}${p.art.some((item) => !item.asset && !item.kind) ? btn("clear-samples", "Remove sample panels", null, "wide text-button") : ""}<p>Original files stay intact.<br>Saved only on this browser/device.</p></div>`;
  }
  function renderLibrary() {
    document.querySelector("#library").innerHTML = showFloor ? showLibraryHTML() : libraryHTML();
  }
  function signFields(a) {
    const input = (label, key, value) => `<label class="setting-label">${label}<input type="text" data-field="${key}" data-scope="art" aria-label="${label}" maxlength="200" value="${e(value || "")}"/></label>`;
    if (a.kind === "sign") return `<section><h3>Artist sign</h3>${input("Artist name","artistName",a.artistName)}${input("City / State","city",a.city)}${input("Medium","medium",a.medium)}</section>`;
    if (a.kind === "label") return `<section><h3>Artwork label</h3><p class="muted">Use Artwork title above for the first line.</p>${input("Medium","medium",a.medium)}${input("Price / detail","price",a.price)}</section>`;
    // A work's own medium and price, for the show pack's inventory. Typed as
    // text — "$450", "NFS", "£80 framed" — and totalled where it is a number.
    return `<section><h3>For the show pack</h3>${input("Medium","medium",a.medium)}${input("Price","price",a.price)}<p class="muted">Listed in Export → Show pack with the size and wall. Prices that are numbers are totalled.</p></section>`;
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
  /**
   * The booth of the row that new artwork goes into, as a slot id, or null for
   * this booth. Validated on the way out: a booth that has been removed
   * cannot stay selected, and the answer then is home.
   */
  function activeSlot() {
    if (!activeBooth) return null;
    const row = normalizeRow(p.booth);
    const slot = row.slots.find((x) => x.id === activeBooth && x.kind === "booth");
    if (!slot || slot.id === row.home) {
      activeBooth = null;
      return null;
    }
    return activeBooth;
  }
  /** The row, edited and written back. One undo step, like every other edit. */
  function editRow(fn) {
    mutate(() => {
      p.booth.row = fn(p.booth);
      // A booth that has just gone takes its artwork with it: leaving the
      // works behind would leave them hanging on walls that are not drawn,
      // which is the one state this row must never produce.
      const ids = new Set(
        normalizeRow(p.booth).slots.filter((x) => x.kind === "booth").map((x) => x.id),
      );
      p.art = p.art.filter((a) => !a.booth || ids.has(a.booth));
      activeSlot();
    });
  }
  function addRowBooths(side, count) {
    const before = normalizeRow(p.booth).slots.length;
    editRow((booth) => addBooths(booth, side, count));
    const added = normalizeRow(p.booth).slots.length - before;
    if (!added) {
      toast(`A row holds ${MAX_SLOTS} slots. Remove one to add another.`, true);
      return;
    }
    toast(
      `${added} booth${added === 1 ? "" : "s"} added to the ${side}. Pick one under “Hang new artwork in”, then tap an original.`,
    );
  }
  function addRowSpace(side) {
    const before = normalizeRow(p.booth).slots.length;
    editRow((booth) => addSpace(booth, side, DEFAULT_SPACE));
    if (normalizeRow(p.booth).slots.length === before) {
      toast(`A row holds ${MAX_SLOTS} slots. Remove one to add another.`, true);
      return;
    }
    toast(`A ${DEFAULT_SPACE}″ space added to the ${side}. Type its width to change it.`);
  }
  function removeRowSlot(id) {
    const hung = p.art.filter((a) => a.booth === id).length;
    editRow((booth) => removeSlot(booth, id));
    toast(hung ? `Booth removed, with the ${hung} work${hung === 1 ? "" : "s"} hung in it.` : "Removed from the row.");
  }
  const rowCount = () =>
    Math.max(1, Math.min(MAX_SLOTS, Math.round(+document.querySelector("#row-count")?.value || 1)));
  /**
   * Layout → Booth row. The aisle, built by hand: booths either side of this
   * one, gaps where the show has them, and one of them picked out as the booth
   * the next original is hung in.
   *
   * Every booth in the row is this booth's size — see src/row.js for why —
   * and hangs artwork against the same walls, so there is nothing new to
   * measure and nothing new to validate about a piece of art but which booth
   * it is in.
   */
  function rowSection() {
    if (!allowed("row"))
      return proLock("row", "Booths either side of this one, spaces in the aisle and artwork hung in each — the whole row, measured. Part of Booth Studio Pro.");
    const row = normalizeRow(p.booth);
    const slots = rowLayout(p.booth);
    const booths = boothSlots(p.booth);
    const active = activeSlot() || row.home;
    const full = row.slots.length >= MAX_SLOTS;
    const side = (label, where) =>
      `<div class="row-side"><h4>${label}</h4><div class="button-row">${btn("row-booth-" + where, "+1 booth", where === "left" ? "arrow-left-to-line" : "arrow-right-to-line")}${btn("row-count-" + where, "Add typed number", "plus")}${btn("row-space-" + where, "+ space", "columns-2")}</div></div>`;
    return `<section><h3>Booth row</h3><p class="muted">The aisle around this booth, drawn as booths rather than scenery. Each one is this booth's size and takes artwork of its own: pick it below, then tap an original — or drag one straight onto its wall.</p>
      <label class="setting-label">How many to add<input type="number" id="row-count" min="1" max="${MAX_SLOTS}" step="1" value="1" aria-label="How many booths or spaces to add"/></label>
      ${side("To the left", "left")}${side("To the right", "right")}
      ${field("Gap between booths", "gap", row.gap, 0, MAX_GAP, 1, "in", "row")}
      <label class="setting-label">Hang new artwork in<select aria-label="Hang new artwork in" data-row-active>${booths.map((b) => `<option value="${e(b.id)}" ${b.id === active ? "selected" : ""}>${e(slotLabel(b))}</option>`).join("")}</select></label>
      ${activeSlot() ? `<p class="muted">New originals are hung in ${e(slotLabel(booths.find((b) => b.id === activeSlot()) || {}))}. Selecting a work that hangs in another booth moves this picker to it.</p>` : ""}
      <div class="row-slots">${slots.map((slot, i) => {
        const label = slot.kind === "booth"
          ? slotLabel({ ...slot, number: booths.findIndex((b) => b.id === slot.id) + 1 })
          : slotLabel(slot);
        const works = slot.kind === "booth"
          ? p.art.filter((a) => (a.booth || row.home) === slot.id).length
          : 0;
        return `<div class="row-slot ${slot.home ? "home" : ""}"><span>${i + 1}. ${e(label)}${slot.kind === "booth" ? ` <small>${works} hung</small>` : ""}</span>${slot.kind === "space" ? field("Width", "width", slot.width, MIN_SPACE, MAX_SPACE, 1, "in", "space-" + slot.id) : ""}${slot.home ? '<small class="muted">yours</small>' : btn("row-remove-" + slot.id, "Remove", "trash-2", "icon-only")}</div>`;
      }).join("")}</div>
      ${full ? `<p class="muted">A row holds ${MAX_SLOTS} slots. Remove one to add another.</p>` : ""}
      ${hasRow(p.booth) ? '<p class="muted">Removing a booth removes the artwork hung in it. The booths either side of yours in Surroundings are left out while a row is drawn, so the aisle is only the one you laid out.</p>' : ""}</section>`;
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
    toast(`${personName(kind)} added at ${Math.floor(person.height / 12)}′${person.height % 12}″.`);
  }
  // Figures for scale. A wall height in inches is hard to read; the same wall
  // beside a 5'6" visitor is not. They are a drawing aid, so they live in the
  // Layout panel beside the surroundings rather than in the artwork list, and
  // they are excluded from the hanging guide.
  // A figure's slider, beside the typed number it edits. The travel is the
  // booth's own footprint, so the whole length of it is somewhere a person can
  // usefully stand — and a figure already outside it, typed or out of an older
  // backup, widens its own slider rather than being walked back inside the
  // moment these controls are drawn. Same rule as `panelSlider`.
  function personSlider(person, key, label, unit = "in") {
    // The booth, plus four feet of aisle at each edge. A visitor standing just
    // outside the booth looking in is half of what these figures are for, so
    // travel that stopped at the footprint would stop short of the useful
    // placement — which is the difference from `panelSlider`, where a wall
    // outside the booth is a mistake rather than a photograph.
    const reach = key === "height" || key === "lift"
      ? null
      : Math.max(panelRange(p)[key] + 48, Math.abs(person[key] || 0));
    const min = key === "height" ? MIN_HEIGHT : key === "lift" ? MIN_LIFT : -Math.ceil(reach);
    const max = key === "height" ? Math.max(MAX_HEIGHT, Math.ceil(person[key])) : key === "lift" ? MAX_LIFT : Math.ceil(reach);
    const value = person[key] ?? 0;
    return `<label class="range"><span>${label}<output>${Number(value.toFixed(2))}${unit}</output></span><input type="range" data-field="${key}" data-scope="person-${e(person.id)}" aria-label="${e(label)} slider" min="${min}" max="${max}" step="${key === "lift" ? LIFT_STEP : 1}" value="${value}"/></label>`;
  }
  /**
   * Fast edit, where someone arranging a booth will look for it. The toolbar
   * button is a toolbar button — small, unlabelled on a narrow screen, and
   * easy to miss — and this is the panel you are already in while moving
   * things around. Both drive the same flag; neither is stored, because how
   * fast this machine draws is not part of the booth.
   */
  function draftSection() {
    return `<section><h3>Drawing speed</h3><label class="check-field"><input type="checkbox" data-draft ${scene?.draft ? "checked" : ""}/>Fast edit</label><label class="setting-label">Fast edit lock<select aria-label="Fast edit lock" data-draft-policy><option value="auto">Auto · follows the gesture</option><option value="on">Always on</option><option value="off">Always off</option></select></label><p class="muted">Auto turns fast edit on when you arm a work and off again when you click away from it. The lock beside the toolbar button is the same three settings, and holds it wherever you put it.</p><p class="muted">Drops the shadow passes and the supersampling while you arrange, and comes on by itself when you double-tap artwork. Exports are never affected: full quality goes back before a PNG or a video draws a single frame.</p></section>`;
  }
  /**
   * Layout → Saved views: SketchUp's Scenes. Each is a named camera, one
   * click to come back to; all of them export as PNGs in one go. Saved with
   * the booth, in `p.views`.
   */
  function viewsSection() {
    const views = p.views || [];
    const rows = views
      .map((v) => `<div class="view-row" data-saved-view="${e(v.id)}"><input type="text" data-view-name="${e(v.id)}" aria-label="Name of ${e(v.name)}" maxlength="120" value="${e(v.name)}"/>${btn("view-go-" + v.id, "Go to " + v.name, "camera", "icon-only")}${btn("view-update-" + v.id, "Replace " + v.name + " with this view", "rotate-ccw", "icon-only")}${btn("view-delete-" + v.id, "Delete " + v.name, "trash-2", "icon-only")}</div>`)
      .join("");
    return `<section><h3>Saved views <span>${views.length} / ${MAX_VIEWS}</span></h3><p class="muted">Frame the booth the way you want it seen, then save the view. Each one is a click away here and in the View menu under the booth, and they are saved with the booth.</p>${rows}${views.length < MAX_VIEWS ? btn("view-save", "Save this view", "bookmark", "wide") : `<p class="muted">${MAX_VIEWS} views is the limit.</p>`}${views.length ? btn("views-export", `Export all ${views.length} as PNG`, "download", "wide") : ""}</section>`;
  }
  /**
   * Layout → Tags: visibility groups. A hidden tag leaves the viewport and
   * every export and cannot be clicked, which is what a clean shot of the
   * walls alone, or a faster drag on a slow machine, wants. Not saved.
   */
  function tagsSection() {
    return `<section><h3>Tags <span>show or hide</span></h3><p class="muted">Hide a whole group at once — in the viewport and in exports. Nothing is deleted, and reopening the booth shows everything again.</p><div class="tag-list">${Object.entries(TAGS)
      .map(([k, label]) => `<label class="check-field"><input type="checkbox" data-tag="${k}" ${hiddenTags.has(k) ? "" : "checked"}/>${e(label)}</label>`)
      .join("")}</div></section>`;
  }
  /**
   * Hall (Pro): the whole show's floor, for a promoter — rows of numbered
   * booths on aisles, each with an exhibitor, a status and a price, a map to
   * print and a list to send. Kept in the project as `p.hall`.
   */
  function hallPanel() {
    if (showFloor && p.hall && allowed("hall")) return showFloorPanel();
    const intro = "Plan a whole show: rows of numbered booths on aisles, each with an exhibitor, a status and a price. Print the map, send the exhibitor list.";
    if (!allowed("hall")) return proLock("hall", intro + " Part of Booth Studio Pro.");
    const h = p.hall;
    if (!h) return `<p class="muted">${intro}</p>${btn("hall-start", "Start a hall plan", "map", "primary wide")}`;
    const booths = hallLayout(h);
    if (hallSelected !== null && !booths.some((b) => b.number === hallSelected)) hallSelected = null;
    const t = hallTotals(h);
    const f = (label, key, unit = "", step = 1) => field(label, key, h[key], ...HALL_LIMITS[key], step, unit, "hallplan", "Hall " + label);
    const chosen = hallSelected !== null ? boothOf(h, hallSelected) : null;
    const editor = chosen
      ? `<section class="hall-booth"><h3>Booth ${hallSelected}${h.mine === hallSelected ? ' <span class="badge">Yours</span>' : ""}</h3><label class="setting-label">Status<select data-field="status" data-scope="hallbooth" aria-label="Booth status">${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${chosen.status === k ? "selected" : ""}>${e(v.label)}</option>`).join("")}</select></label><label class="setting-label">Exhibitor<input type="text" data-field="name" data-scope="hallbooth" aria-label="Exhibitor" maxlength="120" value="${e(chosen.name)}"/></label>${field("Price", "price", chosen.price || 0, ...HALL_LIMITS.price, 1, "$", "hallbooth", "Booth price")}<label class="setting-label">Note<input type="text" data-field="note" data-scope="hallbooth" aria-label="Booth note" maxlength="300" value="${e(chosen.note)}"/></label><div class="button-row">${btn("hall-mine", h.mine === hallSelected ? "Not my booth" : "This is my booth", "box")}${btn("hall-deselect", "Done", "check")}</div></section>`
      : `<p class="muted">Tap a booth on the map to set its exhibitor, status and price.</p>`;
    return `${btn("mode-show", "Open the show floor", "map", "primary wide")}<p class="muted">The show floor fills the viewport with this plan: drag booths of any size, walkways, walls, doors, tents and stages from a library, snap them together and space them.</p><section><h3>Map <span>${t.booths} booths</span></h3><div class="hall-map-wrap">${h.items ? showSVG(h) : hallSVG(h, { selected: hallSelected, interactive: true })}</div><p class="hall-totals">${t.sold} sold · ${t.held} held · ${t.open} open${t.soldValue ? ` · sold $${Math.round(t.soldValue).toLocaleString("en-US")}` : ""}${t.heldValue ? ` · held $${Math.round(t.heldValue).toLocaleString("en-US")}` : ""}</p></section>${editor}${h.items ? `<section><h3>Layout</h3><p class="muted">This plan is laid out piece by piece on the show floor, so rows and aisles are no longer typed here. Open the show floor to change it.</p></section>` : `<section><h3>Layout <span>inches</span></h3><div class="field-pair">${f("Rows", "rows")}${f("Booths per row", "perRow")}</div><div class="field-pair">${f("Booth width", "boothWidth", "in")}${f("Booth depth", "boothDepth", "in")}</div>${f("Aisle width", "aisle", "in")}<label class="check-field"><input type="checkbox" data-field="backToBack" data-scope="hallplan" ${h.backToBack ? "checked" : ""}/>Rows back to back, in pairs</label>${f("First booth number", "start")}${f("Default price", "price", "$")}<p class="muted">Up to ${MAX_HALL_BOOTHS} booths. Aisles under 10′ are tight for a crowd; many fire marshals ask for 10′ main aisles.</p></section>`}<section><h3>Share it</h3><div class="button-row">${btn("hall-map", "Download hall map", "download")}${btn("hall-csv", "Exhibitor list (CSV)", "download")}</div>${btn("hall-delete", "Delete the hall plan", "trash-2", "wide")}</section>`;
  }
  // ---- The show floor ------------------------------------------------------
  /** The selected pieces of the show floor, as stored. */
  const showPieces = () => {
    const ids = new Set(showEditor?.selection || []);
    return p.hall?.items ? p.hall.items.filter((i) => ids.has(i.id)) : [];
  };
  /** The drawing board's selection changed: follow it with the panel. */
  function showSelected(ids) {
    const one = ids.length === 1 ? p.hall.items?.find((i) => i.id === ids[0]) : null;
    hallSelected = one?.kind === "booth" ? one.number : null;
    renderInspector();
  }
  /**
   * Give booths new numbers, taking each one's exhibitor, status and price —
   * which `p.hall.booths` keeps by number — and "your booth" with it.
   */
  function renumberBooths(changes) {
    const h = p.hall;
    const byId = new Map(h.items.map((i) => [i.id, i]));
    const moved = changes.filter((c) => byId.get(c.id)?.number !== c.number);
    const records = {};
    let mine = h.mine;
    const moves = moved.map((c) => ({ from: byId.get(c.id).number, to: c.number }));
    for (const c of moved) {
      const it = byId.get(c.id);
      if (h.booths[it.number]) records[c.number] = h.booths[it.number];
      if (h.mine === it.number) mine = c.number;
    }
    for (const c of moved) delete h.booths[byId.get(c.id).number];
    for (const c of moved) byId.get(c.id).number = c.number;
    Object.assign(h.booths, records);
    if (mine === undefined) delete h.mine;
    else h.mine = mine;
    // A linked design is kept by number too, and follows its booth.
    renumberDesigns(h, moves);
  }
  function showRotate(deg) {
    const ids = new Set(showEditor?.selection || []);
    if (!ids.size) return;
    mutate(() => {
      for (const it of p.hall.items) if (ids.has(it.id)) {
        const r = ((it.rot || 0) + deg) % 360;
        if (r) it.rot = r;
        else delete it.rot;
      }
    });
  }
  /**
   * Flip the selection as a mirror would: left for right ("x") or front for
   * back ("y"), about the middle of the selection, each piece's turn
   * mirrored with it (`mirrorPieces`). One undo step; the selection stays.
   */
  function showMirror(axis) {
    const moved = mirrorPieces(showPieces(), axis);
    if (!moved.length) return;
    const by = new Map(moved.map((m) => [m.id, m]));
    mutate(() => {
      for (const it of p.hall.items) {
        const m = by.get(it.id);
        if (!m) continue;
        it.x = m.x;
        it.y = m.y;
        if (m.rot) it.rot = m.rot;
        else delete it.rot;
      }
    });
  }
  /** Copies of the selection laid right beside it, selected. */
  function showDuplicate() {
    const pieces = showPieces();
    if (!pieces.length) return;
    const box = boundsOf(pieces);
    let ids = [];
    mutate(() => {
      const copies = copyPieces(p.hall.items, pieces, box.r - box.l, 0, p.hall.start);
      p.hall.items.push(...copies);
      ids = copies.map((c) => c.id);
    });
    showEditor.select(ids);
  }
  function showDelete() {
    const pieces = showPieces();
    if (!pieces.length) return;
    const ids = new Set(pieces.map((i) => i.id));
    const numbers = pieces.filter((i) => i.kind === "booth").map((i) => i.number);
    const effect = deleteEffect(p.hall, numbers);
    if (effect.refuse) return toast(`Booth ${liveNumber(p.hall)} holds the design you are editing, and your own booth's design is parked, so there is nowhere to keep this one. Open another booth first.`, true);
    mutate(() => {
      const live = liveNumber(p.hall);
      for (const it of pieces) if (it.kind === "booth") {
        delete p.hall.booths[it.number];
        if (p.hall.mine === it.number) delete p.hall.mine;
        if (p.hall.designs) delete p.hall.designs[it.number];
      }
      if (p.hall.designs && !Object.keys(p.hall.designs).length) delete p.hall.designs;
      // The design being edited loses its booth and becomes your own booth's.
      if (effect.orphan) setOpen(p.hall, OWN);
      else if (live !== undefined) setOpen(p.hall, live);
      p.hall.items = p.hall.items.filter((i) => !ids.has(i.id));
    });
    if (effect.drop.length) toast(`The linked design${effect.drop.length === 1 ? "" : "s"} of booth ${effect.drop.join(", ")} went with ${effect.drop.length === 1 ? "it" : "them"}. Undo brings ${effect.drop.length === 1 ? "it" : "them"} back.`);
    hallSelected = null;
    showEditor.select([]);
    toast(`${pieces.length} piece${pieces.length === 1 ? "" : "s"} deleted. Undo brings ${pieces.length === 1 ? "it" : "them"} back.`);
  }
  /**
   * Start the floor again from a saved template (show.js FLOOR_TEMPLATES):
   * its size and pieces replace the floor's. Sales, "my booth" and linked
   * designs are kept by booth number, so a booth that exists in both keeps
   * everything; undo brings the old floor back whole.
   */
  function applyTemplate(key) {
    const t = FLOOR_TEMPLATES[key];
    if (!t || !p.hall) return;
    startFrom(t.label, (h) => t.build(h.start));
  }
  function startFrom(label, build) {
    const t = { label };
    confirmAction(`Start from “${t.label}”?`, "Every piece on the floor, and its size, is replaced by the template's. Sales, your booth and linked designs stay with their booth numbers. Undo brings this floor back.", () => {
      const h = toFloor(p.hall);
      const built = build(h);
      mutate(() => {
        h.items = built.items;
        h.venue = built.venue;
      });
      showEditor?.select([]);
      if (!show3d) showEditor?.fit();
      const booths = built.items.filter((i) => i.kind === "booth");
      toast(`“${t.label}”: ${booths.length} booths${booths.length ? `, numbered from ${Math.min(...booths.map((b) => b.number))}` : ""}.`);
    });
  }
  /** Line the selection up on its top or left edge. */
  function showAlign(edge) {
    const pieces = showPieces();
    if (pieces.length < 2) return toast("Select two or more pieces to line them up.");
    const box = boundsOf(pieces);
    mutate(() => {
      for (const it of pieces) {
        const b = boundsOf([it]);
        if (edge === "t") it.y += box.t - b.t;
        else it.x += box.l - b.l;
      }
    });
  }
  /** A key on the show floor: true when it did something. */
  /** Keys while the show is in 3D: walk (W, then WASD / arrows), Esc, undo. */
  function show3dKey(ev) {
    const mod = ev.ctrlKey || ev.metaKey;
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (mod && k === "z") return actions[ev.shiftKey ? "redo" : "undo"](), true;
    if (mod || ev.altKey) return false;
    if (walking) {
      const move = { w: [1, 0], ArrowUp: [1, 0], s: [-1, 0], ArrowDown: [-1, 0], a: [0, -1], ArrowLeft: [0, -1], d: [0, 1], ArrowRight: [0, 1] }[k];
      if (move) return scene.walk(move[0], move[1], ev.shiftKey ? STRIDE : STEP), true;
      if (k === "Escape") return setWalking(false), true;
      return false;
    }
    if (k === "w") return setWalking(true), true;
    if (k === "h") return setPanTool(!panTool), true;
    if (k === "Escape") return setShow3d(false), true;
    return false;
  }
  function showFloorKey(ev) {
    const mod = ev.ctrlKey || ev.metaKey;
    const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (mod && key === "z") return actions[ev.shiftKey ? "redo" : "undo"](), true;
    if (mod && key === "y") return actions.redo(), true;
    if (mod && key === "d") return showDuplicate(), true;
    if (mod && key === "a") return showEditor.select(p.hall.items.map((i) => i.id)), true;
    if (mod && key === "c") return (showClipboard = showPieces().map((i) => ({ ...i }))), true;
    if (mod && key === "v") {
      if (!showClipboard?.length) return false;
      let ids = [];
      mutate(() => {
        const copies = copyPieces(p.hall.items, showClipboard, showGrid || 12, showGrid || 12, p.hall.start);
        p.hall.items.push(...copies);
        ids = copies.map((c) => c.id);
      });
      showClipboard = showClipboard.map((i) => ({ ...i, x: i.x + (showGrid || 12), y: i.y + (showGrid || 12) }));
      showEditor.select(ids);
      return true;
    }
    if (mod || ev.altKey) return false;
    if (key === "Delete" || key === "Backspace") return showDelete(), true;
    if (key === "Escape") return showEditor.select([]), true;
    if (key === "r") return showRotate(ev.shiftKey ? 270 : 90), true;
    if (key === "h") return setPanTool(!panTool), true;
    if (key === "0") return showEditor.fit(), true;
    if (key === "+" || key === "=") return showEditor.zoom(1.25), true;
    if (key === "-") return showEditor.zoom(1 / 1.25), true;
    const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[key];
    if (arrow) {
      const ids = new Set(showEditor.selection);
      if (!ids.size) return false;
      const step = (showGrid || 1) * (ev.shiftKey ? 10 : 1);
      mutate(() => {
        for (const it of p.hall.items) if (ids.has(it.id)) (it.x += arrow[0] * step), (it.y += arrow[1] * step);
      });
      return true;
    }
    return false;
  }
  /**
   * A control of the show floor's panel changed: the selected piece, the
   * floor, the snap grid, the gap or the "Add booths" settings. True when it
   * was one of them.
   */
  function showChange(el) {
    const ds = el.dataset || {};
    const n = Number(el.value);
    const clamp = (v) => Math.min(Number(el.max || Infinity), Math.max(Number(el.min || -Infinity), v));
    if (el.id === "show-grid") {
      showGrid = n;
      return true;
    }
    if (el.id === "show-gap") {
      showGap = Number.isFinite(n) ? clamp(n) : 0;
      return true;
    }
    if (ds.showBlock) {
      const k = ds.showBlock;
      if (k === "backToBack") showBlock.backToBack = el.checked;
      else if (k === "style") showBlock.style = el.value;
      else if (Number.isFinite(n)) showBlock[k] = clamp(Math.round(n));
      renderInspector();
      return true;
    }
    if (ds.showVenue) {
      mutate(() => {
        const h = toFloor(p.hall);
        if (ds.showVenue === "kind") h.venue.kind = el.value;
        else if (ds.showVenue === "drape") {
          if (DRAPES[el.value]) h.venue.drape = el.value;
        }
        else if (Number.isFinite(n)) h.venue[ds.showVenue] = Math.round(clamp(n) * 12);
      });
      return true;
    }
    if (ds.showField) {
      const it = showPieces()[0];
      if (!it) return true;
      const k = ds.showField;
      if (k === "number") {
        const v = Math.round(clamp(n));
        if (!Number.isFinite(v) || v === it.number) return renderInspector(), true;
        if (p.hall.items.some((i) => i.kind === "booth" && i.number === v)) {
          toast(`Booth ${v} is already on the floor.`, true);
          renderInspector();
          return true;
        }
        mutate(() => renumberBooths([{ id: it.id, number: v }]));
        hallSelected = v;
        return true;
      }
      mutate(() => {
        if (k === "style") {
          if (el.value === "pipe") delete it.style;
          else it.style = el.value;
        } else if (k === "text") {
          if (el.value.trim()) it.text = el.value.trim().slice(0, 120);
          else delete it.text;
        } else if (Number.isFinite(n)) {
          const v = clamp(n);
          if (k === "rot") {
            const r = ((Math.round(v) % 360) + 360) % 360;
            if (r) it.rot = r;
            else delete it.rot;
          } else it[k] = Math.round(v * 10) / 10;
        }
      });
      return true;
    }
    return false;
  }
  /** The shape library, in the left sidebar while the show floor is open. */
  function showLibraryHTML() {
    const swatch = (sh) => {
      const k = KINDS[sh.kind];
      const w = sh.w ?? k.w;
      const d = sh.d ?? k.d;
      const s = 34 / Math.max(w, d);
      const rw = Math.max(3, w * s);
      const rd = Math.max(3, d * s);
      return `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="${20 - rw / 2}" y="${20 - rd / 2}" width="${rw}" height="${rd}" rx="${sh.kind === "column" ? rw / 2 : 1}" fill="${k.fill === "none" ? "#fff" : k.fill}" stroke="${k.line === "none" ? "#9aa3ad" : k.line}"/>${sh.style === "tent" ? `<path d="M${20 - rw / 2} ${20 - rd / 2}L${20 + rw / 2} ${20 + rd / 2}M${20 + rw / 2} ${20 - rd / 2}L${20 - rw / 2} ${20 + rd / 2}" stroke="#aab3bd"/>` : ""}${sh.kind === "label" ? '<text x="20" y="25" font-size="13" text-anchor="middle" fill="#1d232b">Aa</text>' : ""}</svg>`;
    };
    const groups = [["Booths", SHAPES.filter((sh) => sh.kind === "booth")], ["Floor", SHAPES.filter((sh) => ["aisle", "pavilion", "wall", "door", "column"].includes(sh.kind))], ["Features", SHAPES.filter((sh) => ["stage", "table", "desk", "food", "restroom", "label"].includes(sh.kind))]];
    return `<div class="panel-heading"><h2>Shapes</h2>${icon("shapes")}</div><p class="muted show-lib-note">Drag a shape onto the floor, or tap it to drop it in the middle.</p>${groups.map(([name, list]) => `<section class="show-lib"><h3>${name}</h3><div class="show-shapes">${list.map((sh) => `<button class="show-shape" data-show-shape="${sh.key}" title="${e(sh.label || KINDS[sh.kind].label)}">${swatch(sh)}<span>${e(sh.label || KINDS[sh.kind].label)}</span></button>`).join("")}</div></section>`).join("")}`;
  }
  /** The inspector while the show floor is open. */
  /**
   * A selected floor booth's own design: open it in the booth editor, as a
   * new design sized from the piece or the one it already has.
   */
  /** The designs linked to floor booths, and the way back to your own. */
  function linkedHTML() {
    const h = p.hall;
    const numbers = Object.keys(h.designs || {}).map(Number).filter((n) => n !== OWN).sort((a, b) => a - b);
    const live = liveNumber(h);
    if (!numbers.length && live === undefined && !h.designs?.[OWN]) return "";
    return `<section><h3>Booth designs <span>${numbers.length + (live !== undefined ? 1 : 0)} linked</span></h3><p class="muted">${live !== undefined ? `Booth ${live} is open in the booth editor.` : "The booth editor holds your own booth, on no booth of this floor."}${numbers.length ? ` Also linked: ${numbers.map((n) => "booth " + n).join(", ")} — select one and open it.` : ""}</p>${h.designs?.[OWN] ? `${btn("show-open-own", "Open my own booth", "door-open", "wide")}<p class="muted">The design that was open before any floor booth was, kept on no booth.</p>` : ""}</section>`;
  }
  function designHTML(it) {
    const h = p.hall;
    const live = liveNumber(h) === it.number;
    const parked = !!h.designs?.[it.number];
    const count = Object.keys(h.designs || {}).length;
    const note = live
      ? "This booth's design is the one open in the booth editor."
      : parked
      ? "This booth has its own design, kept with it. Opening it parks the one open now with its booth."
      : `Opens this booth in the booth editor as a new design, ${feet(Math.min(360, Math.max(48, it.w)))} × ${feet(Math.min(360, Math.max(48, it.d)))} and built as it is on the floor. The one open now is kept with its booth.`;
    return `<section class="show-design"><h3>Design${live ? ' <span class="badge">Open</span>' : parked ? ' <span class="badge">Linked</span>' : ""}</h3>${btn("show-open-booth", live ? "Edit this booth" : parked ? "Open this booth's design" : "Open this booth", "door-open", "primary wide")}<p class="muted">${note}${!live && !parked && count >= MAX_DESIGNS ? ` ${MAX_DESIGNS} linked designs is the limit.` : ""}</p>${btn("import-design", "Import a booth design", "upload", "wide")}<p class="muted">An exhibitor's own design, from the file their Export tab downloads (Send to the show → Download it as a file instead) — or drop that file straight on a booth on the floor. A link they send opens straight onto the floor. It lands on this booth${live || parked ? ", replacing the design it has" : ""}.</p></section>`;
  }
  /**
   * The show in 3D: walk it, have a walkthrough made from its aisles, edit
   * that as a timeline and export it — the booth's own tools, pointed at the
   * floor.
   */
  function show3dPanel() {
    const h = p.hall;
    const booths = showItems(h).filter((i) => i.kind === "booth").length;
    const home = h.open ?? h.mine;
    return `<div class="button-row">${btn("show-3d", "Back to the plan", "map")}${btn("show-exit", "Back to my booth", "arrow-left")}</div><section class="show-3d"><h3>The show in 3D <span>${booths} booths</span></h3><p class="muted">${Number.isInteger(home) && showItems(h).some((i) => i.number === home) ? `Booth ${home} is drawn as your full design; every other booth is its floor, its drape, walls or tent, and its number.` : "Every booth is drawn light — its floor, its drape, walls or tent, and its number. Mark one “This is my booth” in the plan to see your own design standing in it."} Numbers show for the booths nearest the camera.</p>${btn("show-walk", walking ? "Stop walking" : "Walk the show", "footprints", walking ? "primary wide" : "wide")}<p class="muted">From the entrance, at eye height: WASD or the arrows step, Shift strides, drag to look round.</p></section>${gated("video", `<section><h3>Walkthrough video</h3>${btn("show-walkthrough", "Make a walkthrough", "route", "primary wide")}<p class="muted">Lays a camera path down the aisles from the entrance — walkway pieces if the floor has them, otherwise the gaps between rows — as keyframes in the timeline, at a visitor's pace. Play it, move any keyframe, then Export MP4.</p>${btn("edit-timeline", "Edit timeline…", "sliders-horizontal", "wide")}</section>`, "Walkthrough videos of the show are made with the camera timeline. Part of Booth Studio Pro.")}<section><h3>Stills</h3>${btn("export-image", "Export PNG", "download", "wide")}<p class="muted">The view as it is, at the size set in Export.</p>${btn("ai-pack", "Download AI render pack", "sparkles", "wide")}<p class="muted">This view, its depth, a mask of every surface and the show described in words — for repainting with an image model. No model is called.</p></section>`;
  }
  function showFloorPanel() {
    if (show3d) return show3dPanel();
    const h = p.hall;
    const f = floorOf(h);
    const pieces = showPieces();
    const t = hallTotals(h);
    const num = (label, key, value, min, max, step, unit, attr) => `<label class="field"><span>${label}</span><div><input type="number" ${attr}="${key}" aria-label="${e(label)}" value="${Number(Number(value).toFixed(2))}" min="${min}" max="${max}" step="${step}"/><small>${unit}</small></div></label>`;
    const pf = (label, key, value, min, max, step = 1, unit = "in") => num(label, key, value, min, max, step, unit, "data-show-field");
    let selectedHTML = `<p class="muted">Tap a piece to select it; drag it to move it. Shift-click, drag a box round several on empty floor, or right-drag a box anywhere. ${PAN_KEY} right-drag, Space-drag, the Pan tool (H) or a finger on empty floor pans; scroll or pinch to zoom.</p>`;
    if (pieces.length === 1) {
      const it = pieces[0];
      const k = KINDS[it.kind];
      const rec = it.kind === "booth" ? boothOf(h, it.number) : null;
      selectedHTML = `<section class="show-piece"><h3>${it.kind === "booth" ? `Booth ${it.number}${h.mine === it.number ? ' <span class="badge">Yours</span>' : ""}` : e(k.label)} <span>${feet(it.w)} × ${feet(it.d)}</span></h3><div class="field-pair">${pf("Width", "w", it.w, 6, 12000)}${pf("Depth", "d", it.d, 6, 12000)}</div><div class="field-pair">${pf("Across", "x", it.x, -24000, 48000)}${pf("From back", "y", it.y, -24000, 48000)}</div>${pf("Turn", "rot", it.rot || 0, 0, 359, 15, "°")}${it.kind === "booth" ? `${pf("Booth number", "number", it.number, 1, 99999, 1, "#")}<label class="setting-label">Built as<select data-show-field="style" aria-label="Booth built as">${Object.entries(BOOTH_STYLES).map(([key, v]) => `<option value="${key}" ${(it.style || "pipe") === key ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label>` : `<label class="setting-label">Text<input type="text" data-show-field="text" aria-label="Piece text" maxlength="120" value="${e(it.text || "")}" placeholder="${e(k.label)}"/></label>`}<div class="button-row">${btn("show-rotate", "Turn 90°", "rotate-cw")}${btn("show-duplicate", "Duplicate", "copy")}${btn("show-delete", "Delete", "trash-2")}</div><div class="button-row">${btn("show-flip-x", "Flip horizontal", "flip-horizontal-2")}${btn("show-flip-y", "Flip vertical", "flip-vertical-2")}</div></section>${rec ? `<section class="hall-booth"><h3>Sale</h3><label class="setting-label">Status<select data-field="status" data-scope="hallbooth" aria-label="Booth status">${Object.entries(STATUSES).map(([key, v]) => `<option value="${key}" ${rec.status === key ? "selected" : ""}>${e(v.label)}</option>`).join("")}</select></label><label class="setting-label">Exhibitor<input type="text" data-field="name" data-scope="hallbooth" aria-label="Exhibitor" maxlength="120" value="${e(rec.name)}"/></label>${field("Price", "price", rec.price || 0, ...HALL_LIMITS.price, 1, "$", "hallbooth", "Booth price")}<label class="setting-label">Note<input type="text" data-field="note" data-scope="hallbooth" aria-label="Booth note" maxlength="300" value="${e(rec.note)}"/></label>${btn("hall-mine", h.mine === it.number ? "Not my booth" : "This is my booth", "box", "wide")}</section>${designHTML(it)}` : ""}`;
    } else if (pieces.length > 1) {
      selectedHTML = `<section class="show-piece"><h3>${pieces.length} selected <span>${pieces.filter((i) => i.kind === "booth").length} booths</span></h3><div class="button-row">${btn("show-rotate", "Turn 90°", "rotate-cw")}${btn("show-duplicate", "Duplicate", "copy")}${btn("show-delete", "Delete", "trash-2")}</div><div class="button-row">${btn("show-flip-x", "Flip horizontal", "flip-horizontal-2")}${btn("show-flip-y", "Flip vertical", "flip-vertical-2")}</div><div class="button-row">${btn("show-align-top", "Line up tops", "align-start-horizontal")}${btn("show-align-left", "Line up lefts", "align-start-vertical")}</div>${num("Gap between", "show-gap", showGap, 0, 2400, 1, "in", "id")}${btn("show-space", "Space them evenly", "columns-2", "wide")}<p class="muted">Lays them side by side along the way they run, this far apart, the first staying put. A gap of 0 butts them together; a single booth can then be dragged to break the rhythm.</p>${btn("show-renumber", "Renumber these", "list-ordered", "wide")}${btn("show-deselect", "Done", "check", "wide")}</section>`;
    }
    const b = showBlock;
    const bf = (label, key, min, max, step = 1, unit = "in") => num(label, key, b[key], min, max, step, unit, "data-show-block");
    return `<div class="button-row">${btn("show-exit", "Back to my booth", "arrow-left")}${btn("show-fit", "Fit floor", "maximize")}</div>${btn("show-3d", "See it in 3D", "box", "primary wide")}${selectedHTML}<div class="mobile-library">${showLibraryHTML()}</div><section><h3>Add booths</h3><div class="field-pair">${bf("How many", "count", 1, 400, 1, "")}${bf("Per row", "perRow", 1, 60, 1, "")}</div><div class="field-pair">${bf("Booth width", "w", 48, 480)}${bf("Booth depth", "d", 48, 480)}</div><div class="field-pair">${bf("Gap in a row", "gap", 0, 480)}${bf("Aisle", "aisle", 36, 480)}</div><label class="check-field"><input type="checkbox" data-show-block="backToBack" ${b.backToBack ? "checked" : ""}/>Rows back to back, in pairs</label><label class="setting-label">Built as<select data-show-block="style" aria-label="New booths built as">${Object.entries(BOOTH_STYLES).map(([key, v]) => `<option value="${key}" ${b.style === key ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label>${btn("show-add-block", "Add booths", "plus", "primary wide")}<p class="muted">Numbered on from the highest booth on the floor, placed below everything already on the floor and selected, ready to drag.</p></section><section><h3>Floor</h3><label class="setting-label">Venue<select data-show-venue="kind" aria-label="Show venue">${Object.entries(SHOW_VENUES).map(([key, v]) => `<option value="${key}" ${f.kind === key ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label><label class="setting-label">Drape colour<select data-show-venue="drape" aria-label="Drape colour">${Object.entries(DRAPES).map(([c, v]) => `<option value="${c}" ${(h.venue?.drape || DEFAULT_DRAPE) === c ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label><div class="field-pair">${num("Floor width", "width", f.width / 12, 10, 2000, 1, "ft", "data-show-venue")}${num("Floor depth", "depth", f.depth / 12, 10, 2000, 1, "ft", "data-show-venue")}</div><label class="setting-label">Snap grid<select id="show-grid" aria-label="Snap grid">${[[0, "Off"], [1, "1″"], [6, "6″"], [12, "1′"], [24, "2′"], [60, "5′"]].map(([v, l]) => `<option value="${v}" ${showGrid === v ? "selected" : ""}>${l}</option>`).join("")}</select></label><p class="muted">Pieces snap to each other's edges first, then to this grid. Hold Alt while dragging to place freely. Drape colour is the pipe and drape's in See it in 3D.</p>${(() => {
      const off = offFloor(h).length;
      return off ? `<div class="warning">${off} piece${off === 1 ? " lies" : "s lie"} off the floor's edge, and stand${off === 1 ? "s" : ""} outside the hall in 3D.${btn("show-grow", "Grow the floor to fit", "maximize", "wide")}</div>` : "";
    })()}${btn("show-renumber", "Renumber every booth", "list-ordered", "wide")}</section><section><h3>Start from a template</h3>${Object.entries(FLOOR_TEMPLATES).map(([key, t]) => `${btn("show-template-" + key, t.label, "layout-template", "wide")}<p class="muted">${e(t.note)}</p>`).join("")}${readFloorTemplates().map((t) => `<div class="button-row">${btn("show-mytemplate-" + t.id, "Mine · " + t.label, "layout-template")}${btn("show-forget-template-" + t.id, "Remove", "trash-2")}</div><p class="muted">${t.items.filter((i) => i.kind === "booth").length} booths, ${Math.round(t.venue.width / 12)}′ × ${Math.round(t.venue.depth / 12)}′, saved on this browser.</p>`).join("")}${btn("show-save-template", "Save this floor as a template", "save", "wide")}<p class="muted">Its size and every piece, booth numbers and all — not the sales, your booth or its designs. Kept on this browser, up to ${MAX_FLOOR_TEMPLATES}.</p></section>${linkedHTML()}<section><h3>Sales <span>${t.booths} booths</span></h3><p class="hall-totals">${t.sold} sold · ${t.held} held · ${t.open} open${t.soldValue ? ` · sold $${Math.round(t.soldValue).toLocaleString("en-US")}` : ""}${t.heldValue ? ` · held $${Math.round(t.heldValue).toLocaleString("en-US")}` : ""}</p>${field("Default price", "price", h.price, ...HALL_LIMITS.price, 1, "$", "hallplan", "Hall Default price")}<div class="button-row">${btn("hall-map", "Download hall map", "download")}${btn("hall-csv", "Exhibitor list (CSV)", "download")}</div>${btn("hall-delete", "Delete the hall plan", "trash-2", "wide")}</section><section><h3>Keys</h3><p class="muted">Delete removes · Ctrl+D duplicates · R turns 90° · arrows nudge by the grid (Shift: 10×) · Ctrl+A selects all · Esc lets go · 0 fits the floor.</p></section>`;
  }
  /**
   * Export → AI render (the hook, src/ai-render.js): the frame, its depth
   * pass, its surface mask and the scene in words, as one file for an image
   * model to repaint. No model is called — local-first — until the owner
   * chooses a provider.
   */
  function aiSection() {
    const legend = Object.values(SURFACES).map((x) => `<span class="ai-swatch"><i style="background:${x.color}"></i>${e(x.label)}</span>`).join("");
    return `<section class="ai-render"><h3>AI render</h3><p class="muted">For repainting this view with an image model: the frame as rendered, its depth (near white, far black), a mask with every surface one flat colour, and the artwork and signs alone on transparent — laid back over whatever a model returns, so it never repaints the work. All lined up pixel for pixel, with the scene described in words, in one .json file. The frame is the one set above.</p><div class="ai-legend">${legend}</div><label class="setting-label">Size<select id="ai-size" aria-label="AI render pack size">${PACK_SIZES.map((n) => `<option value="${n}" ${aiLong === n ? "selected" : ""}>${n} px on the long side</option>`).join("")}</select></label>${btn("ai-pack", "Download AI render pack", "sparkles", "wide")}${btn("ai-render", aiProvider ? `Render with ${aiProvider.name}` : "Render with AI", "sparkles", "wide")}<p class="muted">${aiProvider ? "" : "No AI provider is set up yet — nothing leaves this device. The pack works with any model that takes an image, a depth map or a mask."}</p></section>`;
  }
  /** The three passes of this view and the pack made from them. */
  async function makeAiPack() {
    if (!scene) throw new Error("3D is not available, so there is no view to render.");
    aiLong = Number(document.querySelector("#ai-size")?.value) || aiLong;
    const passes = await scene.renderPasses(aiLong, { frame: exportFrame, custom: customFrame, place: framePlace.export });
    // The protected pass: the frame's own pixels where the mask says artwork
    // or a sign, transparent elsewhere (AI_EXPORT_PHASE.md).
    const read = async (blob) => {
      const bmp = await createImageBitmap(blob);
      const c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      const g = c.getContext("2d");
      g.drawImage(bmp, 0, 0);
      return { c, g, data: g.getImageData(0, 0, c.width, c.height).data };
    };
    const beautyPx = await read(passes.beauty),
      maskPx = await read(passes.mask);
    beautyPx.g.putImageData(new ImageData(protectPass(beautyPx.data, maskPx.data), beautyPx.c.width, beautyPx.c.height), 0, 0);
    const protect = beautyPx.c.toDataURL("image/png");
    const url = (blob) => new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error("Could not read the rendered image."));
      r.readAsDataURL(blob);
    });
    const size = await createImageBitmap(passes.beauty);
    const pose = scene.pose();
    return renderPack({
      images: { beauty: await url(passes.beauty), depth: await url(passes.depth), mask: await url(passes.mask), protect },
      width: size.width,
      height: size.height,
      camera: { ...pose, fov: scene.camera.fov ?? null, projection: scene.camera.isPerspectiveCamera ? "perspective" : "orthographic", near: passes.depthRange?.near ?? null, far: passes.depthRange?.far ?? null },
      description: describeScene(p, show3d ? { show: p.hall, openNumber: liveNumber(p.hall) } : {}),
      project: p.name,
    });
  }
  /** Export → Power and rentals (Pro): the service desk's two forms. */
  function powerSection() {
    const totals = powerTotals(powerLines(p, { outlets: powerOutlets }));
    return `<section><h3>Power and rentals</h3><p class="muted">What to order from the show: <strong>${totals.watts} W · ${totals.amps} A · ${totals.circuits} circuit${totals.circuits === 1 ? "" : "s"}</strong> of 120 V / 15 A, worked out from the lights, screens and outlets in this booth (circuits loaded to ${CIRCUIT_WATTS} W), and every table, chair and riser on its floor with carpet for it.</p><label class="field"><span>General outlets</span><div><input type="number" id="power-outlets" min="0" max="20" step="1" value="${powerOutlets}" aria-label="General outlets"/><small>ea</small></div></label>${btn("power-sheet", "Download power and rentals sheet", "plug", "wide")}</section>`;
  }
  /**
   * Walls → 3D models (Pro): a .glb brought in from SketchUp, Blender or a
   * maker's own scan — a sculpture, a custom display — stood on the floor at
   * a typed height. Kept in the booth like an image, so a backup carries it.
   */
  function modelsSection() {
    const models = p.booth.models || [];
    const rows = models
      .map((m, i) => {
        const name = m.name || "Model " + (i + 1),
          scope = "model-" + m.id,
          f = (label, key, value, min, max, step, unit) => field(label, key, value, min, max, step, unit, scope, name + " " + label);
        return `<div class="wall-setting${isShown(m) ? "" : " is-hidden"}" data-model="${e(m.id)}"><div class="panel-heading"><h4>${e(name)}${isShown(m) ? "" : ' <span class="badge">Hidden</span>'}</h4><span class="piece-actions">${hideEye("model", m.id, name, isShown(m))}${btn("delete-model-" + m.id, "Remove " + name, "trash-2", "icon-only")}</span></div>${f("Height", "height", m.height, 1, 240, 0.5, "in")}<div class="field-pair">${f("Left / right", "x", m.x, -600, 600, 1, "in")}${f("Front / back", "z", m.z, -600, 600, 1, "in")}</div>${f("Rotation", "rotation", m.rotation, -360, 360, 5, "°")}</div>`;
      })
      .join("");
    return gated("glb", `<section><h3>3D models <span>${models.length} / ${MAX_MODELS}</span></h3><p class="muted">Bring in a .glb from SketchUp, Blender or a 3D scan — a sculpture, a custom display — and stand it on the floor. It is scaled to the height you type, so its own units do not matter. Saved in the booth and its backups.</p>${rows}${models.length < MAX_MODELS ? btn("upload-model", "Import .glb model", "upload", "wide") : `<p class="muted">${MAX_MODELS} models is the limit.</p>`}</section>`, "Bring in .glb models from SketchUp, Blender or a scan, and export the booth as .glb. Part of Booth Studio Pro.");
  }
  /**
   * Layout → Floor plan underlay (Pro): the venue's plan, as an image, laid
   * on the floor at its real width so the booth can be placed on it. Scaled
   * by measuring a known distance on it with the tape and typing what it
   * really is — two clicks and a number.
   */
  function underlaySection() {
    const u = p.booth.underlay;
    const tape = scene?.measure.points.length === 2 ? distanceInches(...scene.measure.points, 0.0254) : null;
    const body = !u
      ? `<p class="muted">Put the show's floor plan under your booth: a JPG or PNG of it (a screenshot of a PDF plan is fine). It lies on the floor, half see-through, and never reaches an export.</p>${btn("upload-underlay", "Add floor plan image", "map", "wide")}`
      : `<label class="check-field"><input type="checkbox" data-field="on" data-scope="underlay" ${u.on === false ? "" : "checked"}/>Show the floor plan</label>${range("Opacity", "opacity", u.opacity, 0.1, 1, 0.05, "underlay")}${field("Real width of the image", "width", u.width, 12, 24000, 1, "in", "underlay")}<div class="field-pair">${field("Left / right", "x", u.x, -24000, 24000, 1, "in", "underlay")}${field("Front / back", "z", u.z, -24000, 24000, 1, "in", "underlay")}</div>${field("Rotation", "rotation", u.rotation, -360, 360, 1, "°", "underlay")}<h4>Scale it from the tape</h4><p class="muted">${tape ? `The tape reads <strong>${e(formatLength(tape))}</strong>. Type what that distance really is on the plan — a booth's width, an aisle — and the plan is scaled to match.` : "Switch to Plan view, pick up the tape (T) and measure something on the plan whose real length you know: a booth's width, an aisle, a scale bar."}</p><div class="field-pair"><label class="field"><span>Real length</span><div><input type="number" id="underlay-real" min="1" max="24000" step="0.25" aria-label="Real length of the taped distance" value="120"/><small>in</small></div></label>${btn("underlay-scale", "Scale plan", "ruler", tape ? "primary" : "disabled")}</div>${btn("remove-underlay", "Remove floor plan", "trash-2", "wide")}`;
    return gated("underlay", `<section><h3>Floor plan underlay</h3>${body}</section>`, "Lay the venue's floor plan under your booth at its real scale, set by two clicks with the tape. Part of Booth Studio Pro.");
  }
  /**
   * Layout → Clearance checks (Pro): the booth read as a fire marshal and a
   * visitor in a wheelchair would read it. Problems first, then tight gaps;
   * the gaps are drawn in red in Plan view.
   */
  function clearanceSection() {
    const issues = checkClearance(p);
    const rows = issues
      .map((x, i) => `<li class="clearance-${x.level}"><span>${e(x.text)}</span>${x.ids.some((id) => id.startsWith("pedestal:") || id.startsWith("panel:") || id.startsWith("art:")) ? btn("clearance-show-" + i, "Show", "camera", "compact") : ""}</li>`)
      .join("");
    return gated("clearance", `<section><h3>Clearance checks <span>${issues.length ? issues.length + " to look at" : "all clear"}</span></h3><p class="muted">Floor pieces standing in each other or outside the booth, works hung over each other, and gaps narrower than the ${ACCESSIBLE}″ a wheelchair needs. Plan view draws the tight gaps in red. Pieces pushed right up against something are taken as meant.</p>${issues.length ? `<ul class="clearance-list">${rows}</ul>` : `<p class="ok-note">Nothing is in the way.</p>`}</section>`, "Warnings for pieces standing in each other or outside the booth, and gaps too narrow for a wheelchair. Part of Booth Studio Pro.");
  }
  /** Pro's clearance issues, for the plan view's red lines; none in Lite. */
  function syncClearance() {
    if (!scene) return;
    scene.clearance = allowed("clearance") && p.mode === "3d" ? checkClearance(p) : [];
    scene.refreshGuides();
  }
  /** The View menu under the booth: the saved views, when there are any. */
  function syncSavedViews() {
    const pick = document.querySelector(".saved-view-pick");
    const select = document.querySelector("#saved-view");
    const views = p.mode === "3d" ? p.views || [] : [];
    if (!pick || !select) return;
    pick.hidden = !views.length;
    select.innerHTML = `<option value="">Saved views…</option>${views.map((v) => `<option value="${e(v.id)}">${e(v.name)}</option>`).join("")}`;
  }
  /** Select what a clearance warning is about and look at it from above. */
  function showClearance(index) {
    const issue = checkClearance(p)[index];
    if (!issue) return;
    const id = issue.ids.find((x) => x.startsWith("pedestal:") || x.startsWith("panel:") || x.startsWith("art:"));
    if (!id) return;
    if (id.startsWith("art:")) {
      selected = id.slice(4);
      selectedPanel = selectedPedestal = null;
      scene?.focusWall(p.art.find((a) => a.id === selected)?.wall || "back");
    } else {
      if (id.startsWith("pedestal:")) { selectedPedestal = id.slice(9); selectedPanel = null; }
      else { selectedPanel = id; selectedPedestal = null; }
      scene?.setView("plan");
      document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === "plan"));
    }
    renderSelection();
  }
  function goToView(id) {
    const v = (p.views || []).find((x) => x.id === id);
    if (!v || !scene) return;
    if (walking) setWalking(false);
    scene.setView("perspective");
    scene.applyPose(v);
    document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === "perspective"));
  }
  /** The Box tool on or off: the next press-and-drag on the floor draws one. */
  function setDrawingBox(on) {
    if (!scene || p.mode !== "3d") return;
    if (on && walking) setWalking(false);
    if (on && scene.measure.on) setMeasuring(false);
    if (on && panTool) setPanTool(false);
    scene.setDrawingBox(!!on);
    document.querySelector("#scene").classList.toggle("placing", !!on);
    renderStatus();
    syncTools();
  }
  /**
   * The show floor in 3D, or back to its plan. The booth's viewport draws the
   * floor (scene.js `setShow`); walk mode, the timeline and both exports then
   * work on it as they do on a booth. The timeline is swapped for the one
   * this space had, and a timeline dialog left open is closed, because its
   * keys are poses in the other space.
   */
  function setShow3d(on) {
    on = !!on;
    if (on === show3d) return;
    if (on && (!scene || !p.hall)) return toast("3D is not available on this device, so the show cannot be walked. The plan still works.", true);
    if (walking) setWalking(false);
    if (document.querySelector("#timeline-dialog")?.open) actions["close-timeline"]();
    [videoTimeline, otherTimeline] = [otherTimeline, videoTimeline];
    tlSelected = null;
    tlPlayhead = 0;
    tlBeforeAuto = null;
    show3d = on;
    // The 3D show is drawn by the 3D booth's viewport, so a floor opened from
    // Photo mode switches it over. Not an edit: nothing about the booth moved.
    if (on && p.mode !== "3d") p.mode = "3d";
    render();
    document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === "perspective"));
  }
  /** Walk mode on or off, with its pad on screen and its hint in the status bar. */
  let walking = false;
  function setWalking(on) {
    if (!scene || p.mode !== "3d") return;
    walking = !!on;
    if (walking) {
      if (scene.measure.on) setMeasuring(false);
      scene.startWalk();
    } else scene.stopWalk();
    document.querySelector(".walk-pad").hidden = !walking;
    document.querySelector("#scene").classList.toggle("walking", walking);
    document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", !walking && b.dataset.view === "perspective"));
    renderStatus();
    syncTools();
  }
  function peopleSection() {
    const people = p.booth.people || [];
    // Absent means shown: that is what every backup written before the switch
    // existed says, and it is what they all meant.
    const shown = p.booth.showPeople !== false;
    const rows = people
      .map((person, i) => {
        const label = personName(person.kind);
        const chosen = selectedPerson === person.id;
        return `<div class="person-row${isShown(person) ? "" : " is-hidden"}${chosen ? " selected" : ""}" data-person="${person.id}"><div class="key-head"><strong>${label} ${i + 1}${chosen ? ' <span class="badge">Selected</span>' : ""}${isShown(person) ? "" : ' <span class="badge">Hidden</span>'}</strong><span class="piece-actions"><span class="muted">${Math.floor(person.height / 12)}′${Math.round(person.height % 12)}″</span>${hideEye("person", person.id, `${label} ${i + 1}`, isShown(person))}</span></div>${field("Height", "height", person.height, MIN_HEIGHT, MAX_HEIGHT, 1, "in", "person-" + person.id)}${personSlider(person, "height", "Height")}<div class="field-pair">${field("Left / right", "x", person.x, -600, 600, 1, "in", "person-" + person.id)}${field("Front / back", "z", person.z, -600, 600, 1, "in", "person-" + person.id)}</div>${personSlider(person, "x", "Left / right")}${personSlider(person, "z", "Front / back")}${field("Raised off the floor", "lift", person.lift ?? 0, MIN_LIFT, MAX_LIFT, LIFT_STEP, "in", "person-" + person.id)}${personSlider(person, "lift", "Raise / lower")}${field("Facing", "rotation", person.rotation ?? 0, -180, 180, 5, "°", "person-" + person.id)}<div class="button-row">${btn("delete-person", "Remove", "trash-2")}</div></div>`;
      })
      .join("");
    return `<section><h3>People for scale <span>${people.length} / ${MAX_PEOPLE}</span></h3><p class="muted">Stand-ins so the booth reads at human size. ${Object.values(PEOPLE).map((v) => e(v.label)).join(" · ")} by default, and every figure's height is editable. They are excluded from the hanging guide.</p>${people.length ? `<label class="check-field"><input type="checkbox" data-field="showPeople" data-scope="booth" ${shown ? "checked" : ""}/>Show the figures</label><p class="muted">${shown ? "Off takes every figure out of the picture and out of an export, and keeps where each one stands." : `Hidden. ${people.length} figure${people.length === 1 ? " is" : "s are"} still placed below and come back when this is switched on.`}</p>` : ""}${people.length < MAX_PEOPLE ? `<div class="button-row people-add">${btn("add-woman", "Add woman", "user-round")}${btn("add-man", "Add man", "user-round")}${btn("add-child", "Add child", "user-round")}${btn("add-pair", "Add pair", "user-round")}${btn("add-wheelchair", "Add wheelchair user", "user-round")}</div>` : `<p class="muted">${MAX_PEOPLE} figures is the limit.</p>`}${rows}</section>`;
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
          .join("")}</select></label>${btn("edit-timeline", "Edit timeline…", "sliders-horizontal", "wide")}<p class="muted">Opens your own keyframed move, and switches the camera move to Custom.</p>`;
    const describe = custom
      ? "Your own keyframes, in the order you set them. Compose a shot in the viewport, add it as a keyframe, and repeat — each one is the exact view you captured, not a gesture applied to the current framing."
      : `${e(move.describe)} The move starts and ends on the view you have now, so compose the shot first.`;
    return `<section><h3>Video</h3><label class="setting-label">Camera move<select id="video-move" aria-label="Camera move">${moveOptions}</select></label><p class="muted">${describe}</p>${lengthField}<label class="setting-label">Frame rate<select id="video-fps" aria-label="Frame rate">${FPS.map(
      (f) => `<option value="${f}" ${videoFps === f ? "selected" : ""}>${f} fps</option>`,
    ).join("")}</select></label><label class="setting-label">Resolution<select id="video-size" aria-label="Video resolution">${Object.entries(SIZES)
      .map(([k, v]) => `<option value="${k}" ${String(videoSize) === k ? "selected" : ""}>${e(v.label)}</option>`)
      .join("")}</select></label>${frameFields("video")}<label class="check-field"><input type="checkbox" data-video-settle ${videoSettle ? "checked" : ""}/>Careful rendering</label><p class="muted">${videoSettle ? "Each frame is drawn twice, the second time after the browser has caught up, so nothing is captured half-finished. It roughly doubles the render and it is what fixes glitches in an exported clip." : "Off: each frame is captured as soon as it is drawn. Faster, and the setting to turn back on if a clip comes out with a wall, a shadow or the backdrop from the frame before."}</p><p class="muted">MP4 · H.264 where this browser can encode it, which is what QuickTime Player and phones want. ${e(frameNote("video"))} Every frame is rendered in full before it is encoded, so the clip runs at the frame rate you chose however fast this machine is — which is why it takes longer than the clip lasts.</p>${videoCodecLine()}${busyPreview ? btn("stop-preview", "Stop preview", "x", "wide") : btn("preview-move", "Preview the move", "play", "wide")}<p class="muted">Plays the move in the viewport at its real length, without rendering anything. Judge it here first: a 14-second 1440p clip is minutes of encoding.</p>${btn("export-video", "Export MP4", "download", "primary wide")}${busyVideo ? btn("cancel-video", "Cancel", "x", "wide") : ""}<div class="video-progress" role="status" aria-live="polite">${busyVideo ? progressHTML() : ""}</div></section>`;
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
  // The frame's placement, routed. With the timeline open on a keyframed
  // frame, the clip's placement is the selected keyframe's — or, while
  // scrubbing or playing, the one sampled at the playhead — so the Video
  // tab's sliders, the timeline's and the guide's handles all edit that key.
  // Otherwise it is the Video tab's own, for the whole clip.
  const timelineOpen = () => !!document.querySelector("#timeline-dialog")?.open;
  const frameKeyed = () => videoMove === CUSTOM_MOVE && !!videoTimeline?.frameKeys && (timelineOpen() || busyPreview);
  const selectedKey = () => videoTimeline?.keys.find((k) => k.id === tlSelected) || videoTimeline?.keys[0];
  function selectedKeyName() {
    const tl = timeline();
    return keyName(Math.max(0, tl.keys.findIndex((k) => k.id === tlSelected)), tl.keys.length);
  }
  function getPlace(which) {
    if (which === "video" && frameKeyed()) return livePlace || selectedKey()?.place || framePlace.video;
    return framePlace[which];
  }
  function setPlace(which, place) {
    if (!(which === "video" && frameKeyed())) {
      framePlace[which] = place;
      return;
    }
    const id = selectedKey().id;
    videoTimeline = normalizeTimeline({ ...videoTimeline, keys: videoTimeline.keys.map((k) => (k.id === id ? { ...k, place } : k)) });
    livePlace = place;
    // Setting a keyframe's frame is looking at that keyframe: the camera and
    // the playhead go to it, so the frame is judged against its own shot.
    const i = videoTimeline.keys.findIndex((k) => k.id === id);
    const arrive = keySchedule(videoTimeline)[i].arrive;
    if (Math.abs(tlPlayhead - arrive) > 1e-3) {
      tlPlayhead = arrive;
      scene?.applyPose(videoTimeline.keys[i]);
    }
  }
  /** Once a frame edit lands: the panels redrawn, and a keyframe's picture retaken. */
  function placeSettled() {
    if (frameKeyed()) {
      const key = selectedKey();
      if (key) keyThumbs.set(key.id, grabThumb(key.place));
    }
    refreshPanels();
  }
  /** The playhead's frame, for the guide, while a keyframed clip is scrubbed or played. */
  function followPlayhead(tl, t) {
    livePlace = tl.frameKeys ? sampleTimeline(tl, t).place || null : null;
    if (tl.frameKeys) updateFrameGuide();
  }
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
  // The timeline dialog, drawn as a timeline: a track with a ruler, each
  // keyframe a diamond at the second the camera arrives there, holds as solid
  // blocks, every segment carrying a drawing of its ramp, the fades as
  // shading at the ends, and a playhead. Under the track, a strip of the
  // keyframes' own pictures. Asked for 2026-09-24 as "more visual, so I can
  // see the keyframes — easier to use, more intuitive". Drag a middle diamond
  // to retime it; drag anywhere else on the track to scrub the camera
  // through the move; click a picture to select that keyframe and see its
  // view. The selected keyframe's settings are the one card below the strip.
  //
  // View state only, like the timeline itself: thumbnails are pictures of
  // the viewport, held per key id and never saved.
  let tlSelected = null,
    tlPlayhead = 0;
  const keyThumbs = new Map();
  /** A small picture of what the viewport shows right now. */
  function grabThumb(place = getPlace("video")) {
    const src = scene?.renderer?.domElement;
    if (!src?.width) return null;
    // Cropped to the clip's frame, so a keyframe's picture is the shot the
    // file will have rather than the whole window around it.
    const aspect =
      videoFrameShape === "custom"
        ? customFrame.width / customFrame.height
        : FRAMES[videoFrameShape]?.aspect || src.width / src.height;
    const r = videoFrameShape === "view" ? guideRect(src.width, src.height, aspect) : placeRect(src.width, src.height, aspect, place);
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = Math.max(1, Math.round((160 * r.height) / r.width));
    c.getContext("2d").drawImage(src, r.x, r.y, r.width, r.height, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  }
  /**
   * A picture for every key that has none — a timeline carried over from a
   * batch, or one opened before any were taken. Each is the key's own view,
   * drawn once and read back; the camera goes back where it was afterwards.
   */
  function fillThumbs() {
    if (!scene || busyPreview || busyVideo) return;
    const missing = timeline().keys.filter((k) => !keyThumbs.has(k.id));
    if (!missing.length) return;
    const home = scene.pose();
    for (const k of missing) {
      scene.applyPose(k);
      keyThumbs.set(k.id, grabThumb(k.place || getPlace("video")));
    }
    scene.applyPose(home);
  }
  /** The track's contents, in percent of the clip: redrawn on its own while dragging. */
  function timelineTrackHTML() {
    const tl = timeline();
    const S = tl.seconds;
    const at = (sec) => `${((Math.min(S, Math.max(0, sec)) / S) * 100).toFixed(3)}%`;
    const sched = keySchedule(tl);
    const step = S <= 8 ? 1 : S <= 20 ? 2 : S <= 40 ? 5 : 10;
    let ticks = "";
    for (let t = 0; t <= S + 1e-9; t += step) ticks += `<span class="tl-tick" style="left:${at(t)}">${t}s</span>`;
    let segs = "";
    for (let i = 0; i < tl.keys.length - 1; i++) {
      const from = sched[i].leave,
        to = sched[i + 1].arrive;
      if (to - from <= 1e-6) continue;
      // The ramp, drawn: speed would be its slope, so an ease-in visibly
      // starts flat and an ease-out lands flat.
      // In a glide the segments are walked at the run's own speed, so each
      // is drawn straight and the ease lives at the run's two ends.
      const f = easeFn(tl.flow === "glide" ? "linear" : tl.keys[i].ease);
      const pts = Array.from({ length: 21 }, (_, n) => `${n * 5},${(30 - f(n / 20) * 26).toFixed(2)}`).join(" ");
      segs += `<div class="tl-seg" style="left:${at(from)};width:calc(${at(to)} - ${at(from)})" title="${e(tl.flow === "glide" ? FLOWS.glide.label : EASES[tl.keys[i].ease]?.label || "")}"><svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg></div>`;
    }
    const holds = sched
      .filter((x) => x.leave - x.arrive > 1e-6)
      .map((x) => `<div class="tl-hold" style="left:${at(x.arrive)};width:calc(${at(x.leave)} - ${at(x.arrive)})" title="Hold ${(x.leave - x.arrive).toFixed(1)}s"></div>`)
      .join("");
    const fades =
      (tl.fade.in > 0 ? `<div class="tl-fade in" style="left:0;width:${at(tl.fade.in)}" title="Fade in"></div>` : "") +
      (tl.fade.out > 0 ? `<div class="tl-fade out" style="right:0;width:${at(tl.fade.out)}" title="Fade out"></div>` : "");
    // An end key slid inward holds its shot out to the clip's edge: drawn
    // like a hold, paler, because nothing about it is the key's own hold.
    const first = sched[0].arrive,
      lastLeave = sched.at(-1).leave;
    const ends =
      (first > 1e-6 ? `<div class="tl-hold tl-end" style="left:0;width:${at(first)}" title="Holds the first shot until ${first.toFixed(1)}s"></div>` : "") +
      (S - lastLeave > 1e-6 ? `<div class="tl-hold tl-end" style="left:${at(lastLeave)};width:calc(100% - ${at(lastLeave)})" title="Holds the last shot from ${lastLeave.toFixed(1)}s"></div>` : "");
    // Every diamond drags now, the two ends included: "allow sliding of end
    // key frames".
    const keys = tl.keys
      .map((k, i) => {
        const end = i === 0 || i === tl.keys.length - 1;
        return `<button class="tl-key${k.id === tlSelected ? " selected" : ""}${end ? " end" : ""}" data-tl-key="${k.id}" style="left:${at(sched[i].arrive)}" title="${e(keyName(i, tl.keys.length))} · ${sched[i].arrive.toFixed(1)}s · drag to retime" aria-label="${e(keyName(i, tl.keys.length))} at ${sched[i].arrive.toFixed(1)} seconds"><span>${i + 1}</span></button>`;
      })
      .join("");
    return `<div class="tl-ruler">${ticks}</div><div class="tl-lane">${fades}${ends}${segs}${holds}${keys}</div><div class="tl-playhead" style="left:${at(tlPlayhead)}"><span>${tlPlayhead.toFixed(1)}s</span></div>`;
  }
  const keyName = (i, n) => (i === 0 ? "Start" : i === n - 1 ? "End" : `Keyframe ${i + 1}`);
  function renderTimelineDialog() {
    const tl = timeline();
    const seconds = tl.seconds;
    const noLights = !(p.lights || []).length;
    const sched = keySchedule(tl);
    if (!tl.keys.some((k) => k.id === tlSelected)) tlSelected = tl.keys[0].id;
    tlPlayhead = Math.min(seconds, Math.max(0, tlPlayhead));
    fillThumbs();
    const strip = tl.keys
      .map((k, i) => {
        const thumb = keyThumbs.get(k.id);
        return `<button class="key-card${k.id === tlSelected ? " selected" : ""}" data-action="timeline-select" data-key="${k.id}" aria-label="Select ${e(keyName(i, tl.keys.length))}" aria-pressed="${k.id === tlSelected}">${thumb ? `<img src="${thumb}" alt=""/>` : `<span class="key-thumb-none">${i + 1}</span>`}<strong>${i + 1}. ${e(keyName(i, tl.keys.length))}</strong><small>${sched[i].arrive.toFixed(1)}s${k.hold ? ` · holds ${k.hold.toFixed(1)}s` : ""}</small></button>`;
      })
      .join("");
    const i = tl.keys.findIndex((k) => k.id === tlSelected);
    const k = tl.keys[i];
    const first = i === 0,
      last = i === tl.keys.length - 1;
    const speed = last ? null : segmentSpeed(tl, i);
    const card = `<div class="key-row" data-key="${k.id}"><div class="key-head"><strong>${e(keyName(i, tl.keys.length))}</strong><span class="muted">arrives at ${sched[i].arrive.toFixed(1)}s</span></div><div class="key-fields"><label class="setting-label">At (s)<input type="number" data-key-field="t" data-key="${k.id}" min="0" max="${seconds}" step="0.1" value="${sched[i].arrive.toFixed(1)}" aria-label="Keyframe time in seconds"/></label><label class="setting-label">Hold (s)<input type="number" data-key-field="hold" data-key="${k.id}" min="0" max="10" step="0.1" value="${(k.hold || 0).toFixed(1)}" aria-label="Seconds held on this pose"/></label>${
      last || tl.flow === "glide"
        ? ""
        : `<label class="setting-label">Ramp to next<select data-key-field="ease" data-key="${k.id}" aria-label="Segment ramp">${Object.entries(EASES)
            .map(([id, v]) => `<option value="${id}" ${k.ease === id ? "selected" : ""}>${e(v.label)}</option>`)
            .join("")}</select></label>`
    }</div>${speed === null ? "" : `<p class="muted">Then travels ${speed.toFixed(2)} m/s to the next keyframe.</p>`}<div class="button-row">${btn("timeline-go", "Show this view", "camera")}${btn("timeline-recapture", "Replace with current view", "rotate-ccw")}${tl.keys.length > MIN_KEYS ? btn("timeline-delete", "Delete", "trash-2") : ""}</div></div>`;
    document.querySelector("#timeline-content").innerHTML =
      `<div class="panel-heading"><h2>Camera timeline</h2>${btn("close-timeline", "Close", "x", "icon-only")}</div><ol class="tl-steps"><li>Frame a shot in the booth behind this panel.</li><li>Press <strong>Add keyframe</strong>. Repeat for each shot.</li><li>Drag a diamond to change when the camera gets there; drag the track to scrub.</li></ol><div class="tl-bar">${tl.keys.length < MAX_KEYS ? btn("timeline-add", "Add keyframe", "plus", "primary") : `<span class="muted">${MAX_KEYS} keyframes max</span>`}${videoSupported() ? (busyVideo ? btn("cancel-video", "Cancel export", "x") : btn("export-video", "Export MP4", "download")) : ""}<span class="tl-transport">${btn("timeline-prev", "Previous keyframe", "skip-back", "icon-only")}${busyPreview ? btn("timeline-pause", "Pause", "pause", "primary") : btn("timeline-play", tlPlayhead > 0.05 && tlPlayhead < seconds - 0.05 ? "Play from here" : "Play", "play")}${btn("timeline-next", "Next keyframe", "skip-forward", "icon-only")}</span><label class="setting-label tl-length">Length (s)<input type="number" id="timeline-seconds" min="${MIN_SECONDS}" max="${MAX_SECONDS}" step="1" value="${seconds}" aria-label="Clip length in seconds"/></label></div><div class="tl-track" data-tl-track role="group" aria-label="Timeline track">${timelineTrackHTML()}</div><div class="tl-legend"><span><i class="tl-sw seg"></i>move · curve = ramp</span><span><i class="tl-sw hold"></i>hold</span><span><i class="tl-sw fade"></i>fade</span></div><div class="tl-strip">${strip}</div>${card}${timelineFrameSection(tl)}<section><h3>Motion</h3><label class="setting-label">Camera flow<select id="timeline-flow" aria-label="Camera flow">${Object.entries(FLOWS).map(([id, v]) => `<option value="${id}" ${tl.flow === id ? "selected" : ""}>${e(v.label)}</option>`).join("")}</select></label><p class="muted">${tl.flow === "glide" ? "The camera eases in once, moves at a steady speed through every keyframe without stopping, and eases out at the end — the look of a slider or a gimbal. A hold still stops it." : "Each move has its own ramp, so the camera settles on every keyframe. Choose the glide for one unbroken move."}</p>${tl.keys.length > 2 ? btn("timeline-auto", "Auto timing · even speed", "zap", "wide") : ""}<p class="muted">${tl.keys.length > 2 ? "Respaces the middle keyframes so the camera covers the same distance every second." : "Auto timing spaces middle keyframes; add one to use it."}</p>${tlBeforeAuto ? btn("timeline-auto-undo", "Put the timing back", "undo-2", "wide") : ""}</section><section><h3>Fades</h3><div class="field-pair"><label class="setting-label">Fade in<input type="number" id="timeline-fade-in" min="0" max="${(seconds / 2).toFixed(1)}" step="0.1" value="${tl.fade.in.toFixed(1)}" aria-label="Fade in seconds"/></label><label class="setting-label">Fade out<input type="number" id="timeline-fade-out" min="0" max="${(seconds / 2).toFixed(1)}" step="0.1" value="${tl.fade.out.toFixed(1)}" aria-label="Fade out seconds"/></label></div><p class="muted">Seconds of black at each end. Zero disables. The fade is drawn over the finished frame, so it reaches real black rather than a dark wash.</p></section><section><h3>Lens flare</h3><label class="check-field"><input type="checkbox" id="timeline-flare" ${tl.flare.on ? "checked" : ""}/>Lens flare during the move</label><label class="setting-label">Comes from<select id="timeline-flare-source" aria-label="Lens flare source">${Object.entries(FLARE_SOURCES).map(([k, v]) => `<option value="${k}" ${tl.flare.source === k ? "selected" : ""} ${k === "spot" && noLights ? "disabled" : ""}>${e(v)}</option>`).join("")}</select></label>${tl.flare.source === "spot" && noLights ? `<p class="warn-note">This booth has no spotlights, so a flare from one would never appear. Use the overhead source, or add a spotlight in Lighting.</p>` : ""}${range("Flare strength", "flare-strength", Math.round(tl.flare.strength * 100), 0, 100, 1, "timeline", "%")}<p class="muted">${tl.flare.source === "overhead" ? `An unseen light ${Math.round(OVERHEAD.y / 12)} ft over the centre of the booth, standing in for the sun or a hall's high bay. Nothing is drawn there and nothing is lit by it — only the flare says it is there.` : "The brightest spotlight in the booth."} The flare tracks the camera: its ghosts sit on the line from that light through the centre of frame, and it fades out as the light leaves the shot.</p></section>${timelineExportSection()}${batchSection()}<div class="button-row">${btn("close-timeline", "Done", "check", "primary")}</div>`;
    refreshIcons();
  }
  /**
   * The frame, in the timeline: the same Frame menu and size / left-right /
   * up-down sliders as the Video tab, plus the switch that keyframes them.
   * Asked for as "add the frame up / down slider also in the timeline, and
   * make it keyframeable so the frame can move too".
   */
  function timelineFrameSection(tl) {
    const note = tl.frameKeys
      ? `Each keyframe keeps its own frame. The sliders and the guide's handles set the selected keyframe's; between keyframes the frame travels on the same ramp as the camera, so a frame can rise, fall, pan or zoom during the move.`
      : `Off: the frame stays where it is for the whole clip. On, each keyframe keeps its own frame size and position, and the frame moves between them with the camera.`;
    const toggle = `<label class="check-field"><input type="checkbox" id="timeline-frame-keys" ${tl.frameKeys ? "checked" : ""} ${videoFrameShape === "view" ? "disabled" : ""}/>Keyframe the frame</label><p class="muted">${videoFrameShape === "view" ? "“This window” is the whole viewport and has nowhere to move. Choose a frame shape to keyframe it." : note}</p>`;
    return `<section><h3>Frame</h3>${frameFields("video")}${toggle}</section>`;
  }
  /** Export from the timeline itself, so the clip can go out without leaving it. */
  function timelineExportSection() {
    if (!videoSupported()) return "";
    return `<section><h3>Export</h3><p class="muted">${e(frameNote("video"))} ${videoFps} fps. Frame rate and resolution are in the Video tab; the batch below can give each item its own.</p>${busyVideo ? btn("cancel-video", "Cancel", "x", "wide") : btn("export-video", "Export MP4", "download", "primary wide")}<div class="video-progress" role="status" aria-live="polite">${busyVideo ? progressHTML() : ""}</div></section>`;
  }
  /** Selects key `index`: the playhead, the camera and the frame all go to it. */
  function showKey(index) {
    const tl = timeline();
    const key = tl.keys[index];
    if (!key) return;
    tlSelected = key.id;
    tlPlayhead = keySchedule(tl)[index].arrive;
    scene?.applyPose(key);
    livePlace = key.place || null;
    renderTimelineDialog();
    renderInspector();
  }
  /** Scrub: put the playhead at `sec` and show the camera there. */
  function scrubTo(sec) {
    const tl = timeline();
    tlPlayhead = Math.min(tl.seconds, Math.max(0, sec));
    scene?.showMoment(tl, tlPlayhead / tl.seconds);
    followPlayhead(tl, tlPlayhead / tl.seconds);
  }
  // The track's pointer handling, bound once on the dialog's content (which
  // is never replaced) and capturing on the track itself, whose children are
  // redrawn on every move of a drag.
  {
    const content = document.querySelector("#timeline-content");
    let dragging = null;
    const secondsAt = (ev, track) => {
      const r = track.getBoundingClientRect();
      return (Math.min(1, Math.max(0, (ev.clientX - r.left) / Math.max(1, r.width)))) * timeline().seconds;
    };
    const redraw = () => {
      const track = content.querySelector("[data-tl-track]");
      if (track) track.innerHTML = timelineTrackHTML();
    };
    content.addEventListener("pointerdown", (ev) => {
      const track = ev.target.closest?.("[data-tl-track]");
      if (!track || ev.button !== 0) return;
      ev.preventDefault();
      const keyEl = ev.target.closest("[data-tl-key]");
      const tl = timeline();
      const index = keyEl ? tl.keys.findIndex((k) => k.id === keyEl.dataset.tlKey) : -1;
      if (index >= 0) {
        tlSelected = tl.keys[index].id;
        dragging = { key: tl.keys[index].id, moved: false };
        tlPlayhead = keySchedule(tl)[index].arrive;
        scene?.applyPose(tl.keys[index]);
        livePlace = tl.keys[index].place || null;
        if (tl.frameKeys) updateFrameGuide();
      } else {
        dragging = { scrub: true };
        scrubTo(secondsAt(ev, track));
      }
      track.setPointerCapture(ev.pointerId);
      redraw();
    });
    content.addEventListener("pointermove", (ev) => {
      if (!dragging || dragging.select) return;
      const track = content.querySelector("[data-tl-track]");
      if (!track) return;
      const sec = secondsAt(ev, track);
      if (dragging.scrub) scrubTo(sec);
      else {
        const tl = timeline();
        const index = tl.keys.findIndex((k) => k.id === dragging.key);
        if (index < 0) return;
        dragging.moved = true;
        const keys = tl.keys.map((k, n) => (n === index ? { ...k, t: keyTAt(tl, index, sec) } : k));
        videoTimeline = normalizeTimeline({ ...tl, keys });
        // Found again by id: a key dragged past its neighbour changes place.
        const now = videoTimeline.keys.findIndex((k) => k.id === dragging.key);
        tlPlayhead = keySchedule(videoTimeline)[now].arrive;
      }
      redraw();
    });
    const end = () => {
      if (!dragging) return;
      const was = dragging;
      dragging = null;
      // A drag ends with the whole dialog redrawn: the card's times and the
      // strip's labels follow the key that moved.
      if (!was.scrub) renderTimelineDialog();
    };
    content.addEventListener("pointerup", end);
    content.addEventListener("pointercancel", end);
  }
  // The batch list. A clip is queued with a copy of the settings it was queued
  // with — including a snapshot of the timeline where the move is Custom —
  // because the point of a batch is to compose four different shots and then
  // walk away, and settings that followed the panel would render the last one
  // four times.
  // The batch queue: clips and stills rendered in one go, each with the
  // general export settings or its own. See src/batch.js for the model. It
  // is saved with the project (so it survives a reload and travels in a
  // backup) but it is not the booth, so an edit to it is saved without an
  // undo step and an undo leaves it alone.
  const kit = () => normalKit(p.exportKit);
  function setKit(next) {
    p.exportKit = { defaults: next.defaults, presets: next.presets, queue: next.queue };
    scheduleSave();
    refreshPanels();
  }
  // Which of the batch's folding sections are open. The panel is redrawn on
  // every change, and a tweak panel that folded shut each time one of its
  // menus was used would be unusable.
  const openFolds = new Set();
  const fold = (id, fallback = false) => ((openFolds.has(id) || (fallback && !openFolds.has(`-${id}`))) ? " open" : "");
  const remember = (id, open) => {
    openFolds.delete(open ? `-${id}` : id);
    openFolds.add(open ? id : `-${id}`);
  };
  // Both: the click, because a redraw can land before the browser's queued
  // toggle event does and the new state would be lost with the old element;
  // the toggle, for anything that opens a section some other way.
  document.addEventListener(
    "click",
    (ev) => {
      const summary = ev.target?.closest?.("summary");
      const details = summary?.parentElement;
      if (details?.dataset?.fold) remember(details.dataset.fold, !details.open);
    },
    true,
  );
  document.addEventListener(
    "toggle",
    (ev) => {
      if (ev.target?.dataset?.fold && ev.target.isConnected) remember(ev.target.dataset.fold, ev.target.open);
    },
    true,
  );
  function addJobs(jobs) {
    if (!scene) return toast("3D is not available, so there is nothing to export.", true);
    const k = kit();
    if (k.queue.length + jobs.length > MAX_JOBS) return toast(`${MAX_JOBS} items is the limit for one batch.`, true);
    setKit({ ...k, queue: [...k.queue, ...jobs] });
    toast(jobs.length === 1 ? `Queued ${batchLabel(jobs[0], kit())}.` : `Queued ${jobs.length} items.`);
  }
  /** The Video tab and, when it is open, the timeline, which share controls. */
  function refreshPanels() {
    renderInspector();
    if (timelineOpen()) renderTimelineDialog();
  }
  const shortFrame = (id) => FRAMES[id]?.label.split(" · ").at(-1) || id;
  const shortSize = (size) => SIZES[size]?.label.split(" · ")[0] || size;
  function batchLabel(job, k = kit()) {
    const r = resolveJob(job, k);
    const frame = r.frame && r.frame !== DEFAULT_FRAME ? ` · ${shortFrame(r.frame)}` : "";
    if (r.kind === "still") return `${job.name ? `${job.name} · ` : ""}Still · ${r.long} px${frame}`;
    const preset = job.preset && k.presets.find((x) => x.id === job.preset);
    const move = preset ? `Preset “${preset.name}”` : job.move === KIT_CUSTOM ? "Custom timeline" : resolveMove(job.move).label;
    return `${job.name ? `${job.name} · ` : ""}${move} · ${r.seconds}s · ${r.fps} fps · ${shortSize(r.size)}${frame}`;
  }
  /** Everything the Video tab is set to now, as batch settings. */
  const panelSettings = () =>
    cleanSettings({ fps: videoFps, size: videoSize, long: exportLong, frame: videoFrameShape, custom: customFrame, place: framePlace.video, settle: videoSettle });
  /**
   * A clip from what the panel is set to. `frozen` keeps every setting as it
   * is now — "add each one individually" — and otherwise the clip follows
   * the general settings until one of its own is tweaked. A Custom move
   * carries a frozen copy of the timeline, so the next keyframe someone adds
   * does not quietly rewrite a queued clip.
   */
  function clipJob(frozen) {
    const custom = videoMove === CUSTOM_MOVE;
    return {
      id: uid(),
      kind: "clip",
      move: custom ? KIT_CUSTOM : videoMove,
      seconds: custom ? timeline().seconds : videoSeconds,
      ...(custom ? { timeline: structuredClone(timeline()) } : {}),
      set: frozen ? panelSettings() : {},
    };
  }
  function stillJob(frozen, pose = scene?.pose(), set) {
    return {
      id: uid(),
      kind: "still",
      pose: { position: [...pose.position], target: [...pose.target] },
      set: set || (frozen ? cleanSettings({ long: exportLong, frame: exportFrame, custom: customFrame, place: framePlace.export }) : {}),
    };
  }
  function kitSelect(key, value, options, attrs, general) {
    const opts = [
      general !== undefined ? `<option value="" ${value === undefined ? "selected" : ""}>General · ${e(general)}</option>` : "",
      ...options.map(([v, label]) => `<option value="${e(String(v))}" ${value !== undefined && String(value) === String(v) ? "selected" : ""}>${e(label)}</option>`),
    ].join("");
    return `<select ${attrs}>${opts}</select>`;
  }
  const FPS_OPTIONS = FPS.map((f) => [f, `${f} fps`]);
  const SIZE_OPTIONS = Object.keys(SIZES).map((k) => [k, shortSize(k)]);
  const LONG_OPTIONS = STILL_SIZES.map((n) => [n, `${n} px`]);
  const FRAME_OPTIONS = Object.keys(FRAMES).map((k) => [k, FRAMES[k].label]);
  function generalSettingsHTML(k) {
    const d = k.defaults;
    const field = (label, key, options) =>
      `<label class="setting-label">${label}${kitSelect(key, d[key], options, `data-kit-default="${key}" aria-label="General ${label.toLowerCase()}"`)}</label>`;
    const placed = d.place.scale !== 1 || d.place.x !== 0 || d.place.y !== 0;
    return `<details class="batch-general" data-fold="general"${fold("general")}><summary>General export settings</summary><p class="muted">What every item uses unless it has its own. Change one here and every item still on the general setting follows.</p><div class="field-pair">${field("Frame rate", "fps", FPS_OPTIONS)}${field("Clip size", "size", SIZE_OPTIONS)}</div><div class="field-pair">${field("Still size", "long", LONG_OPTIONS)}${field("Frame", "frame", FRAME_OPTIONS)}</div><p class="muted">Frame ${d.frame === "custom" ? `${d.custom.width} × ${d.custom.height}` : e(shortFrame(d.frame))}${placed ? `, placed at ${Math.round(d.place.scale * 100)}% size` : ", centred at full size"}.</p>${btn("kit-take-frame", "Use the Video tab's frame and placement", "crop", "wide")}<label class="check-field"><input type="checkbox" data-kit-default="settle" ${d.settle ? "checked" : ""}/>Careful rendering</label></details>`;
  }
  function presetsHTML(k) {
    const rows = k.presets
      .map(
        (x) =>
          `<div class="batch-row preset-row" data-preset="${x.id}"><div class="key-head"><strong>${e(x.name)}</strong><span class="muted">${x.timeline.keys.length} keyframes · ${x.timeline.seconds}s · ${k.queue.filter((j) => j.preset === x.id).length} using it</span></div><div class="button-row">${btn("preset-load", "Load into timeline", "folder-open")}${btn("preset-overwrite", "Save the timeline over it", "save")}${btn("preset-apply", "Use for every clip", "copy")}${btn("preset-delete", "Delete", "trash-2")}</div></div>`,
      )
      .join("");
    return `<details class="batch-presets" data-fold="presets"${fold("presets", true)}><summary>Timeline presets <span>${k.presets.length}</span></summary><p class="muted">A saved timeline. Clips that use one follow it, so one move can go out as a 16:9, a 9:16 and a square — and every later change to the preset reaches all of them.</p><div class="preset-new"><input type="text" data-preset-name maxlength="120" placeholder="Preset name" aria-label="New preset name"/>${btn("preset-save", "Save timeline as preset", "save")}</div>${rows}</details>`;
  }
  function jobRow(job, i, k) {
    const r = resolveJob(job, k);
    const state = busyVideo && videoBatchAt === i ? "Rendering…" : busyVideo && videoBatchAt > i ? "Done" : "Queued";
    const d = k.defaults;
    const own = (key) => (overridden(job, key) ? job.set[key] : undefined);
    const tweakSel = (key, label, options, general) =>
      `<label class="setting-label">${label}${kitSelect(key, own(key), options, `data-job-set="${key}" aria-label="${label} for item ${i + 1}"`, general)}</label>`;
    let what = "";
    if (job.kind === "clip") {
      const moves = [
        ...Object.entries(MOVES).map(([id, v]) => [id, v.label]),
        ...(job.timeline ? [["own", "Its own timeline"]] : []),
        ...k.presets.map((x) => [`preset:${x.id}`, `Preset · ${x.name}`]),
      ];
      const value = job.preset ? `preset:${job.preset}` : job.move === KIT_CUSTOM ? "own" : job.move;
      what = `<label class="setting-label">Move${kitSelect("move", value, moves, `data-job-move aria-label="Move for item ${i + 1}"`)}</label><div class="field-pair">${tweakSel("fps", "Frame rate", FPS_OPTIONS, `${d.fps} fps`)}${tweakSel("size", "Size", SIZE_OPTIONS, shortSize(d.size))}</div>`;
    } else what = `<div class="field-pair">${tweakSel("long", "Size", LONG_OPTIONS, `${d.long} px`)}</div>`;
    const framed = overridden(job, "frame") || overridden(job, "place");
    const frame = `${tweakSel("frame", "Frame", FRAME_OPTIONS, shortFrame(d.frame))}<div class="button-row">${btn("job-take-frame", job.kind === "still" ? "Use the Export tab's frame here" : "Use the Video tab's frame here", "crop")}${framed ? btn("job-general-frame", "Frame: back to general", "rotate-ccw") : ""}</div>`;
    const actions = `${job.kind === "clip" ? btn("batch-use", "Load these settings", "rotate-ccw") : btn("job-show", "Show this view", "camera")}${busyVideo ? "" : `${i > 0 ? btn("job-up", "Move up", "arrow-up", "icon-only") : ""}${btn("batch-remove", "Remove", "trash-2")}`}`;
    return `<div class="batch-row" data-job="${job.id}"><div class="key-head"><strong>${i + 1}. ${e(batchLabel(job, k))}</strong><span class="muted">${state}</span></div><details class="job-tweak" data-fold="job-${job.id}"${fold(`job-${job.id}`)}><summary>Tweak${Object.keys(job.set).length ? ` · ${Object.keys(job.set).length} own` : " · general"}</summary><label class="setting-label">Name<input type="text" data-job-name maxlength="120" value="${e(job.name || "")}" placeholder="Used in the file name" aria-label="Name for item ${i + 1}"/></label>${what}${frame}${Object.keys(job.set).length ? btn("job-general", "Use the general settings for all of it", "rotate-ccw", "wide") : ""}</details><div class="button-row">${actions}</div></div>`;
  }
  function batchSection() {
    if (!videoSupported()) return "";
    const k = kit();
    const n = k.queue.length;
    const clips = k.queue.filter((j) => j.kind === "clip").length;
    const rows = k.queue.map((job, i) => jobRow(job, i, k)).join("");
    const custom = videoMove === CUSTOM_MOVE;
    return `<section class="batch"><h3>Batch export <span>${n} ${n === 1 ? "item" : "items"}</span></h3><p class="muted">Queue clips and stills and render them in one go. Add each exactly as it is set now, or add it on the general settings and tweak it in the list. They render in order and download as they finish; the list is saved with the booth.</p>${generalSettingsHTML(k)}${presetsHTML(k)}<h4>Add to the batch</h4><div class="button-row">${btn("batch-add", "Clip · as set now", "plus")}${btn("batch-add-general", "Clip · general settings", "plus")}</div><div class="button-row">${btn("batch-add-still", "Still · as set now", "image-plus")}${btn("batch-add-still-general", "Still · general settings", "image-plus")}</div>${custom ? btn("batch-add-key-stills", "A still of every keyframe", "images", "wide") : ""}${n && !busyVideo ? btn("batch-clear", "Clear list", "trash-2", "wide") : ""}${rows}${n ? (busyVideo ? btn("cancel-video", "Cancel", "x", "wide") : btn("batch-export", `Export all ${n}`, "download", "primary wide")) : ""}${n ? `<div class="video-progress" role="status" aria-live="polite">${busyVideo && videoBatchAt >= 0 ? progressHTML() : ""}</div><p class="muted">A batch renders every frame of every clip, so it takes as long as the clips add up to — several minutes for four 1080p moves. ${clips < n ? "Stills take a second or two each. " : ""}The camera comes back where you left it.</p>` : ""}</section>`;
  }

  // The panel's settings as a renderable clip, resolved the way a batch item is.
  function currentClip() {
    const job = clipJob(true);
    return { ...resolveJob(job, kit()), timeline: job.timeline || null };
  }
  // Renders one clip or a whole batch, in order, downloading each as it lands.
  // A batch is not a different code path: it is this loop with more than one
  // entry, which is what keeps a single export and a batch honest with each
  // other.
  // A batch is the same loop with stills in it: a still is one frame, rendered
  // by the PNG export from the view it was queued with.
  async function runClips(jobs, { batch = false } = {}) {
    busy = busyVideo = true;
    videoAbort = new AbortController();
    videoBatchAt = batch ? 0 : -1;
    refreshPanels();
    // The progress element is written to directly rather than through
    // renderInspector: redrawing the whole panel a few hundred times would
    // itself slow the render it is reporting on. There can be one in the
    // Video tab and one in the timeline; both are kept.
    const status = (note) => {
      document.querySelectorAll(".video-progress").forEach((box) => {
        if (!batch && box.closest(".batch")) return;
        if (!box.querySelector("progress")) box.innerHTML = progressHTML();
        box.querySelector("progress").value = videoProgress;
        box.querySelector("span").textContent = `${note}${Math.round(videoProgress * 100)}% · frame ${videoFrame} of ${videoFrames}`;
      });
    };
    let done = 0;
    let stills = 0;
    let vp9 = false;
    try {
      for (const [index, job] of jobs.entries()) {
        videoBatchAt = batch ? index : -1;
        if (batch) refreshPanels();
        videoProgress = 0;
        videoFrame = 0;
        const note = jobs.length > 1 ? `${job.kind === "still" ? "Still" : "Clip"} ${index + 1} of ${jobs.length} · ` : "";
        const name = batch ? `${safeName()}-${jobSlug(job, index)}` : `${safeName()}-${job.move}`;
        if (job.kind === "still") {
          videoFrames = 1;
          status(note);
          if (videoAbort.signal.aborted) throw new DOMException("Cancelled", "AbortError");
          const blob = await scene.export(job.long, { frame: job.frame, custom: job.custom, place: job.place, pose: job.pose || undefined });
          download(blob, `${name}.png`);
          videoProgress = 1;
          status(note);
          done += 1;
          stills += 1;
          continue;
        }
        if (job.move === CUSTOM_MOVE && !job.timeline) throw new Error(`Item ${index + 1} has no timeline to render. Load a preset into it or remove it.`);
        videoFrames = frameTimes(job.seconds, job.fps).count;
        status(note);
        const recorded = await scene.recordVideo({
          // A timeline where the move is Custom, one of the fixed moves
          // otherwise. Everything downstream — the recorder, the encoder, the
          // muxer — sees the same (t) -> pose contract either way.
          move: job.move === CUSTOM_MOVE ? normalizeTimeline(job.timeline) : job.move,
          seconds: job.seconds,
          fps: job.fps,
          size: job.size,
          frame: job.frame,
          custom: job.custom,
          place: job.place,
          settle: job.settle !== false,
          signal: videoAbort.signal,
          onProgress: (fraction) => {
            videoProgress = fraction;
            videoFrame = Math.round(fraction * videoFrames);
            status(note);
          },
        });
        download(recorded.blob, `${name}.mp4`);
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
      else if (batch) toast(`${done} exported${stills ? ` · ${done - stills} ${done - stills === 1 ? "clip" : "clips"}, ${stills} ${stills === 1 ? "still" : "stills"}` : ""}.`);
      else toast(`${jobs[0].seconds}s MP4 exported · ${videoFrames} frames at ${jobs[0].fps} fps.`);
    } catch (err) {
      // A cancelled batch keeps the clips it already wrote: they are on disk
      // and saying otherwise would be a lie.
      if (err?.name === "AbortError")
        toast(done ? `Cancelled after ${done} ${done === 1 ? "item" : "items"}.` : "Recording cancelled.");
      else toast(err.message, true);
    } finally {
      busy = busyVideo = false;
      videoAbort = null;
      videoProgress = 0;
      videoBatchAt = -1;
      refreshPanels();
    }
  }
  const progressHTML = () =>
    `<progress max="1" value="${videoProgress}"></progress><span>${Math.round(videoProgress * 100)}% · frame ${videoFrame} of ${videoFrames}</span>`;

  // Says what will come out, in the terms that matter: whether QuickTime
  // Player will open it. Nothing is claimed until the probe has answered.
  function videoCodecLine() {
    if (!videoCodec) return `<p class="muted">Checking what this browser can encode…</p>`;
    if (videoCodec.kind === "vp09")
      return `<p class="warn-note">This browser has no H.264 encoder, so the clip will be <strong>VP9 in an MP4</strong>. It plays in Chrome, Edge and VLC, but <strong>QuickTime Player cannot open it</strong>. Record in Chrome or Safari for a QuickTime-ready file.</p>`;
    return `<p class="muted">This browser will encode <strong>${e(videoCodec.label)}</strong> — the codec QuickTime Player, phones and upload forms expect.</p>`;
  }
  /**
   * Sub-tabs. A panel of three or more sections gets a row of chips under
   * its heading, one per section by its own heading, and shows the chosen
   * section alone — asked for because the panels had grown so long that a
   * tool was a long scroll away. "All" shows the panel as it always was.
   * The choice is remembered per tab. A section that was not there on the
   * last draw of the same tab — the piece just selected, the work just
   * clicked — is chosen for you, so a selection is never hidden behind a
   * chip. Tool search reaches every section whatever is chosen
   * (`showSection`). Under automation (navigator.webdriver) the panels start
   * on All, so the browser suites see every control; `booth.sectionTabs` in
   * localStorage ("on" / "off") overrides either way.
   */
  const subTab = {};
  const subSeen = {};
  const SUB_ALL = "All";
  function sectionTabsOn() {
    let pref = null;
    try {
      pref = localStorage.getItem("booth.sectionTabs");
    } catch {}
    return pref ? pref !== "off" : !navigator.webdriver;
  }
  /** The panel's own top-level sections, each with the chip it belongs to. */
  function panelSections(root) {
    return [...root.querySelectorAll("section")]
      .filter((sec) => !sec.parentElement.closest("section"))
      .map((sec) => {
        // Its own heading; a section without one is named by its first
        // sub-heading or control, as Lighting's ambient section is.
        const own = [...sec.querySelectorAll("h3, h4, label")].find((h) => h.closest("section") === sec);
        const label = own ? findableName(own) : "";
        return { sec, label: label || "More" };
      });
  }
  function applySectionTabs(root) {
    root.querySelector(".section-tabs")?.remove();
    const list = panelSections(root);
    const labels = [...new Set(list.map((x) => x.label))];
    const seen = subSeen[tab];
    subSeen[tab] = labels;
    if (!sectionTabsOn() || labels.length < 3) return;
    const fresh = seen ? labels.filter((l) => !seen.includes(l)) : [];
    if (fresh.length && subTab[tab] !== SUB_ALL) subTab[tab] = fresh[0];
    if (subTab[tab] !== SUB_ALL && !labels.includes(subTab[tab])) subTab[tab] = labels[0];
    const chosen = subTab[tab];
    for (const { sec, label } of list) sec.classList.toggle("sub-hidden", chosen !== SUB_ALL && label !== chosen);
    const bar = document.createElement("div");
    bar.className = "section-tabs";
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Sections of this panel");
    bar.innerHTML = [...labels, SUB_ALL].map((l) => `<button type="button" role="tab" data-subtab="${e(l)}" aria-selected="${l === chosen}" class="${l === chosen ? "active" : ""}" title="${e(l)}">${e(l)}</button>`).join("");
    list[0].sec.before(bar);
  }
  /** Choose the chip a section belongs to, so it can be shown and focused. */
  function showSection(el) {
    const root = document.querySelector("#inspector-content");
    const sec = el?.closest?.("section.sub-hidden");
    if (!sec) return;
    const hit = panelSections(root).find((x) => x.sec === sec || x.sec.contains(sec));
    if (!hit) return;
    subTab[tab] = hit.label;
    applySectionTabs(root);
  }
  document.querySelector("#inspector-content").addEventListener("click", (ev) => {
    const chip = ev.target.closest?.("[data-subtab]");
    if (!chip) return;
    subTab[tab] = chip.dataset.subtab;
    const root = document.querySelector("#inspector-content");
    applySectionTabs(root);
    root.scrollTop = 0;
  });
  function renderInspector() {
    document
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    const root = document.querySelector("#inspector-content");
    root.innerHTML = inspectorHTML();
    applySectionTabs(root);
    refreshIcons();
    updateFrameGuide();
  }
  /**
   * The frame guide: the chosen export frame outlined over the viewport, with
   * everything outside it dimmed. Shown while the Video or Export tab is open,
   * the timeline dialog is up, or a move is previewing — the places a shot is
   * composed for a file — and only when the frame is not "This window", which
   * is the viewport already. The export draws exactly what is inside it
   * (scene.js `frameRect`), so composing to the guide is composing the file.
   */
  function frameGuideShape() {
    if (!scene || p.mode === "photo") return null;
    const timelineOpen = document.querySelector("#timeline-dialog")?.open;
    const which = tab === "export" ? "export" : tab === "video" || timelineOpen || busyPreview ? "video" : null;
    const id = which === "export" ? exportFrame : which === "video" ? videoFrameShape : null;
    if (!id || id === "view" || !FRAMES[id]) return null;
    const aspect = id === "custom" ? customFrame.width / customFrame.height : FRAMES[id].aspect;
    return { id, which, aspect, label: id === "custom" ? `${customFrame.width} × ${customFrame.height}` : FRAMES[id].label.split(" · ")[1] || FRAMES[id].label };
  }
  function updateFrameGuide() {
    const guide = document.querySelector(".frame-guide");
    const host = document.querySelector("#scene");
    if (!guide || !host) return;
    const shape = frameGuideShape();
    guide.hidden = !shape;
    if (!shape) return;
    guide.dataset.which = shape.which;
    const W = host.clientWidth,
      H = host.clientHeight;
    const r = renderRect
      ? { x: renderRect.x * W, y: renderRect.y * H, width: renderRect.width * W, height: renderRect.height * H }
      : placeRect(W, H, shape.aspect, getPlace(shape.which));
    Object.assign(guide.style, {
      left: `${host.offsetLeft}px`,
      top: `${host.offsetTop}px`,
      width: `${host.clientWidth}px`,
      height: `${host.clientHeight}px`,
    });
    Object.assign(guide.firstElementChild.style, {
      left: `${r.x}px`,
      top: `${r.y}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    guide.querySelector(".fg-label").textContent = shape.label;
  }
  /** The open tab's inspector, as markup. Tool search reads every tab's. */
  function inspectorHTML() {
    const a = p.art.find((a) => a.id === selected),
      l = p.photo.layers.find((l) => l.id === photoSelected);
    let html = "";
    if (tab === "art" && p.mode === "photo") {
      html = `<div class="panel-heading"><h2>Photo artwork</h2>${btn("upload-art", "Upload artwork", "plus", "icon-only")}</div><p class="muted">Select a library work to add it to this photo. Drag its corners to match the wall. Placement is visual, not measured.</p><div class="mobile-library">${libraryHTML(true)}</div>${l ? `<section><h3>${e(l.title)}</h3>${range("Cast-shadow overlay", "shadow", l.shadow, 0, 60, 1, "photoLayer")}<p class="muted">Drag inside to move. Blue corner handles control perspective.</p>${l.corners.map((c, i) => `<h4>${["Top left", "Top right", "Bottom right", "Bottom left"][i]}</h4><div class="field-pair">${field("X %", i + "-0", c[0] * 100, 0, 100, 0.1, "%", "corner")}${field("Y %", i + "-1", c[1] * 100, 0, 100, 0.1, "%", "corner")}</div>`).join("")}<div class="button-row">${btn("photo-front", "Bring to front", "layers")}${btn("photo-delete", "Remove", "trash-2")}</div></section>` : '<div class="empty-inspector"><p>Choose an uploaded work from your library, or upload a new one.</p></div>'}<section><h3>Photo layers</h3>${p.photo.layers.map((x) => `<button class="wide layer-row ${x.id === photoSelected ? "active" : ""}" data-layer="${x.id}">${e(x.title)}</button>`).join("")}</section>`;
    } else if (tab === "art") {
      html = `<div class="mobile-library">${libraryHTML(true)}</div>${a ? `${multiSection()}<div class="panel-heading"><h2>Artwork properties</h2><span class="badge">${a.kind === "sign" ? "Sign" : a.kind === "label" ? "Label" : a.asset ? "Original" : "Sample"}</span></div><div class="selected-art"><div class="thumb">${artThumb(a)}</div><div><input class="title-input" data-field="title" data-scope="art" aria-label="Artwork title" maxlength="120" value="${e(a.title)}"/><span>${a.kind === "sign" || a.kind === "label" ? "Editable wall asset" : a.asset ? "Original image preserved" : "Measured placeholder panel"}</span>${a.kind === "sign" || a.kind === "label" ? "" : btn("replace-art", a.asset ? "Replace image" : "Add original image", "image-plus", "text-button")}</div></div>${signFields(a)}${a.asset ? `<section><h3>Image adjustments</h3><p class="muted">Edits affect this placement only. The uploaded original stays unchanged.</p>${btn("edit-image", "Edit image", "image", "primary wide")}<div class="button-row">${btn("copy-edits", "Copy edits", "copy")}${btn("paste-edits", "Paste edits", "layers", p.editClipboard ? "" : "disabled")}</div></section>` : ""}<section><h3>Dimensions <span>inches</span></h3><p class="muted">Double-tap artwork to adjust. Corners scale proportionally; middle edge handles stretch width or height.</p>${scaleControl(a)}<label class="setting-label"><input type="checkbox" data-field="stretch" data-scope="art" ${a.stretch ? "checked" : ""}/> Stretch image to panel dimensions</label>${field("Width", "w", a.w, 1, 360)}${field("Height", "h", a.h, 1, 360)}${!a.stretch && mismatch(p, a) ? `<div class="warning">Image proportions differ from the panel. The full image is fitted inside without stretching.${btn("match-ratio", "Match height to image", null, "wide")}</div>` : ""}${field("Thickness", "thickness", a.thickness, 0.1, 12, 0.1)}<label class="setting-label">Edge material<select data-field="edgeTexture" data-scope="art" aria-label="Edge material">${["plain","concrete","wood","metal"].map(k=>`<option value="${k}" ${(a.edgeTexture || "plain") === k ? "selected" : ""}>${k === "wood" ? "Wood grain" : k[0].toUpperCase()+k.slice(1)}</option>`).join("")}</select></label>${edgeColorFields(a)}${field("Wall gap", "offset", a.offset, 0, 12, 0.1)}<p class="muted">How far the work stands off the wall. ${shadowSpec(p.booth, "behind").on || shadowSpec(p.booth, "under").on ? "Head-on, the drawn drop shadow is what makes a gap read; its distance and size are set in Lighting → Drop shadow." : "With both drawn shadows hidden (Lighting → Drop shadow), a gap is only visible looking along the wall."}</p></section><section><h3>Placement</h3><div class="exterior-callout"><strong>Interior and exterior walls</strong><span>Artwork can hang on either face of the three booth walls and of any free-standing wall.</span></div>${hasRow(p.booth) ? `<label class="select-field">Booth<select data-field="inBooth" data-scope="art" aria-label="Which booth this hangs in">${boothSlots(p.booth).map((b) => `<option value="${e(b.id)}" ${(a.booth || normalizeRow(p.booth).home) === b.id ? "selected" : ""}>${e(slotLabel(b))}</option>`).join("")}</select></label>` : ""}<label class="select-field">Wall location<select data-field="location" data-scope="art" aria-label="Wall location">${locationOptions(a)}</select></label><div class="button-row">${btn("face-view", "View wall face", "camera")}</div>${field("Left edge", "x", a.x, -360, 360)}${artSlider(a, "x", "Slide left / right")}${field("Bottom edge", "y", a.y, -360, 360)}${artSlider(a, "y", "Slide up / down")}<p class="muted">From the bottom-left corner, facing the ${a.face === "outside" ? "outside" : "inside"} of this wall.</p>${boundWarning(p, a) ? `<div class="warning">${boundWarning(p, a)}</div>` : ""}<div class="button-row">${btn("center", "Center", "align-center")}${btn("eye-level", "Center at 60″", "arrow-up-to-line")}</div><div class="button-row">${btn("multi-mode", addMode ? "Done selecting" : "Select several", "plus", addMode ? "active" : "")}</div>${addMode ? '<p class="muted">Tap works in the booth to add them to the selection; tap one again to take it out.</p>' : ""}<div class="button-row">${btn("space-wall", "Space this wall evenly", "columns-2")}${btn("hang-wall", "Hang this wall at 60″", "ruler")}</div><p class="muted">For every work on this face of this wall: equal gaps between them and at both ends, in the order they hang; or every centre at 60″. Arrow keys nudge the selected work an inch, Shift a foot.</p></section><section><h3>Actions</h3><div class="button-row">${btn("duplicate-art", "Duplicate", "copy")}${btn("delete-art", "Remove", "trash-2", "danger")}</div></section>` : `<div class="empty-inspector"><h2>Make room for your work.</h2><p>Uploading files an original in your library without hanging it. Tap one there to put it on a wall, then set its real dimensions here.</p>${btn("upload-art", "Upload artwork", "image-plus", "primary")}</div>`}`;
    }
    if (tab === "layout") {
      html = `<div class="panel-heading"><h2>${p.mode === "photo" ? "Booth photograph" : "Booth layout"}</h2>${icon("layout-panel-left")}</div>${p.mode === "photo" ? `<p class="muted">The original photo stays intact. Added art and light overlays are saved separately. Existing objects in the photograph cannot be moved or erased in this prototype.</p>${btn("upload-photo", p.photo.asset ? "Replace booth photo" : "Upload booth photo", "image-plus", "wide")}${range("Photo exposure", "exposure", p.photo.exposure, -1, 1, 0.05, "photo")}` : `<section><h3>Footprint</h3><select data-field="preset" aria-label="Booth preset"><option value="120" ${p.booth.width === 120 ? "selected" : ""}>10 × 10 ft · Standard</option><option value="240" ${p.booth.width === 240 ? "selected" : ""}>10 × 20 ft · Double</option></select><p class="muted">Nominal footprint. Panels and 1.4″ canopy legs reduce usable space near edges.</p>${isArtShow(p) ? `<div class="warning">This is an art-show booth. Its footprint, walls and light bar are in the <strong>Art show</strong> tool, and a preset or a canopy here would put it back to an outdoor pop-up.</div>` : ""}${field("Wall height", "height", p.booth.height, 48, 144, 1, "in", "booth")}<label class="check-field"><input type="checkbox" data-field="tent" data-scope="booth" ${p.booth.tent ? "checked" : ""}/>White canopy & frame</label><label class="setting-label">Tent style<select aria-label="Tent style" data-field="tentStyle" data-scope="booth">${Object.entries(TENTS).map(([k,v])=>`<option value="${k}" ${(p.booth.tentStyle||'classic')===k?'selected':''}>${v}</option>`).join('')}</select></label><p class="muted">12″ fabric valance, rounded hems, roof ribs and folding frame. Inspired shapes; not manufacturer-certified models.</p></section><section><h3>Surroundings</h3><label class="setting-label">Environment<select aria-label="Environment" data-field="envPreset" data-scope="booth">${Object.entries(ENV_PRESETS).map(([k,v])=>`<option value="${k}" ${(p.booth.envPreset||DEFAULT_PRESET)===k?'selected':''}>${v.label}</option>`).join('')}</select></label><p class="muted">Presets light the booth from a photographed environment. Without its image files a preset keeps the procedural surroundings below.</p>${isArtShow(p) ? `<label class="check-field"><input type="checkbox" data-field="on" data-scope="hall" ${hallSpec(p.booth).on ? "checked" : ""}/>Stand this booth in a white exhibition hall</label><p class="muted">${hallSpec(p.booth).on ? "The hall's own walls stand around the booth. In a photographed environment they cut across it as a white band, so choosing one of those presets switches the hall off." : "Off: the booth stands in the environment above, with nothing of its own around it. The walls, the light bar and the panel module are unchanged — this is only the room."}</p>` : ""}<label class="setting-label">Artwork colour<select aria-label="Artwork colour" data-field="artFidelity" data-scope="booth">${Object.entries(ART_FIDELITY).map(([k,v])=>`<option value="${k}" ${(p.booth.artFidelity||DEFAULT_FIDELITY)===k?'selected':''}>${v}</option>`).join('')}</select></label>${groundFields()}<label class="setting-label">Horizon<select aria-label="Horizon" data-field="horizon" data-scope="booth">${Object.entries({studio:'Neutral studio',open:'Open sky',park:'Park · trees',urban:'Urban plaza'}).map(([k,v])=>`<option value="${k}" ${(p.booth.horizon||'studio')===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="check-field"><input type="checkbox" data-field="neighbors" data-scope="booth" ${p.booth.neighbors?'checked':''}/>Surround with other booths</label>${surroundingsFields()}</section>${viewsSection()}${tagsSection()}${peopleSection()}${underlaySection()}${clearanceSection()}<section><h3>Display walls</h3>${colorField("Fabric finish", "color", "booth", p.booth.color, "Fabric finish")}<label class="setting-label">Panel surface<select aria-label="Panel surface" data-field="wallFinish" data-scope="booth">${Object.entries({smooth:"Smooth print",fabric:"Fabric pro-panel"}).map(([k,v])=>`<option value="${k}" ${(p.booth.wallFinish||"smooth")===k?"selected":""}>${v}</option>`).join("")}</select></label>${(p.booth.wallFinish||"smooth")==="fabric"?`${range("Weave depth","wallTexture",p.booth.wallTexture??60,0,100,1,"booth","%")}<p class="muted">The weave only. Panels keep the colour above, so artwork is still judged against the finish you chose. Without the carpet texture files the panels stay smooth.</p>`:""}<div class="swatches">${["#45474a", "#25282b", "#b1aea4", "#d8d4ca"].map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Wall finish ${c}"></button>`).join("")}</div>${["back", "left", "right"].map((w) => `<div class="wall-setting"><label class="check-field"><input type="checkbox" data-field="enabled" data-scope="wall-${w}" ${p.booth.walls[w].enabled ? "checked" : ""}/>${w[0].toUpperCase() + w.slice(1)} wall</label>${field("Width", "width", p.booth.walls[w].width, 12, w === "back" ? p.booth.width : p.booth.depth, 1, "in", "wall-" + w)}${field("Height", "height", p.booth.walls[w].height, 24, 144, 1, "in", "wall-" + w)}</div>`).join("")}</section><section><h3>Free-standing walls and pedestals</h3><p class="muted">Interior panels and pedestals live in the Walls tool, so this list stays the booth itself.</p>${btn("open-walls", "Open the Walls tool", "columns-2", "wide")}</section>${rowSection()}${draftSection()}`}<section><h3>Project</h3>${btn("quick-start", "Quick start a new booth", "zap", "primary wide")}${allowed("templates") ? btn("save-template", "Save this booth as a template", "save", "wide") : ""}${btn("copy-project", "Duplicate as alternative", "copy", "wide")}${btn("new-project", "New empty booth", "plus", "wide")}${btn("backup", "Download project backup", "save", "wide")}${btn("import", "Open project backup", "folder-open", "wide")}<p class="muted">Backups include all original images. Download before switching projects.</p><label class="setting-label">Plan<select data-tier aria-label="Plan">${Object.entries(TIERS).map(([k, v]) => `<option value="${k}" ${tier === k ? "selected" : ""}>${e(v.label)}</option>`).join("")}</select></label><p class="muted">${tier === "pro" ? "Pro: every tool. Lite shows a lock on the Pro ones — switch to see what a Lite user sees." : "Lite: the Pro tools show a lock. A booth made in Pro still draws every part of itself here."} Remembered on this browser; never part of a backup.</p></section>`;
    }
    if (tab === "show") {
      html = p.mode === "photo"
        ? `<div class="panel-heading"><h2>Art show booth</h2>${icon("building-2")}</div><div class="empty-inspector"><p>Switch to the 3D booth to plan an art-show booth. Photo mode composes a photograph, which has its own walls already.</p></div>`
        : artShowHTML();
    }
    if (tab === "walls") {
      html = p.mode === "photo"
        ? `<div class="panel-heading"><h2>Walls and pedestals</h2>${icon("columns-2")}</div><div class="empty-inspector"><p>Free-standing walls and pedestals are measured objects in the 3D booth. Switch to the 3D booth to place them.</p></div>`
        : `<div class="panel-heading"><h2>Walls and pedestals</h2>${icon("columns-2")}</div><p class="muted">Everything that stands on the booth floor: interior display walls you can hang art on, and pedestals you cannot. Both are placed in inches and both can be dragged.</p>${panelFields()}${pedestalFields()}${modelsSection()}`;
    }
    if (tab === "lighting") {
      const photoMode = p.mode === "photo",
        lights = photoMode ? p.photo.lights : p.lights,
        index = photoMode ? photoLightIndex : lightIndex,
        light = lights[index];
      html = `<div class="panel-heading"><h2>${photoMode ? "Photo lighting" : "Lighting studio"}</h2>${icon("lightbulb")}</div><p class="muted">${photoMode ? "Reversible light overlays. A single photo cannot recover geometry or physically relight the booth." : "Light your real geometry. Wall gaps and panel thickness shape the cast shadows."}</p><div class="button-row">${btn("daylight", "Daylight", "sun")}${btn("warm", "Warm", "lightbulb")}</div>${!photoMode ? `<section>${range("Ambient illumination", "ambient", p.ambient, 0, 4, 0.05)}<label class="setting-label">Spotlight fixtures<select aria-label="Spotlight fixtures" data-field="fixtures" data-scope="booth">${Object.entries(FIXTURE_MODES).map(([k, v]) => `<option value="${k}" ${(p.booth.fixtures || DEFAULT_FIXTURES) === k ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label><p class="muted">${showFixtures(p.booth.fixtures, p.booth.envPreset, p.booth.venue) ? "The housings are drawn where each spotlight sits." : `Housings are hidden${isIndoor(p.booth.envPreset, p.booth.venue) ? (p.booth.venue === "artshow" ? " because an art-show booth has its own light bar overhead" : " because this is an indoor environment, where the hall's own track lighting is already in the picture") : ""}. The rail above the booth stays, and the light itself is unchanged.`}</p></section>${isArtShow(p) ? `<section><h3>Light bar</h3><label class="check-field"><input type="checkbox" data-field="on" data-scope="lightBar" ${lightBarSpec(p.booth).on ? "checked" : ""}/>Light bar across the booth</label>${lightBarSpec(p.booth).on ? `${lightBarLevels(lightBarSpec(p.booth))}<p class="muted">The nine heads over an art-show booth. Brightness and diffusion are the two to judge by eye. Brightness is a percentage of a bar judged to read right: 50 is the default, 100 is twice that and already more than anyone wanted. Diffusion opens the beams until they overlap into a wash and fills their shadows, 0 is a bare source, and past 1 the hall's own bounce takes over. The rest of the bar — how many heads, how high — is in the Art show tool.</p>` : `<p class="muted">No bar. The spotlights below still light this booth.</p>`}</section>` : ""}` : ""}${!photoMode ? shadowSection("behind") + shadowSection("under") : ""}<section><h3>${photoMode ? "Light overlays" : "Spotlights"} <span>${lights.length} / ${photoMode ? 8 : 4}</span></h3><div class="light-picker">${lights.map((l, i) => `<span class="light-chip"><button data-light="${i}" class="${index === i ? "active" : ""}">${i + 1}</button><button data-light-eye="${i}" class="eye${lightVisible(l) ? "" : " off"}" title="${lightVisible(l) ? "Hide" : "Show"} ${photoMode ? "overlay" : "spotlight"} ${i + 1}" aria-label="${lightVisible(l) ? "Hide" : "Show"} light ${i + 1}">${icon(lightVisible(l) ? "eye" : "eye-off")}</button></span>`).join("")}${lights.length < (photoMode ? 8 : 4) ? btn("add-light", "Add", "plus", "icon-only") : ""}</div>${light ? `${range("Brightness", "power", light.power, 0, photoMode ? 1 : 300, photoMode ? 0.05 : 5, photoMode ? "photoLight" : "light")}${range("Temperature", "kelvin", light.kelvin, 2700, 6500, 100, photoMode ? "photoLight" : "light", " K")}${photoMode ? `${range("Horizontal", "x", light.x, 0, 1, 0.01, "photoLight")}${range("Vertical", "y", light.y, 0, 1, 0.01, "photoLight")}${range("Radius", "radius", light.radius, 0.02, 0.8, 0.01, "photoLight")}` : `<h4>Light position · inches</h4>${field("Left / right", "x", light.x, -360, 360, 1, "in", "light")}${field("Height", "y", light.y, 0, 160, 1, "in", "light")}${field("Front / back", "z", light.z, -360, 360, 1, "in", "light")}<h4>Aim at · inches</h4>${field("Target X", "tx", light.tx, -360, 360, 1, "in", "light")}${field("Target height", "ty", light.ty, 0, 160, 1, "in", "light")}${field("Target Z", "tz", light.tz, -360, 360, 1, "in", "light")}<p class="muted">Origin: center of floor. +X right, +Z toward the entrance. Height starts at the floor.</p>`}${btn("delete-light", "Remove light", "trash-2", "wide")}` : ""}</section>`;
    }
    if (tab === "video") {
      html = p.mode === "photo"
        ? `<div class="panel-heading"><h2>Video</h2>${icon("video")}</div><div class="empty-inspector"><p>Video records a camera move through the 3D booth. Photo mode has a single photograph and no camera to move, so there is nothing to record. Switch to the 3D booth.</p></div>`
        : `<div class="panel-heading"><h2>Video</h2>${icon("video")}</div><p class="muted">Everything about moving pictures in one place: the move, the clip, the timeline and a batch list. The Export tab keeps the same controls beside the PNG and the guide, and they are the same settings — this is not a second set.</p>${gated("video", videoSection() + batchSection(), "Camera moves, keyframed timelines and batch MP4 export. Part of Booth Studio Pro.")}<section><h3>Stills</h3><p class="muted">The frame you are looking at, as a PNG, without controls or outlines. The full image options are in Export.</p>${btn("export-image", "Export PNG · 4096 px", "download", "wide")}</section>`;
    }
    if (tab === "hall") html = `<div class="panel-heading"><h2>${showFloor ? "Show floor" : "Hall planner"}</h2>${icon("map")}</div>${hallPanel()}`;
    if (tab === "export") {
      html = `<div class="panel-heading"><h2>Export your booth</h2>${icon("download")}</div><p class="muted">A clean image of the current ${p.mode === "photo" ? "photo composition" : "camera view"}, without controls or selection outlines.</p><section><h3>Image size</h3>${p.mode === "photo" ? "" : frameFields("export")}<label class="setting-label">Detail<select id="export-size" aria-label="Export image size">${STILL_SIZES.map((n) => `<option value="${n}" ${exportLong === n ? "selected" : ""}>${n} px on the long side${n <= 1440 ? " · Fast" : n >= 4096 ? " · High resolution" : ""}</option>`).join("")}</select></label><p class="muted">PNG · ${p.mode === "photo" ? "The photograph's own shape. Enlarging a small source cannot restore missing detail." : e(frameNote("export")) + " Preview textures are capped at 2048 px per artwork; originals remain in the backup."}</p>${btn("export-image", "Export PNG", "download", "primary wide")}</section>${p.mode === "photo" ? "" : gated("video", videoSection())}${gated("showPack", `<section><h3>Show pack</h3><p class="muted">For the van: a measured floor plan with every piece numbered and its clearances, the inventory of work with sizes, media and prices, and a packing and load-in checklist worked out from this booth. Open the downloaded HTML to print or save as PDF.</p>${btn("show-pack", "Download show pack", "layers", "wide")}</section>`)}${p.mode === "photo" ? "" : gated("power", powerSection())}${p.mode === "photo" ? "" : gated("glb", `<section><h3>3D model</h3><p class="muted">The booth as a .glb — walls, work, furniture, figures and any models you brought in, in metres — for SketchUp, Blender or an AR viewer. Surroundings, lights and the drawn shadows stay behind.</p>${btn("export-glb", "Download booth as .glb", "box", "wide")}</section>`)}${p.mode === "photo" ? "" : aiSection()}${p.mode === "photo" ? "" : gated("elevations", `<section><h3>Elevations to scale</h3><p class="muted">A floor plan and every wall with work on it, drawn at a real architectural scale with its dimension chain and centre lines — the drawing a carpenter or installer works from. Print at 100%.</p>${btn("elevations", "Download elevations", "ruler", "wide")}</section>`)}${gated("guide", `<section><h3>Installation guide</h3><p class="muted">Measured wall elevations, panel sizes, and left/bottom placement references. Open the downloaded HTML to print or save as PDF. Photo overlays are excluded.</p>${btn("guide", "Download hanging guide", "layout-panel-left", "wide")}</section>`)}<section><h3>Keep your work</h3>${btn("backup", "Download project backup", "save", "wide")}${btn("import", "Open project backup", "folder-open", "wide")}<p class="muted">Includes original artwork and photo files, booth layout, and lighting.</p></section>${p.mode === "photo" ? "" : `<section><h3>Send to the show</h3>${btn("share-design", "Send my booth to the promoter", "send", "primary wide")}<p class="muted">Uploads this booth's design and the images on it — not the rest of your project — and gives you a link to send. The promoter opens it in Booth Studio and puts your booth on their show floor.</p>${btn("send-design", "Download it as a file instead", "download", "wide")}${sentLinksHTML()}</section>`}<section><h3>Preview quality</h3><select id="quality" aria-label="Preview quality (Export)">${qualityOptions()}</select><p class="muted">Auto starts sharp and lowers the detail while it measures this computer drawing slower than it should. The light bar's shadows are drawn live at High detail only; exports always include them. The same menu is under the viewport, beside what it is drawing at now.</p></section>`;
    }
    return html;
  }
  // The two lines under the viewport. Split out of render() because a
  // selection changes both of them and nothing else on the page.
  function renderStatus() {
    document.querySelector("#gesture-hint").textContent = show3d
      ? walking
        ? "Walking the show: WASD or arrows step · Shift strides · drag to look round · Esc stops"
        : panTool
        ? PAN_HINT
        : "Drag to orbit · scroll to zoom · right-drag to pan · W walks the show · Esc back to the plan"
      : showFloor
      ? panTool
        ? PAN_HINT
        : `Drag a piece to move it · drag or right-drag to box-select · ${PAN_KEY} right-drag to pan · Space-drag pans too · scroll to zoom`
      :
      scene?.drawingBox && p.mode !== "photo"
        ? "Box: press on the floor and drag out its footprint · Esc to stop"
        : walking && p.mode !== "photo"
        ? "Walk: W/S or ↑/↓ forward and back · A/D or ←/→ sideways · Shift strides · drag to look round · Esc to stop"
        : scene?.measure.on && p.mode !== "photo"
        ? measureHint
        : panTool && p.mode !== "photo"
        ? PAN_HINT
        : p.mode === "photo"
        ? "Drag artwork to move · drag corners for perspective"
        : scene?.move
          ? scene.snap
            ? "Drag artwork along its wall · snap in 1-inch increments"
            : "Drag artwork along its wall · snapping off"
          : DEFAULT_HINT;
    const selectedArt = p.art.find((a) => a.id === selected);
    document.querySelector("#selection-status").textContent =
      p.mode === "3d"
        ? picked.length > 1
          ? `${picked.length} works selected · arrows move them together`
          : selectedArt
          ? selectedArt.title + (scene?.scaleId === selected ? " · Drag to move · blue corners scale" : " · Double-tap to adjust")
          : "No selection"
        : "";
  }
  function render() {
    if (showFloor && !p.hall) showFloor = false;
    if (show3d && (!showFloor || !scene)) {
      show3d = false;
      [videoTimeline, otherTimeline] = [otherTimeline, videoTimeline];
    }
    const flat = showFloor && !show3d;
    document.querySelector("#project-name").value = p.name;
    document.body.classList.toggle("show-floor-on", showFloor);
    document.body.classList.toggle("show-3d-on", show3d);
    document.querySelector("#show-floor").hidden = !flat;
    document.querySelector("#scene").hidden = p.mode !== "3d" || flat;
    document.querySelector("#photo").hidden = p.mode !== "photo" || showFloor;
    document.querySelector("#photo-empty").hidden =
      p.mode !== "photo" || !!p.photo.asset || showFloor;
    document.querySelector("#view-switch").hidden = p.mode === "photo" || flat;
    document.querySelector(".zoom-controls").hidden = p.mode === "photo";
    document.querySelector("#mode-label").textContent =
      p.mode === "photo" ? "PHOTO COMPOSITION" : "MEASURED WORKSPACE";
    document.querySelector("#scene-title").textContent =
      p.mode === "photo"
        ? "Your booth, reimagined"
        : `${p.booth.width / 12} × ${p.booth.depth / 12} ft / ${p.booth.tent ? "Canopy" : "Open booth"}${liveNumber(p.hall) !== undefined ? ` · Booth ${liveNumber(p.hall)}` : ""}`;
    document.querySelector("#scene-subtitle").textContent =
      p.mode === "photo"
        ? "Original photo + editable overlays"
        : `${p.art.length} panels · ${p.lights.length} spotlights`;
    renderStatus();
    document
      .querySelector('[data-action="mode-3d"]')
      .classList.toggle("active", p.mode === "3d" && !showFloor);
    document
      .querySelector('[data-action="mode-photo"]')
      .classList.toggle("active", p.mode === "photo" && !showFloor);
    document.querySelector('[data-action="mode-show"]').classList.toggle("active", showFloor);
    if (showFloor) {
      if (walking && !show3d) setWalking(false);
      document.querySelector("#mode-label").textContent = show3d ? "SHOW FLOOR · 3D" : "SHOW FLOOR";
      const f = floorOf(p.hall);
      document.querySelector("#scene-title").textContent = `${feet(f.width)} × ${feet(f.depth)} · ${SHOW_VENUES[f.kind]}`;
      document.querySelector("#scene-subtitle").textContent = `${showItems(p.hall).filter((i) => i.kind === "booth").length} booths · ${showItems(p.hall).length} pieces`;
      showEditor ||= createShowEditor(document.querySelector("#show-floor"), {
        hall: () => p.hall,
        edit: (fn) => mutate(() => fn(toFloor(p.hall))),
        onSelect: showSelected,
        grid: () => showGrid,
        panTool: () => panTool,
      });
      if (!show3d) showEditor.render();
    }
    document.querySelector('[data-action="undo"]').disabled = !history.length;
    document.querySelector('[data-action="redo"]').disabled = !future.length;
    if (p.mode !== "3d" && walking) setWalking(false);
    for (const name of ["move", "select", "snap", "walk"])
      document.querySelector(`[data-action="${name}"]`).disabled =
        p.mode === "photo" || !scene || showFloor;
    if (showFloor) tab = "hall";
    renderLibrary();
    renderInspector();
    // The booth's scene is hidden behind the show floor; an edit to the floor
    // is not an edit to it, and rebuilding it for one would be the whole cost
    // of every drag.
    if (!showFloor || show3d) refreshScene();
    syncTools();
    syncSavedViews();
    // On the next frame rather than now: reading the viewport's size straight
    // after the panels were rewritten forced the browser to lay the whole page
    // out in the middle of the edit, which was the largest single cost of a
    // click after the rebuild itself. A size that really changed is also
    // caught by the scene's ResizeObserver.
    if (scene && !render.resizing) {
      render.resizing = true;
      requestAnimationFrame(() => {
        render.resizing = false;
        scene.resize();
      });
    }
  }
  /**
   * The live design as a file to share: every image the booth shows gets its
   * small preview first, so a Lite browser opening the link sees the booth
   * through them.
   */
  async function shareFile() {
    const file = designFile(p);
    for (const [id, asset] of Object.entries(file.assets)) {
      if (asset.thumb || asset.role === "model") continue;
      try {
        const source = await decodeAt(asset.data, asset.width, asset.height, THUMB_MAX);
        file.assets[id] = { ...asset, thumb: thumbnailOf(source, source.width, source.height) };
        source.close?.();
      } catch {}
    }
    return file;
  }
  /** The links this browser has sent, each to copy, send the booth to again, or delete. */
  function sentLinksHTML() {
    const links = sentLinks();
    if (!links.length) return "";
    const day = (iso) => {
      const t = Date.parse(iso || "");
      return Number.isFinite(t) ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
    };
    return `<h4>Links you have sent</h4><ul class="sent-links">${links
      .map(
        (l) =>
          `<li data-sent-link="${e(l.id)}"><div><strong>${e(l.name || "A booth")}</strong><small>${l.sent ? `Sent ${e(day(l.sent))}` : ""}</small></div><div class="button-row">${btn("link-copy-" + l.id, "Copy link", "copy")}${btn("link-update-" + l.id, "Send this booth to it", "send")}${btn("link-delete-" + l.id, "Delete link", "trash-2")}</div></li>`,
      )
      .join("")}</ul><p class="muted">Send this booth to it replaces what the link opens with the booth open now, under the same address, and starts its ${SHARE_DAYS_SHOWN} days again. Delete takes it off the server: the link stops opening. Only this browser can do either.</p>`;
  }
  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      document.execCommand?.("copy");
    }
    toast("Link copied.");
  }
  async function sendToLink(l) {
    if (sharing) return;
    sharing = true;
    try {
      const file = await shareFile();
      toast("Updating the link…");
      await updateShare(l.id, l.key, file, (done, total) => total && toast(`Updating the link… ${done} of ${total} new images`));
      rememberLink({ id: l.id, key: l.key, name: p.name });
      renderInspector();
      toast(`The link now opens ${p.name ? `“${p.name}”` : "this booth"}. Whoever has it sees the change the next time they open it.`);
    } catch (err) {
      toast(`The link could not be updated: ${err.message}`, true);
    } finally {
      sharing = false;
    }
  }
  function removeLink(l) {
    confirmAction("Delete this link?", `The link to ${l.name ? `“${l.name}”` : "this booth"} stops opening, for anyone who has it. A booth already put on a show floor stays there.`, async () => {
      try {
        await deleteShare(l.id, l.key);
      } catch (err) {
        // Already lapsed or deleted: nothing left to delete, so forget it.
        if (!/expired|never existed/.test(err.message)) return toast(`The link could not be deleted: ${err.message}`, true);
      }
      forgetLink(l.id);
      renderInspector();
      toast("Link deleted.");
    });
  }
  /** The link a share made, to copy and send. */
  function showShareLink(link) {
    const d = document.querySelector("#dialog");
    document.querySelector("#dialog-content").innerHTML =
      `<h2>Your booth's link</h2><p>Send this to the show's promoter. It opens your booth in Booth Studio; the link lasts ${SHARE_DAYS_SHOWN} days. Export → Send to the show keeps it, to send a changed booth to the same link or to delete it.</p><input id="share-link" readonly value="${e(link)}" aria-label="Booth link"/><div class="button-row"><button id="share-close">Close</button><button class="primary" id="share-copy">Copy link</button></div>`;
    document.querySelector("#share-close").onclick = () => d.close();
    document.querySelector("#share-copy").onclick = () => {
      document.querySelector("#share-link").select();
      copyLink(link);
    };
    d.showModal();
  }
  /**
   * A booth link opened (`?booth=<id>`): fetch it — originals in Pro, the
   * previews in Lite — and offer what the tier allows. Pro with a show floor
   * puts it on a booth; anyone can look at it, which opens it as its own
   * project after the current one is downloaded as a backup.
   */
  async function openShareLink(id) {
    const pro = allowed("hall");
    let file;
    try {
      toast("Opening the booth link…");
      file = readDesignFile(await downloadShare(id, pro, (done, total) => total && toast(`Opening the booth link… ${done} of ${total} images`)));
    } catch (err) {
      return toast(`That booth link could not be opened: ${err.message}`, true);
    }
    const who = file.name ? `${file.name}` : "A booth";
    const floor = pro && p.hall;
    const numbers = floor ? showItems(p.hall).filter((i) => i.kind === "booth").map((i) => i.number) : [];
    const guess = numbers.includes(file.number) ? file.number : numbers[0];
    const d = document.querySelector("#dialog");
    document.querySelector("#dialog-content").innerHTML =
      `<h2>${e(who)}</h2><p>${pro ? "The booth someone sent you, with its original images." : "A preview of the booth someone sent you. Booth Studio Pro opens it with its original images and puts it on your show floor."}</p>${floor ? `<label class="setting-label">On booth<select id="share-number" aria-label="Booth number">${numbers.map((n) => `<option value="${n}" ${n === guess ? "selected" : ""}>${n}</option>`).join("")}</select></label>` : ""}<div class="button-row"><button id="share-cancel">Not now</button><button id="share-look">Look at it</button>${floor ? '<button class="primary" id="share-place">Put it on my show floor</button>' : ""}</div>`;
    document.querySelector("#share-cancel").onclick = () => d.close();
    document.querySelector("#share-look").onclick = () => {
      d.close();
      backup();
      mutate(() => {
        const next = blankProject();
        next.name = `${file.name || "Shared booth"} · shared`;
        next.assets = file.assets;
        putDesign(next, file.design);
        p = next;
        showFloor = false;
        selected = null;
        tab = "layout";
      });
      scene?.setView("perspective");
      toast(`${who}'s booth is open. Your project was downloaded as a backup first.`);
    };
    if (floor)
      document.querySelector("#share-place").onclick = () => {
        const n = Number(document.querySelector("#share-number").value);
        d.close();
        const go = () => {
          let err = null;
          const live = liveNumber(p.hall) === n;
          mutate(() => {
            err = importDesign(p, n, file);
            if (!err && live) selected = null;
            if (!err) hallSelected = n;
          });
          if (err) return toast(err, true);
          if (!showFloor) actions["mode-show"]();
          toast(`${who}'s booth is on booth ${n}. Open this booth to walk round it.`);
        };
        if (hasDesign(p.hall, n)) confirmAction(`Replace booth ${n}'s design?`, `${who}'s booth replaces the design booth ${n} has now. Undo brings it back.`, go);
        else go();
      };
    d.showModal();
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
  // The user's own floor templates (show.js floorTemplateOf), per browser.
  const FLOOR_TEMPLATE_KEY = "booth.floorTemplates", MAX_FLOOR_TEMPLATES = 12;
  function readFloorTemplates() {
    try {
      const list = JSON.parse(localStorage.getItem(FLOOR_TEMPLATE_KEY) || "[]");
      return Array.isArray(list) ? list.filter(validFloorTemplate) : [];
    } catch {
      return [];
    }
  }
  function writeFloorTemplates(list) {
    try {
      localStorage.setItem(FLOOR_TEMPLATE_KEY, JSON.stringify(list.slice(0, MAX_FLOOR_TEMPLATES)));
      return true;
    } catch {
      return false;
    }
  }
  // The user's own booth templates: the booth without its work, per browser.
  const TEMPLATE_KEY = "booth.templates", MAX_TEMPLATES = 12;
  function readTemplates() {
    try {
      const list = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || "[]");
      return Array.isArray(list) ? list.filter((t) => t && t.id && t.booth && typeof t.label === "string") : [];
    } catch {
      return [];
    }
  }
  function writeTemplates(list) {
    try {
      localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list.slice(0, MAX_TEMPLATES)));
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Quick start: show type, size, starter furniture and a name, and a booth
   * set up from them — or one of the user's saved templates. One form rather
   * than a sequence of steps, because four answers fit on one screen and a
   * wizard's Next button is three clicks nobody needs.
   */
  function openQuickStart() {
    const d = document.querySelector("#dialog");
    const templates = readTemplates();
    const starterLabel = (k) => FURNITURE[k].label;
    document.querySelector("#dialog-content").innerHTML =
      `<div class="panel-heading"><h2>Quick start a booth</h2>${btn("qs-cancel", "Close", "x", "icon-only")}</div><form class="quick-start" id="quick-start" onsubmit="return false"><label class="setting-label">Name<input id="qs-name" maxlength="120" placeholder="e.g. Main Street Art Fair" aria-label="Booth name"/></label>${templates.length ? `<label class="setting-label">Start from<select id="qs-template" aria-label="Start from"><option value="">A new booth, set up below</option>${templates.map((t) => `<option value="${e(t.id)}">My template · ${e(t.label)}</option>`).join("")}</select></label>` : ""}<fieldset id="qs-fresh"><label class="setting-label">What kind of show<select id="qs-show" aria-label="Show type">${Object.entries(SHOWS).map(([k, v]) => `<option value="${k}">${e(v.label)}</option>`).join("")}</select></label><label class="setting-label">Booth size<select id="qs-size" aria-label="Booth size">${Object.entries(FOOTPRINTS).map(([k, v]) => `<option value="${k}">${e(v.label)}</option>`).join("")}</select></label><p class="setting-label">Starter furniture</p><div class="qs-starters">${STARTERS.map((k) => `<label class="check-field"><input type="checkbox" data-starter="${k}" ${k === "table6" || k === "chair" ? "checked" : ""}/>${e(starterLabel(k))}</label>`).join("")}</div></fieldset><label class="check-field"><input type="checkbox" id="qs-backup" checked/>Download a backup of the current booth first</label><p class="muted">Everything here is a starting point: the size, the walls, the furniture and the lighting all stay editable. Your artwork library is not carried over.</p><div class="button-row"><button type="button" data-action="qs-cancel">Cancel</button><button type="button" class="primary" data-action="qs-go">Start this booth</button></div>${templates.length ? `<p class="muted">Remove a saved template: ${templates.map((t) => `<button type="button" class="text-button" data-action="qs-forget-${e(t.id)}">${e(t.label)} ×</button>`).join(" ")}</p>` : ""}</form>`;
    const sync = () => {
      const fresh = document.querySelector("#qs-fresh");
      if (fresh) fresh.disabled = !!document.querySelector("#qs-template")?.value;
    };
    document.querySelector("#qs-template")?.addEventListener("change", sync);
    refreshIcons();
    d.showModal();
  }
  function runQuickStart() {
    const d = document.querySelector("#dialog");
    const name = document.querySelector("#qs-name")?.value || "";
    const templateId = document.querySelector("#qs-template")?.value || "";
    const template = templateId && readTemplates().find((t) => t.id === templateId);
    const next = template
      ? fromTemplate(template, name)
      : quickStart({
          show: document.querySelector("#qs-show").value,
          size: document.querySelector("#qs-size").value,
          furniture: [...document.querySelectorAll("[data-starter]")].filter((x) => x.checked).map((x) => x.dataset.starter),
          name,
        });
    try {
      validateProject(next);
    } catch {
      toast("That template no longer opens in this version. Start a new booth instead.", true);
      return;
    }
    if (document.querySelector("#qs-backup")?.checked) backup();
    d.close();
    mutate(() => {
      p = next;
      selected = null;
      selectedPanel = null;
      selectedPedestal = null;
      tab = "layout";
    });
    scene?.setView("perspective");
    toast(`${p.name} is ready. Upload artwork to start hanging.`);
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
  let artGesture = false;
  let shadowGesture = false;
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
    // 720 px is what this dialog shows; decoding the original at that size is
    // the browser's job, not a full unpack followed by a canvas shrink.
    decodeAt(asset.data, asset.width, asset.height, 720).then(
      (source) => {
        editPreviewSources.set(asset, source);
        paint(source);
      },
      () => {
        if (revision === editPreviewRevision)
          toast("Could not load the editor preview. Your original is still saved.", true);
      },
    );
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
    // Saving the colour a control is showing into the palette. Reading it off
    // the model rather than off the input is what makes the button honest
    // about what it saved when the two could differ.
    "swatch-save": (b) => {
      const [scope, key] = String(b.dataset.target || "").split("|");
      const value = fieldTarget(scope, currentArtwork())?.[key];
      if (!isColor(value)) {
        toast("Choose a colour first.", true);
        return;
      }
      palette = savePalette(palette, value);
      saveViewPrefs();
      renderInspector();
      toast(`${value} saved · ${palette.length} of ${MAX_SWATCHES} colours.`);
    },
    // One edge colour over the whole booth, applied now. The switch above it
    // is the live rule; this is for someone who wants the works themselves
    // changed so they keep the colour when the rule goes off again.
    "edges-to-all": () => {
      const color = p.booth.edgeColor || DEFAULT_EDGE_COLOR;
      let count = 0;
      mutate(() => {
        for (const a of p.art) {
          if (a.kind === "sign" || a.kind === "label") continue;
          if (a.edgeColor === color) continue;
          a.edgeColor = color;
          count += 1;
        }
      });
      toast(count ? `${count} work${count === 1 ? "" : "s"} painted ${color}.` : "Every work already carries that colour.");
    },
    "edit-image": () => {
      const a = currentArtwork();
      if (!a?.asset) return;
      editingStart = snapshot();
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
      p = fromSnapshot(editingStart);
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
    pan: () => setPanTool(!panTool),
    "clear-tapes": () => scene?.clearTapes(),
    select: () => {
      if (panTool) setPanTool(false);
      scene.move = false;
      document.querySelector('[data-action="select"]').classList.add("active");
      document.querySelector('[data-action="move"]').classList.remove("active");
      render();
    },
    move: () => {
      if (panTool) setPanTool(false);
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
    // The tape measure. Its reading goes in the status bar as well as on the
    // tape, so it can be read without hunting for the label.
    measure: () => setMeasuring(!scene?.measure.on),
    draft: () => setDraft(!scene?.draft),
    "row-booth-left": () => addRowBooths("left", 1),
    "row-booth-right": () => addRowBooths("right", 1),
    "row-count-left": () => addRowBooths("left", rowCount()),
    "row-count-right": () => addRowBooths("right", rowCount()),
    "row-space-left": () => addRowSpace("left"),
    "row-space-right": () => addRowSpace("right"),
    "draft-lock": () =>
      setDraftPolicy({ auto: "on", on: "off", off: "auto" }[draftPolicy] || "auto"),
    undo: () => {
      if (!history.length) return;
      future.push(snapshot());
      p = keepKit(fromSnapshot(history.pop()));
      render();
      scheduleSave();
    },
    redo: () => {
      if (!future.length) return;
      history.push(snapshot());
      p = keepKit(fromSnapshot(future.pop()));
      render();
      scheduleSave();
    },
    "mode-3d": () => {
      if (show3d) setShow3d(false);
      showFloor = false;
      mutate(() => (p.mode = "3d"));
    },
    "mode-show": () => {
      if (!allowed("hall")) {
        tab = "hall";
        return render();
      }
      if (!p.hall || !p.hall.items) {
        mutate(() => {
          p.hall = toFloor(p.hall || newHall());
        });
      }
      showFloor = true;
      tab = "hall";
      hallSelected = null;
      render();
      showEditor?.fit();
    },
    "show-exit": () => actions["mode-3d"](),
    "show-3d": () => setShow3d(!show3d),
    "show-walk": () => setWalking(!walking),
    "show-walkthrough": () => {
      if (!show3d) setShow3d(true);
      if (!scene || !show3d) return;
      videoTimeline = normalizeTimeline(showWalkthrough(p.hall, { maxKeys: MAX_KEYS, minSeconds: MIN_SECONDS, maxSeconds: MAX_SECONDS }));
      tlSelected = null;
      tlPlayhead = 0;
      tlBeforeAuto = null;
      actions["edit-timeline"]();
      toast(`A ${videoTimeline.seconds}-second walk through the aisles, ${videoTimeline.keys.length} keyframes. Play it, change any keyframe, then Export MP4.`);
    },
    "show-fit": () => showEditor?.fit(),
    "show-grow": () => {
      let grew = false;
      mutate(() => (grew = growToFit(p.hall)));
      if (!show3d) showEditor?.fit();
      const f = floorOf(p.hall);
      toast(grew ? `The floor is ${Math.round(f.width / 12)}′ × ${Math.round(f.depth / 12)}′ now, with every piece on it. Undo puts it back.` : "Every piece is already on the floor.");
    },
    "show-save-template": () => {
      const t = floorTemplateOf(JSON.parse(JSON.stringify(p.hall)), p.name || "My floor");
      const list = readFloorTemplates();
      const next = [t, ...list.filter((x) => x.label !== t.label)];
      if (writeFloorTemplates(next)) {
        renderInspector();
        toast(`Saved “${t.label}” as a floor template${next.length > MAX_FLOOR_TEMPLATES ? `; the oldest of ${MAX_FLOOR_TEMPLATES} was dropped` : ""}. Start from a template offers it on any floor.`);
      } else toast("This browser would not store the floor template. It may be too big; download a project backup instead.", true);
    },
    "show-rotate": () => showRotate(90),
    "show-flip-x": () => showMirror("x"),
    "show-flip-y": () => showMirror("y"),
    "show-duplicate": () => showDuplicate(),
    "show-delete": () => showDelete(),
    "show-deselect": () => showEditor?.select([]),
    "show-space": () => {
      const pieces = showPieces();
      const moves = spacePieces(pieces, showGap);
      if (!moves.length) return toast("Select two or more pieces to space them.");
      mutate(() => {
        for (const m of moves) Object.assign(p.hall.items.find((i) => i.id === m.id), { x: m.x, y: m.y });
      });
      toast(`${pieces.length} pieces spaced ${showGap}″ apart.`);
    },
    "show-align-top": () => showAlign("t"),
    "show-align-left": () => showAlign("l"),
    "show-renumber": () => {
      const pieces = showPieces().length > 1 ? showPieces() : toFloor(p.hall).items;
      const from = Math.min(...pieces.filter((i) => i.kind === "booth").map((i) => i.number));
      const start = pieces === p.hall.items ? p.hall.start : from;
      const next = renumber(pieces, start);
      // A new number already taken by a booth outside the renumbered ones would
      // be two booths with one number.
      const moving = new Set(next.map((n) => n.id));
      const clash = p.hall.items.some((i) => i.kind === "booth" && !moving.has(i.id) && next.some((n) => n.number === i.number));
      if (clash) return toast("Those numbers are taken by other booths. Renumber the whole floor with nothing selected.", true);
      mutate(() => renumberBooths(next));
      toast(`${next.length} booths renumbered from ${start}, row by row from the back.`);
    },
    "show-add-block": () => {
      const b = showBlock;
      const c = showEditor?.center() || { x: 0, y: 0 };
      const rows = Math.ceil(b.count / Math.max(1, b.perRow));
      const width = Math.min(b.count, b.perRow) * (b.w + b.gap) - b.gap;
      const depth = b.backToBack ? Math.ceil(rows / 2) * (2 * b.d + b.aisle) - b.aisle : rows * (b.d + b.aisle) - b.aisle;
      let ids = [];
      mutate(() => {
        const h = toFloor(p.hall);
        // Below everything already on the floor, an aisle away, so a new block
        // never lands on top of booths already sold; an empty floor centres it.
        const box = boundsOf(h.items);
        const at = box ? { x: box.l, y: box.b + b.aisle } : { x: c.x - width / 2, y: c.y - depth / 2 };
        const block = boothBlock(h.items, { ...b, x: Math.round(at.x / 12) * 12, y: Math.round(at.y / 12) * 12, start: h.start });
        h.items.push(...block);
        ids = block.map((i) => i.id);
      });
      showEditor?.fit();
      showEditor?.select(ids);
      toast(`${ids.length} booths added below the rest and selected — drag them into place.`);
    },
    "mode-photo": () =>
      (show3d && setShow3d(false), mutate(() => {
        showFloor = false;
        p.mode = "photo";
        tab = p.photo.asset ? "art" : "layout";
      })),
    "export-tab": () => {
      tab = "export";
      renderInspector();
    },
    "zoom-in": () => (showFloor && !show3d ? showEditor?.zoom(1.25) : p.mode === "3d" && scene?.zoom(1.2)),
    "zoom-out": () => (showFloor && !show3d ? showEditor?.zoom(1 / 1.25) : p.mode === "3d" && scene?.zoom(1/1.2)),
    "reset-view": () => {
      if (showFloor && !show3d) return showEditor?.fit();
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
        const gone = new Set(picked.length > 1 ? picked : [selected]);
        picked = [];
        p.art = p.art.filter((a) => !gone.has(a.id));
        selected = p.art[0]?.id;
      }),
    center: () =>
      mutate(() => {
        const a = p.art.find((a) => a.id === selected);
        a.x = ((wallSpec(p, a.wall)?.width ?? a.w) - a.w) / 2;
      }),
    // A whole wall at once. Only this face of this wall, in this booth: the
    // outside of a wall and a neighbour's wall are someone else's hang.
    "space-wall": () => arrangeWall((works, wall) => {
      const xs = spaceEvenly(works, wall);
      for (const a of works) a.x = xs[a.id];
      return `${works.length} work${works.length === 1 ? "" : "s"} spaced evenly across the wall.`;
    }),
    "hang-wall": () => arrangeWall((works, wall) => {
      const ys = hangAt(works, wall);
      for (const a of works) a.y = ys[a.id];
      return `${works.length} work${works.length === 1 ? "" : "s"} hung with centres at 60″.`;
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
    "quick-start": () => openQuickStart(),
    "qs-go": () => runQuickStart(),
    "qs-cancel": () => document.querySelector("#dialog").close(),
    "save-template": () => {
      const list = readTemplates();
      const t = templateOf(p, p.name);
      const next = [t, ...list.filter((x) => x.label !== t.label)];
      if (writeTemplates(next))
        toast(`Saved “${t.label}” as a template${next.length > MAX_TEMPLATES ? `; the oldest of ${MAX_TEMPLATES} was dropped` : ""}. Quick start offers it next time. Artwork and images are not included.`);
      else toast("This browser would not store the template. Download a project backup instead.", true);
    },
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
    "show-pack": () => {
      download(
        new Blob([showPack(p)], { type: "text/html" }),
        safeName() + "-show-pack.html",
      );
      toast("Show pack downloaded: floor plan, inventory and packing list. Open it to print or save as PDF.");
    },
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
        // The Video tab offers the same PNG without the size menu beside it,
        // so the menu is read when it is there and the remembered setting
        // used when it is not.
        const long = Number(document.querySelector("#export-size")?.value) || exportLong,
          // A photograph has a shape of its own — its own pixels — and a
          // frame here would crop or letterbox it, so the frame is the 3D
          // booth's alone and photo mode keeps taking a width.
          blob = await (p.mode === "photo"
            ? photo.export(long)
            : scene?.export(long, { frame: exportFrame, custom: customFrame, place: framePlace.export }));
        if (!blob)
          throw new Error(
            "3D is not available. Photo exports and guides still work.",
          );
        download(blob, safeName() + "-" + p.mode + ".png");
        toast(`${long} px PNG exported.`);
      } catch (err) {
        toast(err.message, true);
      } finally {
        busy = false;
        renderInspector();
      }
    },
    "ai-pack": async () => {
      if (busy) return;
      busy = true;
      try {
        const pack = await makeAiPack();
        download(new Blob([JSON.stringify(pack)], { type: "application/json" }), safeName() + "-ai-render.json");
        toast(`AI render pack downloaded: ${pack.width} × ${pack.height} frame, depth and mask, and the scene in words.`);
      } catch (err) {
        toast(err.message, true);
      } finally {
        busy = false;
      }
    },
    "ai-render": async () => {
      if (busy) return;
      busy = true;
      try {
        // With no provider this is where it stops, and says why — before
        // three passes are rendered for nothing; with one, its image comes
        // back as a download.
        const out = await aiRender(aiProvider ? await makeAiPack() : null);
        download(out, safeName() + "-ai.png");
      } catch (err) {
        toast(err.message, true);
      } finally {
        busy = false;
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
    "batch-add": () => addJobs([clipJob(true)]),
    "batch-add-general": () => addJobs([clipJob(false)]),
    "batch-add-still": () => addJobs([stillJob(true)]),
    "batch-add-still-general": () => addJobs([stillJob(false)]),
    // One still per keyframe, each from that keyframe's own view — and its
    // own frame, when the frame is keyframed.
    "batch-add-key-stills": () => {
      const tl = timeline();
      addJobs(
        tl.keys.map((k, i) => ({
          ...stillJob(false, k, k.place ? cleanSettings({ frame: videoFrameShape, custom: customFrame, place: k.place }) : {}),
          name: keyName(i, tl.keys.length),
        })),
      );
    },
    "batch-remove": (button) => {
      if (busyVideo) return;
      const id = button?.closest("[data-job]")?.dataset.job;
      const k = kit();
      setKit({ ...k, queue: k.queue.filter((job) => job.id !== id) });
    },
    "batch-clear": () => {
      if (busyVideo) return;
      setKit({ ...kit(), queue: [] });
    },
    "job-up": (button) => {
      if (busyVideo) return;
      const k = kit();
      const i = k.queue.findIndex((j) => j.id === button?.closest("[data-job]")?.dataset.job);
      if (i < 1) return;
      const queue = [...k.queue];
      [queue[i - 1], queue[i]] = [queue[i], queue[i - 1]];
      setKit({ ...k, queue });
    },
    // Puts a queued clip's settings back in the panel, which is how you check
    // what you queued — and how you edit a queued timeline: load it, change it,
    // remove the old row and add it again.
    "batch-use": (button) => {
      const k = kit();
      const job = k.queue.find((x) => x.id === button?.closest("[data-job]")?.dataset.job);
      if (!job || job.kind !== "clip") return;
      const r = resolveJob(job, k);
      videoMove = r.move;
      videoSeconds = r.seconds;
      videoFps = r.fps;
      videoSize = r.size;
      if (FRAMES[r.frame]) videoFrameShape = r.frame;
      framePlace.video = normalPlace(r.place);
      customFrame = { ...r.custom };
      videoSettle = r.settle;
      saveViewPrefs();
      if (r.timeline) videoTimeline = normalizeTimeline(structuredClone(r.timeline));
      probeCodec();
      refreshPanels();
      toast("Settings loaded into the panel.");
    },
    "job-show": (button) => {
      const job = kit().queue.find((x) => x.id === button?.closest("[data-job]")?.dataset.job);
      if (job?.pose) scene?.applyPose(job.pose);
    },
    // The frame the panel is set to, onto one item: the Video tab's for a
    // clip, the Export tab's for a still.
    "job-take-frame": (button) => {
      const k = kit();
      const id = button?.closest("[data-job]")?.dataset.job;
      setKit({
        ...k,
        queue: k.queue.map((j) => {
          if (j.id !== id) return j;
          const still = j.kind === "still";
          const from = { frame: still ? exportFrame : videoFrameShape, custom: customFrame, place: still ? framePlace.export : framePlace.video };
          return Object.entries(from).reduce((job, [key, v]) => tweak(job, key, v), j);
        }),
      });
    },
    "job-general-frame": (button) => {
      const k = kit();
      const id = button?.closest("[data-job]")?.dataset.job;
      setKit({ ...k, queue: k.queue.map((j) => (j.id === id ? ["frame", "custom", "place"].reduce((job, key) => tweak(job, key, undefined), j) : j)) });
    },
    "job-general": (button) => {
      const k = kit();
      const id = button?.closest("[data-job]")?.dataset.job;
      setKit({ ...k, queue: k.queue.map((j) => (j.id === id ? { ...j, set: {} } : j)) });
    },
    "kit-take-frame": () => {
      const k = kit();
      setKit({ ...k, defaults: { ...k.defaults, ...cleanSettings({ frame: videoFrameShape, custom: customFrame, place: framePlace.video }) } });
      toast("The general frame is now the Video tab's.");
    },
    "preset-save": (button) => {
      const k = kit();
      if (k.presets.length >= MAX_PRESETS) return toast(`${MAX_PRESETS} presets is the limit.`, true);
      const input = button?.closest("section, .preset-new")?.querySelector("[data-preset-name]");
      const name = (input?.value || "").trim().slice(0, 120) || `Timeline ${k.presets.length + 1}`;
      setKit({ ...k, presets: [...k.presets, { id: uid(), name, timeline: structuredClone(timeline()) }] });
      toast(`Saved the timeline as “${name}”.`);
    },
    "preset-load": (button) => {
      const preset = kit().presets.find((x) => x.id === button?.closest("[data-preset]")?.dataset.preset);
      if (!preset) return;
      videoTimeline = normalizeTimeline(structuredClone(preset.timeline));
      videoMove = CUSTOM_MOVE;
      tlBeforeAuto = null;
      refreshPanels();
      toast(`“${preset.name}” loaded into the timeline.`);
    },
    "preset-overwrite": (button) => {
      const k = kit();
      const id = button?.closest("[data-preset]")?.dataset.preset;
      setKit({ ...k, presets: k.presets.map((x) => (x.id === id ? { ...x, timeline: structuredClone(timeline()) } : x)) });
      toast("Preset updated. Every clip using it follows.");
    },
    "preset-apply": (button) => {
      const k = kit();
      const id = button?.closest("[data-preset]")?.dataset.preset;
      const clips = k.queue.filter((j) => j.kind === "clip").length;
      if (!clips) return toast("There are no clips in the batch to give it to. Add one first.", true);
      setKit(applyPreset(k, id));
      toast(`${clips} ${clips === 1 ? "clip uses" : "clips use"} the preset now.`);
    },
    "preset-delete": (button) => {
      const k = kit();
      setKit(removePreset(k, button?.closest("[data-preset]")?.dataset.preset));
    },
    "batch-export": async () => {
      if (busy || busyVideo) return;
      if (!scene) return toast("3D is not available, so there is no view to record.", true);
      const k = kit();
      if (!k.queue.length) return toast("The batch list is empty.", true);
      // A clip on a preset is named after it in its file name, unless it has
      // a name of its own.
      const named = (job) => job.name || (job.preset && k.presets.find((x) => x.id === job.preset)?.name) || undefined;
      await runClips(k.queue.map((job) => ({ ...resolveJob(job, k), name: named(job) })), { batch: true });
    },
    "add-woman": () => addPerson("woman"),
    "add-man": () => addPerson("man"),
    "add-child": () => addPerson("child"),
    "add-pair": () => addPerson("group"),
    "add-wheelchair": () => addPerson("wheelchair"),
    "delete-person": (button) => {
      const id = button?.closest("[data-person]")?.dataset.person;
      mutate(() => (p.booth.people = (p.booth.people || []).filter((x) => x.id !== id)));
    },
    "cancel-video": () => videoAbort?.abort(),
    "edit-timeline": () => {
      if (!scene) return toast("3D is not available, so there is no view to keyframe.", true);
      // Offered whatever move is chosen, not only once Custom is picked from
      // the menu: opening the timeline is choosing Custom.
      if (videoMove !== CUSTOM_MOVE) {
        videoMove = CUSTOM_MOVE;
        renderInspector();
      }
      timeline();
      renderTimelineDialog();
      // show(), not showModal(). A modal would block the viewport, and the
      // viewport is where keyframes come from: the whole loop is compose a
      // shot, press Add, orbit, press Add again.
      const panel = document.querySelector("#timeline-dialog");
      if (!panel.open) panel.show();
      updateFrameGuide();
    },
    "close-timeline": () => {
      document.querySelector("#timeline-dialog").close();
      scene?.clearMoment();
      livePlace = null;
      // Emptied, so the batch and frame controls it repeats are not in the
      // page twice while it is closed.
      document.querySelector("#timeline-content").innerHTML = "";
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
      // Between the last two keys, wherever the end has been slid to.
      const added = { ...keyFrom(position, target), t: (previous + tl.keys.at(-1).t) / 2 };
      // A keyframed frame: the new key takes the frame as it is shown now.
      if (tl.frameKeys) added.place = { ...getPlace("video") };
      videoTimeline = normalizeTimeline({ ...tl, keys: [...tl.keys, added] });
      keyThumbs.set(added.id, grabThumb(added.place || getPlace("video")));
      tlSelected = added.id;
      livePlace = added.place || null;
      tlPlayhead = keySchedule(videoTimeline).find((x) => x.id === added.id)?.arrive ?? tlPlayhead;
      renderTimelineDialog();
      toast(`Keyframe ${videoTimeline.keys.length - 1} captured from this view.`);
    },
    "timeline-select": (button) => {
      const tl = timeline();
      const index = tl.keys.findIndex((k) => k.id === button?.closest("[data-key]")?.dataset.key);
      if (index < 0) return;
      showKey(index);
    },
    // Previous / next keyframe from the playhead: "have a next or prev
    // keyframe arrows to jump to the next keyframe".
    "timeline-prev": () => {
      const i = neighbourKey(timeline(), tlPlayhead, -1);
      if (i >= 0) showKey(i);
    },
    "timeline-next": () => {
      const i = neighbourKey(timeline(), tlPlayhead, 1);
      if (i >= 0) showKey(i);
    },
    "timeline-auto": () => {
      tlBeforeAuto = timeline().keys.map((k) => ({ id: k.id, t: k.t }));
      videoTimeline = autoTime(timeline());
      renderTimelineDialog();
      toast("Keyframes respaced for an even speed.");
    },
    // Auto timing's own undo: the key times from just before it, matched by
    // id so a key added or deleted since is left alone. The timeline is view
    // state outside the project's undo history, so it needs this one.
    "timeline-auto-undo": () => {
      if (!tlBeforeAuto) return;
      const was = new Map(tlBeforeAuto.map((k) => [k.id, k.t]));
      const tl = timeline();
      videoTimeline = normalizeTimeline({ ...tl, keys: tl.keys.map((k) => (was.has(k.id) ? { ...k, t: was.get(k.id) } : k)) });
      tlBeforeAuto = null;
      renderTimelineDialog();
    },
    "timeline-go": (button) => {
      const index = timeline().keys.findIndex((k) => k.id === button?.closest("[data-key]")?.dataset.key);
      if (index >= 0) showKey(index);
    },
    "timeline-recapture": (button) => {
      const id = button?.closest("[data-key]")?.dataset.key;
      const [position, target] = currentPose();
      videoTimeline = normalizeTimeline({
        ...timeline(),
        keys: timeline().keys.map((k) => (k.id === id ? { ...k, position, target } : k)),
      });
      keyThumbs.set(id, grabThumb(timeline().keys.find((k) => k.id === id)?.place || getPlace("video")));
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
          // The timeline's playhead rides along with a custom preview.
          onProgress: custom
            ? (t) => {
                tlPlayhead = t * custom.seconds;
                followPlayhead(custom, t);
                const head = document.querySelector("#timeline-content .tl-playhead");
                if (head) {
                  head.style.left = `${(t * 100).toFixed(3)}%`;
                  head.firstElementChild.textContent = `${tlPlayhead.toFixed(1)}s`;
                }
              }
            : undefined,
        });
        if (!cancelled) toast("That is the move. Export MP4 renders it.");
      } catch (err) {
        toast(err.message, true);
      } finally {
        busyPreview = false;
        if (!timelineOpen()) livePlace = null;
        renderInspector();
      }
    },
    "stop-preview": () => scene?.stopPreview?.(),
    // The timeline's own transport: Play runs the clip from the playhead (from
    // the start when the playhead is at the end), Pause stops it where it is —
    // camera, playhead and fade all left on that moment — so the next Play
    // carries on from there.
    "timeline-play": async () => {
      if (busy || busyVideo || busyPreview || !scene) return;
      const tl = timeline();
      videoMove = CUSTOM_MOVE;
      const from = tlPlayhead >= tl.seconds - 0.05 ? 0 : tlPlayhead / tl.seconds;
      busyPreview = true;
      renderInspector();
      renderTimelineDialog();
      try {
        const { cancelled, t } = await scene.previewMove({
          move: tl,
          seconds: tl.seconds,
          from,
          onProgress: (t) => {
            tlPlayhead = t * tl.seconds;
            followPlayhead(tl, t);
            const head = document.querySelector("#timeline-content .tl-playhead");
            if (head) {
              head.style.left = `${(t * 100).toFixed(3)}%`;
              head.firstElementChild.textContent = `${tlPlayhead.toFixed(1)}s`;
            }
          },
        });
        tlPlayhead = (cancelled ? t : 1) * tl.seconds;
      } catch (err) {
        toast(err.message, true);
      } finally {
        busyPreview = false;
        renderInspector();
        if (document.querySelector("#timeline-dialog")?.open) {
          renderTimelineDialog();
          scene.showMoment(tl, tlPlayhead / tl.seconds);
          followPlayhead(tl, tlPlayhead / tl.seconds);
        }
      }
    },
    "timeline-pause": () => scene?.stopPreview?.({ keep: true }),
    "frame-reset-video": () => {
      setPlace("video", { ...DEFAULT_PLACE });
      saveViewPrefs();
      placeSettled();
    },
    "frame-reset-export": () => {
      framePlace.export = { ...DEFAULT_PLACE };
      saveViewPrefs();
      renderInspector();
    },
    help: () => {
      const d = document.querySelector("#dialog");
      document.querySelector("#dialog-content").innerHTML =
        `<div class="panel-heading"><h2>Welcome to Booth Studio</h2>${btn("close-help", "Close", "x", "icon-only")}</div><p>Start with Layout, upload your original artwork, and enter its actual dimensions. Sample panels are dimension placeholders, not artwork.</p><ol><li><strong>Arrange:</strong> select a work in the library. Set its wall, left edge, and bottom edge. Use Move to drag along the wall, or Center to align.</li><li><strong>Art show booth:</strong> the Art show tool switches this booth to an indoor convention booth — seamless white walls, a light bar with directional heads spotting each wall, and a white exhibition hall around you. Booth size, wall sizes and the individual display panel are all typed in inches there.</li><li><strong>Free-standing walls and pedestals:</strong> add them in the Walls tool, then click a wall — or double-click a pedestal — in the booth to pick it up. Drag it across the floor, or use its left/right and front/back sliders. Snap keeps a drag on whole inches.</li><li><strong>Navigate:</strong> drag empty space to orbit, scroll to zoom, right-drag to pan. On touch, use one finger to orbit and two to pan/zoom. Wall and Plan views give precise views.</li><li><strong>Light:</strong> adjust ambient light and each spotlight’s position, target, power, and temperature.</li><li><strong>Photo:</strong> upload a booth shot, select uploaded library artwork to add it, then drag its four corners. Lighting is a visual overlay. Existing photo objects remain baked in.</li><li><strong>Keep:</strong> autosave is on this browser/device only. Download a full backup to transfer or archive a project.</li><li><strong>Export:</strong> PNG captures the current view; the hanging guide gives measured artwork edges.</li></ol><p class="muted">Ctrl/⌘ Z: undo · Ctrl/⌘ Shift Z: redo · Delete: remove selected artwork · Arrows: nudge 1″ (Shift: 1′) · R / Shift R: turn a pedestal or wall 15° · Ctrl/⌘ D: duplicate · V: select · M: move · T: tape measure · Esc: put the tape away · / or Ctrl/⌘ K: find a tool.</p>${shortcutHelp()}<p class="muted">No AI calls. Single images do not supply surface relief; baked-in lighting remains. Photorealism and exact display color are not guaranteed.</p>`;
      refreshIcons();
      d.showModal();
    },
    "close-help": () => document.querySelector("#dialog").close(),
    // The phone's way into search: the box is in the header, out of a
    // thumb's reach, so a button in the viewport's corner focuses it.
    "find-tool": () => {
      const box = document.querySelector("#tool-search");
      box.focus();
      box.select();
    },
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
          toast(`This prototype supports up to ${MAX_PEDESTALS} pieces of furniture.`, true);
          return;
        }
        const kind = furnitureChoice,
          { label, ...size } = FURNITURE[kind],
          same = list.filter((x) => furnitureKind(x) === kind).length;
        // Near the entrance on the right, where a card table usually stands,
        // rather than in the middle of the floor where it would be in the way
        // of the first thing anyone looks at. Measured from the piece's own
        // size, so an 8′ table lands inside the booth and a pedestal lands
        // exactly where it always did.
        list.push({
          id: uid(),
          name: (kind === "pedestal" ? "Pedestal" : label) + " " + (same + 1),
          ...size,
          ...(kind === "pedestal" ? {} : { kind }),
          x: Math.round(p.booth.width / 2 - size.width / 2 - 6),
          z: Math.round(p.booth.depth / 2 - size.depth / 2 - 18),
          rotation: 0,
        });
        list[list.length - 1] = constrainPedestal(p, list[list.length - 1]);
        selectedPedestal = list[list.length - 1].id;
        selectedPanel = null;
        toast(`${label} added near the entrance. Double-click it in the booth to pick it up, or use the sliders.`);
      }),
    // The one drag back for a booth carrying the brightness default from
    // before the slider was a percentage. It writes the stored unit, not the
    // slider point, because the stored unit is what the light reads.
    "tier-pro": () => setTier("pro"),
    walk: () => setWalking(!walking),
    "hall-start": () => {
      mutate(() => {
        p.hall = newHall();
        tab = "hall";
      });
      if (showFloor) return actions["mode-show"]();
      toast("Hall plan started: two back-to-back rows of eight 10 × 10s. Change the layout below; tap a booth to sell it.");
    },
    "hall-delete": () =>
      confirmAction("Delete the hall plan?", "Every booth's exhibitor, status and price goes with it, and every booth design opened from it except the one open now. Undo brings it back.", () => {
        mutate(() => delete p.hall);
        hallSelected = null;
      }),
    "hall-deselect": () => {
      hallSelected = null;
      renderInspector();
    },
    "hall-mine": () =>
      mutate(() => setMine(p.hall, p.hall.mine === hallSelected ? undefined : hallSelected)),
    "show-open-booth": () => {
      const n = hallSelected;
      if (!p.hall || !Number.isInteger(n)) return;
      if (liveNumber(p.hall) === n) return actions["mode-3d"]();
      let err = null;
      const fresh = !hasDesign(p.hall, n);
      if (show3d) setShow3d(false);
      mutate(() => {
        err = openBooth(p, n);
        if (err) return;
        showFloor = false;
        p.mode = "3d";
        selected = null;
        tab = "layout";
      });
      if (err) return toast(err, true);
      toast(fresh ? `Booth ${n} opened as a new design, sized from the floor. The booth you had open is kept with its booth; Show floor → any booth opens it again.` : `Booth ${n}'s design is open. The one you had open is kept with its booth.`);
    },
    "share-design": async () => {
      if (sharing) return;
      sharing = true;
      try {
        const file = await shareFile();
        toast("Uploading your booth…");
        const { id, key } = await uploadShare(file, (done, total) => total && toast(`Uploading your booth… ${done} of ${total} images`));
        rememberLink({ id, key, name: p.name });
        renderInspector();
        showShareLink(shareLink(id));
      } catch (err) {
        toast(`The booth could not be shared: ${err.message}`, true);
      } finally {
        sharing = false;
      }
    },
    "send-design": () => {
      download(new Blob([JSON.stringify(designFile(p))], { type: "application/json" }), safeName() + ".booth-design.json");
      toast("Booth design downloaded. Send the file to the show's promoter; they import it onto your booth number.");
    },
    "import-design": () => {
      if (!p.hall || !Number.isInteger(hallSelected)) return;
      designTarget = hallSelected;
      document.querySelector("#design-input").click();
    },
    "show-open-own": () => {
      if (!p.hall?.designs?.[OWN]) return;
      let err = null;
      if (show3d) setShow3d(false);
      mutate(() => {
        err = openBooth(p, OWN);
        if (!err) (showFloor = false), (p.mode = "3d"), (selected = null);
      });
      if (err) toast(err, true);
      else toast("Your own booth — the one on no booth of this floor — is open again.");
    },
    "hall-map": () => {
      if (!p.hall) return;
      download(new Blob([hallHTML(p.hall, p.name)], { type: "text/html" }), safeName() + "-hall-map.html");
      toast("Hall map downloaded: the map, a legend, totals and every booth. Open it to print.");
    },
    "hall-csv": () => {
      if (!p.hall) return;
      download(new Blob([hallCSV(p.hall)], { type: "text/csv" }), safeName() + "-exhibitors.csv");
      toast("Exhibitor list downloaded as CSV — it opens in any spreadsheet.");
    },
    "power-sheet": () => {
      download(new Blob([powerHTML(p, { outlets: powerOutlets })], { type: "text/html" }), safeName() + "-power-and-rentals.html");
      toast("Power and rentals sheet downloaded. Correct anything on the printout before sending it to the show.");
    },
    "draw-box": () => setDrawingBox(!scene?.drawingBox),
    "upload-model": () => document.querySelector("#model-input").click(),
    "export-glb": async () => {
      if (busy || !scene) return;
      busy = true;
      try {
        toast("Writing the booth as .glb…");
        const blob = await scene.exportGLB();
        download(blob, safeName() + ".glb");
        toast(`Booth exported as .glb · ${(blob.size / 1048576).toFixed(1)} MB. Opens in SketchUp (with the glTF importer), Blender and AR viewers.`);
      } catch (err) {
        toast(err.message || "The .glb could not be written.", true);
      } finally {
        busy = false;
      }
    },
    "upload-underlay": () => document.querySelector("#underlay-input").click(),
    "remove-underlay": () =>
      mutate(() => {
        const id = p.booth.underlay?.asset;
        delete p.booth.underlay;
        // The image is only the plan's: nothing else can be using it.
        if (id && !p.art.some((a) => a.asset === id) && !assetInDesigns(p, id)) delete p.assets[id];
      }),
    "underlay-scale": () => {
      const u = p.booth.underlay;
      const pts = scene?.measure.points;
      if (!u || pts?.length !== 2) return toast("Measure a known distance on the plan with the tape (T) first.", true);
      const taped = distanceInches(pts[0], pts[1], 0.0254);
      const real = Number(document.querySelector("#underlay-real")?.value);
      if (!(taped > 0.5) || !(real > 0)) return toast("Type the real length of the distance you taped.", true);
      const factor = real / taped;
      const width = Math.max(12, Math.min(24000, u.width * factor));
      // Scaled about the tape's start, so the point that was measured from
      // stays under the cursor and the booth does not slide off the plan.
      const ox = pts[0].x / 0.0254, oz = pts[0].z / 0.0254;
      mutate(() => {
        u.width = Math.round(width * 100) / 100;
        u.x = Math.round((ox + (u.x - ox) * factor) * 100) / 100;
        u.z = Math.round((oz + (u.z - oz) * factor) * 100) / 100;
      });
      scene.setMeasuring(false);
      syncTools();
      toast(`Plan scaled ×${factor.toFixed(3)}: the taped distance now measures ${formatLength(real)}.`);
    },
    elevations: () => {
      download(new Blob([elevationsHTML(p)], { type: "text/html" }), safeName() + "-elevations.html");
      toast("Elevations downloaded: a floor plan and every hung wall, to scale. Print at 100%.");
    },
    "view-save": () => {
      if (!scene) return;
      const views = p.views || [];
      if (views.length >= MAX_VIEWS) return toast(`${MAX_VIEWS} views is the limit.`, true);
      const v = newView(scene.pose(), uid(), views);
      mutate(() => (p.views = [...views, v]));
      toast(`Saved as “${v.name}”. Rename it in the list; the View menu under the booth goes back to it.`);
    },
    "views-export": async () => {
      if (busy || !scene) return;
      const views = p.views || [];
      if (!views.length) return;
      busy = true;
      const back = scene.pose();
      try {
        for (const [i, v] of views.entries()) {
          toast(`Rendering ${i + 1} of ${views.length}: ${v.name}…`);
          scene.applyPose(v);
          const blob = await scene.export(exportLong, { frame: exportFrame, custom: customFrame, place: framePlace.export });
          if (blob) download(blob, `${safeName()}-${v.name.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "") || "view-" + (i + 1)}.png`);
        }
        toast(`${views.length} views exported as ${exportLong} px PNGs.`);
      } catch (err) {
        toast(err.message, true);
      } finally {
        scene.applyPose(back);
        busy = false;
      }
    },
    ...Object.fromEntries(Object.keys(ALIGN_MODES).map((mode) => ["align-" + mode, () => arrangePicked((works) => alignWorks(works, mode), "align")])),
    "distribute-x": () => arrangePicked((works) => distributeWorks(works, "x"), "distribute"),
    "distribute-y": () => arrangePicked((works) => distributeWorks(works, "y"), "distribute"),
    "clear-multi": () => {
      picked = [];
      addMode = false;
      renderSelection();
    },
    "multi-mode": () => {
      addMode = !addMode;
      renderInspector();
      toast(addMode ? "Select several: tap works to add them. Done selecting ends it." : picked.length > 1 ? `${picked.length} works selected.` : "Back to one at a time.");
    },
    "sheet-toggle": () => setSheet(!document.body.classList.contains("sheet-collapsed")),
    "bar-default": () =>
      mutate(() => {
        p.booth.lightBar = { ...lightBarSpec(p.booth), power: LIGHT_BAR.power };
        toast("Fixture brightness set to 50.");
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
  // A booth on the hall map is an SVG group, not a button.
  document.addEventListener("click", (ev) => {
    const cell = ev.target.closest?.("[data-hall-booth]");
    if (!cell || cell.closest("#show-floor")) return;
    hallSelected = Number(cell.dataset.hallBooth);
    renderInspector();
  });
  document.addEventListener("keydown", (ev) => {
    const cell = ev.target.closest?.("[data-hall-booth]");
    if (!cell || (ev.key !== "Enter" && ev.key !== " ")) return;
    ev.preventDefault();
    hallSelected = Number(cell.dataset.hallBooth);
    renderInspector();
    document.querySelector(`[data-hall-booth="${hallSelected}"]`)?.focus();
  });
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.action) {
      try {
        const action = b.dataset.action;
        // The one gate every Pro action passes: whatever drew the button, a
        // Lite browser gets the reason instead of the tool.
        const feature = actionFeature(action);
        if (feature && !allowed(feature)) {
          toast(`${PRO_FEATURES[feature]} is part of Booth Studio Pro. Layout → Project → Plan switches to Pro.`, true);
          return;
        }
        if (action.startsWith("row-remove-")) removeRowSlot(action.slice(11));
        else if (/^link-(copy|update|delete)-/.test(action)) {
          const [, what, id] = action.match(/^link-(\w+)-(.+)$/);
          const l = sentLinks().find((x) => x.id === id);
          if (!l) renderInspector();
          else if (what === "copy") copyLink(shareLink(l.id));
          else if (what === "update") sendToLink(l);
          else removeLink(l);
        }
        else if (action.startsWith("view-go-")) goToView(action.slice(8));
        else if (action.startsWith("clearance-show-")) showClearance(Number(action.slice(15)));
        else if (action.startsWith("delete-model-")) {
          const id = action.slice(13);
          mutate(() => {
            const gone = (p.booth.models || []).find((m) => m.id === id);
            p.booth.models = (p.booth.models || []).filter((m) => m.id !== id);
            if (!p.booth.models.length) delete p.booth.models;
            // The file goes with its last placement.
            if (gone && !(p.booth.models || []).some((m) => m.asset === gone.asset) && !assetInDesigns(p, gone.asset)) delete p.assets[gone.asset];
          });
        }
        else if (action.startsWith("view-update-")) {
          const id = action.slice(12);
          const pose = scene?.pose();
          if (pose) mutate(() => (p.views = (p.views || []).map((v) => (v.id === id ? { ...v, ...newView(pose, id), name: v.name } : v))));
          toast("View replaced with what the camera shows now.");
        }
        else if (action.startsWith("view-delete-")) {
          const id = action.slice(12);
          mutate(() => {
            p.views = (p.views || []).filter((v) => v.id !== id);
            if (!p.views.length) delete p.views;
          });
        }
        else if (action.startsWith("delete-panel-")) deletePanel(action.slice(13));
        else if (action.startsWith("delete-pedestal-")) deletePedestal(action.slice(16));
        else if (action.startsWith("show-template-")) applyTemplate(action.slice(14));
        else if (action.startsWith("show-mytemplate-")) {
          const t = readFloorTemplates().find((x) => x.id === action.slice(16));
          if (t && p.hall) startFrom(t.label, () => ({ venue: { ...t.venue }, items: t.items.map((it) => ({ ...it })) }));
        } else if (action.startsWith("show-forget-template-")) {
          writeFloorTemplates(readFloorTemplates().filter((x) => x.id !== action.slice(21)));
          renderInspector();
        }
        else if (action.startsWith("qs-forget-")) {
          writeTemplates(readTemplates().filter((t) => t.id !== action.slice(10)));
          openQuickStart();
        }
        else actions[action]?.(b);
      } catch (err) {
        toast(err.message, true);
      }
    }
    if (b.dataset.tab) {
      // On a phone a folded panel comes back when a tab is chosen: choosing
      // one is asking to see it.
      setSheet(false);
      tab = b.dataset.tab;
      renderInspector();
    }
    if (b.dataset.source) addCatalogPlacement(b.dataset.source);
    if (b.dataset.layer) {
      photoSelected = b.dataset.layer;
      renderInspector();
      photo.update(p, photoSelected);
    }
    if (b.dataset.walk) {
      const [f, r] = { forward: [1, 0], back: [-1, 0], left: [0, -1], right: [0, 1] }[b.dataset.walk] || [0, 0];
      scene?.walk(f, r, STRIDE / 2);
      return;
    }
    if (b.dataset.view) {
      if (walking) setWalking(false);
      scene?.setView(b.dataset.view);
      document
        .querySelectorAll("[data-view]")
        .forEach((x) => x.classList.toggle("active", x === b));
    }
    if (b.dataset.color) mutate(() => (p.booth.color = b.dataset.color));
    // A saved colour, applied to the control it sits under. Shift-click takes
    // it out of the palette instead: seven slots is few enough that one
    // colour nobody wants any more is a seventh of the palette.
    if (b.dataset.swatch && b.dataset.target) {
      if (ev.shiftKey && !b.classList.contains("swatch-previous")) {
        palette = removeSwatch(palette, b.dataset.swatch);
        saveViewPrefs();
        renderInspector();
      } else applyColor(b.dataset.target, b.dataset.swatch);
    }
    // The eye beside a spotlight. Hiding one keeps its position, its aim and
    // its power — deleting it, which used to be the only way to take a light
    // out of a composition, threw all three away.
    if (b.dataset.lightEye !== undefined) {
      const index = +b.dataset.lightEye;
      const list = p.mode === "photo" ? p.photo.lights : p.lights;
      const light = list[index];
      if (light) {
        mutate(() => (light.on = !lightVisible(light)));
        toast(lightVisible(light) ? `Spotlight ${index + 1} showing.` : `Spotlight ${index + 1} hidden. Its position and aim are kept.`);
      }
      return;
    }
    // Lock a floor piece: still drawn, no longer picked in the viewport, so a
    // box laid down as a stage or a floor can be clicked through. Only this
    // button and the piece's own controls change it.
    if (b.dataset.lockPedestal) {
      const id = b.dataset.lockPedestal,
        item = boothPedestals(p).find((x) => x.id === id);
      if (!item) return;
      const lock = !item.locked;
      mutate(() => {
        if (lock) item.locked = true;
        else delete item.locked;
        if (lock && selectedPedestal === id) selectedPedestal = null;
      });
      toast(lock ? "Locked. Clicks in the booth pass through it; change it here, or unlock it." : "Unlocked. Click it in the booth to select it again.");
      return;
    }
    // Hide a piece rather than delete it. Letting go of it too, if it was the
    // one selected: its controls stay in the list, but there is nothing left
    // in the viewport for a selection outline or a drag to point at.
    if (b.dataset.hide) {
      const kind = b.dataset.hide,
        id = b.dataset.hideId;
      const list = kind === "pedestal" ? boothPedestals(p) : kind === "panel" ? boothPanels(p) : kind === "model" ? p.booth.models || [] : p.booth.people || [];
      const item = list.find((x) => x.id === id);
      if (!item) return;
      const hide = isShown(item);
      mutate(() => {
        if (hide) item.hidden = true;
        else delete item.hidden;
        if (hide && kind === "pedestal" && selectedPedestal === id) selectedPedestal = null;
        if (hide && kind === "panel" && selectedPanel === panelKey(id)) selectedPanel = null;
      });
      const what = { pedestal: "Piece", panel: "Free-standing wall", person: "Figure", model: "Model" }[kind] || "Piece";
      toast(hide ? `${what} hidden. Its size and place are kept; the eye brings it back.` : `${what} showing again.`);
      return;
    }
    // The eye in a drawn shadow's heading. Hidden keeps every setting, so
    // the second shadow can be set up before it is shown.
    if (b.dataset.shadowEye) {
      const kind = b.dataset.shadowEye;
      if (!SHADOW_KINDS.includes(kind)) return;
      mutate(() => {
        const record = (p.booth[SHADOW_FIELD[kind]] = shadowSpec(p.booth, kind));
        record.on = !record.on;
      });
      const on = shadowSpec(p.booth, kind).on;
      toast(`${kind === "behind" ? "Drop shadow" : "Second shadow"} ${on ? "showing" : "hidden. Its settings are kept"}.`);
      return;
    }
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

  document.querySelector("#model-input").onchange = async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    if (!allowed("glb")) return toast("3D model import is part of Booth Studio Pro.", true);
    try {
      if (!/\.glb$/i.test(file.name)) throw new Error("Choose a .glb file — binary glTF, which SketchUp, Blender and most scanners export.");
      if (file.size > 28 * 1024 * 1024) throw new Error("That model is over 28 MB. Simplify or compress it and try again.");
      const models = p.booth.models || [];
      if (models.length >= MAX_MODELS) throw new Error(`${MAX_MODELS} models is the limit.`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      // glTF binary files start "glTF".
      if (String.fromCharCode(...bytes.slice(0, 4)) !== "glTF") throw new Error("That file is not a binary glTF (.glb).");
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;/, "data:model/gltf-binary;"));
        reader.onerror = () => reject(new Error("The model could not be read."));
        reader.readAsDataURL(new Blob([bytes], { type: "model/gltf-binary" }));
      });
      const assetId = uid();
      const model = { id: uid(), asset: assetId, name: file.name.replace(/\.glb$/i, "").slice(0, 120), height: 36, x: 0, z: 0, rotation: 0 };
      mutate(() => {
        p.assets[assetId] = { name: file.name, width: 1, height: 1, role: "model", data };
        p.booth.models = [...models, model];
        tab = "walls";
      });
      toast(`${model.name} stands in the booth at 36″. Type its real height in the Walls tool.`);
    } catch (err) {
      toast(err.message, true);
    }
  };
  document.querySelector("#underlay-input").onchange = async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    if (!allowed("underlay")) return toast("The floor plan underlay is part of Booth Studio Pro.", true);
    try {
      if (Object.keys(p.assets).length >= 250) throw new Error("This prototype supports up to 250 images.");
      const asset = await readImage(file);
      mutate(() => {
        const old = p.booth.underlay?.asset;
        if (old && !p.art.some((a) => a.asset === old) && !assetInDesigns(p, old)) delete p.assets[old];
        const id = uid();
        asset.role = "underlay";
        p.assets[id] = asset;
        // A first guess: the plan ten times the booth's width, centred on it.
        // The tape and Scale plan set the real scale.
        p.booth.underlay = { asset: id, width: Math.min(24000, p.booth.width * 10), x: 0, z: 0, rotation: 0, opacity: 0.6, on: true };
      });
      scene?.setView("plan");
      document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === "plan"));
      toast("Floor plan laid under the booth. Measure something you know with the tape (T), then Scale plan.");
    } catch (err) {
      toast(err.message, true);
    }
  };
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

  /**
   * Which object a control's `data-scope` is about. One function, because the
   * inspector writes to these from two places now — a typed field or a slider,
   * and a colour chosen from the saved palette — and two copies of this
   * ternary would be two answers to "what a pedestal's scope means".
   *
   * The three derived records (the panel module, the light bar, the hall) are
   * written back as they are read, which is what upgrades a booth saved
   * before they existed the first time one is touched.
   */
  function fieldTarget(scope, art) {
    return (
        scope === "art"
          ? art
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
            : scope === "underlay"
              ? p.booth.underlay
            : scope === "hallplan"
              ? p.hall
            : scope === "hallbooth"
              ? p.hall && hallSelected !== null ? (p.hall.booths[hallSelected] ||= {}) : null
            : scope?.startsWith("model-")
              ? (p.booth.models || []).find((m) => m.id === scope.slice(6))
            : SHADOW_KINDS.some((kind) => SHADOW_FIELD[kind] === scope)
              ? (p.booth[scope] = shadowSpec(p.booth, SHADOW_KINDS.find((kind) => SHADOW_FIELD[kind] === scope)))
              : scope === "light"
                ? p.lights[lightIndex]
                : scope === "photoLight"
                  ? p.photo.lights[photoLightIndex]
                  : scope === "photoLayer"
                    ? p.photo.layers.find((l) => l.id === photoSelected)
                    : scope === "photo"
                      ? p.photo
                      : p
    );
  }
  /**
   * Setting one colour control from the palette. It goes through the same
   * `fieldTarget` a typed change does, and takes the same undo step, so a
   * colour chosen from a swatch and a colour chosen from the system picker
   * are one edit in two clothes.
   */
  function applyColor(targetKey, color) {
    if (!isColor(color)) return;
    const [scope, key] = String(targetKey).split("|");
    mutate(() => {
      const a = p.art.find((x) => x.id === selected);
      const target = fieldTarget(scope, a);
      if (!target) return;
      colorHistory = rememberColor(colorHistory, targetKey, target[key]);
      target[key] = color;
      if (scope === "art" && key === "edgeColor") rememberEdge(target);
    });
    saveViewPrefs();
  }
  /**
   * The finish the next original hung on a wall inherits: the last edge
   * colour, edge material and thickness someone chose. Per browser, like the
   * palette — it is how this person frames work, not something about one
   * booth — and it is only ever a starting value, which every placement is
   * free to change afterwards.
   */
  function rememberEdge(a) {
    if (!a) return;
    lastEdge = {
      edgeColor: isColor(a.edgeColor) ? a.edgeColor : lastEdge?.edgeColor,
      edgeTexture: a.edgeTexture || lastEdge?.edgeTexture,
      thickness: Number.isFinite(a.thickness) ? a.thickness : lastEdge?.thickness,
    };
    saveViewPrefs();
  }
  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (showChange(el)) return;
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
    // A drawn shadow's slider or typed number: the input handler already
    // made the change live and took its checkpoint.
    if (el.dataset.fxLive !== undefined) {
      setShadowLive(el.dataset.scope, el.dataset.field, el.value, el);
      endShadowGesture();
      syncShadowInputs();
      return;
    }
    // The work's own position sliders: the move already happened live, so
    // this closes the gesture out and saves it, exactly as a panel's does.
    if (el.type === "range" && el.dataset.scope === "art-position") {
      artGesture = false;
      scheduleSave();
      return;
    }
    // A figure's sliders, the same way: the scene is already up to date, so
    // this only ends the gesture and redraws the panel's own readouts.
    if (el.type === "range" && el.dataset.scope?.startsWith("person-")) {
      personGesture = false;
      renderInspector();
      scheduleSave();
      return;
    }
    if (el.id === "project-name") {
      mutate(() => (p.name = el.value.trim() || "Untitled booth"));
      return;
    }
    if (el.id === "furniture-kind") {
      if (FURNITURE[el.value]) furnitureChoice = el.value;
      renderInspector();
      return;
    }
    if (el.id === "quality" || el.id === "quality-quick") {
      quality = el.value === AUTO_QUALITY ? AUTO_QUALITY : +el.value;
      // Choosing Auto again starts it over from the top, so a machine that
      // has since been freed up gets to measure its way back to sharp.
      if (quality === AUTO_QUALITY) autoScale = null;
      scene?.setQuality(quality, quality === AUTO_QUALITY ? startScale(devicePixelRatio) : undefined);
      scene?.resize();
      saveViewPrefs();
      syncQuality();
      return;
    }
    // Video settings are view state, not project state: they are not saved
    // with the booth and do not belong in the undo history.
    // The batch queue's settings. Saved with the project, outside the undo
    // history: see setKit.
    if (el.dataset.kitDefault) {
      const k = kit();
      const key = el.dataset.kitDefault;
      setKit({ ...k, defaults: { ...k.defaults, ...cleanSettings({ [key]: key === "settle" ? el.checked : el.value }) } });
      return;
    }
    if (el.dataset.jobSet || el.dataset.jobMove !== undefined || el.dataset.jobName !== undefined) {
      const k = kit();
      const id = el.closest("[data-job]")?.dataset.job;
      const job = k.queue.find((j) => j.id === id);
      if (!job) return;
      let next = job;
      if (el.dataset.jobSet) next = tweak(job, el.dataset.jobSet, el.value === "" ? undefined : el.value);
      else if (el.dataset.jobName !== undefined) next = { ...job, name: el.value.trim().slice(0, 120) || undefined };
      else if (el.value.startsWith("preset:")) next = { ...job, move: KIT_CUSTOM, preset: el.value.slice(7) };
      else if (el.value === "own") next = { ...job, move: KIT_CUSTOM, preset: undefined };
      else if (MOVES[el.value]) next = { ...job, move: el.value, preset: undefined, seconds: job.move === el.value ? job.seconds : resolveMove(el.value).seconds };
      setKit({ ...k, queue: k.queue.map((j) => (j.id === id ? next : j)) });
      return;
    }
    if (el.id === "timeline-frame-keys") {
      const tl = timeline();
      // On: every keyframe starts from the frame as it is now, and is then
      // its own. Off: the keyframes' frames are dropped and the Video tab's
      // placement holds for the whole clip.
      const keys = el.checked ? tl.keys.map((k) => ({ ...k, place: { ...framePlace.video } })) : tl.keys;
      videoTimeline = normalizeTimeline({ ...tl, keys, frameKeys: el.checked });
      livePlace = null;
      placeSettled();
      return;
    }
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
    if (el.id === "timeline-flow") {
      videoTimeline = normalizeTimeline({ ...timeline(), flow: el.value });
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
        if (el.dataset.keyField === "t") return { ...k, t: keyTAt(tl, tl.keys.indexOf(k), +el.value) };
        if (el.dataset.keyField === "hold") return { ...k, hold: +el.value };
        return { ...k, ease: el.value };
      });
      videoTimeline = normalizeTimeline({ ...tl, keys });
      // The playhead goes with a retimed key, as it does when one is dragged,
      // so the previous / next arrows count from where the key now is.
      if (el.dataset.keyField === "t") {
        const i = videoTimeline.keys.findIndex((k) => k.id === el.dataset.key);
        if (i >= 0) tlPlayhead = keySchedule(videoTimeline)[i].arrive;
      }
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
    if (el.id === "export-size") {
      const value = Number(el.value);
      if (STILL_SIZES.includes(value)) exportLong = value;
      saveViewPrefs();
      renderInspector();
      return;
    }
    if (el.id === "video-size") {
      videoSize = el.value;
      probeCodec();
      renderInspector();
      return;
    }
    // The frame, the custom pixel size and careful rendering. All three are
    // view settings: they say what the delivered file is, never what the
    // booth is, so none of them goes through `mutate` or marks anything dirty.
    if (el.dataset.frame) {
      const value = FRAMES[el.value] ? el.value : DEFAULT_FRAME;
      if (el.dataset.frame === "video") videoFrameShape = value;
      else exportFrame = value;
      saveViewPrefs();
      refreshPanels();
      return;
    }
    if (el.dataset.framePlace) {
      saveViewPrefs();
      placeSettled();
      return;
    }
    if (el.dataset.frameCustom) {
      const side = Math.max(FRAME_MIN, Math.min(FRAME_MAX, Math.round(Number(el.value) || 0)));
      customFrame = { ...customFrame, [el.dataset.frameCustom]: side };
      saveViewPrefs();
      refreshPanels();
      return;
    }
    if (el.dataset.videoSettle !== undefined) {
      videoSettle = el.checked;
      saveViewPrefs();
      renderInspector();
      return;
    }
    // Fast edit is not a field: it is a view setting with no home in the
    // project, so it never reaches `mutate` and never marks anything dirty.
    if (el.dataset.draft !== undefined) {
      setDraft(el.checked);
      return;
    }
    if (el.id === "power-outlets") {
      powerOutlets = Math.max(0, Math.min(20, Math.round(Number(el.value) || 0)));
      renderInspector();
      return;
    }
    if (el.dataset.tag !== undefined) {
      if (el.checked) hiddenTags.delete(el.dataset.tag);
      else hiddenTags.add(el.dataset.tag);
      scene?.setHiddenTags(hiddenTags);
      return;
    }
    if (el.dataset.viewName !== undefined) {
      const name = el.value.trim().slice(0, 120);
      if (name) mutate(() => (p.views = (p.views || []).map((v) => (v.id === el.dataset.viewName ? { ...v, name } : v))));
      else renderInspector();
      return;
    }
    if (el.id === "saved-view") {
      if (el.value) goToView(el.value);
      el.value = "";
      return;
    }
    if (el.dataset.tier !== undefined) {
      setTier(el.value);
      return;
    }
    if (el.dataset.draftPolicy !== undefined) {
      setDraftPolicy(el.value);
      return;
    }
    // Which booth of the row the next original is hung in. A view setting too:
    // it is where the next tap lands, not anything about the booth.
    if (el.dataset.rowActive !== undefined) {
      const row = normalizeRow(p.booth);
      activeBooth = el.value === row.home ? null : el.value;
      renderInspector();
      renderStatus();
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
    // A slider may show a scale of its own rather than the stored unit —
    // Fixture brightness is a percentage of a bar that reads right, where the
    // stored unit is a light's power and always will be. `data-scale` is how
    // many stored units one point of the slider is worth, so this is the one
    // place the two meet and everything past it sees the stored number.
    const scale = Number(el.dataset.scale) || 1;
    const value =
      el.type === "checkbox"
        ? el.checked
        : ["number", "range"].includes(el.type)
          ? Number(el.value) * scale
          : el.value;
    mutate(() => {
      // Switching venue rewrites the footprint, the walls and the finish
      // together: half an art-show booth — 12ft walls under a canopy — is not
      // a booth anyone is planning.
      // The row: the gap between slots, and a space's own width. Both rewrite
      // the whole row record, because a row is one value and normalizing it
      // is what guarantees a home booth is still in it.
      if (scope === "row" && key === "gap") {
        p.booth.row = { ...normalizeRow(p.booth), gap: Math.max(0, Math.min(MAX_GAP, Number(value))) };
        return;
      }
      if (String(scope).startsWith("space-") && key === "width") {
        p.booth.row = setSpaceWidth(p.booth, String(scope).slice(6), Number(value));
        return;
      }
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
      // Moving a work from one booth of the row to another. The walls are the
      // same measurements in every booth, so it keeps its wall, its face and
      // its position on that wall — only which booth is drawing it changes.
      if (scope === "art" && key === "inBooth" && a) {
        const home = normalizeRow(p.booth).home;
        a.booth = String(value) === home ? undefined : String(value);
        activeBooth = a.booth || null;
        return;
      }
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
      const target = fieldTarget(scope, a);
      // The colour this control held before the one it is about to hold, for
      // the Previous button beside it, and the edge finish the next work
      // inherits. Both are per browser and neither is part of the edit.
      if (target && el.type === "color") colorHistory = rememberColor(colorHistory, `${scope}|${key}`, target[key]);
      if (target) target[key] = value;
      if (scope === "art" && ["edgeColor", "edgeTexture", "thickness"].includes(key)) rememberEdge(target);
      if (el.type === "color" || scope === "art") saveViewPrefs();
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
        // An art-show booth standing in a photographed environment does not
        // also stand in its own white hall: the hall's back wall cuts across
        // the photograph as a white band at mid-height, which is the one
        // thing in frame that cannot be real. The booth itself is untouched —
        // the walls, the light bar and the panel module all stay — and the
        // hall is a checkbox in Art show, so this is a default, not a lock.
        //
        // The test is whether the preset actually shows a photograph, not
        // which preset it is. This read `value !== "studio"`, which was the
        // same thing only while studio was the one preset without an HDRI —
        // so the moment trade show became a white hall of its own, a booth
        // standing in a white hall had its white hall switched off.
        if (isArtShow(p) && preset.hdri && hallSpec(p.booth).on) {
          p.booth.hall = { ...hallSpec(p.booth), on: false };
          toast("Exhibition hall switched off: this booth now stands in the photographed environment. Art show → Exhibition hall brings it back.");
        }
      }
      // Use Global Light: switched on, the shadow takes the shared angle;
      // switched off, it keeps that angle as its own — Photoshop's rule. The
      // record was written back resolved, so both already hold.
      if (SHADOW_KINDS.some((kind) => SHADOW_FIELD[kind] === scope) && key === "global" && value)
        target.angle = globalAngle(p.booth);
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
      // A hall has at most MAX_HALL_BOOTHS booths: whichever of rows and
      // booths per row was just typed wins, and the other gives way.
      if (scope === "hallplan" && (key === "rows" || key === "perRow")) {
        const other = key === "rows" ? "perRow" : "rows";
        p.hall[other] = Math.min(p.hall[other], Math.floor(MAX_HALL_BOOTHS / p.hall[key]));
      }
      // The panel module is what the walls are rebuilt from, and a linked
      // booth rebuilds as it is typed rather than waiting for the button.
      if (scope === "artShow" && p.booth.artShow.linked) relinkArtShowWalls(p);
    });
  });
  document.addEventListener("input", (ev) => {
    // The frame's size and position sliders: live on the guide, saved on change.
    if (ev.target.dataset?.framePlace) {
      const which = ev.target.dataset.frameWhich === "export" ? "export" : "video";
      const key = ev.target.dataset.framePlace;
      const v = Number(ev.target.value) / 100;
      setPlace(which, normalPlace({ ...getPlace(which), [key]: v }));
      // The same slider can be in the Video tab and in the timeline at once;
      // both follow.
      document.querySelectorAll(`[data-frame-place="${key}"][data-frame-which="${which}"]`).forEach((input) => {
        if (input !== ev.target) input.value = ev.target.value;
        input.closest("label")?.querySelector("output")?.replaceChildren(`${Math.round(Number(ev.target.value))}%`);
      });
      updateFrameGuide();
      return;
    }
    if (ev.target.dataset?.fxLive !== undefined) {
      setShadowLive(ev.target.dataset.scope, ev.target.dataset.field, ev.target.value, ev.target);
      return;
    }
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
    // A position slider for the selected work: the same edit as typing into
    // the field beside it, through the same constraint, and moved with
    // updateArtwork rather than a rebuild.
    if (ev.target.type === "range" && ev.target.dataset.scope === "art-position") {
      const a = currentArtwork();
      if (!a) return;
      if (!artGesture) { checkpoint(); artGesture = true; }
      Object.assign(a, constrain(p, { ...a, [ev.target.dataset.field]: Number(ev.target.value) }));
      scene?.updateArtwork(a);
      syncArtInputs(a, ev.target);
      ev.target
        .closest("label")
        ?.querySelector("output")
        ?.replaceChildren(Number(a[ev.target.dataset.field].toFixed(2)) + "in");
      return;
    }
    // A figure's placement and height sliders. Same deal as the artwork's:
    // one checkpoint for the whole gesture, and `movePerson` restands the
    // figure rather than disposing and rebuilding the booth per pixel.
    if (ev.target.type === "range" && ev.target.dataset.scope?.startsWith("person-")) {
      const id = ev.target.dataset.scope.slice(7);
      const person = (p.booth.people || []).find((x) => x.id === id);
      if (!person) return;
      if (!personGesture) { checkpoint(); personGesture = true; }
      const key = ev.target.dataset.field;
      scene?.movePerson({ ...person, [key]: Number(ev.target.value) });
      // The typed field beside the slider, and the slider's own readout.
      // `.value`, not setAttribute: the attribute is the initial value and an
      // input the user has already touched ignores it.
      const typed = document.querySelector(
        `input[type="number"][data-field="${key}"][data-scope="person-${CSS.escape(id)}"]`,
      );
      if (typed) typed.value = String(Number(ev.target.value));
      ev.target
        .closest("label")
        ?.querySelector("output")
        ?.replaceChildren(Number(ev.target.value) + "in");
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
        // Uploading is filing, not hanging. Every upload used to push a
        // placement per file onto the back wall at the same x and y, so
        // choosing five images from a phone put five coplanar panels in one
        // spot: they z-fight, and the wall flashes through all five. The
        // library already lists an original that has no placement — see
        // `libraryItems` — so the files land there and the wall stays as it
        // was until someone taps one.
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
        }
        tab = "art";
      });
      toast(
        type === "photo"
          ? "Booth photo ready. Select an uploaded artwork to add it."
          : type === "replace"
            ? "Image replaced. The original stays in your library."
            : `${assets.length} original${assets.length > 1 ? "s" : ""} added to your library. Tap one to hang it on a wall.`,
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
  // An exhibitor's booth design file, onto the floor booth chosen when Import
  // was pressed (src/booth-file.js), or the one it was dropped on.
  document.querySelector("#design-input").onchange = async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = "";
    const n = designTarget;
    designTarget = null;
    await importDesignFile(f, n);
  };
  // A file dragged over the 2D floor: the booth under the pointer is where it
  // will land, and is outlined while it is held there.
  const floorHost = document.querySelector("#show-floor");
  const boothUnder = (ev) => document.elementsFromPoint(ev.clientX, ev.clientY).map((el) => el.closest?.("#show-floor [data-hall-booth]")).find(Boolean) || null;
  const markDrop = (g) => {
    for (const x of floorHost.querySelectorAll(".sf-drop")) if (x !== g) x.classList.remove("sf-drop");
    g?.classList.add("sf-drop");
  };
  floorHost.addEventListener("dragover", (ev) => {
    if (!showFloor || show3d || !p.hall || ![...ev.dataTransfer.types].includes("Files")) return;
    ev.preventDefault();
    const g = boothUnder(ev);
    ev.dataTransfer.dropEffect = g ? "copy" : "none";
    markDrop(g);
  });
  floorHost.addEventListener("dragleave", (ev) => {
    if (!floorHost.contains(ev.relatedTarget)) markDrop(null);
  });
  floorHost.addEventListener("drop", async (ev) => {
    if (!showFloor || show3d || !p.hall || ![...ev.dataTransfer.types].includes("Files")) return;
    ev.preventDefault();
    const g = boothUnder(ev);
    markDrop(null);
    const f = ev.dataTransfer.files[0];
    if (!f) return;
    if (!g) return toast("Drop a booth design file on a booth.", true);
    const n = Number(g.dataset.hallBooth);
    hallSelected = n;
    showEditor?.select([g.dataset.id]);
    await importDesignFile(f, n);
  });
  async function importDesignFile(f, n) {
    if (!f || !p.hall || !Number.isInteger(n)) return;
    let file;
    try {
      if (f.size > 200 * 1024 * 1024) throw new Error("That file is over the 200 MB limit.");
      file = readDesignFile(JSON.parse(await f.text()));
    } catch (err) {
      return toast(err instanceof SyntaxError ? "This is not a Booth Studio booth design file." : err.message, true);
    }
    const from = file.name ? `“${file.name}”` : "The design";
    const go = () => {
      let err = null;
      const live = liveNumber(p.hall) === n;
      mutate(() => {
        err = importDesign(p, n, file);
        if (!err && live) selected = null;
      });
      if (err) toast(err, true);
      else toast(`${from} is on booth ${n}. ${live ? "It is open in the booth editor." : "Open this booth to edit it; See it in 3D shows it on the floor."}`);
    };
    if (hasDesign(p.hall, n)) confirmAction(`Replace booth ${n}'s design?`, `${from} replaces the design booth ${n} has now. Undo brings it back.`, go);
    else go();
  }
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
          // A backup written before thumbnails existed brings none with it.
          backfillThumbnails();
          toast("Project restored with its original images.");
        },
      );
    } catch (err) {
      toast(err.message, true);
    }
  };
  // Photoshop's angle dial: press anywhere on it and drag round. The angle
  // is where the light comes from, so the line points at the pointer.
  // A shape in the show floor's library: pressed, it is dragged onto the
  // floor or, tapped, dropped in the middle of the view.
  document.addEventListener("pointerdown", (ev) => {
    const b = ev.target.closest?.("[data-show-shape]");
    if (!b || !showEditor || ev.button > 0) return;
    const shape = SHAPES.find((sh) => sh.key === b.dataset.showShape);
    if (shape) showEditor.libraryPress(ev, shape);
  });
  document.addEventListener("pointerdown", (ev) => {
    const dial = ev.target.closest?.("[data-dial]");
    if (!dial || ev.button !== 0) return;
    ev.preventDefault();
    dial.focus();
    const scope = dial.dataset.dial;
    const aim = (e2) => {
      const r = dial.getBoundingClientRect();
      const deg = Math.atan2(r.top + r.height / 2 - e2.clientY, e2.clientX - (r.left + r.width / 2)) * (180 / Math.PI);
      setShadowLive(scope, "angle", Math.round(deg));
    };
    const done = () => {
      dial.removeEventListener("pointermove", aim);
      dial.removeEventListener("pointerup", done);
      dial.removeEventListener("pointercancel", done);
      endShadowGesture();
    };
    dial.setPointerCapture?.(ev.pointerId);
    dial.addEventListener("pointermove", aim);
    dial.addEventListener("pointerup", done);
    dial.addEventListener("pointercancel", done);
    aim(ev);
  });
  // Tool search, in the header. The index is read from what each tab would
  // draw right now — the same markup the inspector renders — so a control
  // added to a panel is findable without anyone adding it to a list, and a
  // control the current booth does not show (the light bar on a pop-up) is
  // not offered. It is built when the box is focused and dropped on blur.
  const TAB_NAMES = { art: "Artwork", layout: "Layout", show: "Art show", walls: "Walls", lighting: "Lighting", video: "Video", hall: "Show floor", export: "Export" };
  const FINDABLE = "h3, h4, label, button[data-action]";
  let toolIndex = null,
    toolHits = [],
    toolAt = 0;
  /** What a heading, label or button is called, without the values beside it. */
  function findableName(el) {
    if (el.matches("button")) return el.getAttribute("aria-label") || el.textContent;
    const copy = el.cloneNode(true);
    copy.querySelectorAll("select, output, input, textarea, button, small, span.badge").forEach((x) => x.remove());
    if (el.matches("h3")) copy.querySelectorAll("span").forEach((x) => x.remove());
    const text = copy.textContent.replace(/\s+/g, " ").trim();
    if (text) return text;
    return el.querySelector("[aria-label]")?.getAttribute("aria-label") || "";
  }
  /** Help's table of tool shortcuts, grouped as `SHORTCUTS` groups them. */
  function shortcutHelp() {
    const groups = {};
    for (const [name, sc] of Object.entries(SHORTCUTS)) (groups[sc.group] ||= []).push(`<li><kbd>${e(name)}</kbd> ${e(sc.label)}</li>`);
    return `<h3>Tool shortcuts</h3><p class="muted">Type one in the search box and press Enter.</p><div class="shortcut-help">${Object.entries(groups).map(([g, items]) => `<section><h4>${e(g)}</h4><ul>${items.join("")}</ul></section>`).join("")}</div>`;
  }
  function buildToolIndex() {
    const list = [];
    for (const [t, name] of Object.entries(TAB_NAMES)) list.push({ label: name, where: "Inspector tab", tab: t });
    const outside = [
      [".toolbar [data-action]", "Toolbar"],
      ["#view-switch [data-view]", "View"],
      [".zoom-controls [data-action]", "View"],
      ["header [data-action]", "Header"],
    ];
    for (const [sel, where] of outside)
      for (const el of document.querySelectorAll(sel)) list.push({ label: findableName(el), where, el });
    list.push({ label: "Preview quality", where: "Status bar", el: document.querySelector("#quality-quick") });
    const keep = tab,
      tpl = document.createElement("template");
    try {
      for (const [t, name] of Object.entries(TAB_NAMES)) {
        tab = t;
        tpl.innerHTML = inspectorHTML();
        tpl.content.querySelectorAll(FINDABLE).forEach((el, index) => {
          const section = el.closest("section")?.querySelector("h3");
          const heading = section && section !== el ? findableName(section) : "";
          list.push({ label: findableName(el), where: heading ? `${name} · ${heading}` : name, tab: t, index });
        });
      }
    } finally {
      tab = keep;
    }
    return dedupe(list);
  }
  function renderToolHits() {
    const box = document.querySelector("#tool-search"),
      ul = document.querySelector("#tool-results");
    const q = box.value;
    toolHits = q.trim() ? rankTools(toolIndex || (toolIndex = buildToolIndex()), q) : [];
    toolAt = Math.min(toolAt, Math.max(0, toolHits.length - 1));
    const open = document.activeElement === box && !!q.trim();
    ul.hidden = !open;
    box.setAttribute("aria-expanded", String(open));
    ul.innerHTML = !open
      ? ""
      : toolHits.length
        ? toolHits.map((x, i) => `<li role="option" id="tool-hit-${i}" data-hit="${i}" aria-selected="${i === toolAt}" class="${i === toolAt ? "active" : ""}"><strong>${e(x.label)}${shortcutOf(x) ? `<kbd>${e(shortcutOf(x))}</kbd>` : ""}</strong><span>${e(x.where)}</span></li>`).join("")
        : `<li class="none">Nothing called “${e(q.trim())}”</li>`;
    if (toolHits.length) box.setAttribute("aria-activedescendant", "tool-hit-" + toolAt);
    else box.removeAttribute("aria-activedescendant");
    ul.querySelector("li.active")?.scrollIntoView({ block: "nearest" });
  }
  /** Take the user to a found tool: its tab, scrolled to, focused and flashed. */
  function openTool(hit) {
    const box = document.querySelector("#tool-search");
    box.value = "";
    box.blur();
    let target = hit.el || null;
    if (hit.tab) {
      tab = hit.tab;
      renderInspector();
      if (hit.index !== undefined) {
        const root = document.querySelector("#inspector-content");
        const all = [...root.querySelectorAll(FINDABLE)];
        target = all[hit.index];
        // The inspector redrew; if it came out different, find it by name.
        if (!target || fold(findableName(target)) !== fold(hit.label))
          target = all.find((el) => fold(findableName(el)) === fold(hit.label)) || null;
      } else target = document.querySelector(`.inspector-tabs [data-tab="${hit.tab}"]`);
    }
    if (!target) return;
    // A toolbar button is a tool in itself, so finding it uses it; anything in
    // the inspector is only shown and focused, because "Remove" found is not
    // "Remove" meant.
    if (!hit.tab && target.matches("button")) {
      target.click();
      return;
    }
    showSection(target);
    const control = target.matches("label") ? target.querySelector("input, select, textarea") : target.matches("button, select, input") ? target : null;
    const shown = target.matches("h3, h4") ? target.closest("section") || target : target;
    shown.scrollIntoView({ block: "center", behavior: "smooth" });
    control?.focus({ preventScroll: true });
    shown.classList.remove("found");
    void shown.offsetWidth;
    shown.classList.add("found");
    setTimeout(() => shown.classList.remove("found"), 1800);
  }
  {
    const box = document.querySelector("#tool-search"),
      ul = document.querySelector("#tool-results");
    // Its own events stop here: the page's input and change handlers read
    // every field in the document as booth settings.
    for (const type of ["input", "change"]) box.addEventListener(type, (ev) => ev.stopPropagation());
    // Keep every tape: a view setting on the scene, not a booth field, so its
    // events stop here like the search box's.
    const keep = document.querySelector("#keep-tapes");
    keep.addEventListener("input", (ev) => ev.stopPropagation());
    keep.addEventListener("change", (ev) => {
      ev.stopPropagation();
      scene?.setKeepTapes(keep.checked);
    });
    box.addEventListener("input", () => {
      toolAt = 0;
      renderToolHits();
    });
    box.addEventListener("focus", () => {
      toolIndex = null;
      renderToolHits();
    });
    box.addEventListener("blur", () => {
      toolIndex = null;
      ul.hidden = true;
      box.setAttribute("aria-expanded", "false");
    });
    box.addEventListener("keydown", (ev) => {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        if (!toolHits.length) return;
        toolAt = (toolAt + (ev.key === "ArrowDown" ? 1 : -1) + toolHits.length) % toolHits.length;
        renderToolHits();
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        if (toolHits[toolAt]) openTool(toolHits[toolAt]);
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        if (box.value) {
          box.value = "";
          renderToolHits();
        } else box.blur();
      }
      ev.stopPropagation();
    });
    // mousedown, not click: a click would blur the box first and the list
    // would be gone before it landed.
    ul.addEventListener("mousedown", (ev) => {
      const li = ev.target.closest("[data-hit]");
      ev.preventDefault();
      if (li) openTool(toolHits[Number(li.dataset.hit)]);
    });
    // "/" jumps to the box from anywhere that is not already typing, and so
    // does Ctrl/⌘-K, the other place people look for it.
    document.addEventListener("keydown", (ev) => {
      const typing = ev.target.matches?.("input, textarea, select, [contenteditable]");
      const k = (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k";
      if ((ev.key === "/" && !typing && !ev.ctrlKey && !ev.metaKey && !ev.altKey) || k) {
        if (document.querySelector("dialog[open]")) return;
        ev.preventDefault();
        box.focus();
        box.select();
      }
    });
  }
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
    // The show in 3D: walking, and the way back to the plan.
    if (showFloor && show3d) {
      if (show3dKey(ev)) ev.preventDefault();
      return;
    }
    // The show floor has keys of its own, and none of the booth's apply.
    if (showFloor && showEditor) {
      if (showFloorKey(ev)) ev.preventDefault();
      return;
    }
    // The shadow angle dial, focused: arrows turn it a degree, Shift fifteen,
    // counterclockwise for Up and Right the way the angle is measured.
    if (ev.target.dataset?.dial) {
      const turn = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[ev.key];
      if (!turn) return;
      ev.preventDefault();
      const kind = SHADOW_KINDS.find((k) => SHADOW_FIELD[k] === ev.target.dataset.dial);
      if (!kind) return;
      setShadowLive(ev.target.dataset.dial, "angle", shadowSpec(p.booth, kind).angle + turn * (ev.shiftKey ? 15 : 1));
      endShadowGesture();
      return;
    }
    // Walking: WASD and the arrows step, Shift strides, Esc stops. Before the
    // nudge keys, which would otherwise move the selected work instead.
    if (walking) {
      const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      const move = { w: [1, 0], ArrowUp: [1, 0], s: [-1, 0], ArrowDown: [-1, 0], a: [0, -1], ArrowLeft: [0, -1], d: [0, 1], ArrowRight: [0, 1] }[k];
      if (move && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        scene.walk(move[0], move[1], ev.shiftKey ? STRIDE : STEP);
        return;
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        setWalking(false);
        return;
      }
    }
    if (ev.key === "Escape" && scene?.drawingBox) {
      ev.preventDefault();
      setDrawingBox(false);
      return;
    }
    if (ev.key === "Escape" && scene?.measure.on) {
      ev.preventDefault();
      setMeasuring(false);
      return;
    }
    const step = nudge(ev.key, ev.shiftKey);
    if (step && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      if (nudgeSelection(...step)) ev.preventDefault();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "d") {
      ev.preventDefault();
      if (p.mode === "3d" && selected) actions["duplicate-art"]();
      return;
    }
    if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && scene && p.mode === "3d") {
      const key = ev.key.toLowerCase();
      if (key === "r" && rotateSelection(ev.shiftKey ? -15 : 15)) return ev.preventDefault();
      if (key === "v") return actions.select();
      if (key === "m") return actions.move();
      if (key === "h") return actions.pan();
      if (key === "t") return actions.measure();
      if (key === "w") return setWalking(true);
    }
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
    if (document.hidden) save(fromSnapshot(editingStart || snapshot())).catch(() => {});
  });
  render();
  scheduleSave();
  /**
   * Thumbnails for originals that arrived before there were any — the booths
   * already on people's machines, and every backup written until now.
   *
   * One at a time, after the first frame, so a project that opens with twelve
   * photographs in it does not spend its first seconds decoding them. It is
   * derived data rather than an edit: no checkpoint, nothing in the undo
   * history, and the library is redrawn once at the end rather than twelve
   * times. An original that will not produce one keeps showing itself, which
   * is what the app did before thumbnails existed.
   */
  async function backfillThumbnails() {
    const missing = Object.values(p.assets).filter((asset) => !asset.thumb && asset.role !== "model");
    if (!missing.length) return;
    for (const asset of missing) {
      try {
        const source = await decodeAt(asset.data, asset.width, asset.height, THUMB_MAX);
        asset.thumb = thumbnailOf(source, source.width, source.height);
        source.close?.();
      } catch {
        // Leave it without one and move on; it is a picture of a picture.
      }
    }
    renderLibrary();
    renderInspector();
    scheduleSave();
  }
  backfillThumbnails();
  // A booth link: open it once, and take it off the address so a reload does
  // not offer it again.
  {
    const url = new URL(location.href);
    const shared = url.searchParams.get(SHARE_PARAM);
    if (shared) {
      url.searchParams.delete(SHARE_PARAM);
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      openShareLink(shared);
    }
  }
  // Development-only inspection hook for integration tests; absent from production.
  if (import.meta.env.DEV)
    window.__booth = {
      get project() {
        return p;
      },
      get scene() {
        return scene;
      },
      // The undo history, so a test can check what a snapshot costs as well
      // as what it restores. An entry is {structure, assets}: the layout as
      // text, and the images by reference.
      get history() {
        return history;
      },
      get selectedPanel() {
        return selectedPanel;
      },
      get selectedPedestal() {
        return selectedPedestal;
      },
      get tab() {
        return tab;
      },
      get framePlace() {
        return framePlace;
      },
      get videoTimeline() {
        return videoTimeline;
      },
      get livePlace() {
        return livePlace;
      },
      get frames() {
        return { video: videoFrameShape, export: exportFrame, custom: customFrame };
      },
      get tier() {
        return tier;
      },
      // What tool search can find, without the elements, so a test can hold
      // every shortcut to a real control.
      toolIndex: () => buildToolIndex().map(({ label, where, tab }) => ({ label, where, tab: tab || null })),
      get picked() {
        return picked;
      },
      get walking() {
        return walking;
      },
      get hallSelected() {
        return hallSelected;
      },
      get showEditor() {
        return showEditor;
      },
      get show3d() {
        return show3d;
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
      save: () => save(fromSnapshot(snapshot())),
    };
}
boot().catch((err) => {
  console.error(err);
  document.querySelector("#app").innerHTML =
    "<div><h1>Booth Studio could not start</h1><p>Please reload or try another browser. Existing saved data has not been removed.</p></div>";
});
