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
 for(const [width,height] of [[1536,706],[900,390],[390,844]]){
  const errors=[];
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
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
  await page.evaluate(()=>window.KIKOKU_GAME.navigate(new URL('/src/field/?from=village',location.href).href));
  await page.waitForFunction(()=>{
   const f=document.querySelector('iframe')?.contentWindow;
   return !!f?.document?.querySelector('#scene')?.dataset?.fieldHeroFoot
    &&f.document.querySelector('#load')?.hidden===true;
  },{timeout:45000});
  await page.waitForTimeout(600);
  const detail=await page.evaluate(()=>{
   const doc=document.querySelector('iframe').contentDocument;
   const scene=doc.querySelector('#scene'),viewport=doc.querySelector('.viewport');
   const pad=doc.querySelector('#pad'),css=doc.defaultView.getComputedStyle(scene);
   const draws=doc.defaultView.__fieldHeroDraws||[];
   const last=draws.at(-1),top=Number(scene.dataset.fieldCropTop);
   const foot=Number(scene.dataset.fieldHeroFoot);
   const box=scene.getBoundingClientRect(),field=viewport.getBoundingClientRect();
   const bar=pad.getBoundingClientRect(),w=scene.width,h=scene.height;
   let visible=null;
   if(last){
    const [a,b,c,d,e,f]=last.matrix;
    const spriteTop=last.y*d+f,spriteBottom=(last.y+last.h)*d+f;
    const cropHeight=Number.isFinite(top)&&box.width/box.height>1.35?768/(box.width/box.height):768;
    const relTop=(spriteTop-top)/cropHeight,relBottom=(spriteBottom-top)/cropHeight;
    const ctx=scene.getContext('2d');
    const x0=Math.max(0,Math.floor((last.x*a+e)));
    const x1=Math.min(w,Math.ceil((last.x+last.w)*a+e));
    const y0=Math.max(0,Math.floor(relTop*h)),y1=Math.min(h,Math.ceil(relBottom*h));
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
   return {window:[innerWidth,innerHeight],scene:[w,h],field:[field.width,field.height],
    pad:[bar.y,bar.height],cropTop:top,foot,draws:draws.length,
    imageFit:css.objectFit,visible,loadHidden:doc.querySelector('#load')?.hidden,
    sceneURL:doc.location.href};
  });
  const screenshot='artifacts/field-'+width+'x'+height+'.png';
  await page.screenshot({path:screenshot});
  results.push({viewport:width+'x'+height,...detail,screenshot,errors});
  await page.close();
 }
}finally{await browser?.close();server.close();}
console.log(JSON.stringify(results,null,2));
const failures=results.filter(r=>
 r.errors.some(e=>e.includes('pageerror'))||
 r.draws<1||!Number.isFinite(r.foot)||r.foot<0||
 !r.visible||r.visible.relTop<0||r.visible.relBottom>1.05||
 r.visible.redPixels<3||
 (r.viewport!=='390x844'&&r.pad[0]<r.field[1]-4)
);
if(failures.length)throw Error('Actual Chrome field render QA failed: '+failures.map(x=>x.viewport+' red='+x.visible?.redPixels+' range='+x.visible?.relTop+','+x.visible?.relBottom+' errors='+x.errors.join(';')).join(' | '));
