// Production-only browser QA: title admission -> shell -> cove, using real
// local assets and actual canvas frames, not a fabricated screenshot.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';

const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8',
 '.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json','.png':'image/png','.webp':'image/webp',
 '.ogg':'audio/ogg','.mp4':'video/mp4','.m4a':'audio/mp4','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
   const url=new URL(req.url,'http://localhost');
   const target=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
   if(relative(root,target).startsWith('..')){res.writeHead(403);res.end();return;}
   const bytes=await readFile(target);
   res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'});
   res.end(bytes);
 }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:874,height:402},deviceScaleFactor:2});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{
   if(response.status()>=400&&response.url().startsWith('http://127.0.0.1:'))
     errors.push('HTTP '+response.status()+' '+response.url());
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
   window.KIKOKU_ROUTE.go(new URL('src/game/?build=save-slots-1-sea-cove-1',document.baseURI));
 });
 await page.waitForURL(url=>url.pathname.endsWith('/src/game/'),{timeout:15000});
 await page.waitForFunction(()=>Boolean(window.KIKOKU_GAME),null,{timeout:15000});
 // Simulate a fifth completed battle using the actual official player model.
 // The domain test separately proves wins, losses and escape all increment it.
 await page.evaluate(async()=>{
   const rules=await import('./battle/rules.mjs');
   const before=rules.savePlayer({...rules.DEFAULT_PLAYER,completedBattles:4,wins:3});
   rules.savePlayer({...before,completedBattles:5});
 });
 await page.evaluate(()=>window.KIKOKU_GAME.navigate(new URL('./cove/',location.href)));
 await page.waitForFunction(()=>{
   const child=document.querySelector('#game-scene')?.contentWindow;
   try{
     return child?.location.pathname.endsWith('/src/game/cove/') &&
       typeof child.KIKOKU_SAVE_SNAPSHOT==='function' &&
       child.document.querySelector('#load')?.hidden===true;
   }catch{return false;}
 },null,{timeout:40000});
 const initial=await page.evaluate(()=>{
   const frame=document.querySelector('#game-scene'),child=frame.contentWindow;
   const position=child.KIKOKU_SAVE_SNAPSHOT();
   const canvas=child.document.querySelector('#scene');
   const height=child.document.querySelector('.viewport').clientHeight/1.18;
   const cameraY=Math.max(0,Math.min(22*32-height,position.position.y-height/2-106));
   return {label:frame.title,position,canvas:[canvas.width,canvas.height],
     topWorldY:cameraY,waterVisible:cameraY<9*32,
     menuVisible:!document.querySelector('#field-menu-toggle').hidden,
     shells:child.__COVE_SHELL_QA?.(),surf:child.__COVE_SURF_QA?.(),
     fisher:child.__COVE_FISHER_QA};
 });
 assert.equal(initial.position.scene,'cove');
 assert.equal(initial.fisher.character,'ushiohei');
 assert.equal(initial.fisher.sprite,'assets/characters/npc/ushiohei-walk-4dir-80x112.png');
 assert.deepEqual(initial.fisher.size,[240,448]);
 assert.deepEqual(initial.fisher.frame,[80,112]);
 assert.deepEqual(initial.fisher.feet,[40,106]);
 assert.equal(initial.waterVisible,true,'first view includes the moving sea, not only grass');
 assert.ok(initial.canvas[0]>0&&initial.canvas[1]>0);
 // A drawing buffer can be 2x the CSS viewport on Retina devices, but the
 // canvas ELEMENT itself must never be 2x the display area (hero cut-off).
 const realCanvasFit=await page.evaluate(()=>{
   const doc=document.querySelector('#game-scene').contentDocument;
   const c=doc.querySelector('#scene').getBoundingClientRect();
   const v=doc.querySelector('.viewport').getBoundingClientRect();
   return {widthDifference:Math.abs(c.width-v.width),
     heightDifference:Math.abs(c.height-v.height),
     leftDifference:Math.abs(c.left-v.left),
     topDifference:Math.abs(c.top-v.top)};
 });
 assert.ok(Object.values(realCanvasFit).every(n=>n<2),
   'canvas CSS bounds must match viewport; Retina backing pixels are not CSS pixels');

 assert.equal(initial.menuVisible,true);
 assert.equal(initial.shells.completedBattles,5);
 assert.ok(initial.shells.available>=1&&initial.shells.available<=3,
   'real stored fifth battle deposits 1–3 shells on fixed sand sites');
 assert.equal(initial.shells.gold,0,'shells do not print money on spawn');
 assert.equal(initial.surf.frames,8,'production shore uses approved 8-frame tide');
 assert.equal(initial.surf.chipSize,32,'surf must be native 32px animated mapchips');
 assert.equal(initial.surf.mode,'animated-native-32px-mapchips');
 assert.equal(initial.surf.orientation,'sea-north');
 assert.equal(initial.surf.landJoin,'sea-to-sand-16-corner-alpha-autotiles',
   'approved shoreline, not a grass/forest map');
 assert.equal(initial.surf.approvedCoastline,30,
   'the exact 30-column approved shoreline was copied');
 assert.equal(initial.surf.sceneryNativeCount,3,
   'approved three native-sized rocks are preserved');
 assert.ok(initial.surf.tileCount>58,
   'extended eastern coast must ADD new animated shoreline tiles, not stay frozen at 58');
 assert.ok(initial.surf.coverage[0].washedPixels>=393,
   'extended low tide must cover at least the original approved shoreline');
 assert.ok(initial.surf.coverage[4].washedPixels>=11477,
   'extended high tide must cover at least the original approved shoreline');
 assert.equal(initial.surf.approvedCoastline,30);
 assert.equal(initial.surf.expandedCoastline,42);
 assert.equal(initial.surf.approvedWaveTiles,58,
   'the original 30-column wave band must still contain all 58 accepted tiles');
 assert.equal(initial.position.position.y,432,
   'the original accepted player position (and camera composition) must not shift');
 assert.equal(initial.surf.atlas[0]%32,0);
 assert.equal(initial.surf.atlas[1]%32,0);
 assert.ok(initial.surf.coverage[4].washedPixels>
   initial.surf.coverage[0].washedPixels+400,
   'high-tide 32px chips visibly cover more sand than low tide');
 assert.ok(initial.surf.coverage[4].foamPixels>
   initial.surf.coverage[0].foamPixels+250,
   'white-crest effect really animates across the sand');
 const waterBefore=await page.screenshot({path:'artifacts/sea-cove-entry.png'});
 await page.waitForTimeout(260);
 const middle=await page.screenshot({path:'artifacts/sea-cove-water.png'});
 await page.waitForTimeout(270);
 const after=await page.screenshot();
 assert.ok(!waterBefore.equals(middle)||!waterBefore.equals(after),
   'sea must animate during idle play');
 const yBefore=(await page.evaluate(()=>
   document.querySelector('#game-scene').contentWindow.KIKOKU_SAVE_SNAPSHOT().position.y));
 // The parent owns the UI. Inject into the admitted child window so focus on
 // the parent overlay cannot accidentally turn this into a focus-only test.
 await page.evaluate(()=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));
 });
 await page.waitForTimeout(380);
 await page.evaluate(()=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowUp',bubbles:true,cancelable:true}));
 });
 await page.waitForTimeout(100);
 const yAfter=(await page.evaluate(()=>
   document.querySelector('#game-scene').contentWindow.KIKOKU_SAVE_SNAPSHOT().position.y));
 console.log(JSON.stringify({movement:{yBefore,yAfter}}));
 assert.ok(yAfter<yBefore,'hero must walk across the authored shore');
 // Move on the approved wide sand towards an actual native shell.
 // The original controls (not a test teleport) bring the hero within pickup range.
 await page.evaluate(()=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));
 });
 await page.waitForTimeout(300);
 await page.evaluate(()=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowLeft',bubbles:true,cancelable:true}));
 });
 await page.waitForTimeout(100);
 await page.waitForFunction(()=>Boolean(document.querySelector('#game-scene')
   ?.contentWindow.__COVE_SHELL_QA?.().nearest),null,{timeout:2500});
 const near=await page.evaluate(()=>document.querySelector('#game-scene').contentWindow.__COVE_SHELL_QA());
 assert.ok(near.nearest,'A interaction has a real nearby collectible');
 await page.screenshot({path:'artifacts/sea-cove-shell-near.png'});
 await page.evaluate(()=>document.querySelector('#game-scene')
  .contentDocument.querySelector('#action-a').click());
 await page.waitForFunction(available=>document.querySelector('#game-scene')
  ?.contentWindow.__COVE_SHELL_QA?.().available===available-1,
  initial.shells.available,{timeout:2000});
 const afterPickup=await page.evaluate(()=>document.querySelector('#game-scene').contentWindow.__COVE_SHELL_QA());
 assert.equal(Object.values(afterPickup.bag).reduce((a,b)=>a+b,0),1);
 assert.equal(afterPickup.gold,0,'collecting does not give immediate gold');
 const persisted=await page.evaluate(()=>{
   const raw=localStorage.getItem('kikokuno-hanamusubi-battle-player');
   return JSON.parse(raw)?.shells;
 });
 assert.equal(Object.values(persisted.bag).reduce((a,b)=>a+b,0),1);
 await page.screenshot({path:'artifacts/sea-cove-shell-picked.png'});
 assert.deepEqual(errors,[],'no runtime JS exceptions or missing local assets');
 // Verify the public Pages review with the *same* real production renderer.
 // Opening and walking the review must not alter the user's saved game.
 {
 const review=await browser.newPage({viewport:{width:874,height:402},
   deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await review.addInitScript(()=>{
   window.__STORAGE_AT_LOAD=JSON.stringify(Object.entries(localStorage).sort());
 });
 const previewErrors=[];
 review.on('pageerror',e=>previewErrors.push(e.message));
 review.on('response',r=>{
   if(r.status()>=400&&r.url().startsWith('http://127.0.0.1:'))
     previewErrors.push('HTTP '+r.status()+' '+r.url());
 });
 await review.goto('http://127.0.0.1:'+server.address().port+
   '/previews/sea-cove-review/',{waitUntil:'domcontentloaded'});
 await review.waitForFunction(()=>window.__COVE_PREVIEW_MODE===true&&
   window.KIKOKU_SAVE_SNAPSHOT?.().scene==='cove'&&
   document.querySelector('#load')?.hidden===true,null,{timeout:40000});
 const reviewInitial=await review.evaluate(()=>window.KIKOKU_SAVE_SNAPSHOT().position);
 const surf=await review.evaluate(()=>window.__COVE_SURF_QA());
 const previewFisher=await review.evaluate(()=>window.__COVE_FISHER_QA);
 assert.equal(previewFisher.character,'ushiohei');
 assert.deepEqual(previewFisher.size,[240,448]);
 assert.equal(surf.frames,8);
 const cssFit=await review.evaluate(()=>{
   const c=document.querySelector('#scene').getBoundingClientRect();
   const v=document.querySelector('.viewport').getBoundingClientRect();
   return [Math.abs(c.width-v.width),Math.abs(c.height-v.height),
     Math.abs(c.left-v.left),Math.abs(c.top-v.top)];
 });
 assert.ok(cssFit.every(d=>d<2),'mobile preview canvas must not overflow/crop');

 assert.ok(surf.tileCount>58,'Pages view must animate added coastline too');
 assert.equal(surf.approvedCoastline,30);
 assert.equal(surf.expandedCoastline,42);
 const hamlet=await review.evaluate(()=>window.__COVE_HAMLET_QA);
 assert.deepEqual(hamlet.bounds,[42,44]);
 assert.equal(await review.evaluate(()=>window.__COVE_HAMLET_QA.cameraZoomAt(432)),1.18,
   'original approved camera zoom must not change');
 assert.ok(await review.evaluate(()=>window.__COVE_HAMLET_QA.cameraZoomAt(1050))<=0.66,
   'fishing worksite camera must reveal whole house and net without rescaling art');
 assert.deepEqual(hamlet.assets.fisherHouse,{width:390,height:357});
 assert.deepEqual(hamlet.assets.netRack,{width:192,height:150});
 assert.deepEqual(hamlet.assets.netBundle,{width:112,height:66});
 assert.deepEqual(hamlet.assets.ropeCoil,{width:68,height:50});
 const blocks=await review.evaluate(()=>[
   window.__COVE_HAMLET_QA.blockedByProp(660,1000),
   window.__COVE_HAMLET_QA.blockedByProp(1050,1000),
   window.__COVE_HAMLET_QA.blockedByProp(336,432)
 ]);
 assert.deepEqual(blocks,[true,true,false],
   'roof/net should block walking but approved spawn must remain free');
 assert.equal(reviewInitial.y,432,'Pages camera must match accepted shoreline composition');
 // Pixel-level visual regression: compare an untouched 300x65 dry-sand
 // rectangle in the production-cove canvas with the APPROVED study canvas.
 // Both use the same 874x402 CSS viewport, DPR=2, camera and start position.
 // This is stronger than "the sea animates": it catches shifts, scaling
 // and accidental texture substitutions even when all gameplay tests pass.
 const sampleApprovedSand=async page=>page.evaluate(()=>{
   const pixels=document.querySelector('#scene').getContext('2d')
     .getImageData(400,360,300,65).data;
   return Array.from(pixels);
 });
 const productionSand=await sampleApprovedSand(review);
 const baseline=await browser.newPage({viewport:{width:874,height:402},
   deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await baseline.goto('http://127.0.0.1:'+server.address().port+
   '/previews/shoreline-study/',{waitUntil:'domcontentloaded'});
 await baseline.waitForFunction(()=>window.__SHORE_QA?.ready===true,null,{timeout:40000});
 const approvedSand=await sampleApprovedSand(baseline);
 assert.deepEqual(productionSand,approvedSand,
   'visible cove sand pixels must match the user-approved shoreline preview');
 await baseline.close();
 const before=await review.screenshot({path:'artifacts/sea-cove-pages-review-start.png'});
 await review.waitForTimeout(600);
 const reviewAfter=await review.screenshot({path:'artifacts/sea-cove-pages-review-wave.png'});
 assert.ok(!before.equals(reviewAfter),'Pages preview shows genuinely moving sea');
 await review.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',
   {key:'ArrowUp',bubbles:true,cancelable:true})));
 await review.waitForTimeout(420);
 await review.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keyup',
   {key:'ArrowUp',bubbles:true,cancelable:true})));
 const reviewMoved=await review.evaluate(()=>window.KIKOKU_SAVE_SNAPSHOT().position);
 assert.ok(reviewMoved.y<reviewInitial.y,'Pages preview allows real walking');
 // Move in the actual public review, not a fabricated screenshot:
 // east across the extended coast then south to the working beach.
 const held=async(key,ms)=>{
   await review.evaluate(k=>window.dispatchEvent(new KeyboardEvent('keydown',
     {key:k,bubbles:true,cancelable:true})),key);
   await review.waitForTimeout(ms);
   await review.evaluate(k=>window.dispatchEvent(new KeyboardEvent('keyup',
     {key:k,bubbles:true,cancelable:true})),key);
 };
 await held('ArrowRight',3700);
 await held('ArrowDown',4050);
 const hamletView=await review.evaluate(()=>window.KIKOKU_SAVE_SNAPSHOT().position);
 assert.ok(hamletView.x>700&&hamletView.y>700,
   'real on-screen movement reaches expanded fishing worksite');
 assert.ok(hamletView.x<950,'worksite route should use the central house/net corridor');
 await review.screenshot({path:'artifacts/sea-cove-hamlet-worksite.png'});
 const persisted=await review.evaluate(()=>({
   initial:window.__STORAGE_AT_LOAD,
   current:JSON.stringify(Object.entries(localStorage).sort())
 }));
 assert.equal(persisted.current,persisted.initial,
   'preview must not write player saves, story or local settings');
 assert.deepEqual(previewErrors,[],'Pages preview loads all actual runtime assets');
 await review.close();
 console.log(JSON.stringify({review:'pages-cove-live-passed',reviewInitial,reviewMoved}));
 }

 console.log(JSON.stringify({result:'sea-cove-shells-passed',entry:initial,yBefore,yAfter,
   shellPickup:{before:initial.shells.available,after:afterPickup.available,
     bag:afterPickup.bag,nearest:near.nearest},
   screenshots:['artifacts/sea-cove-entry.png','artifacts/sea-cove-water.png',
     'artifacts/sea-cove-shell-near.png','artifacts/sea-cove-shell-picked.png']}));
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
