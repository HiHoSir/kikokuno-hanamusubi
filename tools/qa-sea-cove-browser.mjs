// Production-only browser QA: title admission -> shell -> cove, using real
// local assets and actual canvas frames, not a fabricated screenshot.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';

const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8',
 '.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json','.png':'image/png','.webp':'image/webp',
 '.ogg':'audio/ogg','.mp4':'video/mp4','.m4a':'audio/mp4','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
   const url=new URL(req.url,'http://localhost');
   const target=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
   if(relative(root,target).startsWith('..')){res.writeHead(403);res.end();return;}
   const bytes=await readFile(target);
   res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream'});
   res.end(bytes);
 }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:874,height:402},deviceScaleFactor:2});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{
   if(response.status()>=400&&response.url().startsWith('http://127.0.0.1:'))
     errors.push('HTTP '+response.status()+' '+response.url());
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
   window.KIKOKU_ROUTE.go(new URL('src/game/?build=save-slots-1-sea-cove-1',document.baseURI));
 });
 await page.waitForURL(url=>url.pathname.endsWith('/src/game/'),{timeout:15000});
 await page.waitForFunction(()=>Boolean(window.KIKOKU_GAME),null,{timeout:15000});
 // Simulate a fifth completed battle using the actual official player model.
 // The domain test separately proves wins, losses and escape all increment it.
 await page.evaluate(async()=>{
   const rules=await import('./battle/rules.mjs');
   const before=rules.savePlayer({...rules.DEFAULT_PLAYER,completedBattles:4,wins:3});
   rules.savePlayer({...before,completedBattles:5});
 });
 await page.evaluate(()=>window.KIKOKU_GAME.navigate(new URL('./cove/',location.href)));
 await page.waitForFunction(()=>{
   const child=document.querySelector('#game-scene')?.contentWindow;
   try{
     return child?.location.pathname.endsWith('/src/game/cove/') &&
       typeof child.KIKOKU_SAVE_SNAPSHOT==='function' &&
       child.document.querySelector('#load')?.hidden===true;
   }catch{return false;}
 },null,{timeout:40000});
 const initial=await page.evaluate(()=>{
   const frame=document.querySelector('#game-scene'),child=frame.contentWindow;
   const position=child.KIKOKU_SAVE_SNAPSHOT();
   const canvas=child.document.querySelector('#scene');
   const width=child.document.querySelector('.viewport').clientWidth/.78;
   const cameraX=Math.max(0,Math.min(46*32-width,position.position.x-width/2));
   return {label:frame.title,position,canvas:[canvas.width,canvas.height],
     rightmostWorldX:cameraX+width,waterVisible:cameraX+width>39*32,
     menuVisible:!document.querySelector('#field-menu-toggle').hidden,
     shells:child.__COVE_SHELL_QA?.()};
 });
 assert.equal(initial.position.scene,'cove');
 assert.equal(initial.waterVisible,true,'first view includes the moving sea, not only grass');
 assert.ok(initial.canvas[0]>0&&initial.canvas[1]>0);
 assert.equal(initial.menuVisible,true);
 assert.equal(initial.shells.completedBattles,5);
 assert.ok(initial.shells.available>=1&&initial.shells.available<=3,
   'real stored fifth battle deposits 1–3 shells on fixed sand sites');
 assert.equal(initial.shells.gold,0,'shells do not print money on spawn');
 const waterBefore=await page.screenshot({path:'artifacts/sea-cove-entry.png'});
 await page.waitForTimeout(260);
 const middle=await page.screenshot({path:'artifacts/sea-cove-water.png'});
 await page.waitForTimeout(270);
 const after=await page.screenshot();
 assert.ok(!waterBefore.equals(middle)||!waterBefore.equals(after),
   'sea must animate during idle play');
 const yBefore=(await page.evaluate(()=>
   document.querySelector('#game-scene').contentWindow.KIKOKU_SAVE_SNAPSHOT().position.y));
 // The parent owns the UI. Inject into the admitted child window so focus on
 // the parent overlay cannot accidentally turn this into a focus-only test.
 await page.evaluate(()=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));
 });
 await page.waitForTimeout(380);
 await page.evaluate(()=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowUp',bubbles:true,cancelable:true}));
 });
 await page.waitForTimeout(100);
 const yAfter=(await page.evaluate(()=>
   document.querySelector('#game-scene').contentWindow.KIKOKU_SAVE_SNAPSHOT().position.y));
 console.log(JSON.stringify({movement:{yBefore,yAfter}}));
 assert.ok(yAfter<yBefore,'hero must walk across the authored shore');
 // Move across the walkable southern grass and beach towards an actual native
 // shell sprite. The existing cove controls, not hidden test-only teleport,
 // must bring the hero into the 36px collection range.
 await page.evaluate(()=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
 });
 await page.waitForTimeout(1190);
 await page.evaluate(()=>{
   const child=document.querySelector('#game-scene').contentWindow;
   child.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowRight',bubbles:true,cancelable:true}));
 });
 await page.waitForTimeout(100);
 await page.waitForFunction(()=>Boolean(document.querySelector('#game-scene')
   ?.contentWindow.__COVE_SHELL_QA?.().nearest),null,{timeout:2500});
 const near=await page.evaluate(()=>document.querySelector('#game-scene').contentWindow.__COVE_SHELL_QA());
 assert.ok(near.nearest,'A interaction has a real nearby collectible');
 await page.screenshot({path:'artifacts/sea-cove-shell-near.png'});
 await page.evaluate(()=>document.querySelector('#game-scene')
  .contentDocument.querySelector('#action-a').click());
 await page.waitForFunction(available=>document.querySelector('#game-scene')
  ?.contentWindow.__COVE_SHELL_QA?.().available===available-1,
  initial.shells.available,{timeout:2000});
 const afterPickup=await page.evaluate(()=>document.querySelector('#game-scene').contentWindow.__COVE_SHELL_QA());
 assert.equal(Object.values(afterPickup.bag).reduce((a,b)=>a+b,0),1);
 assert.equal(afterPickup.gold,0,'collecting does not give immediate gold');
 const persisted=await page.evaluate(()=>{
   const raw=localStorage.getItem('kikokuno-hanamusubi-battle-player');
   return JSON.parse(raw)?.shells;
 });
 assert.equal(Object.values(persisted.bag).reduce((a,b)=>a+b,0),1);
 await page.screenshot({path:'artifacts/sea-cove-shell-picked.png'});
 assert.deepEqual(errors,[],'no runtime JS exceptions or missing local assets');
 console.log(JSON.stringify({result:'sea-cove-shells-passed',entry:initial,yBefore,yAfter,
   shellPickup:{before:initial.shells.available,after:afterPickup.available,
     bag:afterPickup.bag,nearest:near.nearest},
   screenshots:['artifacts/sea-cove-entry.png','artifacts/sea-cove-water.png',
     'artifacts/sea-cove-shell-near.png','artifacts/sea-cove-shell-picked.png']}));
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
