import test from "node:test";
import assert from "node:assert/strict";
import {
  blankProject,
  demoProject,
  validateProject,
  constrain,
  boundWarning,
  mismatch,
  homography,
  convex,
  IN,
  neighborPlacements,
  scalePanel,
} from "../src/model.js";
import { hangingGuide } from "../src/guide.js";
import { DEFAULT_IMAGE_EDITS, editedAspect, hasImageEdits, normalizeImageEdits } from "../src/image-edit.js";
test("measured units: a 36 × 48 panel has 3:4 geometry in metres", () => {
  assert.equal(36 * IN, 0.9144);
  assert.equal(48 * IN, 1.2191999999999998);
  assert.ok(Math.abs((36 * IN) / (48 * IN) - 0.75) < 1e-9);
});
test("clamping respects the selected side wall, with visible oversize warnings", () => {
  const p = demoProject();
  p.booth.walls.left.width = 72;
  const a = { ...p.art[0], wall: "left", w: 36, x: 80, y: -5 };
  const c = constrain(p, a);
  assert.equal(c.x, 36);
  assert.equal(c.y, 0);
  assert.equal(boundWarning(p, c), "");
  assert.match(boundWarning(p, { ...c, w: 96 }), /beyond/);
  p.booth.walls.left.enabled = false;
  assert.match(boundWarning(p, c), /hidden/);
});
test("backup round trip preserves data; malformed and nonfinite values are rejected", () => {
  const p = demoProject();
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
  for (const bad of [
    { ...p, schema: 2 },
    { ...p, ambient: NaN },
    {
      ...p,
      assets: { bad: { data: "https://example.com", width: 1, height: 1 } },
    },
    { ...p, art: [{ ...p.art[0], thickness: -1 }] },
  ])
    assert.throws(() => validateProject(bad));
});
test("image aspect mismatch is detected without changing original data", () => {
  const p = demoProject();
  p.assets.test = {
    data: "data:image/png;base64,eA==",
    width: 300,
    height: 400,
  };
  const a = { ...p.art[0], asset: "test", w: 36, h: 48 };
  assert.equal(mismatch(p, a), false);
  assert.equal(mismatch(p, { ...a, h: 36 }), true);
  assert.equal(p.assets.test.data, "data:image/png;base64,eA==");
});
test("projective photo mapping maps all four corners accurately", () => {
  const q = [
      [10, 25],
      [200, 5],
      [180, 290],
      [30, 240],
    ],
    f = homography(q);
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ].forEach((uv, i) => {
    f(...uv).forEach((v, j) => assert.ok(Math.abs(v - q[i][j]) < 1e-8));
  });
  assert.equal(convex(q), true);
  assert.equal(convex([q[0], q[2], q[1], q[3]]), false);
});
test("guide escapes titles and documents wall reference coordinates", () => {
  const p = demoProject();
  p.name = "<script>alert(1)</script>";
  p.art[0].title = "<img onerror=bad>";
  const g = hangingGuide(p);
  assert.ok(!g.includes("<script>alert"));
  assert.ok(g.includes("&lt;img"));
  assert.match(g, /bottom-left/);
  assert.match(g, /not hook positions/);
});
test('environment settings round trip; legacy projects and invalid options',()=>{
 const p=blankProject();p.booth.tentStyle='barrel';p.booth.ground='grass';p.booth.horizon='park';p.booth.neighbors=true;
 assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
 for(const key of ['tentStyle','ground','horizon','neighbors'])delete p.booth[key];
 assert.deepEqual(validateProject(p),p);
 p.booth.tentStyle='unknown';assert.throws(()=>validateProject(p));
});

test("neighbor gaps use footprint edges, corners leave the named side open, rear is independent", () => {
  const p=blankProject(); p.booth.neighbors=true; p.booth.neighborGap=36; p.booth.neighborRear=true;p.booth.rearGap=48;
  assert.deepEqual(neighborPlacements(p.booth), [
    {side:"left",x:-156,z:0},{side:"right",x:156,z:0},{side:"rear",x:0,z:-168}
  ]);
  p.booth.width=240;
  assert.equal(neighborPlacements(p.booth)[0].x,-216);
  p.booth.neighborLayout="corner-left";
  assert.deepEqual(neighborPlacements(p.booth).map(n=>n.side),["right","rear"]);
  p.booth.neighborLayout="corner-right";
  assert.deepEqual(neighborPlacements(p.booth).map(n=>n.side),["left","rear"]);
  p.booth.neighborLayout="island";assert.deepEqual(neighborPlacements(p.booth),[]);
  p.booth.neighbors=false;assert.deepEqual(neighborPlacements(p.booth),[]);
});
test("legacy backups need no new fields; outside signage and labels round trip", () => {
  const p=demoProject();
  for(const key of ["neighborLayout","neighborGap","neighborRear","rearGap"])delete p.booth[key];
  assert.equal(validateProject(p),p);
  Object.assign(p.art[0],{kind:"sign",face:"outside",artistName:"Isaac Anderson",city:"Somerset, KY",medium:"Mixed media"});
  Object.assign(p.art[1],{kind:"label",face:"inside",w:4,h:2.5,price:"$400"});
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))),p);
  for(const [key,val] of [["neighborGap",-1],["rearGap",NaN],["neighborRear","yes"],["neighborLayout","wrong"],["groundAsset","missing"],["surroundAsset","missing"]]) {
    const bad=structuredClone(p);bad.booth[key]=val;assert.throws(()=>validateProject(bad));
  }
  for(const [key,val] of [["face","roof"],["kind","script"],["artistName",{}],["price","x".repeat(201)]]) {
    const bad=structuredClone(p);bad.art[0][key]=val;assert.throws(()=>validateProject(bad));
  }
});
test("uniform scaling keeps proportions, centers when possible and respects wall bounds", () => {
  const p=demoProject(), a={...p.art[0],face:"outside"};
  const c=scalePanel(p,a,1.2);
  assert.ok(Math.abs(c.w/c.h-a.w/a.h)<1e-10);
  assert.ok(Math.abs(c.x+c.w/2-a.x-a.w/2)<1e-10);
  assert.equal(c.face,"outside");
  assert.equal(boundWarning(p,scalePanel(p,a,100)), "");
  assert.ok(scalePanel(p,a,0).w>=1);
  assert.deepEqual(scalePanel(p,a,NaN),a);
});
test("hanging guide separates inside and outside wall coordinates and escapes labels", () => {
  const p=demoProject();
  Object.assign(p.art[1],{face:"outside",kind:"label",title:"<b>Outside title</b>"});
  const g=hangingGuide(p);
  assert.match(g,/Back wall · inside/);assert.match(g,/Back wall · outside/);
  assert.match(g,/facing the wall from outside/);
  assert.ok(g.includes("&lt;b&gt;Outside title&lt;/b&gt;"));
  assert.ok(!g.includes("<b>Outside title</b>"));
});

test("non-destructive image adjustments validate and rotated aspect follows the source", () => {
  const p=demoProject();
  p.assets.test={data:"data:image/png;base64,eA==",width:300,height:400,role:"artwork"};
  p.art[0].asset="test";
  p.art[0].edits={...DEFAULT_IMAGE_EDITS,exposure:.5,contrast:12,saturation:-8,temperature:18,tint:-4,rotation:90,flipX:true};
  p.editClipboard=structuredClone(p.art[0].edits);
  assert.equal(validateProject(p),p);
  assert.equal(editedAspect(p.assets.test,p.art[0].edits),400/300);
  assert.equal(hasImageEdits(p.art[0].edits),true);
  assert.deepEqual(normalizeImageEdits(),DEFAULT_IMAGE_EDITS);
  for(const [key,value] of [["exposure",3],["contrast",-101],["rotation",45],["flipY","yes"]]){
    const bad=structuredClone(p);bad.art[0].edits={...bad.art[0].edits,[key]:value};assert.throws(()=>validateProject(bad));
  }
  const badRole=structuredClone(p);badRole.assets.test.role="secret";assert.throws(()=>validateProject(badRole));
});
test("an original asset remains available after its last wall placement is removed", () => {
  const p=demoProject();
  p.assets.original={data:"data:image/png;base64,eA==",width:600,height:400,role:"artwork",name:"work.png"};
  p.art.push({...p.art[0],id:"placed-original",asset:"original"});
  p.art=p.art.filter(a=>a.asset!=="original");
  assert.ok(p.assets.original);
  assert.equal(validateProject(p),p);
});

test("stretch and colored edge materials survive backups and reject invalid data", () => {
  const p = demoProject();
  Object.assign(p.art[0], { stretch: true, edgeColor: "#2356ab", edgeTexture: "concrete" });
  assert.deepEqual(validateProject(JSON.parse(JSON.stringify(p))), p);
  for (const [key, value] of [["stretch", "yes"], ["edgeColor", "red"], ["edgeTexture", "unknown"]]) {
    const bad = structuredClone(p);
    bad.art[0][key] = value;
    assert.throws(() => validateProject(bad));
  }
});
