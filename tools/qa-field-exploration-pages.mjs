// Public review route uses the real field HTML and PR terrain delta, without changing the game in main.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,relative} from 'node:path';
const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8',
 '.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json','.png':'image/png','.webp':'image/webp',
 '.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{const u=new URL(req.url,'http://localhost');
 const p=resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));
 if(relative(root,p).startsWith('..')){res.writeHead(403);res.end();return;}
 const b=await readFile(p);res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream'});res.end(b);
 }catch{res.writeHead(404);res.end('404');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 for(const start of ['meadow','approach','lookout','rear']){
  const page=await browser.newPage({viewport:{width:874,height:402},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  await page.goto('http://127.0.0.1:'+server.address().port+'/previews/field-exploration/?from=battle&start='+start);
  try{await page.waitForFunction(()=>window.__FIELD_EXPLORATION_PREVIEW &&
      document.querySelector('#load')?.hidden===true,null,{timeout:45000});}
  catch(err){
    console.log('REVIEW STATUS '+JSON.stringify(await page.evaluate(()=>({
      loading:document.querySelector('#progress')?.textContent||document.querySelector('#load')?.textContent,
      loaded:document.querySelector('#load')?.hidden, preview:window.__FIELD_EXPLORATION_PREVIEW,
      url:location.href,base:document.baseURI
    }))));
    throw err;
  }
  const info=await page.evaluate(()=>({
    qa:window.__FIELD_EXPLORATION_PREVIEW,
    pos:[Number(document.querySelector('#scene').dataset.x),Number(document.querySelector('#scene').dataset.y)],
    height:window.YK_WORLD.mapData.heights[59][40],
    flowers:window.YK_WORLD.mapData.decorations.filter(o=>o.kind==='wildflowers').length,
    nav:document.querySelectorAll('#review-controls a').length,
    ramps:[[40,57],[37,54]].map(([x,y])=>window.YK_WORLD.mapData.ramps[y][x]),

    ladders:window.YK_WORLD.mapData.ladders.filter(l=>l.lower[0]===40&&[61,64].includes(l.lower[1])),
    routeCanMove:[[40,65],[40,64],[40,63],[40,62],[40,61],[40,60],[40,59],[40,58]].every((c,i,path)=>{
      if(!i)return true;
      const pos=([x,y])=>[x*32+16,y*32+16];
      return window.YK_WORLD.canMove(...pos(path[i-1]),...pos(c))&&window.YK_WORLD.canMove(...pos(c),...pos(path[i-1]));
    }),
    base:document.baseURI, url:location.href
  }));
  assert.equal(info.qa.tiles,7);assert.equal(info.qa.heights,71);
  assert.equal(info.height,2);assert.equal(info.flowers,19);assert.equal(info.nav,4);assert.deepEqual(info.ramps,['s','s']);
  assert.equal(info.routeCanMove,true,'full uphill and downhill route');
  assert.equal(info.ladders.length,2,'both visible ladder connectors');
  assert.deepEqual(info.pos,({meadow:[27,59],approach:[40,65],lookout:[40,59],rear:[40,58]})[start]);
  assert.equal(errors.length,0,errors.join('\n'));
  if(start==='approach'){
    await page.screenshot({path:'artifacts/field-exploration-pages-before-climb.png'});
    for(let i=1;i<=7;i++){
      await page.keyboard.press('ArrowUp',{delay:35});
      await page.waitForFunction(y=>Number(document.querySelector('#scene').dataset.y)===y,65-i,{timeout:3000});
      await page.waitForTimeout(30);
    }
    assert.equal(await page.locator('#scene').getAttribute('data-y'),'58','actual uphill traversal');
    await page.screenshot({path:'artifacts/field-exploration-pages-after-climb.png'});
    for(let i=1;i<=7;i++){
      await page.keyboard.press('ArrowDown',{delay:35});
      await page.waitForFunction(y=>Number(document.querySelector('#scene').dataset.y)===y,58+i,{timeout:3000});
      await page.waitForTimeout(30);
    }
    assert.equal(await page.locator('#scene').getAttribute('data-y'),'65','actual downhill traversal');
    await page.screenshot({path:'artifacts/field-exploration-pages-after-descent.png'});
  }
  if(start==='rear'){
    const route=[[40,58],[40,57],[40,56],[39,56],[38,56],[37,56],[37,55],[37,54],[37,53],[36,53],[36,54],[36,55]];
    const go=async (from,to)=>{
      const dx=to[0]-from[0],dy=to[1]-from[1];
      const key=dx===1?'ArrowRight':dx===-1?'ArrowLeft':dy===1?'ArrowDown':dy===-1?'ArrowUp':null;
      assert.ok(key,'rear route uses orthogonal steps');
      await page.keyboard.press(key,{delay:35});
      try{
        await page.waitForFunction(([x,y])=>{
          const scene=document.querySelector('#scene');
          return Number(scene?.dataset.x)===x&&Number(scene?.dataset.y)===y;
        },to,{timeout:4000});
      }catch(error){
        const state=await page.evaluate(()=>{
          const scene=document.querySelector('#scene');
          return {x:scene?.dataset.x,y:scene?.dataset.y,paused:window.__FIELD_RENDER_PAUSED,
            preview:window.__FIELD_EXPLORATION_PREVIEW,
            blocked:window.YK_WORLD?.canMove(40*32+16,58*32+16,40*32+16,57*32+16)};
        });
        console.error('REAR MOVE FAILED '+JSON.stringify({from,to,key,state}));
        await page.screenshot({path:'artifacts/field-exploration-rear-failure.png'});
        throw error;
      }
      console.log('REAR MOVE OK '+JSON.stringify({from,to,key}));
      await page.waitForTimeout(30);
    };
    for(let i=1;i<route.length;i++)await go(route[i-1],route[i]);
    await page.screenshot({path:'artifacts/field-exploration-rear-after-descent.png'});
    for(let i=route.length-1;i>0;i--)await go(route[i],route[i-1]);
    assert.deepEqual(await page.evaluate(()=>[Number(document.querySelector('#scene').dataset.x),Number(document.querySelector('#scene').dataset.y)]),route[0],'rear two-ramp ascent returns to summit');
  }
  await page.screenshot({path:'artifacts/field-exploration-pages-'+start+'.png'});
  console.log(start,JSON.stringify(info));
  await page.close();
 }
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
