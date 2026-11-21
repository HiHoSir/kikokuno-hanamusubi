import {
 SHIOMACHI_MAP,SHIOMACHI_REVIEW_SPOTS,shiomachiWalkableCell,
 shiomachiCollision,shiomachiIsExit,shiomachiPierFixtureCollision
} from '../../../data/maps/shiomachi-village/scene.mjs';
import {makeWalk,HIZUKI_WALK_SPEED} from '../village/movement.mjs';
import {residentInFront} from '../village/residents.mjs';
import {bindDialogue} from '../village/dialogue.mjs';
import {pixelViewport,DEFAULT_CAMERA_ZOOM} from '../village/render.mjs';
import {createShiomachiRenderer} from './render.mjs';

// Dedicated preview, not a game destination. No storage, story or save writes.
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
 clerk:'assets/characters/npc/shop-clerk-walk-4dir-80x112.png',
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
   ['barrel',64,86],['crate',92,70],['pathSoil',256,256],['pierNative',128,360]
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
 const walk=makeWalk(pixelWidth,pixelHeight,collision,7);
 const residents=map.residents.map(npc=>({...npc,distance:0,moving:false}));
 const occupied=(x,y)=>shiomachiCollision(map.objects,x,y,7)||
   shiomachiPierFixtureCollision(x,y,7,map)||
   residents.some(n=>Math.hypot(n.x-x,n.y-y)<27);
 const initial=map.entry;
 if(!walk.canStand(initial.x,initial.y)||occupied(initial.x,initial.y))
   throw Error('潮待村の開始位置が通れません');
 let x=initial.x,y=initial.y,face=initial.face,distance=0,moving=false;
 let last=0,lastFrame=-1,debug=false;
 const viewport={step:1,bufferWidth:1,bufferHeight:1};
 const resize=()=>{
   const parent=scene.parentElement;
   const size=pixelViewport(parent.clientWidth,parent.clientHeight,
     devicePixelRatio,DEFAULT_CAMERA_ZOOM);
   scene.width=size.width;scene.height=size.height;
   viewport.step=size.step;viewport.bufferWidth=size.width;viewport.bufferHeight=size.height;
   lastFrame=-1;
 };
 const renderer=createShiomachiRenderer(scene.getContext('2d',{alpha:false}),images,map);
 const dialogue=bindDialogue(clearInput);
 const action=()=>{
   if(dialogue.active){dialogue.advance();return;}
   dialogue.update(residentInFront(x,y,face,residents),x,y);
   if(!dialogue.open())
     dialogue.openMessage('潮待村「海風に潮と干し網の匂いが混じっている。」');
 };
 const render=(now,force=false)=>{
   const t=Math.floor(now/140);
   if(force||moving||t!==lastFrame){
     renderer({x,y,face,distance,moving},residents,now,viewport,debug);
     lastFrame=t;
   }
 };
 const frame=now=>{
   const dt=last?Math.max(0,Math.min(now-last,40)):0;last=now;
   moving=false;
   const dir=[...input.values()].at(-1);
   if(!dialogue.active&&dir){
     const [dx,dy,heading]=directions[dir];
     face=heading;
     const delta=HIZUKI_WALK_SPEED*dt/1000;
     const [nx,ny]=walk.move(x,y,dx*delta,dy*delta,occupied);
     distance+=Math.hypot(nx-x,ny-y);
     moving=Math.abs(nx-x)+Math.abs(ny-y)>0.01;
     x=nx;y=ny;
   }
   dialogue.update(residentInFront(x,y,face,residents),x,y);
   if(shiomachiIsExit(x,y)){
     objective.textContent='南口（プレビュー用の境界）。まだフィールドには接続していません。';
   }else{
     objective.textContent='潮待村・試作：浜辺／家並み／漁の仕事場を歩いて確認';
   }
   render(now);
   scene.dataset.x=String(Math.floor(x));
   scene.dataset.y=String(Math.floor(y));
   requestAnimationFrame(frame);
 };
 for(const button of buttons){
   button.addEventListener('pointerdown',e=>{
     if(e.button!==0)return;
     e.preventDefault();button.setPointerCapture(e.pointerId);
     hold(e.pointerId,button.dataset.dir);
   });
   for(const type of ['pointerup','pointercancel','lostpointercapture'])
     button.addEventListener(type,e=>hold(e.pointerId,null));
   button.addEventListener('contextmenu',e=>e.preventDefault());
 }
 document.querySelector('#action-a').addEventListener('click',action);
 document.querySelector('#action-b').addEventListener('click',()=>dialogue.advance());
 document.querySelector('#collision-toggle').addEventListener('click',e=>{
   debug=!debug;e.currentTarget.setAttribute('aria-pressed',String(debug));
   render(performance.now(),true);
 });
 for(const button of document.querySelectorAll('[data-review-spot]')){
   button.addEventListener('click',()=>{
     const spot=SHIOMACHI_REVIEW_SPOTS[button.dataset.reviewSpot];
     if(!spot||!walk.canStand(spot.x,spot.y)||occupied(spot.x,spot.y))return;
     clearInput();x=spot.x;y=spot.y;face=spot.face;distance=0;moving=false;
     for(const candidate of document.querySelectorAll('[data-review-spot]'))
       candidate.setAttribute('aria-pressed',String(candidate===button));
     dialogue.close(false);
     render(performance.now(),true);
   });
 }
 window.addEventListener('keydown',e=>{
   if(e.ctrlKey||e.metaKey||e.altKey)return;
   if((e.key==='Enter'||e.key===' ')&&e.target?.tagName==='BUTTON')return;
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
 window.__SHIOMACHI_QA={
   previewOnly:true,scene:'shiomachi-village',cameraZoom:DEFAULT_CAMERA_ZOOM,
   ready:true,renderer:renderer.qa,
   bounds:[map.width,map.height],spawn:{...initial},
   objectNames:map.objects.map(o=>o.id),
   residentNames:residents.map(r=>r.name),
   canStand:(px,py)=>walk.canStand(px,py)&&!occupied(px,py),
   position:()=>({x,y,face}),
   readDebug:()=>debug,
   talk:action
 };
 requestAnimationFrame(frame);
}
start().catch(err=>{
 console.error(err);
 load.textContent='潮待村の読込に失敗しました：'+err.message;
});
