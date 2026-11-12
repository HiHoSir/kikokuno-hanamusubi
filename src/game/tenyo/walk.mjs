// Production Tenyo sanctuary. The approved 28x25 water map, original renderer,
// sprites, and collision are shared; only game input/story wiring is local.
import {bindDialogue} from '../village/dialogue.mjs';
import {residentInFront} from '../village/residents.mjs';
import {readStoryStage,advanceStoryStage,objectiveForStage} from '../story/chapter-one.mjs';

const {SMModel,SMRender}=globalThis;
const scene=document.querySelector('#scene');
const ctx=scene.getContext('2d',{alpha:false});
const status=document.querySelector('#status');
const objective=document.querySelector('#objective');
const load=document.querySelector('#load');
const buttons=[...document.querySelectorAll('[data-dir]')];
const directions={down:[0,1,0,'d'],up:[0,-1,1,'u'],right:[1,0,2,'r'],left:[-1,0,3,'l']};
const keys={ArrowDown:'down',ArrowUp:'up',ArrowRight:'right',ArrowLeft:'left',s:'down',w:'up',d:'right',a:'left'};
const facing=['d','u','r','l'];
const input=new Map();
const SPEED_MS=156,ZOOM=1.4,VIEWPORT_EDGE=768;
let pendingInput=null;

function setInput(id,direction){
  if(direction){input.set(id,direction);pendingInput=direction;}
  else input.delete(id);
  const active=[...input.values()].at(-1);
  buttons.forEach(button=>button.classList.toggle('held',button.dataset.dir===active));
}
function clearInput(){
  input.clear();pendingInput=null;
  buttons.forEach(button=>button.classList.remove('held'));
}
function center([x,y]){return {x:(x+.5)*32,y:(y+.5)*32};}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function assetURL(path){return new URL('../../../'+path,import.meta.url);}
async function image(path){
  const im=new Image();im.src=assetURL(path).href;
  await im.decode();
  if(!im.naturalWidth)throw new Error('画像を読み込めません: '+path);
  return im;
}
function sourceIdToAsset(id){
  // Original authored IDs remain the renderer's object identifiers.
  // The new repository uses one adopted file per ID with descriptive names.
  return 'assets/tenyo/'+id.replaceAll('_','-').toLowerCase()+'.png';
}
function storyLines(npc){return npc.dialogue?.[readStoryStage()]??npc.lines??[];}
function passable(map,occupied,x,y,blocked){
  return Number.isInteger(x)&&Number.isInteger(y)&&SMModel.inside(map,[x,y])&&
    !blocked.has(x+','+y)&&!occupied.has(x+','+y);
}
function exitReached(map,x,y){
  const exit=map.game.southExit;
  return y===exit.row&&exit.columns.includes(x);
}

async function start(){
  if(!SMModel||!SMRender)throw new Error('天妖の社の描画エンジンが読み込めません');
  const mapUrl=new URL('../../../data/maps/tenyo-sanctuary/scene.json',import.meta.url);
  // A fresh scene JSON is essential after the accepted NPC assets change.
  mapUrl.searchParams.set('v','tenyo-proportions-052');
  const response=await fetch(mapUrl);
  if(!response.ok)throw new Error('天妖の社のマップデータを読めません');
  const map=SMModel.parse(await response.text());
  const blocked=SMModel.collision(map);
  const entry=map.game?.entrySpawn;
  if(!entry||blocked.has(entry.join(',')))throw new Error('社の出現マスが通行不可です');

  const residents=map.game.residents.map(def=>({
    ...def,...center(def.tile),lines:storyLines(def),
  }));
  const occupied=new Set(residents.map(npc=>npc.tile.join(',')));
  const canEnter=(x,y)=>passable(map,occupied,x,y,blocked);

  const ids=new Set([
    ...map.objects.map(item=>item.templateId),
    ...(map.waterBottom??[]).map(item=>item.tileId),
    'clear_water_shallow','clear_water_mid','clear_water_deep',
    ...['deep_mid','mid_shallow'].flatMap(pair=>['N','E','S','W'].map(dir=>'clear_water_shore_'+pair+'_'+dir)),
    'tenyo_ripple_fx',
  ]);
  const [hero,...loaded]=await Promise.all([
    image(map.game.hero+'?v=fb40c1b'),
    ...[...ids].map(id=>image(sourceIdToAsset(id))),
    ...[...new Set(map.game.residents.map(npc=>npc.asset))].map(path=>image(path)),
  ]);
  const allIds=[...ids],allNpcPaths=[...new Set(map.game.residents.map(npc=>npc.asset))];
  const images=Object.fromEntries(allIds.map((id,i)=>[id,loaded[i]]));
  const npcArt=new Map(allNpcPaths.map((path,i)=>[path,loaded[allIds.length+i]]));
  images.sanctuary_npc_shirotae=npcArt.get(residents.find(n=>n.id==='shirotae').asset);
  images.sanctuary_npc_guard=npcArt.get(residents.find(n=>n.id!=='shirotae').asset);

  const world=document.createElement('canvas');
  world.width=map.width*map.tileSize;
  world.height=map.height*map.tileSize;
  // Keep original alpha compositing: water is transparent over the sea backdrop.
  const wc=world.getContext('2d');
  const bounds=SMRender.actorBounds(hero,(width,height)=>{
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;return canvas;
  });
  const residentObjects=residents.map(npc=>({
    id:'story-'+npc.id,
    templateId:npc.id==='shirotae'?'sanctuary_npc_shirotae':'sanctuary_npc_guard',
    x:npc.tile[0],y:npc.tile[1],dir:'d',frame:0,occupiedTiles:[],
  }));
  const paintedMap={...map,objects:[...map.objects,...residentObjects]};

  const state={x:entry[0],y:entry[1],face:1,dir:'u',motion:null,steps:0};
  function refreshObjective(){
    objective.textContent=objectiveForStage(readStoryStage());
    for(const npc of residents)npc.lines=storyLines(npc);
  }
  const dialogue=bindDialogue(clearInput,ended=>{
    if(ended.id==='shirotae'&&readStoryStage()==='shrine'){
      advanceStoryStage('cove');
      globalThis.KIKOKU_AUDIO?.se?.('notify');
    }
    refreshObjective();
  });
  refreshObjective();

  // Preserve the separately approved sanctuary waterfall loop without
  // bypassing the existing audio ON/OFF or iOS user-gesture restrictions.
  const waterfall=new Audio(assetURL('assets/tenyo/waterfall-loop.m4a').href);
  waterfall.loop=true;waterfall.volume=.18;waterfall.preload='none';
  function waterSound(){
    if(document.hidden||!globalThis.KIKOKU_AUDIO?.enabled){
      waterfall.pause();return;
    }
    void waterfall.play().catch(()=>{}); // Safari may require another tap.
  }
  for(const button of document.querySelectorAll('#pad button')){
    button.addEventListener('pointerdown',waterSound,{passive:true});
    button.addEventListener('click',waterSound);
  }
  document.querySelector('#sound-toggle')?.addEventListener('click',waterSound);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){clearInput();waterfall.pause();}
    else waterSound();
  });
  addEventListener('pagehide',()=>{clearInput();waterfall.pause();});
  addEventListener('pageshow',waterSound);

  function leave(){
    clearInput();waterfall.pause();
    window.KIKOKU_ROUTE.go(new URL('../../field/?from=shrine',import.meta.url));
  }
  function startMove(direction,now){
    const [dx,dy,face,dir]=directions[direction];
    state.face=face;state.dir=dir;
    const nx=state.x+dx,ny=state.y+dy;
    if(!canEnter(nx,ny))return false;
    state.motion={fromX:state.x,fromY:state.y,toX:nx,toY:ny,at:now,duration:SPEED_MS};
    ++state.steps;
    return true;
  }
  function actor(now){
    const motion=state.motion;
    if(!motion)return {x:state.x,y:state.y,dir:state.dir,frame:0};
    const t=clamp((now-motion.at)/motion.duration,0,1);
    return {
      x:motion.fromX+(motion.toX-motion.fromX)*t,
      y:motion.fromY+(motion.toY-motion.fromY)*t,
      dir:state.dir,frame:[1,0,1,2][Math.min(3,Math.floor(t*4))],
    };
  }
  function resize(){
    const {clientWidth,clientHeight}=scene.parentElement;
    const scale=VIEWPORT_EDGE/Math.max(clientWidth,clientHeight,1);
    const width=Math.max(1,Math.round(clientWidth*scale));
    const height=Math.max(1,Math.round(clientHeight*scale));
    if(scene.width===width&&scene.height===height)return;
    scene.width=width;
    scene.height=height;
  }
  function render(now){
    const player=actor(now);
    for(let i=0;i<residents.length;i++)
      residentObjects[i].dir=facing[residents[i].face??0]??'d';
    SMRender.draw(wc,paintedMap,{
      images,hero,bounds,actor:player,heroDisplayScale:map.game.heroDisplayScale??1,animationTime:now,shadows:true,
      lighting:true,reflections:true,atmosphere:true,depthOfField:true,
    });
    const width=scene.width,height=scene.height;
    const worldPixelsPerPixel=VIEWPORT_EDGE/(Math.max(width,height)*ZOOM);
    const viewWidth=width*worldPixelsPerPixel,viewHeight=height*worldPixelsPerPixel;
    const cameraX=clamp((player.x+.5)*32-viewWidth/2,0,world.width-viewWidth);
    const cameraY=clamp((player.y+.5)*32-viewHeight/2,0,world.height-viewHeight);
    ctx.setTransform(1,0,0,1,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#13354e';ctx.fillRect(0,0,width,height);
    ctx.drawImage(world,cameraX,cameraY,viewWidth,viewHeight,0,0,width,height);
    const foot=center([state.x,state.y]);
    const npc=residentInFront(foot.x,foot.y,state.face,residents);
    dialogue.update(npc,foot.x,foot.y);
    status.textContent=npc?'Aで話す':state.y>=map.height-3?'南へ進むとフィールドへ':'境内';
    scene.dataset.x=String(state.x);
    scene.dataset.y=String(state.y);
  }
  let lastPaint=0;
  function frame(now){
    if(state.motion&&now-state.motion.at>=state.motion.duration){
      state.x=state.motion.toX;state.y=state.motion.toY;state.motion=null;
      if(exitReached(map,state.x,state.y)){leave();return;}
    }
    if(!state.motion&&!dialogue.active){
      const direction=pendingInput??[...input.values()].at(-1);
      pendingInput=null;
      if(direction)startMove(direction,now);
    }
    // The original sanctuary renderer composites reflections and focus blur.
    // Cap full-scene paints without affecting input or movement cadence.
    if(now-lastPaint>=55){
      render(now);lastPaint=now;
    }
    requestAnimationFrame(frame);
  }

  for(const button of buttons){
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0||dialogue.active)return;
      event.preventDefault();button.setPointerCapture(event.pointerId);
      setInput(event.pointerId,button.dataset.dir);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture']){
      button.addEventListener(type,event=>setInput(event.pointerId,null));
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
    event.preventDefault();if(!event.repeat)setInput(event.key,direction);
  });
  addEventListener('keyup',event=>{if(keys[event.key])setInput(event.key,null);});
  addEventListener('blur',clearInput);
  resize();
  new ResizeObserver(resize).observe(scene.parentElement);
  render(performance.now());
  load.hidden=true;requestAnimationFrame(frame);
}
start().catch(error=>{
  console.error(error);
  status.textContent='読み込み失敗';
  load.textContent='天妖の社を読み込めませんでした。ページを再読み込みしてください。';
});
