// Screenshot-based browser QA for the review-only Shiomachi village.
// Reads real files/PNGs in Chromium, checks layout, controls and animated sea.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import {createHash} from 'node:crypto';

const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8',
 '.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json','.png':'image/png','.webp':'image/webp',
 '.ogg':'audio/ogg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
   const url=new URL(req.url,'http://127.0.0.1');
   const file=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
   if(relative(root,file).startsWith('..')){res.writeHead(403);res.end();return;}
   const bytes=await readFile(file);
   res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});
   res.end(bytes);
 }catch{res.writeHead(404);res.end('not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:874,height:402},deviceScaleFactor:2,
   isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',err=>errors.push('JS '+err.message));
 page.on('response',res=>{
   if(res.status()>=400&&res.url().startsWith('http://127.0.0.1:'))
     errors.push('HTTP '+res.status()+' '+res.url());
 });
 await page.goto('http://127.0.0.1:'+server.address().port+
   '/previews/shiomachi-village/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__SHIOMACHI_QA?.ready===true,null,{timeout:45000});
 const qa=await page.evaluate(()=>{
   const data=window.__SHIOMACHI_QA;
   const canvas=document.querySelector('#scene').getBoundingClientRect();
   const view=document.querySelector('.viewport').getBoundingClientRect();
   return {previewOnly:data.previewOnly,scene:data.scene,zoom:data.cameraZoom,
     renderer:data.renderer,objects:data.objectNames,
     residents:data.residentNames,bounds:data.bounds,
     canvas:[canvas.width,canvas.height],viewport:[view.width,view.height],
     loadHidden:document.querySelector('#load').hidden,
     localCount:localStorage.length,sessionCount:sessionStorage.length};
 });
 assert.equal(qa.previewOnly,true);
 assert.equal(qa.scene,'shiomachi-village');
 assert.equal(qa.zoom,0.5);
 assert.deepEqual(qa.bounds,[42,54]);
 assert.equal(qa.renderer.buildings,4);
 assert.equal(qa.renderer.visibleSigns,3,'inn, armory and teahouse share the native sign images');
 assert.equal(qa.renderer.nativeObjectCount,12);
 assert.deepEqual(qa.renderer.pierSprite,[128,360],
   'the transparent generated sprite must be loaded at its native size');
 assert.equal(qa.renderer.pierWalkableCells,33,
   'the wood pier remains traversable in the real collision map');
 assert.equal(qa.residents.length,4);
 assert.equal(qa.renderer.waveFrames,8);
 assert.ok(qa.renderer.coastTiles>50);
 assert.ok(qa.loadHidden);
 assert.ok(Math.abs(qa.canvas[0]-qa.viewport[0])<2);
 assert.ok(Math.abs(qa.canvas[1]-qa.viewport[1])<2);
 // Compare actual screen-space controls to the existing approved cove review
 // at the exact same landscape iPhone viewport and DPR (not CSS literals).
 const frameControls=async p=>p.evaluate(()=>{
   const bounds=selector=>{
     const rect=document.querySelector(selector).getBoundingClientRect();
     return [rect.x,rect.y,rect.width,rect.height].map(n=>Math.round(n*10)/10);
   };
   return {up:bounds('#up'),left:bounds('#left'),
     down:bounds('#down'),right:bounds('#right'),
     a:bounds('#action-a'),b:bounds('#action-b'),
     pad:bounds('#pad'),viewport:bounds('.viewport'),
     main:bounds('main')};
 });
 const actual=await frameControls(page);
 const reference=await browser.newPage({viewport:{width:874,height:402},
   deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await reference.goto('http://127.0.0.1:'+server.address().port+
   '/previews/sea-cove-review/',{waitUntil:'domcontentloaded'});
 const expected=await frameControls(reference);
 await reference.close();
 assert.deepEqual(actual,expected,'controller position/size must match the sea-cove game review exactly');
 assert.equal(actual.main[2],874,'the preview uses the whole screen, not a centered mini-page');
 assert.equal(actual.viewport[2],874,'map viewport spans the full landscape screen');
 assert.ok(actual.left[0]<actual.main[2]/3,'D-pad is in the bottom-left corner');
 assert.ok(actual.a[0]>actual.main[2]*2/3,'A button is in the bottom-right corner');
 assert.ok(actual.b[0]>actual.main[2]*2/3,'B button is beside A');
 assert.equal(await page.locator('.review-tools').getAttribute('open'),null,
   'debug buttons must not clutter the default gameplay surface');
 await page.screenshot({path:'artifacts/shiomachi-village-start.png'});
 await page.locator('.review-tools summary').click();
 await page.locator('[data-review-spot="shore"]').click();
 const dockReachable=await page.evaluate(()=>{
   const qa=window.__SHIOMACHI_QA;
   return {end:qa.canStand(688,130),mid:qa.canStand(688,240),
     land:qa.canStand(688,440),water:qa.canStand(601,130),
     basketBlocked:qa.canStand(653,147)};
 });
 assert.deepEqual(dockReachable,{end:true,mid:true,land:true,water:false,basketBlocked:false},
   'deck navigation is clear, outer sea blocked, built-in deck props solid');
 await page.waitForTimeout(320);
 const first=await page.locator('#scene').screenshot();
 await page.waitForTimeout(470);
 const second=await page.locator('#scene').screenshot();
 const hash=b=>createHash('sha256').update(b).digest('hex');
 assert.notEqual(hash(first),hash(second),'the actual shoreline needs to animate');
 await page.screenshot({path:'artifacts/shiomachi-village-shore.png'});
 await page.locator('[data-review-spot="worksite"]').click();
 await page.locator('#action-a').click();
 assert.equal(await page.locator('#speaker').textContent(),'網直しの漁師');
 assert.equal(await page.locator('#dialogue').isHidden(),false);
 await page.screenshot({path:'artifacts/shiomachi-village-talk.png'});
 for(let i=0;i<4;i++)await page.locator('#action-a').click();
 assert.equal(await page.locator('#dialogue').isHidden(),true);
 await page.locator('[data-review-spot="buildings"]').click();
 await page.locator('#action-a').click();
 assert.equal(await page.locator('#speaker').textContent(),'村の古老');
 await page.screenshot({path:'artifacts/shiomachi-village-houses.png'});
 for(let i=0;i<4;i++)await page.locator('#action-a').click();
 await page.locator('#collision-toggle').click();
 assert.equal(await page.evaluate(()=>window.__SHIOMACHI_QA.readDebug()),true);
 await page.screenshot({path:'artifacts/shiomachi-village-collision.png'});
 await page.locator('#collision-toggle').click();
 assert.equal(await page.evaluate(()=>window.__SHIOMACHI_QA.readDebug()),false);
 await page.locator('[data-review-spot="south"]').click();
 const before=await page.evaluate(()=>window.__SHIOMACHI_QA.position().y);
 await page.keyboard.down('ArrowUp');
 await page.waitForTimeout(400);
 await page.keyboard.up('ArrowUp');
 const after=await page.evaluate(()=>window.__SHIOMACHI_QA.position().y);
 assert.ok(after<before-25,'the real hero walks up from the southern entrance');
 await page.screenshot({path:'artifacts/shiomachi-village-walk.png'});
 // Three mandatory interiors use the exact canonical game-room graphics and
 // preserve the outdoor controller and the real game save during visits.
 for(const [room,choice] of [['armory','shiomachi-tide-blade'],['inn','sleep'],['teahouse','onigiri']]){
   if(!await page.locator('.review-tools').evaluate(node=>node.open))
     await page.locator('.review-tools summary').click();
   const doorway={armory:'armoryDoor',inn:'innDoor',teahouse:'teahouseDoor'}[room];
   await page.locator('[data-review-spot="'+doorway+'"]').click();
   assert.equal(await page.evaluate(()=>window.__SHIOMACHI_QA.room()),null);
   await page.keyboard.down('ArrowUp');
   await page.waitForTimeout(310);
   await page.keyboard.up('ArrowUp');
   await page.waitForFunction(expected=>window.__SHIOMACHI_QA.room()===expected,room);
   assert.equal(await page.locator('#scene').getAttribute('data-room'),room);
   assert.equal(await page.locator('#load').isHidden(),true);
   await page.screenshot({path:'artifacts/shiomachi-village-'+room+'.png'});
   // Talk to the real armory shop clerk using A, not a fabricated menu.
   if(room==='armory'){
     await page.keyboard.down('ArrowUp');
     await page.waitForTimeout(215);
     await page.keyboard.up('ArrowUp');
     await page.locator('#action-a').click();
     assert.equal(await page.locator('#speaker').textContent(),'兵具屋の店番');
     assert.equal(await page.locator('#dialogue').isHidden(),false);
     await page.locator('#action-a').click(); // Reveal the rest of the line
     await page.locator('#action-a').click(); // Complete the line, open shop
   }else await page.evaluate(()=>window.__SHIOMACHI_QA.openService());
   assert.equal(await page.locator('#shop-panel').isHidden(),false,room+' service opens');
   if(room==='armory'){
     const labels=await page.locator('#shop-options [data-shop-item]').allTextContents();
     for(const word of ['潮切りの太刀','潮革の胴当て','波除けの鉢金','磯歩きの脚絆'])
       assert.ok(labels.some(text=>text.includes(word)),word+' must be for sale in Shiomachi');
     for(const oldName of ['脇差','厚布の胴当て','鉢巻','足袋'])
       assert.ok(!labels.some(text=>text.includes(oldName)),oldName+' belongs to Hozuki village only');
     assert.equal(await page.locator('#shop-options [data-shop-item="wakizashi"]').count(),0);
     assert.equal(await page.locator('#shop-options [data-shop-item="shiomachi-tide-blade"]').count(),1);
   }
   const goldBefore=await page.evaluate(()=>window.__SHIOMACHI_QA.trial().gold);
   await page.locator('#shop-options [data-shop-item="'+choice+'"]').click();
   assert.ok((await page.locator('#shop-message').textContent()).length>3);
   const afterPurchase=await page.evaluate(()=>window.__SHIOMACHI_QA.trial());
   assert.ok(afterPurchase.gold<goldBefore,room+' uses pure preview-only purchase rule');
   if(room==='inn'){
     assert.equal(afterPurchase.hp,afterPurchase.maxhp);
     assert.equal(afterPurchase.mp,afterPurchase.maxmp);
   }else if(room==='armory'){
     assert.equal(afterPurchase.shiomachiGear['shiomachi-tide-blade'],1,
       'purchased item is recorded only in preview inventory');
     const secondGold=afterPurchase.gold;
     await page.locator('#shop-options [data-shop-item="shiomachi-tide-blade"]').click();
     const again=await page.evaluate(()=>window.__SHIOMACHI_QA.trial());
     assert.equal(again.gold,secondGold,'duplicate purchase must not charge twice');
     assert.ok((await page.locator('#shop-message').textContent()).includes('もう持っています'));
   }
   await page.screenshot({path:'artifacts/shiomachi-village-'+room+'-shop.png'});
   await page.locator('#shop-options [data-shop-item="exit"]').click();
   assert.equal(await page.locator('#shop-panel').isHidden(),true);
   // Walk south through the canonical room doorway to the correct exterior,
   // without page navigation or resetting the animated shore/camera.
   await page.keyboard.down('ArrowDown');
   await page.waitForTimeout(740);
   await page.keyboard.up('ArrowDown');
   await page.waitForFunction(()=>window.__SHIOMACHI_QA.room()===null);
   assert.equal(await page.locator('#scene').getAttribute('data-mode'),'exterior');
 }
 const persisted=await page.evaluate(()=>[localStorage.length,sessionStorage.length]);
 assert.deepEqual(persisted,[qa.localCount,qa.sessionCount],
   'preview must never touch the real game save or story');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({ok:true,qa,walked:Math.round(before-after),errors},null,2));
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
