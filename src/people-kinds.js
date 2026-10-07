// The figures' kinds and limits, without their drawing (src/people.js imports
// three). scene-ops.js reads these, so the studio assistant adds and changes
// figures with the app's own numbers, and studio-api's vendored build of it
// never loads three.
export const PERSON_KINDS = {
  woman: { label: "Woman · 5′6″", height: 66 },
  man: { label: "Man · 6′0″", height: 72 },
  child: { label: "Child · 4′0″", height: 48 },
  group: { label: "Pair · 5′10″", height: 70 },
  wheelchair: { label: "Wheelchair user · 4′4″", height: 52 },
};
export const DEFAULT_PERSON = "woman";
export const MAX_PEOPLE = 6;
export const MIN_HEIGHT = 48;
export const MAX_HEIGHT = 84;
// How far a figure can be raised off the floor, in inches: onto a pedestal, a
// drawn box used as a stage, or a riser. Optional on the record; absent is on
// the floor, which is every figure saved before it existed. The range runs as
// far below the floor as above it, so the slider's travel has 0 at its middle
// — asked for so that raise and lower start from the same place — and a
// figure can be sunk into a stepped-down floor or a pit as easily as stood on
// a riser. Half-inch steps: a figure standing on a 3/4" platform is a real
// thing, and whole inches could not say it.
export const MAX_LIFT = 120;
export const MIN_LIFT = -120;
export const LIFT_STEP = 0.5;
export const resolvePerson = (kind) => (PERSON_KINDS[kind] ? kind : DEFAULT_PERSON);
export const personHeight = (kind) => PERSON_KINDS[resolvePerson(kind)].height;
/** What a figure is called in its row and its toast: the label's first part. */
export const personName = (kind) => PERSON_KINDS[resolvePerson(kind)].label.split(" · ")[0];

/** A new figure for the project, placed a little in front of the back wall. */
export const newPerson = (kind = DEFAULT_PERSON, id = "") => ({
  id,
  kind: resolvePerson(kind),
  height: personHeight(resolvePerson(kind)),
  // Inches from the centre of the floor, the same frame the lights use.
  x: 0,
  z: 18,
  // Degrees. 0 faces the aisle, which is how someone looking at the back wall
  // would be standing if you were photographing the booth from outside.
  rotation: 180,
});

/**
 * A figure turned round to face the other way, kept in the Facing field's
 * -180…180 range. The cut-out picture mirrors with its facing, so this is
 * the one-click Flip in the People panel.
 */
export function flipFacing(rotation) {
  const r = (((Number(rotation) || 0) + 180) % 360 + 360) % 360;
  return r > 180 ? r - 360 : r;
}
