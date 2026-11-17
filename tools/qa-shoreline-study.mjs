import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';

const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8',
 '.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json','.png':'image/png','.webp':'image/webp',
 '.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const path=resolve(root,'.'+(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
  if(relative(root,path).startsWith('..')){res.writeHead(403);res.end();return;}
  const buffer=await readFile(path);
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream'});
  res.end(buffer);
 }catch{res.writeHead(404);res.end('404');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+server.address().port+'/previews/shoreline-study/';
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage({viewport:{width:874,height:402},deviceScaleFactor:2,
   isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',e=>errors.push('JS '+e.message));
 page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:')&&r.status()>=400)
  errors.push('HTTP '+r.status()+' '+r.url());});
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__SHORE_QA?.ready===true&&
    document.querySelector('#loading')?.hidden===true,null,{timeout:45000});
 const first=await page.evaluate(()=>({...window.__SHORE_QA}));
 assert.deepEqual(first.map,[30,18]);
 assert.equal(first.tileSize,32);
 assert.ok(first.coastCount>20);
 assert.equal(first.waterFrames,2);
 assert.ok(first.seaCells>100&&first.sandCells>50);
 assert.ok(first.dryMapGenerated);
 await page.screenshot({path:'artifacts/shoreline-study-initial.png'});
 // The approved ocean atlas has two frames, alternating every 360ms.
 let phases=new Set([first.waterFrame]);
 const screenshots=[];
 for(let i=0;i<5;i++){
  await page.waitForTimeout(175);
  const q=await page.evaluate(()=>window.__SHORE_QA);
  phases.add(q.waterFrame);
  screenshots.push(await page.locator('#scene').screenshot());
 }
 assert.deepEqual([...phases].sort(),[0,1],'water phases must both display while still');
 assert.ok(screenshots.some(b=>!b.equals(screenshots[0])),
  'actual rendered sea must visibly change while character is idle');
 await page.screenshot({path:'artifacts/shoreline-study-water.png'});
 const yBefore=await page.evaluate(()=>window.__SHORE_QA.hero.y);
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(380);
 await page.keyboard.up('ArrowUp');await page.waitForTimeout(100);
 const after=await page.evaluate(()=>({...window.__SHORE_QA}));
 assert.ok(after.hero.y<yBefore-20,'direction must move the sprite on sand/grass');
 await page.locator('#grid').click();
 const debug=await page.evaluate(()=>window.__SHORE_QA);
 assert.equal(debug.grid,true);
 await page.screenshot({path:'artifacts/shoreline-study-grid.png'});
 await page.locator('#reset').click();
 await page.waitForTimeout(80);
 const reset=await page.evaluate(()=>window.__SHORE_QA.hero);
 assert.equal(reset.x,336);assert.equal(reset.y,432);
 assert.deepEqual(errors,[],'no broken assets or runtime exceptions');
 const report={result:'pass',map:first.map,coastCount:first.coastCount,
   seaCells:first.seaCells,sandCells:first.sandCells,
   animatedFrames:[...phases].sort(),yBefore,yAfter:after.hero.y,
   screenshots:['artifacts/shoreline-study-initial.png',
   'artifacts/shoreline-study-water.png','artifacts/shoreline-study-grid.png']};
 await writeFile('artifacts/shoreline-study-report.json',JSON.stringify(report,null,2));
 console.log('SHORELINE STUDY '+JSON.stringify(report));
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
