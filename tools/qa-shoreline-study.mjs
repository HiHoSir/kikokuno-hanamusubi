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
 assert.deepEqual(errors,[],'no broken assets or runtime exceptions');
 const report={result:'pass',map:first.map,coastCount:first.coastCount,
   seaCells:first.seaCells,sandCells:first.sandCells,
   animatedFrames:[...phases].sort(),tideFrames:8,
   lowTide:{reach:low.tideReach,washed:low.washedPixels},
   highTide:{reach:high.tideReach,washed:high.washedPixels},
   retreat:{reach:retreat.tideReach,wet:retreat.wetPixels},
   villageHero:true,sceneryCount:first.sceneryCount,sceneryNativeSizes:first.sceneryNativeSizes,
   rockCollision:{rockX:rock.x,heroX:beforeRock.x,heroY:beforeRock.y},
   landJoin:first.landJoin,minSandRows:first.minSandRows,
   maxSandRows:first.maxSandRows,grassCells:first.grassCells,tileAtlas:true,
   animatedTileCount:first.animatedTileCount,
   tileSheet:first.tileSheet,yBefore,yAfter:after.hero.y,
   screenshots:['artifacts/shoreline-study-initial.png',
   'artifacts/shoreline-study-water.png','artifacts/shoreline-study-grid.png',
   'artifacts/shoreline-study-low-tide.png','artifacts/shoreline-study-high-tide.png',
   'artifacts/shoreline-study-retreat.png',
   'artifacts/shoreline-study-rock-collision.png']};
 await writeFile('artifacts/shoreline-study-report.json',JSON.stringify(report,null,2));
 console.log('SHORELINE STUDY '+JSON.stringify(report));
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
