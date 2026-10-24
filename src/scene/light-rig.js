// The art-show booth's light bar: the rail, its nine heads and the bounce
// fill (built from src/lightbar.js's numbers), and whether the heads cast
// shadows. Moved out of src/scene.js's BoothScene as it was
// (SCENE_SPLIT_PHASE.md, seam 1): `this` is the scene, and src/scene.js
// installs these on its prototype with `mixin`.
import * as T from "three";
import { IN, lightBarSpec } from "../model.js";
import { lightBarBounce, lightBarFixtures, lightBarOptics, lightBarRail } from "../lightbar.js";
export function temperature(k) {
  const t = (k - 2700) / 3800;
  return new T.Color().setRGB(
    1,
    0.7 + 0.28 * t,
    0.43 + 0.57 * t,
    T.SRGBColorSpace,
  );
}
export const lightRig = {
  /**
   * Whether the light bar's heads cast shadows. Nine shadow-casting spots are
   * nine shadow maps sampled by every lit fragment of every frame — with the
   * supersampling, the largest single cost of an art-show booth. At the
   * default diffusion each of those shadows is drawn at about a quarter
   * strength, filling in rather than cutting, and the fill light still grounds
   * every pedestal. So the live viewport leaves them off below High detail,
   * and `export()` and `recordVideo()` turn them on for the delivered file,
   * the way they already put fast edit's shadows back. three recompiles the
   * materials by itself: the number of shadowed spots is part of its lights
   * state.
   */
  setBarShadows(on) {
    this.barShadows = !!on;
    let changed = false;
    this.group.getObjectByName("light-bar")?.traverse((o) => {
      if (o.isSpotLight && o.castShadow !== this.barShadows) {
        o.castShadow = this.barShadows;
        changed = true;
      }
    });
    if (changed) this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  },
  /**
   * The light bar and its heads. Nine directional fixtures spotting the three
   * walls is what an art-show booth is lit with, and none of them is a
   * spotlight anyone wants in the four-light list: where each one points is
   * computed from the booth's measurements by `lightBarFixtures`, so the bar
   * is described by five numbers and rebuilt whenever those change.
   */
  buildLightBar(p, rough) {
    const rail = lightBarRail(p);
    if (!rail.on) return;
    const fixtures = lightBarFixtures(p);
    if (!fixtures.length) return;
    const spec = lightBarSpec(p.booth);
    const optics = lightBarOptics(spec);
    const bar = new T.Group();
    bar.name = "light-bar";
    bar.userData.tag = "fixtures";
    this.group.add(bar);
    // The white hall bouncing the bar back at itself. Without it every surface
    // the nine beams miss falls to black, which reads harsher than the beams.
    const bounce = lightBarBounce(p);
    if (bounce > 0) {
      const fill = new T.HemisphereLight(temperature(spec.kelvin), "#d8d5cf", bounce);
      fill.name = "light-bar-bounce";
      bar.add(fill);
    }
    const metal = new T.MeshStandardMaterial({
      color: "#2b2e31",
      roughness: 0.42,
      metalness: 0.6,
    });
    // The rail itself, plus a drop at each end back to the booth's top rail.
    this.box(rail.width * IN, 0.035, 0.035, 0, rail.y * IN, rail.z * IN, metal, bar);
    // A short bracket at each end, running back toward the booth, so the bar
    // reads as hung rather than floating.
    for (const side of [-1, 1])
      this.box(0.03, 0.03, 0.09, (side * rail.width * IN) / 2, rail.y * IN, rail.z * IN - 0.06, metal, bar);
    for (const f of fixtures) {
      const from = new T.Vector3(f.x * IN, f.y * IN, f.z * IN);
      const to = new T.Vector3(f.tx * IN, f.ty * IN, f.tz * IN);
      const light = new T.SpotLight(
        temperature(f.kelvin),
        f.power * optics.powerScale,
        // Reach far enough to cross the booth diagonally and land on the wall.
        26,
        // Narrower than a floor-standing spot: a wall washer on a bar is aimed
        // at one section of one wall, not at the room. How much narrower is
        // the Diffusion slider's business — see `lightBarOptics`.
        optics.angle,
        optics.penumbra,
        2,
      );
      light.position.copy(from);
      light.target.position.copy(to);
      // Off in the live viewport below High detail; see setBarShadows.
      light.castShadow = this.barShadows;
      // Nine shadow-casting spots is nine shadow passes. Half the map size of
      // a hand-placed spotlight keeps that affordable; a wall wash is a soft
      // edge anyway, so there is nothing in it to see.
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.00008;
      light.shadow.normalBias = optics.normalBias;
      // Nine sources means nine shadows behind every pedestal. Scaling how
      // dark each one goes is what a diffuser does in the room: it fills the
      // shadow rather than removing it.
      light.shadow.intensity = optics.shadowIntensity;
      light.shadow.camera.near = 0.1;
      light.shadow.camera.far = 26;
      bar.add(light, light.target);
      const head = new T.Mesh(new T.CylinderGeometry(0.035, 0.042, 0.12, 14), metal);
      head.position.copy(from);
      head.quaternion.setFromUnitVectors(
        new T.Vector3(0, -1, 0),
        to.clone().sub(from).normalize(),
      );
      head.castShadow = true;
      bar.add(head);
      const glow = new T.Mesh(
        new T.SphereGeometry(0.024, 10, 8),
        new T.MeshBasicMaterial({ color: temperature(f.kelvin) }),
      );
      glow.position.copy(from).addScaledVector(to.clone().sub(from).normalize(), 0.062);
      bar.add(glow);
    }
  },
};
