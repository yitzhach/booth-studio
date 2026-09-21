// Figures for scale: the numbers that make them a measurement rather than a
// decoration. The geometry needs a GPU; these do not.
import test from "node:test";
import assert from "node:assert/strict";
import { PEOPLE, DEFAULT_PERSON, MAX_PEOPLE, MIN_HEIGHT, MAX_HEIGHT, personHeight, resolvePerson, newPerson } from "../src/people.js";
import { blankProject, validateProject } from "../src/model.js";

test("the defaults are the ones asked for: 5'6\" and 6'0\"", () => {
  assert.equal(PEOPLE.woman.height, 66);
  assert.equal(PEOPLE.man.height, 72);
  assert.equal(personHeight("woman"), 66);
  assert.equal(personHeight("man"), 72);
});

test("an unknown kind falls back rather than producing a figure of no height", () => {
  assert.equal(resolvePerson("robot"), DEFAULT_PERSON);
  assert.equal(resolvePerson(undefined), DEFAULT_PERSON);
  assert.equal(personHeight("robot"), PEOPLE[DEFAULT_PERSON].height);
});

test("a new figure is inside every bound the project will check", () => {
  for (const kind of Object.keys(PEOPLE)) {
    const person = newPerson(kind, "abc");
    assert.equal(person.kind, kind);
    assert.ok(person.height >= MIN_HEIGHT && person.height <= MAX_HEIGHT);
    assert.equal(typeof person.x, "number");
    assert.equal(typeof person.z, "number");
    assert.ok(Math.abs(person.rotation) <= 360);
  }
});

test("a project carrying figures still validates, and a broken one does not", () => {
  const p = blankProject();
  p.booth.people = [newPerson("woman", "a"), newPerson("man", "b")];
  assert.doesNotThrow(() => validateProject(p));

  for (const broken of [
    { ...newPerson("woman", "a"), kind: "child" },
    { ...newPerson("woman", "a"), height: 200 },
    { ...newPerson("woman", "a"), height: "tall" },
    { ...newPerson("woman", "a"), x: 1e6 },
    null,
  ]) {
    const bad = blankProject();
    bad.booth.people = [broken];
    assert.throws(() => validateProject(bad), /not a valid Booth Studio/);
  }

  const tooMany = blankProject();
  tooMany.booth.people = Array.from({ length: MAX_PEOPLE + 1 }, (_, i) => newPerson("man", String(i)));
  assert.throws(() => validateProject(tooMany), /not a valid Booth Studio/);
});

test("the hide switch is optional, and absent means shown", () => {
  const p = blankProject();
  p.booth.people = [newPerson("woman", "a")];
  // Every backup written before the switch existed has no `showPeople` at all,
  // and every one of them meant "shown".
  assert.equal(p.booth.showPeople, undefined);
  assert.doesNotThrow(() => validateProject(p));
  for (const value of [true, false]) {
    p.booth.showPeople = value;
    assert.doesNotThrow(() => validateProject(p));
  }
  // Hiding keeps the figures: the list is what makes switching back free.
  p.booth.showPeople = false;
  assert.equal(p.booth.people.length, 1, "hidden is not deleted");
  for (const bad of ["yes", 1, null]) {
    p.booth.showPeople = bad;
    assert.throws(() => validateProject(p), /not a valid Booth Studio/);
  }
});

test("a schema-1 backup with no people at all still opens", () => {
  const old = blankProject();
  delete old.booth.people;
  delete old.booth.fixtures;
  assert.doesNotThrow(() => validateProject(old));
});
