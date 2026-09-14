import * as T from 'three';
import { neighborPlacements, IN } from './model.js';
export const TENTS = {classic:'Classic pop-up', peak:'High peak', barrel:'Barrel roof · TrimLine-inspired', dome:'Soft dome'};
const material = (color, extra={}) => new T.MeshStandardMaterial({color,roughness:.85,...extra});
function mesh(g,geo,mat) { const m=new T.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;g.add(m);return m; }
function rod(g,a,b,r,mat) {a=new T.Vector3(...a);b=new T.Vector3(...b);const m=mesh(g,new T.CylinderGeometry(r,r,a.distanceTo(b),8),mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.sub(a).normalize());return m;}
function surface(g,fn,mat,nu=40,nv=24) {const pts=[],uv=[],idx=[];for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){pts.push(...fn(i/nu,j/nv));uv.push(i/nu,j/nv);}for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+nu+1;idx.push(a,b,a+1,b,b+1,a+1);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return mesh(g,geo,mat);}
export function makeTent(W,D,H,style='classic') {
 const g=new T.Group();g.name='tent-'+style;
 const steel=material('#c0c4c5',{metalness:.65,roughness:.32}),fabric=new T.MeshPhysicalMaterial({color:'#f7f6f0',roughness:.88,side:T.DoubleSide,sheen:.35,sheenColor:new T.Color('#fff9e9'),bumpMap:fabricWeave(),bumpScale:.0015}),seam=material('#deddd5');
 const eave=H+.38, drop=.30, rise=style==='peak'?1.15:style==='classic'?.76:.68;
 const height=(u,v)=>{const x=2*u-1,z=2*v-1;
 let h=style==='barrel'?Math.sqrt(Math.max(0,1-x*x)) : style==='dome'?Math.sqrt(Math.max(0,1-x*x))*Math.sqrt(Math.max(0,1-z*z)) : Math.pow(1-Math.max(Math.abs(x),Math.abs(z)),style==='peak'?1.55:1.15);
 return eave+rise*h + .006*Math.sin(u*95+v*7)*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);};
 surface(g,(u,v)=>[(u-.5)*(W+.08),height(u,v),(v-.5)*(D+.08)],fabric);
 if(style==='barrel') for(const v of [0,1]) surface(g,(u,t)=>[(u-.5)*(W+.08),eave+(height(u,v)-eave)*t,(v-.5)*(D+.08)],fabric,40,12);
 for(const x of [-W/2,W/2])for(const z of [-D/2,D/2]){
 rod(g,[x,.02,z],[x,eave,z],.021,steel);
 const foot=mesh(g,new T.BoxGeometry(.12,.015,.12),steel);foot.position.set(x,.005,z);
 for(const y of [.15,H*.53,eave-.35]){const collar=mesh(g,new T.BoxGeometry(.052,.065,.052),steel);collar.position.set(x,y,z);}
 }
 // Deep fabric valances with soft folds and raised stitched hems.
 for(let side=0;side<4;side++){
 const alongX=side<2,sign=side%2?1:-1,L=alongX?W+.08:D+.08;
 surface(g,(u,v)=>{const fold=.008*Math.sin(u*65)*Math.sin(Math.PI*v),a=(u-.5)*L,b=sign*((alongX?D:W)/2+.04+fold);return alongX?[a,eave-v*drop,b]:[b,eave-v*drop,a];},fabric,48,6);
 for(const y of [eave-.015,eave-drop+.012]) rod(g,alongX?[-L/2,y,sign*(D/2+.045)]:[sign*(W/2+.045),y,-L/2],alongX?[L/2,y,sign*(D/2+.045)]:[sign*(W/2+.045),y,L/2],.007,seam);
 const z=sign*(alongX?D:W)/2;
 const pt=(a,y)=>alongX?[a,y,z]:[z,y,a];
 rod(g,pt(-L/2,eave-.09),pt(L/2,eave-.09),.015,steel);
 for(let i=0;i<4;i++){let a=-L/2+i*L/4,b=a+L/4;rod(g,pt(a,eave-.13),pt(b,eave-.43),.009,steel);rod(g,pt(a,eave-.43),pt(b,eave-.13),.009,steel);}
 }
 // Curved roof ribs and subtle seams define stretched fabric.
 for(const v of [0,.25,.5,.75,1]){const points=[];for(let i=0;i<=40;i++){const u=i/40;points.push(new T.Vector3((u-.5)*(W+.08),height(u,v)-.016,(v-.5)*(D+.08)));}mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points),40,.008,5,false),steel);}
 return g;
}
function groundTexture(kind){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');let seed=123;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};x.fillStyle={grass:'#6d7850',concrete:'#b6b1a5',asphalt:'#55585a'}[kind]||'#a9a6a0';x.fillRect(0,0,512,512);for(let i=0;i<42000;i++){const a=rand()*512,b=rand()*512,v=Math.floor(rand()*70);x.fillStyle=kind==='grass'?`rgba(${65+v},${80+v},${32+v/2},.45)`:`rgba(${v>35?255:0},${v>35?255:0},${v>35?255:0},.10)`;x.fillRect(a,b,kind==='grass'?1:rand()*2+1,kind==='grass'?rand()*7+2:1);}if(kind==='concrete'){x.strokeStyle='#8f8e85';x.lineWidth=2;x.strokeRect(1,1,510,510);}const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(48,48);t.colorSpace=T.SRGBColorSpace;return t;}
const textures=new Map();
let weave;
function fabricWeave() {
 if (weave) return weave;
 const c=document.createElement('canvas'); c.width=c.height=128;
 const ctx=c.getContext('2d'); ctx.fillStyle='#888'; ctx.fillRect(0,0,128,128);
 for(let i=0;i<128;i+=4){ctx.fillStyle='#aaa';ctx.fillRect(i,0,1,128);ctx.fillStyle='#666';ctx.fillRect(0,i,128,1);}
 weave=new T.CanvasTexture(c); weave.wrapS=weave.wrapT=T.RepeatWrapping; weave.repeat.set(12,12); return weave;
}
export function environment(scene,g,b){const kind=b.ground||'studio',setting=b.horizon||'studio';scene.background=new T.Color(setting==='studio'?'#b5b4b0':'#c8dce7');scene.fog=setting==='studio'?null:new T.Fog('#c8dce7',24,75);
 if(!textures.has(kind)&&kind!=='studio')textures.set(kind,groundTexture(kind));
 const floor=mesh(g,new T.PlaneGeometry(180,180),material(kind==='studio'?'#a9a6a0':'#ffffff',{map:textures.get(kind)||null}));floor.name='environment-ground';floor.rotation.x=-Math.PI/2;floor.position.y=-.045;
 if(kind!=='studio'){floor.material.bumpMap=textures.get(kind);floor.material.bumpScale=kind==='grass'?.025:.008;}
 if(setting==='park'&&!b.surroundAsset)for(let i=0;i<24;i++){const angle=i/24*Math.PI*2,dist=19+(i%4)*3,x=Math.cos(angle)*dist,z=Math.sin(angle)*dist;const trunk=mesh(g,new T.CylinderGeometry(.17,.24,3.5,7),material('#625746'));trunk.position.set(x,1.7,z);for(let j=0;j<3;j++){const crown=mesh(g,new T.SphereGeometry(1.6+j*.12,12,8),material(['#687951','#75855b','#536b48'][j]));crown.position.set(x+Math.sin(i+j)*.75,3.8+j*.65,z+Math.cos(i+j)*.65);crown.scale.y=1.1;}}
 if(setting==='urban'&&!b.surroundAsset)for(let i=0;i<9;i++){
 const h=4+(i%3)*1.7,bx=(i-4)*6,m=mesh(g,new T.BoxGeometry(5,h,4),material(['#b2afa5','#a09f99','#c3baaa'][i%3]));m.position.set(bx,h/2,-24);
 const glass=material('#586c74',{metalness:.3,roughness:.24});
 for(let row=0;row<Math.floor(h/1.5);row++)for(let col=0;col<4;col++){
 const w=mesh(g,new T.BoxGeometry(.7,.85,.025),glass);w.position.set(bx-1.75+col*1.16,.9+row*1.5,-21.985);
 }
 const cornice=mesh(g,new T.BoxGeometry(5.15,.14,4.1),material('#d3cfc5'));cornice.position.set(bx,h,-24);
}
 for(const n of neighborPlacements(b)){
 const t=makeTent(120*IN,120*IN,96*IN,'classic');t.name='neighbor-'+n.side;
 t.position.set(n.x*IN,0,n.z*IN);g.add(t);
 const wall=mesh(t,new T.BoxGeometry(3,2.2,.04),material('#d6d1c5'));wall.position.set(0,1.1,-1.5);
 }
}
