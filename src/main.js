import { TENTS } from "./environment.js";
import { ENV_PRESETS, ART_FIDELITY, DEFAULT_PRESET, DEFAULT_FIDELITY, FIXTURE_MODES, DEFAULT_FIXTURES, isIndoor, showFixtures } from "./lighting.js";
import { MOVES, DEFAULT_MOVE, CUSTOM_MOVE, frameTimes } from "./camera-path.js";
import {
  MIN_SECONDS, MAX_SECONDS,
  normalizeTimeline,
} from "./timeline.js";
import { jobSlug } from "./batch.js";
import { SIZES, DEFAULT_SIZE, DEFAULT_FPS, pickCodec } from "./video.js";
import { FRAMES, DEFAULT_FRAME, DEFAULT_CLIP_FRAME, CUSTOM_FRAME, FRAME_MIN, FRAME_MAX, STILL_SIZES, placeRect, normalPlace, DEFAULT_PLACE } from "./framing.js";
import { SHADOW_FIELD, SHADOW_KINDS, SHADOW_MAX, normalAngle, shadowSpec } from "./dropshadow.js";
import { MAX_SWATCHES, isColor, readPalette, rememberColor, previousColor } from "./swatches.js";
import { MAX_PEOPLE, newPerson, personName } from "./people.js";
import {
  DEFAULT_SPACE, MAX_SLOTS,
  addBooths, addSpace, boothSlots, hasRow, normalizeRow, removeSlot,
  slotLabel,
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
// Opens with no signal (ROADMAP.md 1.7): public/sw.js keeps the app's own
// files, so once opened here it opens again offline, as on a show floor. A
// built app only — the dev server, which the view suites drive, never has
// one — registered once the page has loaded, under the build's commit so
// every deploy brings a new worker. OFFLINE false is the off switch: the
// page then unregisters the worker and deletes what it kept.
const OFFLINE = true;
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const offline = () =>
    (OFFLINE
      ? navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(BUILD.commit)}`)
      : navigator.serviceWorker
          .getRegistrations()
          .then((all) => Promise.all(all.map((r) => r.unregister())))
          .then(() => caches.keys())
          .then((names) => Promise.all(names.filter((n) => n.startsWith("booth-")).map((n) => caches.delete(n))))
    ).catch((err) => console.warn("Service worker:", err));
  if (document.readyState === "complete") offline();
  else addEventListener("load", offline, { once: true });
}
// Report a problem (src/report.js): the page's uncaught errors are kept from
// here on, so one thrown while the app starts (boot, below) is in the report
// too. The imports above this run before it; one of them throwing would stop
// the page before there were a report to copy.
addEventListener("error", (ev) => recordError(errorEntry(ev)));
addEventListener("unhandledrejection", (ev) => recordError(errorEntry(ev)));
// A chunk loaded on demand that would not load (Vite's vite:preloadError),
// from the first line too: boot sets what the page says (chunkFailed), and
// until when that notice stays over the error toasts that follow from it.
let chunkFailed = null;
let chunkNoticeUntil = 0;
addEventListener("vite:preloadError", () => chunkFailed?.());
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
  MessageCircle,
  Ellipsis,
  ShieldCheck,
  ClipboardCopy,
} from "lucide";
import {
  demoProject,
  lightVisible,
  uid,
  validateProject,
  escapeHTML as e,
  boundWarning,
  mismatch,
  GROUND_UPLOAD,
  groundLibrary,
  groundUpload,
  selectGround,
  constrain,
  openSpot,
  PLACEMENT_GAP,
  constrainPanel,
  constrainPedestal,
  scalePanel,
  boothPanels,
  findPanel,
  panelKey,
  panelIdOf,
  wallLabel,
  wallSpec,
  MAX_MODELS,
  artShowPanel,
  boothPedestals,
  findPedestal,
  hallSpec,
  isArtShow,
  lightBarSpec,
  } from "./model.js";
import { load, save, download, readImage, thumbnailOf, THUMB_MAX } from "./storage.js";
import { decodeAt } from "./image-source.js";
import { accountLabel, readSession } from "./studio-session.js";

/** Signed out it says "Sign in" (Isaac couldn't find the round "IA"); signed in, the initials. */
function accountButton() {
  const a = accountLabel(readSession());
  return `<button class="avatar${a.signedIn ? "" : " sign-in"}" data-action="studio-account" title="${e(a.title)}" aria-label="${e(a.signedIn ? a.title : "Sign in")}">${e(a.text)}</button>`;
}
import { AUTO_QUALITY } from "./adaptive.js";
import { sameWall } from "./arrange.js";
import { checkClearance } from "./clearance.js";
import { VENUES as SHOW_VENUES, feet, floorOf, showItems, toFloor } from "./show.js";
import { createShowEditor } from "./show-editor.js";
import { PACK_LONG, describeScene, protectPass, renderPack } from "./ai-render.js";
import { SHARE_PARAM } from "./share.js";
import { createShareDialogs } from "./ui/share-dialogs.js";
import { createWelcome } from "./ui/welcome.js";
import { createKeepSafePanel } from "./ui/keep-safe-panel.js";
import { createPolishPanel } from "./ui/polish-panel.js";
import { createImageEditor } from "./ui/image-editor.js";
import { createTimelineDialog } from "./ui/timeline-dialog.js";
import { createBatch } from "./ui/batch.js";
import { createShowFloorPanel } from "./ui/show-floor-panel.js";
import { createFindTool } from "./ui/find-tool.js";
import { createUpload } from "./ui/upload.js";
import { createWallsPanel } from "./panels/walls.js";
import { createLightingPanel } from "./panels/lighting.js";
import { createArtShowPanel } from "./panels/art-show.js";
import { createArtworkPanel } from "./panels/artwork.js";
import { createLayoutPanel } from "./panels/layout.js";
import { createVideoPanel } from "./panels/video.js";
import { createExportPanel } from "./panels/export.js";
import { createHallPanel } from "./panels/hall.js";
import { createArtworkActions } from "./actions/artwork.js";
import { createVideoActions } from "./actions/video.js";
import { createExportActions } from "./actions/export.js";
import { createShowActions } from "./actions/show.js";
import { createBoothActions } from "./actions/booth.js";
import { createAppActions } from "./actions/app.js";
import { createInputs } from "./ui/inputs.js";
import { createEvents } from "./ui/events.js";
import { createSceneWiring } from "./ui/scene-wiring.js";
import { createStudioHost } from "./ui/studio-host.js";
import { createTestHooks } from "./ui/test-hooks.js";
import { readFloorTemplates, readTemplates } from "./ui/templates.js";
import { assetInDesigns, liveNumber } from "./linked.js";
import { PhotoEditor } from "./photo.js";
import { PRO_FEATURES, TIERS, can, readTier, resolveTier, writeTier } from "./tier.js";
import { ROLES, hasMoreTabs, hiddenActions, needsWelcome, readRole, resolveRole, visibleTabs } from "./roles.js";
import { noteKeepSafe } from "./keep-safe.js";
import { errorEntry, recordError } from "./report.js";
async function boot() {
  const icons = {
    ShieldCheck,
    ClipboardCopy,
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
    MessageCircle,
    Ellipsis,
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
    // The studio bridge (src/studio.js), once loaded: signed in, or Studio account opened.
    studioBridge = null,
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
    tier = readTier(),
    // The workspace this browser chose (src/roles.js), or null before it
    // chose one, which shows every tool. View state, never in a backup.
    role = readRole(),
    // The inspector's More button: every tab shown, whatever the workspace.
    tabsMore = false,
    // Whether the welcome on screen is the first visit's, which goes on to
    // Quick start for an artist, rather than the Workspace button's.
    welcomeFirst = false,
    // Whether this browser had a project of its own when the page opened:
    // only a browser with none is asked which workspace it wants.
    hadProject = false;
  // What the modules split out of boot() read and change (MAIN_SPLIT_PHASE.md):
  // each piece of state through a getter, and a setter where a module assigns
  // it (an assignment with none throws, so none fails quietly); each helper as
  // itself, or wrapped where it is a const declared further down. It grows one
  // seam at a time.
  const ctx = {
    get p() { return p; },
    set p(v) { p = v; },
    get selected() { return selected; },
    set selected(v) { selected = v; },
    get tab() { return tab; },
    set tab(v) { tab = v; },
    get showFloor() { return showFloor; },
    set showFloor(v) { showFloor = v; },
    get hallSelected() { return hallSelected; },
    set hallSelected(v) { hallSelected = v; },
    get sharing() { return sharing; },
    set sharing(v) { sharing = v; },
    get selectedPanel() { return selectedPanel; },
    set selectedPanel(v) { selectedPanel = v; },
    get selectedPedestal() { return selectedPedestal; },
    set selectedPedestal(v) { selectedPedestal = v; },
    get role() { return role; },
    set role(v) { role = v; },
    get tabsMore() { return tabsMore; },
    set tabsMore(v) { tabsMore = v; },
    get welcomeFirst() { return welcomeFirst; },
    set welcomeFirst(v) { welcomeFirst = v; },
    get busy() { return busy; },
    set busy(v) { busy = v; },
    get busyVideo() { return busyVideo; },
    get editingStart() { return editingStart; },
    set editingStart(v) { editingStart = v; },
    get scene() { return scene; },
    set scene(v) { scene = v; },
    get designTarget() { return designTarget; },
    set designTarget(v) { designTarget = v; },
    get lightIndex() { return lightIndex; },
    set lightIndex(v) { lightIndex = v; },
    get photoLightIndex() { return photoLightIndex; },
    set photoLightIndex(v) { photoLightIndex = v; },
    get photoSelected() { return photoSelected; },
    set photoSelected(v) { photoSelected = v; },
    get toolIndex() { return toolIndex; },
    set toolIndex(v) { toolIndex = v; },
    get toolHits() { return toolHits; },
    set toolHits(v) { toolHits = v; },
    get toolAt() { return toolAt; },
    set toolAt(v) { toolAt = v; },
    get show3d() { return show3d; },
    get showBlock() { return showBlock; },
    get showClipboard() { return showClipboard; },
    set showClipboard(v) { showClipboard = v; },
    get showEditor() { return showEditor; },
    get showGap() { return showGap; },
    set showGap(v) { showGap = v; },
    get showGrid() { return showGrid; },
    set showGrid(v) { showGrid = v; },
    get panTool() { return panTool; },
    get walking() { return walking; },
    get PAN_KEY() { return PAN_KEY; },
    get busyPreview() { return busyPreview; },
    set busyPreview(v) { busyPreview = v; },
    get customFrame() { return customFrame; },
    set customFrame(v) { customFrame = v; },
    get exportFrame() { return exportFrame; },
    set exportFrame(v) { exportFrame = v; },
    get exportLong() { return exportLong; },
    set exportLong(v) { exportLong = v; },
    get framePlace() { return framePlace; },
    get livePlace() { return livePlace; },
    set livePlace(v) { livePlace = v; },
    get tlBeforeAuto() { return tlBeforeAuto; },
    set tlBeforeAuto(v) { tlBeforeAuto = v; },
    get videoBatchAt() { return videoBatchAt; },
    get videoFps() { return videoFps; },
    set videoFps(v) { videoFps = v; },
    get videoFrameShape() { return videoFrameShape; },
    set videoFrameShape(v) { videoFrameShape = v; },
    get videoMove() { return videoMove; },
    set videoMove(v) { videoMove = v; },
    get videoSeconds() { return videoSeconds; },
    set videoSeconds(v) { videoSeconds = v; },
    get videoSettle() { return videoSettle; },
    set videoSettle(v) { videoSettle = v; },
    get videoSize() { return videoSize; },
    set videoSize(v) { videoSize = v; },
    get videoTimeline() { return videoTimeline; },
    set videoTimeline(v) { videoTimeline = v; },
    get tlSelected() { return tlSelected; },
    set tlSelected(v) { tlSelected = v; },
    get tlPlayhead() { return tlPlayhead; },
    set tlPlayhead(v) { tlPlayhead = v; },
    get keyThumbs() { return keyThumbs; },
    get furnitureChoice() { return furnitureChoice; },
    set furnitureChoice(v) { furnitureChoice = v; },
    get hiddenTags() { return hiddenTags; },
    get picked() { return picked; },
    set picked(v) { picked = v; },
    get search() { return search; },
    set search(v) { search = v; },
    get selectedPerson() { return selectedPerson; },
    set selectedPerson(v) { selectedPerson = v; },
    get aiLong() { return aiLong; },
    get powerOutlets() { return powerOutlets; },
    set powerOutlets(v) { powerOutlets = v; },
    get videoCodec() { return videoCodec; },
    get addMode() { return addMode; },
    set addMode(v) { addMode = v; },
    get future() { return future; },
    set future(v) { future = v; },
    get history() { return history; },
    get palette() { return palette; },
    set palette(v) { palette = v; },
    // The image editor's own function, not a wrapper: the Artwork actions read a
    // property of it (`scheduleEditedPreview.timer`).
    get scheduleEditedPreview() { return scheduleEditedPreview; },
    get autoPanRunning() { return autoPanRunning; },
    set autoPanRunning(v) { autoPanRunning = v; },
    get autoPanSettings() { return autoPanSettings; },
    get videoAbort() { return videoAbort; },
    get BUILD() { return BUILD; },
    get photo() { return photo; },
    get draftPolicy() { return draftPolicy; },
    set draftPolicy(v) { draftPolicy = v; },
    get activeBooth() { return activeBooth; },
    set activeBooth(v) { activeBooth = v; },
    get artGesture() { return artGesture; },
    set artGesture(v) { artGesture = v; },
    get autoScale() { return autoScale; },
    set autoScale(v) { autoScale = v; },
    get colorHistory() { return colorHistory; },
    set colorHistory(v) { colorHistory = v; },
    get panelGesture() { return panelGesture; },
    set panelGesture(v) { panelGesture = v; },
    get pedestalGesture() { return pedestalGesture; },
    set pedestalGesture(v) { pedestalGesture = v; },
    get personGesture() { return personGesture; },
    set personGesture(v) { personGesture = v; },
    get quality() { return quality; },
    set quality(v) { quality = v; },
    get scaleGesture() { return scaleGesture; },
    set scaleGesture(v) { scaleGesture = v; },
    get scaleBase() { return scaleBase; },
    get actions() { return actions; },
    get measureHint() { return measureHint; },
    set measureHint(v) { measureHint = v; },
    get MEASURE_HINT() { return MEASURE_HINT; },
    get renderRect() { return renderRect; },
    set renderRect(v) { renderRect = v; },
    get studioBridge() { return studioBridge; },
    set studioBridge(v) { studioBridge = v; },
    // The module's own, outside boot(): the page's first lines read them.
    get chunkFailed() { return chunkFailed; },
    set chunkFailed(v) { chunkFailed = v; },
    get chunkNoticeUntil() { return chunkNoticeUntil; },
    set chunkNoticeUntil(v) { chunkNoticeUntil = v; },
    get tier() { return tier; },
    get studioHost() { return studioHost; },
    activeSlot,
    addPerson,
    addRowBooths,
    addRowSpace,
    addWallAsset,
    allowed: (feature) => allowed(feature),
    applyRole,
    checkpoint,
    arrangePicked,
    arrangeWall,
    backfillThumbnails,
    backup,
    btn,
    colorField,
    confirmAction,
    field,
    currentArtwork,
    deviceStore: () => deviceStore(),
    endShadowGesture,
    fieldTarget,
    goToView,
    fromSnapshot,
    hideEye,
    icon,
    inspectorHTML,
    keepKit,
    kit: () => kit(),
    makeAiPack,
    libraryItems,
    mutate,
    probeCodec,
    proLock,
    readTemplates,
    refreshIcons,
    refreshScene,
    rememberEdge,
    render,
    renderInspector,
    renderLibrary,
    renderSelection,
    renderStatus,
    runClips,
    safeName,
    setDraft,
    setDraftPolicy,
    setDrawingBox,
    setMeasuring,
    setSheet,
    setShadowLive,
    setTier,
    saveViewPrefs,
    scaleSelected,
    setPanTool,
    showSection,
    tagAssetRoles,
    setShow3d,
    setWalking,
    snapshot,
    syncAutoPan,
    syncArtInputs,
    syncPanelInputs,
    syncPedestalInputs,
    syncQuality,
    syncShadowInputs,
    syncTools,
    toast,
    addCatalogPlacement,
    applyColor,
    deletePanel,
    deletePedestal,
    nudgeSelection,
    removeRowSlot,
    rotateSelection,
    showClearance,
    frameGuideShape,
    loadViewPrefs,
    reveal,
    revealPanelFields,
    revealPedestalFields,
    // Declared after ctx (consts, or a module's functions), so wrapped.
    batchSection: () => batchSection(),
    progressHTML: () => progressHTML(),
    refreshPanels: () => refreshPanels(),
    renderTimelineDialog: () => renderTimelineDialog(),
    timeline: () => timeline(),
    timelineOpen: () => timelineOpen(),
    gated: (...args) => gated(...args),
    lightBarLevels: (...args) => lightBarLevels(...args),
    pickedWorks: () => pickedWorks(),
    frameFields: (...args) => frameFields(...args),
    frameNote: (...args) => frameNote(...args),
    frameKeyed: () => frameKeyed(),
    getPlace: (...args) => getPlace(...args),
    selectedKeyName: () => selectedKeyName(),
    showFloorPanel: () => showFloorPanel(),
    timelineSummary: () => timelineSummary(),
    drawImageEditorPreview: (...args) => drawImageEditorPreview(...args),
    renderImageEditor: () => renderImageEditor(),
    updateEditorEdits: (...args) => updateEditorEdits(...args),
    addJobs: (...args) => addJobs(...args),
    clipJob: (...args) => clipJob(...args),
    currentClip: (...args) => currentClip(...args),
    currentPose: (...args) => currentPose(...args),
    followPlayhead: (...args) => followPlayhead(...args),
    grabThumb: (...args) => grabThumb(...args),
    keyName: (...args) => keyName(...args),
    placeSettled: (...args) => placeSettled(...args),
    setKit: (...args) => setKit(...args),
    setPlace: (...args) => setPlace(...args),
    showKey: (...args) => showKey(...args),
    stillJob: (...args) => stillJob(...args),
    paintKeepSafe: (...args) => paintKeepSafe(...args),
    runHeroSet: (...args) => runHeroSet(...args),
    renumberBooths: (...args) => renumberBooths(...args),
    showAlign: (...args) => showAlign(...args),
    showDelete: (...args) => showDelete(...args),
    showDuplicate: (...args) => showDuplicate(...args),
    showMirror: (...args) => showMirror(...args),
    showPieces: (...args) => showPieces(...args),
    showRotate: (...args) => showRotate(...args),
    shareFile: (...args) => shareFile(...args),
    showShareLink: (...args) => showShareLink(...args),
    rowCount: (...args) => rowCount(...args),
    chooseRole: (...args) => chooseRole(...args),
    describeToAssistant: (...args) => describeToAssistant(...args),
    openQuickStart: (...args) => openQuickStart(...args),
    openWelcome: (...args) => openWelcome(...args),
    runQuickStart: (...args) => runQuickStart(...args),
    welcomeDismissed: (...args) => welcomeDismissed(...args),
    runLook: (...args) => runLook(...args),
    runPolish: (...args) => runPolish(...args),
    shortcutHelp: (...args) => shortcutHelp(...args),
    showChange: (...args) => showChange(...args),
    applyTemplate: (...args) => applyTemplate(...args),
    copyLink: (...args) => copyLink(...args),
    removeLink: (...args) => removeLink(...args),
    sendToLink: (...args) => sendToLink(...args),
    show3dKey: (...args) => show3dKey(...args),
    showFloorKey: (...args) => showFloorKey(...args),
    startFrom: (...args) => startFrom(...args),
    loadStudio: (...args) => loadStudio(...args),
    appMapText: (...args) => appMapText(...args),
    buildToolIndex: (...args) => buildToolIndex(...args),
    openTool: (...args) => openTool(...args),
    placeHit: (...args) => placeHit(...args),
    range,
    scheduleSave,
    updateFrameGuide,
  };
  try {
    p = await load();
    hadProject = !!p;
    if (p) validateProject(p);
  } catch (err) {
    // A project that is there but will not open is still someone's work:
    // the error toast is what they need to see, not a welcome.
    hadProject = true;
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
  addEventListener("studio-session", () => {
    const b = document.querySelector("header .avatar");
    if (b) b.outerHTML = accountButton();
  });
  document.querySelector("#app").innerHTML =
    `<header><a class="brand" href="#" aria-label="Booth Studio">${icon("box")}<span>Artist OS</span></a><span class="app-badge">Booth Studio</span><div class="tool-search"><span aria-hidden="true">⌕</span><input id="tool-search" type="search" placeholder="Find a tool…" aria-label="Find a tool" title="Find a tool by name or shortcut · press / or Ctrl/⌘ K to jump here" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-controls="tool-results" aria-expanded="false"/><ul id="tool-results" role="listbox" aria-label="Matching tools" hidden></ul></div><button class="workspace-pill" data-action="workspace" title="Workspace: which tabs and tools to show" aria-label="Workspace">${icon("layers")}<span id="workspace-label">${e(ROLES[resolveRole(role)].label)}</span></button><button class="assistant-top" data-action="assistant" title="Ask the studio assistant" aria-label="Ask the studio assistant">${icon("message-circle")}<span>Assistant</span></button><div class="project"><input id="project-name" aria-label="Project name" maxlength="120" value="${e(p.name)}"/>${icon("chevron-down")}</div><div class="save-status" id="save-status" role="status">Opening…</div>${btn("help", "Help", "help-circle", "icon-only")}${accountButton()}</header>
<div class="workspace"><aside class="library" id="library"></aside><main class="editor"><div class="toolbar"><div class="toolgroup">${btn("select", "Select", "mouse-pointer-2", "active")}${btn("move", "Move", "move")}${btn("pan", "Pan", "hand")}${btn("autopan-menu", "Auto pan", "chevron-down", "icon-only autopan-caret")}${btn("snap", "Snap 1″", "grid-2x2", "active")}${btn("measure", "Measure", "ruler")}${btn("walk", "Walk", "footprints")}${btn("draw-box", "Box", "square")}${btn("draft", "Fast edit", "zap")}${btn("draft-lock", "Fast edit: follows the gesture", "lock", "draft-lock")}${btn("tools-more", "More tools", "ellipsis", "icon-only tools-more")}</div><div class="toolgroup floor-tools">${btn("pan", "Pan", "hand")}</div><div class="toolgroup">${btn("undo", "Undo", "undo-2", "icon-only")}${btn("redo", "Redo", "redo-2", "icon-only")}</div><div class="mode-switch"><button data-action="mode-3d">3D booth</button><button data-action="mode-photo">Photo</button><button data-action="mode-show">Show floor</button></div>${btn("export-tab", "Export", "download", "export-top")}</div><div class="viewport"><div id="scene"></div><div class="frame-guide" hidden><div class="frame-guide-box"><button class="fg-move" data-fg="move" title="Drag to move the frame" aria-label="Move the export frame"><span class="fg-label"></span></button>${["nw", "ne", "sw", "se"].map((c) => `<i class="fg-h fg-corner" data-fg="${c}" title="Drag to resize the frame"></i>`).join("")}${["n", "s", "e", "w"].map((c) => `<i class="fg-h fg-edge" data-fg="${c}" title="Drag to change the frame's shape"></i>`).join("")}</div></div><div id="photo" hidden></div><div id="show-floor" hidden></div><div class="scene-label"><span class="eyebrow" id="mode-label">MEASURED WORKSPACE</span><strong id="scene-title"></strong><span id="scene-subtitle"></span><small class="mobile-stamp" title="Built ${BUILD.time} · commit ${BUILD.commit}">${BUILD.stamp} · ${BUILD.commit}</small></div><div id="photo-empty" hidden><div>${icon("image-plus")}<h2>Start with your booth shot</h2><p>Add artwork and adjust its four corners to match the wall perspective.</p>${btn("upload-photo", "Upload booth photo", "plus", "primary")}</div></div><button class="find-tool" data-action="find-tool" aria-label="Find a tool" title="Find a tool">${icon("search")}</button><button class="assistant-fab" data-action="assistant" aria-label="Ask the studio assistant" title="Ask the studio assistant">${icon("message-circle")}</button><div class="walk-pad" hidden><button data-walk="forward" aria-label="Step forward">▲</button><button data-walk="left" aria-label="Step left">◀</button><button data-walk="back" aria-label="Step back">▼</button><button data-walk="right" aria-label="Step right">▶</button><button data-action="walk" class="walk-exit" aria-label="Stop walking">Done</button></div><div class="autopan-menu" hidden><strong>Auto pan</strong><label>Direction<select id="autopan-dir" aria-label="Auto pan direction"><option value="1">Left to right</option><option value="-1">Right to left</option></select></label><label>Motion<select id="autopan-ease" aria-label="Auto pan motion"><option value="smooth">Ease in and out</option><option value="linear">Steady</option><option value="in">Ease in</option><option value="out">Ease out</option></select></label><label>Distance<span><input type="number" id="autopan-dist" min="1" max="200" step="0.5" aria-label="Auto pan distance in feet"/> ft</span></label><label>Speed<span><input type="number" id="autopan-speed" min="0.05" max="50" step="0.05" aria-label="Auto pan speed in feet a second"/> ft/s</span></label><label>Time<span><input type="number" id="autopan-time" min="0.5" max="600" step="0.5" aria-label="Auto pan time in seconds"/> s</span></label><p class="muted">Speed and time follow each other: change one and the other is worked out from the distance. With an ease, speed is the average.</p><div class="button-row">${btn("autopan-go", "Start", "play", "primary")}${btn("autopan-menu", "Close", "check")}</div><div class="button-row">${btn("autopan-record", "Record it as MP4", "video")}${btn("batch-add-autopan", "Add to the batch", "plus")}</div><p class="muted">Renders the same pan from the view now, at the Video tab's size and frame rate, without moving the view — or queues it in the batch (Video tab). ${MIN_SECONDS}–${MAX_SECONDS} s.</p></div><div class="measure-bar" hidden><label><input type="checkbox" id="keep-tapes"/> Keep every tape</label><button data-action="clear-tapes">Clear tapes</button></div><div class="viewport-bottom"><div class="view-switch" id="view-switch"><button data-view="perspective" class="active">Perspective</button><button data-view="back">Back</button><button data-view="left">Left</button><button data-view="right">Right</button><button data-view="plan">Plan</button></div><select class="view-quick" id="view-quick" aria-label="View"><option value="" hidden>View</option><option value="perspective">Perspective</option><option value="back">Back</option><option value="left">Left</option><option value="right">Right</option><option value="plan">Plan</option></select><label class="saved-view-pick" hidden><span>View</span><select id="saved-view" aria-label="Go to a saved view"></select></label><div class="zoom-controls"><span class="zoom-label">Zoom</span>${btn("zoom-out", "Zoom out", "minus", "icon-only")}${btn("zoom-in", "Zoom in", "plus", "icon-only")}${btn("reset-view", "Reset view", "rotate-ccw", "icon-only")}</div></div></div><div class="statusbar"><span id="gesture-hint">Drag to orbit · scroll or +/− to zoom · right-drag to pan</span><label class="preview-quality" title="Preview quality: how many pixels the viewport draws for each one on screen. Exports are never affected."><span>Preview</span><select id="quality-quick" aria-label="Preview quality"></select><output id="quality-now"></output></label><span id="selection-status"></span></div></main><aside class="inspector"><button class="sheet-toggle" data-action="sheet-toggle" aria-label="Fold the panel away" title="Fold the panel away"><span>Fold</span></button><div class="inspector-tabs">${["art", "layout", "show", "walls", "lighting", "video", "hall", "export"].map((t, i) => `<button data-tab="${t}">${icon(["image", "layout-panel-left", "building-2", "columns-2", "lightbulb", "video", "map", "download"][i])}<span>${["Artwork", "Layout", "Art show", "Walls", "Lighting", "Video", "Show floor", "Export"][i]}</span></button>`).join("")}<button class="tabs-more" data-action="tabs-more" aria-expanded="false" title="Show every tab" hidden>${icon("ellipsis")}<span>More</span></button></div><div id="inspector-content"></div></aside></div><footer><span class="footer-brand">${icon("box")} BOOTH STUDIO <small>Prototype 01</small><small id="build-stamp" title="Version ${BUILD.version} · built ${BUILD.time} · commit ${BUILD.commit}">v${BUILD.version} · ${BUILD.stamp} · ${BUILD.commit}</small></span><span>Your images. Your space. Your arrangement.</span><span id="network">Local workspace</span></footer><input type="file" id="art-input" accept="image/jpeg,image/png" multiple hidden/><input type="file" id="replace-input" accept="image/jpeg,image/png" hidden/><input type="file" id="photo-input" accept="image/jpeg,image/png" hidden/><input type="file" id="surround-input" accept="image/jpeg,image/png" hidden/><input type="file" id="ground-input" accept="image/jpeg,image/png" hidden/><input type="file" id="underlay-input" accept="image/jpeg,image/png" hidden/><input type="file" id="model-input" accept=".glb,model/gltf-binary" hidden/><input type="file" id="backup-input" accept=".json,.booth" hidden/><input type="file" id="design-input" accept=".json" hidden/><div id="toast" role="status"></div><dialog id="dialog"><div id="dialog-content"></div></dialog><dialog id="image-editor"><div id="image-editor-content"></div></dialog><dialog id="timeline-dialog" class="timeline-dialog"><div id="timeline-content"></div></dialog>`;
  let scene;
  createSceneWiring(ctx);
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
        // Signed in to the studio: the bridge decides whether this save goes up.
        studioBridge?.saved();
      } catch (err) {
        document.querySelector("#save-status").textContent = "Not saved";
        toast(
          "Browser storage is full or unavailable. Download a project backup now.",
          true,
        );
      }
    }, 350);
  }
  function toast(message, error = false, ms = 6000) {
    // The notice for a chunk that would not load outranks the errors that
    // follow from the same failure, for its 15 seconds (chunkFailed).
    if (error && Date.now() < chunkNoticeUntil) return;
    const t = document.querySelector("#toast");
    t.textContent = message;
    t.className = "show" + (error ? " error" : "");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.className = ""), ms);
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
  const { multiSection, locationOptions, artSlider, edgeColorFields, artThumb, libraryHTML, signFields } = createArtworkPanel(ctx);
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
  // Auto pan (the caret beside the hand): the view slides sideways by
  // itself, a set distance at a set speed (scene.autoPan). Distance, speed
  // and time are tied — time is distance over speed — so editing speed or
  // time works out the other. Remembered per browser, never in a project.
  const AUTOPAN_KEY = "booth.autoPan";
  const AUTOPAN_DEFAULT = { dir: 1, dist: 10, speed: 1, ease: "smooth" };
  const AUTOPAN_EASES = ["smooth", "linear", "in", "out"];
  let autoPanSettings = (() => {
    try {
      const v = JSON.parse(localStorage.getItem(AUTOPAN_KEY) || "null");
      if (v && [-1, 1].includes(v.dir) && v.dist >= 1 && v.dist <= 200 && v.speed >= 0.05 && v.speed <= 50) return { ...v, ease: AUTOPAN_EASES.includes(v.ease) ? v.ease : "linear" };
    } catch {}
    return { ...AUTOPAN_DEFAULT };
  })();
  let autoPanRunning = false;
  function syncAutoPan() {
    const a = autoPanSettings, q = (id) => document.getElementById(id);
    if (!q("autopan-dir")) return;
    q("autopan-dir").value = String(a.dir);
    q("autopan-ease").value = a.ease;
    q("autopan-dist").value = String(+a.dist.toFixed(2));
    q("autopan-speed").value = String(+a.speed.toFixed(2));
    q("autopan-time").value = String(+(a.dist / a.speed).toFixed(1));
    const go = document.querySelector('.autopan-menu [data-action="autopan-go"]');
    if (go) go.lastChild.textContent = autoPanRunning ? "Stop" : "Start";
  }
  function setAutoPan(field, value) {
    const a = { ...autoPanSettings }, clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    if (field !== "ease" && !Number.isFinite(value)) return syncAutoPan();
    if (field === "ease") a.ease = AUTOPAN_EASES.includes(value) ? value : "linear";
    else if (field === "dir") a.dir = value < 0 ? -1 : 1;
    else if (field === "dist") a.dist = clamp(value, 1, 200);
    else if (field === "speed") a.speed = clamp(value, 0.05, 50);
    else if (field === "time") a.speed = clamp(a.dist / clamp(value, 0.5, 600), 0.05, 50);
    autoPanSettings = a;
    try { localStorage.setItem(AUTOPAN_KEY, JSON.stringify(a)); } catch {}
    syncAutoPan();
  }
  document.addEventListener("change", (ev) => {
    const id = ev.target?.id || "";
    if (id === "autopan-ease") setAutoPan("ease", ev.target.value);
    else if (id.startsWith("autopan-")) setAutoPan(id.slice(8), Number(ev.target.value));
  });
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
  const { panelFields, pedestalFields, modelsSection } = createWallsPanel(ctx);
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
  /**
   * Bring a control the viewport just picked into sight. With the panels'
   * section chips on, it may sit in a section another chip hides, and
   * scrolling to a hidden element does nothing — so its chip is chosen first.
   */
  function reveal(el) {
    if (!el) return;
    showSection(el);
    el.scrollIntoView({ block: "nearest" });
  }
  function revealPanelFields() {
    const id = panelIdOf(selectedPanel);
    if (!id) return;
    reveal(document.querySelector(`.wall-setting[data-panel="${CSS.escape(id)}"]`));
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
    reveal(document.querySelector(`.wall-setting[data-pedestal="${CSS.escape(selectedPedestal)}"]`));
  }
  const { lightBarLevels, shadowSection, dialSVG } = createLightingPanel(ctx);
  const { artShowHTML } = createArtShowPanel(ctx);
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
  const { frameFields, frameNote, aiSection, powerSection } = createExportPanel(ctx);
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
  function renderLibrary() {
    document.querySelector("#library").innerHTML = showFloor ? showLibraryHTML() : libraryHTML();
  }
  const { groundFields, rowSection, surroundingsFields, draftSection, viewsSection, tagsSection, underlaySection, clearanceSection, peopleSection } = createLayoutPanel(ctx);
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
  const { hallPanel } = createHallPanel(ctx);
  // ---- The show floor ------------------------------------------------------
  const { showPieces, showSelected, renumberBooths, showRotate, showMirror, showDuplicate, showDelete, applyTemplate, startFrom, showAlign, show3dKey, showFloorKey, showChange, showLibraryHTML, showFloorPanel } = createShowFloorPanel(ctx);
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
  // The phone's one-line view picker (CSS shows it below 700 px in place of
  // the five view buttons). It presses the matching button, so every view
  // change still goes one way, and follows whichever button is lit.
  {
    const quick = document.querySelector("#view-quick");
    const sync = () => (quick.value = document.querySelector("#view-switch [data-view].active")?.dataset.view || "");
    quick.addEventListener("change", () => document.querySelector(`#view-switch [data-view="${quick.value}"]`)?.click());
    new MutationObserver(sync).observe(document.querySelector("#view-switch"), { subtree: true, attributes: true, attributeFilter: ["class"] });
    sync();
  }
  document.querySelector(".tool-search").addEventListener("click", (ev) => {
    if (ev.target.id !== "tool-search") document.querySelector("#tool-search").focus();
  });
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
    document.body.classList.toggle("walking-on", walking);
    document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", !walking && b.dataset.view === "perspective"));
    renderStatus();
    syncTools();
  }

  const { videoSection } = createVideoPanel(ctx);
  const { getPlace, setPlace, placeSettled, frameKeyed, selectedKeyName, timelineSummary, timeline, keyName, renderTimelineDialog, currentPose, grabThumb, showKey, followPlayhead, timelineOpen } = createTimelineDialog(ctx);
  // View state only, like the timeline itself: thumbnails are pictures of
  // the viewport, held per key id and never saved.
  let tlSelected = null,
    tlPlayhead = 0;
  const keyThumbs = new Map();
  const { kit, setKit, refreshPanels, batchSection, currentClip, addJobs, clipJob, stillJob } = createBatch(ctx);
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
        const name = batch ? `${safeName()}-${jobSlug(job, index)}` : `${safeName()}-${job.fileTag || job.move}`;
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
    // On a phone the row is one line that scrolls sideways; keep the chosen
    // chip in sight rather than off the edge.
    const on = bar.querySelector(".active");
    if (on && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2);
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
  /**
   * The workspace (src/roles.js) on the page: the inspector tabs it shows,
   * the More button when it leaves some out, the toolbar tools it hides and
   * the header's label. Nothing else changes with it.
   */
  function applyRole() {
    const buttons = [...document.querySelectorAll(".inspector-tabs [data-tab]")];
    const all = buttons.map((b) => b.dataset.tab);
    const opts = { active: tab, more: tabsMore, artShow: isArtShow(p) };
    const shown = new Set(visibleTabs(role, all, opts));
    for (const b of buttons) b.hidden = !shown.has(b.dataset.tab);
    const more = document.querySelector(".inspector-tabs .tabs-more");
    if (more) {
      more.hidden = !hasMoreTabs(role, all, opts);
      more.setAttribute("aria-expanded", String(tabsMore));
      more.title = tabsMore ? "Show this workspace's tabs only" : "Show every tab";
      more.querySelector("span").textContent = tabsMore ? "Fewer" : "More";
    }
    const hide = new Set(hiddenActions(role));
    document.querySelectorAll(".toolbar [data-action]").forEach((b) => b.classList.toggle("role-hidden", hide.has(b.dataset.action)));
    document.body.dataset.role = resolveRole(role);
    const label = document.querySelector("#workspace-label");
    if (label) {
      label.textContent = ROLES[resolveRole(role)].label;
      label.parentElement.title = `Workspace: ${ROLES[resolveRole(role)].label} · which tabs and tools to show`;
    }
  }
  /**
   * Where the tab strip scrolls sideways (a phone, a tablet), the open tab is
   * kept in sight when something other than a tap opens it: tool search, the
   * assistant's "take me to", the toolbar's Export. Only the strip scrolls;
   * scrollIntoView would move the page or the sheet as well. Only when the
   * tab changes: a redraw for any other reason leaves a strip the artist
   * scrolled by hand where they put it.
   */
  let tabInSight = null;
  // Where site data is blocked, even reading `localStorage` throws: null then,
  // which src/keep-safe.js reads as nothing remembered.
  const deviceStore = () => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };
  function keepTabInSight() {
    if (tab === tabInSight) return;
    tabInSight = tab;
    const strip = document.querySelector(".inspector-tabs");
    const on = strip?.querySelector(`[data-tab="${tab}"]`);
    if (!on || strip.scrollWidth <= strip.clientWidth) return;
    const s = strip.getBoundingClientRect();
    const b = on.getBoundingClientRect();
    if (b.left < s.left) strip.scrollLeft -= s.left - b.left;
    else if (b.right > s.right) strip.scrollLeft += b.right - s.right;
  }
  function renderInspector() {
    document
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    applyRole();
    keepTabInSight();
    const root = document.querySelector("#inspector-content");
    root.innerHTML = inspectorHTML();
    applySectionTabs(root);
    refreshIcons();
    updateFrameGuide();
    if (tab === "export") paintKeepSafe();
  }
  const { keepSafeHTML, paintKeepSafe, remindBackup } = createKeepSafePanel(ctx);
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
      html = `<div class="panel-heading"><h2>${p.mode === "photo" ? "Booth photograph" : "Booth layout"}</h2>${icon("layout-panel-left")}</div>${p.mode === "photo" ? `<p class="muted">The original photo stays intact. Added art and light overlays are saved separately. Existing objects in the photograph cannot be moved or erased in this prototype.</p>${btn("upload-photo", p.photo.asset ? "Replace booth photo" : "Upload booth photo", "image-plus", "wide")}${range("Photo exposure", "exposure", p.photo.exposure, -1, 1, 0.05, "photo")}` : `<section><h3>Footprint</h3><select data-field="preset" aria-label="Booth preset"><option value="120" ${p.booth.width === 120 ? "selected" : ""}>10 × 10 ft · Standard</option><option value="240" ${p.booth.width === 240 ? "selected" : ""}>10 × 20 ft · Double</option></select><p class="muted">Nominal footprint. Panels and 1.4″ canopy legs reduce usable space near edges.</p>${isArtShow(p) ? `<div class="warning">This is an art-show booth. Its footprint, walls and light bar are in the <strong>Art show</strong> tool, and a preset or a canopy here would put it back to an outdoor pop-up.</div>` : ""}${field("Wall height", "height", p.booth.height, 48, 144, 1, "in", "booth")}<label class="check-field"><input type="checkbox" data-field="tent" data-scope="booth" ${p.booth.tent ? "checked" : ""}/>White canopy & frame</label><label class="setting-label">Tent style<select aria-label="Tent style" data-field="tentStyle" data-scope="booth">${Object.entries(TENTS).map(([k,v])=>`<option value="${k}" ${(p.booth.tentStyle||'classic')===k?'selected':''}>${v}</option>`).join('')}</select></label><p class="muted">12″ fabric valance, rounded hems, roof ribs and folding frame. Inspired shapes; not manufacturer-certified models.</p></section><section><h3>Surroundings</h3><label class="setting-label">Environment<select aria-label="Environment" data-field="envPreset" data-scope="booth">${Object.entries(ENV_PRESETS).map(([k,v])=>`<option value="${k}" ${(p.booth.envPreset||DEFAULT_PRESET)===k?'selected':''}>${v.label}</option>`).join('')}</select></label><p class="muted">Presets light the booth from a photographed environment. Without its image files a preset keeps the procedural surroundings below.</p>${isArtShow(p) ? `<label class="check-field"><input type="checkbox" data-field="on" data-scope="hall" ${hallSpec(p.booth).on ? "checked" : ""}/>Stand this booth in a white exhibition hall</label><p class="muted">${hallSpec(p.booth).on ? "The hall's own walls stand around the booth. In a photographed environment they cut across it as a white band, so choosing one of those presets switches the hall off." : "Off: the booth stands in the environment above, with nothing of its own around it. The walls, the light bar and the panel module are unchanged — this is only the room."}</p>` : ""}<label class="setting-label">Artwork colour<select aria-label="Artwork colour" data-field="artFidelity" data-scope="booth">${Object.entries(ART_FIDELITY).map(([k,v])=>`<option value="${k}" ${(p.booth.artFidelity||DEFAULT_FIDELITY)===k?'selected':''}>${v}</option>`).join('')}</select></label>${groundFields()}<label class="setting-label">Horizon<select aria-label="Horizon" data-field="horizon" data-scope="booth">${Object.entries({studio:'Neutral studio',open:'Open sky',park:'Park · trees',urban:'Urban plaza'}).map(([k,v])=>`<option value="${k}" ${(p.booth.horizon||'studio')===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="check-field"><input type="checkbox" data-field="neighbors" data-scope="booth" ${p.booth.neighbors?'checked':''}/>Surround with other booths</label>${surroundingsFields()}</section>${viewsSection()}${tagsSection()}${peopleSection()}${underlaySection()}${clearanceSection()}<section><h3>Display walls</h3>${colorField("Fabric finish", "color", "booth", p.booth.color, "Fabric finish")}<label class="setting-label">Panel surface<select aria-label="Panel surface" data-field="wallFinish" data-scope="booth">${Object.entries({smooth:"Smooth print",fabric:"Fabric pro-panel"}).map(([k,v])=>`<option value="${k}" ${(p.booth.wallFinish||"smooth")===k?"selected":""}>${v}</option>`).join("")}</select></label>${(p.booth.wallFinish||"smooth")==="fabric"?`${range("Weave depth","wallTexture",p.booth.wallTexture??60,0,100,1,"booth","%")}<p class="muted">The weave only. Panels keep the colour above, so artwork is still judged against the finish you chose. Without the carpet texture files the panels stay smooth.</p>`:""}<div class="swatches">${["#45474a", "#25282b", "#b1aea4", "#d8d4ca"].map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Wall finish ${c}"></button>`).join("")}</div>${["back", "left", "right"].map((w) => `<div class="wall-setting"><label class="check-field"><input type="checkbox" data-field="enabled" data-scope="wall-${w}" ${p.booth.walls[w].enabled ? "checked" : ""}/>${w[0].toUpperCase() + w.slice(1)} wall</label>${field("Width", "width", p.booth.walls[w].width, 12, w === "back" ? p.booth.width : p.booth.depth, 1, "in", "wall-" + w)}${field("Height", "height", p.booth.walls[w].height, 24, 144, 1, "in", "wall-" + w)}</div>`).join("")}</section><section><h3>Free-standing walls and pedestals</h3><p class="muted">Interior panels and pedestals live in the Walls tool, so this list stays the booth itself.</p>${btn("open-walls", "Open the Walls tool", "columns-2", "wide")}</section>${rowSection()}${draftSection()}`}<section><h3>Project</h3>${btn("quick-start", "Quick start a new booth", "zap", "primary wide")}${allowed("templates") ? btn("save-template", "Save this booth as a template", "save", "wide") : ""}${btn("copy-project", "Duplicate as alternative", "copy", "wide")}${btn("new-project", "New empty booth", "plus", "wide")}${btn("backup", "Download project backup", "save", "wide")}${btn("import", "Open project backup", "folder-open", "wide")}<p class="muted">Backups include all original images. Download before switching projects.</p>${btn("workspace", `Workspace: ${ROLES[resolveRole(role)].label}`, "layers", "wide")}<label class="setting-label">Plan<select data-tier aria-label="Plan">${Object.entries(TIERS).map(([k, v]) => `<option value="${k}" ${tier === k ? "selected" : ""}>${e(v.label)}</option>`).join("")}</select></label><p class="muted">${tier === "pro" ? "Pro: every tool. Lite shows a lock on the Pro ones — switch to see what a Lite user sees." : "Lite: the Pro tools show a lock. A booth made in Pro still draws every part of itself here."} Remembered on this browser; never part of a backup.</p></section>`;
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
      html = `<div class="panel-heading"><h2>${photoMode ? "Photo lighting" : "Lighting studio"}</h2>${icon("lightbulb")}</div><p class="muted">${photoMode ? "Reversible light overlays. A single photo cannot recover geometry or physically relight the booth." : "Light your real geometry. Wall gaps and panel thickness shape the cast shadows."}</p>${photoMode ? "" : looksSection()}<div class="button-row">${btn("daylight", "Daylight", "sun")}${btn("warm", "Warm", "lightbulb")}</div>${!photoMode ? `<section>${range("Ambient illumination", "ambient", p.ambient, 0, 4, 0.05)}<label class="setting-label">Spotlight fixtures<select aria-label="Spotlight fixtures" data-field="fixtures" data-scope="booth">${Object.entries(FIXTURE_MODES).map(([k, v]) => `<option value="${k}" ${(p.booth.fixtures || DEFAULT_FIXTURES) === k ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label><p class="muted">${showFixtures(p.booth.fixtures, p.booth.envPreset, p.booth.venue) ? "The housings are drawn where each spotlight sits." : `Housings are hidden${isIndoor(p.booth.envPreset, p.booth.venue) ? (p.booth.venue === "artshow" ? " because an art-show booth has its own light bar overhead" : " because this is an indoor environment, where the hall's own track lighting is already in the picture") : ""}. The rail above the booth stays, and the light itself is unchanged.`}</p></section>${isArtShow(p) ? `<section><h3>Light bar</h3><label class="check-field"><input type="checkbox" data-field="on" data-scope="lightBar" ${lightBarSpec(p.booth).on ? "checked" : ""}/>Light bar across the booth</label>${lightBarSpec(p.booth).on ? `${lightBarLevels(lightBarSpec(p.booth))}<p class="muted">The nine heads over an art-show booth. Brightness and diffusion are the two to judge by eye. Brightness is a percentage of a bar judged to read right: 50 is the default, 100 is twice that and already more than anyone wanted. Diffusion opens the beams until they overlap into a wash and fills their shadows, 0 is a bare source, and past 1 the hall's own bounce takes over. The rest of the bar — how many heads, how high — is in the Art show tool.</p>` : `<p class="muted">No bar. The spotlights below still light this booth.</p>`}</section>` : ""}` : ""}${!photoMode ? shadowSection("behind") + shadowSection("under") : ""}<section><h3>${photoMode ? "Light overlays" : "Spotlights"} <span>${lights.length} / ${photoMode ? 8 : 4}</span></h3><div class="light-picker">${lights.map((l, i) => `<span class="light-chip"><button data-light="${i}" class="${index === i ? "active" : ""}">${i + 1}</button><button data-light-eye="${i}" class="eye${lightVisible(l) ? "" : " off"}" title="${lightVisible(l) ? "Hide" : "Show"} ${photoMode ? "overlay" : "spotlight"} ${i + 1}" aria-label="${lightVisible(l) ? "Hide" : "Show"} light ${i + 1}">${icon(lightVisible(l) ? "eye" : "eye-off")}</button></span>`).join("")}${lights.length < (photoMode ? 8 : 4) ? btn("add-light", "Add", "plus", "icon-only") : ""}</div>${light ? `${range("Brightness", "power", light.power, 0, photoMode ? 1 : 300, photoMode ? 0.05 : 5, photoMode ? "photoLight" : "light")}${range("Temperature", "kelvin", light.kelvin, 2700, 6500, 100, photoMode ? "photoLight" : "light", " K")}${photoMode ? `${range("Horizontal", "x", light.x, 0, 1, 0.01, "photoLight")}${range("Vertical", "y", light.y, 0, 1, 0.01, "photoLight")}${range("Radius", "radius", light.radius, 0.02, 0.8, 0.01, "photoLight")}` : `<h4>Light position · inches</h4>${field("Left / right", "x", light.x, -360, 360, 1, "in", "light")}${field("Height", "y", light.y, 0, 160, 1, "in", "light")}${field("Front / back", "z", light.z, -360, 360, 1, "in", "light")}<h4>Aim at · inches</h4>${field("Target X", "tx", light.tx, -360, 360, 1, "in", "light")}${field("Target height", "ty", light.ty, 0, 160, 1, "in", "light")}${field("Target Z", "tz", light.tz, -360, 360, 1, "in", "light")}<p class="muted">Origin: center of floor. +X right, +Z toward the entrance. Height starts at the floor.</p>`}${btn("delete-light", "Remove light", "trash-2", "wide")}` : ""}</section>`;
    }
    if (tab === "video") {
      html = p.mode === "photo"
        ? `<div class="panel-heading"><h2>Video</h2>${icon("video")}</div><div class="empty-inspector"><p>Video records a camera move through the 3D booth. Photo mode has a single photograph and no camera to move, so there is nothing to record. Switch to the 3D booth.</p></div>`
        : `<div class="panel-heading"><h2>Video</h2>${icon("video")}</div><p class="muted">Everything about moving pictures in one place: the move, the clip, the timeline and a batch list. The Export tab keeps the same controls beside the PNG and the guide, and they are the same settings — this is not a second set.</p>${gated("video", videoSection() + batchSection(), "Camera moves, keyframed timelines and batch MP4 export. Part of Booth Studio Pro.")}<section><h3>Stills</h3><p class="muted">The frame you are looking at, as a PNG, without controls or outlines. The full image options are in Export.</p>${btn("export-image", "Export PNG · 4096 px", "download", "wide")}</section>`;
    }
    if (tab === "hall") html = `<div class="panel-heading"><h2>${showFloor ? "Show floor" : "Hall planner"}</h2>${icon("map")}</div>${hallPanel()}`;
    if (tab === "export") {
      html = `<div class="panel-heading"><h2>Export your booth</h2>${icon("download")}</div><p class="muted">A clean image of the current ${p.mode === "photo" ? "photo composition" : "camera view"}, without controls or selection outlines.</p>${p.mode === "photo" ? "" : heroSection()}<section><h3>Image size</h3>${p.mode === "photo" ? "" : frameFields("export")}<label class="setting-label">Detail<select id="export-size" aria-label="Export image size">${STILL_SIZES.map((n) => `<option value="${n}" ${exportLong === n ? "selected" : ""}>${n} px on the long side${n <= 1440 ? " · Fast" : n >= 4096 ? " · High resolution" : ""}</option>`).join("")}</select></label><p class="muted">PNG · ${p.mode === "photo" ? "The photograph's own shape. Enlarging a small source cannot restore missing detail." : e(frameNote("export")) + " Preview textures are capped at 2048 px per artwork; originals remain in the backup."}</p>${btn("export-image", "Export PNG", "download", "primary wide")}</section>${p.mode === "photo" ? "" : gated("video", videoSection())}${gated("showPack", `<section><h3>Show pack</h3><p class="muted">For the van: a measured floor plan with every piece numbered and its clearances, the inventory of work with sizes, media and prices, and a packing and load-in checklist worked out from this booth. Open the downloaded HTML to print or save as PDF.</p>${btn("show-pack", "Download show pack", "layers", "wide")}</section>`)}${p.mode === "photo" ? "" : gated("power", powerSection())}${p.mode === "photo" ? "" : gated("glb", `<section><h3>3D model</h3><p class="muted">The booth as a .glb — walls, work, furniture, figures and any models you brought in, in metres — for SketchUp, Blender or an AR viewer. Surroundings, lights and the drawn shadows stay behind.</p>${btn("export-glb", "Download booth as .glb", "box", "wide")}</section>`)}${p.mode === "photo" ? "" : aiSection()}${p.mode === "photo" ? "" : gated("elevations", `<section><h3>Elevations to scale</h3><p class="muted">A floor plan and every wall with work on it, drawn at a real architectural scale with its dimension chain and centre lines — the drawing a carpenter or installer works from. Print at 100%.</p>${btn("elevations", "Download elevations", "ruler", "wide")}</section>`)}${gated("guide", `<section><h3>Installation guide</h3><p class="muted">Measured wall elevations, panel sizes, and left/bottom placement references. Open the downloaded HTML to print or save as PDF. Photo overlays are excluded.</p>${btn("guide", "Download hanging guide", "layout-panel-left", "wide")}</section>`)}<section><h3>Keep your work</h3>${btn("backup", "Download project backup", "save", "wide")}${btn("import", "Open project backup", "folder-open", "wide")}<p class="muted">Includes original artwork and photo files, booth layout, and lighting.</p><div class="keep-safe" id="keep-safe">${keepSafeHTML()}</div>${btn("studio-account", "Studio account & sync", "user-round", "wide")}<p class="muted">Signed in to your studio, your booths and their images are kept there and open on your other devices. Signed out, everything stays on this device.</p></section>${p.mode === "photo" ? "" : `<section><h3>Send to the show</h3>${btn("share-design", "Send my booth to the promoter", "send", "primary wide")}<p class="muted">Uploads this booth's design and the images on it — not the rest of your project — and gives you a link to send. The promoter opens it in Booth Studio and puts your booth on their show floor.</p>${btn("send-design", "Download it as a file instead", "download", "wide")}${sentLinksHTML()}</section>`}<section><h3>Preview quality</h3><select id="quality" aria-label="Preview quality (Export)">${qualityOptions()}</select><p class="muted">Auto starts sharp and lowers the detail while it measures this computer drawing slower than it should. The light bar's shadows are drawn live at High detail only; exports always include them. The same menu is under the viewport, beside what it is drawing at now.</p></section><section><h3>Something wrong?</h3>${btn("copy-report", "Copy a problem report", "clipboard-copy", "wide")}<p class="muted">Copies a short report to paste into a message: this build, your browser and screen, the project in counts (no names, titles or images) and the last errors on this page. Nothing is sent anywhere.</p></section>`;
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
  // The booth link's dialogs: src/ui/share-dialogs.js.
  const { shareFile, sentLinksHTML, copyLink, sendToLink, removeLink, showShareLink, openShareLink } = createShareDialogs(ctx);
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
  const { looksSection, heroSection, runHeroSet, runLook, runPolish } = createPolishPanel(ctx);
  const { openWelcome, describeToAssistant, welcomeDismissed, chooseRole, openQuickStart, runQuickStart } = createWelcome(ctx);
  function backup() {
    // The floor templates saved on this browser ride along, so they survive
    // a change of browser. They are not part of the project: an import merges
    // them back into the browser's list (mergeFloorTemplates) and drops the
    // key before the project itself is checked. Optional, so every older
    // backup loads as it did.
    const floorTemplates = readFloorTemplates();
    download(
      new Blob([JSON.stringify(floorTemplates.length ? { ...p, floorTemplates } : p)], { type: "application/json" }),
      `${safeName()}.booth.json`,
    );
    noteKeepSafe(deviceStore(), p.id, "backup");
    toast("Project backup downloaded with original images.");
    if (tab === "export") paintKeepSafe(true);
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
  function currentArtwork() {
    return p.art.find((item) => item.id === selected);
  }
  const { drawImageEditorPreview, renderImageEditor, scheduleEditedPreview, updateEditorEdits } = createImageEditor(ctx);
  // The action table: every button's handler under its data-action, put
  // together from its areas in src/actions/ (MAIN_SPLIT_PHASE.md, seams 12–15).
  const actions = {};
  Object.assign(actions, createArtworkActions(ctx), createVideoActions(ctx), createExportActions(ctx), createShowActions(ctx), createBoothActions(ctx), createAppActions(ctx));
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
  createInputs(ctx);
  createUpload(ctx);
  // Find a tool's index, its hits and the one picked (src/ui/find-tool.js);
  // the assistant's app map reads and fills the index too.
  let toolIndex = null,
    toolHits = [],
    toolAt = 0;
  const { findableName, shortcutHelp, buildToolIndex, appMapText, placeHit, openTool } = createFindTool(ctx);
  createEvents(ctx);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save(fromSnapshot(editingStart || snapshot())).catch(() => {});
  });
  // Where the tab strip scrolls (a phone; 701–1200 px), a mouse wheel turned
  // over it moves it sideways: a mouse has no other way along it.
  const tabStrip = document.querySelector(".inspector-tabs");
  tabStrip?.addEventListener(
    "wheel",
    (ev) => {
      if (tabStrip.scrollWidth <= tabStrip.clientWidth || Math.abs(ev.deltaX) >= Math.abs(ev.deltaY)) return;
      tabStrip.scrollLeft += ev.deltaY;
      ev.preventDefault();
    },
    { passive: false },
  );
  render();
  scheduleSave();
  // The first visit asks which workspace to show (src/roles.js) — not when a
  // booth link is opening, and not for a browser already signed in to the
  // studio, which has used the app before.
  if (needsWelcome({ role, hadProject }) && !readSession() && !new URL(location.href).searchParams.has(SHARE_PARAM)) openWelcome({ first: true });
  else remindBackup();
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
  const { loadStudio, studioHost } = createStudioHost(ctx);
  createTestHooks(ctx);
}
boot().catch((err) => {
  console.error(err);
  document.querySelector("#app").innerHTML =
    "<div><h1>Booth Studio could not start</h1><p>Please reload or try another browser. Existing saved data has not been removed.</p></div>";
});
