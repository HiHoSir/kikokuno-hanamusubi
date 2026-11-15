import {prepareWaterChips} from './water-chips.mjs';
import {map,waterfall,lowerMouth as southMouth,upperMouth as northMouth,start as southStart,validateTerrain} from './terrain.mjs';
import {loadTerrainChips} from '../../src/field/terrain-chips.mjs';
import {createFieldTerrainRenderer} from '../../src/field/terrain-renderer.mjs';
import {fieldViewportDimensions} from '../../src/field/viewport.mjs';
import {drawCharacter} from '../../src/game/village/residents.mjs';

const {YK_LANDSCAPE: landscape,YK_ELEVATION: elevation,YK_FIELD_ASSETS: assets} = window;
const canvas = document.querySelector('#scene');
const context = canvas.getContext('2d',{alpha:false});
const fade = document.querySelector('#fade');
const loading = document.querySelector('#load');
const hint = document.querySelector('#hint');
const portrait = matchMedia('(orientation: portrait)');
const buttons = [...document.querySelectorAll('[data-dir]')];
const fieldCell = 32;
const caveCell = 80;
const center = (n,cell=fieldCell) => (n+.5)*cell;
const directions = {up:[0,-1,1],left:[-1,0,3],down:[0,1,0],right:[1,0,2]};
const keys = {ArrowUp:'up',ArrowLeft:'left',ArrowDown:'down',ArrowRight:'right'};
const same = (a,b) => a[0]===b[0]&&a[1]===b[1];
const caveSouth = [4,11];
const caveNorth = [8,1];
const caveLayout = [
  '############',
  '#######..###',
  '#######..###',
  '########.###',
  '########.###',
  '#####....###',
  '#####.######',
  '##....######',
  '##.#..######',
  '##.##.######',
  '####..######',
  '####..######',
  '############'
];

elevation.prepare(map);

let area='lower',position=southStart.slice(),facing=1,move=null,transition=null,renderer,hero,interiorHero,updateWater;
let pending=null,needsDraw=true;
const held = new Map();
const movementMillis = 232;
const pose = {row:1,column:0};
const hints = {lower:'滝の左手に洞窟がある',cave:'洞窟の奥へ',upper:'滝の落ち口まで歩ける'};

async function loadImage(url){
  const image=new Image();
  image.src=url;
  await image.decode();
  return image;
}

function loadLandscape(){
  return new Promise((resolve,reject)=>{
    landscape.load(()=>{
      if(Object.keys(landscape.errors).length)reject(new Error('地形素材を読み込めませんでした'));
      else if(landscape.ready())resolve();
    });
  });
}

function publishPosition(){
  canvas.dataset.area=area;
  canvas.dataset.x=String(position[0]);
  canvas.dataset.y=String(position[1]);
}

function enter(destination,point,direction){
  area=destination;
  position=point.slice();
  facing=direction;
  move=null;
  hint.textContent=hints[area];
  publishPosition();
  needsDraw=true;
}

const gates = {
  lower:{point:southMouth,to:'cave',arrival:[4,10],facing:1},
  upper:{point:northMouth,to:'cave',arrival:[8,2],facing:0},
  cave:[
    {point:caveSouth,to:'lower',arrival:[12,17],facing:0},
    {point:caveNorth,to:'upper',arrival:[14,11],facing:0},
  ],
};
function crossedGate(now){
  const options=area==='cave'?gates.cave:[gates[area]];
  const gate=options.find(candidate=>same(position,candidate.point));
  if(!gate)return;
  clearInput();
  fade.classList.add('active');
  transition={gate,at:now+155};
}

function canMove(target){
  if(area==='cave')return caveLayout[target[1]]?.[target[0]]==='.';
  return elevation.canMove(map,...position.map(n=>center(n)),...target.map(n=>center(n)));
}

function clearInput(){
  held.clear();
  pending=null;
  for(const button of buttons)delete button.dataset.held;
}

function setInput(id,dir){
  if(transition||portrait.matches)return;
  held.set(id,dir);
  pending=dir;
  for(const button of buttons)button.toggleAttribute('data-held',button.dataset.dir===dir);
}

function releaseInput(id){
  held.delete(id);
  const active=[...held.values()].at(-1);
  for(const button of buttons)button.toggleAttribute('data-held',button.dataset.dir===active);
}

function resize(){
  const {width,height}=fieldViewportDimensions(canvas.clientWidth,canvas.clientHeight);
  canvas.width=width;
  canvas.height=height;
  needsDraw=true;
}

function drawFieldHero(c,x,y,scale){
  const [ax,ay]=assets.heroFootAnchorPx;
  c.fillStyle='#14221866';
  c.beginPath();c.ellipse(x,y-1,9*scale,3*scale,0,0,Math.PI*2);c.fill();
  c.drawImage(hero,pose.column*32,pose.row*32,32,32,x-ax*scale,y-ay*scale,32*scale,32*scale);
}

function drawCave(point,progress){
  const [x,y]=point.map(n=>center(n,caveCell));
  const zoom=1.22;
  const left=canvas.width/2-x*zoom,top=canvas.height*.57-y*zoom;
  context.fillStyle='#101410';context.fillRect(0,0,canvas.width,canvas.height);
  context.save();context.translate(Math.round(left),Math.round(top));context.scale(zoom,zoom);
  for(let row=0;row<caveLayout.length;row++)for(let col=0;col<caveLayout[row].length;col++){
    if(caveLayout[row][col]!=='.')continue;
    const px=col*caveCell,py=row*caveCell;
    landscape.drawAsset(context,'barren',px,py,caveCell,caveCell);
    context.fillStyle=(col+row)%2?'#262a2143':'#37423636';
    context.fillRect(px,py,caveCell,caveCell);
    if(caveLayout[row-1]?.[col]!=='.'){
      for(let i=0;i<caveCell;i+=20)landscape.drawAsset(context,'grassCliff',px+i,py,20,17);
      context.fillStyle='#15180fb8';context.fillRect(px,py,caveCell,17);
    }
    if(caveLayout[row+1]?.[col]!=='.'){
      context.fillStyle='#100f0bbb';
      context.fillRect(px,py+caveCell-5,caveCell,5);
    }
    context.fillStyle='#171a1155';
    if(caveLayout[row][col-1]!=='.')context.fillRect(px,py,7,caveCell);
    if(caveLayout[row][col+1]!=='.')context.fillRect(px+caveCell-7,py,7,caveCell);
  }
  for(const [cx,cy] of [caveSouth,caveNorth]){
    const gx=center(cx,caveCell),gy=center(cy,caveCell);
    const light=context.createRadialGradient(gx,gy,3,gx,gy,85);
    light.addColorStop(0,'#b5c78796');light.addColorStop(1,'#b5c78700');
    context.fillStyle=light;
    context.fillRect(gx-85,gy-85,170,170);
  }
  context.fillStyle='#191c13a8';context.beginPath();context.ellipse(x,y,15,5,0,0,Math.PI*2);context.fill();
  drawCharacter(context,{bitmap:interiorHero,x,y,face:facing,distance:progress*42,moving:!!move});
  context.restore();
  const darkness=context.createRadialGradient(canvas.width/2,canvas.height*.54,105,canvas.width/2,canvas.height*.52,430);
  darkness.addColorStop(0,'#060a0700');darkness.addColorStop(1,'#060a07c7');
  context.fillStyle=darkness;context.fillRect(0,0,canvas.width,canvas.height);
}

function frame(now){
  requestAnimationFrame(frame);
  if(portrait.matches)return;
  if(transition&&now>=transition.at){
    const {gate}=transition;
    transition=null;
    enter(gate.to,gate.arrival,gate.facing);
    fade.classList.remove('active');
  }
  if(move&&now>=move.end){
    position=move.target;
    move=null;
    publishPosition();
    crossedGate(now);
    needsDraw=true;
  }
  if(!transition&&!move){
    const direction=pending??[...held.values()].at(-1);
    pending=null;
    if(direction){
      const [dx,dy,row]=directions[direction];
      facing=row;
      const target=[position[0]+dx,position[1]+dy];
      if(canMove(target))move={target,start:now,end:now+movementMillis};
      needsDraw=true;
    }
  }
  const waterChanged=area!=='cave'&&updateWater(now);
  if(!needsDraw&&!move&&!waterChanged)return;
  const progress=move?Math.max(0,Math.min(1,(now-move.start)/movementMillis)):0;
  const point=move?position.map((n,i)=>n+(move.target[i]-n)*progress):position;
  context.imageSmoothingEnabled=false;
  if(area==='cave')drawCave(point,progress);
  else{
    pose.row=facing;
    pose.column=move?[0,1,0,2][Math.min(3,Math.floor(progress*4))]:0;
    const [x,foot]=point.map(n=>center(n));
    const height=elevation.height(map,x,foot);
    renderer.draw(context,{x,foot,height},now);
  }
  needsDraw=false;
}

for(const button of buttons){
  button.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    setInput(event.pointerId,button.dataset.dir);
  });
  for(const eventName of ['pointerup','pointercancel','lostpointercapture']){
    button.addEventListener(eventName,event=>{
      if(eventName==='pointercancel')pending=null;
      releaseInput(event.pointerId);
    });
  }
  button.addEventListener('contextmenu',event=>event.preventDefault());
}
addEventListener('keydown',event=>{
  if(!keys[event.key]||event.metaKey||event.altKey||event.ctrlKey)return;
  event.preventDefault();
  if(!event.repeat)setInput(event.key,keys[event.key]);
});
addEventListener('keyup',event=>releaseInput(event.key));
addEventListener('blur',clearInput);
addEventListener('pagehide',clearInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
portrait.addEventListener('change',()=>{clearInput();needsDraw=true});
document.querySelector('#reset').addEventListener('click',()=>{
  clearInput();transition=null;fade.classList.remove('active');enter('lower',southStart,1);
});

try{
  validateTerrain(elevation);
  const [fieldHero,caveHero,terrain,fallArt]=await Promise.all([
    loadImage(assets.url(assets.hero)),
    loadImage(new URL('../../assets/characters/hizuki/walk-4dir-80x112.png',import.meta.url)),
    loadTerrainChips(),loadImage(new URL('./waterfall-south-4w-2h-32.png',import.meta.url)),loadLandscape()
  ]);
  hero=fieldHero;
  interiorHero=caveHero;
  renderer=createFieldTerrainRenderer(map,drawFieldHero,terrain,
    {image:hero,anchor:assets.heroFootAnchorPx,frame:()=>pose});
  updateWater=prepareWaterChips(renderer,map,waterfall,terrain,fallArt,landscape,elevation);
  new ResizeObserver(resize).observe(canvas);
  resize();
  publishPosition();
  loading.hidden=true;
  requestAnimationFrame(frame);
}catch(error){
  console.error(error);
  loading.textContent='読み込みに失敗しました。ページを開き直してください。';
}
