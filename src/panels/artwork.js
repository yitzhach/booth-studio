// The Artwork tab's builders: the library of originals and their
// thumbnails, the selected work's sign or label fields, its wall location
// and position sliders, its edge colour, and the bar shown when several
// works are selected. The image editor is src/ui/image-editor.js; what the
// controls do stays in main.js with the action table, which moves later.
// Moved out of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md, seam
// 10): `ctx` is boot's state, read through it, and the helpers this calls.
import { DEFAULT_EDGE_COLOR, escapeHTML as e, findPanel, wallKeys, wallLabel, wallSpec } from "../model.js";
import { sameWall } from "../arrange.js";
import { ALIGN_MODES } from "../align.js";

export function createArtworkPanel(ctx) {
  const { btn, colorField, gated, libraryItems, pickedWorks } = ctx;
  function multiSection() {
    if (ctx.picked.length < 2) return "";
    const works = pickedWorks();
    const primary = ctx.p.art.find((a) => a.id === ctx.selected);
    const onWall = primary ? sameWall(works, primary).length : 0;
    return `<section class="multi-select"><h3>${works.length} works selected</h3><p class="muted">${onWall === works.length ? "All on one wall." : `${onWall} on this work's wall; the others are on other walls and stay put when these are aligned.`} Arrow keys move them together. Shift-click a work to add or remove it.</p>${gated("align", `<div class="button-row align-row">${Object.entries(ALIGN_MODES).map(([k, label]) => btn("align-" + k, label, null, "compact")).join("")}</div><div class="button-row">${btn("distribute-x", "Distribute across", "align-horizontal-distribute-center")}${btn("distribute-y", "Distribute up", "align-start-vertical")}</div>`, "Line several works up on an edge or a centre, or give them equal gaps, in one press. Part of Booth Studio Pro.")}<div class="button-row">${btn("clear-multi", "Clear selection", "x")}</div></section>`;
  }
  // Every face a placement can hang on: the three perimeter walls inside and
  // out, then each free-standing panel front and back. The value keeps the
  // existing "<wall>-<face>" shape, and a panel key carries its own colon, so
  // the split is limited to the last dash.
  function locationOptions(a) {
    const rows = [];
    for (const face of ["inside", "outside"])
      for (const key of wallKeys(ctx.p)) {
        const panel = findPanel(ctx.p, key);
        const label = panel
          ? `${wallLabel(ctx.p, key)} · ${face === "outside" ? "Back" : "Front"}`
          : `${wallLabel(ctx.p, key).replace(" wall", "")} · ${face === "outside" ? "Exterior" : "Interior"}`;
        rows.push(
          `<option value="${e(key)}-${face}" ${a.wall === key && (a.face || "inside") === face ? "selected" : ""}>${e(label)}</option>`,
        );
      }
    return rows.join("");
  }
  // A slider beside the typed edge, for the two placements a work has on its
  // wall. The travel is the wall it hangs on, less the work's own size, so
  // the far end of the slider is the work flush with the far edge rather than
  // a number the constraint will refuse.
  function artSlider(a, key, label) {
    const spec = wallSpec(ctx.p, a.wall);
    const span = key === "x" ? (spec?.width ?? 120) - a.w : (spec?.height ?? 96) - a.h;
    const max = Math.max(Math.ceil(span), Math.ceil(a[key]), 1);
    return `<label class="range"><span>${label}<output>${Number(a[key].toFixed(2))}in</output></span><input type="range" data-field="${key}" data-scope="art-position" aria-label="${e(label)} slider" min="0" max="${max}" step="0.25" value="${a[key]}"/></label>`;
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
    const universal = !!ctx.p.booth.edgeUniversal;
    return `<label class="check-field"><input type="checkbox" data-field="edgeUniversal" data-scope="booth" ${universal ? "checked" : ""}/>Universal edge colour for every work</label>${
      universal
        ? `${colorField("Edge colour · whole booth", "edgeColor", "booth", ctx.p.booth.edgeColor || DEFAULT_EDGE_COLOR, "Universal edge colour")}<p class="muted">Every work in the booth is painted this, whatever it carries of its own. This one keeps ${e(a.edgeColor || DEFAULT_EDGE_COLOR)} and goes back to it when the switch comes off.</p>${btn("edges-to-all", "Paint every work this colour", null, "wide")}<p class="muted">That writes the colour into each work, so it survives the switch coming off. Undo puts them back.</p>`
        : `${colorField("Edge colour", "edgeColor", "art", a.edgeColor || DEFAULT_EDGE_COLOR, "Edge colour")}<p class="muted">This work's own edges. The colour, the edge material and the thickness you set here are what the next original you hang starts with.</p>`
    }`;
  }
  function artThumb(a) {
    if (a.kind === "sign" || a.kind === "label")
      return `<div class="sign-thumb"><strong>${e(a.kind === "sign" ? a.artistName || "Artist name" : a.title)}</strong><span>${e(a.kind === "sign" ? a.city || "City, State" : a.medium || "")}</span></div>`;
    const asset = ctx.p.assets[a.asset];
    // The thumbnail, not the original. This markup is rebuilt on every click
    // — a selection redraws the library and the inspector — and pointing a
    // dozen of these at a dozen 20-megapixel originals is what made a booth
    // full of uploads feel heavy. An asset saved before thumbnails existed
    // still shows its original until the backfill reaches it.
    return asset
      ? `<img src="${asset.thumb || asset.data}" alt="${e(a.title)}" loading="lazy" decoding="async"/>`
      : `<div class="sample-thumb sample-${ctx.p.art.indexOf(a) % 6}"><span>${a.w} × ${a.h}</span></div>`;
  }
  function libraryHTML(mobile = false) {
    const items = libraryItems();
    const active = ctx.p.art.find((item) => item.id === ctx.selected);
    return `<div class="panel-heading"><h2>Original panels <small>${items.length}</small></h2>${btn("upload-art", "Add original", "plus", "icon-only")}</div>${!mobile ? '<label class="search"><span>⌕</span><input id="search" placeholder="Find an original…" aria-label="Find an original" value="' + e(ctx.search) + '"/></label>' : ""}<div class="library-caption">REUSABLE ORIGINALS <span>${ctx.p.art.length} placed</span></div><div class="art-list">${
      items
        .filter((item) => mobile || item.title.toLowerCase().includes(ctx.search.toLowerCase()))
        .map((item) => {
          const copies = item.asset
            ? ctx.p.art.filter((placed) => placed.asset === item.asset).length
            : ctx.p.art.filter((placed) => placed.id === item.id).length;
          const activeSource = item.asset
            ? active?.asset === item.asset
            : active?.id === item.id;
          return `<button class="art-card ${activeSource ? "selected" : ""} ${item.asset && !copies ? "unplaced" : ""}" draggable="${ctx.p.mode === "3d"}" data-source="${e(item.sourceKey)}" title="Tap to hang this on a wall${ctx.p.mode === "3d" ? ", or drag it onto the wall you want" : ""}"><div class="thumb">${artThumb(item)}</div><div><strong>${e(item.title)}</strong><span>${item.w} × ${item.h} × ${item.thickness} in</span><small>${item.asset ? (copies ? copies + " on the walls" : "Tap to hang it") : "Reusable sample panel"}</small></div></button>`;
        })
        .join("") || '<p class="muted">Upload JPG or PNG artwork to begin.</p>'
    }</div><p class="library-drag-note">Tap an original to hang it on a wall — uploading only files it here. On a mouse you can also drag one onto the interior or exterior wall you want. Each one creates a new placement; the original stays here.</p>${ctx.p.mode === "3d" ? `<div class="asset-tools"><h3>Booth assets</h3><div class="button-row">${btn("add-sign", "Artist sign", "plus")}${btn("add-label", "Artwork label", "plus")}</div></div>` : ""}<div class="library-bottom">${btn("upload-art", "Upload originals", "image-plus", "wide")}${ctx.p.art.some((item) => !item.asset && !item.kind) ? btn("clear-samples", "Remove sample panels", null, "wide text-button") : ""}<p>Original files stay intact.<br>Saved only on this browser/device.</p></div>`;
  }
  function signFields(a) {
    const input = (label, key, value) => `<label class="setting-label">${label}<input type="text" data-field="${key}" data-scope="art" aria-label="${label}" maxlength="200" value="${e(value || "")}"/></label>`;
    if (a.kind === "sign") return `<section><h3>Artist sign</h3>${input("Artist name","artistName",a.artistName)}${input("City / State","city",a.city)}${input("Medium","medium",a.medium)}</section>`;
    if (a.kind === "label") return `<section><h3>Artwork label</h3><p class="muted">Use Artwork title above for the first line.</p>${input("Medium","medium",a.medium)}${input("Price / detail","price",a.price)}</section>`;
    // A work's own medium and price, for the show pack's inventory. Typed as
    // text — "$450", "NFS", "£80 framed" — and totalled where it is a number.
    return `<section><h3>For the show pack</h3>${input("Medium","medium",a.medium)}${input("Price","price",a.price)}<p class="muted">Listed in Export → Show pack with the size and wall. Prices that are numbers are totalled.</p></section>`;
  }
  return { multiSection, locationOptions, artSlider, edgeColorFields, artThumb, libraryHTML, signFields };
}
