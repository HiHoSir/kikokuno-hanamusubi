// Assemble prototype 32px coast/shore connection tiles from approved art.
// This is a QA artifact, NEVER added to the game's approved assets/manifest.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {extname,resolve,relative} from 'node:path';
const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  const path=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(relative(root,path).startsWith('..')){res.writeHead(403);res.end();return;}
  const contents=await readFile(path);
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(contents);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let results;
try{
 const page=await browser.newPage({viewport:{width:900,height:390}});
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>sessionStorage.setItem('kikokuno-hanamusubi-next-entry',
  JSON.stringify({route:'/src/game/',expiresAt:Date.now()+120000})));
 await page.goto(origin+'/src/game/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.KIKOKU_GAME?.navigate==='function');
 await page.evaluate(()=>window.KIKOKU_GAME.navigate(new URL('/src/field/?from=village',location.href).href));
 await page.waitForFunction(()=>{
  const w=document.querySelector('#game-scene')?.contentWindow;
  return w?.YK_LANDSCAPE?.ready?.()===true && w.document.querySelector('#load')?.hidden===true;
 },null,{timeout:60000});
 results=await page.evaluate(()=>{
  const w=document.querySelector('#game-scene').contentWindow;
  const floor=w.YK_LANDSCAPE.floorLayer;
  const makeFixture=(center,mask)=>{
   const land=center==='sea'?'grass':'grass',water=center==='sea'?'sea':'sea';
   const base=center==='sea'?'sea':'grass';
   const map=Array.from({length:3},()=>Array(3).fill(base));
   map[1][1]=center;
   const bits={n:!!(mask&1),e:!!(mask&2),s:!!(mask&4),w:!!(mask&8)};
   const other=center==='sea'?'grass':'sea';
   if(bits.n)map[0][1]=other;
   if(bits.e)map[1][2]=other;
   if(bits.s)map[2][1]=other;
   if(bits.w)map[1][0]=other;
   // Diagonal join flags follow two connected edges, rather than creating
   // detached 1-pixel water/land corners.
   if(bits.n&&bits.w)map[0][0]=other;
   if(bits.n&&bits.e)map[0][2]=other;
   if(bits.s&&bits.w)map[2][0]=other;
   if(bits.s&&bits.e)map[2][2]=other;
   map.textureOrigin={x:0,y:0};
   map.bridgeWaterCells=new Set();
   return map;
  };
  const sheets={};
  const stats={};
  const hash=bytes=>{let h=2166136261;for(let i=0;i<bytes.length;i++){h^=bytes[i];h=Math.imul(h,16777619);}return h>>>0;};
  for(const kind of ['sea','sand']){
   const sheet=document.createElement('canvas');sheet.width=sheet.height=4*32;
   const ctx=sheet.getContext('2d');ctx.imageSmoothingEnabled=false;
   const signatures=[];
   for(let mask=0;mask<16;mask++){
    const ground=floor(makeFixture(kind,mask));
    const x=mask%4*32,y=Math.floor(mask/4)*32;
    ctx.drawImage(ground,32,32,32,32,x,y,32,32);
    signatures.push(hash(ctx.getImageData(x,y,32,32).data));
   }
   const preview=document.createElement('canvas');preview.width=preview.height=512;
   const q=preview.getContext('2d');q.imageSmoothingEnabled=false;
   q.drawImage(sheet,0,0,512,512);
   sheets[kind+'-atlas']=sheet.toDataURL('image/png').split(',')[1];
   sheets[kind+'-preview']=preview.toDataURL('image/png').split(',')[1];
   stats[kind]={unique:new Set(signatures).size,signatures,cell:32,masks:16};
  }
  const sample=Array.from({length:10},(_,y)=>
    Array.from({length:14},(_,x)=>{
      const cutoff=3+Math.round(1.6*Math.sin(y*.65)+y*.27);
      return x<=cutoff?'sea':x===cutoff+1||x===cutoff+2?'sand':'grass';
    }));
  sample.textureOrigin={x:0,y:0};sample.bridgeWaterCells=new Set();
  const sampleCanvas=floor(sample);
  const view=document.createElement('canvas');view.width=sampleCanvas.width*2;view.height=sampleCanvas.height*2;
  const q=view.getContext('2d');q.imageSmoothingEnabled=false;
  q.drawImage(sampleCanvas,0,0,view.width,view.height);
  sheets['shore-grid-preview']=view.toDataURL('image/png').split(',')[1];
  return {sheets,stats,sampleTiles:[sample[0].length,sample.length],
   note:'N=1 E=2 S=4 W=8. Atlas position x=(mask%4)*32,y=floor(mask/4)*32.'};
 });
 for(const [key,data] of Object.entries(results.sheets)){
   await writeFile('artifacts/field-map-parts-'+key+'.png',Buffer.from(data,'base64'));
 }
 delete results.sheets;
 if(results.stats.sea.unique<8||results.stats.sand.unique<8)
   throw Error('Expected at least 8 distinct mask tiles per approved terrain: '+JSON.stringify(results.stats));
 await writeFile('artifacts/field-map-parts-metadata.json',JSON.stringify(results,null,2));
 console.log('MAP CHIP PROTOTYPE '+JSON.stringify({seaVariants:results.stats.sea.unique,
  sandVariants:results.stats.sand.unique,sampleTiles:results.sampleTiles,note:results.note}));
}finally{
 await browser.close();
 await new Promise(done=>server.close(done));
}
