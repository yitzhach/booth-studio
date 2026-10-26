import { launchChromium } from './helpers/chromium.mjs';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5187}});
await server.listen();
const browser=await launchChromium({ args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--use-gl=angle', '--in-process-gpu', '--single-process'] });
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 // Past the first visit's welcome (src/roles.js); a workspace the suite picks later is kept.
 await page.addInitScript(() => { if (!localStorage.getItem('booth.role')) localStorage.setItem('booth.role', 'all'); });
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5187');await page.waitForFunction(()=>!!window.__booth?.scene);
 await page.locator('[data-tab="layout"]').click();
 await page.getByLabel('Surround with other booths').check();
 await page.getByLabel('Booth position').selectOption('corner-left');
 await page.getByLabel('Side spacing').fill('36');await page.getByLabel('Side spacing').press('Tab');
 await page.getByLabel('Booth behind').check();
 await page.getByLabel('Rear spacing').fill('48');await page.getByLabel('Rear spacing').press('Tab');
 assert.deepEqual(await page.evaluate(()=>{
   const s=window.__booth.scene;
   return ['left','right','rear'].map(n=>!!s.group.getObjectByName('neighbor-'+n));
 }),[false,true,true]);
 // The booth behind opens onto the next aisle, not onto this one. Before it
 // was turned around, the view over the back wall was into a stranger's stand.
 const around=await page.evaluate(()=>{
   const s=window.__booth.scene,out={};
   for(const n of ['right','rear']){
     const g=s.group.getObjectByName('neighbor-'+n);
     out[n]={rotation:g.rotation.y,z:g.position.z};
   }
   out.boothDepth=window.__booth.project.booth.depth;
   return out;
 });
 assert.ok(Math.abs(around.rear.rotation-Math.PI)<1e-6,'the booth behind faces away');
 assert.equal(around.right.rotation,0,'the one alongside shares this aisle, so it shares this facing');
 // 48in edge to edge between two booths of this depth, stated as the
 // arithmetic rather than as the number it works out to.
 assert.ok(
   Math.abs(around.rear.z*(1/0.0254)+(around.boothDepth/2+48+around.boothDepth/2))<1e-6,
   'and stands a rear gap away from a booth its own size',
 );
 await page.locator('[data-tab="art"]').click();
 await page.locator('#library [data-action="add-sign"]').click();
 for(const [label,value] of [['Artist name','Isaac Anderson'],['City / State','Somerset, KY'],['Medium','Mixed media']]){
   await page.getByLabel(label,{exact:true}).fill(value);await page.getByLabel(label,{exact:true}).press('Tab');
 }
 await page.getByLabel('Wall location',{exact:true}).selectOption('back-outside');
 await page.getByRole('button',{name:'View wall face',exact:true}).click();
 const id=await page.evaluate(()=>window.__booth.project.art.at(-1).id);
 const panelPoint=()=>page.evaluate(id=>{
   const s=window.__booth.scene,mesh=s.artObjects.find(o=>o.userData.artId===id);
   s.group.updateMatrixWorld(true);s.camera.updateMatrixWorld(true);
   const pt=mesh.getWorldPosition(s.camera.position.clone()).project(s.camera);
   const r=s.renderer.domElement.getBoundingClientRect();
   return {x:r.left+(pt.x+1)*r.width/2,y:r.top+(1-pt.y)*r.height/2};
 },id);
 let pt=await panelPoint();await page.mouse.dblclick(pt.x,pt.y);
 // Four corner handles scale proportionally, four middle-edge handles stretch.
 assert.equal(await page.evaluate(()=>window.__booth.scene.resizeHandles.length),8);
 const before=await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).w,id);
 // Scaling is the slider now; 100% is the size the controls opened at.
 await page.getByLabel('Artwork scale',{exact:true}).fill('110');
 await page.getByLabel('Artwork scale',{exact:true}).dispatchEvent('input');
 assert.ok(await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).w,id)>before,'the scale slider resizes the placement');
 // Adding a placement without native drag, which is the only route on touch:
 // clicking a library card is the affordance that replaced the old button.
 const beforeClick=await page.evaluate(()=>window.__booth.project.art.length);
 await page.locator('#library [data-source]').first().click();
 assert.equal(await page.evaluate(()=>window.__booth.project.art.length),beforeClick+1,'clicking an original adds a placement');
 assert.equal(await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).face,id),'outside','the exterior placement is untouched by it');
 pt=await panelPoint();
 // Native library drop onto a measured wall.
 const sourceKey=await page.locator('#library [data-source]').first().getAttribute('data-source');
 const beforeDrop=await page.evaluate(()=>window.__booth.project.art.length);
 const data=await page.evaluateHandle(sourceKey=>{const d=new DataTransfer();d.setData('application/x-booth-original',sourceKey);return d;},sourceKey);
 await page.locator('#scene canvas').dispatchEvent('drop',{dataTransfer:data,clientX:pt.x,clientY:pt.y});
 assert.equal(await page.evaluate(()=>window.__booth.project.art.length),beforeDrop+1);
 assert.equal(await page.evaluate(()=>window.__booth.project.art.at(-1).face),'outside');
 assert.ok(await page.locator('#library [data-source]').first().isVisible());
 await page.locator('#library [data-action="add-label"]').click();
 assert.equal(await page.evaluate(()=>window.__booth.project.art.at(-1).w),4);
 // Reusable original and non-destructive edit/copy/paste behavior.
 await page.evaluate(()=>{
   const p=window.__booth.project;
   p.assets['test-image']={name:'test.png',width:1,height:1,role:'artwork',data:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='};
   p.art[0].asset='test-image';p.art[0].title='Reusable original';
   window.__booth.mutate(()=>{});
 });
 await page.locator('#library [data-source="asset:test-image"]').click();
 const editedId=await page.evaluate(()=>window.__booth.project.art.at(-1).id);
 await page.getByRole('button',{name:'Edit image',exact:true}).click();
 await page.getByLabel('Exposure',{exact:true}).fill('0.7');
 await page.getByRole('button',{name:'Rotate 90° clockwise',exact:true}).click();
 await page.getByRole('button',{name:'Flip horizontal',exact:true}).click();
 await page.getByRole('button',{name:'Save edits',exact:true}).click();
 assert.equal(await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).edits.exposure,editedId),.7);
 assert.equal(await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).edits.rotation,editedId),90);
 await page.getByRole('button',{name:'Copy edits',exact:true}).click();
 await page.locator('#library [data-source="asset:test-image"]').click();
 const pastedId=await page.evaluate(()=>window.__booth.project.art.at(-1).id);
 assert.equal(await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).edits,id),undefined);
 await page.getByRole('button',{name:'Paste edits',exact:true}).click();
 assert.deepEqual(await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).edits,pastedId),
   await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).edits,editedId));
 assert.ok((await page.evaluate(()=>window.__booth.project.assets['test-image'].data)).startsWith('data:image/png;base64,'));
 // Clicking a blank wall deselects instead of leaving hidden handles.
 await page.evaluate(()=>{
   const s=window.__booth.scene,r=s.renderer.domElement.getBoundingClientRect();
   s.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+5,clientY:r.top+5,button:0,pointerId:1}));
   s.renderer.domElement.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:r.left+5,clientY:r.top+5,button:0,pointerId:1}));
 });
 assert.equal(await page.evaluate(()=>window.__booth.scene.selected),null);
 assert.equal(await page.evaluate(()=>window.__booth.scene.resizeHandles.length),0);
 await page.evaluate(()=>window.__booth.save());await page.reload();await page.waitForFunction(()=>!!window.__booth?.scene);
 assert.equal(await page.evaluate(()=>window.__booth.project.art.find(a=>a.kind==='sign').artistName),'Isaac Anderson');
 assert.equal(await page.evaluate(()=>window.__booth.project.booth.neighborGap),36);
 // Editor handles never leak into PNG exports.
 await page.evaluate(async()=>{const b=await window.__booth.scene.export(2048);if(!b.size)throw Error('Empty export');});
 // No sideways page scroll at any width: from 701 to 1200 px (every iPad)
 // the inspector's eight tabs once pushed the page wider, Export half off
 // the screen. The strip scrolls inside the inspector instead, and a tab
 // opened by something other than a tap is scrolled into sight.
 const exportInSight=()=>page.evaluate(()=>{
   const strip=document.querySelector('.inspector-tabs').getBoundingClientRect();
   const b=document.querySelector('.inspector-tabs [data-tab="export"]').getBoundingClientRect();
   return b.left>=strip.left-1&&b.right<=strip.right+1&&b.right<=innerWidth+1;
 });
 for(const width of [1200,1024,820,768,701,390]){
   await page.setViewportSize({width,height:1000});await page.locator('[data-tab="art"]').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`no sideways scroll at ${width} px`);
   await page.getByRole('button',{name:'Zoom in',exact:true}).click();
   await page.getByRole('button',{name:'Zoom out',exact:true}).click();
   // Opened by the toolbar's Export, not by a tap on the tab, which may be
   // scrolled out of the strip. (On a phone that button waits behind More tools.)
   await page.evaluate(()=>document.querySelector('[data-action="export-tab"]').click());
   assert.ok(await exportInSight(),`Export tab in sight at ${width} px`);
 }
 // A redraw that keeps the same tab leaves a strip scrolled by hand where it
 // was: the open tab is brought into sight only when the tab changes.
 await page.setViewportSize({width:820,height:1000});
 await page.evaluate(()=>{document.querySelector('.inspector-tabs').scrollLeft=0;document.querySelector('.inspector-tabs [data-tab="export"]').click();});
 assert.equal(await page.evaluate(()=>document.querySelector('.inspector-tabs').scrollLeft),0,'a redraw on the same tab does not move the strip');
 // A mouse wheel turned over the strip moves it sideways.
 assert.ok(await page.evaluate(()=>{const s=document.querySelector('.inspector-tabs');s.dispatchEvent(new WheelEvent('wheel',{deltaY:120,bubbles:true,cancelable:true}));return s.scrollLeft>0;}),'the wheel scrolls the strip');
 // A workspace with fewer tabs and More beside them fits too.
 await page.evaluate(()=>localStorage.setItem('booth.role','artist'));
 await page.reload();await page.waitForFunction(()=>!!window.__booth?.scene);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no sideways scroll at 820 px in the Artist workspace');
 await page.evaluate(()=>document.querySelector('[data-action="export-tab"]').click());
 assert.ok(await exportInSight(),'Export tab in sight in the Artist workspace');
 await page.setViewportSize({width:1440,height:1000});
 assert.deepEqual(errors,[]);
 console.log('PASS neighboring booths, reusable original copies, exterior signs, labels, select/scale, persistence, export and responsive zoom.');
}finally{await browser.close();await server.close();}
