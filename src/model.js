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
      ground: "studio",
      horizon: "studio",
      neighbors: false,
      color: "#45474a",
      walls: {
        back: { enabled: true, width: 120, height: 96 },
        left: { enabled: true, width: 120, height: 96 },
        right: { enabled: true, width: 120, height: 96 },
      },
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
export const wallWidth = (p, wall) => p.booth.walls[wall].width;
export function boundWarning(p, a) {
  const wall = p.booth.walls[a.wall];
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
  const w = wallWidth(p, a.wall),
    h = p.booth.walls[a.wall].height;
  return {
    ...a,
    x: Math.max(0, Math.min(a.x, w - a.w)),
    y: Math.max(0, Math.min(a.y, h - a.h)),
  };
}
export function mismatch(p, a) {
  const asset = p.assets[a.asset];
  return (
    !!asset &&
    Math.abs(a.w / a.h - asset.width / asset.height) /
      (asset.width / asset.height) >
      0.015
  );
}
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
  for (const [key, values] of Object.entries({tentStyle:["classic","peak","barrel","dome"],ground:["studio","grass","concrete","asphalt"],horizon:["studio","open","park","urban"]})) {
    if (p.booth[key] !== undefined && !values.includes(p.booth[key])) fail();
  }
  if (p.booth.neighbors !== undefined && typeof p.booth.neighbors !== "boolean") fail();
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
  const ids = new Set();
  for (const a of p.art) {
    if (
      typeof a.id !== "string" ||
      ids.has(a.id) ||
      typeof a.title !== "string" ||
      a.title.length > 200 ||
      !["back", "left", "right"].includes(a.wall) ||
      !finite(a.w, 1, 360) ||
      !finite(a.h, 1, 360) ||
      !finite(a.x, -360, 360) ||
      !finite(a.y, -360, 360) ||
      !finite(a.thickness, 0.1, 12) ||
      !finite(a.offset, 0, 12)
    )
      fail();
    ids.add(a.id);
    if (a.asset && !p.assets[a.asset]) fail();
  }
  if (Object.keys(p.assets).length > 250) fail();
  for (const asset of Object.values(p.assets)) {
    if (
      !asset ||
      !finite(asset.width, 1, 30000) ||
      !finite(asset.height, 1, 30000) ||
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
