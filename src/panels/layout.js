// The Layout tab's builders: the ground, the booth row, the surroundings
// and backdrop, the figures for scale, drawing speed, saved views, tags,
// the floor plan underlay and the clearance checks. What the controls do
// stays in main.js with the action table, which moves later. Moved out of
// src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam 10): `ctx` is
// boot's state, read through it, and the helpers this calls.
import { resolvePreset } from "../lighting.js";
import { PEOPLE, MAX_PEOPLE, MIN_HEIGHT, MAX_HEIGHT, MAX_LIFT, MIN_LIFT, LIFT_STEP, personName } from "../people.js";
import { MAX_GAP, MAX_SLOTS, MIN_SPACE, MAX_SPACE, boothSlots, hasRow, normalizeRow, rowLayout, slotLabel } from "../row.js";
import { escapeHTML as e, GROUND_KINDS, GROUND_UPLOAD, groundKind, groundLibrary, groundUpload, isShown, panelRange } from "../model.js";
import { BACKDROP_FRAMING } from "../scene.js";
import { distanceInches, formatLength } from "../measure.js";
import { MAX_VIEWS, TAGS } from "../views.js";
import { ACCESSIBLE, checkClearance } from "../clearance.js";

export function createLayoutPanel(ctx) {
  const { activeSlot, allowed, btn, field, gated, hideEye, proLock, range } = ctx;
  // One picker, two labelled groups. Selecting anything from either group
  // switches the floor, because a shipped kind and an uploaded photograph are
  // now the same kind of choice — there is nothing to remove first.
  function groundFields() {
    const labels = { studio: "Studio floor", grass: "Grass", concrete: "Concrete", asphalt: "Asphalt", carpet: "Carpet", wood: "Wood floor" };
    const upload = groundUpload(ctx.p), library = groundLibrary(ctx.p);
    const current = upload ? GROUND_UPLOAD + upload : groundKind(ctx.p);
    const option = (value, label) => `<option value="${e(value)}" ${current === value ? "selected" : ""}>${e(label)}</option>`;
    return `<label class="setting-label">Ground<select aria-label="Ground" data-field="ground" data-scope="booth"><optgroup label="Preset grounds">${GROUND_KINDS.map((k) => option(k, labels[k])).join("")}</optgroup>${library.length ? `<optgroup label="Your photographs">${library.map((g) => option(GROUND_UPLOAD + g.id, g.name.replace(/\.[^.]+$/, ""))).join("")}</optgroup>` : ""}</select></label>
      ${upload ? `${field("Ground tile size","groundTile",ctx.p.booth.groundTile||48,12,240,1,"in","booth")}${btn("remove-ground-upload","Delete this ground photograph",null,"wide")}` : ""}
      ${btn("upload-ground","Add ground photograph","image-plus","wide")}
      <p class="muted">Presets are the shipped surfaces; your own photographs join the list beneath them. A ground photograph should be top-down and ideally seamless. It stays on this device and enters backups. Deleting one returns the floor to the last preset.</p>`;
  }
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
    const row = normalizeRow(ctx.p.booth);
    const slots = rowLayout(ctx.p.booth);
    const booths = boothSlots(ctx.p.booth);
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
          ? ctx.p.art.filter((a) => (a.booth || row.home) === slot.id).length
          : 0;
        return `<div class="row-slot ${slot.home ? "home" : ""}"><span>${i + 1}. ${e(label)}${slot.kind === "booth" ? ` <small>${works} hung</small>` : ""}</span>${slot.kind === "space" ? field("Width", "width", slot.width, MIN_SPACE, MAX_SPACE, 1, "in", "space-" + slot.id) : ""}${slot.home ? '<small class="muted">yours</small>' : btn("row-remove-" + slot.id, "Remove", "trash-2", "icon-only")}</div>`;
      }).join("")}</div>
      ${full ? `<p class="muted">A row holds ${MAX_SLOTS} slots. Remove one to add another.</p>` : ""}
      ${hasRow(ctx.p.booth) ? '<p class="muted">Removing a booth removes the artwork hung in it. The booths either side of yours in Surroundings are left out while a row is drawn, so the aisle is only the one you laid out.</p>' : ""}</section>`;
  }
  function surroundingsFields() {
    const b=ctx.p.booth;
    return `${b.neighbors ? `<label class="setting-label">Booth position<select aria-label="Booth position" data-field="neighborLayout" data-scope="booth">${Object.entries({inline:"Inline · both sides","corner-left":"Left corner · left side open","corner-right":"Right corner · right side open",island:"Island · no adjoining booths"}).map(([k,v])=>`<option value="${k}" ${(b.neighborLayout||"inline")===k?"selected":""}>${v}</option>`).join("")}</select></label>${field("Side spacing","neighborGap",b.neighborGap ?? 24,0,240,1,"in","booth")}${(b.neighborLayout||"inline") !== "island" ? `<label class="check-field"><input type="checkbox" data-field="neighborRear" data-scope="booth" ${b.neighborRear?"checked":""}/>Booth behind</label>${b.neighborRear ? field("Rear spacing","rearGap",b.rearGap ?? 24,0,240,1,"in","booth") : ""}` : ""}<p class="muted">Gaps are between nominal footprint edges. Left/right are viewed from the entrance. Tent overhangs and artwork can extend into the gap.</p>` : ""}
      <h4>Photographic materials</h4>
      ${btn("upload-surround",b.surroundAsset?"Replace panorama":"Upload 360° panorama","image-plus","wide")}
      ${b.surroundAsset || resolvePreset(b.envPreset).hdri ? `<h3>Backdrop</h3><div class="backdrop-zoom"><span>Zoom</span>${btn("backdrop-out","Zoom backdrop out","minus","icon-only")}${btn("backdrop-in","Zoom backdrop in","plus","icon-only")}${btn("backdrop-reset","Reset backdrop","rotate-ccw","icon-only")}</div>${range("Backdrop zoom","backdropFraming",b.backdropFraming ?? BACKDROP_FRAMING,25,100,1,"booth","%")}${field("Pan · horizontal","surroundRotation",b.surroundRotation||0,-180,180,1,"°","booth")}${field("Tilt · vertical","backdropTilt",b.backdropTilt||0,-45,45,1,"°","booth")}<label class="check-field"><input type="checkbox" data-field="backdropLock" data-scope="booth" ${(b.backdropLock ?? true) ? "checked" : ""}/>Lock backdrop to the horizon</label><p class="muted">On, the photographed horizon stays fixed against the floor as you orbit up and down. Off, the backdrop moves with its own wider lens, so the horizon drifts against the booth as the camera pitches.</p><p class="muted">A spherical backdrop sits at infinity, so only the lens frames it — orbiting cannot pull it back. Lower zoom draws it through a wider lens, which pushes the surroundings away and makes them sharper, while the booth keeps its own perspective. 100% matches the camera. Pan swings it sideways; tilt aims it up or down.</p>` : ""}
      ${b.surroundAsset ? btn("clear-surround","Remove panorama",null,"wide") : ""}
      <p class="muted">Panorama: 2:1 full-sphere JPG/PNG, not an ordinary flat photo. Your own panorama replaces the environment preset's backdrop; rotation turns whichever of the two is showing, and has nothing to turn while a preset's image files are missing. Ground photographs are chosen with the Ground picker above. Images stay on this device and enter backups/exports. Scenery is a backdrop, not reconstructed 3D.</p>`;
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
      : Math.max(panelRange(ctx.p)[key] + 48, Math.abs(person[key] || 0));
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
    return `<section><h3>Drawing speed</h3><label class="check-field"><input type="checkbox" data-draft ${ctx.scene?.draft ? "checked" : ""}/>Fast edit</label><label class="setting-label">Fast edit lock<select aria-label="Fast edit lock" data-draft-policy><option value="auto">Auto · follows the gesture</option><option value="on">Always on</option><option value="off">Always off</option></select></label><p class="muted">Auto turns fast edit on when you arm a work and off again when you click away from it. The lock beside the toolbar button is the same three settings, and holds it wherever you put it.</p><p class="muted">Drops the shadow passes and the supersampling while you arrange, and comes on by itself when you double-tap artwork. Exports are never affected: full quality goes back before a PNG or a video draws a single frame.</p></section>`;
  }
  /**
   * Layout → Saved views: SketchUp's Scenes. Each is a named camera, one
   * click to come back to; all of them export as PNGs in one go. Saved with
   * the booth, in `p.views`.
   */
  function viewsSection() {
    const views = ctx.p.views || [];
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
      .map(([k, label]) => `<label class="check-field"><input type="checkbox" data-tag="${k}" ${ctx.hiddenTags.has(k) ? "" : "checked"}/>${e(label)}</label>`)
      .join("")}</div></section>`;
  }
  /**
   * Layout → Floor plan underlay (Pro): the venue's plan, as an image, laid
   * on the floor at its real width so the booth can be placed on it. Scaled
   * by measuring a known distance on it with the tape and typing what it
   * really is — two clicks and a number.
   */
  function underlaySection() {
    const u = ctx.p.booth.underlay;
    const tape = ctx.scene?.measure.points.length === 2 ? distanceInches(...ctx.scene.measure.points, 0.0254) : null;
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
    const issues = checkClearance(ctx.p);
    const rows = issues
      .map((x, i) => `<li class="clearance-${x.level}"><span>${e(x.text)}</span>${x.ids.some((id) => id.startsWith("pedestal:") || id.startsWith("panel:") || id.startsWith("art:")) ? btn("clearance-show-" + i, "Show", "camera", "compact") : ""}</li>`)
      .join("");
    return gated("clearance", `<section><h3>Clearance checks <span>${issues.length ? issues.length + " to look at" : "all clear"}</span></h3><p class="muted">Floor pieces standing in each other or outside the booth, works hung over each other, and gaps narrower than the ${ACCESSIBLE}″ a wheelchair needs. Plan view draws the tight gaps in red. Pieces pushed right up against something are taken as meant.</p>${issues.length ? `<ul class="clearance-list">${rows}</ul>` : `<p class="ok-note">Nothing is in the way.</p>`}</section>`, "Warnings for pieces standing in each other or outside the booth, and gaps too narrow for a wheelchair. Part of Booth Studio Pro.");
  }
  function peopleSection() {
    const people = ctx.p.booth.people || [];
    // Absent means shown: that is what every backup written before the switch
    // existed says, and it is what they all meant.
    const shown = ctx.p.booth.showPeople !== false;
    const rows = people
      .map((person, i) => {
        const label = personName(person.kind);
        const chosen = ctx.selectedPerson === person.id;
        return `<div class="person-row${isShown(person) ? "" : " is-hidden"}${chosen ? " selected" : ""}" data-person="${person.id}"><div class="key-head"><strong>${label} ${i + 1}${chosen ? ' <span class="badge">Selected</span>' : ""}${isShown(person) ? "" : ' <span class="badge">Hidden</span>'}</strong><span class="piece-actions"><span class="muted">${Math.floor(person.height / 12)}′${Math.round(person.height % 12)}″</span>${hideEye("person", person.id, `${label} ${i + 1}`, isShown(person))}</span></div>${field("Height", "height", person.height, MIN_HEIGHT, MAX_HEIGHT, 1, "in", "person-" + person.id)}${personSlider(person, "height", "Height")}<div class="field-pair">${field("Left / right", "x", person.x, -600, 600, 1, "in", "person-" + person.id)}${field("Front / back", "z", person.z, -600, 600, 1, "in", "person-" + person.id)}</div>${personSlider(person, "x", "Left / right")}${personSlider(person, "z", "Front / back")}${field("Raised off the floor", "lift", person.lift ?? 0, MIN_LIFT, MAX_LIFT, LIFT_STEP, "in", "person-" + person.id)}${personSlider(person, "lift", "Raise / lower")}${field("Facing", "rotation", person.rotation ?? 0, -180, 180, 5, "°", "person-" + person.id)}<div class="button-row">${btn("flip-person", "Flip", "flip-horizontal-2")}${btn("delete-person", "Remove", "trash-2")}</div></div>`;
      })
      .join("");
    return `<section><h3>People for scale <span>${people.length} / ${MAX_PEOPLE}</span></h3><p class="muted">Stand-ins so the booth reads at human size. ${Object.values(PEOPLE).map((v) => e(v.label)).join(" · ")} by default, and every figure's height is editable. They are excluded from the hanging guide.</p>${people.length ? `<label class="check-field"><input type="checkbox" data-field="showPeople" data-scope="booth" ${shown ? "checked" : ""}/>Show the figures</label><p class="muted">${shown ? "Off takes every figure out of the picture and out of an export, and keeps where each one stands." : `Hidden. ${people.length} figure${people.length === 1 ? " is" : "s are"} still placed below and come back when this is switched on.`}</p>` : ""}${people.length < MAX_PEOPLE ? `<div class="button-row people-add">${btn("add-woman", "Add woman", "user-round")}${btn("add-man", "Add man", "user-round")}${btn("add-child", "Add child", "user-round")}${btn("add-pair", "Add pair", "user-round")}${btn("add-wheelchair", "Add wheelchair user", "user-round")}</div>` : `<p class="muted">${MAX_PEOPLE} figures is the limit.</p>`}${rows}</section>`;
  }
  return { groundFields, rowSection, surroundingsFields, draftSection, viewsSection, tagsSection, underlaySection, clearanceSection, peopleSection };
}
