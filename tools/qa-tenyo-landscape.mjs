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
       gate:getComputedStyle(document.querySelector('#landscape-required')).display,loading:doc.querySelector('#load').hidden};
   });
   results.push(data);
   const actual=data.canvas[0]/data.canvas[1],expected=data.canvasRect.width/data.canvasRect.height;
   if(!data.loading||data.gate!=='none'||Math.abs(actual-expected)>.015||
      data.canvasRect.width>data.fieldRect.width+2||data.canvasRect.height>data.fieldRect.height+2||
      data.position!==before.position||data.pad.y<0||data.pad.bottom>height+2)
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
