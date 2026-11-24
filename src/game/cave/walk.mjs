import {CAVE_WHITE_SEAL,CAVE_BLACK_SEAL} from '../../../data/maps/cave/finds.mjs?v=guardian-1';
import {CAVE_TILE,CAVE_FLOORS,CAVE_BOSS_ID,caveCellCenter,caveFeatureBlocks,caveStairAt,caveEncounterTerrain,caveLayout}
 from '../../../data/maps/cave/floors.mjs?v=cave-maps-1-stair-links-1-exploration-1-maze-2-stairs-2-rise-1';
import {hizukiWalkDistance,makeWalk} from '../village/movement.mjs?v=shared-walk-1';
import {bindDialogue} from '../village/dialogue.mjs';
import {drawCharacter} from '../village/residents.mjs';
import {WORLD_SCENE_ZOOM} from '../ui/world-scale.mjs';
import {BATTLE_REQUEST_KEY,readPlayer,savePlayer,collectFind,chooseFieldEncounter} from '../battle/rules.mjs?v=cave-quest-1-finds-1-guardian-1';
import {consumeRestorePosition} from '../save/save-game.mjs?v=save-slots-1-shiomachi-gear-1-cave-quest-1-finds-1-guardian-1';
import {CAVE_DARK} from './terrain-art.mjs?v=cave-visual-1-guardian-1';
import {createCaveMap} from './map-parts.mjs?v=cave-maps-1-stair-links-1-exploration-1-maze-2-stairs-2-rise-1-treads-1-perspective-1';

const root=new URL('../../../',import.meta.url);
const scene=document.querySelector('#scene'),load=document.querySelector('#load');
const ctx=scene.getContext('2d',{alpha:false});
const notice=document.querySelector('#notice');
const tile=CAVE_TILE;
const directions={up:[0,-1,1],down:[0,1,0],left:[-1,0,3],right:[1,0,2]};
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
async function image(path){
 const bitmap=new Image();
 bitmap.src=new URL(path,root);
 await bitmap.decode();
 return bitmap;
}

async function start(){
 const [floorArt,wallArt,ledgeArt,heroArt,bossArt,crateArt]=await Promise.all([
  ...['floor-material-atlas','wall-material','rock-ledge'].map(id=>image('assets/cave/'+id+'.png?v=cave-visual-1')),
  image('assets/characters/hizuki/walk-4dir-80x112.png'),image('assets/enemies/cave-guardian-idle.png'),
  image('assets/sea-cove/objects/fish-crate-92x70.png')
 ]);
 const restored=consumeRestorePosition('cave');
 const inputs=new Map();
 let pending=null,paused=false,leaving=false,timer;
 let floor,layout,walk,terrain,x,y,face,distance,last=0;
 const renderedFloors=new Map();
 const hero={bitmap:heroArt};
 let player=readPlayer();
 const bossDefeated=player.caveQuest.rockBreaker;
 let encounterRemaining;
 const clear=()=>{inputs.clear();pending=null;};
 const dialogue=bindDialogue(clear,()=>startBattle({enemyId:CAVE_BOSS_ID,count:1}));
 function tell(text){
  notice.textContent=text;
  notice.hidden=false;
  clearTimeout(timer);
  timer=setTimeout(()=>{notice.hidden=true;},3000);
 }
 function enter(index,cell,point){
  clear();
  encounterRemaining=tile*(9+Math.floor(Math.random()*5));
  floor=index;layout=caveLayout(floor,player.foundItems);
  const width=layout.grid[0].length*tile,height=layout.grid.length*tile;
  const blocked=new Uint8Array(width*height);
  terrain=renderedFloors.get(index);
  if(!terrain){
   terrain=createCaveMap(layout,{floorArt,wallArt,ledgeArt,crateArt});
   renderedFloors.set(index,terrain);
  }
  for(const [row,line] of layout.grid.entries())for(let col=0;col<line.length;col++){
   if(line[col]==='.')continue;
   const px=col*tile,py=row*tile;
   for(let line=py;line<py+tile;line++)blocked.fill(1,line*width+px,line*width+px+tile);
  }
  walk=makeWalk(width,height,blocked,8);
  [x,y]=point&&walk.canStand(point.x,point.y)&&!occupied(point.x,point.y)?[point.x,point.y]:caveCellCenter(cell);
  face=point?.face??1;distance=0;
  scene.dataset.floor=String(floor+1);
  tell('地下'+(floor+1)+'階');
  window.parent?.KIKOKU_GAME?.autosave?.(window);
 }
 const snapshot=()=>({scene:'cave',position:{x,y,face,floor}});
 function occupied(px,py){
  if(layout.features.some(feature=>(feature.kind!=='cache'||!player.foundItems.includes(feature.id))&&caveFeatureBlocks(feature,px,py)))return true;
  if(!layout.boss||bossDefeated)return false;
  const [bx,by]=caveCellCenter(layout.boss);
  return Math.hypot(px-bx,py-by)<34;
 }
 window.KIKOKU_SAVE_SNAPSHOT=snapshot;
 const returning=new URLSearchParams(location.search).get('from')==='guardian';
 const initial=restored?.floor??(returning?2:0);
 enter(initial,CAVE_FLOORS[initial].entry,restored);
 if(returning&&bossDefeated)tell('岩砕きの槌を手に入れた。');
 load.hidden=true;

 function useStair(stair){
  const next=floor+(stair.kind==='down'?1:-1);
  const arrival=stair.kind==='down'?CAVE_FLOORS[next].up:CAVE_FLOORS[next].down;
  enter(next,arrival.approach);
 }
 function interact(){
  if(leaving||paused)return;
  if(dialogue.active){dialogue.advance();return;}
  const stair=caveStairAt(floor,x,y);
  if(stair){
   useStair(stair);
   return;
  }
  const [dx,dy]=Object.values(directions).find(([, ,row])=>row===face);
  const cache=layout.features.find(feature=>{
   if(!['cache','seal','inscription','drop'].includes(feature.kind))return false;
   if(feature.kind==='cache'&&player.foundItems.includes(feature.id))return false;
   const [tx,ty]=caveCellCenter(feature.origin);
   if(feature.kind==='drop')return dy===1&&y<ty&&ty-y<62&&Math.abs(x-tx)<26;
   return Math.hypot(tx-x,ty-y)<62&&(tx-x)*dx+(ty-y)*dy>0;
  });
  if(cache){
   if(cache.kind==='inscription'){
    tell(cache.text);
    return;
   }
   if(cache.kind==='drop'){
    clear();
    [x,y]=caveCellCenter(cache.landing);
    tell('岩段を飛び降りた。入口へ戻る道だ。');
    window.parent?.KIKOKU_GAME?.autosave?.(window);
    return;
   }
   if(cache.id===CAVE_BLACK_SEAL&&!player.foundItems.includes(CAVE_WHITE_SEAL)){
    tell('黒い石は動かない。台座に白い石の紋が刻まれている。');
    return;
   }
   const result=collectFind(readPlayer(),cache.id);
   if(result.accepted){
    player=savePlayer(result.player);
    if(cache.id===CAVE_BLACK_SEAL){
     renderedFloors.delete(floor);
     enter(floor,layout.entry,snapshot().position);
    }
    window.parent?.KIKOKU_GAME?.autosave?.(window);
   }
   tell(result.message);
   return;
  }
  const boss=layout.boss&&!bossDefeated?caveCellCenter(layout.boss):null;
  if(boss&&Math.hypot(x-boss[0],y-boss[1])<74){
   dialogue.update({x:boss[0],y:boss[1],name:'岩守の鬼',lines:[
    '岩守の鬼「止まれ。その槌は、山が崩れぬよう代々ここで預かってきた。」',
    '緋月「潮待村の先で、大岩が橋を塞いでるの。道を開けたら、きっと返す。」',
    '岩守の鬼「ならば試そう。岩を砕く力より、大槌を受け止める覚悟を見せてみろ。」'
   ]},x,y);
   dialogue.open();
  }
 }
 function startBattle(encounter){
  clear();
  try{
   sessionStorage.setItem(BATTLE_REQUEST_KEY,JSON.stringify({
    ...encounter,at:Date.now(),cavePosition:snapshot().position
   }));
  }catch{
   tell('戦闘の準備ができませんでした。');return false;
  }
  leaving=true;
  window.KIKOKU_ROUTE.go(new URL('../battle/',import.meta.url));
  return true;
 }

 function draw(moving){
  const rect=scene.parentElement.getBoundingClientRect();
  const dpr=Math.min(devicePixelRatio||1,3),scale=dpr*WORLD_SCENE_ZOOM;
  const width=Math.round(rect.width*dpr),height=Math.round(rect.height*dpr);
  if(scene.width!==width||scene.height!==height){scene.width=width;scene.height=height;}
  if(!width||!height)return;
  const camera=(length,view,point)=>length<view?(length-view)/2:Math.max(0,Math.min(length-view,point-view/2));
  const cx=camera(terrain.width,width/scale,x),cy=camera(terrain.height,height/scale,y-68);
  ctx.resetTransform();ctx.fillStyle=CAVE_DARK;ctx.fillRect(0,0,width,height);
  ctx.imageSmoothingEnabled=false;
  ctx.setTransform(scale,0,0,scale,-Math.round(cx*scale),-Math.round(cy*scale));
  const actors=[{depth:y,draw:ctx=>drawCharacter(ctx,{...hero,x,y,face,moving,distance})}];
  if(layout.boss&&!bossDefeated){
   const [bx,by]=caveCellCenter(layout.boss);
   actors.push({depth:by,draw:ctx=>ctx.drawImage(bossArt,bx-bossArt.width/2,by-bossArt.height+7)});
  }
  terrain.draw(ctx,x,y,actors,player.foundItems);
  if(layout.visibilityRadius){
   const radius=layout.visibilityRadius;
   const shade=ctx.createRadialGradient(x,y-28,radius*.42,x,y-28,radius);
   shade.addColorStop(0,'transparent');
   shade.addColorStop(1,'#080b10d9');
   ctx.fillStyle=shade;
   ctx.fillRect(cx,cy,width/scale,height/scale);
  }
 }
 function frame(now){
  if(leaving)return;
  const elapsed=last?Math.min(40,now-last):0;
  last=now;
  let moving=false;
  const dir=pending??[...inputs.values()].at(-1);
  pending=null;
  if(dir&&!paused&&!dialogue.active){
   const [dx,dy,row]=directions[dir],step=hizukiWalkDistance(elapsed);
   const stair=caveStairAt(floor,x,y);
   let touchedStair=false;
   const [nx,ny]=walk.move(x,y,dx*step,dy*step,(px,py)=>{
    if(stair&&caveFeatureBlocks(stair,px,py))touchedStair=true;
    return occupied(px,py);
   });
   if(touchedStair){
    useStair(stair);
    draw(false);
    requestAnimationFrame(frame);
    return;
   }
   const travel=Math.hypot(nx-x,ny-y);
   distance+=travel;moving=travel>0;x=nx;y=ny;face=row;
   if(layout.exit&&dy>0&&Math.abs(x-caveCellCenter(layout.exit)[0])<1.5*tile&&y>=layout.exit[1]*tile+17){
    leaving=true;window.KIKOKU_ROUTE.go(new URL('../../field/?from=cave',import.meta.url));return;
   }
   if(moving&&caveEncounterTerrain(floor,x,y)&&!caveStairAt(floor,x,y)){
    encounterRemaining-=travel;
    if(encounterRemaining<=0){
     const encounter=chooseFieldEncounter();
     if(startBattle(encounter))return;
     encounterRemaining=tile*9;
    }
   }
  }
  draw(moving);
  requestAnimationFrame(frame);
 }
 for(const button of document.querySelectorAll('[data-dir]')){
  button.addEventListener('pointerdown',event=>{
   if(event.button!==0||paused||dialogue.active)return;
   event.preventDefault();button.setPointerCapture(event.pointerId);
   pending=button.dataset.dir;inputs.set(event.pointerId,pending);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])
   button.addEventListener(type,event=>inputs.delete(event.pointerId));
 }
 document.querySelector('#action-a').addEventListener('click',interact);
 addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||paused||event.repeat)return;
  if(keys[event.key]&&!dialogue.active){
   event.preventDefault();pending=keys[event.key];inputs.set(event.key,pending);
  }else if(['Enter',' ','z'].includes(event.key)&&event.target?.tagName!=='BUTTON'){
   event.preventDefault();interact();
  }
 });
 addEventListener('keyup',event=>inputs.delete(event.key));
 addEventListener('blur',clear);
 addEventListener('game-menu-open',()=>{paused=true;clear();});
 addEventListener('game-menu-close',()=>{paused=false;});
 requestAnimationFrame(frame);
}
if(window.KIKOKU_ROUTE.admitted)start().catch(error=>{load.textContent='洞窟を読み込めませんでした。';console.error(error);});
