// The environment presets and the rules that follow from them, as data.
//
// Moved out of src/lighting.js (which re-exports all of it) because that file
// imports three.js, and this part is wanted where three.js is not: src/polish.js
// uses resolvePreset for a look, and polish.js now runs inside studio-api too,
// in the `npm run bundle:scene` build (Art-Talk-Back D-070), so the studio
// assistant can apply a look or Make it beautiful. Pure: no three.js, no DOM.

export const ENV_PRESETS = {
  studio: {
    label: "Studio · neutral",
    hdri: null,
    ground: "studio",
    horizon: "studio",
    exposure: 1.15,
    envIntensity: 1,
  },
  // A white hall, and nothing photographed in it. This preset carried the
  // burnt-warehouse HDRI until someone put an art-show booth in it and got
  // brick, girders and a dark ceiling behind seamless white walls: a trade
  // show is a convention centre, not a warehouse, and the photograph was
  // answering a question nobody asked. The warehouse is still here — it is
  // its own preset below, which is where someone who wants it goes.
  //
  // No `hdri`, so the procedural surroundings and the booth's own exhibition
  // hall stand, and the floor is the texture-free studio grey rather than a
  // concrete photograph.
  tradeshow: {
    label: "Trade show · exhibition hall",
    hdri: null,
    ground: "studio",
    horizon: "studio",
    exposure: 1.0,
    envIntensity: 1,
  },
  warehouse: {
    label: "Warehouse · photographed",
    hdri: "warehouse",
    ground: "concrete",
    horizon: "studio",
    exposure: 1.0,
    envIntensity: 1,
  },
  artfair: {
    label: "Art fair · outdoor",
    hdri: "artfair",
    ground: "grass",
    horizon: "open",
    exposure: 1.1,
    envIntensity: 1,
  },
  home: {
    label: "Home · interior",
    hdri: "home",
    ground: "studio",
    horizon: "studio",
    exposure: 0.9,
    envIntensity: 0.9,
  },
};
export const DEFAULT_PRESET = "studio";

// Which presets put the booth under a roof. Indoors the hall supplies its own
// track lighting, so the booth's own fixtures are visual clutter hanging in
// mid-air beside it — the rail reads as the light source and the housings read
// as a bug. Outdoors and in the neutral studio there is no hall, so the
// fixtures are the only thing telling you where the light comes from.
export const INDOOR_PRESETS = new Set(["tradeshow", "warehouse", "home"]);
// A venue of "artshow" is indoors whatever the environment picker says: the
// art-show booth stands in its own white hall with a light bar over it, and
// that hall is the thing the fixtures would be duplicating. The environment
// preset is a separate question — it defaults to the neutral studio there —
// so both are asked.
export const isIndoor = (preset, venue) =>
  venue === "artshow" || INDOOR_PRESETS.has(preset || DEFAULT_PRESET);

// Whether the spotlight housings are drawn. "auto" is the default and means
// "not indoors"; the other two are for someone who disagrees with that, which
// is a judgement about their own booth and not ours to override.
export const FIXTURE_MODES = {
  auto: "Auto · hidden indoors",
  always: "Always show",
  never: "Never show",
};
export const DEFAULT_FIXTURES = "auto";
export const showFixtures = (mode, preset, venue) =>
  (mode || DEFAULT_FIXTURES) === "always" ? true : (mode || DEFAULT_FIXTURES) === "never" ? false : !isIndoor(preset, venue);

// Artwork fidelity. "accurate" keeps the environment out of the artwork's
// shading so uploaded colour reads true; the lighting studio's own spotlights
// still fall on it, which a MeshBasicMaterial would discard. "scene" lets the
// HDRI tint the art the way the surrounding booth is tinted.
export const ART_FIDELITY = {
  accurate: "Accurate colour",
  scene: "Scene lighting",
};
export const DEFAULT_FIDELITY = "accurate";

export const resolvePreset = (id) =>
  ENV_PRESETS[id] ? { id, ...ENV_PRESETS[id] } : { id: DEFAULT_PRESET, ...ENV_PRESETS[DEFAULT_PRESET] };

export const artEnvIntensity = (mode) => (mode === "scene" ? 1 : 0);

export const presetPaths = (preset) =>
  preset.hdri
    ? {
        light: `assets/hdri/${preset.hdri}/light.hdr`,
        background: `assets/hdri/${preset.hdri}/bg.jpg`,
        meta: `assets/hdri/${preset.hdri}/meta.json`,
      }
    : null;
