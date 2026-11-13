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
    await page.screenshot({path:'artifacts/battle-'+width+'x'+height+'-target.png'});
    await frame.locator('#enemy-figure-2').click();
    await frame.locator('#command-list button').first().waitFor({state:'visible',timeout:1500});
   }
  }catch(e){
   issues.push(width+'x'+height+': '+e.message+' '+errors.join(';'));
   await page.screenshot({path:'artifacts/battle-'+width+'x'+height+'-failure.png'});
  }finally{await page.close();}
 }
}finally{await chromiumBrowser.close();server.close();}
console.log('BATTLE_BROWSER_QA '+JSON.stringify({summary:results.map(({name,rects,overlapIssues,layout,mainGrid})=>({name,rects,overlapIssues,layout,mainGrid})),issues},null,2));
if(issues.length)throw Error('Battle layout failed: '+issues.join(' | '));
