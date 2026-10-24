// What is added to the booth besides a work hung in 3D: `addPhotoLayer` (a
// work laid over the booth photo) and
// `addWallAsset` (the artist's sign or a work's label), both returned, and the
// `onchange` of the four file inputs for a 3D model, a floor plan, a 360°
// backdrop and a ground photograph. Called once: it sets those four
// handlers. Moved out of src/main.js's boot() as it was (MAIN_SPLIT_PHASE.md,
// seam 21): `ctx` is boot's state, read and set through it, and the helpers
// these call.
import { uid, GROUND_UPLOAD, selectGround, constrain, MAX_MODELS } from "../model.js";
import { readImage } from "../storage.js";
import { assetInDesigns } from "../linked.js";

export function createAssetInputs(ctx) {
  const { allowed, mutate, toast } = ctx;
  function addPhotoLayer(a) {
    if (!ctx.p.photo.asset) {
      toast("Upload a booth photo first.", true);
      return;
    }
    if (a.kind === "sign" || a.kind === "label") {
      toast("Signs and labels are currently available in measured 3D mode.", true); return;
    }
    if (!a.asset) {
      toast("Add an original image to this sample panel first.", true);
      return;
    }
    const asset = ctx.p.assets[a.asset],
      bg = ctx.p.assets[ctx.p.photo.asset],
      h = Math.min(
        0.6,
        (0.25 * bg.width) / bg.height / (asset.width / asset.height),
      );
    const l = {
      id: uid(),
      asset: a.asset,
      title: a.title,
      corners: [
        [0.35, 0.25],
        [0.6, 0.25],
        [0.6, 0.25 + h],
        [0.35, 0.25 + h],
      ],
      shadow: 18,
    };
    mutate(() => {
      ctx.p.photo.layers.push(l);
      ctx.photoSelected = l.id;
      ctx.tab = "art";
    });
  }
  function addWallAsset(kind) {
    if (ctx.p.art.length >= 200) { toast("This prototype supports up to 200 panels.", true); return; }
    const source = ctx.p.art.find(a=>a.id===ctx.selected);
    const a = {id:uid(), asset:null, kind,
      title:kind==="sign"?"Artist sign":source?.title || "Artwork title",
      artistName:"", city:"", medium:source?.medium || "", price:"",
      wall:source?.wall || "back", face:source?.face || "inside",
      w:kind==="sign"?30:4, h:kind==="sign"?12:2.5,
      x:source ? source.x : 12, y:kind==="sign"?78:source ? Math.max(0,source.y-4) : 48,
      thickness:.1, offset:.2};
    mutate(()=>{ctx.p.art.push(constrain(ctx.p,a));ctx.selected=a.id;ctx.tab="art";});
  }
  document.querySelector("#model-input").onchange = async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    if (!allowed("glb")) return toast("3D model import is part of Booth Studio Pro.", true);
    try {
      if (!/\.glb$/i.test(file.name)) throw new Error("Choose a .glb file — binary glTF, which SketchUp, Blender and most scanners export.");
      if (file.size > 28 * 1024 * 1024) throw new Error("That model is over 28 MB. Simplify or compress it and try again.");
      const models = ctx.p.booth.models || [];
      if (models.length >= MAX_MODELS) throw new Error(`${MAX_MODELS} models is the limit.`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      // glTF binary files start "glTF".
      if (String.fromCharCode(...bytes.slice(0, 4)) !== "glTF") throw new Error("That file is not a binary glTF (.glb).");
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;/, "data:model/gltf-binary;"));
        reader.onerror = () => reject(new Error("The model could not be read."));
        reader.readAsDataURL(new Blob([bytes], { type: "model/gltf-binary" }));
      });
      const assetId = uid();
      const model = { id: uid(), asset: assetId, name: file.name.replace(/\.glb$/i, "").slice(0, 120), height: 36, x: 0, z: 0, rotation: 0 };
      mutate(() => {
        ctx.p.assets[assetId] = { name: file.name, width: 1, height: 1, role: "model", data };
        ctx.p.booth.models = [...models, model];
        ctx.tab = "walls";
      });
      toast(`${model.name} stands in the booth at 36″. Type its real height in the Walls tool.`);
    } catch (err) {
      toast(err.message, true);
    }
  };
  document.querySelector("#underlay-input").onchange = async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    if (!allowed("underlay")) return toast("The floor plan underlay is part of Booth Studio Pro.", true);
    try {
      if (Object.keys(ctx.p.assets).length >= 250) throw new Error("This prototype supports up to 250 images.");
      const asset = await readImage(file);
      mutate(() => {
        const old = ctx.p.booth.underlay?.asset;
        if (old && !ctx.p.art.some((a) => a.asset === old) && !assetInDesigns(ctx.p, old)) delete ctx.p.assets[old];
        const id = uid();
        asset.role = "underlay";
        ctx.p.assets[id] = asset;
        // A first guess: the plan ten times the booth's width, centred on it.
        // The tape and Scale plan set the real scale.
        ctx.p.booth.underlay = { asset: id, width: Math.min(24000, ctx.p.booth.width * 10), x: 0, z: 0, rotation: 0, opacity: 0.6, on: true };
      });
      ctx.scene?.setView("plan");
      document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === "plan"));
      toast("Floor plan laid under the booth. Measure something you know with the tape (T), then Scale plan.");
    } catch (err) {
      toast(err.message, true);
    }
  };
  for(const [input,key] of [["surround-input","surroundAsset"],["ground-input","groundAsset"]]){
    document.querySelector("#"+input).onchange=async ev=>{
      const file=ev.target.files[0];ev.target.value="";if(!file)return;
      try{
        if(Object.keys(ctx.p.assets).length>=250)throw new Error("This prototype supports up to 250 images.");
        const asset=await readImage(file);
        if(key==="surroundAsset" && Math.abs(asset.width/asset.height-2)>.1)
          throw new Error("Choose a 2:1 full-sphere panorama for this 360° background. Ordinary booth photos belong in Photo mode.");
        mutate(()=>{
          const id=uid();
          asset.role=key==="surroundAsset"?"surround":"ground";
          ctx.p.assets[id]=asset;
          // A ground upload joins the library and is selected; it does not
          // take a slot of its own that the preset picker has to fight.
          if(key==="groundAsset") selectGround(ctx.p, GROUND_UPLOAD+id); else ctx.p.booth[key]=id;
        });
        toast(key==="groundAsset"
          ? "Ground photograph added to your library and selected."
          : "Photographic material added. Original image is included in backups.");
      }catch(err){toast(err.message,true);}
    };
  }
  return { addPhotoLayer, addWallAsset };
}
