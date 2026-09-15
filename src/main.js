import { TENTS } from "./environment.js";
import { applyImageEdits, DEFAULT_IMAGE_EDITS, normalizeImageEdits } from "./image-edit.js";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "./style.css";
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
  Image,
  Check,
  Sun,
  PanelLeftClose,
  X,
  AlignCenter,
  ArrowUpToLine,
  Layers,
  RotateCcw,
} from "lucide";
import {
  demoProject,
  blankProject,
  uid,
  validateProject,
  escapeHTML as e,
  boundWarning,
  mismatch,
  constrain,
  scalePanel,
  convex,
} from "./model.js";
import { load, save, download, readImage } from "./storage.js";
import { BoothScene } from "./scene.js";
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
    Image,
    Check,
    Sun,
    PanelLeftClose,
    X,
    AlignCenter,
    ArrowUpToLine,
    Layers,
    RotateCcw,
  };
  const icon = (n) => `<i data-lucide="${n}"></i>`;
  const btn = (action, label, ic, cls = "") =>
    `<button data-action="${action}" class="${cls}" title="${e(label)}" aria-label="${e(label)}">${ic ? icon(ic) : ""}<span>${label}</span></button>`;
  let p,
    selected = null,
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
    quality = 1.5,
    editingStart = null;
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
    if (project.booth.groundAsset && project.assets[project.booth.groundAsset]) project.assets[project.booth.groundAsset].role = "ground";
  }
  p ||= demoProject();
  tagAssetRoles(p);
  selected = p.art[0]?.id;
  document.querySelector("#app").innerHTML =
    `<header><a class="brand" href="#" aria-label="Booth Studio">${icon("box")}<span>Artist OS</span></a><span class="app-badge">Booth Studio</span><div class="project"><input id="project-name" aria-label="Project name" maxlength="120" value="${e(p.name)}"/>${icon("chevron-down")}</div><div class="save-status" id="save-status" role="status">Opening…</div>${btn("help", "Help", "help-circle", "icon-only")}<div class="avatar">IA</div></header>
<div class="workspace"><aside class="library" id="library"></aside><main class="editor"><div class="toolbar"><div class="toolgroup">${btn("select", "Select", "mouse-pointer-2", "active")}${btn("move", "Move", "move")}${btn("snap", "Snap 1″", "grid-2x2", "active")}</div><div class="toolgroup">${btn("undo", "Undo", "undo-2", "icon-only")}${btn("redo", "Redo", "redo-2", "icon-only")}</div><div class="mode-switch"><button data-action="mode-3d">3D booth</button><button data-action="mode-photo">Photo</button></div>${btn("export-tab", "Export", "download", "export-top")}</div><div class="viewport"><div id="scene"></div><div id="photo" hidden></div><div class="scene-label"><span class="eyebrow" id="mode-label">MEASURED WORKSPACE</span><strong id="scene-title"></strong><span id="scene-subtitle"></span></div><div id="photo-empty" hidden><div>${icon("image-plus")}<h2>Start with your booth shot</h2><p>Add artwork and adjust its four corners to match the wall perspective.</p>${btn("upload-photo", "Upload booth photo", "plus", "primary")}</div></div><div class="viewport-bottom"><div class="view-switch" id="view-switch"><button data-view="perspective" class="active">Perspective</button><button data-view="back">Back</button><button data-view="left">Left</button><button data-view="right">Right</button><button data-view="plan">Plan</button></div><div class="zoom-controls"><span class="zoom-label">Zoom</span>${btn("zoom-out", "Zoom out", "minus", "icon-only")}${btn("zoom-in", "Zoom in", "plus", "icon-only")}${btn("reset-view", "Reset view", "rotate-ccw", "icon-only")}</div></div></div><div class="statusbar"><span id="gesture-hint">Drag to orbit · scroll to zoom · right-drag to pan</span><span id="selection-status"></span></div></main><aside class="inspector"><div class="inspector-tabs">${["art", "layout", "lighting", "export"].map((t, i) => `<button data-tab="${t}">${icon(["image", "layout-panel-left", "lightbulb", "download"][i])}<span>${["Artwork", "Layout", "Lighting", "Export"][i]}</span></button>`).join("")}</div><div id="inspector-content"></div></aside></div><footer><span class="footer-brand">${icon("box")} BOOTH STUDIO <small>Prototype 01</small></span><span>Your images. Your space. Your arrangement.</span><span id="network">Local workspace</span></footer><input type="file" id="art-input" accept="image/jpeg,image/png" multiple hidden/><input type="file" id="replace-input" accept="image/jpeg,image/png" hidden/><input type="file" id="photo-input" accept="image/jpeg,image/png" hidden/><input type="file" id="surround-input" accept="image/jpeg,image/png" hidden/><input type="file" id="ground-input" accept="image/jpeg,image/png" hidden/><input type="file" id="backup-input" accept=".json,.booth" hidden/><div id="toast" role="status"></div><dialog id="dialog"><div id="dialog-content"></div></dialog><dialog id="image-editor"><div id="image-editor-content"></div></dialog>`;
  let scene;
  try {
    scene = new BoothScene(
      document.querySelector("#scene"),
      (id) => {
        selected = id;
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
    scene?.update(p, selected);
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
  ) {
    return `<label class="field"><span>${label}</span><div><input type="number" data-field="${key}" data-scope="${scope}" aria-label="${label}" value="${Number(value.toFixed(3))}" min="${min}" max="${max}" step="${step}"/><small>${unit}</small></div></label>`;
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
      p.booth.groundAsset,
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
  function surroundingsFields() {
    const b=p.booth;
    return `${b.neighbors ? `<label class="setting-label">Booth position<select aria-label="Booth position" data-field="neighborLayout" data-scope="booth">${Object.entries({inline:"Inline · both sides","corner-left":"Left corner · left side open","corner-right":"Right corner · right side open",island:"Island · no adjoining booths"}).map(([k,v])=>`<option value="${k}" ${(b.neighborLayout||"inline")===k?"selected":""}>${v}</option>`).join("")}</select></label>${field("Side spacing","neighborGap",b.neighborGap ?? 24,0,240,1,"in","booth")}${(b.neighborLayout||"inline") !== "island" ? `<label class="check-field"><input type="checkbox" data-field="neighborRear" data-scope="booth" ${b.neighborRear?"checked":""}/>Booth behind</label>${b.neighborRear ? field("Rear spacing","rearGap",b.rearGap ?? 24,0,240,1,"in","booth") : ""}` : ""}<p class="muted">Gaps are between nominal footprint edges. Left/right are viewed from the entrance. Tent overhangs and artwork can extend into the gap.</p>` : ""}
      <h4>Photographic materials</h4>
      ${btn("upload-surround",b.surroundAsset?"Replace panorama":"Upload 360° panorama","image-plus","wide")}
      ${b.surroundAsset ? `${field("Panorama rotation","surroundRotation",b.surroundRotation||0,-180,180,1,"°","booth")}${btn("clear-surround","Remove panorama",null,"wide")}` : ""}
      ${btn("upload-ground",b.groundAsset?"Replace ground texture":"Upload ground texture","image-plus","wide")}
      ${b.groundAsset ? `${field("Ground tile size","groundTile",b.groundTile||48,12,240,1,"in","booth")}${btn("clear-ground","Remove ground texture",null,"wide")}` : ""}
      <p class="muted">Panorama: 2:1 full-sphere JPG/PNG, not an ordinary flat photo. Ground: a top-down, ideally seamless photograph. Images stay on this device and enter backups/exports. Scenery is a backdrop, not reconstructed 3D.</p>`;
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
      html = `<div class="mobile-library">${libraryHTML(true)}</div>${a ? `<div class="panel-heading"><h2>Artwork properties</h2><span class="badge">${a.kind === "sign" ? "Sign" : a.kind === "label" ? "Label" : a.asset ? "Original" : "Sample"}</span></div><div class="selected-art"><div class="thumb">${artThumb(a)}</div><div><input class="title-input" data-field="title" data-scope="art" aria-label="Artwork title" maxlength="120" value="${e(a.title)}"/><span>${a.kind === "sign" || a.kind === "label" ? "Editable wall asset" : a.asset ? "Original image preserved" : "Measured placeholder panel"}</span>${a.kind === "sign" || a.kind === "label" ? "" : btn("replace-art", a.asset ? "Replace image" : "Add original image", "image-plus", "text-button")}</div></div>${signFields(a)}${a.asset ? `<section><h3>Image adjustments</h3><p class="muted">Edits affect this placement only. The uploaded original stays unchanged.</p>${btn("edit-image", "Edit image", "image", "primary wide")}<div class="button-row">${btn("copy-edits", "Copy edits", "copy")}${btn("paste-edits", "Paste edits", "layers", p.editClipboard ? "" : "disabled")}</div></section>` : ""}<section><h3>Dimensions <span>inches</span></h3><p class="muted">Double-click or double-tap artwork on the wall, then drag it to move or drag a blue corner to scale. Numeric controls remain available here.</p><div class="button-row">${btn("scale-smaller", "Scale −10%", "minus")}${btn("scale-larger", "Scale +10%", "plus")}</div>${field("Width", "w", a.w, 1, 360)}${field("Height", "h", a.h, 1, 360)}${mismatch(p, a) ? `<div class="warning">Image proportions differ from the panel. The full image is fitted inside without stretching.${btn("match-ratio", "Match height to image", null, "wide")}</div>` : ""}${field("Thickness", "thickness", a.thickness, 0.1, 12, 0.1)}${field("Wall gap", "offset", a.offset, 0, 12, 0.1)}</section><section><h3>Placement</h3><div class="exterior-callout"><strong>Interior and exterior walls</strong><span>Artwork can hang on either face of all three walls.</span></div><label class="select-field">Wall location<select data-field="location" data-scope="art" aria-label="Wall location">${[["back","inside","Back · Interior"],["left","inside","Left · Interior"],["right","inside","Right · Interior"],["back","outside","Back · Exterior"],["left","outside","Left · Exterior"],["right","outside","Right · Exterior"]].map(([wall,face,label]) => `<option value="${wall}-${face}" ${a.wall === wall && (a.face || "inside") === face ? "selected" : ""}>${label}</option>`).join("")}</select></label><div class="button-row">${btn("face-view", "View wall face", "camera")}</div>${field("Left edge", "x", a.x, -360, 360)}${field("Bottom edge", "y", a.y, -360, 360)}<p class="muted">From the bottom-left corner, facing the ${a.face === "outside" ? "outside" : "inside"} of this wall.</p>${boundWarning(p, a) ? `<div class="warning">${boundWarning(p, a)}</div>` : ""}<div class="button-row">${btn("center", "Center", "align-center")}${btn("eye-level", "Center at 60″", "arrow-up-to-line")}</div></section><section><h3>Actions</h3><div class="button-row">${btn("duplicate-art", "Duplicate", "copy")}${btn("delete-art", "Remove", "trash-2", "danger")}</div></section>` : `<div class="empty-inspector"><h2>Make room for your work.</h2><p>Upload artwork and set its dimensions, then arrange it on the booth walls.</p>${btn("upload-art", "Upload artwork", "image-plus", "primary")}</div>`}`;
    }
    if (tab === "layout") {
      html = `<div class="panel-heading"><h2>${p.mode === "photo" ? "Booth photograph" : "Booth layout"}</h2>${icon("layout-panel-left")}</div>${p.mode === "photo" ? `<p class="muted">The original photo stays intact. Added art and light overlays are saved separately. Existing objects in the photograph cannot be moved or erased in this prototype.</p>${btn("upload-photo", p.photo.asset ? "Replace booth photo" : "Upload booth photo", "image-plus", "wide")}${range("Photo exposure", "exposure", p.photo.exposure, -1, 1, 0.05, "photo")}` : `<section><h3>Footprint</h3><select data-field="preset" aria-label="Booth preset"><option value="120" ${p.booth.width === 120 ? "selected" : ""}>10 × 10 ft · Standard</option><option value="240" ${p.booth.width === 240 ? "selected" : ""}>10 × 20 ft · Double</option></select><p class="muted">Nominal footprint. Panels and 1.4″ canopy legs reduce usable space near edges.</p>${field("Wall height", "height", p.booth.height, 48, 144, 1, "in", "booth")}<label class="check-field"><input type="checkbox" data-field="tent" data-scope="booth" ${p.booth.tent ? "checked" : ""}/>White canopy & frame</label><label class="setting-label">Tent style<select aria-label="Tent style" data-field="tentStyle" data-scope="booth">${Object.entries(TENTS).map(([k,v])=>`<option value="${k}" ${(p.booth.tentStyle||'classic')===k?'selected':''}>${v}</option>`).join('')}</select></label><p class="muted">12″ fabric valance, rounded hems, roof ribs and folding frame. Inspired shapes; not manufacturer-certified models.</p></section><section><h3>Surroundings</h3><label class="setting-label">Ground<select aria-label="Ground" data-field="ground" data-scope="booth">${Object.entries({studio:'Studio floor',grass:'Grass',concrete:'Concrete',asphalt:'Asphalt'}).map(([k,v])=>`<option value="${k}" ${(p.booth.ground||'studio')===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="setting-label">Horizon<select aria-label="Horizon" data-field="horizon" data-scope="booth">${Object.entries({studio:'Neutral studio',open:'Open sky',park:'Park · trees',urban:'Urban plaza'}).map(([k,v])=>`<option value="${k}" ${(p.booth.horizon||'studio')===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="check-field"><input type="checkbox" data-field="neighbors" data-scope="booth" ${p.booth.neighbors?'checked':''}/>Surround with other booths</label>${surroundingsFields()}</section><section><h3>Display walls</h3><label class="color-field">Fabric finish<input type="color" data-field="color" data-scope="booth" value="${p.booth.color}"/></label><div class="swatches">${["#45474a", "#25282b", "#b1aea4", "#d8d4ca"].map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Wall finish ${c}"></button>`).join("")}</div>${["back", "left", "right"].map((w) => `<div class="wall-setting"><label class="check-field"><input type="checkbox" data-field="enabled" data-scope="wall-${w}" ${p.booth.walls[w].enabled ? "checked" : ""}/>${w[0].toUpperCase() + w.slice(1)} wall</label>${field("Width", "width", p.booth.walls[w].width, 12, w === "back" ? p.booth.width : p.booth.depth, 1, "in", "wall-" + w)}${field("Height", "height", p.booth.walls[w].height, 24, 144, 1, "in", "wall-" + w)}</div>`).join("")}</section>`}<section><h3>Project</h3>${btn("copy-project", "Duplicate as alternative", "copy", "wide")}${btn("new-project", "New empty booth", "plus", "wide")}${btn("backup", "Download project backup", "save", "wide")}${btn("import", "Open project backup", "folder-open", "wide")}<p class="muted">Backups include all original images. Download before switching projects.</p></section>`;
    }
    if (tab === "lighting") {
      const photoMode = p.mode === "photo",
        lights = photoMode ? p.photo.lights : p.lights,
        index = photoMode ? photoLightIndex : lightIndex,
        light = lights[index];
      html = `<div class="panel-heading"><h2>${photoMode ? "Photo lighting" : "Lighting studio"}</h2>${icon("lightbulb")}</div><p class="muted">${photoMode ? "Reversible light overlays. A single photo cannot recover geometry or physically relight the booth." : "Light your real geometry. Wall gaps and panel thickness shape the cast shadows."}</p><div class="button-row">${btn("daylight", "Daylight", "sun")}${btn("warm", "Warm", "lightbulb")}</div>${!photoMode ? `<section>${range("Ambient illumination", "ambient", p.ambient, 0, 4, 0.05)}</section>` : ""}<section><h3>${photoMode ? "Light overlays" : "Spotlights"} <span>${lights.length} / ${photoMode ? 8 : 4}</span></h3><div class="light-picker">${lights.map((l, i) => `<button data-light="${i}" class="${index === i ? "active" : ""}">${i + 1}</button>`).join("")}${lights.length < (photoMode ? 8 : 4) ? btn("add-light", "Add", "plus", "icon-only") : ""}</div>${light ? `${range("Brightness", "power", light.power, 0, photoMode ? 1 : 300, photoMode ? 0.05 : 5, photoMode ? "photoLight" : "light")}${range("Temperature", "kelvin", light.kelvin, 2700, 6500, 100, photoMode ? "photoLight" : "light", " K")}${photoMode ? `${range("Horizontal", "x", light.x, 0, 1, 0.01, "photoLight")}${range("Vertical", "y", light.y, 0, 1, 0.01, "photoLight")}${range("Radius", "radius", light.radius, 0.02, 0.8, 0.01, "photoLight")}` : `<h4>Light position · inches</h4>${field("Left / right", "x", light.x, -360, 360, 1, "in", "light")}${field("Height", "y", light.y, 0, 160, 1, "in", "light")}${field("Front / back", "z", light.z, -360, 360, 1, "in", "light")}<h4>Aim at · inches</h4>${field("Target X", "tx", light.tx, -360, 360, 1, "in", "light")}${field("Target height", "ty", light.ty, 0, 160, 1, "in", "light")}${field("Target Z", "tz", light.tz, -360, 360, 1, "in", "light")}<p class="muted">Origin: center of floor. +X right, +Z toward the entrance. Height starts at the floor.</p>`}${btn("delete-light", "Remove light", "trash-2", "wide")}` : ""}</section>`;
    }
    if (tab === "export") {
      html = `<div class="panel-heading"><h2>Export your booth</h2>${icon("download")}</div><p class="muted">A clean image of the current ${p.mode === "photo" ? "photo composition" : "camera view"}, without controls or selection outlines.</p><section><h3>Image size</h3><select id="export-size" aria-label="Export image width"><option value="2048">2048 px wide · Fast</option><option value="4096" selected>4096 px wide · High resolution</option></select><p class="muted">PNG · Current aspect ratio${p.mode === "photo" ? ". Enlarging a small source cannot restore missing detail." : ". Preview textures are capped at 2048 px per artwork; originals remain in the backup."}</p>${btn("export-image", "Export PNG", "download", "primary wide")}</section><section><h3>Installation guide</h3><p class="muted">Measured wall elevations, panel sizes, and left/bottom placement references. Open the downloaded HTML to print or save as PDF. Photo overlays are excluded.</p>${btn("guide", "Download hanging guide", "layout-panel-left", "wide")}</section><section><h3>Keep your work</h3>${btn("backup", "Download project backup", "save", "wide")}${btn("import", "Open project backup", "folder-open", "wide")}<p class="muted">Includes original artwork and photo files, booth layout, and lighting.</p></section><section><h3>Preview quality</h3><select id="quality" aria-label="Preview quality"><option value="1" ${quality === 1 ? "selected" : ""}>Efficient · Older devices</option><option value="1.5" ${quality === 1.5 ? "selected" : ""}>Balanced</option><option value="2" ${quality === 2 ? "selected" : ""}>High detail</option></select></section>`;
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
          : "Drag to orbit · scroll to zoom · right-drag to pan";
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
    "clear-ground": () => mutate(()=>{p.booth.groundAsset=null;}),
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
        a.x = (p.booth.walls[a.wall].width - a.w) / 2;
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
        const width = Number(document.querySelector("#export-size").value),
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
    help: () => {
      const d = document.querySelector("#dialog");
      document.querySelector("#dialog-content").innerHTML =
        `<div class="panel-heading"><h2>Welcome to Booth Studio</h2>${btn("close-help", "Close", "x", "icon-only")}</div><p>Start with Layout, upload your original artwork, and enter its actual dimensions. Sample panels are dimension placeholders, not artwork.</p><ol><li><strong>Arrange:</strong> select a work in the library. Set its wall, left edge, and bottom edge. Use Move to drag along the wall, or Center to align.</li><li><strong>Navigate:</strong> drag empty space to orbit, scroll to zoom, right-drag to pan. On touch, use one finger to orbit and two to pan/zoom. Wall and Plan views give precise views.</li><li><strong>Light:</strong> adjust ambient light and each spotlight’s position, target, power, and temperature.</li><li><strong>Photo:</strong> upload a booth shot, select uploaded library artwork to add it, then drag its four corners. Lighting is a visual overlay. Existing photo objects remain baked in.</li><li><strong>Keep:</strong> autosave is on this browser/device only. Download a full backup to transfer or archive a project.</li><li><strong>Export:</strong> PNG captures the current view; the hanging guide gives measured artwork edges.</li></ol><p class="muted">Ctrl/⌘ Z: undo · Ctrl/⌘ Shift Z: redo · Delete: remove selected artwork. No AI calls. Single images do not supply surface relief; baked-in lighting remains. Photorealism and exact display color are not guaranteed.</p>`;
      refreshIcons();
      d.showModal();
    },
    "close-help": () => document.querySelector("#dialog").close(),
  };
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.action) {
      try {
        actions[b.dataset.action]?.();
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
    toast("New copy placed on " + placed.wall + " wall · " + placed.face + ". Double-tap to adjust.");
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
        mutate(()=>{const id=uid();asset.role=key==="surroundAsset"?"surround":"ground";p.assets[id]=asset;p.booth[key]=id;});
        toast("Photographic material added. Original image is included in backups.");
      }catch(err){toast(err.message,true);}
    };
  }

  document.addEventListener("change", (ev) => {
    const el = ev.target;
    if (el.id === "project-name") {
      mutate(() => (p.name = el.value.trim() || "Untitled booth"));
      return;
    }
    if (el.id === "quality") {
      quality = +el.value;
      scene?.renderer.setPixelRatio(Math.min(devicePixelRatio, +el.value));
      scene?.resize();
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
        const [wall, face] = String(value).split("-");
        const currentFace = a.face || "inside";
        let x = a.x;
        if (currentFace !== face) x = p.booth.walls[wall].width - a.x - a.w;
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
      if (scope === "booth" && key === "tentStyle") p.booth.tent = true;
      if (scope === "booth" && key === "height")
        Object.values(p.booth.walls).forEach((w) => (w.height = value));
    });
  });
  document.addEventListener("input", (ev) => {
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
      get photo() {
        return photo;
      },
      mutate,
      save: () => save(structuredClone(p)),
    };
}
boot().catch((err) => {
  console.error(err);
  document.querySelector("#app").innerHTML =
    "<div><h1>Booth Studio could not start</h1><p>Please reload or try another browser. Existing saved data has not been removed.</p></div>";
});
