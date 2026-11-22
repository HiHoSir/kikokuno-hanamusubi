// Production Tenyo sanctuary. The approved 28x25 water map, original renderer,
// sprites, and collision are shared; only game input/story wiring is local.
import {bindDialogue} from '../village/dialogue.mjs';
import {residentInFront,walkFrame} from '../village/residents.mjs?v=shared-walk-1';
import {hizukiWalkDistance} from '../village/movement.mjs?v=shared-walk-1';
import {readStoryStage,advanceStoryStage,objectiveForStage} from '../story/chapter-one.mjs';
import {consumeRestorePosition} from '../save/save-game.mjs?v=save-slots-1';
import {WORLD_ACTOR_FRAME} from '../ui/world-scale.mjs';
import {sanctuaryCollisionGeometry,shrineCanStand,shrineAdvance,shrineExitReached} from './movement.mjs';

const {SMModel,SMRender}=globalThis;
const scene=document.querySelector('#scene');
const ctx=scene.getContext('2d',{alpha:false});
const interactionHint=document.querySelector('#interaction-hint');
const objective=document.querySelector('#objective');
const load=document.querySelector('#load');
const buttons=[...document.querySelectorAll('[data-dir]')];
const directions={down:[0,1,0,'d'],up:[0,-1,1,'u'],right:[1,0,2,'r'],left:[-1,0,3,'l']};
const keys={ArrowDown:'down',ArrowUp:'up',ArrowRight:'right',ArrowLeft:'left',s:'down',w:'up',d:'right',a:'left'};
const facing=['d','u','r','l'];
const input=new Map();
const VIEWPORT_EDGE=768;
const TENYO_APPROVED_CAMERA=1;
// On the selected wide-angle + legacy-person proportions, recompose the
// hero's visual painting around its unchanged foot. This is NOT camera zoom.
const TENYO_HERO_ART_FACTOR=0.52;
// This is the very same source module in the real game and Pages review.
// A direct review must never consume game-save restore data or edit story flags.
const previewMode=typeof location!=='undefined' &&
 location.pathname.includes('/previews/tenyo-scale-review/') &&
 new URL(import.meta.url).searchParams.get('tenyo-review')==='1';
// Only the standalone review can select a non-production camera.
let reviewCamera=TENYO_APPROVED_CAMERA;
let showCollision=false;
let reviewCharacters='legacy';
// Approved shrine sprites are now shared by the game and its walking preview.
// These atlas coordinates keep the native sprite dimensions unchanged.
const REBUILD_RECTS={
 sanctuary_fall_v2:[0,0,128,160],
 tenyo_water_gate:[128,0,192,128],
 torii_gate_v2:[128,128,128,96],
 rock_island_lantern_base:[0,160,96,64],
 rock_island_lantern_base_mirror:[0,160,96,64],
 tenyo_stone_lantern:[96,160,32,64]
};
// Bottom-exclusive alpha bounds of the newly authored atlas crops. These are
// DRAWING depth anchors, not collision footprints or logical grid cells.
// A source crop can have 17px of transparent bottom margin (the waterfalls).
const REBUILD_VISUAL_FOOT_ROWS={
 sanctuary_fall_v2:143,
 tenyo_water_gate:124,
 torii_gate_v2:94,
 rock_island_lantern_base:58,
 rock_island_lantern_base_mirror:58,
 tenyo_stone_lantern:56
};
// Normal gameplay always uses the reviewed art and grounded occlusion.
// Only the isolated preview can select the former art/depth for comparison.
const useRebuiltArt=!previewMode ||
 new URL(location.href).searchParams.get('sprites')!=='legacy';
const useGroundedDepth=useRebuiltArt && (!previewMode ||
 new URL(location.href).searchParams.get('depth')!=='legacy');
if(useRebuiltArt){
 for(const [id,rect] of Object.entries(REBUILD_RECTS)){
  const template=globalThis.SMCatalog.byId[id];
  template.sourceRect=rect.slice();
  template.previewVisualFootRow=REBUILD_VISUAL_FOOT_ROWS[id];
  if(id==='sanctuary_fall_v2')template.previewSplashStartRow=128;
 }
}
// Reproduce the former relative figure sizes as an explicit optional
// PREVIEW, without adding a runtime per-actor scale or touching hero PNG.
function previewRecompose(image,factor){
 const sheet=document.createElement('canvas');
 sheet.width=240;sheet.height=448;
 const c=sheet.getContext('2d');c.imageSmoothingEnabled=false;
 for(let row=0;row<4;row++)for(let frame=0;frame<3;frame++){
  const sx=frame*80,sy=row*112;
  c.save();c.beginPath();c.rect(sx,sy,80,112);c.clip();
  c.drawImage(image,sx,sy,80,112,
    sx+40*(1-factor),sy+106*(1-factor),80*factor,112*factor);
  c.restore();
 }
 return sheet;
}
// A source sheet's 80x112 frame is NOT its actual visible character size.
// Shirotae and guardians currently occupy about half Hizuki's visible height.
// For this review alone, nearest-neighbor-recompose each 80x112 frame around
// its existing (40,106) foot. This changes no official NPC PNG asset.
function reviewNpcFullSize(original){
 const canvas=document.createElement('canvas');
 canvas.width=240;canvas.height=448;
 const c=canvas.getContext('2d');
 c.imageSmoothingEnabled=false;
 for(let row=0;row<4;row++)for(let frame=0;frame<3;frame++){
  const sx=frame*80,sy=row*112;
  c.save();
  c.beginPath();c.rect(sx,sy,80,112);c.clip();
  c.drawImage(original,sx,sy,80,112,sx-40,sy-106,160,224);
  c.restore();
 }
 return canvas;
}
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
  if(useRebuiltArt&&Object.hasOwn(REBUILD_RECTS,id))
   return 'assets/tenyo-rebuild-v1/original-atlas.png?v=tenyo-rebuild-atlas24-1';
  return 'assets/tenyo/'+id.replaceAll('_','-').toLowerCase()+'.png?v=tenyo-water-art';
}
function storyLines(npc){return npc.dialogue?.[readStoryStage()]??npc.lines??[];}

async function start(){
  if(!SMModel||!SMRender)throw new Error('天妖の社の描画エンジンが読み込めません');
  const mapUrl=new URL('../../../data/maps/tenyo-sanctuary/scene.json',import.meta.url);
  // A fresh scene JSON is essential after the accepted NPC assets change.
  mapUrl.searchParams.set('v','tenyo-dialogue-20261120-1');
  const response=await fetch(mapUrl);
  if(!response.ok)throw new Error('天妖の社のマップデータを読めません');
  const map=SMModel.parse(await response.text());
  const blocked=SMModel.collision(map);
  const entry=map.game?.entrySpawn;
  if(!entry||blocked.has(entry.join(',')))throw new Error('社の出現マスが通行不可です');

  const residents=map.game.residents.map(def=>({
    ...def,...center(def.tile),lines:storyLines(def),
  }));
  // Ground collision uses each cell's actual rectangular bounds, rather than
  // rejecting an entire 32px square around a tiny character or guardian.
  // The published game keeps the previously deployed collision until actual
  // iPhone visual approval. The preview starts with visible-foot contacts.
  let collider=sanctuaryCollisionGeometry(map,blocked,residents,
    {profile:previewMode?'visual':'legacy'});
  // Convert source-map coordinates only when loading the old scene/save.
  // The live player moves in continuous world PIXELS, not grid fractions.
  const worldPoint=(x,y)=>({x:(x+.5)*map.tileSize,y:(y+.5)*map.tileSize});
  const canEnter=(x,y)=>shrineCanStand(collider,x,y);

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
  const npcOriginal=new Map(allNpcPaths.map((path,i)=>[path,loaded[allIds.length+i]]));
  const npcExpanded=previewMode
    ?new Map(allNpcPaths.map((path,i)=>[path,reviewNpcFullSize(loaded[allIds.length+i])]))
    :npcOriginal;
  const halfHero=previewRecompose(hero,TENYO_HERO_ART_FACTOR);
  const whiteAsset=residents.find(n=>n.id==='shirotae').asset;
  const guardAsset=residents.find(n=>n.id!=='shirotae').asset;
  function useReviewFigures(){
    const art=previewMode&&reviewCharacters==='largeNpc'?npcExpanded:npcOriginal;
    images.sanctuary_npc_shirotae=art.get(whiteAsset);
    images.sanctuary_npc_guard=art.get(guardAsset);
  }
  useReviewFigures();

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

  const resumed=previewMode?null:consumeRestorePosition('tenyo');
  const restoreFoot=resumed?worldPoint(resumed.x,resumed.y):null;
  const savedPoint=restoreFoot&&canEnter(restoreFoot.x,restoreFoot.y)?resumed:null;
  const initialFoot=worldPoint(savedPoint?.x??entry[0],savedPoint?.y??entry[1]);
  const face=savedPoint?.face??1;
  const state={x:initialFoot.x,y:initialFoot.y,
    face,dir:facing[face],moving:false,distance:0,steps:0};
  function refreshObjective(){
    objective.textContent=objectiveForStage(readStoryStage());
    for(const npc of residents)npc.lines=storyLines(npc);
  }
  const dialogue=bindDialogue(clearInput,ended=>{
    if(!previewMode&&ended.id==='shirotae'&&readStoryStage()==='shrine'){
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
    if(previewMode){
      // Keep the comparison session walkable without leaving Pages or saving.
      const reset=worldPoint(entry[0],entry[1]);
      state.x=reset.x;state.y=reset.y;state.moving=false;
      requestAnimationFrame(frame);
      return;
    }
    window.KIKOKU_ROUTE.go(new URL('../../field/?from=shrine',import.meta.url));
  }
  function startMove(direction,elapsedMs){
    const [dx,dy,face,dir]=directions[direction];
    state.face=face;state.dir=dir;
    const result=shrineAdvance(collider,state.x,state.y,dx,dy,
      hizukiWalkDistance(elapsedMs,TENYO_APPROVED_CAMERA));
    state.x=result.x;state.y=result.y;
    state.moving=result.traveled>0;
    state.distance+=result.traveled;
    if(state.moving)state.steps++;
    return state.moving;
  }
  function actor(){
    // Renderer reads legacy map coordinates. This conversion is solely at
    // the rendering boundary; movement has no 32px/8px snapping.
    const x=state.x/map.tileSize-.5,y=state.y/map.tileSize-.5;
    return {x,y,dir:state.dir,
      frame:walkFrame(state.distance,state.moving,TENYO_APPROVED_CAMERA)};
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
    const player=actor();
    for(let i=0;i<residents.length;i++)
      residentObjects[i].dir=facing[residents[i].face??0]??'d';
    SMRender.draw(wc,paintedMap,{
      images,hero:previewMode&&reviewCharacters==='largeNpc'?hero:halfHero,
      bounds,actor:player,animationTime:now,shadows:true,
      lighting:true,reflections:true,atmosphere:true,depthOfField:true,
      tenyoSceneDepth:useGroundedDepth,
    });
    const width=scene.width,height=scene.height;
    const {clientWidth,clientHeight}=scene.parentElement;
    // The 768px buffer is only a raster resolution. It must NOT set the
    // apparent camera scale; match village/interiors/cove in CSS world pixels.
    const zoom=previewMode?reviewCamera:TENYO_APPROVED_CAMERA;
    // Reproduce the earlier sanctuary camera framing precisely:
    // historic camera factor 1.4 used the fixed 768px buffer, not CSS pixels.
    // The preview-only 1.0 option uses a true CSS pixel/world ratio.
    const worldPixelsPerPixel=previewMode&&reviewCamera===1.4
      ?VIEWPORT_EDGE/(Math.max(width,height)*1.4)
      :Math.max(clientWidth,clientHeight,1)/(Math.max(width,height)*zoom);
    const viewWidth=width*worldPixelsPerPixel,viewHeight=height*worldPixelsPerPixel;
    const cameraX=viewWidth>=world.width?(world.width-viewWidth)/2:
      clamp((player.x+.5)*32-viewWidth/2,0,world.width-viewWidth);
    const cameraY=viewHeight>=world.height?(world.height-viewHeight)/2:
      clamp((player.y+.5)*32-viewHeight/2,0,world.height-viewHeight);
    ctx.setTransform(1,0,0,1,0,0);
    ctx.imageSmoothingEnabled=false;
    ctx.fillStyle='#13354e';ctx.fillRect(0,0,width,height);
    // Draw the authored 28x25 world intact. Negative camera offsets
    // become symmetric sea-background margins rather than clipping/stretching.
    ctx.drawImage(world,-cameraX/worldPixelsPerPixel,-cameraY/worldPixelsPerPixel,
      world.width/worldPixelsPerPixel,world.height/worldPixelsPerPixel);
    // Overlay paints the same WORLD-PIXEL contact shapes used by movement,
    // including non-grid scenery. It is never visible in the real game.
    if(previewMode&&showCollision){
      ctx.save();ctx.fillStyle='rgba(225,64,58,.26)';
      for(const rect of collider.rects)
        ctx.fillRect((rect.left-cameraX)/worldPixelsPerPixel,
          (rect.top-cameraY)/worldPixelsPerPixel,
          (rect.right-rect.left)/worldPixelsPerPixel,
          (rect.bottom-rect.top)/worldPixelsPerPixel);
      // Individual physical shapes follow the actual gate posts, fences,
      // lanterns and rock bases rather than old whole-tile occupancy.
      ctx.strokeStyle='rgba(253,197,65,.98)';ctx.lineWidth=2;
      for(const shape of collider.shapes){
        ctx.beginPath();
        if(shape.type==='box')ctx.rect(
          (shape.left-cameraX)/worldPixelsPerPixel,
          (shape.top-cameraY)/worldPixelsPerPixel,
          (shape.right-shape.left)/worldPixelsPerPixel,
          (shape.bottom-shape.top)/worldPixelsPerPixel);
        else ctx.ellipse((shape.x-cameraX)/worldPixelsPerPixel,
          (shape.y-cameraY)/worldPixelsPerPixel,
          shape.rx/worldPixelsPerPixel,shape.ry/worldPixelsPerPixel,
          0,0,Math.PI*2);
        ctx.stroke();
      }
      // Sequel-only story boundaries are NEVER controlled by the user
      // collision-mode toggle. Distinct violet boundaries explain why a
      // visually shallow region beyond the guarded gate is sealed.
      ctx.fillStyle='rgba(138,63,191,.36)';
      ctx.strokeStyle='rgba(255,111,228,.96)';ctx.lineWidth=1.5;
      for(const lock of collider.locks){
        const x=(lock.left-cameraX)/worldPixelsPerPixel;
        const y=(lock.top-cameraY)/worldPixelsPerPixel;
        const w=(lock.right-lock.left)/worldPixelsPerPixel;
        const h=(lock.bottom-lock.top)/worldPixelsPerPixel;
        ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);
      }
      ctx.strokeStyle='rgba(255,216,88,.94)';ctx.lineWidth=2;
      for(const npc of collider.npcs){
        ctx.beginPath();ctx.arc((npc.x-cameraX)/worldPixelsPerPixel,
          (npc.y-cameraY)/worldPixelsPerPixel,
          (npc.radius+collider.playerRadius)/worldPixelsPerPixel,0,Math.PI*2);
        ctx.stroke();
      }
      ctx.strokeStyle='rgba(55,242,237,.95)';
      ctx.beginPath();ctx.arc((state.x-cameraX)/worldPixelsPerPixel,
        (state.y-cameraY)/worldPixelsPerPixel,
        collider.playerRadius/worldPixelsPerPixel,0,Math.PI*2);
      ctx.stroke();ctx.restore();
    }
    scene.dataset.zoom=String(zoom);
    scene.dataset.actorFrame=WORLD_ACTOR_FRAME.join('x');
    scene.dataset.heroArtFactor=String(previewMode&&reviewCharacters==='largeNpc'
      ?1:TENYO_HERO_ART_FACTOR);
    scene.dataset.reviewNpcArt=previewMode&&reviewCharacters==='largeNpc'
      ?'native-recomposed-2x':'original';
    scene.dataset.reviewCharacters=previewMode?reviewCharacters:'production';
    const foot={x:state.x,y:state.y};
    const npc=residentInFront(foot.x,foot.y,state.face,residents);
    dialogue.update(npc,foot.x,foot.y);
    const hint=npc?'Aで話す':state.y>=(map.height-3)*map.tileSize?'南へ進むとフィールドへ':'';
    if(interactionHint.textContent!==hint)interactionHint.textContent=hint;
    scene.dataset.x=String(state.x.toFixed(2));
    scene.dataset.y=String(state.y.toFixed(2));
    scene.dataset.movementUnit='world-pixels';
    scene.dataset.previewOcclusion='false';
    scene.dataset.spriteSet=useRebuiltArt?'tenyo-rebuild-v1':'legacy';
    scene.dataset.sceneDepth=useGroundedDepth?'grounded-two-plane':
      useRebuiltArt?'previous-depth':'previous-art-and-depth';
    scene.dataset.collisionProfile=collider.profile;
    scene.dataset.sequelSealed=String(collider.locks.length===1&&
      collider.locks[0].id==='guardian-sequel-passage');
    scene.dataset.contactRadius=String(collider.playerRadius);
  }
  let lastPaint=0,lastMotionTime=0;
  function frame(now){
    // Continuous movement follows elapsed time and stops at world-pixel
    // shapes, with swept foot-circle checks to avoid crossing thin walls.
    const elapsed=lastMotionTime?Math.min(40,Math.max(0,now-lastMotionTime)):0;
    lastMotionTime=now;
    state.moving=false;
    if(!dialogue.active){
      const direction=pendingInput??[...input.values()].at(-1);
      pendingInput=null;
      if(direction)startMove(direction,elapsed);
      if(shrineExitReached(collider,state.x,state.y)){leave();return;}
    }
    // Preserve existing costly water/reflection paint budget.
    if(now-lastPaint>=55){render(now);lastPaint=now;}
    requestAnimationFrame(frame);
  }

  if(previewMode){
    const artNote=document.querySelector('.review-note');
    if(artNote)artNote.textContent=useGroundedDepth
      ?'本編採用：新素材・接地点順の遮蔽／滝のしぶきは別レイヤー'
      :useRebuiltArt
      ?'本編採用素材・旧描画順（比較専用）'
      :'旧素材・旧描画順（比較専用）';
    for(const button of document.querySelectorAll('[data-tenyo-art]')){
      const choice=button.dataset.tenyoArt;
      button.setAttribute('aria-pressed',String((choice==='rebuild')===useRebuiltArt));
      button.addEventListener('click',()=>{
        if((choice==='rebuild')===useRebuiltArt)return;
        const url=new URL(location.href);
        url.searchParams.set('sprites',choice==='rebuild'?'rebuild':'legacy');
        location.search=url.search; // isolated comparison reload; never an in-world route
      });
    }
    for(const button of document.querySelectorAll('[data-tenyo-depth]')){
      const choice=button.dataset.tenyoDepth;
      button.disabled=!useRebuiltArt;
      button.setAttribute('aria-pressed',
        String((choice==='grounded')===useGroundedDepth));
      button.addEventListener('click',()=>{
        const target=choice==='grounded';
        if(!useRebuiltArt||target===useGroundedDepth)return;
        const url=new URL(location.href);
        url.searchParams.set('depth',target?'grounded':'legacy');
        location.search=url.search; // preview-only A/B, no story/save change
      });
    }
    // Review shortcuts move ONLY the unsaved test avatar to valid authored
    // world-pixel spots. The production game never sees these buttons.
    const spots={
      gate:{x:416,y:376,face:1},
      waterfall:{x:592,y:176,face:2},
      waterfallOverlap:{x:631.3,y:158,face:2}
    };
    for(const button of document.querySelectorAll('[data-tenyo-spot]')){
      button.addEventListener('click',()=>{
        const point=spots[button.dataset.tenyoSpot];
        if(!point||!shrineCanStand(collider,point.x,point.y))return;
        clearInput();
        state.x=point.x;state.y=point.y;
        state.face=point.face;state.dir=facing[point.face];
        state.moving=false;state.distance=0;
        render(performance.now());
      });
    }
    for(const button of document.querySelectorAll('[data-tenyo-contact]')){
      button.addEventListener('click',()=>{
        const profile=button.dataset.tenyoContact;
        if(profile!=='visual'&&profile!=='legacy')return;
        const candidate=sanctuaryCollisionGeometry(map,blocked,residents,{profile});
        // Profile changes must never teleport or invalidate the avatar.
        // If standing inside the new footprint, keep the current profile.
        if(!shrineCanStand(candidate,state.x,state.y))return;
        collider=candidate;
        for(const item of document.querySelectorAll('[data-tenyo-contact]'))
          item.setAttribute('aria-pressed',String(item===button));
      });
    }
    document.querySelector('[data-tenyo-collision]')?.addEventListener('click',event=>{
      showCollision=!showCollision;
      event.currentTarget.setAttribute('aria-pressed',String(showCollision));
    });
    for(const button of document.querySelectorAll('[data-tenyo-camera]')){
      button.addEventListener('click',()=>{
        const requested=Number(button.dataset.tenyoCamera);
        if(![1,1.4].includes(requested))return;
        reviewCamera=requested;
        for(const candidate of document.querySelectorAll('[data-tenyo-camera]'))
          candidate.setAttribute('aria-pressed',String(candidate===button));
      });
    }
    for(const button of document.querySelectorAll('[data-tenyo-figures]')){
      button.addEventListener('click',()=>{
        if(!['legacy','largeNpc'].includes(button.dataset.tenyoFigures))return;
        reviewCharacters=button.dataset.tenyoFigures;
        useReviewFigures();
        for(const candidate of document.querySelectorAll('[data-tenyo-figures]'))
          candidate.setAttribute('aria-pressed',String(candidate===button));
      });
    }
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
  load.hidden=true;
  window.KIKOKU_SAVE_SNAPSHOT=()=>({scene:'tenyo',position:{
    x:state.x/map.tileSize-.5,y:state.y/map.tileSize-.5,face:state.face}});
  window.parent?.KIKOKU_GAME?.autosave?.(window);
  requestAnimationFrame(frame);
}
start().catch(error=>{
  console.error(error);
  load.textContent='天妖の社を読み込めませんでした。ページを再読み込みしてください。';
});
