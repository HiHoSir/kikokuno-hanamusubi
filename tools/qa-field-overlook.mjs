// Browser QA for the optional mapchip-only 花霞野 highland composition.
import {chromium} from "playwright";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,relative,extname} from "node:path";
const root=resolve(".");
const mime={".html":"text/html;charset=utf-8",".js":"text/javascript;charset=utf-8",
 ".mjs":"text/javascript;charset=utf-8",".css":"text/css;charset=utf-8",
 ".json":"application/json",".png":"image/png",".webp":"image/webp",
 ".woff2":"font/woff2"};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,"http://localhost"),target=resolve(root,"."+(
   url.pathname.endsWith("/")?url.pathname+"index.html":url.pathname));
  if(relative(root,target).startsWith("..")){res.writeHead(403);res.end();return;}
  const bytes=await readFile(target);
  res.writeHead(200,{"Content-Type":mime[extname(target)]||"application/octet-stream","Cache-Control":"no-store"});
  res.end(bytes);
 }catch(err){res.writeHead(404);res.end("404 "+req.url);}
});
await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
await mkdir("artifacts",{recursive:true});
let browser;
const results=[];
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 for(const [width,height] of [[900,390],[844,390],[1536,706]]){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",e=>{if(e.type()==="error")errors.push(e.text());});
  page.on("response",r=>{if(r.status()>=400)errors.push("HTTP "+r.status()+" "+r.url());});
  await page.goto("http://127.0.0.1:"+server.address().port+"/previews/field-overlook/",{waitUntil:"domcontentloaded"});
  try{
   await page.waitForFunction(()=>window.__OVERLOOK_QA?.draws>0,null,{timeout:45000});
  }catch(err){
   const state=await page.evaluate(()=>({loading:document.querySelector("#loading")?.textContent,
    html:document.body.innerText.slice(0,400),qa:window.__OVERLOOK_QA})).catch(()=>({failed:true}));
   console.error("OVERLOOK LOAD FAIL "+JSON.stringify({width,height,...state,errors}));
   await page.screenshot({path:"artifacts/field-overlook-fail-"+width+"x"+height+".png"});
   throw err;
  }
  const initial=await page.evaluate(()=>{
   const q=window.__OVERLOOK_QA,el=document.querySelector("#scene");
   return {tileSize:q.tileSize,terrain:q.terrain,cliffChips:q.cliffChips,
    waterAnimated:q.waterAnimated,waterFrame:q.waterFrame,
    hero:q.hero,canvas:[el.width,el.height],loadingHidden:document.querySelector("#loading").hidden};
  });
  assert.deepEqual(initial.terrain,[56,58]);
  assert.equal(initial.tileSize,32);
  assert.ok(initial.cliffChips>=150);
  assert.equal(initial.waterAnimated,true);
  assert.equal(initial.loadingHidden,true);
  const baseline=await page.evaluate(()=>Array.from(document.querySelector("#scene").getContext("2d")
    .getImageData(0,0,document.querySelector("#scene").width,document.querySelector("#scene").height).data));
  await page.waitForFunction(frame=>window.__OVERLOOK_QA?.waterFrame!==frame,initial.waterFrame,{timeout:3000});
  const changed=await page.evaluate(bytes=>{
    const now=document.querySelector("#scene").getContext("2d").getImageData(0,0,
      document.querySelector("#scene").width,document.querySelector("#scene").height).data;
    let diffs=0;for(let i=0;i<now.length;i+=4)if(now[i]!==bytes[i]||
       now[i+1]!==bytes[i+1]||now[i+2]!==bytes[i+2])diffs++;
    return diffs;
  },baseline);
  assert.ok(changed>100,"waterfall and river must animate independently of baked land: "+changed);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(80);
  const after=await page.evaluate(()=>({hero:window.__OVERLOOK_QA.hero,
    canvas:[document.querySelector("#scene").width,document.querySelector("#scene").height],
    draws:window.__OVERLOOK_QA.draws}));
  assert.deepEqual(after.hero,[27,48],"one 32px step west on upper terrace");
  assert.ok(after.draws>=2);
  assert.equal(errors.length,0,errors.join("\n"));
  await page.screenshot({path:"artifacts/field-overlook-"+width+"x"+height+".png"});
  results.push({viewport:[width,height],initial,changedPixels:changed,after,errors});
  await page.close();
 }
 await writeFile("artifacts/field-overlook-report.json",JSON.stringify(results,null,2)+"\n");
 console.log("FIELD OVERLOOK QA "+JSON.stringify(results));
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
