import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {extname,resolve,relative} from 'node:path';
import {chromium} from 'playwright';

const root=resolve('.');
const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
   const url=new URL(req.url,'http://localhost');
   const path=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
   if(relative(root,path).startsWith('..'))throw new Error('outside repository');
   const bytes=await readFile(path);
   res.writeHead(200,{'content-type':types[extname(path)]??'application/octet-stream'});
   res.end(bytes);
 }catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;

let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:874,height:402},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{
   if(response.url().startsWith(origin)&&response.status()>=400)errors.push(response.url());
 });
 await mkdir('artifacts',{recursive:true});
 const residents=()=>page.evaluate(()=>window.__VILLAGE_PREVIEW_QA.residents());
 const storage=()=>page.evaluate(()=>[JSON.stringify(localStorage),JSON.stringify(sessionStorage)]);
 const pressUntil=async(key,axis,relation,target)=>{
   await page.keyboard.down(key);
   try{
     await page.waitForFunction(({axis,relation,target})=>{
       const current=Number(document.querySelector('#scene').dataset[axis]);
       return relation==='max'?current<=target:current>=target;
     },{axis,relation,target},{timeout:5000});
   }finally{await page.keyboard.up(key);}
 };
 const enter=async room=>{
   await page.keyboard.down('ArrowUp');
   try{
     await page.waitForFunction(room=>document.querySelector('#scene').dataset.room===room,room,{timeout:5000});
   }finally{await page.keyboard.up('ArrowUp');}
 };
 const leave=async(x,y)=>{
   await page.keyboard.down('ArrowDown');
   try{
     await page.waitForFunction(({x,y})=>{
       const scene=document.querySelector('#scene');
       return scene.dataset.room===''&&Number(scene.dataset.x)===x&&Number(scene.dataset.y)===y;
     },{x,y},{timeout:5000});
   }finally{await page.keyboard.up('ArrowDown');}
 };
 for(const map of [
   {id:'forest',name:'梢音村',lane:866,inn:1390,returnY:724,house:438,houseRoom:'house-craft',houseY:725,
     north:{building:'herb-home',room:'house-farm',x:940,returnY:519,startY:1015}},
   {id:'mountain',name:'月嶺村',lane:840,inn:573,returnY:777,house:1461,houseRoom:'house-family',houseY:771,
     north:{building:'bath-hut',room:'house-craft',x:1056,returnY:512,startY:1046}}
 ]){
   await page.goto(origin+'/previews/villages/?village='+map.id);
   await page.locator('#load').waitFor({state:'hidden',timeout:7000});
   assert.match(await page.locator('#village-name').textContent(),new RegExp(map.name));
   const before=await storage();
   await page.screenshot({path:'artifacts/village-'+map.id+'-arrival.png'});
   const frame=await page.locator('#scene').boundingBox();
   assert.deepEqual(frame,{x:0,y:0,width:874,height:402});
   const pad=await page.locator('#action-a').boundingBox();
   assert.ok(pad.x>740&&pad.y>230&&pad.y+pad.height<=402);
   const initialPatrol=await residents();
   assert.equal(initialPatrol.length,4);
   await page.waitForFunction(initial=>window.__VILLAGE_PREVIEW_QA.residents()
     .every((npc,i)=>Math.hypot(npc.x-initial[i].x,npc.y-initial[i].y)>6),initialPatrol,{timeout:4000});
   await enter(map.north.room);
   assert.equal(await page.locator('#scene').getAttribute('data-building'),map.north.building);
   await leave(map.north.x,map.north.returnY);
   await pressUntil('ArrowDown','y','min',map.north.startY);
   if(map.id==='forest'){
     await pressUntil('ArrowLeft','x','max',742);
     await pressUntil('ArrowUp','y','max',1000);
     await page.locator('#action-a').tap();
     assert.equal(await page.locator('#speaker').textContent(),'薬草摘み');
     const stopped=await residents();
     await page.locator('#next.hasNextLine').waitFor({state:'visible'});
     assert.match(await page.locator('#line').textContent(),/薬草/);
     assert.deepEqual(await residents(),stopped,'NPCs stop moving during conversation');
     assert.ok([0,2].includes(stopped.find(npc=>npc.id==='gatherer').face));

     await page.locator('#next').tap();
     await page.locator('#next').tap();
     await page.locator('#next').tap();
     await page.waitForFunction(stopped=>window.__VILLAGE_PREVIEW_QA.residents()
       .some((npc,i)=>Math.hypot(npc.x-stopped[i].x,npc.y-stopped[i].y)>6),stopped,{timeout:4000});
     await pressUntil('ArrowRight','x','min',940);
   }
   await pressUntil('ArrowUp','y','max',map.lane);
   await pressUntil(map.id==='forest'?'ArrowRight':'ArrowLeft','x',map.id==='forest'?'min':'max',map.inn);
   await enter('inn');
   await pressUntil('ArrowLeft','x','max',207);
   await pressUntil('ArrowUp','y','max',586);
   await page.locator('#action-a').tap();
   await page.locator('#next').tap();
   await page.locator('#next').tap();
   await page.locator('#shop-panel').waitFor({state:'visible',timeout:4000});
   assert.match(await page.locator('#shop-title').textContent(),/試用/);
   await page.locator('[data-shop-item="sleep"]').tap();
   assert.match(await page.locator('#shop-message').textContent(),/体力と術力が回復/);
   assert.match(await page.locator('#shop-wallet').textContent(),/230両/);
   await page.locator('#action-b').tap();
   await pressUntil('ArrowRight','x','min',416);
   await leave(map.inn,map.returnY);
   await pressUntil('ArrowDown','y','min',map.id==='forest'?906:866);
   await pressUntil(map.id==='forest'?'ArrowLeft':'ArrowRight','x',map.id==='forest'?'max':'min',map.house);
   await enter(map.houseRoom);
   await leave(map.house,map.houseY);
   if(map.id==='mountain'){
     await pressUntil('ArrowDown','y','min',860);
     await pressUntil('ArrowRight','x','min',1710);
     await enter('armory');
     assert.equal(await page.locator('#scene').getAttribute('data-building'),'mountain-armory');
     await pressUntil('ArrowUp','y','max',430);
     await page.locator('#action-a').tap();
     await page.locator('#next.hasLastLine').waitFor({state:'visible'});
     await page.locator('#next').tap();
     await page.locator('#shop-panel').waitFor({state:'visible'});
     assert.match(await page.locator('#shop-title').textContent(),/月嶺の兵具屋.*試用/);
     assert.match(await page.locator('#shop-wallet').textContent(),/230両/);
     const item=page.locator('[data-shop-item="shiomachi-tide-blade"]');
     await page.screenshot({path:'artifacts/village-mountain-armory.png'});
     await item.tap();
     assert.match(await item.textContent(),/購入済/);
     assert.match(await page.locator('#shop-message').textContent(),/買いました/);
     assert.match(await page.locator('#shop-wallet').textContent(),/150両/);
     await item.tap();
     assert.match(await page.locator('#shop-message').textContent(),/もう持っています/);
     assert.match(await page.locator('#shop-wallet').textContent(),/150両/);
     await page.locator('#action-b').tap();
     await leave(1710,549);
   }
   assert.deepEqual(await storage(),before);
 }
 await page.locator('[data-village="forest"]').tap();
 await page.locator('#load').waitFor({state:'hidden'});
 assert.match(await page.locator('#village-name').textContent(),/梢音村/);
 await page.setViewportSize({width:402,height:874});
 await page.locator('#landscape-required').waitFor({state:'visible'});
 await page.setViewportSize({width:480,height:272});
 await page.locator('#landscape-required').waitFor({state:'hidden'});
 const compact=await page.locator('#scene').boundingBox();
 assert.deepEqual(compact,{x:0,y:0,width:480,height:272});
 await page.screenshot({path:'artifacts/village-forest-480x272.png'});
 assert.deepEqual(errors,[]);
}finally{
 await browser?.close();
 await new Promise(done=>server.close(done));
}
