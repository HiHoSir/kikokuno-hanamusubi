// Real-browser A/B test: existing terrain-projection vs opt-in static-tile
// terrain over moving sea. Screenshots and measurements are review-only.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {extname,resolve,relative} from 'node:path';
const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(relative(root,file).startsWith('..')){res.writeHead(403);res.end();return}
  const content=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(content);
 }catch{if(!res.headersSent)res.writeHead(404);res.end()}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
await mkdir('artifacts',{recursive:true});
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[],issues=[];
try{
 for(const [width,height] of [[900,390],[844,390],[1536,706]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>sessionStorage.setItem('kikokuno-hanamusubi-next-entry',
    JSON.stringify({route:'/src/game/',expiresAt:Date.now()+120000})));
  await page.goto(origin+'/src/game/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.KIKOKU_GAME?.navigate==='function',{timeout:15000});
  await page.evaluate(()=>window.KIKOKU_GAME.navigate(
    new URL('/src/field/?from=village&renderer=tile-layers&profile=1',location.href).href));
  await page.waitForFunction(()=>{
   const w=document.querySelector('iframe')?.contentWindow;
   return !!w?.__FIELD_TILE_LAYER_TRIAL?.info?.builds &&
      w.document.querySelector('#load')?.hidden===true;
  },null,{timeout:90000});
  const result=await page.evaluate(()=>{
   const w=document.querySelector('iframe').contentWindow;
   const scene=w.document.querySelector('#scene'),ctx=scene.getContext('2d');
   const test=w.__FIELD_TILE_LAYER_TRIAL;
   const tx=+scene.dataset.x,ty=+scene.dataset.y;
   const actor={x:tx*32+16,foot:ty*32+16};
   const refActor={...actor,draw:()=>{}};
   const map=w.YK_WORLD.mapData,width=scene.width,height=scene.height,frameTime=120000;
   const testImg=document.createElement('canvas');testImg.width=width;testImg.height=height;
   const tctx=testImg.getContext('2d');
   const reference=document.createElement('canvas');reference.width=width;reference.height=height;
   const rctx=reference.getContext('2d');
   const base=()=>{
    w.YK_LANDSCAPE.drawQuarter(rctx,map,refActor,1.4,{
     oceanOutside:true,elevationTerrain:true,viewportWidth:width,motionTime:frameTime});
   };
   const trial=()=>test.draw(tctx,actor,frameTime,width);
   // Warming both modes excludes first-time map chip assembly and image decode.
   base();trial();base();trial();
   const time=fn=>{
    const a=[];for(let i=0;i<5;i++){const start=w.performance.now();fn();a.push(w.performance.now()-start);}
    return a.sort((x,y)=>x-y)[2];
   };
   const referenceMs=time(base),candidateMs=time(trial);
   base();trial();
   const a=rctx.getImageData(0,0,width,height).data,b=tctx.getImageData(0,0,width,height).data;
   let diff=0;
   for(let i=0;i<a.length;i+=4){
    if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])diff++;
   }
   const firstWater=tctx.getImageData(0,0,width,height).data.slice();
   const landBefore=test.staticLand,landBuilds=test.info.builds;
   test.draw(tctx,actor,frameTime+360,width);
   const nextWater=tctx.getImageData(0,0,width,height).data;
   let animatedPixels=0;
   for(let i=0;i<nextWater.length;i+=4){
    if(firstWater[i]!==nextWater[i]||firstWater[i+1]!==nextWater[i+1]||
       firstWater[i+2]!==nextWater[i+2])animatedPixels++;
   }
   return {viewport:[width,height],referenceMs:+referenceMs.toFixed(1),candidateMs:+candidateMs.toFixed(1),
    ratio:+(candidateMs/referenceMs).toFixed(3),differentPercent:+(100*diff/(width*height)).toFixed(2),
    differentPixels:diff,animatedPixels,
    fixedLand:test.staticLand===landBefore&&test.info.builds===landBuilds,
    info:{...test.info},refPNG:reference.toDataURL('image/png').split(',')[1],
    candidatePNG:testImg.toDataURL('image/png').split(',')[1],
    afterPNG:tctx.canvas.toDataURL('image/png').split(',')[1]};
  });
  for(const [key,label] of [['refPNG','reference'],['candidatePNG','candidate'],['afterPNG','water-next-frame']]){
   await writeFile('artifacts/field-layer-'+label+'-'+width+'x'+height+'.png',
     Buffer.from(result[key],'base64'));
   delete result[key];
  }
  results.push(result);
  if(errors.length||result.animatedPixels<100||!result.fixedLand||
     result.info.waterCells<1||result.info.builds!==1||result.info.waterFrames!==Math.floor((120000+360)/360)%2||
     result.info.staticBytes<100000||!Number.isFinite(result.ratio)||
     result.referenceMs<=0||result.candidateMs<=0)
   issues.push(width+'x'+height+': '+JSON.stringify({result,errors}));
  await page.close();
 }
}finally{await browser.close();await new Promise(done=>server.close(done))}
await writeFile('artifacts/field-layer-a-b.json',JSON.stringify({results,issues},null,2));
console.log(JSON.stringify({results,issues},null,2));
if(issues.length)process.exitCode=1;
