// Real production-field route audit in Chromium, with no game/save writes.
// This uses the *current* world.canMove, actual collisions/elevation,
// real landmark contact cells and fieldStep; metadata roads are not the answer.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,relative} from 'node:path';

const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8',
  '.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
  '.json':'application/json','.png':'image/png','.webp':'image/webp',
  '.woff2':'font/woff2','.jpg':'image/jpeg','.ogg':'audio/ogg'};
const server=createServer(async(req,res)=>{
 try{
   const u=new URL(req.url,'http://localhost');
   const local=resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));
   if(relative(root,local).startsWith('..')){res.writeHead(403);res.end();return;}
   const data=await readFile(local);
   res.writeHead(200,{'Content-Type':mime[extname(local)]||'application/octet-stream',
     'Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('Not Found');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
await mkdir('artifacts',{recursive:true});
let browser,page,report;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 page=await browser.newPage({viewport:{width:874,height:402},deviceScaleFactor:2});
 page.setDefaultTimeout(60000);
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 page.on('response',res=>{
   if(res.status()>=400&&res.url().startsWith('http://127.0.0.1:'))
     errors.push(res.status()+' '+res.url());
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/src/field/',
   {waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(window.YK_WORLD?.mapData?.travelReachable)&&
   document.querySelector('#load')?.hidden===true,null,{timeout:60000});
 report=await page.evaluate(async()=>{
   const w=window.YK_WORLD,transitions=window.YK_AREA_TRANSITIONS;
   const [{villageArrival,placeArrival,fieldStep},{traceFieldRoute,replayMovementPath,battleIntervalEnvelope}]=
     await Promise.all([
       import('/src/field/runtime.mjs'),
       import('/tools/field-route-pathfinder.mjs')
     ]);
   const begin=villageArrival(),shrineStart=placeArrival('shrine');
   const routes=[
     {from:'village',to:'shrine',entry:begin,metadata:w.roads[0]},
     {from:'shrine',to:'cove',entry:shrineStart,metadata:w.roads[1]}
   ];
   const records=routes.map(({from,to,entry,metadata})=>{
     const result=traceFieldRoute({
       world:w,from:entry,destination:to,
       contact:(x,y)=>transitions.contact(w,x,y)
     });
     const replay=result.reachable?replayMovementPath({
       path:result.path,fieldStep,tileSize:w.tileSize
     }):{success:false,reason:result.reason};
     return {
       from,to,entry:entry.map(px=>Math.floor(px/w.tileSize)),
       authoredMetadataSteps:metadata.slice(1).reduce((sum,p,i)=>
         sum+(Math.abs(p[0]-metadata[i][0])+Math.abs(p[1]-metadata[i][1]))/w.tileSize,0),
       reachable:result.reachable,actualWalkSteps:result.steps,
       reachedContactCell:result.toCell,visited:result.visited,
       blockedMoves:result.blockedMoves,
       replay,relevantEncounterInterval:result.reachable?
         battleIntervalEnvelope(result.steps):null,
       path:result.path
     };
   });
   // Unconnected places are measured only as reference destinations; do not
   // claim they are working gameplay entrances or imply available merchants.
   return {
     source:'production-src/field',worldRevision:w.revision,
     mapSize:[w.mapData[0].length,w.mapData.length],
     start:begin.map(px=>Math.floor(px/w.tileSize)),
     shrineExit:shrineStart.map(px=>Math.floor(px/w.tileSize)),
     routes:records,
     restStopsAreOnlyMetadata:w.restStops.map(({id,name,cell})=>({id,name,cell})),
     liveTransitions:['village','shrine','cove'],
     note:'Paths use live world.canMove/fieldStep. They are shortest walkable paths, not user exploration or guaranteed battle counts.'
   };
 });
 report.browserErrors=errors;
 await writeFile('artifacts/field-route-playability.json',JSON.stringify(report,null,2)+'\n');
 const summary={source:report.source,revision:report.worldRevision,
   size:report.mapSize,routes:report.routes.map(({from,to,authoredMetadataSteps,actualWalkSteps,reachable,visited,replay,relevantEncounterInterval})=>
     ({from,to,authoredMetadataSteps,actualWalkSteps,reachable,visited,replay:replay.success,encounterEnvelope:relevantEncounterInterval})),
   browserErrors:errors};
 console.log('FIELD_REAL_WALK_AUDIT '+JSON.stringify(summary));
 assert.deepEqual(report.mapSize,[80,80]);
 assert.deepEqual(report.liveTransitions,['village','shrine','cove']);
 assert.deepEqual(errors,[],'production field assets/scripts must load');
 for(const item of report.routes){
   assert.ok(item.reachable,
     item.from+' -> '+item.to+' must have an actual collision-safe, cardinal route');
   assert.ok(item.actualWalkSteps>0);
   assert.ok(item.replay.success,
     'actual fieldStep must accept every path edge '+item.from+' -> '+item.to+
       ': '+JSON.stringify(item.replay));
   assert.ok(item.relevantEncounterInterval.minimum<=item.relevantEncounterInterval.maximum);
 }
}finally{
 if(page)await page.close();
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
