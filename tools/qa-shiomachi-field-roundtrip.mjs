// Live shell smoke test: cove-side field grass -> Shiomachi -> same field cell.
// Uses real UI keydown/field movement, not direct scene loading or preview routes.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';

const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8',
 '.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json','.png':'image/png','.webp':'image/webp',
 '.jpg':'image/jpeg','.ogg':'audio/ogg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const path=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(relative(root,path).startsWith('..')){res.writeHead(403);res.end();return;}
  const data=await readFile(path);
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream',
    'Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Not Found');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
await mkdir('artifacts',{recursive:true});
const origin='http://127.0.0.1:'+server.address().port;
let browser,page;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:874,height:402},deviceScaleFactor:2});
 page.setDefaultTimeout(45000);
 const failures=[];
 page.on('pageerror',e=>failures.push('JS '+e.message));
 page.on('response',r=>{
  if(r.status()>=400&&r.url().startsWith(origin))failures.push('HTTP '+r.status()+' '+r.url());
 });
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
  sessionStorage.setItem('kikokuno-hanamusubi-next-entry',JSON.stringify({
   route:'/src/game/',expiresAt:Date.now()+120000}));
 });
 await page.goto(origin+'/src/game/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(window.KIKOKU_GAME?.navigate));
 // QA-only starting checkpoint. It is known walkable grass WEST of (53,51)
 // and must not become a fabricated permanent game spawn.
 await page.evaluate(()=>{
  const [x,y]=[52*32+16,51*32+16];
  sessionStorage.setItem('kikokuno-hanamusubi-restore-position',JSON.stringify({
   scene:'field',position:{x,y,row:2}}));
  window.KIKOKU_GAME.navigate(new URL('/src/field/?from=cove',location.href).href);
 });
 await page.waitForFunction(()=>{
  const f=document.querySelector('iframe')?.contentWindow;
  return Boolean(f?.YK_WORLD&&f.document?.querySelector('#load')?.hidden===true&&
    f.document.querySelector('#scene')?.dataset.x==='52');
 });
 const field=page.frames().find(f=>f.url().includes('/src/field/'));
 assert.ok(field,'authorized field must be in the persistent game shell');
 const before=await field.evaluate(()=>{
  const w=window.YK_WORLD,t=window.YK_AREA_TRANSITIONS;
  const a=[52*32+16,51*32+16],b=[53*32+16,51*32+16];
  const villageArt=Object.fromEntries(['village','shiomachi'].map(id=>{
   const {kind,width,height}=w.mapData.decorations.find(o=>o.destination===id);
   return [id,{asset:window.YK_FIELD_ASSETS.landscape[kind],width,height}];
  }));
  return {cove:w.places.cove.point,shiomachi:w.places.shiomachi.point,
   surface:w.tileAt(...b),walkable:w.canMove(...a,...b),
   contact:t.contact(w,...b),priorContact:t.contact(w,...a),
   adjacentContact:t.contact(w,54*32+16,51*32+16),villageArt};
 });
 assert.equal(before.contact,'shiomachi');
 assert.equal(before.priorContact,null);
 assert.equal(before.surface,'grass');
 assert.equal(before.walkable,true);
 assert.equal(before.adjacentContact,null,'only the existing cell opens the village');
 assert.deepEqual(before.villageArt.shiomachi,before.villageArt.village);
 assert.deepEqual(before.villageArt.shiomachi,{
  asset:'assets/field/objects/village.png',width:64,height:32});
 await page.screenshot({path:'artifacts/shiomachi-field-village-marker.png'});
 await field.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',
  {key:'ArrowRight',bubbles:true})));
 await page.waitForFunction(()=>{
  const f=document.querySelector('iframe')?.contentWindow;
  return Boolean(f?.__SHIOMACHI_QA?.ready&&
   f.location.pathname==='/src/game/shiomachi/');
 });
 const embedded=page.frames().find(f=>f.url().includes('/src/game/shiomachi/'));
 assert.ok(embedded,'official village is a valid embedded route');
 const found=await embedded.evaluate(()=>({
  previewOnly:window.__SHIOMACHI_QA.previewOnly,
  state:window.__SHIOMACHI_QA.position(),
  loadHidden:document.querySelector('#load').hidden,
  reviewMenu:document.querySelector('.review-tools')?.hidden??true,
  signs:window.__SHIOMACHI_QA.renderer.visibleSigns,
  objects:window.__SHIOMACHI_QA.renderer.buildings,
  shopText:document.querySelector('#shop-panel')?.getAttribute('aria-label'),
  scrollWidth:document.documentElement.scrollWidth,screenWidth:innerWidth,
  snapshot:window.KIKOKU_SAVE_SNAPSHOT?.()
 }));
 assert.equal(found.previewOnly,false);
 assert.equal(found.loadHidden,true);
 assert.equal(found.reviewMenu,true);
 assert.equal(found.objects,4);
 assert.equal(found.signs,3);
 assert.equal(found.snapshot.scene,'shiomachi');
 assert.ok(found.scrollWidth<=found.screenWidth+1);
 await page.screenshot({path:'artifacts/shiomachi-field-connected.png'});
 const save=await page.evaluate(()=>window.KIKOKU_GAME.manualSave());
 assert.equal(save.accepted,true);
 assert.equal(save.save.location.scene,'shiomachi');
 await embedded.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',
  {key:'ArrowDown',bubbles:true})));
 await page.waitForFunction(()=>{
  const f=document.querySelector('iframe')?.contentWindow;
  return Boolean(f?.YK_WORLD&&f.location.pathname==='/src/field/'&&
   new URL(f.location.href).searchParams.get('from')==='shiomachi'&&
   f.document.querySelector('#load')?.hidden===true);
 },null,{timeout:45000});
 const after=await page.frames().find(f=>f.url().includes('/src/field/')).evaluate(()=>{
  const scene=document.querySelector('#scene');
  return {x:Number(scene.dataset.x),y:Number(scene.dataset.y),
   contact:window.YK_AREA_TRANSITIONS.contact(window.YK_WORLD,
      Number(scene.dataset.x)*32+16,Number(scene.dataset.y)*32+16)};
 });
 assert.deepEqual(after,{x:52,y:51,contact:null});
 // Check demo goods AFTER completing the main roundtrip, so the shop's
 // deliberately non-warping doorway does not move our south-exit test spawn.
 const returnedField=page.frames().find(f=>f.url().includes('/src/field/'));
 await returnedField.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',
  {key:'ArrowRight',bubbles:true})));
 await page.waitForFunction(()=>{
   const f=document.querySelector('iframe')?.contentWindow;
   return Boolean(f?.__SHIOMACHI_QA?.ready&&
     f.location.pathname==='/src/game/shiomachi/');
 });
 const villageAgain=page.frames().find(f=>f.url().includes('/src/game/shiomachi/'));
 const demo=await villageAgain.evaluate(()=>{
  const qa=window.__SHIOMACHI_QA;
  if(!qa.enterRoom('armory')||!qa.openService())return {entered:false};
  const first=document.querySelector('[data-shop-item="shiomachi-tide-blade"]');
  first?.click();
  const item=qa.trial().shiomachiGear['shiomachi-tide-blade'];
  const note=document.querySelector('#shop-title')?.textContent;
  qa.exitRoom();
  return {entered:true,item,note};
 });
 assert.equal(demo.entered,true);
 assert.equal(demo.item,1);
 assert.match(demo.note,/試用・セーブには反映しません/);
 const persisted=await page.evaluate(()=>{
  const r=JSON.parse(localStorage.getItem('kikokuno-hanamusubi-manual-save'));
  const hero=JSON.parse(localStorage.getItem('kikokuno-hanamusubi-battle-player')||'null');
  return {manualScene:r.location.scene,
    gameHasDemoGear:Boolean(hero?.equipmentInventory?.['shiomachi-tide-blade']),
    gameGold:hero?.gold??0};
 });
 assert.deepEqual(persisted,{manualScene:'shiomachi',gameHasDemoGear:false,gameGold:0});

 // Place the hero on ordinary ground near each fence, then hold an actual
 // movement input far enough to cross the map edge if the fence were absent.
 const villageAt=async(scene,x,y)=>{
  const path='/src/game/'+scene+'/';
  await page.evaluate(({scene,x,y,path})=>{
   sessionStorage.setItem('kikokuno-hanamusubi-restore-position',JSON.stringify({
    scene,position:{x,y,face:0}}));
   window.KIKOKU_GAME.navigate(new URL(path+'?qa-boundary='+x,location.href).href);
  },{scene,x,y,path});
  await page.waitForFunction(({path,x,y})=>{
   const f=document.querySelector('iframe')?.contentWindow;
   if(f?.location.pathname!==path||!f.document.querySelector('#load')?.hidden)return false;
   const position=f.KIKOKU_SAVE_SNAPSHOT?.()?.position;
   return position?.x===x&&position.y===y;
  },{path,x,y});
  return page.frames().find(f=>new URL(f.url()).pathname===path);
 };
 const towardSouth=(frame,type)=>frame.evaluate(type=>
  window.dispatchEvent(new KeyboardEvent(type,{key:'ArrowDown',bubbles:true})),type);
 for(const [scene,x,y,fenceLine] of [
  ['shiomachi',536,1660,1712],['village',1008,2160,2224]
 ]){
  const village=await villageAt(scene,x,y);
  await towardSouth(village,'keydown');
  await village.waitForFunction(line=>window.KIKOKU_SAVE_SNAPSHOT().position.y>line-20,fenceLine);
  await page.waitForTimeout(400);
  await towardSouth(village,'keyup');
  const stopped=await village.evaluate(()=>window.KIKOKU_SAVE_SNAPSHOT().position);
  assert.ok(stopped.y<fenceLine,scene+' fence stops the hero before leaving the map');
  assert.equal(stopped.x,x);
 }
 const hozuki=await villageAt('village',1140,2172);
 await page.screenshot({path:'artifacts/hozuki-south-exit.png'});
 await towardSouth(hozuki,'keydown');
 await page.waitForFunction(()=>{
  const f=document.querySelector('iframe')?.contentWindow;
  return f?.location.pathname==='/src/field/'&&
   new URL(f.location.href).searchParams.get('from')==='village'&&
   f.document.querySelector('#load')?.hidden===true;
 });
 const hozukiField=page.frames().find(f=>f.url().includes('/src/field/'));
 assert.equal(await hozukiField.evaluate(()=>{
  const {x,y}=document.querySelector('#scene').dataset;
  return window.YK_AREA_TRANSITIONS.contact(window.YK_WORLD,Number(x)*32+16,Number(y)*32+16);
 }),null,'Hozuki field arrival does not immediately re-enter the village');

 assert.deepEqual(failures,[]);
 console.log('SHIOMACHI_FIELD_ROUNDTRIP '+JSON.stringify({before,found,demo,persisted,
   returned:after,errors:failures}));
}finally{
 if(page)await page.close();
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
