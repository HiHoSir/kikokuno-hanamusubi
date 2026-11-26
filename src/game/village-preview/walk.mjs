import {WIDTH,HEIGHT,VILLAGES,villageBlockers} from '../../../data/maps/village-previews/scenes.mjs?v=villages-7';
import {createVillageLandscape} from './render.mjs?v=villages-7';
import {hizukiWalkDistance,makeWalk} from '../village/movement.mjs';
import {advanceResident,makeResident,residentInFront,RESIDENT_RADIUS} from '../village/residents.mjs';
import {pixelViewport} from '../village/render.mjs';
import {bindDialogue} from '../village/dialogue.mjs';
import {SHIOMACHI_ARMORY_STOCK} from '../../../data/maps/shiomachi-village/armory.mjs?v=shiomachi-gear-1';
import {createShiomachiInteriorPreview} from '../shiomachi/interior-preview.mjs?v=inn-morning-1-armory-side-panel-1';

const assets={
 hero:'characters/hizuki/walk-4dir-80x112.png',
 furniture:'village/interiors/furniture.png',
 grass:'village/scene/terrain.png',
 soil:'village/scene/path-soil.png',
 road:'village/terrain/auto-road.png',
 cobble:'village/terrain/ground-cobble.png',
 groundDetails:'village/scene/ground-decor.png',
 crop:'village/terrain/garden-crop.png',
 water:'tenyo/clear-water-shallow.png',
 stone:'tenyo/stepping-stone.png',
 lamp:'tenyo/tenyo-stone-lantern.png',
 tree:'village/scene/sprite-46.png',
 shrub:'village/scene/sprite-36.png',
 thatch:'village/scene/house-thatch.png',
 tile:'village/scene/house-tile.png',
 inn:'village/scene/inn.png',
 sign:'village/scene/sign-inn.png',
 signArmory:'village/scene/sign-armory.png',
 rock:'sea-cove/objects/shore-rock-east-104x64.png',
 barrel:'sea-cove/objects/fish-barrel-64x86.png',
 crate:'sea-cove/objects/fish-crate-92x70.png'
};
for(const id of ['elder','shop-clerk','villager','farm-worker','osumi'])
 assets[id]='characters/npc/'+id+'-walk-4dir-80x112.png';

// The preview reuses the existing item IDs and combat stats.
const mountainItems={
 weapon:{name:'峠守の太刀'},body:{name:'山革の胴当て'},
 head:{name:'岩守の鉢金'},feet:{name:'山駆けの脚絆'}
};
const forestItems={
 body:{name:'樹皮の胴当て',price:96},
 feet:{name:'藪よけの脚絆',price:36}
};
const trialStockFor=items=>SHIOMACHI_ARMORY_STOCK
 .filter(item=>Object.hasOwn(items,item.slot))
 .map(item=>({...item,...items[item.slot]}));
const trialStockByVillage={forest:trialStockFor(forestItems),mountain:trialStockFor(mountainItems)};

const directions={up:[0,-1,1],down:[0,1,0],left:[-1,0,3],right:[1,0,2]};
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
const canvas=document.querySelector('#scene');
const load=document.querySelector('#load');
const buttons=[...document.querySelectorAll('[data-dir]')];
const ctx=canvas.getContext('2d',{alpha:false});
const viewport={};
const heroRadius=8;
const input=new Map();
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const portrait=matchMedia('(orientation: portrait)');

function updateInput(id,dir){
 if(dir)input.set(id,dir);else input.delete(id);
 const current=[...input.values()].at(-1);
 for(const button of buttons)button.classList.toggle('held',button.dataset.dir===current);
}
function clearInput(){
 input.clear();
 for(const button of buttons)button.classList.remove('held');
}
function resize(){
 const {width,height,step}=pixelViewport(canvas.clientWidth,canvas.clientHeight,devicePixelRatio);
 Object.assign(viewport,{bufferWidth:width,bufferHeight:height,step});
 canvas.width=width;canvas.height=height;
}
async function readImages(){
 return Object.fromEntries(await Promise.all(Object.entries(assets).map(async([name,path])=>{
   const image=new Image();
   image.src=new URL('../../../assets/'+path,import.meta.url).href;
   await image.decode();
   return [name,image];
 })));
}

async function start(){
 const requested=new URL(location.href).searchParams.get('village');
 const id=Object.hasOwn(VILLAGES,requested)?requested:'forest';
 const map=VILLAGES[id];
 const title=document.querySelector('#village-name');
 title.textContent=map.name;
 document.title=map.name+'｜鬼哭の花結び';
 document.querySelector('[data-village="'+id+'"]').setAttribute('aria-current','page');
 const images=await readImages();
 const world=createVillageLandscape(map,images);
 const blocked=villageBlockers(map);
 const walk=makeWalk(WIDTH,HEIGHT,blocked,heroRadius);
 const npcWalk=makeWalk(WIDTH,HEIGHT,blocked,RESIDENT_RADIUS);
 const sites=map.objects.flatMap(o=>o.site?[o.site]:[]);
 const residents=map.residents.map(o=>({...makeResident(o),bitmap:images[o.asset]}));
 const hero={x:map.spawn[0],y:map.spawn[1],face:1,distance:0,moving:false};
 const shopPanel=Object.fromEntries(['panel','title','wallet','options','message'].map(key=>[key,document.querySelector('#shop-'+key)]));
 const interior=createShiomachiInteriorPreview({ctx,images,viewport,clearInput,shopPanel,
   trialArmoryStock:trialStockByVillage[id]});
 const dialogue=bindDialogue(()=>{
   clearInput();
   hero.moving=false;
   for(const npc of residents)npc.moving=false;
 },npc=>{
   if(interior.active&&npc===interior.resident()){
     shopPanel.panel.dataset.layout=interior.currentRoom;
     interior.openShop();
   }
 });
 function interact(){
   if(portrait.matches)return;
   if(interior.shopActive)interior.confirmShop();
   else if(dialogue.active)dialogue.advance();
   else{
     const position=interior.position()??hero;
     const target=residentInFront(position.x,position.y,position.face,
       interior.active?[interior.resident()]:residents);
     dialogue.update(target,position.x,position.y);
     dialogue.open();
   }
 }
 function back(){
   if(interior.shopActive)interior.closeShop();
   else if(dialogue.active)dialogue.advance();
 }
 function hold(id,dir){
   if(interior.shopActive){interior.choose(dir);return;}
   if(!portrait.matches&&!dialogue.active)updateInput(id,dir);
 }
 function advance(dir,dt){
   if(interior.active){
     const site=interior.advance(dt,dir);
     if(site){
       clearInput();
       Object.assign(hero,{x:site.x,y:site.returnY,face:0,moving:false});
       title.textContent=map.name;
     }
   }else{
     hero.moving=false;
     if(!dir)return;
     const [dx,dy,face]=directions[dir];
     const step=hizukiWalkDistance(dt);
     const [x,y]=walk.move(hero.x,hero.y,dx*step,dy*step,
       (px,py)=>residents.some(npc=>Math.hypot(px-npc.x,py-npc.y)<heroRadius+RESIDENT_RADIUS));
     const traveled=Math.hypot(hero.x-x,hero.y-y);
     const site=face===1&&sites.find(site=>hero.y>=site.thresholdY&&y<site.thresholdY&&Math.abs(x-site.x)<=23);
     if(site&&interior.enter(site)){
       clearInput();
       title.textContent=site.name;
       if(site.lines)interior.resident().lines=site.lines;
     }
     Object.assign(hero,{x,y,face,moving:traveled>.01,distance:hero.distance+traveled});
   }
 }
 let last=performance.now();
 function frame(now){
   const dt=Math.min(32,now-last);
   last=now;
   const dir=dialogue.active||portrait.matches?undefined:[...input.values()].at(-1);
   if(!dialogue.active&&!portrait.matches){
     advance(dir,dt);
     if(!interior.active){
       for(const npc of residents){
         advanceResident(npc,dt,npcWalk,(x,y)=>
           Math.hypot(x-hero.x,y-hero.y)<heroRadius+RESIDENT_RADIUS||
           residents.some(other=>other!==npc&&Math.hypot(x-other.x,y-other.y)<2*RESIDENT_RADIUS));
       }
     }
   }
   if(interior.active)interior.draw(now);
   else world.draw(ctx,viewport,hero,residents,reduced.matches?0:now);
   const position=interior.position()??hero;
   canvas.dataset.x=String(Math.floor(position.x));
   canvas.dataset.y=String(Math.floor(position.y));
   canvas.dataset.room=interior.currentRoom??'';
   canvas.dataset.building=interior.site?.id??'';
   requestAnimationFrame(frame);
 }

 for(const button of buttons){
   button.addEventListener('pointerdown',e=>{
     if(e.button!==0)return;
     e.preventDefault();
     button.setPointerCapture(e.pointerId);
     hold(e.pointerId,button.dataset.dir);
   });
   for(const event of ['pointerup','pointercancel','lostpointercapture'])
     button.addEventListener(event,e=>updateInput(e.pointerId,undefined));
   button.addEventListener('contextmenu',e=>e.preventDefault());
 }
 document.querySelector('#action-a').addEventListener('click',interact);
 document.querySelector('#action-b').addEventListener('click',back);
 addEventListener('keydown',e=>{
   if(e.metaKey||e.ctrlKey||e.altKey||portrait.matches)return;
   const direction=keys[e.key];
   if(direction){e.preventDefault();if(!e.repeat)hold(e.key,direction);}
   else if(e.key==='z'||e.key==='Enter'&&e.target===document.body){e.preventDefault();if(!e.repeat)interact();}
   else if(e.key==='x'||e.key==='Escape'){e.preventDefault();if(!e.repeat)back();}
 });
 addEventListener('keyup',e=>{if(keys[e.key])updateInput(e.key,undefined);});
 addEventListener('blur',clearInput);
 addEventListener('pagehide',clearInput);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
 document.addEventListener('landscape-blocked',clearInput);
 resize();
 new ResizeObserver(resize).observe(canvas);
 window.__VILLAGE_PREVIEW_QA={
   residents:()=>residents.map(({id,x,y,face,moving})=>({id,x,y,face,moving}))
 };
 load.hidden=true;
 requestAnimationFrame(frame);
}
start().catch(error=>{
 console.error(error);
 load.textContent='村を読み込めませんでした。ページを再読み込みしてください。';
});
