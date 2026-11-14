// Real-browser A/B test: previous terrain projection vs production static-tile
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
  await page.evaluate(()=>{
    window.KIKOKU_GAME.navigate(new URL('/src/field/?from=village&profile=1',location.href).href);
  });
  try{
    await page.waitForFunction(()=>{
      const w=document.querySelector('iframe')?.contentWindow;
      return !!w?.__FIELD_TERRAIN_RENDERER?.info?.builds &&
        w.document.querySelector('#load')?.hidden===true;
    },null,{timeout:35000});
  }catch(err){
    const details=await page.evaluate(()=>{
      const f=document.querySelector('iframe'),w=f?.contentWindow;
      return {route:f?.src,body:w?.document?.body?.innerText?.slice(0,300),
        ready:w?.YK_LANDSCAPE?.ready?.(),trial:w?.__FIELD_TERRAIN_RENDERER?.info,
        loadHidden:w?.document?.querySelector('#load')?.hidden,
        frameLoaded:w?.document?.readyState};
    });
    console.error('FIELD TERRAIN BOOT FAILURE '+JSON.stringify({viewport:[width,height],details,errors},null,2));
    await page.screenshot({path:'artifacts/field-layer-load-failure-'+width+'x'+height+'.png'});
    throw err;
  }
  const result=await page.evaluate(()=>{
   const w=document.querySelector('iframe').contentWindow;
   const scene=w.document.querySelector('#scene'),ctx=scene.getContext('2d');
   const test=w.__FIELD_TERRAIN_RENDERER;
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
  // The pixel-difference number is diagnostic ONLY: distinct authored tile
  // art must not be automatically rejected for looking different pixel-by-pixel.
  // Compare actual landscape silhouettes from three representative positions.
  if(width===900){
   const views=await page.evaluate(()=>{
    const w=document.querySelector('iframe').contentWindow;
    const src=w.document.querySelector('#scene'),map=w.YK_WORLD.mapData;
    const context=w.__FIELD_TERRAIN_RENDERER;
    const width=src.width,height=src.height,ref=document.createElement('canvas'),
      candidate=document.createElement('canvas');
    ref.width=candidate.width=width;ref.height=candidate.height=height;
    const r=ref.getContext('2d'),c=candidate.getContext('2d');
    return [[37,71,'village-coast'],[40,8,'raised-shrine'],[28,35,'mountain-cliffs']].map(([tx,ty,label])=>{
     const actor={x:tx*32+16,foot:ty*32+16};
     w.YK_LANDSCAPE.drawQuarter(r,map,{...actor,draw:()=>{}},1.4,{
      oceanOutside:true,elevationTerrain:true,viewportWidth:width,motionTime:120000});
     context.draw(c,actor,120000,width);
     return {label,oldPNG:ref.toDataURL('image/png').split(',')[1],
       newPNG:candidate.toDataURL('image/png').split(',')[1]};
    });
   });
   for(const view of views){
    for(const [key,name] of [['oldPNG','current'],['newPNG','tile-layer']]){
      await writeFile('artifacts/field-layer-'+view.label+'-'+name+'.png',Buffer.from(view[key],'base64'));
    }
   }
   result.landscapeCheckpoints=views.map(v=>v.label);
  }
  // Use the live shell and child routing. The field chooses the same
  // renderer on return without a comparison query parameter.
  await page.evaluate(()=>{
    const field=document.querySelector('#game-scene').contentWindow;
    const canvas=field.document.querySelector('#scene');
    const x=Number(canvas.dataset.x)*32+16,y=Number(canvas.dataset.y)*32+16;
    sessionStorage.setItem('kikokuno-hanamusubi-battle-field-return',JSON.stringify({x,y}));
    field.KIKOKU_ROUTE.go(new URL('/src/game/battle/',location.href));
  });
  await page.waitForFunction(()=>{
    const frame=document.querySelector('#game-scene'),child=frame?.contentWindow;
    return frame?.src.includes('/src/game/battle/')&&child?.location.href===frame.src&&
      child.KIKOKU_ROUTE?.admitted===true;
  },null,{timeout:20000});
  await page.evaluate(()=>{
    const battle=document.querySelector('#game-scene').contentWindow;
    battle.KIKOKU_ROUTE.go(new URL('/src/field/?from=battle&profile=1',location.href));
  });
  await page.waitForFunction(()=>{
    const frame=document.querySelector('#game-scene'),field=frame?.contentWindow;
    return frame?.src.includes('from=battle')&&field?.location.href===frame.src&&
      field.__FIELD_TERRAIN_RENDERER?.info?.builds===1&&field.document.querySelector('#load')?.hidden===true;
  },null,{timeout:60000});
  result.battleReturn=await page.evaluate(()=>{
    const frame=document.querySelector('#game-scene'),field=frame.contentWindow;
    const {x,y}=JSON.parse(sessionStorage.getItem('kikokuno-hanamusubi-battle-field-return'));
    const values=field.document.querySelector('#scene').dataset;
    return {url:frame.src,track:window.KIKOKU_GAME.audio.trackName,
      sameCell:Number(values.x)===Math.floor(x/32)&&Number(values.y)===Math.floor(y/32),
      water:field.__FIELD_TERRAIN_RENDERER.info.animatedWater};
  });
  results.push(result);
  if(errors.length||!result.battleReturn.water||!result.battleReturn.sameCell||
     result.battleReturn.track!=='field'||result.info.forestCliffTiles<1||
     result.animatedPixels<100||!result.fixedLand||
     result.info.waterCells<1||result.info.builds!==1||result.info.waterFrames!==Math.floor((120000+360)/360)%2||
     result.info.staticBytes<100000||!Number.isFinite(result.ratio)||
     result.referenceMs<0||result.candidateMs<0)
   issues.push(width+'x'+height+': '+JSON.stringify({result,errors}));
  await page.close();
 }
}finally{await browser.close();await new Promise(done=>server.close(done))}
await writeFile('artifacts/field-layer-a-b.json',JSON.stringify({results,issues},null,2));
console.log(JSON.stringify({results,issues},null,2));
if(issues.length)process.exitCode=1;
