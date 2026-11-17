import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';

const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8',
 '.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json','.png':'image/png','.webp':'image/webp',
 '.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const path=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(relative(root,path).startsWith('..')){res.writeHead(403);res.end();return;}
  const buffer=await readFile(path);
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});
  res.end(buffer);
 }catch{res.writeHead(404);res.end('404');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/previews/shoreline-study/';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:874,height:402},deviceScaleFactor:2,
   isMobile:true,hasTouch:true});
 const errors=[];
 // Browser-only fixture uses the actual Player save key; NO fake random reset.
 // Simulate being one finished battle away from a real replenishment.
 await page.addInitScript(()=>{
   if(sessionStorage.getItem('shoreShellQaSeeded'))return;
   localStorage.removeItem('kikokuno-hanamusubi-preview-shoreline-shells-v2');
   localStorage.setItem('kikokuno-hanamusubi-battle-player',
     JSON.stringify({lv:1,completedBattles:4,wins:3}));
   sessionStorage.setItem('shoreShellQaSeeded','1');
 });
 page.on('pageerror',e=>errors.push('JS '+e.message));
 page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:')&&r.status()>=400)
  errors.push('HTTP '+r.status()+' '+r.url());});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__SHORE_QA?.ready===true&&
    document.querySelector('#loading')?.hidden===true,null,{timeout:45000});
 const first=await page.evaluate(()=>({...window.__SHORE_QA}));
 assert.deepEqual(first.map,[30,18]);
 assert.equal(first.tileSize,32);
 assert.ok(first.coastCount>20);
 assert.equal(first.waterFrames,2);
 assert.equal(first.tideFrames,8,'shore moves independently of the open sea frames');
 assert.equal(first.surfRender,'animated-32px-atlas-chips','actual 32px map-chip sprite sheet');
 assert.ok(first.animatedTileCount>=20,'beach edge has independent animated tiles');
 assert.ok(first.animatedTileDraws>0,'map chips are drawn in viewport');
 assert.ok(first.baseTileDraws>100,'base terrain is rendered in 32px tiles');
 assert.ok(first.tileSheet[0]%32===0&&first.tileSheet[1]%32===0,
   '8-frame atlas dimensions align to native 32px source rectangles');
 assert.equal(first.characterSheet,'village-80x112','use the town-scale 80x112 Hizuki');
 assert.equal(first.shells.battles,4,'four fights is not five');
 assert.equal(first.shells.untilNextBatch,1);
 assert.equal(first.shells.visible,0,'the beach must start empty before 5 battles');
 assert.equal(first.shells.picked,0);
 assert.equal(first.shells.gold,0);
 assert.deepEqual(first.shells.atlas,[60,20],'three unscaled 20px sprites');
 assert.equal(first.shells.render,'native-20px-pixel-atlas');
 assert.equal(first.shells.savedSeparately,true);
 assert.equal(first.shells.positions.length,0);
 assert.equal(first.sceneryCount,3,'only approved rocks, not a grass border');
 assert.equal(first.sceneryRender,'unscaled-native-sprites-sorted-by-foot');
 assert.equal(first.scenery.filter(o=>o.solid).length,3);
 assert.ok(Object.values(first.sceneryNativeSizes).every(([w,h])=>
   Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w<=112&&h<=112),
   'approved native-size objects must fit within the intended character scale');
 assert.ok(first.foamPixels>0,'actual visible surf pixels');
 assert.ok(first.seaCells>100&&first.sandCells>250);
 assert.equal(first.grassCells,0,'no forced grassy strip behind the beach');
 assert.ok(first.minSandRows>=9,'at least nine full 32px sand rows inland');
 assert.ok(first.maxSandRows>=first.minSandRows);
 assert.ok(first.dryMapGenerated);
 assert.equal(first.landJoin,'sea-to-sand-16-corner-alpha-autotiles',
   'retain approved shoreline without creating a grass join');
 await page.screenshot({path:'artifacts/shoreline-study-initial.png'});
 // The approved ocean atlas has two frames, alternating every 360ms.
 let phases=new Set([first.waterFrame]);
 const screenshots=[];
 for(let i=0;i<5;i++){
  await page.waitForTimeout(175);
  const q=await page.evaluate(()=>window.__SHORE_QA);
  phases.add(q.waterFrame);
  screenshots.push(await page.locator('#scene').screenshot());
 }
 assert.deepEqual([...phases].sort(),[0,1],'water phases must both display while still');
 assert.ok(screenshots.some(b=>!b.equals(screenshots[0])),
  'actual rendered sea must visibly change while character is idle');
 await page.screenshot({path:'artifacts/shoreline-study-water.png'});
 // Review snapshots at actual low/high/receding tide phases. This proves
 // a shoreline moves OVER THE BEACH rather than swapping open-ocean colors.
 await page.waitForFunction(()=>window.__SHORE_QA?.tidePhase===0,null,{timeout:4500});
 const low=await page.evaluate(()=>({...window.__SHORE_QA}));
 await page.screenshot({path:'artifacts/shoreline-study-low-tide.png'});
 await page.waitForFunction(()=>window.__SHORE_QA?.tidePhase===4,null,{timeout:4500});
 const high=await page.evaluate(()=>({...window.__SHORE_QA}));
 await page.screenshot({path:'artifacts/shoreline-study-high-tide.png'});
 assert.ok(high.tideReach>low.tideReach,'wave front must advance on sand');
 assert.ok(high.washedPixels>low.washedPixels+300,'actual more sand covered at incoming high surf');
 assert.equal(high.animatedTileCount,low.animatedTileCount,'tile layout never changes with wave phase');
 assert.deepEqual(high.tileSheet,low.tileSheet,'atlas allocation does not change each frame');
 await page.waitForFunction(()=>window.__SHORE_QA?.tidePhase===7,null,{timeout:4500});
 const retreat=await page.evaluate(()=>({...window.__SHORE_QA}));
 assert.ok(retreat.tideReach<high.tideReach,'surf must retreat');
 assert.ok(retreat.wetPixels>0,'wet sand persists behind the wave');
 await page.screenshot({path:'artifacts/shoreline-study-retreat.png'});
 const yBefore=await page.evaluate(()=>window.__SHORE_QA.hero.y);
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(380);
 await page.keyboard.up('ArrowUp');await page.waitForTimeout(100);
 const after=await page.evaluate(()=>({...window.__SHORE_QA}));
 assert.ok(after.hero.y<yBefore-20,'direction must move the sprite on sand');
 await page.locator('#grid').click();
 await page.waitForFunction(()=>window.__SHORE_QA?.grid===true,null,{timeout:2000});
 const debug=await page.evaluate(()=>window.__SHORE_QA);
 assert.equal(debug.grid,true);
 await page.screenshot({path:'artifacts/shoreline-study-grid.png'});
 await page.locator('#reset').click();
 await page.waitForFunction(()=>window.__SHORE_QA?.hero?.x===336&&
   window.__SHORE_QA?.hero?.y===432,null,{timeout:2000});
 const reset=await page.evaluate(()=>window.__SHORE_QA.hero);
 assert.equal(reset.x,336);assert.equal(reset.y,432);
 // Hold left into the native rock footprint. The figure should stop at its
 // visible foot instead of passing through or hitting a large hidden rectangle.
 const rock=first.scenery.find(object=>object.id==='rock-west');
 assert.ok(rock&&rock.solid);
 await page.keyboard.down('ArrowLeft');
 await page.waitForTimeout(1900);
 await page.keyboard.up('ArrowLeft');
 await page.waitForTimeout(90);
 const beforeRock=await page.evaluate(()=>({...window.__SHORE_QA.hero}));
 assert.equal(beforeRock.y,reset.y,'walking left does not change row');
 assert.ok(beforeRock.x>rock.x&&beforeRock.x<rock.x+35,
   'walk stops at the 13px rock foot collision, not at a sprite-size box');
 await page.screenshot({path:'artifacts/shoreline-study-rock-collision.png'});
 // An actual completed battle increments the same field that the battle
 // engine saves. At 5 encounters a batch of 1-3 shells appears once.
 await page.evaluate(()=>{
   const k='kikokuno-hanamusubi-battle-player';
   const player=JSON.parse(localStorage.getItem(k));player.completedBattles=5;
   localStorage.setItem(k,JSON.stringify(player));
 });
 await page.waitForFunction(()=>window.__SHORE_QA?.shells?.battles===5&&
   window.__SHORE_QA.shells.visible>0,null,{timeout:3000});
 const deposited=await page.evaluate(()=>({...window.__SHORE_QA.shells}));
 assert.ok(deposited.visible>=1&&deposited.visible<=3);
 assert.equal(deposited.processedCycles,1);
 assert.equal(deposited.untilNextBatch,5);
 await page.screenshot({path:'artifacts/shoreline-study-shell-deposited.png'});
 // Pick up a real displayed shell with the exact existing movement controls.
 await page.locator('#reset').click();
 await page.waitForFunction(()=>window.__SHORE_QA?.hero?.x===336,null,{timeout:1500});
 const candidates=deposited.positions.filter(p=>p.x>195&&p.x<520);
 assert.ok(candidates.length>0,'batch contains an accessible fixed coastal pickup point');
 const target=candidates.sort((a,b)=>
   Math.hypot(a.x-336,a.y-432)-Math.hypot(b.x-336,b.y-432))[0];
 const moveAxis=async(axis,want,margin)=>{
   const current=(await page.evaluate(()=>window.__SHORE_QA.hero))[axis];
   if(Math.abs(current-want)<=margin)return;
   const direction=axis==='x'?(want>current?'ArrowRight':'ArrowLeft'):
     (want>current?'ArrowDown':'ArrowUp');
   await page.keyboard.down(direction);
   try{
     await page.waitForFunction(({axis,want,margin})=>
       Math.abs(window.__SHORE_QA.hero[axis]-want)<=margin,
       {axis,want,margin},{timeout:9500});
   }finally{await page.keyboard.up(direction);}
 };
 await moveAxis('x',target.x,12);
 await moveAxis('y',target.y,17);
 await page.waitForFunction(()=>Boolean(window.__SHORE_QA?.shells?.nearest),null,{timeout:2000});
 const beforePick=await page.evaluate(()=>({...window.__SHORE_QA.shells}));
 await page.locator('#pickup-shell').click();
 await page.waitForFunction(picked=>window.__SHORE_QA?.shells?.picked===picked+1,
   beforePick.picked,{timeout:1800});
 const afterPick=await page.evaluate(()=>({...window.__SHORE_QA.shells}));
 assert.equal(afterPick.visible,beforePick.visible-1);
 assert.ok(afterPick.worth>0,'collectible is sellable');
 assert.equal(afterPick.gold,0,'collection does not mint money');
 await page.screenshot({path:'artifacts/shoreline-study-shell-picked.png'});
 // Collection survives reload; the same shell cannot respawn or be sold twice.
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__SHORE_QA?.ready===true,null,{timeout:45000});
 const reloaded=await page.evaluate(()=>({...window.__SHORE_QA.shells}));
 assert.equal(reloaded.battles,beforePick.battles);
 assert.equal(reloaded.processedCycles,1);
 assert.equal(reloaded.picked,afterPick.picked);
 assert.equal(reloaded.visible,afterPick.visible);
 assert.equal(reloaded.worth,afterPick.worth);
 await page.locator('#sell-shells').click();
 await page.waitForFunction(()=>window.__SHORE_QA?.shells?.gold>0&&
   window.__SHORE_QA?.shells?.worth===0,null,{timeout:2000});
 const afterSale=await page.evaluate(()=>({...window.__SHORE_QA.shells}));
 assert.equal(afterSale.gold,afterPick.worth);
 assert.equal(afterSale.visible,reloaded.visible,'sold shells stay removed');
 assert.equal(await page.locator('#sell-shells').isDisabled(),true,'no double-sell');
 await page.screenshot({path:'artifacts/shoreline-study-shell-sold.png'});
 // Fights 6-9 never replenish; neither reload nor selling is a trigger.
 await page.evaluate(()=>{
   const k='kikokuno-hanamusubi-battle-player';
   const player=JSON.parse(localStorage.getItem(k));player.completedBattles=9;
   localStorage.setItem(k,JSON.stringify(player));
 });
 await page.waitForFunction(()=>window.__SHORE_QA?.shells?.battles===9,null,{timeout:3000});
 const ninth=await page.evaluate(()=>({...window.__SHORE_QA.shells}));
 assert.equal(ninth.visible,afterSale.visible);
 assert.equal(ninth.processedCycles,1);
 assert.equal(ninth.untilNextBatch,1);
 assert.equal(await page.locator('#reroll-shells').count(),0,'no manual reroll escape hatch');
 await page.evaluate(()=>{
   const k='kikokuno-hanamusubi-battle-player';
   const player=JSON.parse(localStorage.getItem(k));player.completedBattles=10;
   localStorage.setItem(k,JSON.stringify(player));
 });
 await page.waitForFunction(()=>window.__SHORE_QA?.shells?.processedCycles===2,
   null,{timeout:3000});
 const refreshed=await page.evaluate(()=>({...window.__SHORE_QA.shells}));
 assert.ok(refreshed.visible>ninth.visible);
 assert.ok(refreshed.visible-ninth.visible>=1&&refreshed.visible-ninth.visible<=3);
 assert.equal(refreshed.battles,10);
 assert.equal(refreshed.gold,afterSale.gold,'earned gold is preserved');
 await page.screenshot({path:'artifacts/shoreline-study-shell-refreshed.png'});
 assert.deepEqual(errors,[],'no broken assets or runtime exceptions');
 const report={result:'pass',map:first.map,coastCount:first.coastCount,
   seaCells:first.seaCells,sandCells:first.sandCells,
   animatedFrames:[...phases].sort(),tideFrames:8,
   lowTide:{reach:low.tideReach,washed:low.washedPixels},
   highTide:{reach:high.tideReach,washed:high.washedPixels},
   retreat:{reach:retreat.tideReach,wet:retreat.wetPixels},
   villageHero:true,shells:{
     battlesBefore:first.shells.battles,battlesAtDeposit:deposited.battles,
     batch:deposited.visible,afterPickup:afterPick.visible,
     value:afterPick.worth,reload:reloaded.picked,
     soldGold:afterSale.gold,ninthBattle:ninth.visible,
     tenthBattle:refreshed.visible
   },
   sceneryCount:first.sceneryCount,sceneryNativeSizes:first.sceneryNativeSizes,
   rockCollision:{rockX:rock.x,heroX:beforeRock.x,heroY:beforeRock.y},
   landJoin:first.landJoin,minSandRows:first.minSandRows,
   maxSandRows:first.maxSandRows,grassCells:first.grassCells,tileAtlas:true,
   animatedTileCount:first.animatedTileCount,
   tileSheet:first.tileSheet,yBefore,yAfter:after.hero.y,
   screenshots:['artifacts/shoreline-study-initial.png',
   'artifacts/shoreline-study-water.png','artifacts/shoreline-study-grid.png',
   'artifacts/shoreline-study-low-tide.png','artifacts/shoreline-study-high-tide.png',
   'artifacts/shoreline-study-retreat.png',
   'artifacts/shoreline-study-rock-collision.png',
   'artifacts/shoreline-study-shell-deposited.png',
   'artifacts/shoreline-study-shell-picked.png',
   'artifacts/shoreline-study-shell-sold.png',
   'artifacts/shoreline-study-shell-refreshed.png']};
 await writeFile('artifacts/shoreline-study-report.json',JSON.stringify(report,null,2));
 console.log('SHORELINE STUDY '+JSON.stringify(report));
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
