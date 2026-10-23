// What the page draws from the project: `render` (the header, the mode
// switch, the toolbar's state, the show floor's board, then the library, the
// inspector and the scene), `renderStatus` (the two lines under the
// viewport), `renderInspector` and `inspectorHTML` (the open tab's panel,
// composed from the section builders in src/panels/ and src/ui/), and the
// sub-tabs — the row of section chips over a long panel. `render`,
// `renderStatus`, `renderInspector`, `inspectorHTML` and `showSection` are
// returned. Called once: it adds the chips' `click` listener to
// #inspector-content. Moved out of src/main.js's boot() as it was
// (MAIN_SPLIT_PHASE.md, seam 19): `ctx` is boot's state, read and set
// through it, and the helpers these call.
import { TENTS } from "../environment.js";
import { ENV_PRESETS, ART_FIDELITY, DEFAULT_PRESET, DEFAULT_FIDELITY, FIXTURE_MODES, DEFAULT_FIXTURES, isIndoor, showFixtures } from "../lighting.js";
import { STILL_SIZES } from "../framing.js";
import { shadowSpec } from "../dropshadow.js";
import { boothSlots, hasRow, normalizeRow, slotLabel } from "../row.js";
import { lightVisible, escapeHTML as e, boundWarning, mismatch, hallSpec, isArtShow, lightBarSpec } from "../model.js";
import { VENUES as SHOW_VENUES, feet, floorOf, showItems, toFloor } from "../show.js";
import { createShowEditor } from "../show-editor.js";
import { liveNumber } from "../linked.js";
import { TIERS } from "../tier.js";
import { ROLES, resolveRole } from "../roles.js";

export function createRender(ctx) {
  const { aiSection, allowed, applyRole, artShowHTML, artSlider, artThumb, batchSection, btn, clearanceSection, colorField, draftSection, edgeColorFields, field, findableName, frameFields, frameNote, gated, groundFields, hallPanel, heroSection, icon, keepSafeHTML, libraryHTML, lightBarLevels, locationOptions, looksSection, modelsSection, multiSection, mutate, paintKeepSafe, panelFields, pedestalFields, peopleSection, powerSection, qualityOptions, range, refreshIcons, refreshScene, renderLibrary, rowSection, scaleControl, sentLinksHTML, setWalking, shadowSection, showSelected, signFields, surroundingsFields, syncSavedViews, syncTools, tagsSection, underlaySection, updateFrameGuide, videoSection, viewsSection } = ctx;
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
    const seen = subSeen[ctx.tab];
    subSeen[ctx.tab] = labels;
    if (!sectionTabsOn() || labels.length < 3) return;
    const fresh = seen ? labels.filter((l) => !seen.includes(l)) : [];
    if (fresh.length && subTab[ctx.tab] !== SUB_ALL) subTab[ctx.tab] = fresh[0];
    if (subTab[ctx.tab] !== SUB_ALL && !labels.includes(subTab[ctx.tab])) subTab[ctx.tab] = labels[0];
    const chosen = subTab[ctx.tab];
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
    subTab[ctx.tab] = hit.label;
    applySectionTabs(root);
  }
  document.querySelector("#inspector-content").addEventListener("click", (ev) => {
    const chip = ev.target.closest?.("[data-subtab]");
    if (!chip) return;
    subTab[ctx.tab] = chip.dataset.subtab;
    const root = document.querySelector("#inspector-content");
    applySectionTabs(root);
    root.scrollTop = 0;
  });
  /**
   * Where the tab strip scrolls sideways (a phone, a tablet), the open tab is
   * kept in sight when something other than a tap opens it: tool search, the
   * assistant's "take me to", the toolbar's Export. Only the strip scrolls;
   * scrollIntoView would move the page or the sheet as well. Only when the
   * tab changes: a redraw for any other reason leaves a strip the artist
   * scrolled by hand where they put it.
   */
  let tabInSight = null;
  function keepTabInSight() {
    if (ctx.tab === tabInSight) return;
    tabInSight = ctx.tab;
    const strip = document.querySelector(".inspector-tabs");
    const on = strip?.querySelector(`[data-tab="${ctx.tab}"]`);
    if (!on || strip.scrollWidth <= strip.clientWidth) return;
    const s = strip.getBoundingClientRect();
    const b = on.getBoundingClientRect();
    if (b.left < s.left) strip.scrollLeft -= s.left - b.left;
    else if (b.right > s.right) strip.scrollLeft += b.right - s.right;
  }
  function renderInspector() {
    document
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === ctx.tab));
    applyRole();
    keepTabInSight();
    const root = document.querySelector("#inspector-content");
    root.innerHTML = inspectorHTML();
    applySectionTabs(root);
    refreshIcons();
    updateFrameGuide();
    if (ctx.tab === "export") paintKeepSafe();
  }
  /** The open tab's inspector, as markup. Tool search reads every tab's. */
  function inspectorHTML() {
    const a = ctx.p.art.find((a) => a.id === ctx.selected),
      l = ctx.p.photo.layers.find((l) => l.id === ctx.photoSelected);
    let html = "";
    if (ctx.tab === "art" && ctx.p.mode === "photo") {
      html = `<div class="panel-heading"><h2>Photo artwork</h2>${btn("upload-art", "Upload artwork", "plus", "icon-only")}</div><p class="muted">Select a library work to add it to this photo. Drag its corners to match the wall. Placement is visual, not measured.</p><div class="mobile-library">${libraryHTML(true)}</div>${l ? `<section><h3>${e(l.title)}</h3>${range("Cast-shadow overlay", "shadow", l.shadow, 0, 60, 1, "photoLayer")}<p class="muted">Drag inside to move. Blue corner handles control perspective.</p>${l.corners.map((c, i) => `<h4>${["Top left", "Top right", "Bottom right", "Bottom left"][i]}</h4><div class="field-pair">${field("X %", i + "-0", c[0] * 100, 0, 100, 0.1, "%", "corner")}${field("Y %", i + "-1", c[1] * 100, 0, 100, 0.1, "%", "corner")}</div>`).join("")}<div class="button-row">${btn("photo-front", "Bring to front", "layers")}${btn("photo-delete", "Remove", "trash-2")}</div></section>` : '<div class="empty-inspector"><p>Choose an uploaded work from your library, or upload a new one.</p></div>'}<section><h3>Photo layers</h3>${ctx.p.photo.layers.map((x) => `<button class="wide layer-row ${x.id === ctx.photoSelected ? "active" : ""}" data-layer="${x.id}">${e(x.title)}</button>`).join("")}</section>`;
    } else if (ctx.tab === "art") {
      html = `<div class="mobile-library">${libraryHTML(true)}</div>${a ? `${multiSection()}<div class="panel-heading"><h2>Artwork properties</h2><span class="badge">${a.kind === "sign" ? "Sign" : a.kind === "label" ? "Label" : a.asset ? "Original" : "Sample"}</span></div><div class="selected-art"><div class="thumb">${artThumb(a)}</div><div><input class="title-input" data-field="title" data-scope="art" aria-label="Artwork title" maxlength="120" value="${e(a.title)}"/><span>${a.kind === "sign" || a.kind === "label" ? "Editable wall asset" : a.asset ? "Original image preserved" : "Measured placeholder panel"}</span>${a.kind === "sign" || a.kind === "label" ? "" : btn("replace-art", a.asset ? "Replace image" : "Add original image", "image-plus", "text-button")}</div></div>${signFields(a)}${a.asset ? `<section><h3>Image adjustments</h3><p class="muted">Edits affect this placement only. The uploaded original stays unchanged.</p>${btn("edit-image", "Edit image", "image", "primary wide")}<div class="button-row">${btn("copy-edits", "Copy edits", "copy")}${btn("paste-edits", "Paste edits", "layers", ctx.p.editClipboard ? "" : "disabled")}</div></section>` : ""}<section><h3>Dimensions <span>inches</span></h3><p class="muted">Double-tap artwork to adjust. Corners scale proportionally; middle edge handles stretch width or height.</p>${scaleControl(a)}<label class="setting-label"><input type="checkbox" data-field="stretch" data-scope="art" ${a.stretch ? "checked" : ""}/> Stretch image to panel dimensions</label>${field("Width", "w", a.w, 1, 360)}${field("Height", "h", a.h, 1, 360)}${!a.stretch && mismatch(ctx.p, a) ? `<div class="warning">Image proportions differ from the panel. The full image is fitted inside without stretching.${btn("match-ratio", "Match height to image", null, "wide")}</div>` : ""}${field("Thickness", "thickness", a.thickness, 0.1, 12, 0.1)}<label class="setting-label">Edge material<select data-field="edgeTexture" data-scope="art" aria-label="Edge material">${["plain","concrete","wood","metal"].map(k=>`<option value="${k}" ${(a.edgeTexture || "plain") === k ? "selected" : ""}>${k === "wood" ? "Wood grain" : k[0].toUpperCase()+k.slice(1)}</option>`).join("")}</select></label>${edgeColorFields(a)}${field("Wall gap", "offset", a.offset, 0, 12, 0.1)}<p class="muted">How far the work stands off the wall. ${shadowSpec(ctx.p.booth, "behind").on || shadowSpec(ctx.p.booth, "under").on ? "Head-on, the drawn drop shadow is what makes a gap read; its distance and size are set in Lighting → Drop shadow." : "With both drawn shadows hidden (Lighting → Drop shadow), a gap is only visible looking along the wall."}</p></section><section><h3>Placement</h3><div class="exterior-callout"><strong>Interior and exterior walls</strong><span>Artwork can hang on either face of the three booth walls and of any free-standing wall.</span></div>${hasRow(ctx.p.booth) ? `<label class="select-field">Booth<select data-field="inBooth" data-scope="art" aria-label="Which booth this hangs in">${boothSlots(ctx.p.booth).map((b) => `<option value="${e(b.id)}" ${(a.booth || normalizeRow(ctx.p.booth).home) === b.id ? "selected" : ""}>${e(slotLabel(b))}</option>`).join("")}</select></label>` : ""}<label class="select-field">Wall location<select data-field="location" data-scope="art" aria-label="Wall location">${locationOptions(a)}</select></label><div class="button-row">${btn("face-view", "View wall face", "camera")}</div>${field("Left edge", "x", a.x, -360, 360)}${artSlider(a, "x", "Slide left / right")}${field("Bottom edge", "y", a.y, -360, 360)}${artSlider(a, "y", "Slide up / down")}<p class="muted">From the bottom-left corner, facing the ${a.face === "outside" ? "outside" : "inside"} of this wall.</p>${boundWarning(ctx.p, a) ? `<div class="warning">${boundWarning(ctx.p, a)}</div>` : ""}<div class="button-row">${btn("center", "Center", "align-center")}${btn("eye-level", "Center at 60″", "arrow-up-to-line")}</div><div class="button-row">${btn("multi-mode", ctx.addMode ? "Done selecting" : "Select several", "plus", ctx.addMode ? "active" : "")}</div>${ctx.addMode ? '<p class="muted">Tap works in the booth to add them to the selection; tap one again to take it out.</p>' : ""}<div class="button-row">${btn("space-wall", "Space this wall evenly", "columns-2")}${btn("hang-wall", "Hang this wall at 60″", "ruler")}</div><p class="muted">For every work on this face of this wall: equal gaps between them and at both ends, in the order they hang; or every centre at 60″. Arrow keys nudge the selected work an inch, Shift a foot.</p></section><section><h3>Actions</h3><div class="button-row">${btn("duplicate-art", "Duplicate", "copy")}${btn("delete-art", "Remove", "trash-2", "danger")}</div></section>` : `<div class="empty-inspector"><h2>Make room for your work.</h2><p>Uploading files an original in your library without hanging it. Tap one there to put it on a wall, then set its real dimensions here.</p>${btn("upload-art", "Upload artwork", "image-plus", "primary")}</div>`}`;
    }
    if (ctx.tab === "layout") {
      html = `<div class="panel-heading"><h2>${ctx.p.mode === "photo" ? "Booth photograph" : "Booth layout"}</h2>${icon("layout-panel-left")}</div>${ctx.p.mode === "photo" ? `<p class="muted">The original photo stays intact. Added art and light overlays are saved separately. Existing objects in the photograph cannot be moved or erased in this prototype.</p>${btn("upload-photo", ctx.p.photo.asset ? "Replace booth photo" : "Upload booth photo", "image-plus", "wide")}${range("Photo exposure", "exposure", ctx.p.photo.exposure, -1, 1, 0.05, "photo")}` : `<section><h3>Footprint</h3><select data-field="preset" aria-label="Booth preset"><option value="120" ${ctx.p.booth.width === 120 ? "selected" : ""}>10 × 10 ft · Standard</option><option value="240" ${ctx.p.booth.width === 240 ? "selected" : ""}>10 × 20 ft · Double</option></select><p class="muted">Nominal footprint. Panels and 1.4″ canopy legs reduce usable space near edges.</p>${isArtShow(ctx.p) ? `<div class="warning">This is an art-show booth. Its footprint, walls and light bar are in the <strong>Art show</strong> tool, and a preset or a canopy here would put it back to an outdoor pop-up.</div>` : ""}${field("Wall height", "height", ctx.p.booth.height, 48, 144, 1, "in", "booth")}<label class="check-field"><input type="checkbox" data-field="tent" data-scope="booth" ${ctx.p.booth.tent ? "checked" : ""}/>White canopy & frame</label><label class="setting-label">Tent style<select aria-label="Tent style" data-field="tentStyle" data-scope="booth">${Object.entries(TENTS).map(([k,v])=>`<option value="${k}" ${(ctx.p.booth.tentStyle||'classic')===k?'selected':''}>${v}</option>`).join('')}</select></label><p class="muted">12″ fabric valance, rounded hems, roof ribs and folding frame. Inspired shapes; not manufacturer-certified models.</p></section><section><h3>Surroundings</h3><label class="setting-label">Environment<select aria-label="Environment" data-field="envPreset" data-scope="booth">${Object.entries(ENV_PRESETS).map(([k,v])=>`<option value="${k}" ${(ctx.p.booth.envPreset||DEFAULT_PRESET)===k?'selected':''}>${v.label}</option>`).join('')}</select></label><p class="muted">Presets light the booth from a photographed environment. Without its image files a preset keeps the procedural surroundings below.</p>${isArtShow(ctx.p) ? `<label class="check-field"><input type="checkbox" data-field="on" data-scope="hall" ${hallSpec(ctx.p.booth).on ? "checked" : ""}/>Stand this booth in a white exhibition hall</label><p class="muted">${hallSpec(ctx.p.booth).on ? "The hall's own walls stand around the booth. In a photographed environment they cut across it as a white band, so choosing one of those presets switches the hall off." : "Off: the booth stands in the environment above, with nothing of its own around it. The walls, the light bar and the panel module are unchanged — this is only the room."}</p>` : ""}<label class="setting-label">Artwork colour<select aria-label="Artwork colour" data-field="artFidelity" data-scope="booth">${Object.entries(ART_FIDELITY).map(([k,v])=>`<option value="${k}" ${(ctx.p.booth.artFidelity||DEFAULT_FIDELITY)===k?'selected':''}>${v}</option>`).join('')}</select></label>${groundFields()}<label class="setting-label">Horizon<select aria-label="Horizon" data-field="horizon" data-scope="booth">${Object.entries({studio:'Neutral studio',open:'Open sky',park:'Park · trees',urban:'Urban plaza'}).map(([k,v])=>`<option value="${k}" ${(ctx.p.booth.horizon||'studio')===k?'selected':''}>${v}</option>`).join('')}</select></label><label class="check-field"><input type="checkbox" data-field="neighbors" data-scope="booth" ${ctx.p.booth.neighbors?'checked':''}/>Surround with other booths</label>${surroundingsFields()}</section>${viewsSection()}${tagsSection()}${peopleSection()}${underlaySection()}${clearanceSection()}<section><h3>Display walls</h3>${colorField("Fabric finish", "color", "booth", ctx.p.booth.color, "Fabric finish")}<label class="setting-label">Panel surface<select aria-label="Panel surface" data-field="wallFinish" data-scope="booth">${Object.entries({smooth:"Smooth print",fabric:"Fabric pro-panel"}).map(([k,v])=>`<option value="${k}" ${(ctx.p.booth.wallFinish||"smooth")===k?"selected":""}>${v}</option>`).join("")}</select></label>${(ctx.p.booth.wallFinish||"smooth")==="fabric"?`${range("Weave depth","wallTexture",ctx.p.booth.wallTexture??60,0,100,1,"booth","%")}<p class="muted">The weave only. Panels keep the colour above, so artwork is still judged against the finish you chose. Without the carpet texture files the panels stay smooth.</p>`:""}<div class="swatches">${["#45474a", "#25282b", "#b1aea4", "#d8d4ca"].map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Wall finish ${c}"></button>`).join("")}</div>${["back", "left", "right"].map((w) => `<div class="wall-setting"><label class="check-field"><input type="checkbox" data-field="enabled" data-scope="wall-${w}" ${ctx.p.booth.walls[w].enabled ? "checked" : ""}/>${w[0].toUpperCase() + w.slice(1)} wall</label>${field("Width", "width", ctx.p.booth.walls[w].width, 12, w === "back" ? ctx.p.booth.width : ctx.p.booth.depth, 1, "in", "wall-" + w)}${field("Height", "height", ctx.p.booth.walls[w].height, 24, 144, 1, "in", "wall-" + w)}</div>`).join("")}</section><section><h3>Free-standing walls and pedestals</h3><p class="muted">Interior panels and pedestals live in the Walls tool, so this list stays the booth itself.</p>${btn("open-walls", "Open the Walls tool", "columns-2", "wide")}</section>${rowSection()}${draftSection()}`}<section><h3>Project</h3>${btn("quick-start", "Quick start a new booth", "zap", "primary wide")}${allowed("templates") ? btn("save-template", "Save this booth as a template", "save", "wide") : ""}${btn("copy-project", "Duplicate as alternative", "copy", "wide")}${btn("new-project", "New empty booth", "plus", "wide")}${btn("backup", "Download project backup", "save", "wide")}${btn("import", "Open project backup", "folder-open", "wide")}<p class="muted">Backups include all original images. Download before switching projects.</p>${btn("workspace", `Workspace: ${ROLES[resolveRole(ctx.role)].label}`, "layers", "wide")}<label class="setting-label">Plan<select data-tier aria-label="Plan">${Object.entries(TIERS).map(([k, v]) => `<option value="${k}" ${ctx.tier === k ? "selected" : ""}>${e(v.label)}</option>`).join("")}</select></label><p class="muted">${ctx.tier === "pro" ? "Pro: every tool. Lite shows a lock on the Pro ones — switch to see what a Lite user sees." : "Lite: the Pro tools show a lock. A booth made in Pro still draws every part of itself here."} Remembered on this browser; never part of a backup.</p></section>`;
    }
    if (ctx.tab === "show") {
      html = ctx.p.mode === "photo"
        ? `<div class="panel-heading"><h2>Art show booth</h2>${icon("building-2")}</div><div class="empty-inspector"><p>Switch to the 3D booth to plan an art-show booth. Photo mode composes a photograph, which has its own walls already.</p></div>`
        : artShowHTML();
    }
    if (ctx.tab === "walls") {
      html = ctx.p.mode === "photo"
        ? `<div class="panel-heading"><h2>Walls and pedestals</h2>${icon("columns-2")}</div><div class="empty-inspector"><p>Free-standing walls and pedestals are measured objects in the 3D booth. Switch to the 3D booth to place them.</p></div>`
        : `<div class="panel-heading"><h2>Walls and pedestals</h2>${icon("columns-2")}</div><p class="muted">Everything that stands on the booth floor: interior display walls you can hang art on, and pedestals you cannot. Both are placed in inches and both can be dragged.</p>${panelFields()}${pedestalFields()}${modelsSection()}`;
    }
    if (ctx.tab === "lighting") {
      const photoMode = ctx.p.mode === "photo",
        lights = photoMode ? ctx.p.photo.lights : ctx.p.lights,
        index = photoMode ? ctx.photoLightIndex : ctx.lightIndex,
        light = lights[index];
      html = `<div class="panel-heading"><h2>${photoMode ? "Photo lighting" : "Lighting studio"}</h2>${icon("lightbulb")}</div><p class="muted">${photoMode ? "Reversible light overlays. A single photo cannot recover geometry or physically relight the booth." : "Light your real geometry. Wall gaps and panel thickness shape the cast shadows."}</p>${photoMode ? "" : looksSection()}<div class="button-row">${btn("daylight", "Daylight", "sun")}${btn("warm", "Warm", "lightbulb")}</div>${!photoMode ? `<section>${range("Ambient illumination", "ambient", ctx.p.ambient, 0, 4, 0.05)}<label class="setting-label">Spotlight fixtures<select aria-label="Spotlight fixtures" data-field="fixtures" data-scope="booth">${Object.entries(FIXTURE_MODES).map(([k, v]) => `<option value="${k}" ${(ctx.p.booth.fixtures || DEFAULT_FIXTURES) === k ? "selected" : ""}>${e(v)}</option>`).join("")}</select></label><p class="muted">${showFixtures(ctx.p.booth.fixtures, ctx.p.booth.envPreset, ctx.p.booth.venue) ? "The housings are drawn where each spotlight sits." : `Housings are hidden${isIndoor(ctx.p.booth.envPreset, ctx.p.booth.venue) ? (ctx.p.booth.venue === "artshow" ? " because an art-show booth has its own light bar overhead" : " because this is an indoor environment, where the hall's own track lighting is already in the picture") : ""}. The rail above the booth stays, and the light itself is unchanged.`}</p></section>${isArtShow(ctx.p) ? `<section><h3>Light bar</h3><label class="check-field"><input type="checkbox" data-field="on" data-scope="lightBar" ${lightBarSpec(ctx.p.booth).on ? "checked" : ""}/>Light bar across the booth</label>${lightBarSpec(ctx.p.booth).on ? `${lightBarLevels(lightBarSpec(ctx.p.booth))}<p class="muted">The nine heads over an art-show booth. Brightness and diffusion are the two to judge by eye. Brightness is a percentage of a bar judged to read right: 50 is the default, 100 is twice that and already more than anyone wanted. Diffusion opens the beams until they overlap into a wash and fills their shadows, 0 is a bare source, and past 1 the hall's own bounce takes over. The rest of the bar — how many heads, how high — is in the Art show tool.</p>` : `<p class="muted">No bar. The spotlights below still light this booth.</p>`}</section>` : ""}` : ""}${!photoMode ? shadowSection("behind") + shadowSection("under") : ""}<section><h3>${photoMode ? "Light overlays" : "Spotlights"} <span>${lights.length} / ${photoMode ? 8 : 4}</span></h3><div class="light-picker">${lights.map((l, i) => `<span class="light-chip"><button data-light="${i}" class="${index === i ? "active" : ""}">${i + 1}</button><button data-light-eye="${i}" class="eye${lightVisible(l) ? "" : " off"}" title="${lightVisible(l) ? "Hide" : "Show"} ${photoMode ? "overlay" : "spotlight"} ${i + 1}" aria-label="${lightVisible(l) ? "Hide" : "Show"} light ${i + 1}">${icon(lightVisible(l) ? "eye" : "eye-off")}</button></span>`).join("")}${lights.length < (photoMode ? 8 : 4) ? btn("add-light", "Add", "plus", "icon-only") : ""}</div>${light ? `${range("Brightness", "power", light.power, 0, photoMode ? 1 : 300, photoMode ? 0.05 : 5, photoMode ? "photoLight" : "light")}${range("Temperature", "kelvin", light.kelvin, 2700, 6500, 100, photoMode ? "photoLight" : "light", " K")}${photoMode ? `${range("Horizontal", "x", light.x, 0, 1, 0.01, "photoLight")}${range("Vertical", "y", light.y, 0, 1, 0.01, "photoLight")}${range("Radius", "radius", light.radius, 0.02, 0.8, 0.01, "photoLight")}` : `<h4>Light position · inches</h4>${field("Left / right", "x", light.x, -360, 360, 1, "in", "light")}${field("Height", "y", light.y, 0, 160, 1, "in", "light")}${field("Front / back", "z", light.z, -360, 360, 1, "in", "light")}<h4>Aim at · inches</h4>${field("Target X", "tx", light.tx, -360, 360, 1, "in", "light")}${field("Target height", "ty", light.ty, 0, 160, 1, "in", "light")}${field("Target Z", "tz", light.tz, -360, 360, 1, "in", "light")}<p class="muted">Origin: center of floor. +X right, +Z toward the entrance. Height starts at the floor.</p>`}${btn("delete-light", "Remove light", "trash-2", "wide")}` : ""}</section>`;
    }
    if (ctx.tab === "video") {
      html = ctx.p.mode === "photo"
        ? `<div class="panel-heading"><h2>Video</h2>${icon("video")}</div><div class="empty-inspector"><p>Video records a camera move through the 3D booth. Photo mode has a single photograph and no camera to move, so there is nothing to record. Switch to the 3D booth.</p></div>`
        : `<div class="panel-heading"><h2>Video</h2>${icon("video")}</div><p class="muted">Everything about moving pictures in one place: the move, the clip, the timeline and a batch list. The Export tab keeps the same controls beside the PNG and the guide, and they are the same settings — this is not a second set.</p>${gated("video", videoSection() + batchSection(), "Camera moves, keyframed timelines and batch MP4 export. Part of Booth Studio Pro.")}<section><h3>Stills</h3><p class="muted">The frame you are looking at, as a PNG, without controls or outlines. The full image options are in Export.</p>${btn("export-image", "Export PNG · 4096 px", "download", "wide")}</section>`;
    }
    if (ctx.tab === "hall") html = `<div class="panel-heading"><h2>${ctx.showFloor ? "Show floor" : "Hall planner"}</h2>${icon("map")}</div>${hallPanel()}`;
    if (ctx.tab === "export") {
      html = `<div class="panel-heading"><h2>Export your booth</h2>${icon("download")}</div><p class="muted">A clean image of the current ${ctx.p.mode === "photo" ? "photo composition" : "camera view"}, without controls or selection outlines.</p>${ctx.p.mode === "photo" ? "" : heroSection()}<section><h3>Image size</h3>${ctx.p.mode === "photo" ? "" : frameFields("export")}<label class="setting-label">Detail<select id="export-size" aria-label="Export image size">${STILL_SIZES.map((n) => `<option value="${n}" ${ctx.exportLong === n ? "selected" : ""}>${n} px on the long side${n <= 1440 ? " · Fast" : n >= 4096 ? " · High resolution" : ""}</option>`).join("")}</select></label><p class="muted">PNG · ${ctx.p.mode === "photo" ? "The photograph's own shape. Enlarging a small source cannot restore missing detail." : e(frameNote("export")) + " Preview textures are capped at 2048 px per artwork; originals remain in the backup."}</p>${btn("export-image", "Export PNG", "download", "primary wide")}</section>${ctx.p.mode === "photo" ? "" : gated("video", videoSection())}${gated("showPack", `<section><h3>Show pack</h3><p class="muted">For the van: a measured floor plan with every piece numbered and its clearances, the inventory of work with sizes, media and prices, and a packing and load-in checklist worked out from this booth. Open the downloaded HTML to print or save as PDF.</p>${btn("show-pack", "Download show pack", "layers", "wide")}</section>`)}${ctx.p.mode === "photo" ? "" : gated("power", powerSection())}${ctx.p.mode === "photo" ? "" : gated("glb", `<section><h3>3D model</h3><p class="muted">The booth as a .glb — walls, work, furniture, figures and any models you brought in, in metres — for SketchUp, Blender or an AR viewer. Surroundings, lights and the drawn shadows stay behind.</p>${btn("export-glb", "Download booth as .glb", "box", "wide")}</section>`)}${ctx.p.mode === "photo" ? "" : aiSection()}${ctx.p.mode === "photo" ? "" : gated("elevations", `<section><h3>Elevations to scale</h3><p class="muted">A floor plan and every wall with work on it, drawn at a real architectural scale with its dimension chain and centre lines — the drawing a carpenter or installer works from. Print at 100%.</p>${btn("elevations", "Download elevations", "ruler", "wide")}</section>`)}${gated("guide", `<section><h3>Installation guide</h3><p class="muted">Measured wall elevations, panel sizes, and left/bottom placement references. Open the downloaded HTML to print or save as PDF. Photo overlays are excluded.</p>${btn("guide", "Download hanging guide", "layout-panel-left", "wide")}</section>`)}<section><h3>Keep your work</h3>${btn("backup", "Download project backup", "save", "wide")}${btn("import", "Open project backup", "folder-open", "wide")}<p class="muted">Includes original artwork and photo files, booth layout, and lighting.</p><div class="keep-safe" id="keep-safe">${keepSafeHTML()}</div>${btn("studio-account", "Studio account & sync", "user-round", "wide")}<p class="muted">Signed in to your studio, your booths and their images are kept there and open on your other devices. Signed out, everything stays on this device.</p></section>${ctx.p.mode === "photo" ? "" : `<section><h3>Send to the show</h3>${btn("share-design", "Send my booth to the promoter", "send", "primary wide")}<p class="muted">Uploads this booth's design and the images on it — not the rest of your project — and gives you a link to send. The promoter opens it in Booth Studio and puts your booth on their show floor.</p>${btn("send-design", "Download it as a file instead", "download", "wide")}${sentLinksHTML()}</section>`}<section><h3>Preview quality</h3><select id="quality" aria-label="Preview quality (Export)">${qualityOptions()}</select><p class="muted">Auto starts sharp and lowers the detail while it measures this computer drawing slower than it should. The light bar's shadows are drawn live at High detail only; exports always include them. The same menu is under the viewport, beside what it is drawing at now.</p></section><section><h3>Something wrong?</h3>${btn("copy-report", "Copy a problem report", "clipboard-copy", "wide")}<p class="muted">Copies a short report to paste into a message: this build, your browser and screen, the project in counts (no names, titles or images) and the last errors on this page. Nothing is sent anywhere.</p></section>`;
    }
    return html;
  }
  // The two lines under the viewport. Split out of render() because a
  // selection changes both of them and nothing else on the page.
  function renderStatus() {
    document.querySelector("#gesture-hint").textContent = ctx.show3d
      ? ctx.walking
        ? "Walking the show: WASD or arrows step · Shift strides · drag to look round · Esc stops"
        : ctx.panTool
        ? ctx.PAN_HINT
        : "Drag to orbit · scroll to zoom · right-drag to pan · W walks the show · Esc back to the plan"
      : ctx.showFloor
      ? ctx.panTool
        ? ctx.PAN_HINT
        : `Drag a piece to move it · drag or right-drag to box-select · ${ctx.PAN_KEY} right-drag to pan · Space-drag pans too · scroll to zoom`
      :
      ctx.scene?.drawingBox && ctx.p.mode !== "photo"
        ? "Box: press on the floor and drag out its footprint · Esc to stop"
        : ctx.walking && ctx.p.mode !== "photo"
        ? "Walk: W/S or ↑/↓ forward and back · A/D or ←/→ sideways · Shift strides · drag to look round · Esc to stop"
        : ctx.scene?.measure.on && ctx.p.mode !== "photo"
        ? ctx.measureHint
        : ctx.panTool && ctx.p.mode !== "photo"
        ? ctx.PAN_HINT
        : ctx.p.mode === "photo"
        ? "Drag artwork to move · drag corners for perspective"
        : ctx.scene?.move
          ? ctx.scene.snap
            ? "Drag artwork along its wall · snap in 1-inch increments"
            : "Drag artwork along its wall · snapping off"
          : ctx.DEFAULT_HINT;
    const selectedArt = ctx.p.art.find((a) => a.id === ctx.selected);
    document.querySelector("#selection-status").textContent =
      ctx.p.mode === "3d"
        ? ctx.picked.length > 1
          ? `${ctx.picked.length} works selected · arrows move them together`
          : selectedArt
          ? selectedArt.title + (ctx.scene?.scaleId === ctx.selected ? " · Drag to move · blue corners scale" : " · Double-tap to adjust")
          : "No selection"
        : "";
  }
  function render() {
    if (ctx.showFloor && !ctx.p.hall) ctx.showFloor = false;
    if (ctx.show3d && (!ctx.showFloor || !ctx.scene)) {
      ctx.show3d = false;
      [ctx.videoTimeline, ctx.otherTimeline] = [ctx.otherTimeline, ctx.videoTimeline];
    }
    const flat = ctx.showFloor && !ctx.show3d;
    document.querySelector("#project-name").value = ctx.p.name;
    document.body.classList.toggle("show-floor-on", ctx.showFloor);
    document.body.classList.toggle("show-3d-on", ctx.show3d);
    document.querySelector("#show-floor").hidden = !flat;
    document.querySelector("#scene").hidden = ctx.p.mode !== "3d" || flat;
    document.querySelector("#photo").hidden = ctx.p.mode !== "photo" || ctx.showFloor;
    document.querySelector("#photo-empty").hidden =
      ctx.p.mode !== "photo" || !!ctx.p.photo.asset || ctx.showFloor;
    document.querySelector("#view-switch").hidden = ctx.p.mode === "photo" || flat;
    document.querySelector(".zoom-controls").hidden = ctx.p.mode === "photo";
    document.querySelector("#mode-label").textContent =
      ctx.p.mode === "photo" ? "PHOTO COMPOSITION" : "MEASURED WORKSPACE";
    document.querySelector("#scene-title").textContent =
      ctx.p.mode === "photo"
        ? "Your booth, reimagined"
        : `${ctx.p.booth.width / 12} × ${ctx.p.booth.depth / 12} ft / ${ctx.p.booth.tent ? "Canopy" : "Open booth"}${liveNumber(ctx.p.hall) !== undefined ? ` · Booth ${liveNumber(ctx.p.hall)}` : ""}`;
    document.querySelector("#scene-subtitle").textContent =
      ctx.p.mode === "photo"
        ? "Original photo + editable overlays"
        : `${ctx.p.art.length} panels · ${ctx.p.lights.length} spotlights`;
    renderStatus();
    document
      .querySelector('[data-action="mode-3d"]')
      .classList.toggle("active", ctx.p.mode === "3d" && !ctx.showFloor);
    document
      .querySelector('[data-action="mode-photo"]')
      .classList.toggle("active", ctx.p.mode === "photo" && !ctx.showFloor);
    document.querySelector('[data-action="mode-show"]').classList.toggle("active", ctx.showFloor);
    if (ctx.showFloor) {
      if (ctx.walking && !ctx.show3d) setWalking(false);
      document.querySelector("#mode-label").textContent = ctx.show3d ? "SHOW FLOOR · 3D" : "SHOW FLOOR";
      const f = floorOf(ctx.p.hall);
      document.querySelector("#scene-title").textContent = `${feet(f.width)} × ${feet(f.depth)} · ${SHOW_VENUES[f.kind]}`;
      document.querySelector("#scene-subtitle").textContent = `${showItems(ctx.p.hall).filter((i) => i.kind === "booth").length} booths · ${showItems(ctx.p.hall).length} pieces`;
      ctx.showEditor ||= createShowEditor(document.querySelector("#show-floor"), {
        hall: () => ctx.p.hall,
        edit: (fn) => mutate(() => fn(toFloor(ctx.p.hall))),
        onSelect: showSelected,
        grid: () => ctx.showGrid,
        panTool: () => ctx.panTool,
      });
      if (!ctx.show3d) ctx.showEditor.render();
    }
    document.querySelector('[data-action="undo"]').disabled = !ctx.history.length;
    document.querySelector('[data-action="redo"]').disabled = !ctx.future.length;
    if (ctx.p.mode !== "3d" && ctx.walking) setWalking(false);
    for (const name of ["move", "select", "snap", "walk"])
      document.querySelector(`[data-action="${name}"]`).disabled =
        ctx.p.mode === "photo" || !ctx.scene || ctx.showFloor;
    if (ctx.showFloor) ctx.tab = "hall";
    renderLibrary();
    renderInspector();
    // The booth's scene is hidden behind the show floor; an edit to the floor
    // is not an edit to it, and rebuilding it for one would be the whole cost
    // of every drag.
    if (!ctx.showFloor || ctx.show3d) refreshScene();
    syncTools();
    syncSavedViews();
    // On the next frame rather than now: reading the viewport's size straight
    // after the panels were rewritten forced the browser to lay the whole page
    // out in the middle of the edit, which was the largest single cost of a
    // click after the rebuild itself. A size that really changed is also
    // caught by the scene's ResizeObserver.
    if (ctx.scene && !render.resizing) {
      render.resizing = true;
      requestAnimationFrame(() => {
        render.resizing = false;
        ctx.scene.resize();
      });
    }
  }
  return { render, renderStatus, inspectorHTML, renderInspector, showSection };
}
