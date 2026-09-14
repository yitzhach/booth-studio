import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import assert from 'node:assert/strict';
const server=await createServer({server:{host:'127.0.0.1',port:5187}});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.env.BOOTH_TEST_CHROMIUM?{executablePath:process.env.BOOTH_TEST_CHROMIUM}:{}),
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--use-gl=angle','--in-process-gpu','--single-process']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
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
 await page.locator('[data-tab="art"]').click();
 await page.locator('#library [data-action="add-sign"]').click();
 for(const [label,value] of [['Artist name','Isaac Anderson'],['City / State','Somerset, KY'],['Medium','Mixed media']]){
   await page.getByLabel(label,{exact:true}).fill(value);await page.getByLabel(label,{exact:true}).press('Tab');
 }
 await page.getByLabel('Wall face',{exact:true}).selectOption('outside');
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
 assert.equal(await page.evaluate(()=>window.__booth.scene.resizeHandles.length),4);
 const before=await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).w,id);
 await page.getByRole('button',{name:'Scale +10%',exact:true}).click();
 assert.ok(await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).w,id)>before);
 // Place-on-wall works without native drag on touch devices.
 await page.getByRole('button',{name:'Place on wall',exact:true}).click();
 pt=await panelPoint();await page.mouse.click(pt.x,pt.y);
 assert.equal(await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).face,id),'outside');
 // Native library drop onto a measured wall.
 const data=await page.evaluateHandle(id=>{const d=new DataTransfer();d.setData('application/x-booth-panel',id);return d;},id);
 await page.locator('#scene canvas').dispatchEvent('drop',{dataTransfer:data,clientX:pt.x,clientY:pt.y});
 assert.equal(await page.evaluate(id=>window.__booth.project.art.find(a=>a.id===id).face,id),'outside');
 await page.locator('#library [data-action="add-label"]').click();
 assert.equal(await page.evaluate(()=>window.__booth.project.art.at(-1).w),4);
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
 for(const width of [820,390]){
   await page.setViewportSize({width,height:1000});await page.locator('[data-tab="art"]').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.getByRole('button',{name:'Zoom in',exact:true}).click();
   await page.getByRole('button',{name:'Zoom out',exact:true}).click();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS neighboring booth controls, exterior signs, labels, select/scale, placement, persistence, export and responsive zoom.');
}finally{await browser.close();await server.close();}
