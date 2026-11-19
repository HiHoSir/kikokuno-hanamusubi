// Landscape-only browser QA for the actual Tenyo shrine: no screenshot fakes.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
const root=resolve('.');
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg','.m4a':'audio/mp4','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const filename=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(relative(root,filename).startsWith('..')){res.writeHead(403);res.end();return}
  res.writeHead(200,{'Content-Type':types[extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(await readFile(filename));
 }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found')}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[],issues=[];
try{
 const page=await browser.newPage({viewport:{width:900,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>sessionStorage.setItem('kikokuno-hanamusubi-next-entry',JSON.stringify({route:'/src/game/',expiresAt:Date.now()+120000})));
 await page.goto(origin+'/src/game/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.KIKOKU_GAME?.navigate==='function',{timeout:20000});
 await page.evaluate(()=>window.KIKOKU_GAME.navigate(new URL('/src/game/tenyo/',location.href).href));
 await page.waitForFunction(()=>{
   const doc=document.querySelector('#game-scene')?.contentDocument;
   return doc?.querySelector('#load')?.hidden===true &&
     doc.querySelector('#scene')?.dataset.x!==undefined;
 },null,{timeout:65000});
 const before=await page.evaluate(()=>({
   iframe:document.querySelector('#game-scene'),
   position:document.querySelector('#game-scene').contentDocument.querySelector('#scene').dataset.x+','+
     document.querySelector('#game-scene').contentDocument.querySelector('#scene').dataset.y,
   track:window.KIKOKU_GAME.audio.trackName
 }));
 await page.evaluate(data=>window.__tenyoStart={frame:document.querySelector('#game-scene'),position:data.position,track:data.track},before);
 for(const [width,height] of [[900,390],[844,390],[1536,706]]){
   await page.setViewportSize({width,height});
   await page.waitForTimeout(200);
   const data=await page.evaluate(()=>{
     const doc=document.querySelector('#game-scene').contentDocument;
     const canvas=doc.querySelector('#scene'),parent=doc.querySelector('.viewport'),pad=doc.querySelector('#pad');
     const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
     return {window:[innerWidth,innerHeight],canvas:[canvas.width,canvas.height],canvasRect:rect(canvas),
       fieldRect:rect(parent),pad:rect(pad),position:canvas.dataset.x+','+canvas.dataset.y,
       gate:getComputedStyle(document.querySelector('#landscape-required')).display,loading:doc.querySelector('#load').hidden,
       zoom:canvas.dataset.zoom,actorFrame:canvas.dataset.actorFrame};
   });
   results.push(data);
   const actual=data.canvas[0]/data.canvas[1],expected=data.canvasRect.width/data.canvasRect.height;
   if(!data.loading||data.gate!=='none'||Math.abs(actual-expected)>.015||
      data.canvasRect.width>data.fieldRect.width+2||data.canvasRect.height>data.fieldRect.height+2||
      data.position!==before.position||data.zoom!=='1'||data.actorFrame!=='80x112'||
      data.pad.y<0||data.pad.bottom>height+2)
     issues.push('landscape '+width+'x'+height+' shrine viewport mismatch: '+JSON.stringify(data));
   await page.screenshot({path:'artifacts/tenyo-'+width+'x'+height+'.png',fullPage:true});
 }
 // Rotate without reloading the shrine, then restore a playable viewport.
 await page.setViewportSize({width:390,height:844});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#landscape-required')).display==='grid');
 const portrait=await page.evaluate(()=>({
  sameFrame:document.querySelector('#game-scene')===window.__tenyoStart.frame,
  shellBlocked:document.querySelector('#game-shell').inert
 }));
 if(!portrait.sameFrame||!portrait.shellBlocked)issues.push('portrait gate lost shrine state: '+JSON.stringify(portrait));
 await page.screenshot({path:'artifacts/tenyo-rotate-portrait.png'});
 // Verify the public Pages preview uses the actual walk and rendering files
 // with real pointer input, no mocked character or screenshot.
 const review=await browser.newPage({viewport:{width:874,height:402},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const reviewErrors=[];
 review.on('pageerror',e=>reviewErrors.push(e.message));
 await review.goto(origin+'/previews/tenyo-scale-review/',{waitUntil:'domcontentloaded'});
 await review.waitForFunction(()=>document.querySelector('#load')?.hidden===true,{timeout:65000});
 const beforeReview=await review.evaluate(()=>{
   const c=document.querySelector('#scene');
   return {zoom:c.dataset.zoom,frame:c.dataset.actorFrame,
    posX:c.dataset.x,posY:c.dataset.y,
    previewOcclusion:c.dataset.previewOcclusion,
    viewportW:c.getBoundingClientRect().width,
    canvasW:c.width,canvasH:c.height};
 });
 if(beforeReview.zoom!=='1'||beforeReview.frame!=='80x112'||beforeReview.previewOcclusion!=='true')
  issues.push('Pages preview does not load uniform full-size characters '+JSON.stringify(beforeReview));
 await review.screenshot({path:'artifacts/tenyo-native-characters-preview.png'});
 const art=await review.evaluate(()=>document.querySelector('#scene').dataset.reviewNpcArt);
 const heroFactor=await review.evaluate(()=>document.querySelector('#scene').dataset.heroArtFactor);
 if(heroFactor!=='0.52')issues.push('approved legacy visual hero size must be 0.52');
 if(art!=='original')
  issues.push('preview default should be the previous actual character proportions'); 
 await review.locator('.review-panel summary').click();
 await review.locator('[data-tenyo-figures="largeNpc"]').click();
 await review.waitForFunction(()=>document.querySelector('#scene')?.dataset.reviewNpcArt==='native-recomposed-2x',{timeout:5000});
 await review.screenshot({path:'artifacts/tenyo-large-npc-contrast.png'});
 await review.locator('[data-tenyo-figures="legacy"]').click();
 await review.waitForFunction(()=>document.querySelector('#scene')?.dataset.reviewCharacters==='legacy',{timeout:5000});
 await review.locator('[data-tenyo-camera="1.4"]').click();
 await review.waitForFunction(()=>document.querySelector('#scene')?.dataset.zoom==='1.4',{timeout:5000});
 await review.screenshot({path:'artifacts/tenyo-previous-camera-comparison.png'});
 await review.locator('[data-tenyo-camera="1"]').click();
 await review.waitForFunction(()=>document.querySelector('#scene')?.dataset.zoom==='1',{timeout:5000});
 await review.screenshot({path:'artifacts/tenyo-native-characters-zoom1.png'});
 const sealed=await review.evaluate(()=>document.querySelector('#scene').dataset.sequelSealed);
 if(sealed!=='true')issues.push('sequel passage must be sealed in every review mode');
 await review.locator('[data-tenyo-contact="legacy"]').click();
 await review.waitForFunction(()=>document.querySelector('#scene')?.dataset.collisionProfile==='legacy',{timeout:5000});
 const legacySealed=await review.evaluate(()=>document.querySelector('#scene').dataset.sequelSealed);
 if(legacySealed!=='true')issues.push('switching to previous collision reopened the sequel gate');
 await review.locator('[data-tenyo-contact="visual"]').click();
 await review.waitForFunction(()=>document.querySelector('#scene')?.dataset.collisionProfile==='visual',{timeout:5000});
 await review.locator('.review-panel summary').click();
 await review.locator('[data-tenyo-collision]').click();
 await review.waitForFunction(()=>document.querySelector('[data-tenyo-collision]')?.getAttribute('aria-pressed')==='true');
 await review.waitForTimeout(80);
 await review.screenshot({path:'artifacts/tenyo-collision-footprint-overlay.png'});
 await review.locator('[data-tenyo-collision]').click();
 const up=await review.locator('#up').boundingBox();
 await review.mouse.move(up.x+up.width/2,up.y+up.height/2);
 await review.mouse.down();
 await review.waitForTimeout(380);
 await review.mouse.up();
 await review.waitForTimeout(220);
 const afterReview=await review.evaluate(()=>{
   const c=document.querySelector('#scene');return {x:c.dataset.x,y:c.dataset.y};
 });
 const unit=await review.evaluate(()=>document.querySelector('#scene').dataset.movementUnit);
 if(unit!=='world-pixels')issues.push('sanctuary movement incorrectly snapped to field grid');
 const dx=Number(afterReview.x)-Number(beforeReview.posX);
 const dy=Number(afterReview.y)-Number(beforeReview.posY);
 if(dx===0&&dy===0)issues.push('continuous shrine movement did not change world-pixel position');
 if(beforeReview.posY===afterReview.y)
  issues.push('Pages preview is not walkable by D-pad '+JSON.stringify({beforeReview,afterReview}));
 if(reviewErrors.length)issues.push('Pages review JS exceptions: '+reviewErrors.join(';'));
 await review.screenshot({path:'artifacts/tenyo-native-characters-walking.png'});
 await review.locator('.review-panel summary').click();
 await review.locator('[data-tenyo-spot="gate"]').click();
 await review.waitForFunction(()=>document.querySelector('#scene')?.dataset.x==='416.00',{timeout:5000});
 await review.locator('.review-panel summary').click();
 await review.waitForTimeout(90);
 await review.screenshot({path:'artifacts/tenyo-shirotae-clear-of-gate.png'});
 await review.locator('.review-panel summary').click();
 await review.locator('[data-tenyo-spot="waterfall"]').click();
 await review.waitForFunction(()=>document.querySelector('#scene')?.dataset.x==='592.00',{timeout:5000});
 await review.locator('.review-panel summary').click();
 await review.waitForTimeout(90);
 await review.screenshot({path:'artifacts/tenyo-waterfall-safe-approach.png'});
 const right=await review.locator('#right').boundingBox();
 await review.mouse.move(right.x+right.width/2,right.y+right.height/2);
 await review.mouse.down();
 await review.waitForTimeout(850);
 await review.mouse.up();
 await review.waitForTimeout(200);
 const nearFall=await review.evaluate(()=>{
  const c=document.querySelector('#scene');return {x:Number(c.dataset.x),y:Number(c.dataset.y)};
 });
 if(!(nearFall.x>620&&nearFall.x<650&&Math.abs(nearFall.y-176)<1))
   issues.push('the intentional path at the right waterfall must remain walkable '+JSON.stringify(nearFall));
 await review.screenshot({path:'artifacts/tenyo-waterfall-walking-occlusion.png'});
 await review.locator('.review-panel summary').click();
 await review.locator('[data-tenyo-spot="waterfallOverlap"]').click();
 await review.waitForFunction(()=>document.querySelector('#scene')?.dataset.x==='631.30',{timeout:5000});
 await review.locator('.review-panel summary').click();
 await review.waitForTimeout(90);
 await review.screenshot({path:'artifacts/tenyo-waterfall-overlay-point.png'});
 await review.close();
 await page.setViewportSize({width:900,height:390});
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#landscape-required')).display==='none');
 const after=await page.evaluate(()=>({
  sameFrame:document.querySelector('#game-scene')===window.__tenyoStart.frame,
  position:(d=>d.querySelector('#scene').dataset.x+','+d.querySelector('#scene').dataset.y)(document.querySelector('#game-scene').contentDocument),
  track:window.KIKOKU_GAME.audio.trackName
 }));
 if(!after.sameFrame||after.position!==before.position||after.track!==before.track)
   issues.push('rotation reset shrine state or BGM '+JSON.stringify(after));
 if(errors.length)issues.push('JS exceptions '+errors.join('; '));
 await page.close();
}finally{await browser.close();await new Promise(done=>server.close(done))}
console.log(JSON.stringify({results,issues},null,2));
if(issues.length)process.exitCode=1;
