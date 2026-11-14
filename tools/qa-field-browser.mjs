// Visual QA against the actual game pages and approved assets in headless Chrome.
// Run: node tools/qa-field-browser.mjs
// Requires Playwright only in CI; no production runtime dependency.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join, extname, relative } from 'node:path';
const root=resolve('.');
const types={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8',
 '.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json','.png':'image/png','.jpg':'image/jpeg',
 '.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml',
 '.ogg':'audio/ogg','.mp3':'audio/mpeg','.mp4':'video/mp4',
 '.woff2':'font/woff2','.gif':'image/gif'};
const server=createServer(async(req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const rel=name.endsWith('/')?name+'index.html':name;
  const file=resolve(root,'.'+rel);
  if(relative(root,file).startsWith('..')){res.writeHead(403);res.end();return;}
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(body);
 }catch(e){res.writeHead(404);res.end('NOT FOUND '+req.url);}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('artifacts',{recursive:true});
let browser;
const results=[];
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const [width,height] of [[1536,706],[900,390],[844,390]]){
  const errors=[];
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  page.on('requestfailed',r=>errors.push('request failed: '+r.url()+' '+r.failure()?.errorText));
  await page.addInitScript(()=>{
   const original=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(...args){
    try{
     const src=typeof args[0]?.src==='string'?args[0].src:'';
     if(src.includes('walk-sd-32.png')){
      const matrix=this.getTransform(),event={
       img:src,canvas:[this.canvas.width,this.canvas.height],
       x:args[5],y:args[6],w:args[7],h:args[8],
       matrix:[matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f]
      };
      (window.__fieldHeroDraws??=[]).push(event);
      if(window.__fieldHeroDraws.length>12)window.__fieldHeroDraws.shift();
     }
    }catch{}
    return original.apply(this,args);
   };
  });
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
   sessionStorage.setItem('kikokuno-hanamusubi-next-entry',JSON.stringify({
    route:'/src/game/',expiresAt:Date.now()+120000
   }));
  });
  await page.goto(origin+'/src/game/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.KIKOKU_GAME?.navigate,{timeout:20000});
  await page.evaluate(()=>window.KIKOKU_GAME.navigate(new URL('/src/field/?from=village&profile=1',location.href).href));
  try{
   await page.waitForFunction(()=>{
    const f=document.querySelector('iframe')?.contentWindow;
    return !!f?.document?.querySelector('#scene')
     &&f.document.querySelector('#load')?.hidden===true;
   },null,{timeout:20000});
  }catch(e){
   const failure=await page.evaluate(()=>{
    const frame=document.querySelector('iframe'),doc=frame?.contentDocument;
    return {frameSrc:frame?.src,frameLocation:doc?.location?.href,
     title:doc?.title,loadText:doc?.querySelector('#load')?.textContent,
     loadHidden:doc?.querySelector('#load')?.hidden,
     bodyText:doc?.body?.innerText?.slice(0,350),
     canvasFoot:doc?.querySelector('#scene')?.dataset?.fieldHeroFoot,
     readyState:doc?.readyState};
   });
   console.error('BROWSER FIELD LOAD DIAGNOSTIC '+JSON.stringify({viewport:width+'x'+height,...failure,errors},null,2));
   await page.screenshot({path:'artifacts/field-'+width+'x'+height+'.png'});
   throw e;
  }
  await page.waitForTimeout(650);
  const idleBefore=await page.evaluate(()=>{
    const s=document.querySelector('iframe')?.contentWindow?.__FIELD_RENDER_PROFILE;
    return s?{frames:s.frames,totalMs:s.totalMs,maxMs:s.maxMs}:null;
  });
  // A bounded directional hold exercises the 192ms step/continuous camera
  // path without waiting long enough for a random field encounter.
  await page.evaluate(()=>{
    const w=document.querySelector('iframe').contentWindow;
    w.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  });
  await page.waitForTimeout(790);
  await page.evaluate(()=>{
    const w=document.querySelector('iframe').contentWindow;
    w.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true}));
  });
  await page.waitForTimeout(450);
  const profile=await page.evaluate(()=>{
    const s=document.querySelector('iframe')?.contentWindow?.__FIELD_RENDER_PROFILE;
    if(!s)return null;
    const a=[...s.samples].sort((x,y)=>x-y);
    return {frames:s.frames,totalMs:Math.round(s.totalMs),meanMs:Number((s.totalMs/Math.max(1,s.frames)).toFixed(2)),
      p50Ms:a[Math.floor(a.length*.5)]||0,p95Ms:a[Math.floor(a.length*.95)]||0,
      maxMs:Number(s.maxMs.toFixed(2)),viewport:s.viewport,measuredSamples:a.length};
  });
  const detail=await page.evaluate(()=>{
   const doc=document.querySelector('iframe').contentDocument;
   const scene=doc.querySelector('#scene'),viewport=doc.querySelector('.viewport');
   const pad=doc.querySelector('#pad'),css=doc.defaultView.getComputedStyle(scene);
   const draws=doc.defaultView.__fieldHeroDraws||[];
   const last=draws.at(-1);
   const foot=scene.dataset.fieldHeroFoot===undefined?null:Number(scene.dataset.fieldHeroFoot);
   const box=scene.getBoundingClientRect(),field=viewport.getBoundingClientRect();
   const bar=pad.getBoundingClientRect(),w=scene.width,h=scene.height;
   let visible=null;
   const aspect=box.width/Math.max(1,box.height);
   if(last){
    const [a,b,c,d,e,f]=last.matrix;
    const spriteTop=last.y*d+f,spriteBottom=(last.y+last.h)*d+f;
    const relTop=spriteTop/h,relBottom=spriteBottom/h;
    const ctx=scene.getContext('2d');
    const x0=Math.max(0,Math.floor((last.x*a+e)));
    const x1=Math.min(w,Math.ceil((last.x+last.w)*a+e));
    const y0=Math.max(0,Math.floor(spriteTop)),y1=Math.min(h,Math.ceil(spriteBottom));
    let red=0,solid=0;
    if(x1>x0&&y1>y0){
     const pixels=ctx.getImageData(x0,y0,x1-x0,y1-y0).data;
     for(let i=0;i<pixels.length;i+=4){
      const [r,g,bl,alpha]=pixels.slice(i,i+4);
      if(alpha>100)solid++;
      if(r>75 && r>g*1.35 && r>bl*1.18)red++;
     }
    }
    visible={spriteTop,spriteBottom,relTop,relBottom,redPixels:red,solidPixels:solid,rect:[x0,y0,x1-x0,y1-y0]};
   }
   return {window:[innerWidth,innerHeight],scene:[w,h],field:[field.width,field.height],canvasRect:[box.x,box.y,box.width,box.height],
    pad:[bar.y,bar.height],foot,draws:draws.length,
    panorama:[scene.dataset.fieldViewportWidth,scene.dataset.fieldViewportHeight],
    imageFit:css.objectFit,visible,loadHidden:doc.querySelector('#load')?.hidden,
    sceneURL:doc.location.href};
  });
  const screenshot='artifacts/field-'+width+'x'+height+'.png';
  await page.screenshot({path:screenshot});
  results.push({viewport:width+'x'+height,...detail,screenshot,profile,idleBefore,errors});
  await page.close();
 }
}finally{await browser?.close();server.close();}
console.log(JSON.stringify(results,null,2));
const failures=results.filter(r=>{
 const [width,height]=r.window;
 const ratio=width/height,realRatio=r.scene[0]/r.scene[1];
 const barOverlays=r.pad[0]>=0 && r.pad[0]<height;
 return r.errors.some(e=>e.includes('pageerror')||e.includes('HTTP 404'))||
 !r.profile||r.profile.frames<3||r.profile.measuredSamples<3||r.profile.viewport[0]!==r.scene[0]||
 r.draws<1||!Number.isFinite(r.foot)||r.foot<0||
 !r.visible||r.visible.relTop<0||r.visible.relBottom>1||
 r.visible.redPixels<3||r.scene[1]!==544||Math.abs(realRatio-ratio)>.015||
 r.canvasRect[2]>r.field[0]+1||r.canvasRect[3]>r.field[1]+1||
 r.imageFit!=='fill'||!barOverlays||r.pad[1]<100||r.pad[1]>170;
});
if(failures.length)throw Error('Panoramic Chrome field render QA failed: '+failures.map(x=>x.viewport+' scene='+x.scene+' red='+x.visible?.redPixels+' hero='+x.visible?.relTop+','+x.visible?.relBottom+' errors='+x.errors.join(';')).join(' | '));
