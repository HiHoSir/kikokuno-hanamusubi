// Browser proof: water coast mask is static, actual approved water frames move,
// and the production projected field loops without blank sea/river pixels.
// All PNGs are comparison artifacts; do not place candidates in assets/.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {extname,resolve,relative} from 'node:path';

const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.ogg':'audio/ogg'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  const f=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(relative(root,f).startsWith('..')){res.writeHead(403);res.end();return;}
  const bytes=await readFile(f);
  res.writeHead(200,{'Content-Type':mime[extname(f)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(bytes);
 }catch(e){res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:900,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>sessionStorage.setItem('kikokuno-hanamusubi-next-entry',JSON.stringify({route:'/src/game/',expiresAt:Date.now()+120000})));
 await page.goto(origin+'/src/game/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.KIKOKU_GAME?.navigate==='function',{timeout:20000});
 await page.evaluate(()=>window.KIKOKU_GAME.navigate(new URL('/src/field/?from=village',location.href).href));
 await page.waitForFunction(()=>{
  const w=document.querySelector('#game-scene')?.contentWindow;
  return w?.YK_LANDSCAPE?.ready?.()===true&&w.document.querySelector('#load')?.hidden===true;
 },null,{timeout:60000});
 const data=await page.evaluate(async()=>{
  const w=document.querySelector('#game-scene').contentWindow;
  const approved=w.YK_FIELD_ASSETS;
  const loadImage=src=>new Promise((resolve,reject)=>{
   const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Unable to load '+src));im.src=src;
  });
  const [water,fall]=await Promise.all(['waterMotion','waterfallMotion'].map(key=>loadImage(approved.url(approved.landscape[key]))));
  const cv=(width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;const q=c.getContext('2d');q.imageSmoothingEnabled=false;return c;};
  const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  const changed=(a,b,mask=null,invert=false)=>{
   let total=0;for(let i=0;i<a.length;i+=4){
    if(mask&&(mask[i+3]>0)===invert)continue;
    if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])total++;
   }
   return total;
  };
  const srcFrame=(image,frame)=>{const c=cv(image.width/2,image.height);
   c.getContext('2d').drawImage(image,frame*c.width,0,c.width,c.height,0,0,c.width,c.height);
   return c;
  };
  const waterFrames=[srcFrame(water,0),srcFrame(water,1)],fallFrames=[srcFrame(fall,0),srcFrame(fall,1)];
  const alphaNonzero=c=>{const d=pixels(c);let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return n;};
  const source={
   waterAtlas:[water.width,water.height],
   waterfallAtlas:[fall.width,fall.height],
   waterFrames:waterFrames.map(c=>[c.width,c.height]),
   waterfallFrames:fallFrames.map(c=>[c.width,c.height]),
   waterChangedPixels:changed(pixels(waterFrames[0]),pixels(waterFrames[1])),
   waterfallChangedPixels:changed(pixels(fallFrames[0]),pixels(fallFrames[1])),
   waterOpaque:waterFrames.map(alphaNonzero),
   waterfallOpaque:fallFrames.map(alphaNonzero)
  };
  const sample=Array.from({length:10},(_,ty)=>Array.from({length:14},(_,tx)=>{
   const cutoff=3+Math.round(1.6*Math.sin(ty*.65)+ty*.27);
   return tx<=cutoff?(ty%3===0?'river':'sea'):tx<=cutoff+2?'sand':'grass';
  }));
  const isWet=(x,y)=>['sea','river'].includes(sample[y]?.[x]);
  const staticMap=sample.map(row=>row.map(t=>isWetTile(t)?'sand':t));
  function isWetTile(t){return t==='sea'||t==='river';}
  staticMap.textureOrigin={x:0,y:0};
  staticMap.bridgeWaterCells=new Set();
  staticMap.paths=[];staticMap.decorations=[];
  const dryBase=w.YK_LANDSCAPE.floorLayer(staticMap);
  const frameMasks=cv(14*32,10*32),mctx=frameMasks.getContext('2d');
  let maskedTiles=0;const maskCache=new Map();
  for(let y=0;y<sample.length;y++)for(let x=0;x<sample[0].length;x++){
   if(!isWet(x,y))continue;
   const neighbors={n:isWet(x,y-1),e:isWet(x+1,y),s:isWet(x,y+1),w:isWet(x-1,y)};
   const diagonals={nw:isWet(x-1,y-1),ne:isWet(x+1,y-1),sw:isWet(x-1,y+1),se:isWet(x+1,y+1)};
   const local=cv(32,32),ctx=local.getContext('2d'),d=ctx.createImageData(32,32);
   for(let py=0;py<32;py++)for(let px=0;px<32;px++){
    const i=(py*32+px)*4;
    if(w.YK_LANDSCAPE.contains(px,py,neighbors,diagonals)){
     d.data[i]=d.data[i+1]=d.data[i+2]=d.data[i+3]=255;
    }
   }
   ctx.putImageData(d,0,0);
   mctx.drawImage(local,x*32,y*32);
   maskCache.set(x+','+y,local);maskedTiles++;
  }
  const renderFrame=frame=>{
   const composed=cv(dryBase.width,dryBase.height),ctx=composed.getContext('2d');
   ctx.drawImage(dryBase,0,0);
   const waterFrame=waterFrames[frame];
   for(let y=0;y<sample.length;y++)for(let x=0;x<sample[0].length;x++){
    if(!isWet(x,y))continue;
    const mask=maskCache.get(x+','+y);
    const tile=cv(32,32),t=tile.getContext('2d');
    t.drawImage(waterFrame,(x%2)*32,(y%2)*32,32,32,0,0,32,32);
    t.globalCompositeOperation='destination-in';t.drawImage(mask,0,0);
    ctx.drawImage(tile,x*32,y*32);
   }
   return composed;
  };
  const f0=renderFrame(0),f1=renderFrame(1),f2=renderFrame(0);
  const imageData0=pixels(f0),imageData1=pixels(f1),maskPixels=pixels(frameMasks);
  const preview=c=>{const target=cv(c.width*2,c.height*2);target.getContext('2d').drawImage(c,0,0,target.width,target.height);return target.toDataURL('image/png').split(',')[1];};
  const candidate={
   tileSize:32,sampleSize:[14,10],waterCells:maskedTiles,
   wetPixelsChanged:changed(imageData0,imageData1,maskPixels,false),
   dryPixelsChanged:changed(imageData0,imageData1,maskPixels,true),
   loopPixelsChanged:changed(imageData0,pixels(f2)),
   frame0:preview(f0),frame1:preview(f1),static:preview(dryBase),mask:preview(frameMasks)
  };
  // Render the real projected terrain with a deterministic water phase.
  // 0 and 720ms have the same two-frame phase, while 360ms must animate.
  const scene=w.document.querySelector('#scene'),sc=scene.getContext('2d');
  const world=w.YK_WORLD.mapData;
  const actor={x:w.YK_WORLD.start[0],foot:w.YK_WORLD.start[1],draw:()=>{}};
  const paint=time=>w.YK_LANDSCAPE.drawQuarter(sc,world,actor,1.4,
    {oceanOutside:true,elevationTerrain:true,viewportWidth:scene.width,motionTime:time});
  paint(0);const first=pixels(scene).slice();
  paint(360);const second=pixels(scene).slice();
  paint(720);const last=pixels(scene).slice();
  const production={frame0To360Changed:changed(first,second),frame0To720Changed:changed(first,last),canvas:[scene.width,scene.height]};
  return {source,candidate,production,contract:{
    waterTimeMs:360,seaAndRiver:'animated source frames',shoreMask:'static 32px alpha',
    waterfall:'independent animated frame pair',shallow:'Tenyo 4-frame water is unchanged'
  }};
 });
 const {candidate,source,production,contract}=data;
 for(const [name,base64] of Object.entries({frame0:candidate.frame0,frame1:candidate.frame1,static:candidate.static,mask:candidate.mask})){
  await writeFile('artifacts/water-animation-'+name+'.png',Buffer.from(base64,'base64'));
  delete candidate[name];
 }
 const report={source,candidate,production,contract,errors};
 await writeFile('artifacts/water-animation-metadata.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 const failures=[];
 if(source.waterAtlas.join(',')!=='128,64'||source.waterFrames.some(d=>d.join(',')!=='64,64')||
    source.waterOpaque.some(n=>n<512)||source.waterChangedPixels<32)failures.push('approved sea/river two-frame source missing or blank');
 if(source.waterfallAtlas.join(',')!=='160,96'||source.waterfallFrames.some(d=>d.join(',')!=='80,96')||
    source.waterfallOpaque.some(n=>n<512)||source.waterfallChangedPixels<32)failures.push('approved waterfall source missing or blank');
 if(candidate.waterCells<5||candidate.wetPixelsChanged<50||candidate.dryPixelsChanged!==0||candidate.loopPixelsChanged!==0)
    failures.push('animated mask compositing changed land or froze water '+JSON.stringify(candidate));
 if(production.frame0To360Changed<50||production.frame0To720Changed!==0)
    failures.push('real projected field water is blank/static or does not loop '+JSON.stringify(production));
 if(errors.length)failures.push('page errors '+errors.join('; '));
 if(failures.length)throw Error('Water animation QA failed: '+failures.join(' | '));
}finally{
 await browser.close();await new Promise(done=>server.close(done));
}
