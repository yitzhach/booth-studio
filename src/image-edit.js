export const DEFAULT_IMAGE_EDITS = Object.freeze({
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
});

const finite = (value, min, max) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export function normalizeImageEdits(value = {}) {
  value = value && typeof value === "object" ? value : {};
  return {
    exposure: finite(value.exposure, -2, 2) ? value.exposure : 0,
    contrast: finite(value.contrast, -100, 100) ? value.contrast : 0,
    saturation: finite(value.saturation, -100, 100) ? value.saturation : 0,
    temperature: finite(value.temperature, -100, 100) ? value.temperature : 0,
    tint: finite(value.tint, -100, 100) ? value.tint : 0,
    rotation: [0, 90, 180, 270].includes(value.rotation) ? value.rotation : 0,
    flipX: value.flipX === true,
    flipY: value.flipY === true,
  };
}

export function validImageEdits(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const e = normalizeImageEdits(value);
  return (
    finite(value.exposure, -2, 2) &&
    finite(value.contrast, -100, 100) &&
    finite(value.saturation, -100, 100) &&
    finite(value.temperature, -100, 100) &&
    finite(value.tint, -100, 100) &&
    e.rotation === value.rotation &&
    typeof value.flipX === "boolean" &&
    typeof value.flipY === "boolean"
  );
}

export function hasImageEdits(value) {
  const e = normalizeImageEdits(value);
  return Object.keys(DEFAULT_IMAGE_EDITS).some((key) => e[key] !== DEFAULT_IMAGE_EDITS[key]);
}

export function editedAspect(asset, value) {
  const e = normalizeImageEdits(value);
  return e.rotation % 180 ? asset.height / asset.width : asset.width / asset.height;
}
