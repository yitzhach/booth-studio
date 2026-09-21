// Figures for scale.
//
// A booth drawing is a measurement, and a measurement is hard to read without
// something whose size everyone already knows. A 96-inch wall means little on
// screen; a 96-inch wall beside a 5'6" person means exactly what it means in
// the aisle.
//
// These are deliberately stylised — no faces, no clothing, no attempt at
// likeness. A figure detailed enough to look like a person invites the eye to
// judge the person instead of the booth, and this app renders artwork whose
// colour has to be judged honestly. Matte mid-grey keeps them out of the way
// of that, and out of the artwork's reflections.
//
// Heights are the defaults the user asked for and are editable per figure:
// 5 ft 6 for a woman, 6 ft for a man. They are averages standing in for a
// visitor, not a claim about anybody.
import * as T from "three";
import { IN } from "./model.js";

export const PEOPLE = {
  woman: { label: "Woman · 5′6″", height: 66 },
  man: { label: "Man · 6′0″", height: 72 },
};
export const DEFAULT_PERSON = "woman";
export const MAX_PEOPLE = 6;
export const MIN_HEIGHT = 48;
export const MAX_HEIGHT = 84;
export const personHeight = (kind) => (PEOPLE[kind] || PEOPLE[DEFAULT_PERSON]).height;
export const resolvePerson = (kind) => (PEOPLE[kind] ? kind : DEFAULT_PERSON);

// Proportions as fractions of standing height, from the ordinary artist's
// canon: the head is about an eighth of a figure, the hip sits near the
// half-way mark. They are what keeps a 5'6" figure reading as shorter rather
// than smaller — a uniformly scaled figure just looks further away.
const HEAD = 0.125;
const SHOULDER = 0.82;
const HIP = 0.5;

// Mid-grey, and darker than the walls on purpose: a figure lighter than the
// panels competes with the artwork, and under a spotlight it blows out to a
// white post. These read as a person standing in the booth at a glance, which
// is the entire job.
const PALETTE = {
  woman: "#5f636b",
  man: "#53575f",
};

/**
 * One figure, standing at the origin and facing +Z (the aisle), built to a
 * real height in inches so it can be measured against the walls beside it.
 */
export function makePerson(kind = DEFAULT_PERSON, inches = 0) {
  const id = resolvePerson(kind);
  const height = (inches > 0 ? inches : personHeight(id)) * IN;
  const group = new T.Group();
  const skin = new T.MeshStandardMaterial({
    color: PALETTE[id] || PALETTE.woman,
    roughness: 0.85,
    metalness: 0,
  });
  const add = (geometry, x, y, z) => {
    const mesh = new T.Mesh(geometry, skin);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    // Marks the mesh as part of a figure. Note what this does *not* do: it is
    // not `editorOnly`, so a figure is in the PNG and in the video, unlike the
    // grid and the selection handles. That is deliberate — a person is part of
    // the picture, and a render is where the scale reference earns its keep —
    // but it means Layout -> People -> Show the figures is the only way to take
    // one out of an export. This comment claimed the opposite for a while.
    mesh.userData.person = true;
    group.add(mesh);
    return mesh;
  };
  const shoulders = height * (id === "man" ? 0.125 : 0.112);
  const hips = height * (id === "man" ? 0.096 : 0.105);
  const headRadius = (height * HEAD) / 2;

  add(new T.SphereGeometry(headRadius, 18, 14), 0, height - headRadius, 0);
  // Neck.
  add(new T.CylinderGeometry(headRadius * 0.38, headRadius * 0.45, height * 0.04, 12), 0, height * 0.94, 0);
  // Torso: a tapered cylinder from shoulders to hips, which is enough of a
  // silhouette at the distance anybody looks at a booth from.
  const torso = add(
    new T.CylinderGeometry(shoulders * 0.46, hips * 0.42, height * (SHOULDER - HIP), 18, 1),
    0,
    height * (HIP + (SHOULDER - HIP) / 2),
    0,
  );
  // Flattened front to back: a round torso at this scale reads as a bollard,
  // and a bollard beside a wall tells you nothing about how tall the wall is.
  torso.scale.z = 0.5;
  // Hips, then two legs.
  const pelvis = add(new T.SphereGeometry(hips * 0.46, 16, 12), 0, height * HIP, 0);
  pelvis.scale.set(1, 0.68, 0.6);
  for (const side of [-1, 1]) {
    // Two legs with daylight between them. One merged column is the difference
    // between a figure and a post, and it is visible at any distance.
    const leg = add(
      new T.CylinderGeometry(hips * 0.17, hips * 0.12, height * HIP, 12),
      side * hips * 0.3,
      (height * HIP) / 2,
      0,
    );
    leg.scale.z = 0.9;
    // Arms hang just clear of the torso, tilted out a few degrees so the gap
    // survives being seen straight on.
    const arm = add(
      new T.CylinderGeometry(shoulders * 0.13, shoulders * 0.1, height * 0.33, 10),
      side * (shoulders * 0.5 + shoulders * 0.12),
      height * 0.655,
      0,
    );
    arm.rotation.z = side * -0.06;
    arm.scale.z = 0.9;
  }
  group.userData.person = true;
  return group;
}

/**
 * Where a figure stands, in one function, because a slider and a typed number
 * must land in the same place. `BoothScene.update` calls it when the scene is
 * built and `movePerson` calls it on every pixel of a drag.
 */
export function placePerson(group, person) {
  group.position.set((person.x || 0) * IN, 0, (person.z || 0) * IN);
  group.rotation.y = ((person.rotation || 0) * Math.PI) / 180;
  return group;
}

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
