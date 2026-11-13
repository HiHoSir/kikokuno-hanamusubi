// Browser-level combat layout QA: portrait B, landscape A, 1 & 2 enemies.
// Run with `npm install --no-save playwright@1.62.1` and `node tools/qa-battle-browser.mjs`.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8',
'.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
'.json':'application/json','.png':'image/png','.webp':'image/webp',
'.ogg':'audio/ogg','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
  if(relative(root,file).startsWith('..')){res.writeHead(403);res.end();return;}
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('artifacts',{recursive:true});
const chromiumBrowser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const results=[],issues=[];
const rect=e=>{const r=e?.getBoundingClientRect();return r?
 {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
 right:Math.round(r.right),bottom:Math.round(r.bottom)}:null;};
try{
 for(const [width,height,enemyId,count] of [
  [900,390,'tanuki',2],[1536,706,'tanuki',2],
  [390,844,'tanuki',2],[375,667,'field-oni',1]
 ]){
  const page=await chromiumBrowser.newPage({viewport:{width,height},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  try{
   await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
   await page.evaluate(({enemyId,count})=>{
    sessionStorage.setItem('kikokuno-hanamusubi-next-entry',JSON.stringify({route:'/src/game/',expiresAt:Date.now()+120000}));
    sessionStorage.setItem('kikokuno-hanamusubi-battle-request',JSON.stringify({enemyId,count,at:Date.now()}));
   },{enemyId,count});
   await page.goto(origin+'/src/game/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.KIKOKU_GAME?.navigate,{timeout:20000});
   await page.evaluate(()=>window.KIKOKU_GAME.navigate(new URL('/src/game/battle/',location.href).href));
   await page.waitForFunction(()=>{
    const d=document.querySelector('iframe')?.contentDocument;
    return d?.getElementById('encounter')?.hidden===true &&
     d?.getElementById('hero-image')?.naturalWidth>0 &&
     d?.getElementById('enemy-image')?.naturalWidth>0 &&
     d?.getElementById('command-list')?.children?.length===5;
   },null,{timeout:20000});
   await page.waitForFunction(()=>{
    const d=document.querySelector('iframe')?.contentDocument;
    const enemies=[...d?.querySelectorAll('.actor.enemy:not([hidden]) img')||[]];
    return enemies.length>0&&enemies.every(img=>img.dataset.enemyPixelated==='yes');
   },null,{timeout:20000});
   const data=await page.evaluate(()=>{
    const d=document.querySelector('iframe').contentDocument;
    const ids=['battle-stage','hero-figure','enemy-figure','enemy-figure-2',
     'command-list','hp-label','mp-label','action-a','action-b','pad','battle-message',
     'command-title'];
    const names={'viewport':'.viewport','command':'.command-window',
     'status':'.status-window','message':'.battle-message',
     'stage':'.battle-stage','dpad':'#pad .dpad',
     'a':'#action-a','b':'#action-b','pad':'#pad',
     'enemy1':'#enemy-figure','enemy2':'#enemy-figure-2','hero':'#hero-figure'};
    const bounding=e=>{const r=e?.getBoundingClientRect();return r?
     {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}:null;};
    const rects=Object.fromEntries(Object.entries(names).map(([k,s])=>[k,bounding(d.querySelector(s))]));
    const pic=id=>({loaded:d.getElementById(id)?.naturalWidth>0,
     natural:[d.getElementById(id)?.naturalWidth,d.getElementById(id)?.naturalHeight]});
    return {size:[innerWidth,innerHeight],rects,mainGrid:d.defaultView.getComputedStyle(d.querySelector('main')).gridTemplateRows,
     viewportGrid:d.defaultView.getComputedStyle(d.querySelector('.viewport')).gridTemplateAreas,
     controlRows:[...d.getElementById('command-list').children].map(e=>({text:e.textContent,rect:bounding(e)})),
     enemyHidden:d.getElementById('enemy-figure-2').hidden,
     pictures:{hero:pic('hero-image'),enemy:pic('enemy-image'),second:pic('enemy-image-2')},
     musicParent:!!document.querySelector('#sound-toggle')};
   });
   // Validate the real background image that the production HTML and CSS use.
   const backdrop=await page.evaluate(async()=>{
    const frame=document.querySelector('iframe');
    const d=frame.contentDocument,main=d.querySelector('main');
    const node=d.querySelector('.battle-backdrop');
    const style=d.defaultView.getComputedStyle(node);
    const url=style.backgroundImage.match(/url\(["']?([^"')]+)/)?.[1];
    if(!url)return {terrain:main.dataset.battleTerrain,error:'CSS has no image'};
    const bitmap=new frame.contentWindow.Image();
    bitmap.src=new URL(url,d.location.href).href;
    await bitmap.decode();
    return {terrain:main.dataset.battleTerrain,
     width:bitmap.naturalWidth,height:bitmap.naturalHeight,
     imageRendering:style.imageRendering,url:bitmap.src};
   });
   if(backdrop.terrain!=='grassland'||backdrop.width!==384||backdrop.height!==216||
       backdrop.imageRendering!=='pixelated'){
    issues.push(width+'x'+height+' grassland backdrop missing/unreadable: '+JSON.stringify(backdrop));
   }
   const pixelArt=await page.evaluate(()=>{
    const d=document.querySelector('iframe').contentDocument;
    return [...d.querySelectorAll('.actor.enemy:not([hidden]) img')].map(img=>({
      state:img.dataset.enemyPixelated,
      dimensions:[img.naturalWidth,img.naturalHeight],
      dataURL:img.currentSrc.startsWith('data:image/png'),
      interpolation:d.defaultView.getComputedStyle(img).imageRendering
    }));
   });
   if(pixelArt.length!==count||pixelArt.some(item=>
       item.state!=='yes'||!item.dataURL||
       Math.max(...item.dimensions)>64||item.interpolation!=='pixelated')){
     issues.push(width+'x'+height+' enemy sprite pixelation failed: '+JSON.stringify(pixelArt));
   }
   const overlaps=(a,b)=>{
    if(!a||!b)return 0;
    return Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*
      Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));
   };
   const rects=data.rects;
   const overlapIssues=[];
   for(const key of ['command','status','message']){
    for(const control of ['dpad','a','b']){
     if(overlaps(rects[key],rects[control])>4)overlapIssues.push(key+'-'+control);
    }
   }
   for(const [name,r] of Object.entries(rects)){
    if(!r||['pad'].includes(name))continue;
    if(name==='enemy2'&&count===1)continue;
    if(r.w<2||r.h<2)overlapIssues.push(name+' has zero dimensions');
   }
   const enemiesCanFit=rects.enemy1 && rects.enemy1.y>=rects.stage.y-4 &&
      rects.enemy1.bottom<=rects.stage.bottom+4 &&
      (!count || count===1 || rects.enemy2?.right<=rects.stage.right+4);
   if(!enemiesCanFit)overlapIssues.push('enemy sprites clipped by stage');
   if(rects.hero && rects.hero.bottom>rects.stage.bottom+4)overlapIssues.push('hero below stage');
   if(rects.command?.bottom>height+1||rects.message?.bottom>height+1)overlapIssues.push('panel below viewport');
   if(data.enemyHidden !== (count===1))overlapIssues.push('wrong number of enemies');
   if(count===2 && rects.enemy1.x>=rects.enemy2.x){
    overlapIssues.push('enemy numbering must progress left to right');
   }
   if(height>width && rects.stage.h<height*.49){
    overlapIssues.push('portrait battle stage takes insufficient vertical area');
   }
   const shot='artifacts/battle-'+width+'x'+height+'-'+count+'enemy.png';
   await page.screenshot({path:shot});
   const name=width+'x'+height+'/'+count+'enemy';
   if(overlapIssues.length)issues.push(name+': '+overlapIssues.join(', '));
   if(errors.some(e=>/Error|TypeError|ReferenceError/.test(e)))issues.push(name+' JS errors '+errors.join(','));
   results.push({name,rects,rows:data.controlRows,layout:data.viewportGrid,mainGrid:data.mainGrid,graphics:data.pictures,overlapIssues,screenshot:shot,errors:errors.slice(0,5)});
   if(count===2){
    const frame=page.frameLocator('#game-scene');
    await frame.locator('[data-command="attack"]').click();
    const chosen=await frame.locator('#enemy-figure').evaluate(x=>x.classList.contains('targeted'));
    const secondVisible=await frame.locator('#enemy-figure-2').isVisible();
    if(!chosen||!secondVisible)issues.push(name+' two-target cursor not visible');
    const cursor=await frame.locator('#enemy-figure').evaluate(el=>{
     const r=el.getBoundingClientRect();
     const style=getComputedStyle(el,'::before');
     return {position:r.bottom-Number.parseFloat(style.bottom),top:r.top,bottom:r.bottom};
    });
    if(height>width && cursor.position<cursor.top+60){
     issues.push(name+' target marker floats above the visible portrait sprite');
    }
    await page.screenshot({path:'artifacts/battle-'+width+'x'+height+'-target.png'});
    if(height>width){
     // Rotate while the target submenu is open. A CSS-only orientation
     // change must preserve the selected enemy and current command state.
     await page.setViewportSize({width:900,height:390});
     const stateAfterRotation=await frame.locator('#enemy-figure').evaluate(el=>({
      target:el.classList.contains('targeted'),
      stillSelecting:document.querySelector('#command-title')?.textContent==='標的を選ぶ'
     }));
     if(!stateAfterRotation.target||!stateAfterRotation.stillSelecting)
      issues.push(name+' target selection reset on landscape rotation');
     await page.setViewportSize({width,height});
    }
    // Two attacks against the second enemy must remove that specific sprite,
    // while the first remains alive. This proves independent HP and targeting.
    await frame.locator('#enemy-figure-2').click();
    // Combat now animates before removing a defeated figure. Verify actual
    // DOM/paint progression, not just final hit points.
    const early=await frame.locator('#enemy-figure-2').evaluate(node=>({
     hidden:node.hidden,firstAlive:!document.getElementById('enemy-figure').hidden
    }));
    if(early.hidden||!early.firstAlive)issues.push(name+' target hidden before first hit animation');
    await frame.locator('#enemy-figure-2.impact-physical').waitFor({state:'attached',timeout:900});
    if(await frame.locator('#enemy-figure-2').evaluate(node=>node.hidden))
     issues.push(name+' impact started after enemy disappeared');
    const attackPhase=await frame.locator('#hero-image').evaluate(node=>({
     pose:node.dataset.pose,src:node.getAttribute('src'),
     heroHit:document.getElementById('hero-figure').classList.contains('impact-hit')
    }));
    if(attackPhase.pose!=='attack'||!attackPhase.src.includes('/attack.png')||attackPhase.heroHit)
     issues.push(name+' attack action used hit pose before enemy retaliation');
    await page.screenshot({path:'artifacts/battle-'+width+'x'+height+'-attack.png'});
    await frame.locator('#hero-figure.impact-hit').waitFor({state:'attached',timeout:1200});
    const retaliationPhase=await frame.locator('#hero-image').evaluate(node=>({
     pose:node.dataset.pose,src:node.getAttribute('src'),
     enemyFX:document.getElementById('enemy-figure-2').classList.contains('impact-physical')
    }));
    if(retaliationPhase.pose!=='hit'||!retaliationPhase.src.includes('/hit.png')||retaliationPhase.enemyFX)
     issues.push(name+' hit pose overlaps physical attack animation or uses wrong image');
    const fx=await frame.locator('#enemy-figure-2 .impact-effect').evaluate(node=>{
     const p=node.getBoundingClientRect(),actor=node.closest('figure').getBoundingClientRect();
     return {height:p.height,top:p.top,actorTop:actor.top,actorHeight:actor.height};
    });
    if(height>width && fx.top<fx.actorTop+fx.actorHeight*.45)
     issues.push(name+' attack FX is floating above enemy sprite');
    const staleCursor=await frame.locator('.actor.enemy.targeted').count();
    if(staleCursor)issues.push(name+' cursor remains on another enemy during attack');
    await page.screenshot({path:'artifacts/battle-'+width+'x'+height+'-impact.png'});
    await frame.locator('[data-command="attack"]').click();
    await frame.locator('#enemy-figure-2').click();
    await frame.locator('#enemy-figure-2.impact-physical').waitFor({state:'attached',timeout:900});
    if(await frame.locator('#enemy-figure-2').evaluate(node=>node.hidden))
     issues.push(name+' defeated target was hidden before last impact');
    await frame.locator('#enemy-figure-2[hidden]').waitFor({state:'attached',timeout:1500});
    const targetResult=await frame.locator('#enemy-figure-2').evaluate(el=>({
     secondDefeated:el.hidden,
     firstAlive:!document.querySelector('#enemy-figure').hidden
    }));
    if(!targetResult.secondDefeated||!targetResult.firstAlive)
     issues.push(name+' independent target HP was not respected');
    // A submenu can be entered and dismissed without leaving the fight.
    await frame.locator('[data-command="magic"]').click();
    const spellShown=await frame.locator('#command-title').innerText();
    if(spellShown!=='術を選ぶ')issues.push(name+' spell submenu is inaccessible');
    await frame.locator('#action-b').click();
    const mainShown=await frame.locator('#command-title').innerText();
    if(mainShown!=='緋月の行動')issues.push(name+' B button failed to return from spell menu');
   }
  }catch(e){
   issues.push(width+'x'+height+': '+e.message+' '+errors.join(';'));
   await page.screenshot({path:'artifacts/battle-'+width+'x'+height+'-failure.png'});
  }finally{await page.close();}
 }
}finally{await chromiumBrowser.close();server.close();}
console.log('BATTLE_BROWSER_QA '+JSON.stringify({summary:results.map(({name,rects,overlapIssues,layout,mainGrid})=>({name,rects,overlapIssues,layout,mainGrid})),issues},null,2));
if(issues.length)throw Error('Battle layout failed: '+issues.join(' | '));
