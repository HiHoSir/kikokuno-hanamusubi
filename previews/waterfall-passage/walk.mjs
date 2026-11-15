import {drawCliffWater,fall} from './cliff-water.mjs';
import {terrainY} from '../../src/field/height-projection.mjs';
import {loadTerrainChips} from '../../src/field/terrain-chips.mjs';
import {createFieldTerrainRenderer} from '../../src/field/terrain-renderer.mjs';
import {fieldViewportDimensions} from '../../src/field/viewport.mjs';
import {drawCharacter} from '../../src/game/village/residents.mjs';

const {YK_LANDSCAPE: landscape,YK_ELEVATION: elevation,YK_FIELD_ASSETS: assets} = window;
const canvas = document.querySelector('#scene');
const context = canvas.getContext('2d',{alpha:false});
const waterLayer = document.querySelector('#water-layer');
const waterContext = waterLayer.getContext('2d');
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
const southMouth = [11,15];
const northMouth = [11,9];
const southStart = [14,20];
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

const ridgeEdge = [11,11,11,12,12,13,13,13,12,12,12,12,12,12,12,12,12,12,12,12,12,11,11,10,10,10,10,10];
const shores = [
  [5,21],[5,22],[4,22],[4,23],[3,24],[3,24],[2,25],[2,25],[2,24],
  [3,24],[3,25],[4,25],[4,26],[4,26],[3,25],[3,25],[2,24],[2,24],
  [3,23],[3,23],[4,23],[4,24],[5,24],[5,25],[6,25],[7,24],[8,23],[8,23],
];
const foothills=new Set([
  '4,17','5,17','6,17','5,18','6,18','7,18','8,18','5,19','6,19','7,19','8,19',
  '4,20','5,20','6,20','7,20','8,20','4,21','5,21','6,21','5,22','6,22',
  '20,17','21,17','22,17','20,18','21,18','22,18','21,19','22,19','22,20'
]);
const riverWidth = [[16,20],[16,20],[16,20],[16,20],[17,20],[17,19],[16,18],
  [16,18],[15,17],[15,17],[14,16],[14,16],[13,16],[13,16],[13,16]];
const map = shores.map(([west,east],y)=>ridgeEdge.map((edge,x)=>{
  if(x<west||x>east||y===0||y===shores.length-1)return 'sea';
  if(y>edge&&y>=13){
    const [left,right]=riverWidth[y-13];
    if(x>=left&&x<=right)return 'river';
  }
  if((y<edge-3&&(x<8||x>21))||(y>16&&x<=9))return 'forest';
  return 'grass';
}));
map.heights = map.map((row,y)=>row.map((tile,x)=>tile==='grass'||tile==='forest'
  ? y<=ridgeEdge[x]?3:Number(foothills.has(x+','+y))
  : 0));
map.ramps = map.map(row=>row.map(()=>null));
map.occupiedTiles = new Set();
map.decorations = [];
map.cornerProtected = new Set();
map.bridgeWaterCells = new Set();
map.referencePlacedObjects = true;
map.projectedHeights = true;
map.elevationEnabled = true;
map.paths = [
  [[14,23],[13,20],[13,18],[11,17],southMouth],
  [northMouth,[11,10],[12,11],[14,11],[15,11]],
].map(path=>path.map(point=>point.map(n=>center(n))));

function prop(kind,x,y,width,height,{block=false,supportHeight=map.heights[y][x],foot=(y+1)*fieldCell}={}){
  const position=center(x);
  map.decorations.push({kind,x:position-width/2,y:foot-height,width,height,foot,supportHeight,
    occupiedTiles:block?[[x,y]]:[]});
  if(block)map.occupiedTiles.add(x+','+y);
}
prop('cave',...southMouth,80,64);
prop('cave',...northMouth,80,64,{supportHeight:3});
for(const [x,y] of [[5,7],[7,8],[8,10],[13,7],[15,7],[20,8],[22,8],[23,10],[6,18],[7,20],[9,16],[8,19],[10,20],[8,22],[20,21],[22,18],[23,17],[22,23],[11,23],[21,15],[8,15],[9,14],[6,16],[7,16],[9,21],[7,22],[10,22],[20,22],[22,17],[21,19],[21,20],[20,23],[23,15],[9,9],[10,7],[15,8],[16,8]]){
  prop('newTrees',x,y,32,32,{block:true});
}
for(let y=fall.source/32;y<fall.lip/32;y++)for(const x of [17,18,19])map.occupiedTiles.add(x+','+y);
for(const [x,y] of [[6,5],[10,5],[16,5],[21,5]])prop('newMountainLarge',x,y,128,64,{block:true});
for(const [x,y] of [[10,18],[14,19],[15,15],[15,21],[12,12],[15,9],[21,12],[8,23]])prop('wildflowers',x,y,32,32);
elevation.prepare(map);

let area='lower',position=southStart.slice(),facing=1,move=null,transition=null,renderer,hero,interiorHero;
let pending=null,lastFrame=-1,lastFlowFrame=-1,needsDraw=true;
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
  waterLayer.style.visibility=area==='cave'?'hidden':'visible';
  publishPosition();
  needsDraw=true;
}

const gates = {
  lower:{point:southMouth,to:'cave',arrival:[4,10],facing:1},
  upper:{point:northMouth,to:'cave',arrival:[8,2],facing:0},
  cave:[
    {point:caveSouth,to:'lower',arrival:[11,16],facing:0},
    {point:caveNorth,to:'upper',arrival:[11,10],facing:0},
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
  waterLayer.width=width;
  waterLayer.height=height;
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
  const waterFrame=Math.floor(now/360);
  const redraw=needsDraw||move||(area!=='cave'&&lastFrame!==waterFrame);
  const flowFrame=Math.floor(now/75);
  if(!redraw&&(area==='cave'||lastFlowFrame===flowFrame))return;
  const progress=move?Math.max(0,Math.min(1,(now-move.start)/movementMillis)):0;
  const point=move?position.map((n,i)=>n+(move.target[i]-n)*progress):position;
  context.imageSmoothingEnabled=false;
  if(area==='cave')drawCave(point,progress);
  else{
    pose.row=facing;
    pose.column=move?[0,1,0,2][Math.min(3,Math.floor(progress*4))]:0;
    const [x,foot]=point.map(n=>center(n));
    const height=elevation.height(map,x,foot);
    if(redraw)renderer.draw(context,{x,foot,height},now);
    const camera={x,y:terrainY(foot,height),preset:0,centerX:canvas.width/2,foregroundGrowth:true};
    drawCliffWater(waterContext,landscape,camera,now,renderer.info.zoom);
    lastFlowFrame=flowFrame;
  }
  needsDraw=false;
  lastFrame=waterFrame;
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
  const [fieldHero,caveHero,terrain]=await Promise.all([
    loadImage(assets.url(assets.hero)),
    loadImage(new URL('../../assets/characters/hizuki/walk-4dir-80x112.png',import.meta.url)),
    loadTerrainChips(),loadLandscape()
  ]);
  hero=fieldHero;
  interiorHero=caveHero;
  renderer=createFieldTerrainRenderer(map,drawFieldHero,terrain,
    {image:hero,anchor:assets.heroFootAnchorPx,frame:()=>pose});
  renderer.prepare();
  new ResizeObserver(resize).observe(canvas);
  resize();
  publishPosition();
  loading.hidden=true;
  requestAnimationFrame(frame);
}catch(error){
  console.error(error);
  loading.textContent='読み込みに失敗しました。ページを開き直してください。';
}
