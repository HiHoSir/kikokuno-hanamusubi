import {
 SHIOMACHI_MAP,SHIOMACHI_REVIEW_SPOTS,shiomachiWalkableCell,
 shiomachiCollision,shiomachiIsExit,shiomachiPierFixtureCollision,
 shiomachiTouchedInterior
} from '../../../data/maps/shiomachi-village/scene.mjs?v=boundary-fence-1';
import {makeWalk,HIZUKI_WALK_SPEED} from '../village/movement.mjs?v=map-edge-1';
import {makeVillageFence,VILLAGE_FENCE_ART} from '../village/boundary.mjs';
import {advanceResident,makeResident,RESIDENT_RADIUS,residentInFront} from '../village/residents.mjs';
import {bindDialogue} from '../village/dialogue.mjs';
import {pixelViewport,DEFAULT_CAMERA_ZOOM} from '../village/render.mjs';
import {createShiomachiRenderer} from './render.mjs?v=boundary-fence-1';
import {createShiomachiInteriorPreview} from './interior-preview.mjs?v=shop-clerk-1';
import {consumeRestorePosition} from '../save/save-game.mjs?v=save-slots-1';

// Preview and real game share the SAME village map, art and interior code.
// Demo shop balances remain trial-only; placing the village does not approve
// their prices or add them to real saved inventory/equipment.
const previewMode=location.pathname.includes('/previews/');
const scene=document.querySelector('#scene');
const load=document.querySelector('#load');
const objective=document.querySelector('#objective');
const buttons=[...document.querySelectorAll('[data-dir]')];
const directions=Object.freeze({
 up:[0,-1,1],down:[0,1,0],left:[-1,0,3],right:[1,0,2]
});
const keys=Object.freeze({ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',
 ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'});
const sources=Object.freeze({
 hero:'assets/characters/hizuki/walk-4dir-80x112.png',
 elder:'assets/characters/npc/elder-walk-4dir-80x112.png',
 fisher:'assets/characters/npc/ushiohei-walk-4dir-80x112.png',
 osumi:'assets/characters/npc/osumi-walk-4dir-80x112.png',
 villager:'assets/characters/npc/villager-walk-4dir-80x112.png',
 'shop-clerk':'assets/characters/npc/shop-clerk-walk-4dir-80x112.png',
 furniture:'assets/village/interiors/furniture.png',
 signInn:'assets/village/scene/sign-inn.png',
 signArmory:'assets/village/scene/sign-armory.png',
 signTea:'assets/village/scene/sign-teahouse.png',
 houseThatch:'assets/village/scene/house-thatch.png',
 houseTile:'assets/village/scene/house-tile.png',
 teahouse:'assets/village/scene/teahouse.png',
 netRack:'assets/sea-cove/objects/net-drying-rack-232x176.png',
 netBundle:'assets/sea-cove/objects/net-bundle-146x88.png',
 ropeCoil:'assets/sea-cove/objects/rope-coil-88x62.png',
 basket:'assets/sea-cove/objects/fish-basket-80x74.png',
 barrel:'assets/sea-cove/objects/fish-barrel-64x86.png',
 crate:'assets/sea-cove/objects/fish-crate-92x70.png',
 water:'assets/field/effects/water-motion.png',
 pathSoil:'assets/village/scene/path-soil.png',
 fence:VILLAGE_FENCE_ART,
 pierNative:'assets/shiomachi/objects/wooden-pier-128x360.png',
 coastMask:'assets/field/terrain/atlas/coast-mask-32.png',
 coastSand0:'assets/field/terrain/atlas/coast-sand-0-32.png',
 coastSand1:'assets/field/terrain/atlas/coast-sand-1-32.png',
 coastSand2:'assets/field/terrain/atlas/coast-sand-2-32.png',
 coastSand3:'assets/field/terrain/atlas/coast-sand-3-32.png'
});
const input=new Map();
const clearInput=()=>{
 input.clear();for(const button of buttons)button.classList.remove('held');
};
const hold=(id,direction)=>{
 if(direction)input.set(id,direction);else input.delete(id);
 const value=[...input.values()].at(-1);
 for(const button of buttons)button.classList.toggle('held',button.dataset.dir===value);
};
const image=async([id,path])=>{
 const img=new Image();
 img.src=new URL('../../../'+path,import.meta.url).href;
 await img.decode();
 if(!img.naturalWidth||!img.naturalHeight)throw Error('画像を読み込めません: '+path);
 return [id,img];
};
async function start(){
 const landscapeReady=new Promise((resolve,reject)=>{
   const land=window.YK_LANDSCAPE,auto=window.YK_AUTOTILE;
   if(!land?.load||!auto?.load){reject(Error('海岸タイルの描画エンジンがありません'));return;}
   const timer=setTimeout(()=>reject(Error('海岸タイルの読み込みがタイムアウトしました')),25000);
   const check=()=>{
     const errors={...land.errors,...auto.errors};
     if(Object.keys(errors).length){
       clearTimeout(timer);reject(Error(JSON.stringify(errors)));return;
     }
     if(land.ready()&&auto.ready()){clearTimeout(timer);resolve();}
   };
   land.load(check);auto.load(check);check();
 });
 const [images]=await Promise.all([
   Promise.all(Object.entries(sources).map(image)).then(Object.fromEntries),
   landscapeReady
 ]);
 for(const [key,w,h] of [
   ['hero',240,448],['houseThatch',390,357],['houseTile',360,373],
   ['teahouse',420,410],['netRack',232,176],['basket',80,74],
   ['barrel',64,86],['crate',92,70],['pathSoil',256,256],['pierNative',128,360],
   ['signInn',96,120],['signArmory',96,120],['signTea',96,120]
 ]){
   if(images[key].naturalWidth!==w||images[key].naturalHeight!==h)
     throw Error('既存原寸のサイズが変わっています: '+key);
 }
 const map=SHIOMACHI_MAP;
 const pixelWidth=map.width*map.tileSize,pixelHeight=map.height*map.tileSize;
 const collision=new Uint8Array(pixelWidth*pixelHeight);
 for(let ty=0;ty<map.height;ty++)for(let tx=0;tx<map.width;tx++){
   if(shiomachiWalkableCell(tx,ty))continue;
   for(let row=0;row<map.tileSize;row++){
     const start=(ty*map.tileSize+row)*pixelWidth+tx*map.tileSize;
     collision.fill(1,start,start+map.tileSize);
   }
 }
 const fence=makeVillageFence(map.boundaryFence,collision,pixelWidth);
 const walk=makeWalk(pixelWidth,pixelHeight,collision,7);
 const residentWalk=makeWalk(pixelWidth,pixelHeight,collision,RESIDENT_RADIUS);
 const sceneryOccupied=(x,y,radius)=>shiomachiCollision(map.objects,x,y,radius)||
   shiomachiPierFixtureCollision(x,y,radius,map);
 const heroResidentClearance=27;
 const restored=previewMode?null:consumeRestorePosition('shiomachi');
 const validRestore=restored&&walk.canStand(restored.x,restored.y,true)&&
   !sceneryOccupied(restored.x,restored.y,7);
 const initial=validRestore?{
   x:restored.x,y:restored.y,face:restored.face??map.entry.face
 }:map.entry;
 // A checkpoint can be on an NPC's original spot while that NPC is out walking.
 const residents=map.residents.map(config=>{
   const index=config.route.findIndex(([px,py])=>
     Math.hypot(px-initial.x,py-initial.y)>=heroResidentClearance);
   const route=index>0?[...config.route.slice(index),...config.route.slice(0,index)]:config.route;
   return makeResident({...config,route});
 });
 const occupied=(x,y)=>sceneryOccupied(x,y,7)||
   residents.some(n=>Math.hypot(n.x-x,n.y-y)<heroResidentClearance);
 if(!walk.canStand(initial.x,initial.y,true)||occupied(initial.x,initial.y))
   throw Error('潮待村の開始位置が通れません');
 let x=initial.x,y=initial.y,face=initial.face,distance=0,moving=false;
 let last=0,lastFrame=-1,debug=false,menuPaused=false;
 const exitToField=()=>{
   if(previewMode)return false;
   clearInput();
   window.KIKOKU_ROUTE.go(new URL('../../field/?from=shiomachi',import.meta.url));
   return true;
 };
 addEventListener('game-menu-open',()=>{menuPaused=true;clearInput()});
 addEventListener('game-menu-close',()=>{menuPaused=false});
 const viewport={step:1,bufferWidth:1,bufferHeight:1};
 const resize=()=>{
   const parent=scene.parentElement;
   const size=pixelViewport(parent.clientWidth,parent.clientHeight,
     devicePixelRatio,DEFAULT_CAMERA_ZOOM);
   scene.width=size.width;scene.height=size.height;
   viewport.step=size.step;viewport.bufferWidth=size.width;viewport.bufferHeight=size.height;
   lastFrame=-1;
 };
 const renderer=createShiomachiRenderer(scene.getContext('2d',{alpha:false}),images,map,fence);
 const shopPanel={
   panel:document.querySelector('#shop-panel'),title:document.querySelector('#shop-title'),
   wallet:document.querySelector('#shop-wallet'),
   options:document.querySelector('#shop-options'),message:document.querySelector('#shop-message')
 };
 const interior=createShiomachiInteriorPreview({
   ctx:scene.getContext('2d',{alpha:false}),images,viewport,clearInput,shopPanel
 });
 const dialogue=bindDialogue(()=>{
   clearInput();
   for(const npc of residents)npc.moving=false;
   lastFrame=-1;
 },ended=>{
   if(interior.active&&ended===interior.resident())interior.openShop();
 });
 const enterRoom=site=>{
   if(!site||dialogue.active)return false;
   clearInput();moving=false;
   const entered=interior.enter(site);
   if(entered){
     const reviewTools=document.querySelector('.review-tools');
     if(reviewTools)reviewTools.open=false;
     scene.dataset.room=site.room;
     scene.dataset.mode='interior';
     lastFrame=-1;
   }
   return entered;
 };
 const returnOutside=site=>{
   clearInput();
   x=site.x;y=site.returnY;face=0;distance=0;moving=false;
   scene.dataset.room='';
   scene.dataset.mode='exterior';
   lastFrame=-1;
 };
 const action=()=>{
   if(interior.shopActive){interior.confirmShop();return;}
   if(dialogue.active){dialogue.advance();return;}
   if(interior.active){
     interior.updateDialogue(dialogue);
     if(!dialogue.open())dialogue.openMessage('緋月「漁村の暮らしが感じられる部屋だ。」');
     return;
   }
   dialogue.update(residentInFront(x,y,face,residents),x,y);
   if(!dialogue.open())
     dialogue.openMessage('潮待村「海風に潮と干し網の匂いが混じっている。」');
 };
 const render=(now,force=false)=>{
   const t=Math.floor(now/140);
   if(force||moving||(!interior.active&&residents.some(npc=>npc.moving))||t!==lastFrame){
     if(interior.active)interior.draw(now,debug);
     else renderer({x,y,face,distance,moving},residents,now,viewport,debug);
     lastFrame=t;
   }
 };
 const frame=now=>{
   const dt=last?Math.max(0,Math.min(now-last,40)):0;last=now;
   moving=false;
   const dir=[...input.values()].at(-1);
   if(!menuPaused&&!dialogue.active&&!interior.shopActive&&dir){
     const [dx,dy,heading]=directions[dir];
     if(interior.active){
       const departed=interior.advance(dt,dir);
       if(departed)returnOutside(departed);
       else moving=Boolean(interior.actor?.moving);
     }else{
       face=heading;
       const delta=HIZUKI_WALK_SPEED*dt/1000;
       const [nx,ny,leftMap]=walk.move(x,y,dx*delta,dy*delta,occupied,true);
       if(leftMap&&exitToField())return;
       const site=shiomachiTouchedInterior(x,y,nx,ny,heading);
       if(site)enterRoom(site);
       else{
         distance+=Math.hypot(nx-x,ny-y);
         moving=Math.abs(nx-x)+Math.abs(ny-y)>0.01;
         x=nx;y=ny;
       }
     }
   }
   if(interior.active){
     interior.updateDialogue(dialogue);
     objective.textContent=interior.site.name+'（室内）　南口から外へ／Aで会話';
   }else{
     for(const npc of residents){
       if(menuPaused||dialogue.active){
         npc.moving=false;
         continue;
       }
       advanceResident(npc,dt,residentWalk,(px,py)=>
         sceneryOccupied(px,py,RESIDENT_RADIUS)||
         Math.hypot(px-x,py-y)<heroResidentClearance||
         residents.some(other=>other!==npc&&Math.hypot(px-other.x,py-other.y)<2*RESIDENT_RADIUS));
     }
     dialogue.update(residentInFront(x,y,face,residents),x,y);
     objective.textContent=shiomachiIsExit(x,y)
       ?(previewMode?'南口（プレビュー用の境界）。フィールドへは移動しません。':'南口：フィールドへ戻ります。')
       :(previewMode?'潮待村・試作：兵具屋／宿／茶店の入口から室内へ':
          '潮待村：南口からフィールドへ／兵具屋の品は現在試用のみ');
   }
   render(now);
   const pos=interior.active?interior.position():{x,y};
   scene.dataset.x=String(Math.floor(pos.x));
   scene.dataset.y=String(Math.floor(pos.y));
   requestAnimationFrame(frame);
 };
 for(const button of buttons){
   button.addEventListener('pointerdown',e=>{
     if(e.button!==0)return;
     e.preventDefault();
     if(interior.shopActive){interior.choose(button.dataset.dir);return;}
     if(dialogue.active)return;
     button.setPointerCapture(e.pointerId);
     hold(e.pointerId,button.dataset.dir);
   });
   for(const type of ['pointerup','pointercancel','lostpointercapture'])
     button.addEventListener(type,e=>hold(e.pointerId,null));
   button.addEventListener('contextmenu',e=>e.preventDefault());
 }
 document.querySelector('#action-a').addEventListener('click',action);
 document.querySelector('#action-b').addEventListener('click',()=>{
   if(interior.shopActive)interior.closeShop();
   else if(dialogue.active)dialogue.advance();
 });
 document.querySelector('#collision-toggle')?.addEventListener('click',e=>{
   debug=!debug;e.currentTarget.setAttribute('aria-pressed',String(debug));
   render(performance.now(),true);
 });
 for(const button of document.querySelectorAll('[data-review-spot]')){
   button.addEventListener('click',()=>{
     const spot=SHIOMACHI_REVIEW_SPOTS[button.dataset.reviewSpot];
     if(!spot||!walk.canStand(spot.x,spot.y)||occupied(spot.x,spot.y))return;
     clearInput();dialogue.close(false);
     if(interior.active)interior.leave();
     x=spot.x;y=spot.y;face=spot.face;distance=0;moving=false;
     scene.dataset.room='';scene.dataset.mode='exterior';
     for(const candidate of document.querySelectorAll('[data-review-spot]'))
       candidate.setAttribute('aria-pressed',String(candidate===button));
     lastFrame=-1;render(performance.now(),true);
   });
 }
 for(const button of document.querySelectorAll('[data-review-room]')){
   button.addEventListener('click',()=>{
     const site=map.interiors.find(s=>s.room===button.dataset.reviewRoom);
     if(!site)return;
     dialogue.close(false);
     if(interior.active)interior.leave();
     enterRoom(site);
     render(performance.now(),true);
   });
 }
 window.addEventListener('keydown',e=>{
   if(e.ctrlKey||e.metaKey||e.altKey)return;
   if((e.key==='Enter'||e.key===' ')&&e.target?.tagName==='BUTTON')return;
   if(interior.shopActive){
     if(['x','X','Escape','Backspace'].includes(e.key)){
       e.preventDefault();if(!e.repeat)interior.closeShop();
     }else if(['z','Z','Enter',' '].includes(e.key)){
       e.preventDefault();if(!e.repeat)interior.confirmShop();
     }else if(keys[e.key]){
       e.preventDefault();if(!e.repeat)interior.choose(keys[e.key]);
     }
     return;
   }
   if(['z','Z','Enter',' '].includes(e.key)){
     e.preventDefault();if(!e.repeat)action();return;
   }
   if((e.key==='x'||e.key==='X')&&dialogue.active){
     e.preventDefault();dialogue.advance();return;
   }
   const dir=keys[e.key];
   if(!dir)return;
   e.preventDefault();if(!e.repeat)hold(e.key,dir);
 });
 window.addEventListener('keyup',e=>{if(keys[e.key])hold(e.key,null)});
 window.addEventListener('blur',clearInput);
 window.addEventListener('pagehide',clearInput);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
 resize();new ResizeObserver(resize).observe(scene.parentElement);
 render(performance.now(),true);
 load.hidden=true;
 if(!previewMode){
   window.KIKOKU_SAVE_SNAPSHOT=()=>({scene:'shiomachi',
     position:{x,y,face}});
   window.parent?.KIKOKU_GAME?.autosave?.(window);
 }
 window.__SHIOMACHI_QA={
   previewOnly:previewMode,scene:'shiomachi-village',cameraZoom:DEFAULT_CAMERA_ZOOM,
   ready:true,renderer:renderer.qa,
   bounds:[map.width,map.height],spawn:{...initial},
   objectNames:map.objects.map(o=>o.id),
   residentNames:residents.map(r=>r.name),
   residents:()=>residents.map(({id,x,y,face,moving,distance})=>({id,x,y,face,moving,distance})),
   canStand:(px,py)=>walk.canStand(px,py,true)&&!occupied(px,py),
   position:()=>({x,y,face}),
   readDebug:()=>debug,
   talk:action,
   entrances:map.interiors.map(({building,room,x,thresholdY})=>({building,room,x,thresholdY})),
   room:()=>interior.currentRoom,
   indoorPosition:()=>interior.position(),
   indoorResident:()=>{
     const npc=interior.resident();
     if(!npc)return null;
     const {name,x,y,talkPoint,bitmap}=npc;
     return {name,x,y,talkPoint,image:new URL(bitmap.src).pathname};
   },
   shopActive:()=>interior.shopActive,
   openService:()=>interior.openShop(),
   trial:()=>interior.trial,
   enterRoom:room=>{
     const site=map.interiors.find(item=>item.room===room);
     return Boolean(site)&&enterRoom(site);
   },
   exitRoom:()=>{if(!interior.active)return false;returnOutside(interior.leave());return true;}
 };
 requestAnimationFrame(frame);
}
start().catch(err=>{
 console.error(err);
 load.textContent='潮待村の読込に失敗しました：'+err.message;
});
