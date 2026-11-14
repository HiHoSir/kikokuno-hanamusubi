// Real-browser signage regression QA. No mocked game map and no generated screen.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';

const root=resolve('.');
const mime={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
 '.json':'application/json','.png':'image/png','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  try{
    const p=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const filename=resolve(root,'.'+(p.endsWith('/')?p+'index.html':p));
    if(relative(root,filename).startsWith('..')){res.writeHead(403);res.end();return;}
    const bytes=await readFile(filename);
    res.writeHead(200,{'Content-Type':mime[extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
await mkdir('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const issues=[],results=[];
try{
  for(const [width,height,label,building,room,filename,expectedPoint] of [
    [390,844,'portrait','teahouse-northeast','teahouse','sign-teahouse.png',[1614,548]],
    [900,390,'landscape','teahouse-northeast','teahouse','sign-teahouse.png',[1614,548]],
    [390,844,'portrait','inn-southeast','inn','sign-inn.png',[2004,1885]],
    [900,390,'landscape','inn-southeast','inn','sign-inn.png',[2004,1885]],
    [390,844,'portrait','house-southeast-tile','armory','sign-armory.png',[1500,1254]],
    [900,390,'landscape','house-southeast-tile','armory','sign-armory.png',[1500,1254]],
  ]){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,hasTouch:true,isMobile:true});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.addInitScript(()=>{
      const original=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(...args){
        const image=args[0];
        if(typeof image?.src==='string'&&image.src.includes('/assets/village/scene/sign-')){
          const store=window.__signDraws??=([]);
          if(store.length<24)store.push({name:image.src.split('/').at(-1),size:[image.naturalWidth,image.naturalHeight],
            world:[args[1],args[2]],smoothed:this.imageSmoothingEnabled,arguments:args.length});
        }
        return original.apply(this,args);
      };
    });
    try{
      await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
      if(room==='teahouse'||room==='armory')await page.evaluate(()=>{
        localStorage.setItem('kikokuno-hanamusubi-battle-player',JSON.stringify({
          lv:1,balanceVersion:2,gold:250,hp:26,maxhp:26,mp:12,maxmp:12,
          equipmentTier:'T0',potions:3,foods:{onigiri:0,dango:0}
        }));
      });
      await page.evaluate(()=>sessionStorage.setItem('kikokuno-hanamusubi-next-entry',
        JSON.stringify({route:'/src/game/',expiresAt:Date.now()+120000})));
      await page.goto(origin+'/src/game/',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>typeof window.KIKOKU_GAME?.navigate==='function',{timeout:20000});
      await page.evaluate(building=>{
        window.KIKOKU_GAME.navigate(new URL('/src/game/village/?focus='+building,location.href).href);
      },building);
      await page.waitForFunction(()=>{
        const d=document.querySelector('iframe')?.contentDocument;
        return d?.getElementById('load')?.hidden===true && d?.querySelector('#scene')?.dataset.x;
      },null,{timeout:20000});
      await page.waitForFunction(filename=>{
        return document.querySelector('iframe')?.contentWindow?.__signDraws?.some(x=>x.name===filename);
      },filename,{timeout:20000});
      const data=await page.evaluate(filename=>{
        const frame=document.querySelector('iframe');
        const w=frame.contentWindow,d=frame.contentDocument;
        return {rendered:w.__signDraws.filter(x=>x.name===filename),all:w.__signDraws.map(x=>x.name),
          loading:d.querySelector('#load').hidden,canvas:[d.querySelector('#scene').width,d.querySelector('#scene').height],
          url:frame.src,status:d.querySelector('#status').textContent};
      },filename);
      const sign=data.rendered[0];
      if(!sign || sign.arguments!==3 || sign.smoothed || JSON.stringify(sign.world)!==JSON.stringify(expectedPoint) ||
        JSON.stringify(sign.size)!==JSON.stringify([96,120])){
        issues.push(label+' '+building+' native sign placement mismatch '+JSON.stringify(data));
      }
      await page.screenshot({path:'artifacts/village-sign-'+label+'-'+room+'.png',fullPage:true});
      if(room==='teahouse'){
        const before=await page.evaluate(()=>window.KIKOKU_GAME?.audio?.trackName);
        const toggle=page.locator('#field-menu-toggle');
        await toggle.waitFor({state:'visible'});
        await toggle.click();
        await page.waitForFunction(()=>{
          const m=document.querySelector('#field-menu-backdrop');
          return m && !m.hidden && m.querySelectorAll('#field-menu-commands button').length===6;
        },null,{timeout:5000});
        const menu=await page.evaluate(()=>({
          status:document.querySelector('#field-menu-summary').textContent,
          items:document.querySelector('#field-menu-detail').textContent,
          bgm:window.KIKOKU_GAME?.audio?.trackName,
          scene:document.querySelector('#game-scene').src
        }));
        if(!menu.status.includes('緋月')||!menu.items.includes('薬草')||menu.bgm!==before||
           !menu.scene.includes('/village/'))issues.push(label+' menu contract failed '+JSON.stringify(menu));
        await page.screenshot({path:'artifacts/field-menu-'+label+'.png',fullPage:true});
        await page.locator('#field-menu-commands button').filter({hasText:'強さ'}).click();
        const detailText=await page.locator('#field-menu-detail').innerText();
        if(!detailText.includes('攻撃')||!detailText.includes('守備'))issues.push(label+' status menu missing combat stats');
        await page.locator('#field-menu-close').click();
        await page.waitForFunction(()=>document.querySelector('#field-menu-backdrop').hidden);
      }
      // Verify enter/leave from real contact movement, not a direct room URL.
      await page.evaluate(()=>{
        const child=document.querySelector('iframe').contentWindow;
        child.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
      });
      let entered=false,returned=false;
      try{
        await page.waitForFunction(room=>{
          const iframe=document.querySelector('iframe'),d=iframe?.contentDocument;
          return iframe?.src?.includes('/interiors/') && d?.querySelector('#scene')?.dataset.room===room && d.querySelector('#load')?.hidden;
        },room,{timeout:8000});
        entered=true;
        if(room==='teahouse'||room==='armory'){
          // Move on the actual floor from the door to the clerk's counter.
          const targetY=room==='teahouse'?300:410;
          await page.evaluate(()=>{
            const w=document.querySelector('iframe').contentWindow;
            w.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowUp'}));
            w.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp'}));
          });
          await page.waitForFunction(y=>{
            const d=document.querySelector('iframe')?.contentDocument;
            const cy=Number(d?.querySelector('#scene')?.dataset.y);
            return Number.isFinite(cy)&&cy<=y;
          },targetY,{timeout:9000});
          await page.evaluate(()=>{
            const d=document.querySelector('iframe').contentDocument;
            const w=d.defaultView;
            w.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowUp'}));
            d.getElementById('action-a').click();
            d.getElementById('next').click();
            d.getElementById('next').click();
          });
          await page.waitForFunction(()=>{
            const d=document.querySelector('iframe')?.contentDocument;
            return d?.getElementById('shop-panel')?.hidden===false;
          },null,{timeout:4000});
          await page.screenshot({path:'artifacts/village-shop-'+label+'-'+room+'.png',fullPage:true});
          const purchased=await page.evaluate(room=>{
            const d=document.querySelector('iframe').contentDocument;
            const id=room==='teahouse'?'onigiri':'starter-gear';
            d.querySelector('[data-shop-item="'+id+'"]').click();
            const player=JSON.parse(localStorage.getItem('kikokuno-hanamusubi-battle-player'));
            d.getElementById('action-b').click();
            return {room,gold:player.gold,foods:player.foods,equipmentTier:player.equipmentTier,
              closed:d.getElementById('shop-panel').hidden};
          },room);
          if(!purchased.closed||purchased.gold!==(room==='teahouse'?242:50)||
            (room==='teahouse'?purchased.foods?.onigiri!==1:purchased.equipmentTier!=='T1')){
            issues.push(label+' '+building+' purchase persistence failed: '+JSON.stringify(purchased));
          }
        }
        await page.evaluate(()=>{
          const child=document.querySelector('iframe').contentWindow;
          child.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowUp',bubbles:true}));
          child.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
        });
        await page.waitForFunction(building=>{
          const iframe=document.querySelector('iframe');
          return iframe?.src?.includes('/village/')&&new URL(iframe.src).searchParams.get('focus')===building&&
            iframe?.contentDocument?.querySelector('#load')?.hidden;
        },building,{timeout:8000});
        returned=true;
      }catch(error){issues.push(label+' '+building+' entry/return failed: '+error.message);}
      finally{
        await page.evaluate(()=>{const w=document.querySelector('iframe')?.contentWindow;
          for(const key of ['ArrowUp','ArrowDown'])w?.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));}).catch(()=>{});
      }
      results.push({label,building,signs:data.rendered.length,entered,returned});
      if(errors.length)issues.push(label+' '+building+' JS errors: '+errors.join('; '));
    }catch(error){issues.push(label+' '+building+' general error: '+error.stack);}
    finally{await page.close();}
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify({results,issues},null,2));
if(issues.length)process.exitCode=1;
