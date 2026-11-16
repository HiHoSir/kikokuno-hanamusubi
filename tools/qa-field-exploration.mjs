// Screenshots from the real field game renderer for review of authored exploration terrain.
// This QA source stays in tools/ (never a new public preview page).
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,relative} from 'node:path';

const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8',
 '.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp',
 '.ogg':'audio/ogg','.mp4':'video/mp4','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const f=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(relative(root,f).startsWith('..')){res.writeHead(403);res.end();return;}
  const bytes=await readFile(f);res.writeHead(200,{'Content-Type':mime[extname(f)]||'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404);res.end('NOT FOUND');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const output=[];
try{
 for(const item of [
  {name:'meadow',cell:[27,59]},
  {name:'ridge-approach',cell:[39,64]},
  {name:'lookout',cell:[40,59]}
 ]){
  const page=await browser.newPage({viewport:{width:900,height:390},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',err=>errors.push('pageerror '+err.message));
  page.on('response',res=>{if(res.status()>=400)errors.push('HTTP '+res.status()+' '+res.url());});
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.evaluate(([tx,ty])=>{
   sessionStorage.setItem('kikokuno-hanamusubi-next-entry',
    JSON.stringify({route:'/src/game/',expiresAt:Date.now()+120000}));
   sessionStorage.setItem('kikokuno-hanamusubi-battle-field-return',
    JSON.stringify({x:tx*32+16,y:ty*32+16,row:1}));
  },item.cell);
  await page.goto(origin+'/src/game/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.KIKOKU_GAME?.navigate==='function',null,{timeout:20000});
  await page.evaluate(()=>window.KIKOKU_GAME.navigate(new URL('/src/field/?from=battle&profile=1',location.href).href));
  try{
   await page.waitForFunction(()=>{
    const iframe=document.querySelector('iframe'),w=iframe?.contentWindow;
    return !!w?.document?.querySelector('#scene') && w.document.querySelector('#load')?.hidden===true;
   },null,{timeout:45000});
  }catch(e){
   console.error('FIELD EXPLORATION LOAD FAILED '+JSON.stringify({
    name:item.name,errors,html:(await page.locator('body').innerText()).slice(0,350)}));
   throw e;
  }
  await page.waitForTimeout(420);
  const metrics=await page.evaluate(()=>{
    const w=document.querySelector('iframe').contentWindow;
    const g=w.YK_WORLD,m=g.mapData,scene=w.document.querySelector('#scene');
    const pos=([x,y])=>[x*32+16,y*32+16];
    const queue=[[39,64]],visited=new Set(['39,64']);
    let upperReachable=false,raisedReachable=false;
    for(let i=0;i<queue.length;i++){
     const [x,y]=queue[i];
     if(m.heights[y]?.[x]===2)upperReachable=true;
     if((m.heights[y]?.[x]||0)>0)raisedReachable=true;
     for(const [dx,dy]of [[1,0],[0,1],[-1,0],[0,-1]]){
      const nx=x+dx,ny=y+dy,key=nx+','+ny;
      if(nx<34||nx>47||ny<51||ny>69||visited.has(key))continue;
      if(g.canMove(...pos([x,y]),...pos([nx,ny]))){visited.add(key);queue.push([nx,ny]);}
     }
    }
    return {landscape:[scene.width,scene.height],hero:[scene.dataset.x,scene.dataset.y],
      flowerObjects:g.mapData.decorations.filter(o=>o.kind==='wildflowers').length,
      ladderCount:m.ladders.length,levelAtLookout:m.heights[59][40],
      authoredClimbs:[[40,64,40,63],[40,61,40,60]].map(([lx,ly,ux,uy])=>({
        lower:[lx,ly],upper:[ux,uy],
        exists:m.ladders.some(l=>l.lower[0]===lx&&l.lower[1]===ly&&l.upper[0]===ux&&l.upper[1]===uy),
        up:g.canMove(...pos([lx,ly]),...pos([ux,uy])),
        down:g.canMove(...pos([ux,uy]),...pos([lx,ly]))
      })),
      fullClimb:[[40,65],[40,64],[40,63],[40,62],[40,61],[40,60],[40,59],[40,58]].every((c,i,a)=>!i||(
        g.canMove(...pos(a[i-1]),...pos(c))&&g.canMove(...pos(c),...pos(a[i-1]))
      )),
      walkableLookout:g.walkable(...pos([40,59])),raisedReachable,upperReachable,
      reachableCellsNearLookout:visited.size,staticTerrain:g.mapData.projectedHeights};
  });
  if(item.name==='ridge-approach'){
    assert.ok(metrics.raisedReachable,'height-1 terrace must connect to the walkable world');
    assert.ok(metrics.upperReachable,'height-2 lookout must be accessible from the lower rim');
  }
  assert.equal(metrics.flowerObjects,19);
  assert.equal(metrics.fullClimb,true,'the route is reversible from base to summit');
  assert.ok(metrics.authoredClimbs.every(c=>c.exists&&c.up&&c.down),'each ladder is both visible and traversable');
  assert.ok(metrics.landscape[0]>=640&&metrics.landscape[1]===544);
  assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:'artifacts/field-exploration-'+item.name+'.png'});
  output.push({name:item.name,cell:item.cell,metrics,errors});
  await page.close();
 }
 await writeFile('artifacts/field-exploration-qa.json',JSON.stringify(output,null,2)+'\n');
 console.log('FIELD EXPLORATION QA '+JSON.stringify(output));
}finally{
 await browser.close();await new Promise(done=>server.close(done));
}
