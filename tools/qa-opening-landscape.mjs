// Browser-level viewport proof for landscape opening movie, never a resized fake screenshot.
// Uses the production title -> authorized opening route and actual MP4 metadata.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
const root=resolve('.');
const types={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json','.mp4':'video/mp4','.ogg':'audio/ogg','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  const file=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(relative(root,file).startsWith('..')){res.writeHead(403);res.end();return;}
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const issues=[],results=[];
const dims={x:el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};}};
try{
 const page=await browser.newPage({viewport:{width:900,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>sessionStorage.setItem('kikokuno-hanamusubi-next-entry',JSON.stringify({route:'/src/opening/',expiresAt:Date.now()+120000})));
 await page.goto(origin+'/src/opening/',{waitUntil:'domcontentloaded'});
 // The player can be paused by autoplay policy; layout must work regardless of playback.
 for(const {w,h,name} of [{w:900,h:390,name:'iphone-landscape'},{w:844,h:390,name:'narrow-landscape'},{w:1536,h:706,name:'large-landscape'}]){
   await page.setViewportSize({width:w,height:h});
   const snap=await page.evaluate(()=>{
    const video=document.querySelector('#opening-video'),container=document.querySelector('#opening'),body=document.body,footer=document.querySelector('.opening-actions');
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    return {viewport:[innerWidth,innerHeight],screen:rect(body),movieArea:rect(container),video:rect(video),footer:rect(footer),
       intrinsic:[video.videoWidth,video.videoHeight],objectFit:getComputedStyle(video).objectFit,
       position:getComputedStyle(video).position,
       gate:getComputedStyle(document.querySelector('#landscape-required')).display,
       visible:(document.elementFromPoint(innerWidth/2,Math.max(1,container.getBoundingClientRect().height/2))?.closest('#opening')!==null),
       videoPaused:video.paused,
    };
   });
   results.push({name,...snap});
   const eps=1.5;
   if(snap.gate!=='none'||snap.position!=='absolute'||snap.objectFit!=='contain'||snap.video.width<10||snap.video.height<10||
      snap.video.x<snap.movieArea.x-eps||snap.video.right>snap.movieArea.right+eps||
      snap.video.y<snap.movieArea.y-eps||snap.video.bottom>snap.movieArea.bottom+eps||
      snap.footer.bottom>h+eps||snap.movieArea.bottom>snap.footer.y+eps||
      snap.screen.bottom>h+eps||!snap.visible)
     issues.push(name+' video clipped or footer outside viewport: '+JSON.stringify(snap));
   await page.screenshot({path:'artifacts/opening-'+name+'.png',fullPage:true});
   if(name==='iphone-landscape'){
     const needsTap=await page.evaluate(()=>document.querySelector('#opening-video').paused);
     if(needsTap){
       await page.locator('#play-opening').click();
     }
     try{
       await page.waitForFunction(()=>{
         const v=document.querySelector('#opening-video');
         return v.videoWidth>0&&v.videoHeight>0&&!v.paused&&v.currentTime>.6;
       },null,{timeout:15000});
       await page.screenshot({path:'artifacts/opening-playing-landscape.png',fullPage:true});
       const intrinsic=await page.evaluate(()=>{
         const v=document.querySelector('#opening-video');
         const r=v.getBoundingClientRect();
         return {width:v.videoWidth,height:v.videoHeight,display:[r.width,r.height],fit:getComputedStyle(v).objectFit};
       });
       results.push({name:'actual-playing-frame',intrinsic});
     }catch(error){issues.push('live MP4 did not render and advance after user gesture: '+error.message);}
   }
 }
 // Reorient while staying in the same opening document; don't lose the movie element/time.
 await page.evaluate(()=>{window.__movieBefore=document.querySelector('#opening-video');});
 await page.setViewportSize({width:390,height:844});
 const portrait=await page.evaluate(()=>({
   gate:getComputedStyle(document.querySelector('#landscape-required')).display,
   paused:document.querySelector('#opening-video').paused,
   inert:document.querySelector('#opening').inert,
   sameVideo:window.__movieBefore===document.querySelector('#opening-video')
 }));
 if(portrait.gate!=='grid'||!portrait.paused||!portrait.inert||!portrait.sameVideo)
   issues.push('portrait opening guard did not preserve/stop video '+JSON.stringify(portrait));
 await page.screenshot({path:'artifacts/opening-rotate-portrait.png',fullPage:true});
 await page.setViewportSize({width:900,height:390});
 const after=await page.evaluate(()=>window.__movieBefore===document.querySelector('#opening-video')&&getComputedStyle(document.querySelector('#landscape-required')).display==='none');
 if(!after)issues.push('rotation rebuilt movie instead of preserving the element');
 if(errors.length)issues.push('JS errors: '+errors.join('; '));
 await page.close();
}finally{await browser.close();await new Promise(done=>server.close(done));}
console.log(JSON.stringify({results,issues},null,2));
if(issues.length)process.exitCode=1;
