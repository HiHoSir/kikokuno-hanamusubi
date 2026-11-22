import {COVE_MAP,walkableCell,coveExitFenceSegments} from '../../../data/maps/sea-cove/scene.mjs?v=cove-south-gate-1';
import {makeWalk,hizukiWalkDistance} from '../village/movement.mjs?v=shared-walk-1';
import {makeVillageFence,VILLAGE_FENCE_ART,VILLAGE_GATE_POST_ART} from '../village/boundary.mjs?v=gate-posts-1';
import {residentInFront} from '../village/residents.mjs';
import {bindDialogue} from '../village/dialogue.mjs';
import {pixelViewport,DEFAULT_CAMERA_ZOOM} from '../village/render.mjs?v=nonfield-world-scale-1';
import {readStoryStage,advanceStoryStage} from '../story/chapter-one.mjs';
import {consumeRestorePosition} from '../save/save-game.mjs?v=save-slots-1';
import {createCoveRenderer} from './render.mjs?v=cove-south-gate-1';
import {readPlayer,savePlayer} from '../battle/rules.mjs';
import {SHELL_KINDS} from '../items/shells.mjs';
import {
 coveVisibleShells,nearestCoveShell,collectCoveShell,validateCoveShellSites
} from '../../../data/maps/sea-cove/shells.mjs';

// Review-only mode reuses production rendering and movement but must not
// change the player's story, bag, scene checkpoint or persistent game state.
const previewMode=location.pathname.endsWith('/previews/sea-cove-review/')&&
  new URL(import.meta.url).searchParams.get('cove-review')==='1';
// Shortcuts only move the local review avatar. They must never write the
// player's save, alter the real game entry, or change camera/world scaling.
const previewSpots=Object.freeze({
 shore:Object.freeze({x:336,y:432,face:1}),
 rocks:Object.freeze({x:710,y:460,face:3}),
 worksite:Object.freeze({x:884,y:805,face:0}),
 south:Object.freeze({x:COVE_MAP.entry.x,y:COVE_MAP.height*COVE_MAP.tileSize-112,face:0})
});
const scene=document.querySelector('#scene');
const load=document.querySelector('#load');
const shellNotice=document.querySelector('#shell-notice');
const shellHint=document.querySelector('#shell-hint');
const shellHud=shellHint.parentElement;
const buttons=[...document.querySelectorAll('[data-dir]')];
const directions={up:[0,-1,1],down:[0,1,0],left:[-1,0,3],right:[1,0,2]};
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',
  w:'up',s:'down',a:'left',d:'right'};
const inputs=new Map();
const scenery={
 hero:'assets/characters/hizuki/walk-4dir-80x112.png',
 fisher:'assets/characters/npc/ushiohei-walk-4dir-80x112.png',
 rockWest:'assets/sea-cove/objects/shore-rock-west-60x40.png',
 rockEast:'assets/sea-cove/objects/shore-rock-east-104x64.png',
 rockHeadland:'assets/sea-cove/objects/shore-rock-headland-108x72.png',
 basket:'assets/sea-cove/objects/fish-basket-80x74.png',
 barrel:'assets/sea-cove/objects/fish-barrel-64x86.png',
 crate:'assets/sea-cove/objects/fish-crate-92x70.png',
 // Cove basket, barrel and crate use purpose-built native pixel art, not scaled 32px village chips.
 // Adopted village house at full native 390x357; no character-scale fudge.
 fisherHouse:'assets/village/scene/house-thatch.png',
 netRack:'assets/sea-cove/objects/net-drying-rack-232x176.png',
 netBundle:'assets/sea-cove/objects/net-bundle-146x88.png',
 ropeCoil:'assets/sea-cove/objects/rope-coil-88x62.png',
 pathSoil:'assets/village/scene/path-soil.png',
 fence:VILLAGE_FENCE_ART,
 gatePost:VILLAGE_GATE_POST_ART,
 water:'assets/field/effects/water-motion.png',
 coastMask:'assets/field/terrain/atlas/coast-mask-32.png',
 // Exact accepted shoreline-study atlas set: one connected coast chip from
 // the four existing 16-corner sand atlases, no newly drawn substitute.
 coastSand0:'assets/field/terrain/atlas/coast-sand-0-32.png',
 coastSand1:'assets/field/terrain/atlas/coast-sand-1-32.png',
 coastSand2:'assets/field/terrain/atlas/coast-sand-2-32.png',
 coastSand3:'assets/field/terrain/atlas/coast-sand-3-32.png'
};
// Keep asset filenames stable to avoid duplicates in the manifest, but make
// Safari refetch ONLY the three replaced images after the art revision.
const redrawnGear=new Set([scenery.basket,scenery.ropeCoil,scenery.netBundle]);
const image=async path=>{
 const resource=new Image();
 const url=new URL('../../../'+path,import.meta.url);
 if(redrawnGear.has(path))url.searchParams.set('v','cove-gear-style-20261119');
 resource.src=url.href;
 await resource.decode();
 if(!resource.naturalWidth||!resource.naturalHeight)throw Error('入り江の画像を読み込めません: '+path);
 return resource;
};
const clearInputs=()=>{
 inputs.clear();
 for(const node of buttons)node.classList.remove('held');
};
const chooseInput=(id,direction)=>{
 if(direction)inputs.set(id,direction);
 else inputs.delete(id);
 const active=[...inputs.values()].at(-1);
 for(const node of buttons)node.classList.toggle('held',node.dataset.dir===active);
};
export function linesForFisher(stage){
 if(stage==='chief')return [
  '潮平「潮が引くと、不思議な花が残ることがあるんだ。」',
  '潮平「里の鐘のことなら、まず里長さんに聞いておいで。」'
 ];
 if(stage==='shrine')return [
  '潮平「花びらを一枚拾ったが、妙な光でな。」',
  '潮平「天妖の社の白妙なら何か分かるかもしれない。」'
 ];
 if(stage==='cove')return [
  '潮平「昨夜の潮は妙だった。波が引いたあと、見たこともない花がひとひら残っていてな。」',
  '潮平「これを見ると、昔ここで誰かを待っていた気がする。誰だったかは思い出せないが……。」',
  '緋月「待っていたことは覚えてるんだね。花びら、預かってもいい？　手がかりを探してみる。」',
  '潮平「持っていきな。忘れの森の方へ光が伸びている。俺はここで、帰る人を待つよ。」'
 ];
 return [
  '潮平「花びらは忘れの森の方へ光を伸ばしていた。」',
  '潮平「名前を忘れても、俺はここで帰る人を待つよ。」'
 ];
}
async function start(){
 const invalidShellSites=validateCoveShellSites();
 if(invalidShellSites.length)throw Error('貝殻の位置が不正です: '+invalidShellSites.join(', '));
 // Normalize and persist new five-fight batches in the canonical player save.
 let heroInventory=previewMode?readPlayer():savePlayer(readPlayer());
 let shells=coveVisibleShells(heroInventory);
 // The study's approved sand texture is painted by the existing field
 // landscape engine. Load those same assets without changing field code.
 const landscapeReady=new Promise((resolve,reject)=>{
   const LAND=window.YK_LANDSCAPE,AUTO=window.YK_AUTOTILE;
   if(!LAND?.load||!AUTO?.load){reject(Error('承認済み砂浜の描画基盤がありません'));return;}
   const timeout=setTimeout(()=>reject(Error('承認済み砂浜の画像読込がタイムアウトしました')),25000);
   const check=()=>{
     const problems={...LAND.errors,...AUTO.errors};
     if(Object.keys(problems).length){clearTimeout(timeout);reject(Error(JSON.stringify(problems)));return;}
     if(LAND.ready()&&AUTO.ready()){clearTimeout(timeout);resolve();}
   };
   LAND.load(check);AUTO.load(check);check();
 });
 const [images]=await Promise.all([
  Promise.all(Object.entries(scenery).map(async([id,path])=>[id,await image(path)]))
    .then(entries=>Object.fromEntries(entries)),
  landscapeReady
 ]);
 if(images.water.naturalWidth<32||images.water.naturalHeight<32)
  throw Error('水面の地形画像が不足しています');
 for(const [id,w,h] of [
  ['rockWest',60,40],['rockEast',104,64],['rockHeadland',108,72]
 ]){
  if(images[id].naturalWidth!==w||images[id].naturalHeight!==h)
   throw Error('原寸岩の画像寸法が不正です: '+id);
 }
 for(const id of ['coastMask','coastSand0','coastSand1','coastSand2','coastSand3']){
  if(images[id].naturalWidth!==128||images[id].naturalHeight!==128)
   throw Error('海岸線の16チップアトラスが不正です: '+id);
 }
 const {width,height,tileSize,fisher:site,entry}=COVE_MAP;
 const blocked=Uint8Array.from({length:width*height},(_,i)=>
   walkableCell(i%width,Math.floor(i/width))?0:1);
 const collision=Uint8Array.from(
   {length:width*height*tileSize*tileSize},
   (_,i)=>blocked[Math.floor(i/(width*tileSize*tileSize))*width+
     Math.floor(i%(width*tileSize)/tileSize)]
 );
 const fence=makeVillageFence(coveExitFenceSegments(COVE_MAP),collision,width*tileSize);
 const walk=makeWalk(width*tileSize,height*tileSize,collision,7);
 // Native-sized objects remain separate from sand/grass tiles.
 const fishermen={...site,bitmap:images.fisher,distance:0,moving:false,
   lines:linesForFisher(readStoryStage())};
 // Collider positions are authored independently of roof alpha and net mesh.
 // The house blocks full roof overlap, so the character never disappears
 // behind its art. The cove rocks have their own native foot radii.
 const collisionObjects=COVE_MAP.objects
   .filter(o=>o.solid||['basket','barrel','rocks'].includes(o.kind))
   .map(o=>o.collision
     ?{shape:'box',...o.collision,id:o.id}
     :{shape:'circle',id:o.id,x:o.footPosition?o.x:o.x*tileSize+16,
       y:o.footPosition?o.y:(o.y+1)*tileSize-10,
       radius:o.radius??22});
 const blockedByProp=(px,py)=>collisionObjects.some(o=>
   o.shape==='box'
     ?px>=o.left-6&&px<=o.right+6&&py>=o.top-6&&py<=o.bottom+6
     :Math.hypot(px-o.x,py-o.y)<o.radius+3);
 const occupied=(px,py)=>
   Math.hypot(px-fishermen.x,py-fishermen.y)<24||
   blockedByProp(px,py);
 const restored=previewMode?null:consumeRestorePosition('cove');
 const usable=restored&&walk.canStand(restored.x,restored.y,true)&&!occupied(restored.x,restored.y);
 let x=usable?restored.x:entry.x,y=usable?restored.y:entry.y;
 let face=usable?(restored.face??entry.face):entry.face;
 if(previewMode){
  const requested=new URLSearchParams(location.search).get('spot');
  const spot=previewSpots[requested];
  if(spot&&walk.canStand(spot.x,spot.y)&&!occupied(spot.x,spot.y)){
   x=spot.x;y=spot.y;face=spot.face;
  }
 }
 let elapsedMs=0,lastFrame=0,distance=0,menuPaused=false,lastRenderedFrame=-1;
 let noticeUntil=0;
 const renderer=createCoveRenderer(scene.getContext('2d',{alpha:false}),images,fence);
 const dialogue=bindDialogue(clearInputs,ended=>{
   if(!previewMode&&ended.id==='ushiohei'&&readStoryStage()==='cove'){
     advanceStoryStage('forest');
     fishermen.lines=linesForFisher(readStoryStage());
   }
 });
 function refreshShellHint(now=performance.now()){
   if(now>=noticeUntil&&shellNotice.textContent)shellNotice.textContent='';
   const nearest=dialogue.active?null:nearestCoveShell(heroInventory,x,y);
   const next=nearest?SHELL_KINDS[nearest.kind].name+'を拾う：A':'';
   if(shellHint.textContent!==next)shellHint.textContent=next;
   shellHud.hidden=!next&&!shellNotice.textContent;
 }
 // Non-field world scenes have ONE scale: village, rooms, sanctuary and cove.
 // Camera movement follows the player but never changes the CSS pixel/world
 // pixel ratio. Houses, net racks and heroes stay proportionally identical.
 const viewport={step:1,bufferWidth:1,bufferHeight:1};
 const resize=()=>{
   const parent=scene.parentElement;
   const dims=pixelViewport(parent.clientWidth,parent.clientHeight,devicePixelRatio,DEFAULT_CAMERA_ZOOM);
   scene.width=dims.width;scene.height=dims.height;
   viewport.step=dims.step;viewport.bufferWidth=dims.width;viewport.bufferHeight=dims.height;
 };
 const leave=()=>{
   clearInputs();
   window.KIKOKU_ROUTE.go(new URL('../../field/?from=cove',import.meta.url));
 };
 const frame=now=>{
   const dt=lastFrame?Math.min(40,Math.max(0,now-lastFrame)):0;
   lastFrame=now;elapsedMs+=dt;
   let moving=false;
   const direction=[...inputs.values()].at(-1);
   if(!menuPaused&&!dialogue.active&&direction){
     const [dx,dy,row]=directions[direction];
     face=row;
     const step=hizukiWalkDistance(dt);
     const [nx,ny,leftMap]=walk.move(x,y,dx*step,dy*step,occupied,true);
     if(leftMap&&!previewMode){leave();return;}
     moving=Math.hypot(nx-x,ny-y)>.01;
     distance+=Math.hypot(nx-x,ny-y);
     x=nx;y=ny;
   }
   fishermen.lines=linesForFisher(readStoryStage());
   dialogue.update(residentInFront(x,y,face,[fishermen]),x,y);
   refreshShellHint(now);
   const tick=Math.floor(now/180);
   if(!menuPaused&&(moving||tick!==lastRenderedFrame)){
     renderer({x,y,face,distance,moving},fishermen,now,viewport,shells);
     lastRenderedFrame=tick;
   }
   scene.dataset.x=String(Math.floor(x/tileSize));
   scene.dataset.y=String(Math.floor(y/tileSize));
   requestAnimationFrame(frame);
 };
 const interact=()=>{
   if(dialogue.active){dialogue.advance();return;}
   // Talking to the story NPC always takes precedence.
   if(residentInFront(x,y,face,[fishermen])){
     dialogue.open();return;
   }
   const shell=nearestCoveShell(heroInventory,x,y);
   if(shell){
     const result=collectCoveShell(heroInventory,shell.id,x,y);
     if(result.accepted){
       heroInventory=previewMode?result.player:savePlayer(result.player);
       shells=coveVisibleShells(heroInventory);
       shellNotice.textContent=result.message;
       noticeUntil=performance.now()+1800;
       if(!previewMode)window.parent?.KIKOKU_GAME?.autosave?.(window);
       lastRenderedFrame=-1;
       refreshShellHint();
       return;
     }
   }
   dialogue.open();
 };
 if(previewMode){
  for(const button of document.querySelectorAll('[data-review-spot]')){
   button.addEventListener('click',()=>{
    const spot=previewSpots[button.dataset.reviewSpot];
    if(!spot||!walk.canStand(spot.x,spot.y)||occupied(spot.x,spot.y))return;
    clearInputs();
    x=spot.x;y=spot.y;face=spot.face;
    distance=0;lastRenderedFrame=-1;
    for(const other of document.querySelectorAll('[data-review-spot]'))
     other.setAttribute('aria-pressed',String(other===button));
   });
  }
 }
 document.querySelector('#action-a')?.addEventListener('click',interact);
 document.querySelector('#action-b')?.addEventListener('click',()=>dialogue.advance());
 for(const button of buttons){
   button.addEventListener('pointerdown',e=>{
     if(e.button!==0)return;
     e.preventDefault();button.setPointerCapture(e.pointerId);
     chooseInput(e.pointerId,button.dataset.dir);
   });
   for(const event of ['pointerup','lostpointercapture','pointercancel'])
     button.addEventListener(event,e=>chooseInput(e.pointerId,null));
   button.addEventListener('contextmenu',e=>e.preventDefault());
 }
 addEventListener('keydown',e=>{
   if((e.key==='Enter'||e.key===' ')&&e.target?.tagName==='BUTTON')return;
   if(e.key==='z'||e.key==='Z'||e.key==='Enter'||e.key===' '){
     e.preventDefault();if(!e.repeat)interact();return;
   }
   if((e.key==='x'||e.key==='X')&&dialogue.active){
     e.preventDefault();dialogue.advance();return;
   }
   if(!keys[e.key]||e.ctrlKey||e.metaKey||e.altKey)return;
   e.preventDefault();if(!e.repeat)chooseInput(e.key,keys[e.key]);
 });
 addEventListener('keyup',e=>{if(keys[e.key])chooseInput(e.key,null);});
 addEventListener('blur',clearInputs);
 addEventListener('pagehide',clearInputs);
 addEventListener('game-menu-open',()=>{menuPaused=true;clearInputs();});
 addEventListener('game-menu-close',()=>{menuPaused=false;lastRenderedFrame=-1;});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInputs();});
 resize();new ResizeObserver(resize).observe(scene.parentElement);
 renderer({x,y,face,distance,moving:false},fishermen,performance.now(),viewport,shells);
 refreshShellHint();
 load.hidden=true;
 window.__COVE_PREVIEW_MODE=previewMode;
 window.__COVE_HAMLET_QA={
   bounds:[COVE_MAP.width,COVE_MAP.height],
   spawn:{...entry},
   objects:COVE_MAP.objects.map(o=>({id:o.id??o.kind,kind:o.kind,
     x:o.x,y:o.y,solid:o.solid??true,collision:o.collision??null,
     footPosition:o.footPosition??false,sprite:o.sprite??null})),
   assets:Object.fromEntries(['fisherHouse','netRack','netBundle','ropeCoil','crate','rockWest','rockEast','rockHeadland']
     .map(kind=>[kind,{width:images[kind].naturalWidth,height:images[kind].naturalHeight}])),
   blockedByProp:(x,y)=>blockedByProp(x,y),
   cameraZoom:DEFAULT_CAMERA_ZOOM
 };
 window.__COVE_FISHER_QA={
   character:'ushiohei',
   sprite:scenery.fisher,
   size:[images.fisher.naturalWidth,images.fisher.naturalHeight],
   frame:[80,112],directions:4,framesPerDirection:3,
   feet:[40,106],
   stage:readStoryStage()
 };

 window.KIKOKU_SAVE_SNAPSHOT=()=>({scene:'cove',position:{x,y,face}});
 window.__COVE_SURF_QA=()=>({...renderer.surfInfo,
   phase:Math.floor(performance.now()/260)%renderer.surfInfo.frames});
 window.__COVE_SHELL_QA=()=>({
   available:shells.length,
   species:shells.map(item=>item.kind),
   spots:shells.map(({id,x,y})=>({id,x,y})),
   nearest:nearestCoveShell(heroInventory,x,y)?.id??null,
   bag:{...heroInventory.shells.bag},
   gold:heroInventory.gold,
   completedBattles:heroInventory.completedBattles
 });
 if(!previewMode)window.parent?.KIKOKU_GAME?.autosave?.(window);
 requestAnimationFrame(frame);
}
start().catch(error=>{
 console.error(error);
 load.textContent='海の入り江を読み込めません。通信状態を確認してください。';
});
