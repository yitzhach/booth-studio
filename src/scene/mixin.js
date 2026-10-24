/**
 * Install an area's methods on a class's prototype (SCENE_SPLIT_PHASE.md).
 * Each is defined as a class body defines a method — writable, configurable,
 * not enumerable — and a name the prototype already has throws, so a method
 * left in the class and also moved fails at load instead of being shadowed.
 */
export function mixin(Class, methods) {
  for (const [name, value] of Object.entries(methods)) {
    if (Object.prototype.hasOwnProperty.call(Class.prototype, name))
      throw new Error(`${Class.name} already has ${name}`);
    Object.defineProperty(Class.prototype, name, { value, writable: true, configurable: true, enumerable: false });
  }
}
