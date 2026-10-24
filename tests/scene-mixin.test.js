// src/scene/mixin.js installs an area's methods on BoothScene's prototype as
// the class body did (SCENE_SPLIT_PHASE.md): not enumerable, and never over a
// name the class still has.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mixin } from "../src/scene/mixin.js";

test("a mixed-in method is defined as a class body defines one", () => {
  class Scene { kept() { return "kept"; } }
  mixin(Scene, { moved() { return this.kept() + " and moved"; } });
  const scene = new Scene();
  assert.equal(scene.moved(), "kept and moved", "`this` is the instance");
  const own = Object.getOwnPropertyDescriptor(Scene.prototype, "moved");
  assert.deepEqual({ ...own, value: undefined }, { ...Object.getOwnPropertyDescriptor(Scene.prototype, "kept"), value: undefined });
  assert.deepEqual(Object.keys(scene), [], "nothing enumerable appears on the instance");
});

test("a name the class still has throws instead of being shadowed", () => {
  class Scene { both() {} }
  assert.throws(() => mixin(Scene, { both() {} }), /Scene already has both/);
});
