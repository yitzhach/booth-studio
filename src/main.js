import { MOVES, DEFAULT_MOVE } from "./camera-path.js";
import {
  MIN_SECONDS, MAX_SECONDS,
  } from "./timeline.js";
import { DEFAULT_SIZE, DEFAULT_FPS } from "./video.js";
import { DEFAULT_FRAME, DEFAULT_CLIP_FRAME, CUSTOM_FRAME, DEFAULT_PLACE } from "./framing.js";
import { MAX_PEOPLE, newPerson, personName } from "./people.js";
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
  demoProject,
  uid,
  validateProject,
  escapeHTML as e,
  groundUpload,
  constrain,
  constrainPanel,
  constrainPedestal,
  scalePanel,
  boothPanels,
  findPanel,
  panelKey,
  wallSpec,
  boothPedestals,
  findPedestal,
  isArtShow,
  } from "./model.js";
import { load, save, download, thumbnailOf, THUMB_MAX } from "./storage.js";
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
import { createRender } from "./ui/render.js";
import { createViewPrefs } from "./ui/view-prefs.js";
import { createLibrary } from "./ui/library.js";
import { createIconSet } from "./ui/icons.js";
import { createFields } from "./panels/fields.js";
import { createSyncInputs } from "./ui/sync-inputs.js";
import { createClips } from "./ui/clips.js";
import { createAssetInputs } from "./ui/asset-inputs.js";
import { createRowEdit } from "./ui/row-edit.js";
import { readFloorTemplates, readTemplates } from "./ui/templates.js";
import { liveNumber } from "./linked.js";
import { PhotoEditor } from "./photo.js";
import { readTier, resolveTier, writeTier } from "./tier.js";
import { ROLES, hasMoreTabs, hiddenActions, needsWelcome, readRole, resolveRole, visibleTabs } from "./roles.js";
import { noteKeepSafe } from "./keep-safe.js";
import { errorEntry, recordError } from "./report.js";
async function boot() {
  // The icons, as finished SVG: src/ui/icons.js.
  const { icon, btn, refreshIcons } = createIconSet();
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
    set busyVideo(v) { busyVideo = v; },
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
    set show3d(v) { show3d = v; },
    get showBlock() { return showBlock; },
    get showClipboard() { return showClipboard; },
    set showClipboard(v) { showClipboard = v; },
    get showEditor() { return showEditor; },
    set showEditor(v) { showEditor = v; },
    get showGap() { return showGap; },
    set showGap(v) { showGap = v; },
    get showGrid() { return showGrid; },
    set showGrid(v) { showGrid = v; },
    get panTool() { return panTool; },
    get walking() { return walking; },
    get PAN_KEY() { return PAN_KEY; },
    get PAN_HINT() { return PAN_HINT; },
    get DEFAULT_HINT() { return DEFAULT_HINT; },
    get busyPreview() { return busyPreview; },
    set busyPreview(v) { busyPreview = v; },
    get customFrame() { return customFrame; },
    set customFrame(v) { customFrame = v; },
    get exportFrame() { return exportFrame; },
    set exportFrame(v) { exportFrame = v; },
    get exportLong() { return exportLong; },
    set exportLong(v) { exportLong = v; },
    get framePlace() { return framePlace; },
    set framePlace(v) { framePlace = v; },
    get lastEdge() { return lastEdge; },
    set lastEdge(v) { lastEdge = v; },
    get livePlace() { return livePlace; },
    set livePlace(v) { livePlace = v; },
    get tlBeforeAuto() { return tlBeforeAuto; },
    set tlBeforeAuto(v) { tlBeforeAuto = v; },
    get videoBatchAt() { return videoBatchAt; },
    set videoBatchAt(v) { videoBatchAt = v; },
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
    get otherTimeline() { return otherTimeline; },
    set otherTimeline(v) { otherTimeline = v; },
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
    get shadowGesture() { return shadowGesture; },
    set shadowGesture(v) { shadowGesture = v; },
    get videoCodecFor() { return videoCodecFor; },
    set videoCodecFor(v) { videoCodecFor = v; },
    get videoFrame() { return videoFrame; },
    set videoFrame(v) { videoFrame = v; },
    get videoFrames() { return videoFrames; },
    set videoFrames(v) { videoFrames = v; },
    get videoProgress() { return videoProgress; },
    set videoProgress(v) { videoProgress = v; },
    dialSVG: (...args) => dialSVG(...args),
    set videoCodec(v) { videoCodec = v; },
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
    set videoAbort(v) { videoAbort = v; },
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
    activeSlot: (...args) => activeSlot(...args),
    addPhotoLayer: (...args) => addPhotoLayer(...args),
    showLibraryHTML: (...args) => showLibraryHTML(...args),
    addPerson,
    addRowBooths: (...args) => addRowBooths(...args),
    addRowSpace: (...args) => addRowSpace(...args),
    addWallAsset: (...args) => addWallAsset(...args),
    allowed: (feature) => allowed(feature),
    applyRole,
    checkpoint,
    arrangePicked,
    arrangeWall,
    backfillThumbnails,
    backup,
    btn,
    colorField: (...args) => colorField(...args),
    confirmAction,
    field: (...args) => field(...args),
    currentArtwork,
    deviceStore: () => deviceStore(),
    endShadowGesture: (...args) => endShadowGesture(...args),
    fieldTarget: (...args) => fieldTarget(...args),
    goToView,
    fromSnapshot,
    hideEye: (...args) => hideEye(...args),
    icon,
    keepKit,
    kit: () => kit(),
    makeAiPack,
    libraryItems: (...args) => libraryItems(...args),
    mutate,
    probeCodec: (...args) => probeCodec(...args),
    proLock: (...args) => proLock(...args),
    readTemplates,
    refreshIcons,
    refreshScene,
    rememberEdge: (...args) => rememberEdge(...args),
    renderLibrary: (...args) => renderLibrary(...args),
    renderSelection,
    runClips: (...args) => runClips(...args),
    safeName,
    setDraft: (...args) => setDraft(...args),
    setDraftPolicy: (...args) => setDraftPolicy(...args),
    setDrawingBox,
    setMeasuring,
    setSheet,
    setShadowLive: (...args) => setShadowLive(...args),
    setTier,
    saveViewPrefs: (...args) => saveViewPrefs(...args),
    scaleSelected,
    setPanTool,
    tagAssetRoles,
    setShow3d,
    setWalking,
    snapshot,
    syncAutoPan,
    syncArtInputs: (...args) => syncArtInputs(...args),
    syncPanelInputs: (...args) => syncPanelInputs(...args),
    syncPedestalInputs: (...args) => syncPedestalInputs(...args),
    syncQuality: (...args) => syncQuality(...args),
    syncShadowInputs: (...args) => syncShadowInputs(...args),
    syncTools: (...args) => syncTools(...args),
    toast,
    addCatalogPlacement: (...args) => addCatalogPlacement(...args),
    applyColor: (...args) => applyColor(...args),
    deletePanel,
    deletePedestal,
    nudgeSelection,
    removeRowSlot: (...args) => removeRowSlot(...args),
    rotateSelection,
    showClearance,
    frameGuideShape: (...args) => frameGuideShape(...args),
    loadViewPrefs: (...args) => loadViewPrefs(...args),
    reveal: (...args) => reveal(...args),
    revealPanelFields: (...args) => revealPanelFields(...args),
    revealPedestalFields: (...args) => revealPedestalFields(...args),
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
    qualityOptions: (...args) => qualityOptions(...args),
    scaleControl,
    syncSavedViews,
    render: (...args) => render(...args),
    renderStatus: (...args) => renderStatus(...args),
    renderInspector: (...args) => renderInspector(...args),
    inspectorHTML: (...args) => inspectorHTML(...args),
    showSection: (...args) => showSection(...args),
    aiSection: (...args) => aiSection(...args),
    artShowHTML: (...args) => artShowHTML(...args),
    artSlider: (...args) => artSlider(...args),
    artThumb: (...args) => artThumb(...args),
    clearanceSection: (...args) => clearanceSection(...args),
    draftSection: (...args) => draftSection(...args),
    edgeColorFields: (...args) => edgeColorFields(...args),
    findableName: (...args) => findableName(...args),
    groundFields: (...args) => groundFields(...args),
    hallPanel: (...args) => hallPanel(...args),
    heroSection: (...args) => heroSection(...args),
    keepSafeHTML: (...args) => keepSafeHTML(...args),
    libraryHTML: (...args) => libraryHTML(...args),
    locationOptions: (...args) => locationOptions(...args),
    looksSection: (...args) => looksSection(...args),
    modelsSection: (...args) => modelsSection(...args),
    multiSection: (...args) => multiSection(...args),
    panelFields: (...args) => panelFields(...args),
    pedestalFields: (...args) => pedestalFields(...args),
    peopleSection: (...args) => peopleSection(...args),
    powerSection: (...args) => powerSection(...args),
    rowSection: (...args) => rowSection(...args),
    sentLinksHTML: (...args) => sentLinksHTML(...args),
    shadowSection: (...args) => shadowSection(...args),
    showSelected: (...args) => showSelected(...args),
    signFields: (...args) => signFields(...args),
    surroundingsFields: (...args) => surroundingsFields(...args),
    tagsSection: (...args) => tagsSection(...args),
    underlaySection: (...args) => underlaySection(...args),
    videoSection: (...args) => videoSection(...args),
    viewsSection: (...args) => viewsSection(...args),
    range: (...args) => range(...args),
    scheduleSave,
    updateFrameGuide: (...args) => updateFrameGuide(...args),
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
  // The view settings, the toolbar's state and the frame guide: src/ui/view-prefs.js.
  // Made before the scene's wiring, which loads the view settings as it starts.
  const { qualityOptions, syncQuality, syncTools, loadViewPrefs, saveViewPrefs, setDraftPolicy, setDraft, frameGuideShape, updateFrameGuide } = createViewPrefs(ctx);
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
  // The panels' field builders and the Pro lock: src/panels/fields.js.
  const { field, hideEye, allowed, proLock, gated, colorField, range } = createFields(ctx);
  // The controls that follow an edit made elsewhere, and what a control is about: src/ui/sync-inputs.js.
  const { syncArtInputs, syncPanelInputs, reveal, revealPanelFields, syncPedestalInputs, revealPedestalFields, syncShadowInputs, setShadowLive, endShadowGesture, fieldTarget, applyColor, rememberEdge } = createSyncInputs(ctx);
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
  const { lightBarLevels, shadowSection, dialSVG } = createLightingPanel(ctx);
  const { artShowHTML } = createArtShowPanel(ctx);
  const { frameFields, frameNote, aiSection, powerSection } = createExportPanel(ctx);
  // The library, its placements and its drag onto the stage: src/ui/library.js.
  const { libraryItems, addCatalogPlacement, renderLibrary } = createLibrary(ctx);
  const { groundFields, rowSection, surroundingsFields, draftSection, viewsSection, tagsSection, underlaySection, clearanceSection, peopleSection } = createLayoutPanel(ctx);
  // The row of booths: which one new work goes into, and its edits: src/ui/row-edit.js.
  const { activeSlot, addRowBooths, addRowSpace, removeRowSlot, rowCount } = createRowEdit(ctx);
  // Recording clips, one or a batch, and the codec check: src/ui/clips.js.
  const { probeCodec, runClips, progressHTML } = createClips(ctx);

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

  // What the page draws from the project, and the inspector's sub-tabs: src/ui/render.js.
  const { render, renderStatus, inspectorHTML, renderInspector, showSection } = createRender(ctx);
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
  // Where site data is blocked, even reading `localStorage` throws: null then,
  // which src/keep-safe.js reads as nothing remembered.
  const deviceStore = () => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };
  const { keepSafeHTML, paintKeepSafe, remindBackup } = createKeepSafePanel(ctx);
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
  // Photo layers, wall assets and the four file inputs for models, plans, backdrops and grounds: src/ui/asset-inputs.js.
  const { addPhotoLayer, addWallAsset } = createAssetInputs(ctx);
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
