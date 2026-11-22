// Chromium verification of the iPhone-readable equipment ledger. Read-only:
// this must not open an invented shop or change equipment/quest save data.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,relative} from 'node:path';

const root=resolve('.');
const types={'.html':'text/html;charset=utf-8',
 '.mjs':'text/javascript;charset=utf-8',
 '.js':'text/javascript;charset=utf-8',
 '.css':'text/css;charset=utf-8',
 '.json':'application/json'};
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  const name=resolve(root,'.'+(u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname));
  if(relative(root,name).startsWith('..')){res.writeHead(403);res.end();return;}
  const data=await readFile(name);
  res.writeHead(200,{'Content-Type':types[extname(name)]||'application/octet-stream',
   'Cache-Control':'no-store'});res.end(data);
 }catch{res.writeHead(404);res.end('NOT FOUND');}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('artifacts',{recursive:true});
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const [width,height,label] of [[874,402,'iphone-landscape'],[390,844,'small-portrait']]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  page.on('requestfailed',req=>errors.push('network: '+req.url()));
  await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.setItem('equipment-preview-sentinel','unchanged'));
  await page.goto(origin+'/previews/equipment-catalog/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('article[data-location]').length===5,
   null,{timeout:20000});
  const report=await page.evaluate(()=>{
   const rows=Object.fromEntries([...document.querySelectorAll('article[data-location]')].map(x=>
    [x.dataset.location,{
     state:x.dataset.state,
     count:x.querySelectorAll('tbody tr').length,
     names:[...x.querySelectorAll('tbody tr td:first-child')].map(y=>y.textContent),
     dataIds:[...x.querySelectorAll('tbody tr')].map(y=>y.dataset.itemId),
     footer:x.querySelector('.note')?.textContent
    }]));
   return {areas:rows,tiers:[...document.querySelectorAll('#tiers tr')].map(x=>x.textContent),
    mismatch:document.querySelector('#discrepancy').textContent,
    stats:[...document.querySelectorAll('.stat')].map(x=>x.textContent),
    saved:localStorage.getItem('equipment-preview-sentinel'),
    playerSave:localStorage.getItem('kikokuno-hanamusubi-battle-player'),
    horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert.deepEqual(Object.keys(report.areas),
   ['start','hozuki-village','tenyo-sanctuary','sea-cove','shiomachi-village']);
  assert.equal(report.areas.start.count,2);
  assert.deepEqual(report.areas['hozuki-village'].names,
    ['脇差','厚布の胴当て','鉢巻','足袋']);
  assert.equal(report.areas['hozuki-village'].state,'in-game');
  assert.equal(report.areas['tenyo-sanctuary'].count,0);
  assert.equal(report.areas['sea-cove'].count,0);
  assert.equal(report.areas['shiomachi-village'].state,'preview-only');
  assert.deepEqual(report.areas['shiomachi-village'].names,
    ['潮切りの太刀','潮革の胴当て','波除けの鉢金','磯歩きの脚絆']);
  assert.equal(report.tiers.length,7);
  assert.ok(report.tiers[1].includes('+20')&&report.tiers[1].includes('+14'));
  assert.ok(report.tiers[2].includes('+42')&&report.tiers[2].includes('+30'));
  assert.ok(report.mismatch.includes('一致しません'));
  assert.equal(report.saved,'unchanged');
  assert.equal(report.playerSave,null);
  assert.equal(report.horizontalOverflow,false,'must fit iPhone viewport horizontally');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'artifacts/equipment-catalog-'+label+'.png',fullPage:true});
  console.log('EQUIPMENT_CURRENT_BROWSER '+JSON.stringify({label,width,height,
   locations:Object.keys(report.areas).length,shopCount:report.areas['hozuki-village'].count,
   previewCount:report.areas['shiomachi-village'].count,
   noGear:['tenyo-sanctuary','sea-cove'].map(x=>report.areas[x].count),
   errors,horizontalOverflow:report.horizontalOverflow,saveUnchanged:true}));
  await context.close();
 }
}finally{
 if(browser)await browser.close();
 await new Promise(done=>server.close(done));
}
