// Production-only browser QA: title admission -> shell -> cove, using real
// local assets and actual canvas frames, not a fabricated screenshot.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {hizukiWalkDistance} from '../src/game/village/movement.mjs';

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
 await page.evaluate(()=>{
   sessionStorage.setItem('kikokuno-hanamusubi-restore-position',JSON.stringify({
     scene:'field',position:{x:49*32+16,y:52*32+16,row:0}
   }));
   window.KIKOKU_GAME.navigate(new URL('/src/field/?from=village',location.href));
 });
 const fieldAt=async(x,y)=>page.waitForFunction(({x,y})=>{
   const child=document.querySelector('#game-scene')?.contentWindow;
   if(child?.location.pathname!=='/src/field/'||!child.document.querySelector('#load')?.hidden)
     return false;
   const scene=child.document.querySelector('#scene');
   return Number(scene.dataset.x)===x&&Number(scene.dataset.y)===y;
 },{x,y});
 const moveSouth=async(type)=>page.evaluate(type=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent(type,{key:'ArrowDown',bubbles:true}));
 },type);
 await fieldAt(49,52);
 await page.screenshot({path:'artifacts/sea-cove-waterfront-marker.png'});
 await moveSouth('keydown');
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
   return {label:frame.title,position,canvas:[canvas.width,canvas.height],
     menuVisible:!document.querySelector('#field-menu-toggle').hidden,
     shells:child.__COVE_SHELL_QA?.(),surf:child.__COVE_SURF_QA?.(),
     fisher:child.__COVE_FISHER_QA,rockAssets:child.__COVE_HAMLET_QA?.assets};
 });
 assert.equal(initial.position.scene,'cove');
 assert.equal(initial.fisher.character,'ushiohei');
 assert.equal(initial.fisher.sprite,'assets/characters/npc/ushiohei-walk-4dir-80x112.png');
 assert.deepEqual(initial.fisher.size,[240,448]);
 assert.deepEqual(initial.fisher.frame,[80,112]);
 assert.deepEqual(initial.fisher.feet,[40,106]);
 for(const [key,dimensions] of [
  ['rockWest',{width:60,height:40}],
  ['rockEast',{width:104,height:64}],
  ['rockHeadland',{width:108,height:72}]
 ])assert.deepEqual(initial.rockAssets?.[key],dimensions,'native rock '+key);
 assert.deepEqual(initial.position.position,{x:336,y:1360,face:1},
   'field entry starts one cell inside the south gate, facing into the cove');
 await page.screenshot({path:'artifacts/sea-cove-entry.png'});
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
   'three preexisting rock marker positions remain');
 assert.ok(initial.surf.tileCount>58,
   'extended eastern coast must ADD new animated shoreline tiles, not stay frozen at 58');
 assert.ok(initial.surf.coverage[0].washedPixels>=393,
   'extended low tide must cover at least the original approved shoreline');
 assert.ok(initial.surf.coverage[4].washedPixels>=11477,
   'extended high tide must cover at least the original approved shoreline');
 assert.equal(initial.surf.approvedCoastline,30);
 assert.equal(initial.surf.expandedCoastline,42);
 // The legacy finite map had 2 shore chips at its artificial EAST
 // boundary; extending real land beyond that boundary removes those
 // fake edge-only tiles. The 56 real western chips must remain intact,
 // and the whole connected coast must gain the 22 genuinely new chips.
 assert.equal(initial.surf.formerMapColumnsWaveTiles,56,
   'preserve the 56 real western shoreline chips without fake cutoff surf');
 assert.equal(initial.surf.tileCount,78,
   'the extended 42-column beach uses 78 connected animated shore chips');
 assert.equal(initial.surf.atlas[0]%32,0);
 assert.equal(initial.surf.atlas[1]%32,0);
 assert.ok(initial.surf.coverage[4].washedPixels>
   initial.surf.coverage[0].washedPixels+400,
   'high-tide 32px chips visibly cover more sand than low tide');
 assert.ok(initial.surf.coverage[4].foamPixels>
   initial.surf.coverage[0].foamPixels+250,
   'white-crest effect really animates across the sand');
 const yBefore=(await page.evaluate(()=>
   document.querySelector('#game-scene').contentWindow.KIKOKU_SAVE_SNAPSHOT().position.y));
 // The parent owns the UI. Inject into the admitted child window so focus on
 // the parent overlay cannot accidentally turn this into a focus-only test.
 await page.evaluate(()=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));
 });
 await page.waitForFunction(()=>document.querySelector('#game-scene')
   .contentWindow.KIKOKU_SAVE_SNAPSHOT().position.y<=376);
 await page.evaluate(()=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowUp',bubbles:true,cancelable:true}));
 });
 await page.waitForTimeout(100);
 const yAfter=(await page.evaluate(()=>
   document.querySelector('#game-scene').contentWindow.KIKOKU_SAVE_SNAPSHOT().position.y));
 console.log(JSON.stringify({movement:{yBefore,yAfter}}));
 assert.ok(yAfter<yBefore,'hero must walk across the authored shore');
 const waterBefore=await page.screenshot({path:'artifacts/sea-cove-shore-reached.png'});
 await page.waitForTimeout(260);
 const middle=await page.screenshot({path:'artifacts/sea-cove-water.png'});
 await page.waitForTimeout(270);
 const after=await page.screenshot();
 assert.ok(!waterBefore.equals(middle)||!waterBefore.equals(after),
   'sea must animate once the player walks north from the gate');
 // Move on the approved wide sand towards an actual native shell.
 // The original controls (not a test teleport) bring the hero within pickup range.
 await page.evaluate(()=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true}));
 });
 await page.waitForFunction(()=>document.querySelector('#game-scene')
   .contentWindow.KIKOKU_SAVE_SNAPSHOT().position.x<=307);
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
 const coveAt=async(x,y)=>{
   await page.evaluate(({x,y})=>{
     sessionStorage.setItem('kikokuno-hanamusubi-restore-position',JSON.stringify({
       scene:'cove',position:{x,y,face:0}
     }));
     window.KIKOKU_GAME.navigate(new URL('./cove/?qa-south='+x,location.href));
   },{x,y});
   await page.waitForFunction(({x,y})=>{
     const child=document.querySelector('#game-scene')?.contentWindow;
     const snapshot=child?.KIKOKU_SAVE_SNAPSHOT?.();
     return snapshot?.scene==='cove'&&snapshot.position.x===x&&snapshot.position.y===y;
   },{x,y});
 };
 await coveAt(448,1340);
 await moveSouth('keydown');
 await page.waitForFunction(()=>document.querySelector('#game-scene')
   .contentWindow.KIKOKU_SAVE_SNAPSHOT().position.y>1374);
 await page.waitForTimeout(350);
 await moveSouth('keyup');
 const stopped=await page.evaluate(()=>document.querySelector('#game-scene')
   .contentWindow.KIKOKU_SAVE_SNAPSHOT());
 assert.equal(stopped.scene,'cove');
 assert.ok(stopped.position.y<1392,'south fence stops movement away from the opening');
 await coveAt(336,1296);
 await page.screenshot({path:'artifacts/sea-cove-south-exit.png'});
 await moveSouth('keydown');
 await fieldAt(49,52);
 assert.match(page.frames().find(frame=>frame.url().includes('/src/field/')).url(),/from=cove/);
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
 // The authored coast is 672 CSS px wide at 0.5 world zoom. On an
 // 874 CSS px iPhone landscape view it must have 101px of BLUE on each
 // side. Inspect the ACTUAL canvas pixels, not a fabricated mockup.
 await review.waitForTimeout(180);
 const centered=await review.evaluate(()=>{
   const canvas=document.querySelector('#scene');
   const viewport=document.querySelector('.viewport');
   const ctx=canvas.getContext('2d');
   const midY=Math.floor(canvas.height/2);
   const backdrop=[40,103,142]; // canvas fallback #28678e
   const isBackdrop=x=>{
     const rgba=ctx.getImageData(x,midY,1,1).data;
     return backdrop.every((v,i)=>rgba[i]===v);
   };
   let left=0,right=0;
   while(left<canvas.width/2&&isBackdrop(left))left++;
   while(right<canvas.width/2&&isBackdrop(canvas.width-1-right))right++;
   return {left,right,centerIsBackdrop:isBackdrop(Math.floor(canvas.width/2)),
     screenWidth:canvas.width,cssWidth:viewport.clientWidth,dpr:devicePixelRatio};
 });
 console.log('Cove horizontal centering on real canvas:',JSON.stringify(centered));
 assert.equal(centered.cssWidth,874,'test the actual wide mobile canvas');
 assert.ok(centered.left>0&&centered.right>0,'both blue side rails must exist');
 assert.ok(Math.abs(centered.left-centered.right)<=2,
   'left and right blue margins must match rather than right-only space');
 assert.equal(centered.centerIsBackdrop,false,'the real sand should occupy the center');
 assert.ok(Math.abs(centered.left-((centered.cssWidth-672)*centered.dpr/2))<=2,
   'preserve the native world scale rather than stretching the map');
 await review.locator('.viewport').screenshot({path:'artifacts/sea-cove-centered-wide-mobile.png'});

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
 assert.equal(hamlet.cameraZoom,0.5,
   'beach and fisher worksite must share village/interior CSS world zoom');
 assert.deepEqual(hamlet.assets.fisherHouse,{width:390,height:357});
 assert.deepEqual(hamlet.assets.netRack,{width:232,height:176});
 assert.deepEqual(hamlet.assets.netBundle,{width:146,height:88});
 assert.deepEqual(hamlet.assets.ropeCoil,{width:88,height:62});
 const blocks=await review.evaluate(()=>[
   window.__COVE_HAMLET_QA.blockedByProp(660,1000),
   window.__COVE_HAMLET_QA.blockedByProp(1050,1000),
   window.__COVE_HAMLET_QA.blockedByProp(336,432)
 ]);
 assert.deepEqual(blocks,[true,true,false],
   'roof/net should block walking but approved spawn must remain free');
 assert.equal(reviewInitial.y,432,'original approved sea-cove spawn remains unchanged');
 // The original study is a separate appearance experiment at zoom 1.18.
 // Its screenshot coordinates cannot be compared with the unified 0.5
 // gameplay zoom. Instead assert that the 30-column terrain, 8-frame surf
 // logic and native-size art remain intact; tests/sea-cove.test.mjs
 // compares the approved terrain values cell-by-cell.
 assert.equal(surf.approvedCoastline,30);
 assert.equal(surf.frames,8);
 const scaleAtStart=await review.evaluate(()=>{
   const c=document.querySelector('#scene');
   const v=document.querySelector('.viewport');
   return {cssWidth:v.clientWidth,bufferWidth:c.width,
     pixelStep:c.width/Math.max(1,v.clientWidth)*window.__COVE_HAMLET_QA.cameraZoom};
 });
 assert.ok(Math.abs(scaleAtStart.pixelStep-1)<0.005,
   'DPR=2 and world zoom 0.5 should map one world pixel to one canvas pixel');
 const before=await review.screenshot({path:'artifacts/sea-cove-pages-review-start.png'});
 await review.waitForTimeout(600);
 const reviewAfter=await review.screenshot({path:'artifacts/sea-cove-pages-review-wave.png'});
 assert.ok(!before.equals(reviewAfter),'Pages preview shows genuinely moving sea');
 // Move in the public review from the entry along the coast to the worksite.
 const held=async(key,distance)=>{
   await review.evaluate(k=>window.dispatchEvent(new KeyboardEvent('keydown',
     {key:k,bubbles:true,cancelable:true})),key);
   await review.waitForTimeout(distance/hizukiWalkDistance(1));
   await review.evaluate(k=>window.dispatchEvent(new KeyboardEvent('keyup',
     {key:k,bubbles:true,cancelable:true})),key);
 };
 await held('ArrowUp',63);
 const reviewMoved=await review.evaluate(()=>window.KIKOKU_SAVE_SNAPSHOT().position);
 assert.ok(reviewMoved.y<reviewInitial.y,'Pages preview allows real walking');
 // Walk south of the newly sized headland rock, then east above the
 // house roof, then south through the real house/net worksite corridor.
 // This uses player input only: it is not a teleport or a fake camera QA.
 await held('ArrowRight',450);
 await held('ArrowDown',210);
 await held('ArrowRight',135);
 await held('ArrowDown',300);
 const hamletView=await review.evaluate(()=>window.KIKOKU_SAVE_SNAPSHOT().position);
 assert.ok(hamletView.x>700&&hamletView.y>700,
   'real on-screen movement reaches expanded fishing worksite');
 assert.ok(hamletView.x<950,'worksite route should use the central house/net corridor');
 await review.screenshot({path:'artifacts/sea-cove-hamlet-worksite.png'});
 await review.locator('[data-review-spot="south"]').click();
 assert.equal(await review.locator('.village-hud').isVisible(),false,
   'the exit view has no persistent text overlay');
 await review.locator('.viewport').screenshot({path:'artifacts/sea-cove-preview-south-exit.png'});
 // On a real iPhone the art cannot be judged from a test log. Ensure the
 // public review has touch-friendly rock/worksite shortcuts and real movement.
 await review.locator('[data-review-spot="rocks"]').click();
 const rockShortcut=await review.evaluate(()=>window.KIKOKU_SAVE_SNAPSHOT().position);
 assert.deepEqual([rockShortcut.x,rockShortcut.y],[710,460],
   'rock visual review shortcut must place the avatar beside the actual rocks');
 await review.locator('.viewport').screenshot({path:'artifacts/sea-cove-rocks-near-hero.png'});
 await review.locator('[data-review-spot="worksite"]').click();
 const worksiteShortcut=await review.evaluate(()=>window.KIKOKU_SAVE_SNAPSHOT().position);
 assert.deepEqual([worksiteShortcut.x,worksiteShortcut.y],[884,805],
   'worksite visual review shortcut must place the avatar between house and net');
 await review.locator('.viewport').screenshot({path:'artifacts/sea-cove-worksite-near-hero.png'});
 // PSP is the target DISPLAY, not the iPhone's extra-wide browser view.
 // Size the actual content box to 480x272, accounting for whatever border
 // rules the game CSS cascade applies. Do not change runtime camera/terrain.
 await review.evaluate(()=>{
   const view=document.querySelector('.viewport'),css=getComputedStyle(view);
   const bordersX=parseFloat(css.borderLeftWidth)+parseFloat(css.borderRightWidth);
   const bordersY=parseFloat(css.borderTopWidth)+parseFloat(css.borderBottomWidth);
   const borderBox=css.boxSizing==='border-box';
   const width=480+(borderBox?bordersX:0);
   const height=272+(borderBox?bordersY:0);
   view.style.width=width+'px';view.style.height=height+'px';
   view.style.minWidth=width+'px';view.style.minHeight=height+'px';
 });
 await review.waitForTimeout(650); // allow ResizeObserver and animation frames
 const pspGeometry=await review.evaluate(()=>{
   const c=document.querySelector('#scene'),v=document.querySelector('.viewport');
   return {client:[v.clientWidth,v.clientHeight],outer:[v.offsetWidth,v.offsetHeight],
     canvasClient:[c.clientWidth,c.clientHeight],backing:[c.width,c.height],
     devicePixelRatio:devicePixelRatio};
 });
 console.log('PSP viewport QA geometry:',JSON.stringify(pspGeometry));
 assert.deepEqual(pspGeometry.client,[480,272],
   'PSP viewport must have 480x272 CSS content pixels');
 assert.deepEqual(pspGeometry.backing,[960,544],
   'DPR2 canvas resolution must be 960x544 when viewport is PSP 480x272');
 const pspScreen=await review.evaluate(()=>{
   const c=document.querySelector('#scene'),ctx=c.getContext('2d');
   const samples=[[c.width-4,c.height-4],[c.width-4,c.height-64],
     [c.width/2,c.height-4],[4,c.height-4]];
   return {css:[c.clientWidth,c.clientHeight],backing:[c.width,c.height],
     corners:samples.map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data))};
 });
 assert.deepEqual(pspScreen.css,[480,272],
   'PSP logical screen must measure 480x272, excluding browser chrome');
 assert.deepEqual(pspScreen.backing,[960,544],
   'Retina DPR2 changes resolution, not the PSP world viewport');
 for(const pixel of pspScreen.corners)
   assert.notDeepEqual(pixel.slice(0,3),[40,103,142],
     'at PSP size no corner should expose the renderer fallback outside the map');
 await review.locator('.viewport').screenshot({path:'artifacts/sea-cove-psp-screen.png'});

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
