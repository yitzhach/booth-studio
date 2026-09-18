import { editedAspect, validImageEdits } from "./image-edit.js";
export const IN = 0.0254;
export const uid = () => globalThis.crypto.randomUUID();
export function blankProject() {
  return {
    schema: 1,
    units: "inches",
    id: uid(),
    name: "Spring booth",
    mode: "3d",
    booth: {
      width: 120,
      depth: 120,
      height: 96,
      tent: false,
      tentStyle: "classic",
      // Which kind of show this booth is for. "outdoor" is the pop-up canopy
      // this app has always drawn; "artshow" is an indoor convention booth:
      // seamless white pro-panel walls, a light bar instead of a canopy, and
      // an exhibition hall around it. Optional, so a schema-1 backup written
      // before it existed loads as the outdoor booth it was.
      venue: "outdoor",
      ground: "studio",
      horizon: "studio",
      neighbors: false,
      neighborLayout: "inline",
      neighborGap: 24,
      neighborRear: false,
      rearGap: 24,
      color: "#45474a",
      // Panel finish. "smooth" is the printed vinyl this has always drawn;
      // "fabric" puts a woven relief over the same colour, the way a fabric
      // pro-panel wall looks. wallTexture is how far up that relief is turned.
      wallFinish: "smooth",
      wallTexture: 60,
      // How wide a lens the spherical backdrop is drawn through, as a
      // percentage of the camera's own. 100 matches the camera; lower pulls the
      // environment back and reduces the magnification a 1K panorama suffers.
      // See BACKDROP_FRAMING in scene.js.
      backdropFraming: 65,
      // Vertical aim of the spherical backdrop, in degrees. Pan is
      // surroundRotation; this is the other axis of the same tripod head.
      // Positive lifts the horizon into frame. Optional, so a schema-1 backup
      // written before it existed still loads.
      backdropTilt: 0,
      // Keeps the photographed horizon fixed against the floor when the camera
      // pitches; see lockedPitch in scene.js.
      backdropLock: true,
      walls: {
        back: { enabled: true, width: 120, height: 96 },
        left: { enabled: true, width: 120, height: 96 },
        right: { enabled: true, width: 120, height: 96 },
      },
      // Free-standing interior walls. A separate optional list rather than
      // more keys in `walls`, because `walls` is a fixed record that six
      // places assume the shape of, and because a schema-1 backup written
      // before panels existed has no key here at all and must still load.
      // x/z are inches from the booth centre (+x right, +z toward the
      // entrance), rotation is degrees about the vertical axis.
      panels: [],
      // The modular panel an art-show wall is built from. The walls keep
      // their own authoritative width and height; this is the module they
      // can be rebuilt from, and `linked` is what says they should be.
      artShow: { ...ART_SHOW_PANEL },
      // A light bar across the booth with directional heads spotting each
      // wall. Derived scenery, not spotlights in `p.lights`: nine fixtures
      // would fill that list four times over, and their aim is a consequence
      // of the booth's own measurements rather than something to type.
      lightBar: { ...LIGHT_BAR },
      // The white exhibition hall an indoor booth stands in.
      hall: { ...HALL },
      // Free-standing pedestals: a plinth with a solid top for cards, a
      // tablet or a guest book. Placed and dragged the way a free-standing
      // wall is, and like `panels` absent from every older backup.
      pedestals: [],
    },
    art: [],
    assets: {},
    ambient: 1.25,
    lights: [
      {
        id: uid(),
        x: -28,
        y: 91,
        z: 24,
        tx: -28,
        ty: 56,
        tz: -59,
        power: 75,
        kelvin: 4000,
      },
      {
        id: uid(),
        x: 28,
        y: 91,
        z: 24,
        tx: 28,
        ty: 56,
        tz: -59,
        power: 75,
        kelvin: 4000,
      },
    ],
    photo: { asset: null, layers: [], lights: [], exposure: 0 },
    editClipboard: null,
  };
}
export function demoProject() {
  const p = blankProject();
  [
    ["back", 12, 32, 36, 48],
    ["back", 60, 44, 36, 36],
    ["left", 23, 32, 36, 48],
    ["left", 73, 44, 24, 36],
    ["right", 20, 32, 48, 48],
    ["right", 80, 44, 24, 36],
  ].forEach(([wall, x, y, w, h], i) =>
    p.art.push({
      id: uid(),
      asset: null,
      title: `Sample panel ${String(i + 1).padStart(2, "0")}`,
      wall,
      x,
      y,
      w,
      h,
      thickness: 1.5,
      offset: 0.75,
    }),
  );
  return p;
}
/**
 * The art-show booth, as asked for and as measured: a 144″ wide back wall and
 * 120″ side walls, all 144″ tall, in white, with no seams. These are the
 * defaults the venue switch writes; every one of them stays editable
 * afterwards, which is what "custom booth dimensions" means here.
 */
export const ART_SHOW = {
  width: 144,
  depth: 120,
  height: 144,
  backWidth: 144,
  sideWidth: 120,
  wallHeight: 144,
  color: "#f4f3f0",
};
/** The outdoor pop-up this app has always opened with. */
export const OUTDOOR = {
  width: 120,
  depth: 120,
  height: 96,
  backWidth: 120,
  sideWidth: 120,
  wallHeight: 96,
  color: "#45474a",
};
/** The individual display panel an art-show wall is built from. */
export const ART_SHOW_PANEL = { width: 38, height: 144, linked: false };
export const LIGHT_BAR = {
  on: true,
  height: 132,
  count: 9,
  power: 60,
  kelvin: 3500,
};
// 30 foot ceilings, as asked. The ceiling itself is off by default: it is
// almost always out of frame, and drawing it puts a grey wash over the booth.
export const HALL = { on: false, ceiling: 360, showCeiling: false };
export const VENUES = { outdoor: "Outdoor · pop-up canopy", artshow: "Art show · indoor booth" };
/** Accepts a project or a booth: the scene has one, the environment the other. */
export const isArtShow = (p) => ((p?.booth || p)?.venue || "outdoor") === "artshow";
/** Defaults filled in, so a backup written before these existed reads whole. */
export const artShowPanel = (b) => ({ ...ART_SHOW_PANEL, ...(b.artShow || {}) });
export const lightBarSpec = (b) => ({ ...LIGHT_BAR, ...(b.lightBar || {}) });
export const hallSpec = (b) => ({ ...HALL, ...(b.hall || {}) });
/**
 * Switch a booth between the two venues. Everything it writes is a default a
 * user can then change; what it must not do is leave a booth in a state its
 * own venue cannot describe — an art show with a canopy over it, or an
 * outdoor pop-up with 12ft walls it never asked for.
 */
export function applyVenue(p, venue) {
  const spec = venue === "artshow" ? ART_SHOW : OUTDOOR;
  const b = p.booth;
  b.venue = venue === "artshow" ? "artshow" : "outdoor";
  b.width = spec.width;
  b.depth = spec.depth;
  b.height = spec.height;
  b.color = spec.color;
  b.walls.back = { ...b.walls.back, width: spec.backWidth, height: spec.wallHeight };
  b.walls.left = { ...b.walls.left, width: spec.sideWidth, height: spec.wallHeight };
  b.walls.right = { ...b.walls.right, width: spec.sideWidth, height: spec.wallHeight };
  if (venue === "artshow") {
    // A hall has a roof of its own; a canopy indoors is a contradiction.
    b.tent = false;
    b.ground = "studio";
    b.horizon = "studio";
    b.wallFinish = "smooth";
    b.artShow = { ...artShowPanel(b), height: spec.wallHeight };
    b.lightBar = { ...lightBarSpec(b), on: true };
    b.hall = { ...hallSpec(b), on: true };
  } else {
    b.hall = { ...hallSpec(b), on: false };
    b.lightBar = { ...lightBarSpec(b), on: false };
  }
  // Art already hanging is measured against walls that just changed size.
  p.art = p.art.map((a) => constrain(p, a));
  p.booth.panels = boothPanels(p).map((panel) => constrainPanel(p, panel));
  p.booth.pedestals = boothPedestals(p).map((ped) => constrainPedestal(p, ped));
  return p;
}
/**
 * How many whole panels of the current module a wall is, and what it would
 * measure if it were built from them. Nothing is rewritten here: the readout
 * is what makes the module mean something on a wall whose width is its own.
 */
export function panelCount(p, key) {
  const spec = wallSpec(p, key), module = artShowPanel(p.booth);
  if (!spec || !(module.width > 0)) return 0;
  return Math.max(1, Math.round(spec.width / module.width));
}
/**
 * Rebuild the three perimeter walls from the panel module: each takes the
 * whole number of panels its current width is nearest to, at the module's
 * width and height — so a rebuild leaves the booth about the size it already
 * was, snapped to panels, rather than to whatever count it happened to have
 * at the old width. The footprint follows, because a wall wider than the
 * booth is not a booth anyone can build.
 */
export function relinkArtShowWalls(p) {
  const module = artShowPanel(p.booth);
  const counts = {};
  for (const key of ["back", "left", "right"]) counts[key] = panelCount(p, key);
  for (const key of ["back", "left", "right"]) {
    const width = Math.max(12, Math.min(360, counts[key] * module.width));
    p.booth.walls[key] = {
      ...p.booth.walls[key],
      width: Math.round(width * 100) / 100,
      height: module.height,
    };
  }
  p.booth.width = Math.max(48, Math.min(360, p.booth.walls.back.width));
  p.booth.depth = Math.max(48, Math.min(360, p.booth.walls.left.width));
  p.booth.height = Math.max(48, Math.min(144, module.height));
  p.art = p.art.map((a) => constrain(p, a));
  return p;
}
export const PEDESTAL_PREFIX = "pedestal:";
export const MAX_PEDESTALS = 8;
/** The pedestal asked for: 44″ tall, 12 × 12, with a solid top. */
export const PEDESTAL = { width: 12, depth: 12, height: 44, color: "#f4f3f0" };
export const boothPedestals = (p) => p.booth.pedestals || [];
export const findPedestal = (p, id) =>
  boothPedestals(p).find((ped) => ped.id === id) || null;
/** A pedestal with its X/Z pulled back inside the footprint. Same rule a panel gets. */
export function constrainPedestal(p, ped) {
  const r = panelRange(p);
  return {
    ...ped,
    x: Math.max(-r.x, Math.min(r.x, ped.x)),
    z: Math.max(-r.z, Math.min(r.z, ped.z)),
  };
}
export const PANEL_PREFIX = "panel:";
export const panelKey = (id) => PANEL_PREFIX + id;
export const isPanelKey = (key) =>
  typeof key === "string" && key.startsWith(PANEL_PREFIX);
export const panelIdOf = (key) =>
  isPanelKey(key) ? key.slice(PANEL_PREFIX.length) : null;
export const boothPanels = (p) => p.booth.panels || [];
export const findPanel = (p, key) =>
  boothPanels(p).find((panel) => panel.id === panelIdOf(key)) || null;
/** Every wall a placement may name, perimeter walls first. */
export const wallKeys = (p) => [
  "back",
  "left",
  "right",
  ...boothPanels(p).map((panel) => panelKey(panel.id)),
];
/**
 * The width/height/enabled a placement is measured against, for a perimeter
 * wall or a free-standing panel alike. Every caller that used to index
 * `booth.walls` goes through here. A key naming a panel that no longer exists
 * returns null; callers treat that the way they treat a hidden wall.
 */
export function wallSpec(p, key) {
  if (isPanelKey(key)) {
    const panel = findPanel(p, key);
    return panel
      ? { enabled: true, width: panel.width, height: panel.height, panel }
      : null;
  }
  return p.booth.walls[key] || null;
}
export const wallLabel = (p, key) => {
  const panel = findPanel(p, key);
  if (panel) return panel.name || "Panel";
  return key ? key[0].toUpperCase() + key.slice(1) + " wall" : "";
};
export const wallWidth = (p, wall) => wallSpec(p, wall)?.width ?? 0;
export function boundWarning(p, a) {
  const wall = wallSpec(p, a.wall);
  if (!wall) return "This wall no longer exists. Move the artwork in Layout.";
  if (!wall.enabled) return "This wall is hidden. Enable it in Layout.";
  if (
    a.x < 0 ||
    a.y < 0 ||
    a.x + a.w > wall.width + 0.001 ||
    a.y + a.h > wall.height + 0.001
  )
    return "Artwork extends beyond this wall. Adjust its size or placement.";
  return "";
}
export function constrain(p, a) {
  const wall = wallSpec(p, a.wall);
  if (!wall) return { ...a };
  const w = wall.width,
    h = wall.height;
  return {
    ...a,
    x: Math.max(0, Math.min(a.x, w - a.w)),
    y: Math.max(0, Math.min(a.y, h - a.h)),
  };
}
/**
 * The travel of a free-standing wall's position sliders and of a drag across
 * the floor: the booth's own footprint, measured from the centre. A panel is
 * an interior fitting, so that is the useful range — the stored schema has
 * always allowed +/-360 and still does, which is what lets a typed or imported
 * position outside the booth keep its meaning.
 */
export const panelRange = (p) => ({
  x: p.booth.width / 2,
  z: p.booth.depth / 2,
});
/** A panel with its X/Z pulled back inside the footprint. Everything else is untouched. */
export function constrainPanel(p, panel) {
  const r = panelRange(p);
  return {
    ...panel,
    x: Math.max(-r.x, Math.min(r.x, panel.x)),
    z: Math.max(-r.z, Math.min(r.z, panel.z)),
  };
}
export function mismatch(p, a) {
  const asset = p.assets[a.asset];
  return (
    !!asset &&
    Math.abs(a.w / a.h - editedAspect(asset, a.edits)) /
      editedAspect(asset, a.edits) >
      0.015
  );
}
export const MAX_PANELS = 8;
const finite = (n, min, max) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
export function validateProject(p) {
  const fail = () => {
    throw new Error(
      "This is not a valid Booth Studio v1 backup. Your current project was kept.",
    );
  };
  if (
    !p ||
    p.schema !== 1 ||
    p.units !== "inches" ||
    typeof p.name !== "string" ||
    p.name.length > 200 ||
    !Array.isArray(p.art) ||
    p.art.length > 200 ||
    !p.booth ||
    !p.assets ||
    !Array.isArray(p.lights) ||
    p.lights.length > 4 ||
    !p.photo
  )
    fail();
  if (
    !finite(p.booth.width, 48, 360) ||
    !finite(p.booth.depth, 48, 360) ||
    !finite(p.booth.height, 48, 144) ||
    !/^#[0-9a-f]{6}$/i.test(p.booth.color) ||
    typeof p.booth.tent !== "boolean"
  )
    fail();
  for (const [key, values] of Object.entries({tentStyle:["classic","peak","barrel","dome"],ground:["studio","grass","concrete","asphalt","carpet","wood"],horizon:["studio","open","park","urban"],wallFinish:["smooth","fabric"]})) {
    if (p.booth[key] !== undefined && !values.includes(p.booth[key])) fail();
  }
  if (p.booth.neighbors !== undefined && typeof p.booth.neighbors !== "boolean") fail();
  if (p.booth.venue !== undefined && !["outdoor", "artshow"].includes(p.booth.venue)) fail();
  // The panel module, the light bar and the hall are all optional records.
  // Undefined means "the defaults above", which is exactly what every backup
  // written before this release says.
  if (p.booth.artShow !== undefined) {
    const a = p.booth.artShow;
    if (
      !a ||
      typeof a !== "object" ||
      !finite(a.width, 6, 360) ||
      !finite(a.height, 24, 144) ||
      (a.linked !== undefined && typeof a.linked !== "boolean")
    )
      fail();
  }
  if (p.booth.lightBar !== undefined) {
    const l = p.booth.lightBar;
    if (
      !l ||
      typeof l !== "object" ||
      typeof l.on !== "boolean" ||
      !finite(l.height, 24, 240) ||
      !finite(l.count, 1, 24) ||
      l.count !== Math.round(l.count) ||
      !finite(l.power, 0, 300) ||
      !finite(l.kelvin, 2700, 6500)
    )
      fail();
  }
  if (p.booth.hall !== undefined) {
    const h = p.booth.hall;
    if (!h || typeof h !== "object" || typeof h.on !== "boolean" || !finite(h.ceiling, 96, 720))
      fail();
    if (h.showCeiling !== undefined && typeof h.showCeiling !== "boolean") fail();
  }
  if (p.booth.pedestals !== undefined) {
    if (!Array.isArray(p.booth.pedestals) || p.booth.pedestals.length > MAX_PEDESTALS) fail();
    const seen = new Set();
    for (const ped of p.booth.pedestals) {
      if (
        !ped ||
        typeof ped.id !== "string" ||
        !ped.id ||
        ped.id.length > 200 ||
        seen.has(ped.id) ||
        !finite(ped.width, 4, 96) ||
        !finite(ped.depth, 4, 96) ||
        !finite(ped.height, 6, 96) ||
        !finite(ped.x, -360, 360) ||
        !finite(ped.z, -360, 360) ||
        !finite(ped.rotation, -180, 180)
      )
        fail();
      if (ped.name !== undefined && (typeof ped.name !== "string" || ped.name.length > 200)) fail();
      if (ped.color !== undefined && !/^#[0-9a-f]{6}$/i.test(ped.color)) fail();
      seen.add(ped.id);
    }
  }
  for (const wall of ["back", "left", "right"]) {
    let w = p.booth.walls?.[wall];
    if (
      !w ||
      typeof w.enabled !== "boolean" ||
      !finite(w.width, 12, wall === "back" ? p.booth.width : p.booth.depth) ||
      !finite(w.height, 24, 144)
    )
      fail();
  }
  if (p.booth.neighborLayout !== undefined && !["inline","corner-left","corner-right","island"].includes(p.booth.neighborLayout)) fail();
  for (const key of ["neighborGap", "rearGap"]) if (p.booth[key] !== undefined && !finite(p.booth[key], 0, 240)) fail();
  if (p.booth.neighborRear !== undefined && typeof p.booth.neighborRear !== "boolean") fail();
  if (p.booth.surroundAsset != null && (typeof p.booth.surroundAsset !== "string" || !p.assets[p.booth.surroundAsset])) fail();
  if (p.booth.surroundRotation !== undefined && !finite(p.booth.surroundRotation, -180, 180)) fail();
  if (p.booth.groundAsset != null && (typeof p.booth.groundAsset !== "string" || !p.assets[p.booth.groundAsset])) fail();
  if (p.booth.groundTile !== undefined && !finite(p.booth.groundTile, 12, 240)) fail();
  if (p.booth.wallTexture !== undefined && !finite(p.booth.wallTexture, 0, 100)) fail();
  if (p.booth.backdropFraming !== undefined && !finite(p.booth.backdropFraming, 25, 100)) fail();
  if (p.booth.backdropTilt !== undefined && !finite(p.booth.backdropTilt, -45, 45)) fail();
  if (p.booth.backdropLock !== undefined && typeof p.booth.backdropLock !== "boolean") fail();
  // Free-standing panels. Absent in every schema-1 backup written before they
  // existed, so undefined is valid and means "none".
  const panelIds = new Set();
  if (p.booth.panels !== undefined) {
    if (!Array.isArray(p.booth.panels) || p.booth.panels.length > MAX_PANELS) fail();
    for (const panel of p.booth.panels) {
      if (
        !panel ||
        typeof panel.id !== "string" ||
        !panel.id ||
        panel.id.length > 200 ||
        panelIds.has(panel.id) ||
        panel.id.includes(":") ||
        !finite(panel.width, 12, 360) ||
        !finite(panel.height, 24, 144) ||
        !finite(panel.x, -360, 360) ||
        !finite(panel.z, -360, 360) ||
        !finite(panel.rotation, -180, 180)
      )
        fail();
      if (panel.name !== undefined && (typeof panel.name !== "string" || panel.name.length > 200)) fail();
      panelIds.add(panel.id);
    }
  }
  const ids = new Set();
  for (const a of p.art) {
    if (
      typeof a.id !== "string" ||
      ids.has(a.id) ||
      typeof a.title !== "string" ||
      a.title.length > 200 ||
      !(["back", "left", "right"].includes(a.wall) ||
        (isPanelKey(a.wall) && panelIds.has(panelIdOf(a.wall)))) ||
      !finite(a.w, 1, 360) ||
      !finite(a.h, 1, 360) ||
      !finite(a.x, -360, 360) ||
      !finite(a.y, -360, 360) ||
      !finite(a.thickness, 0.1, 12) ||
      !finite(a.offset, 0, 12)
    )
      fail();
    if (a.face !== undefined && !["inside", "outside"].includes(a.face)) fail();
    if (a.kind !== undefined && !["art", "sign", "label"].includes(a.kind)) fail();
    for (const key of ["artistName", "city", "medium", "price"])
      if (a[key] !== undefined && (typeof a[key] !== "string" || a[key].length > 200)) fail();
    if (a.sourceId !== undefined && (typeof a.sourceId !== "string" || a.sourceId.length > 200)) fail();
    if (a.edits !== undefined && !validImageEdits(a.edits)) fail();
    if (a.stretch !== undefined && typeof a.stretch !== "boolean") fail();
    if (a.edgeTexture !== undefined && !["plain", "concrete", "wood", "metal"].includes(a.edgeTexture)) fail();
    if (a.edgeColor !== undefined && !/^#[0-9a-f]{6}$/i.test(a.edgeColor)) fail();
    ids.add(a.id);
    if (a.asset && !p.assets[a.asset]) fail();
  }
  if (p.editClipboard !== undefined && p.editClipboard !== null && !validImageEdits(p.editClipboard)) fail();
  if (Object.keys(p.assets).length > 250) fail();
  for (const asset of Object.values(p.assets)) {
    if (
      !asset ||
      !finite(asset.width, 1, 30000) ||
      !finite(asset.height, 1, 30000) ||
      (asset.role !== undefined && !["artwork", "photo", "surround", "ground"].includes(asset.role)) ||
      typeof asset.data !== "string" ||
      !/^data:image\/(png|jpeg);base64,/.test(asset.data) ||
      asset.data.length > 40000000
    )
      fail();
  }
  if (!finite(p.ambient, 0, 4)) fail();
  for (const l of p.lights) {
    for (const key of ["x", "z", "tx", "tz"])
      if (!finite(l[key], -360, 360)) fail();
    for (const key of ["y", "ty"]) if (!finite(l[key], 0, 160)) fail();
    if (!finite(l.power, 0, 300) || !finite(l.kelvin, 2700, 6500)) fail();
  }
  if (
    !Array.isArray(p.photo.layers) ||
    p.photo.layers.length > 200 ||
    !Array.isArray(p.photo.lights) ||
    p.photo.lights.length > 8 ||
    !finite(p.photo.exposure, -1, 1) ||
    (p.photo.asset && !p.assets[p.photo.asset])
  )
    fail();
  for (const l of p.photo.layers) {
    if (
      !p.assets[l.asset] ||
      !Array.isArray(l.corners) ||
      l.corners.length !== 4 ||
      !l.corners.every(
        (c) =>
          Array.isArray(c) && c.length === 2 && c.every((n) => finite(n, 0, 1)),
      ) ||
      !finite(l.shadow, 0, 60)
    )
      fail();
  }
  for (const l of p.photo.lights) {
    if (
      !finite(l.x, 0, 1) ||
      !finite(l.y, 0, 1) ||
      !finite(l.radius, 0.02, 0.8) ||
      !finite(l.power, 0, 1) ||
      !finite(l.kelvin, 2700, 6500)
    )
      fail();
  }
  return p;
}
export const escapeHTML = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// Normalized square -> projective quadrilateral. Coordinates ordered TL, TR, BR, BL.
export function homography(q) {
  const [a, b, c, d] = q,
    dx1 = b[0] - c[0],
    dx2 = d[0] - c[0],
    dx3 = a[0] - b[0] + c[0] - d[0],
    dy1 = b[1] - c[1],
    dy2 = d[1] - c[1],
    dy3 = a[1] - b[1] + c[1] - d[1],
    den = dx1 * dy2 - dx2 * dy1;
  let g = 0,
    h = 0;
  if (Math.abs(den) > 1e-10) {
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  return (u, v) => {
    const z = g * u + h * v + 1;
    return [
      ((b[0] - a[0] + g * b[0]) * u + (d[0] - a[0] + h * d[0]) * v + a[0]) / z,
      ((b[1] - a[1] + g * b[1]) * u + (d[1] - a[1] + h * d[1]) * v + a[1]) / z,
    ];
  };
}
export function convex(q) {
  return q.every((a, i) => {
    const b = q[(i + 1) % 4],
      c = q[(i + 2) % 4];
    return (
      (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > 0.00001
    );
  });
}

/** Neighbors use nominal footprint-edge gaps in inches, not center spacing. */
export function neighborPlacements(b) {
  if (!b.neighbors) return [];
  const layout = b.neighborLayout || "inline", gap = b.neighborGap ?? 24;
  const result = [], size = 120;
  if (layout !== "island") {
    if (layout !== "corner-left") result.push({side:"left", x:-(b.width/2 + gap + size/2), z:0});
    if (layout !== "corner-right") result.push({side:"right", x:b.width/2 + gap + size/2, z:0});
  }
  if (b.neighborRear && layout !== "island") result.push({side:"rear", x:0, z:-(b.depth/2 + (b.rearGap ?? gap) + size/2)});
  return result;
}
/** Uniform size adjustment preserves image proportions and the panel's center. */
export function scalePanel(p, a, factor) {
  const wall = wallSpec(p, a.wall);
  if (!wall) return { ...a };
  const low = Math.max(1 / a.w, 1 / a.h);
  const high = Math.max(low, Math.min(360 / a.w, 360 / a.h, wall.width / a.w, wall.height / a.h));
  const f = Math.max(low, Math.min(high, Number.isFinite(factor) ? factor : 1));
  const w = a.w * f, h = a.h * f;
  return constrain(p, {...a, w, h, x:a.x + (a.w-w)/2, y:a.y + (a.h-h)/2});
}
