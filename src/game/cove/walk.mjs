import {COVE_MAP,tileAt,walkableCell,isSouthExit} from '../../../data/maps/sea-cove/scene.mjs';
import {makeWalk} from '../village/movement.mjs';
import {residentInFront} from '../village/residents.mjs';
import {bindDialogue} from '../village/dialogue.mjs';
import {pixelViewport} from '../village/render.mjs';
import {readStoryStage,advanceStoryStage,objectiveForStage} from '../story/chapter-one.mjs';
import {consumeRestorePosition} from '../save/save-game.mjs?v=save-slots-1';
import {createCoveRenderer} from './render.mjs';
import {readPlayer,savePlayer} from '../battle/rules.mjs';
import {SHELL_KINDS,shellBagCount} from '../items/shells.mjs';
import {
 coveVisibleShells,nearestCoveShell,collectCoveShell,validateCoveShellSites
} from '../../../data/maps/sea-cove/shells.mjs';

// Review-only mode reuses production rendering and movement but must not
// change the player's story, bag, scene checkpoint or persistent game state.
const previewMode=location.pathname.endsWith('/previews/sea-cove-review/')&&
  new URL(import.meta.url).searchParams.get('cove-review')==='1';
const scene=document.querySelector('#scene');
const load=document.querySelector('#load');
const objective=document.querySelector('#objective');
const shellHint=document.querySelector('#shell-hint');
const buttons=[...document.querySelectorAll('[data-dir]')];
const directions={up:[0,-1,1],down:[0,1,0],left:[-1,0,3],right:[1,0,2]};
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',
  w:'up',s:'down',a:'left',d:'right'};
const inputs=new Map();
const scenery={
 hero:'assets/characters/hizuki/walk-4dir-80x112.png',
 fisher:'assets/characters/npc/ushiohei-walk-4dir-80x112.png',
 rocks:'assets/village/objects/rocks.png',
 basket:'assets/village/objects/basket.png',
 barrel:'assets/village/objects/barrel.png',
 water:'assets/field/effects/water-motion.png',
 coastMask:'assets/field/terrain/atlas/coast-mask-32.png',
 // Exact accepted shoreline-study atlas set: one connected coast chip from
 // the four existing 16-corner sand atlases, no newly drawn substitute.
 coastSand0:'assets/field/terrain/atlas/coast-sand-0-32.png',
 coastSand1:'assets/field/terrain/atlas/coast-sand-1-32.png',
 coastSand2:'assets/field/terrain/atlas/coast-sand-2-32.png',
 coastSand3:'assets/field/terrain/atlas/coast-sand-3-32.png'
};
const image=async path=>{
 const resource=new Image();
 resource.src=new URL('../../../'+path,import.meta.url).href;
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
 for(const id of ['rocks','water']){
  if(images[id].naturalWidth<32||images[id].naturalHeight<32)
   throw Error('32pxマップチップの寸法が不足しています: '+id);
 }
 for(const id of ['coastMask','coastSand0','coastSand1','coastSand2','coastSand3']){
  if(images[id].naturalWidth!==128||images[id].naturalHeight!==128)
   throw Error('海岸線の16チップアトラスが不正です: '+id);
 }
 const {width,height,tileSize,fisher:site,entry}=COVE_MAP;
 const blocked=Uint8Array.from({length:width*height},(_,i)=>
   walkableCell(i%width,Math.floor(i/width))?0:1);
 const walk=makeWalk(width*tileSize,height*tileSize,Uint8Array.from(
   {length:width*height*tileSize*tileSize},
   (_,i)=>blocked[Math.floor(i/(width*tileSize*tileSize))*width+
     Math.floor(i%(width*tileSize)/tileSize)]
 ),7);
 // Native-sized objects remain separate from sand/grass tiles.
 const fishermen={...site,bitmap:images.fisher,distance:0,moving:false,
   lines:linesForFisher(readStoryStage())};
 const collisionObjects=COVE_MAP.objects
   .filter(o=>['basket','barrel','rocks'].includes(o.kind))
   .map(o=>({x:o.footPosition?o.x:o.x*tileSize+16,
     y:o.footPosition?o.y:(o.y+1)*tileSize-10,
     radius:o.kind==='rocks'?22:22}));
 const occupied=(px,py)=>
   Math.hypot(px-fishermen.x,py-fishermen.y)<24||
   collisionObjects.some(o=>Math.hypot(px-o.x,py-o.y)<o.radius);
 const restored=previewMode?null:consumeRestorePosition('cove');
 const usable=restored&&walk.canStand(restored.x,restored.y)&&!occupied(restored.x,restored.y);
 let x=usable?restored.x:entry.x,y=usable?restored.y:entry.y;
 let face=usable?(restored.face??entry.face):entry.face;
 let elapsedMs=0,lastFrame=0,distance=0,menuPaused=false,lastRenderedFrame=-1;
 const renderer=createCoveRenderer(scene.getContext('2d',{alpha:false}),images);
 const dialogue=bindDialogue(clearInputs,ended=>{
   if(!previewMode&&ended.id==='ushiohei'&&readStoryStage()==='cove'){
     advanceStoryStage('forest');
     objective.textContent=objectiveForStage(readStoryStage());
     fishermen.lines=linesForFisher(readStoryStage());
   }
 });
 const refreshObjective=()=>{
   const stage=readStoryStage();
   objective.textContent=stage==='cove'?'浜辺にいる潮平を探そう':objectiveForStage(stage);
 };
 function refreshShellHint(){
   const nearest=nearestCoveShell(heroInventory,x,y);
   const bag=shellBagCount(heroInventory.shells.bag);
   const next=nearest?
     SHELL_KINDS[nearest.kind].name+'を拾う：A':
     '貝殻 '+bag+'個所持／浜辺 '+shells.length+'個（戦闘5回で補充）';
   if(shellHint.textContent!==next)shellHint.textContent=next;
 }
 refreshObjective();
 const viewport={step:1,bufferWidth:1,bufferHeight:1};
 const resize=()=>{
   const parent=scene.parentElement;
   const dims=pixelViewport(parent.clientWidth,parent.clientHeight,devicePixelRatio,1.18);
   scene.width=dims.width;scene.height=dims.height;
   viewport.step=dims.step;viewport.bufferWidth=dims.width;viewport.bufferHeight=dims.height;
 };
 const leave=()=>{
   clearInputs();
   if(previewMode){location.reload();return;}
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
     const step=150*dt/1000;
     const [nx,ny]=walk.move(x,y,dx*step,dy*step,occupied);
     moving=Math.hypot(nx-x,ny-y)>.01;
     distance+=Math.hypot(nx-x,ny-y);
     x=nx;y=ny;
     if(isSouthExit(Math.floor(x/tileSize),Math.floor(y/tileSize))){
       leave();return;
     }
   }
   fishermen.lines=linesForFisher(readStoryStage());
   dialogue.update(residentInFront(x,y,face,[fishermen]),x,y);
   refreshShellHint();
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
       objective.textContent=result.message;
       if(!previewMode)window.parent?.KIKOKU_GAME?.autosave?.(window);
       lastRenderedFrame=-1;
       refreshShellHint();
       return;
     }
   }
   dialogue.open();
 };
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
