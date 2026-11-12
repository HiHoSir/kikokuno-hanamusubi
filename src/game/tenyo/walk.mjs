import {bindDialogue} from '../village/dialogue.mjs';
import {residentInFront} from '../village/residents.mjs';
import {readStoryStage,advanceStoryStage,objectiveForStage} from '../story/chapter-one.mjs';

const scene=document.querySelector('#scene');
const ctx=scene.getContext('2d',{alpha:false});
const status=document.querySelector('#status');
const objective=document.querySelector('#objective');
const load=document.querySelector('#load');
const buttons=[...document.querySelectorAll('[data-dir]')];
const directions={down:[0,1,0],up:[0,-1,1],right:[1,0,2],left:[-1,0,3]};
const keys={ArrowDown:'down',ArrowUp:'up',ArrowRight:'right',ArrowLeft:'left',s:'down',w:'up',d:'right',a:'left'};
const held=new Map();
const ZOOM=1.35;
const STEP_MS=150;
let queued=null;

function setDirection(id,direction){
  if(direction){held.set(id,direction);queued=direction;}
  else held.delete(id);
  const active=[...held.values()].at(-1);
  for(const button of buttons)button.classList.toggle('held',button.dataset.dir===active);
}
function clearInput(){
  held.clear();queued=null;
  for(const button of buttons)button.classList.remove('held');
}
export function passable(map,x,y){
  return Number.isInteger(x)&&Number.isInteger(y)&&
    x>=0&&x<map.columns&&y>=0&&y<map.rows&&map.grid[y]?.[x]==='.';
}
export function isSouthExit(map,x,y){
  return y===map.southExit.row&&map.southExit.columns.includes(x);
}
function assetURL(path){return new URL('../../../'+path,import.meta.url).href;}
async function image(path){
  const bitmap=new Image();
  bitmap.src=assetURL(path);
  await bitmap.decode();
  if(!bitmap.naturalWidth)throw new Error('画像を読めません: '+path);
  return bitmap;
}
function cellCenter([x,y]){return {x:x*32+16,y:y*32+16};}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function npcTalkLines(npc,stage){
  return npc.dialogue?.[stage]??npc.lines??[];
}

async function start(){
  const response=await fetch(new URL('../../../data/maps/tenyo-sanctuary/scene.json',import.meta.url));
  if(!response.ok)throw new Error('天妖の社のマップデータを読めません');
  const map=await response.json();
  if(map.grid.length!==map.rows||map.grid.some(row=>row.length!==map.columns))throw new Error('通行判定の寸法不一致');
  if(!passable(map,...map.spawn))throw new Error('開始地点が通行不可です');
  const residents=map.residents.map(npc=>({...npc,...cellCenter(npc.tile),lines:npcTalkLines(npc,readStoryStage())}));
  const occupied=new Set(residents.map(npc=>npc.tile.join(',')));
  const walkable=(x,y)=>passable(map,x,y)&&!occupied.has(x+','+y);
  const [background,shrine,torii,forest,hero,...npcImages]=await Promise.all([
    ...['background','shrine','torii','forest'].map(key=>image(map.images[key])),
    image(map.hero),...residents.map(npc=>image(npc.asset)),
  ]);
  const mapWidth=map.columns*map.tileSize,mapHeight=map.rows*map.tileSize;
  for(const asset of [background,shrine,torii,forest]){
    if(asset.width!==mapWidth||asset.height!==mapHeight)throw new Error('天妖の社の画像と歩行格子の寸法が一致しません');
  }
  residents.forEach((npc,index)=>npc.bitmap=npcImages[index]);
  const base=document.createElement('canvas');
  base.width=mapWidth;base.height=mapHeight;
  const baseContext=base.getContext('2d');
  baseContext.imageSmoothingEnabled=false;
  baseContext.drawImage(background,0,0);
  baseContext.drawImage(shrine,0,0);

  const state={x:map.spawn[0],y:map.spawn[1],face:1,motion:null,walkIndex:0};
  function refreshObjective(){
    objective.textContent=objectiveForStage(readStoryStage());
    for(const npc of residents)npc.lines=npcTalkLines(npc,readStoryStage());
  }
  const dialogue=bindDialogue(clearInput,ended=>{
    if(ended.id==='shirotae'&&readStoryStage()==='shrine'){
      advanceStoryStage('cove');
      globalThis.KIKOKU_AUDIO?.se?.('notify');
    }
    refreshObjective();
  });
  refreshObjective();

  function leave(){
    clearInput();
    location.assign(new URL('../../field/?from=shrine',import.meta.url));
  }
  function attemptStep(direction,now){
    const [dx,dy,face]=directions[direction];
    state.face=face;
    const nx=state.x+dx,ny=state.y+dy;
    if(!walkable(nx,ny))return false;
    state.motion={fromX:state.x,fromY:state.y,toX:nx,toY:ny,at:now,duration:STEP_MS};
    state.walkIndex++;
    return true;
  }
  function sample(now){
    if(!state.motion)return cellCenter([state.x,state.y]);
    const motion=state.motion;
    const t=clamp((now-motion.at)/motion.duration,0,1);
    return {x:(motion.fromX+(motion.toX-motion.fromX)*t)*32+16,
      y:(motion.fromY+(motion.toY-motion.fromY)*t)*32+16};
  }
  function drawActor(bitmap,x,y,face=0,column=0){
    ctx.save();
    ctx.fillStyle='rgba(8,19,23,.25)';
    ctx.beginPath();ctx.ellipse(x,y+1,12,3.5,0,0,Math.PI*2);ctx.fill();
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(bitmap,column*32,face*32,32,32,Math.round(x-16),Math.round(y-30),32,32);
    ctx.restore();
  }
  function render(now){
    const {x,y}=sample(now);
    const viewport=scene.width/ZOOM;
    const left=clamp(Math.round(x-viewport/2),0,mapWidth-viewport);
    const top=clamp(Math.round(y-viewport/2),0,mapHeight-viewport);
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle='#133349';ctx.fillRect(0,0,scene.width,scene.height);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(base,left,top,viewport,viewport,0,0,scene.width,scene.height);
    ctx.setTransform(ZOOM,0,0,ZOOM,-left*ZOOM,-top*ZOOM);
    const actors=[
      ...residents.map(npc=>({bitmap:npc.bitmap,x:npc.x,y:npc.y,face:npc.face??0,column:0})),
      {bitmap:hero,x,y,face:state.face,column:state.motion?1+(state.walkIndex%2):0}
    ].sort((a,b)=>a.y-b.y);
    for(const actor of actors)drawActor(actor.bitmap,actor.x,actor.y,actor.face,actor.column);
    // The original layered scene uses foliage and torii above the walking plane.
    // Leave the authored transparent center path visible; trees cover only their artwork.
    ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(torii,left,top,viewport,viewport,0,0,scene.width,scene.height);
    ctx.drawImage(forest,left,top,viewport,viewport,0,0,scene.width,scene.height);
    scene.dataset.x=String(state.x);
    scene.dataset.y=String(state.y);
    if(state.y>=29)status.textContent='南へ進むとフィールドへ戻ります';
    else if(residentInFront(cellCenter([state.x,state.y]).x,cellCenter([state.x,state.y]).y,state.face,residents))status.textContent='Aで話す';
    else status.textContent='境内';
    const {x:cx,y:cy}=cellCenter([state.x,state.y]);
    dialogue.update(residentInFront(cx,cy,state.face,residents),cx,cy);
  }
  function frame(now){
    if(state.motion&&now-state.motion.at>=state.motion.duration){
      state.x=state.motion.toX;
      state.y=state.motion.toY;
      state.motion=null;
      if(isSouthExit(map,state.x,state.y)){leave();return;}
    }
    if(!state.motion&&!dialogue.active){
      const direction=queued??[...held.values()].at(-1);
      queued=null;
      if(direction)attemptStep(direction,now);
    }
    render(now);
    requestAnimationFrame(frame);
  }

  for(const button of buttons){
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0||dialogue.active)return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setDirection(event.pointerId,button.dataset.dir);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture']){
      button.addEventListener(type,event=>setDirection(event.pointerId,null));
    }
    button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  document.querySelector('#action-a').addEventListener('click',()=>{
    if(dialogue.active)dialogue.advance();
    else dialogue.open();
  });
  document.querySelector('#action-b').addEventListener('click',()=>{
    if(dialogue.active)dialogue.advance();
  });
  addEventListener('keydown',event=>{
    if(dialogue.active){
      if((event.key==='Enter'||event.key===' ')&&event.target?.tagName==='BUTTON')return;
      if(['Enter',' ','Escape'].includes(event.key)){
        event.preventDefault();if(!event.repeat)dialogue.advance();
      }
      return;
    }
    if((event.key==='Enter'||event.key===' ')&&event.target===document.body){
      event.preventDefault();dialogue.open();return;
    }
    const direction=keys[event.key];
    if(!direction||event.metaKey||event.ctrlKey||event.altKey)return;
    event.preventDefault();if(!event.repeat)setDirection(event.key,direction);
  });
  addEventListener('keyup',event=>{
    if(keys[event.key])setDirection(event.key,null);
  });
  addEventListener('blur',clearInput);
  addEventListener('pagehide',clearInput);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
  render(performance.now());
  load.hidden=true;
  requestAnimationFrame(frame);
}
start().catch(error=>{
  console.error(error);
  status.textContent='読み込み失敗';
  load.textContent='天妖の社を読み込めませんでした。ページを再読み込みしてください。';
});
