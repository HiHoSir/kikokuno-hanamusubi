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
      rearSlopes:[[40,57],[37,54]].map(([x,y])=>({cell:[x,y],dir:m.ramps[y][x]})),
      rearRoute:[[40,59],[40,58],[40,57],[40,56],[39,56],[38,56],[37,56],[37,55],[37,54],[37,53],[36,53],[36,54],[36,55]].every((p,i,list)=>{
        if(!i)return true;const center=([x,y])=>[x*32+16,y*32+16];
        return g.canMove(...center(list[i-1]),...center(p))&&g.canMove(...center(p),...center(list[i-1]));
      }),

      localLadders:m.ladders.filter(l=>l.lower[0]>=34&&l.lower[0]<=46&&l.lower[1]>=53&&l.lower[1]<=64).length,
      allRoutes:Object.fromEntries(Object.entries({
       south:[[40,65],[40,64],[40,63],[40,62],[40,61],[40,60],[40,59]],
       west:[[34,60],[35,60],[36,60],[37,60],[38,60],[38,59],[39,59],[40,59]],
       east:[[46,61],[45,61],[44,61],[43,61],[43,60],[43,59],[42,59],[41,59],[40,59]],
       north:[[40,59],[40,58],[40,57],[40,56],[39,56],[38,56],[37,56],[37,55],[37,54],[37,53]]
      }).map(([name,route])=>[name,route.every((c,i,a)=>!i||(
        g.canMove(...pos(a[i-1]),...pos(c))&&g.canMove(...pos(c),...pos(a[i-1]))
      ))])),
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
  assert.equal(metrics.rearRoute,true,'rear ridge slopes are walkable both ways');
  assert.deepEqual(metrics.rearSlopes.map(s=>s.dir),['s','s']);
  assert.equal(metrics.fullClimb,true,'the route is reversible from base to summit');
  assert.equal(metrics.localLadders,0,'highland uses slopes, no ladders');
  assert.ok(Object.values(metrics.allRoutes).every(Boolean),'all four ramps pass movement in both directions');
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
