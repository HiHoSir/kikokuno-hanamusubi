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
   rightContact:t.contact(w,54*32+16,51*32+16),
   adjacentContact:t.contact(w,55*32+16,51*32+16),villageArt};
 });
 assert.equal(before.contact,'shiomachi');
 assert.equal(before.priorContact,null);
 assert.equal(before.surface,'grass');
 assert.equal(before.walkable,true);
 assert.equal(before.rightContact,'shiomachi','the right half opens the village');
 assert.equal(before.adjacentContact,null,'the cell beyond the art does not open the village');
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
 // Verify the armory after the roundtrip so the shop test cannot move our exit spawn.
 await page.evaluate(async()=>{
   const {DEFAULT_PLAYER,savePlayer}=await import('./battle/rules.mjs');
   savePlayer({...DEFAULT_PLAYER,gold:208,shells:{bag:{white:2,spiral:1}}});
 });
 const returnedField=page.frames().find(f=>f.url().includes('/src/field/'));
 await returnedField.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',
  {key:'ArrowRight',bubbles:true})));
 await page.waitForFunction(()=>{
   const f=document.querySelector('iframe')?.contentWindow;
   return Boolean(f?.__SHIOMACHI_QA?.ready&&
     f.location.pathname==='/src/game/shiomachi/');
 });
 const villageAgain=page.frames().find(f=>f.url().includes('/src/game/shiomachi/'));
 const openStore=async room=>{
   assert.equal(await villageAgain.evaluate(room=>window.__SHIOMACHI_QA.enterRoom(room),room),true);
   const clerk=await villageAgain.evaluate(()=>window.__SHIOMACHI_QA.indoorResident());
   const walkUp=type=>villageAgain.evaluate(type=>
     window.dispatchEvent(new KeyboardEvent(type,{key:'ArrowUp',bubbles:true})),type);
   await walkUp('keydown');
   await villageAgain.waitForFunction(y=>window.__SHIOMACHI_QA.indoorPosition()?.y<=y,clerk.talkPoint[1]+42);
   await walkUp('keyup');
   await villageAgain.locator('#action-a').click();
   await villageAgain.locator('#next.hasLastLine').click();
   await villageAgain.locator('#shop-panel').waitFor({state:'visible'});
 };
 await openStore('armory');
 assert.match(await villageAgain.locator('#shop-wallet').textContent(),/^所持金 208両$/);
 const prices=await villageAgain.locator('#shop-options button').allTextContents();
 assert.deepEqual(prices.slice(0,4).map(text=>Number(text.match(/(\d+)両/)[1])),[80,64,40,24]);
 const blade=villageAgain.locator('[data-shop-item="shiomachi-tide-blade"]');
 await blade.click();
 assert.match(await villageAgain.locator('#shop-message').textContent(),/装備/);
 await blade.click();
 assert.match(await villageAgain.locator('#shop-message').textContent(),/もう持っています/);
 assert.match(await villageAgain.locator('#shop-wallet').textContent(),/^所持金 128両$/);
 await villageAgain.locator('[data-shop-item="shiomachi-tide-armor"]').click();
 await villageAgain.locator('#action-b').click();
 const player=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('kikokuno-hanamusubi-battle-player')));
 const purchased=await player();
 assert.equal(purchased.gold,64);
 assert.equal(purchased.equipmentInventory['shiomachi-tide-blade'],1);
 assert.equal(purchased.equipmentInventory['shiomachi-tide-armor'],1);
 assert.equal(purchased.equipment.weapon,'starter-weapon');
 assert.equal(purchased.equipment.body,'starter-body');
 assert.equal(await villageAgain.evaluate(()=>window.__SHIOMACHI_QA.trial().gold),250);

 await page.locator('#field-menu-toggle').click();
 await page.locator('[data-menu-command="items"]').click();
 await page.locator('#field-menu-detail button').filter({hasText:'潮切りの太刀'}).click();
 assert.match(await page.locator('.equipment-stat-preview').innerText(),/攻撃 9 → 21/);
 await page.locator('#field-menu-action-a').click();
 await page.locator('[data-equipment-slot="body"]').click();
 assert.match(await page.locator('.equipment-stat-preview').innerText(),/守備 6 → 16/);
 await page.locator('#field-menu-action-a').click();
 const savedGear=await page.evaluate(()=>window.KIKOKU_GAME.manualSave());
 assert.equal(savedGear.accepted,true);
 assert.equal(savedGear.save.location.scene,'shiomachi');
 const equipped=savedGear.save.player;
 assert.equal(equipped.equipmentTier,'T0');
 assert.equal(equipped.attack,21);
 assert.equal(equipped.defense,16);
 assert.equal(equipped.equipment.weapon,'shiomachi-tide-blade');
 assert.equal(equipped.equipment.body,'shiomachi-tide-armor');
 assert.deepEqual((await player()).equipment,equipped.equipment);
 await page.locator('#field-menu-toggle').click();
 await villageAgain.evaluate(()=>window.__SHIOMACHI_QA.exitRoom());

 await openStore('teahouse');
 const sell=villageAgain.locator('[data-shop-item="sell-shells"]');
 assert.match(await sell.textContent(),/3個（13両）/);
 await sell.click();
 assert.equal((await player()).gold,77);
 assert.deepEqual((await player()).shells.bag,{sakura:0,spiral:0,white:0});
 await sell.click();
 assert.equal((await player()).gold,77,'an empty bag cannot be sold twice');
 await villageAgain.locator('[data-shop-item="onigiri"]').click();
 assert.equal((await player()).gold,69);
 assert.equal((await player()).foods.onigiri,1);
 await villageAgain.evaluate(()=>window.__SHIOMACHI_QA.exitRoom());

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

 // Real movement from just south of each painted entrance tile.
 for(const [x,y,destination] of [[37,70,'village'],[38,70,'village'],[54,52,'shiomachi']]){
  await page.evaluate(({x,y})=>{
   sessionStorage.setItem('kikokuno-hanamusubi-restore-position',JSON.stringify({
    scene:'field',position:{x:x*32+16,y:y*32+16,row:1}}));
   window.KIKOKU_GAME.navigate(new URL('/src/field/?qa-entrance='+x,location.href));
  },{x,y});
  await page.waitForFunction(({x,y})=>{
   const f=document.querySelector('#game-scene')?.contentWindow;
   const p=f?.KIKOKU_SAVE_SNAPSHOT?.();
   return f?.location.pathname==='/src/field/'&&
    new URL(f.location.href).searchParams.get('qa-entrance')===String(x)&&
    p?.scene==='field'&&p.position.x===x*32+16&&p.position.y===y*32+16;
  },{x,y});
  await page.evaluate(()=>{
   const field=document.querySelector('#game-scene').contentWindow;
   field.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
  });
  await page.waitForFunction(destination=>{
   const f=document.querySelector('#game-scene')?.contentWindow;
   return f?.KIKOKU_SAVE_SNAPSHOT?.()?.scene===destination;
  },destination);
 }

 // Use field checkpoints, then walk all three cave maps with real input.
 const snapshotAt=async(scene,position,path)=>{
  await page.evaluate(({scene,position,path})=>{
   sessionStorage.setItem('kikokuno-hanamusubi-restore-position',JSON.stringify({scene,position}));
   window.KIKOKU_GAME.navigate(new URL(path,location.href));
  },{scene,position,path});
  await page.waitForFunction(({scene,position,path})=>{
   const f=document.querySelector('#game-scene')?.contentWindow;
   if(!f||f.location.pathname+f.location.search!==path)return false;
   const snapshot=f.KIKOKU_SAVE_SNAPSHOT?.();
   return snapshot?.scene===scene&&snapshot.position.x===position.x&&snapshot.position.y===position.y;
  },{scene,position,path});
  return page.frames().find(frame=>frame.url().endsWith(path));
 };
 const fieldCheckpoint=(x,y,row,tag)=>snapshotAt('field',{x:x*32+16,y:y*32+16,row},'/src/field/?qa-cave='+tag);
 const nearRock=await fieldCheckpoint(48,44,1,'locked');
 await nearRock.locator('#action-a').click();
 assert.match(await nearRock.locator('#field-notice').textContent(),/砕く道具/);
 assert.equal(await nearRock.evaluate(()=>window.YK_WORLD.mapData.occupiedTiles.has('48,43')),true);
 await page.screenshot({path:'artifacts/cave-bridge-blocked.png'});

 const outside=await fieldCheckpoint(15,47,0,'entrance');
 await outside.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})));
 await page.waitForFunction(()=>{
  const f=document.querySelector('#game-scene')?.contentWindow;
  return f?.KIKOKU_SAVE_SNAPSHOT?.()?.scene==='cave'&&f.document.querySelector('#load').hidden;
 });
 const cave=page.frameLocator('#game-scene');
 const caveButton=cave.locator('#action-a');
 const caveFloor=number=>cave.locator('#scene[data-floor="'+number+'"]').waitFor();
 const climbWithPad=async floor=>{
  const pad=await cave.locator('#up').boundingBox();
  assert.ok(pad,'cave up button must be visible');
  await page.mouse.move(pad.x+pad.width/2,pad.y+pad.height/2);
  await page.mouse.down();
  try{await cave.locator('#scene[data-floor="'+floor+'"]').waitFor({timeout:3500});}
  finally{await page.mouse.up();}
 };
 const caveBattleReturn=async()=>{
  const battle=page.frameLocator('#game-scene');
  await battle.locator('#encounter[hidden]').waitFor({state:'attached',timeout:5000});
  assert.equal(await battle.locator('main').getAttribute('data-battle-terrain'),'cave');
  assert.notEqual(await battle.locator('#enemy-label').textContent(),'岩守の鬼');
  for(let turn=0;turn<8&&!await battle.locator('[data-command="return"]').count();turn++){
   await battle.locator('[data-command="attack"]').click();
   const target=battle.locator('[data-command="target-0"]:enabled,[data-command="target-1"]:enabled').first();
   if(await target.count())await target.click();
   await page.waitForFunction(()=>{
    const doc=document.querySelector('#game-scene')?.contentDocument;
    return Boolean(doc?.querySelector('[data-command="attack"]:not(:disabled),[data-command="return"]'));
   });
  }
  assert.match(await battle.locator('[data-command="return"]').textContent(),/洞窟/);
  await battle.locator('[data-command="return"]').click();
  await page.waitForFunction(()=>{
   const frame=document.querySelector('#game-scene')?.contentWindow;
   return frame?.location.search.includes('from=encounter')&&frame.KIKOKU_SAVE_SNAPSHOT?.()?.scene==='cave';
  });
 };
 let caveEncounters=0;
 const walkCave=async waypoints=>{
  for(const [col,row] of waypoints){
   const target=[col*48+24,row*48+24];
   let reached=false;
   for(let retry=0;retry<5&&reached!==true;retry++){
    const frame=page.frames().find(frame=>frame.url().includes('/src/game/cave/'));
    try{
     reached=await frame.evaluate(target=>new Promise(resolve=>{
      const {position}=window.KIKOKU_SAVE_SNAPSHOT();
      const values=[position.x,position.y];
      const axis=Math.abs(values[0]-target[0])>12?0:1;
      if(Math.abs(values[axis]-target[axis])<=5){resolve(true);return;}
      const sign=Math.sign(target[axis]-values[axis]);
      const key=axis===0?(sign>0?'ArrowRight':'ArrowLeft'):(sign>0?'ArrowDown':'ArrowUp');
      const deadline=performance.now()+5500;
      window.dispatchEvent(new KeyboardEvent('keydown',{key}));
      function check(now){
       const {position}=window.KIKOKU_SAVE_SNAPSHOT();
       const current=axis===0?position.x:position.y;
       const arrived=sign*(target[axis]-current)<=5;
       if(arrived||now>deadline){
        window.dispatchEvent(new KeyboardEvent('keyup',{key}));
        resolve(arrived?true:position);
       }else requestAnimationFrame(check);
      }
      requestAnimationFrame(check);
     }),target);
    }catch(error){
     if(!/context was destroyed|frame was detached/i.test(String(error)))throw error;
     await caveBattleReturn();
     caveEncounters++;
    }
    if(reached!==false)break;
   }
   assert.equal(reached,true,'cave route blocked before '+[col,row]+': '+JSON.stringify(reached));
  }
 };
 const takeCaveCache=async(id,name)=>{
  await caveButton.click();
  assert.match(await cave.locator('#notice').textContent(),new RegExp(name));
  assert.ok((await player()).foundItems.includes(id));
  await caveButton.click();
  assert.equal((await player()).foundItems.filter(item=>item===id).length,1);
 };
 await page.evaluate(async()=>{
  const {readPlayer,savePlayer}=await import('./battle/rules.mjs');
  savePlayer({...readPlayer(),lv:5,hp:58});
 });
 await walkCave([[9,4],[8,4],[8,3]]);
 await takeCaveCache('cave-entry-shelf','薬草');
 await walkCave([[8,6],[18,6],[18,7],[21,7]]);
 await page.screenshot({path:'artifacts/cave-first-floor.png'});
 await climbWithPad(2);
 // Both walking onto the stair and pressing A at its foot work.
 await caveButton.click();
 await caveFloor(1);
 await climbWithPad(2);
 await walkCave([[6,18],[6,14],[20,14],[20,8],[24,8]]);
 await page.screenshot({path:'artifacts/cave-second-floor.png'});
 await climbWithPad(3);

 await page.evaluate(async()=>{
  const {readPlayer,savePlayer}=await import('./battle/rules.mjs');
  savePlayer({...readPlayer(),lv:5,hp:58});
 });
 await walkCave([[17,18],[17,16],[19,16],[19,14],[15,14],[15,11],[9,11],[9,12]]);
 await takeCaveCache('cave-guardian-alcove','おにぎり');
 await walkCave([[9,11],[11,11],[11,7]]);
 await page.screenshot({path:'artifacts/cave-deepest-floor.png'});
 await caveButton.click();
 const battle=page.frameLocator('#game-scene');
 await battle.locator('#encounter[hidden]').waitFor({state:'attached'});
 assert.equal(await battle.locator('#enemy-label').textContent(),'岩守の鬼');
 for(let turn=0;turn<8&&!await battle.locator('[data-command="return"]').count();turn++){
  await battle.locator('[data-command="attack"]').click();
  await page.waitForFunction(()=>{
   const doc=document.querySelector('#game-scene')?.contentDocument;
   return Boolean(doc?.querySelector('[data-command="attack"]:not(:disabled),[data-command="return"]'));
  });
 }
 assert.match(await battle.locator('#battle-message').textContent(),/岩砕きの槌/);
 await battle.locator('[data-command="return"]').click();
 await page.waitForFunction(()=>document.querySelector('#game-scene')?.contentWindow
   ?.KIKOKU_SAVE_SNAPSHOT?.()?.position.floor===2);
 assert.equal((await player()).caveQuest.rockBreaker,true);

 await climbWithPad(2);
 await walkCave([[20,8],[20,5],[17,5],[17,4],[15,4],[15,3],[9,3]]);
 // Enter the cache's facing direction after approaching from the east.
 await walkCave([[9,4],[9,3]]);
 await takeCaveCache('cave-upper-passage','団子');
 await walkCave([[6,3],[6,18],[7,18]]);
 await climbWithPad(1);
 await walkCave([[18,7],[18,6],[9,6],[9,13]]);
 assert.ok(caveEncounters>=1);
 await page.frames().find(frame=>frame.url().includes('/src/game/cave/')).evaluate(()=>{
  window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown'}));
 });
 await page.waitForFunction(()=>document.querySelector('#game-scene')?.contentWindow
   ?.KIKOKU_SAVE_SNAPSHOT?.()?.scene==='field');

 const unlock=await fieldCheckpoint(48,44,1,'unlock');
 await unlock.locator('#action-a').click();
 assert.match(await unlock.locator('#field-notice').textContent(),/橋を渡れる/);
 assert.equal(await unlock.evaluate(()=>window.YK_WORLD.mapData.occupiedTiles.has('48,43')),false);
 const reloaded=await fieldCheckpoint(48,44,1,'reloaded');
 await reloaded.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true})));
 await reloaded.waitForFunction(()=>Number(document.querySelector('#scene').dataset.y)<=43);
 assert.deepEqual((await player()).caveQuest,{rockBreaker:true,bridgeCleared:true});
 assert.deepEqual(failures,[]);
 console.log('SHIOMACHI_FIELD_ROUNDTRIP '+JSON.stringify({before,found,purchasedGold:purchased.gold,equipped:equipped.equipment,
   returned:after,errors:failures}));
}finally{
 if(page)await page.close();
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
