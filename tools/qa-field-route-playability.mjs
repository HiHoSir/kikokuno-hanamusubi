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
 const origin='http://127.0.0.1:'+server.address().port;
 // Use the same real parent game shell as the established production QA:
 // the standalone /src/field/ URL is not a supported game entry point.
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
   sessionStorage.setItem('kikokuno-hanamusubi-next-entry',JSON.stringify({
     route:'/src/game/',expiresAt:Date.now()+120000
   }));
 });
 await page.goto(origin+'/src/game/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>Boolean(window.KIKOKU_GAME?.navigate),
   null,{timeout:20000});
 await page.evaluate(()=>window.KIKOKU_GAME.navigate(
   new URL('/src/field/?from=village',location.href).href));
 try{
   await page.waitForFunction(()=>{
     const f=document.querySelector('iframe')?.contentWindow;
     return Boolean(f?.YK_WORLD?.mapData?.travelReachable)&&
       f?.document?.querySelector('#load')?.hidden===true;
   },null,{timeout:30000});
 }catch(error){
   const details=await page.evaluate(()=>({
     shell:location.href,iframe:document.querySelector('iframe')?.src,
     message:document.querySelector('iframe')?.contentDocument?.querySelector('#load')?.textContent,
     errors:window.__FIELD_ERRORS??[]
   }));
   throw Error('Field did not load inside the parent shell: '+JSON.stringify(details)+
     ' ('+error.message+')');
 }
 const frame=page.frames().find(f=>f.url().includes('/src/field/'));
 if(!frame)throw Error('The approved field iframe is missing');
 report=await frame.evaluate(async()=>{
   const w=window.YK_WORLD,transitions=window.YK_AREA_TRANSITIONS;
   const [{fieldExitPosition,fieldStep},{traceFieldRoute,replayMovementPath,battleIntervalEnvelope},{FIELD_PLACE_ROUTES}]=
     await Promise.all([
       import('/src/field/runtime.mjs'),
       import('/tools/field-route-pathfinder.mjs'),
       import('/src/field/landmarks.mjs')
     ]);
   const begin=fieldExitPosition('village'),shrineStart=fieldExitPosition('shrine'),coveStart=fieldExitPosition('cove');
   const routes=[
     {from:'village',to:'shrine',entry:begin,metadata:w.roads[0]},
     {from:'shrine',to:'cove',entry:shrineStart,metadata:w.roads[1]},
     {from:'cove',to:'shiomachi',entry:coveStart,metadata:null}
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
       authoredMetadataSteps:metadata?metadata.slice(1).reduce((sum,p,i)=>
         sum+(Math.abs(p[0]-metadata[i][0])+Math.abs(p[1]-metadata[i][1]))/w.tileSize,0):null,
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
     coveExit:coveStart.map(px=>Math.floor(px/w.tileSize)),
     routes:records,
     restStopsAreOnlyMetadata:w.restStops.map(({id,name,cell})=>({id,name,cell})),
     liveTransitions:Object.keys(FIELD_PLACE_ROUTES).map(id=>{
       const point=fieldExitPosition(id);
       if(transitions.contact(w,...point)!==id||!w.walkable(...point))
         throw Error('Field exit must stand on its walkable marker: '+id);
       return id;
     }),
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
 assert.deepEqual(report.liveTransitions,['village','shrine','cove','shiomachi','kozuene','cave']);
 assert.deepEqual(errors,[],'production field assets/scripts must load');
 for(const id of report.liveTransitions){
   await page.evaluate(id=>window.KIKOKU_GAME.navigate(
     new URL('/src/field/?from='+id,location.href)),id);
   await page.waitForFunction(id=>{
     const field=document.querySelector('#game-scene')?.contentWindow;
     if(field?.location.pathname!=='/src/field/'||
       new URL(field.location.href).searchParams.get('from')!==id)return false;
     const position=field.KIKOKU_SAVE_SNAPSHOT?.()?.position;
     return position?.row===0&&field.YK_AREA_TRANSITIONS.contact(
       field.YK_WORLD,position.x,position.y)===id;
   },id);
 }
 assert.deepEqual(errors,[],'each return loads and leaves the hero facing the camera on its marker');
 // Live collision checks include the cove's new waterfront entrance.
 const recordedWalkDistances={shrine:42,cove:39};
 for(const item of report.routes){
   assert.ok(item.reachable,
     item.from+' -> '+item.to+' must have an actual collision-safe, cardinal route');
   if(Object.hasOwn(recordedWalkDistances,item.to))
     assert.equal(item.actualWalkSteps,recordedWalkDistances[item.to],
       'walk distance changed from the documented route: '+item.from+' -> '+item.to);
   if(item.to==='cove')assert.deepEqual(item.reachedContactCell,[49,53]);
   if(item.to==='shiomachi'){
     assert.ok(item.actualWalkSteps<=16,'new coastal village must remain a short walk from cove');
     const [x,y]=item.reachedContactCell;
     assert.ok([53,54].includes(x)&&y===51,'route ends on one of the painted village cells');
   }
   assert.ok(item.actualWalkSteps>0);
   assert.ok(item.replay.success,
     'actual fieldStep must accept every path edge '+item.from+' -> '+item.to+
       ': '+JSON.stringify(item.replay));
   assert.ok(item.relevantEncounterInterval.minimum<=item.relevantEncounterInterval.maximum);
 }
 // A real field encounter starts through the game shell and returns to the
 // same shoreline cell. Control randomness only inside this test.
 await page.addInitScript(()=>{
   if(location.pathname==='/src/field/'||location.pathname==='/src/game/battle/')Math.random=()=>.05;
 });
 await page.evaluate(()=>{
   sessionStorage.setItem('kikokuno-hanamusubi-restore-position',JSON.stringify({
     scene:'field',position:{x:1520,y:1648,row:1}
   }));
   window.KIKOKU_GAME.navigate(new URL('/src/field/?from=village',location.href));
 });
 const liveField=page.frameLocator('#game-scene');
 await liveField.locator('#load').waitFor({state:'hidden'});
 await page.waitForFunction(()=>{
   const field=document.querySelector('#game-scene')?.contentWindow;
   return field?.location.pathname==='/src/field/'&&field.KIKOKU_SAVE_SNAPSHOT?.()?.position.x===1520;
 });
 const coastFrame=page.frames().find(f=>f.url().includes('/src/field/?from=village'));
 for(let step=0;step<9;step++){
   const right=step%2===0;
   await coastFrame.evaluate(key=>{
     dispatchEvent(new KeyboardEvent('keydown',{key}));
     dispatchEvent(new KeyboardEvent('keyup',{key}));
   },right?'ArrowRight':'ArrowLeft');
   if(step<8)await coastFrame.waitForFunction(x=>window.KIKOKU_SAVE_SNAPSHOT?.()?.position.x===x,
     right?1552:1520);
 }
 await liveField.getByRole('img',{name:'潮鋏'}).evaluate(img=>img.decode());
 await liveField.locator('#encounter').waitFor({state:'hidden'});
 await liveField.getByRole('button',{name:'にげる',exact:true}).click();
 await page.waitForFunction(()=>{
   const battle=document.querySelector('#game-scene')?.contentDocument;
   return battle?.querySelector('#command-title')?.textContent==='退却';
 },null,{timeout:5000}).catch(async error=>{
   throw new Error('潮鋏から退却できない: '+await liveField.locator('#battle-message').textContent(),{cause:error});
 });
 await liveField.getByRole('button',{name:'フィールドへ戻る',exact:true}).click();
 await page.waitForFunction(()=>{
   const field=document.querySelector('#game-scene')?.contentWindow;
   const position=field?.KIKOKU_SAVE_SNAPSHOT?.()?.position;
   return field?.location.pathname==='/src/field/'&&position?.x===1552&&position.y===1648;
 });
 await page.goto(origin+'/previews/field-exploration/?view=enemies');
 await page.locator('#zones button[aria-pressed="true"]').waitFor();
 assert.match(await page.locator('#details').textContent(),/橋の北岸から梢音村.*木霊/s);
 assert.deepEqual(await page.getByRole('row',{name:/^木霊/}).locator('th,td').allTextContents(),
   ['木霊','72','49','16','250','72']);
 await page.getByRole('button',{name:'梢音村から忘れの森'}).click();
 assert.match(await page.locator('#details').textContent(),/迷い蜘蛛.*紅葉木霊.*藍糸蜘蛛/s);
 const portraits=await page.locator('#details .enemy:has(img)').evaluateAll(cards=>cards.map(card=>({
   name:card.textContent,
   filter:getComputedStyle(card.querySelector('img')).filter
 })));
 assert.deepEqual(portraits.map(entry=>entry.name),['木霊','迷い蜘蛛','紅葉木霊','藍糸蜘蛛','落葉隠れ']);
 assert.deepEqual(portraits.slice(0,2).map(entry=>entry.filter),['none','none']);
 assert.match(portraits[2].filter,/hue-rotate\(-76deg\)/);
 assert.match(portraits[3].filter,/hue-rotate\(217deg\)/);
 assert.equal(await page.getByRole('row',{name:/^藍糸蜘蛛/}).count(),1);
 assert.equal(await page.locator('#map [data-zone="forest"]').getAttribute('opacity'),'1');
 await page.locator('#details img').first().evaluate(img=>img.decode());
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),
   'encounter map and region controls fit a phone viewport');
 assert.equal(await page.locator('[data-encounter-zone="forest"] [data-enemy="leafStalker"]').count(),1);
 const beforeTrial=await page.evaluate(()=>[JSON.stringify(localStorage),JSON.stringify(sessionStorage)]);
 await page.getByRole('group',{name:'藍糸蜘蛛',exact:true}).getByRole('button',{name:'2体と試しに戦う'}).click();
 const trial=page.getByRole('dialog');
 assert.equal(await trial.getByRole('img',{name:'藍糸蜘蛛'}).count(),2);
 await trial.getByRole('button',{name:'攻撃',exact:true}).click();
 assert.match(await trial.locator('.trial-log').textContent(),/緋月は.*の傷/);
 await trial.getByRole('button',{name:'つむぎ'}).click();
 assert.match(await trial.locator('.trial-log').textContent(),/回復/);
 for(let i=0;i<8&&await trial.getByRole('button',{name:'攻撃',exact:true}).isEnabled();i++)
   await trial.getByRole('button',{name:'攻撃',exact:true}).click();
 assert.match(await trial.locator('.trial-log').textContent(),/勝利　心580・168両/);
 await trial.getByRole('button',{name:'やり直す'}).click();
 assert.match(await trial.locator('.trial-status').textContent(),/1ターン/);
 await trial.getByRole('button',{name:'閉じる'}).click();
 await trial.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'山越えの洞窟',exact:true}).click();
 assert.match(await page.locator('#details').textContent(),/鉱灯蝙蝠.*岩骨ムカデ.*晶殻ヤドカリ/s);
 assert.deepEqual(await page.getByRole('row',{name:/^晶殻ヤドカリ/}).locator('th,td').allTextContents(),
   ['晶殻ヤドカリ','185','112','88','600','195']);
 assert.match(await page.locator('#details').textContent(),/技案（試戦では未使用）.*晶殻。/s);
 await page.getByRole('group',{name:'晶殻ヤドカリ',exact:true}).getByRole('button',{name:'試しに戦う',exact:true}).click();
 await trial.getByRole('img',{name:'晶殻ヤドカリ'}).evaluate(img=>img.decode());
 await trial.getByRole('button',{name:'糸遊'}).click();
 assert.match(await trial.locator('.trial-log').textContent(),/晶殻ヤドカリ.*30の傷/);
 await trial.getByRole('button',{name:'閉じる'}).click();
 await trial.waitFor({state:'hidden'});
 await page.getByRole('group',{name:'鉱灯蝙蝠',exact:true}).getByRole('button',{name:'2体と試しに戦う'}).click();
 assert.equal(await trial.locator('.trial-portraits strong').count(),2);
 assert.equal(await trial.getByLabel('緋月の装備').locator('option').textContent(),'26段・T5相当の設計値');
 await trial.getByRole('button',{name:'閉じる'}).click();
 await trial.waitFor({state:'hidden'});
 assert.deepEqual(await page.evaluate(()=>[JSON.stringify(localStorage),JSON.stringify(sessionStorage)]),beforeTrial);
 assert.deepEqual(errors,[],'encounter planning map loads the production terrain and enemy assets');
}finally{
 if(page)await page.close();
 if(browser)await browser.close();
 await new Promise(ok=>server.close(ok));
}
