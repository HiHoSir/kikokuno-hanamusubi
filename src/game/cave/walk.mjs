import {CAVE_TILE,CAVE_FLOORS,CAVE_BOSS_ID,caveCellOpen} from '../../../data/maps/cave/floors.mjs';
import {hizukiWalkDistance,makeWalk} from '../village/movement.mjs?v=shared-walk-1';
import {drawCharacter} from '../village/residents.mjs';
import {WORLD_SCENE_ZOOM} from '../ui/world-scale.mjs';
import {BATTLE_REQUEST_KEY,readPlayer} from '../battle/rules.mjs?v=cave-quest-1';
import {consumeRestorePosition} from '../save/save-game.mjs?v=save-slots-1-shiomachi-gear-1-cave-quest-1';

const root=new URL('../../../',import.meta.url);
const scene=document.querySelector('#scene'),load=document.querySelector('#load');
const ctx=scene.getContext('2d',{alpha:false});
const notice=document.querySelector('#notice');
const tile=CAVE_TILE;
const center=cell=>cell.map(value=>(value+.5)*tile);
const directions={up:[0,-1,1],down:[0,1,0],left:[-1,0,3],right:[1,0,2]};
const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
const downLanding=[[12,11],[16,4]];
async function image(path){
 const bitmap=new Image();
 bitmap.src=new URL(path,root);
 await bitmap.decode();
 return bitmap;
}

async function start(){
 const [floorArt,wallArt,stairsUp,stairsDown,ledgeArt,heroArt,bossArt]=await Promise.all([
  ...['floor-material','wall-material','stairs-up','stairs-down','rock-ledge'].map(id=>image('assets/cave/'+id+'.png')),
  image('assets/characters/hizuki/walk-4dir-80x112.png'),image('assets/enemies/field-oni.png')
 ]);
 const restored=consumeRestorePosition('cave');
 const inputs=new Map();
 let pending=null,paused=false,leaving=false,timer;
 let floor,layout,walk,background,x,y,face,distance,last=0;
 const hero={bitmap:heroArt};
 const bossDefeated=readPlayer().caveQuest.rockBreaker;
 const clear=()=>{inputs.clear();pending=null;};
 function tell(text){
  notice.textContent=text;
  notice.hidden=false;
  clearTimeout(timer);
  timer=setTimeout(()=>{notice.hidden=true;},3000);
 }
 function enter(index,cell,point){
  clear();
  floor=index;layout=CAVE_FLOORS[floor];
  const width=layout.grid[0].length*tile,height=layout.grid.length*tile;
  const blocked=new Uint8Array(width*height);
  background=document.createElement('canvas');
  background.width=width;background.height=height;
  const paint=background.getContext('2d');
  for(const [row,line] of layout.grid.entries())for(let col=0;col<line.length;col++){
   const px=col*tile,py=row*tile;
   if(caveCellOpen(floor,col,row)){
    paint.drawImage(floorArt,px,py);
    if(!caveCellOpen(floor,col,row-1)){
     const shade=paint.createLinearGradient(0,py,0,py+17);
     shade.addColorStop(0,'#090d16bf');shade.addColorStop(1,'#090d1600');
     paint.fillStyle=shade;paint.fillRect(px,py,tile,17);
    }
   }else{
    const faceVisible=caveCellOpen(floor,col,row+1);
    paint.fillStyle='#0b1018';paint.fillRect(px,py,tile,tile);
    if(faceVisible)paint.drawImage(wallArt,px,py);
    for(let line=py;line<py+tile;line++)blocked.fill(1,line*width+px,line*width+px+tile);
   }
  }
  for(const [marker,art] of [[layout.up,stairsUp],[layout.down,stairsDown]]){
   if(marker){
    const [mx,my]=center(marker);
    paint.drawImage(art,mx-art.width/2,my-art.height/2);
   }
  }
  walk=makeWalk(width,height,blocked,8);
  [x,y]=point&&walk.canStand(point.x,point.y)?[point.x,point.y]:center(cell);
  face=point?.face??1;distance=0;
  scene.dataset.floor=String(floor+1);
  tell('地下'+(floor+1)+'階');
  window.parent?.KIKOKU_GAME?.autosave?.(window);
 }
 const snapshot=()=>({scene:'cave',position:{x,y,face,floor}});
 window.KIKOKU_SAVE_SNAPSHOT=snapshot;
 const returning=new URLSearchParams(location.search).get('from')==='guardian';
 const initial=restored?.floor??(returning?2:0);
 enter(initial,CAVE_FLOORS[initial].entry,restored);
 if(returning&&bossDefeated)tell('岩砕きの槌を手に入れた。');
 load.hidden=true;

 const closeTo=cell=>Boolean(cell)&&Math.hypot(x-center(cell)[0],y-center(cell)[1])<60;
 function interact(){
  if(leaving||paused)return;
  if(closeTo(layout.down))enter(floor+1,CAVE_FLOORS[floor+1].entry);
  else if(closeTo(layout.up))enter(floor-1,downLanding[floor-1]);
  else if(!bossDefeated&&layout.boss&&Math.hypot(x-center(layout.boss)[0],y-center(layout.boss)[1])<74){
   leaving=true;clear();
   try{
    sessionStorage.setItem(BATTLE_REQUEST_KEY,JSON.stringify({enemyId:CAVE_BOSS_ID,count:1,at:Date.now()}));
   }catch{
    leaving=false;tell('戦闘の準備ができませんでした。');return;
   }
   window.KIKOKU_ROUTE.go(new URL('../battle/',import.meta.url));
  }
 }
 function draw(moving){
  const rect=scene.parentElement.getBoundingClientRect();
  const dpr=Math.min(devicePixelRatio||1,3),scale=dpr*WORLD_SCENE_ZOOM;
  const width=Math.round(rect.width*dpr),height=Math.round(rect.height*dpr);
  if(scene.width!==width||scene.height!==height){scene.width=width;scene.height=height;}
  if(!width||!height)return;
  const camera=(length,view,point)=>length<view?(length-view)/2:Math.max(0,Math.min(length-view,point-view/2));
  const cx=camera(background.width,width/scale,x),cy=camera(background.height,height/scale,y-68);
  ctx.resetTransform();ctx.fillStyle='#0b1018';ctx.fillRect(0,0,width,height);
  ctx.imageSmoothingEnabled=false;
  ctx.setTransform(scale,0,0,scale,-Math.round(cx*scale),-Math.round(cy*scale));
  ctx.drawImage(background,0,0);
  const [lx,ly]=center(layout.ledge);
  const ledge=()=>ctx.drawImage(ledgeArt,lx-ledgeArt.width/2,ly-ledgeArt.height);
  if(y>=ly)ledge();
  if(layout.boss&&!bossDefeated){
   const [bx,by]=center(layout.boss);
   ctx.drawImage(bossArt,bx-64,by-111);
  }
  drawCharacter(ctx,{...hero,x,y,face,moving,distance});
  if(y<ly)ledge();
 }
 function frame(now){
  if(leaving)return;
  const elapsed=last?Math.min(40,now-last):0;
  last=now;
  let moving=false;
  const dir=pending??[...inputs.values()].at(-1);
  pending=null;
  if(dir&&!paused){
   const [dx,dy,row]=directions[dir],step=hizukiWalkDistance(elapsed);
   const boss=layout.boss&&!bossDefeated?center(layout.boss):null;
   const occupied=boss?(px,py)=>Math.hypot(px-boss[0],py-boss[1])<34:null;
   const [nx,ny]=walk.move(x,y,dx*step,dy*step,occupied);
   const travel=Math.hypot(nx-x,ny-y);
   distance+=travel;moving=travel>0;x=nx;y=ny;face=row;
   if(layout.exit&&dy>0&&y>=layout.exit[1]*tile+17){
    leaving=true;window.KIKOKU_ROUTE.go(new URL('../../field/?from=cave',import.meta.url));return;
   }
  }
  draw(moving);
  requestAnimationFrame(frame);
 }
 for(const button of document.querySelectorAll('[data-dir]')){
  button.addEventListener('pointerdown',event=>{
   if(event.button!==0||paused)return;
   event.preventDefault();button.setPointerCapture(event.pointerId);
   pending=button.dataset.dir;inputs.set(event.pointerId,pending);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])
   button.addEventListener(type,event=>inputs.delete(event.pointerId));
 }
 document.querySelector('#action-a').addEventListener('click',interact);
 addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey||paused||event.repeat)return;
  if(keys[event.key]){
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
