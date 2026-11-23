import { hizukiWalkDistance, makeWalk, touchedEntrance, villageArrivalFacing } from './movement.mjs?v=shared-walk-1';
import { drawVillageFence, makeVillageFence, VILLAGE_FENCE_ART, VILLAGE_GATE_POST_ART } from './boundary.mjs?v=gate-posts-1';
import { villageRooms } from '../interiors/rooms.mjs';
import { pixelViewport, DEFAULT_CAMERA_ZOOM, canopyOpacity, riverRipples, paintRiverRipples } from './render.mjs?v=nonfield-world-scale-1';
import { advanceResident, drawCharacter, makeResident, residentInFront, RESIDENT_RADIUS } from './residents.mjs';
import { bindDialogue } from './dialogue.mjs?v=field-menu-1';
import {collectFind,readPlayer,savePlayer} from '../battle/rules.mjs?v=equipment-4slots-2-shiomachi-gear-1-cave-quest-1-finds-1-guardian-1';
import {consumeRestorePosition} from '../save/save-game.mjs?v=save-slots-1-shiomachi-gear-1-finds-1-guardian-1';
import {VILLAGE_FINDS} from '../../../data/maps/hozuki-village/finds.mjs';
import {drawFindHint,shouldShowFindHint} from './find-indicator.mjs?v=nearby-1';
import {readStoryStage,advanceStoryStage,objectiveForStage} from '../story/chapter-one.mjs';

const scene = document.querySelector('#scene');
const load = document.querySelector('#load');

const context = scene.getContext('2d', {alpha:false});
const objective = document.querySelector('#objective');
function completeStoryDialogue(npc) {
  if (npc.id !== 'chief') return;
  // Never reset a later sanctuary event when the player revisits the village.
  advanceStoryStage('shrine');
  objective.textContent = objectiveForStage(readStoryStage());
}
objective.textContent = objectiveForStage(readStoryStage());

const directions = {
  down:[0,1,0], up:[0,-1,1], right:[1,0,2], left:[-1,0,3],
};
const keys = {ArrowDown:'down',ArrowUp:'up',ArrowRight:'right',ArrowLeft:'left',
              s:'down',w:'up',d:'right',a:'left'};
const input = new Map();
const buttons = [...document.querySelectorAll('[data-dir]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const zoom = DEFAULT_CAMERA_ZOOM;


function image(name,url=name==='hizuki.png' ? '../../../assets/characters/hizuki/walk-4dir-80x112.png?v=fb40c1b' : '../../../assets/village/scene/'+name) {
  return new Promise((resolve,reject) => {
    const bitmap = new Image();
    bitmap.onload = () => resolve(bitmap);
    bitmap.onerror = () => reject(new Error(name));
    bitmap.src = url;
  });
}

function rectangleContains(rect,x,y) {
  const [left,top,width,height] = rect;
  return x>=left && x<left+width && y>=top && y<top+height;
}

function setInput(id,direction) {
  if (direction) input.set(id,direction);
  else input.delete(id);
  const current = [...input.values()].pop();
  buttons.forEach(button => button.classList.toggle('held',button.dataset.dir===current));
}

function clearInput() {
  input.clear();
  buttons.forEach(button => button.classList.remove('held'));
}

async function start() {
  const [data,residentConfigs] = await Promise.all([
    '../../../data/maps/hozuki-village/scene.json?v=armory-signs-1', '../../../data/maps/hozuki-village/residents.json',
  ].map(async url=>{
    const response = await fetch(url);
    if (!response.ok) throw new Error(url);
    return response.json();
  }));
  const [worldX,worldY,width,height] = data.bounds;
  const [tiles,collision,hizuki,decor,fenceArt,gateArt] = await Promise.all([
    ...[data.terrain.atlas,'collision.png','hizuki.png','ground-decor.png'].map(name=>image(name)),
    image('village-fence','../../../'+VILLAGE_FENCE_ART),
    image('village-gate-post','../../../'+VILLAGE_GATE_POST_ART),
  ]);
  const residents = await Promise.all(residentConfigs.map(async config=>({
    ...makeResident(config), bitmap:await image(config.asset,'../../../'+config.asset),
  })));
  const dialogue=bindDialogue(()=>{
    clearInput();
    for(const npc of residents) npc.moving=false;
  }, completeStoryDialogue);
  const collectedFinds=new Set(readPlayer().foundItems);
  const finds=Object.entries(VILLAGE_FINDS).filter(([,site])=>site.sprite).map(([id,site])=>{
    const [x,y]=data.sprites.find(sprite=>sprite.id===site.sprite).feet;
    return {id,x,y,hintX:x,hintY:y-76};
  });
  const entrances=data.markers.filter(marker=>marker.entrance && Object.hasOwn(villageRooms,marker.id));
  const fieldExit=data.markers.find(marker=>marker.id==='field-exit');
  const paths = new Set(data.sprites.flatMap(p => [p.file,p.eave,p.sway].filter(Boolean)));
  const art = new Map(await Promise.all([...paths].map(async name => [name,await image(name)])));
  const canopyFiles=new Set(data.sprites.filter(s=>s.vegetation && s.vegetation!=='shrub').map(s=>s.file));
  const canopies=new Map([...canopyFiles].map(file=>{
    const bitmap=art.get(file);
    const canvas=document.createElement('canvas');
    canvas.width=bitmap.width;canvas.height=bitmap.height;
    const maskContext=canvas.getContext('2d',{willReadFrequently:true});
    maskContext.drawImage(bitmap,0,0);
    return [file,maskContext.getImageData(0,0,bitmap.width,bitmap.height)];
  }));
  const ground = document.createElement('canvas');
  ground.width = width;
  ground.height = height;
  const tileContext = ground.getContext('2d', {alpha:false});
  tileContext.imageSmoothingEnabled=false;
  function drawTerrainLayer(target, layer, offsetY=0) {
    const [left,top] = layer.origin;
    const {columns,cellPx} = layer;
    layer.cells.forEach((tile,index)=>{
      if(tile<0) return;
      const [sx,sy] = data.terrain.tiles[tile];
      const x = left + index%columns*cellPx;
      const y = top + Math.floor(index/columns)*cellPx;
      target.drawImage(tiles,sx,sy,cellPx,cellPx,x,y+offsetY,cellPx,cellPx);
    });
  }

  const {top:riverTop,height:riverHeight} = data.river;
  const riverBottom = riverTop + riverHeight;
  const riverLayer = data.terrain.layers.find(layer => layer.name === 'river');
  const bridgeLayer = data.terrain.layers.find(layer => layer.name === 'bridge');
  const ripples = riverRipples(width, riverHeight, riverLayer.cellPx);
  const riverCover = document.createElement('canvas');
  riverCover.width = width;
  riverCover.height = riverHeight;
  const riverContext = riverCover.getContext('2d');
  riverContext.imageSmoothingEnabled = false;

  for(const layer of data.terrain.layers){
    if(layer !== riverLayer && layer !== bridgeLayer) drawTerrainLayer(tileContext, layer);
  }
  // Reuse the river tile alpha for its shoreline, and replace its repeated surface pattern.
  drawTerrainLayer(riverContext, riverLayer, -riverTop);
  riverContext.globalCompositeOperation = 'source-in';
  riverContext.fillStyle = '#1c73ca';
  riverContext.fillRect(0, 0, width, riverHeight);
  riverContext.globalCompositeOperation = 'source-atop';
  riverContext.fillStyle = '#1e77cd';
  riverContext.fillRect(0, riverLayer.cellPx, width, riverHeight - 2 * riverLayer.cellPx);
  tileContext.drawImage(riverCover, 0, riverTop);
  riverContext.globalCompositeOperation = 'source-over';
  riverContext.clearRect(0, 0, width, riverHeight);

  function drawGroundDetails(target, offsetY=0) {
    drawTerrainLayer(target, bridgeLayer, offsetY);
    for(const [index,x,y,w,h] of data.groundDecor){
      target.drawImage(decor,index%8*32,Math.floor(index/8)*32,w,h,x,y+offsetY,w,h);
    }
  }
  // The bridge and shore details render above the water, including any parts within the band.
  tileContext.save();
  tileContext.beginPath();
  tileContext.rect(0, 0, width, riverTop);
  tileContext.rect(0, riverBottom, width, height - riverBottom);
  tileContext.clip();
  drawGroundDetails(tileContext);
  tileContext.restore();
  drawGroundDetails(riverContext, -riverTop);

  const houses = data.sprites.filter(sprite => sprite.eave);
  const overlay = document.createElement('canvas');
  overlay.width = width;
  overlay.height = height;
  const overlayContext = overlay.getContext('2d',{willReadFrequently:true});
  overlayContext.drawImage(collision,0,0);
  const rgba = overlayContext.getImageData(0,0,width,height);
  const blocked = new Uint8Array(width*height);
  // Remove the old solid frame from the collision PNG. Extend adjacent terrain
  // into that strip so water and scenery remain solid where they reach the edge.
  const frameWidth=20;
  for(let y=0;y<height;y++){
    const sourceRow=Math.max(frameWidth,Math.min(y,height-frameWidth-1))*width;
    for(let x=0;x<width;x++){
      const sourceX=Math.max(frameWidth,Math.min(x,width-frameWidth-1));
      blocked[y*width+x]=rgba.data[(sourceRow+sourceX)*4]>127;
    }
  }
  const lastColumn=width/32-1,lastRow=height/32-1;
  const northBank=Math.floor(riverTop/32),southBank=Math.floor(riverBottom/32);
  const [gapLeft,,gapWidth]=fieldExit.southExit;
  const firstGapTile=Math.floor(gapLeft/32),afterGapTile=Math.ceil((gapLeft+gapWidth)/32);
  const fence=makeVillageFence([
    [0,0,lastColumn,0],
    [0,0,0,northBank],[lastColumn,0,lastColumn,northBank],
    [0,southBank,0,lastRow],[lastColumn,southBank,lastColumn,lastRow],
    [0,lastRow,firstGapTile-1,lastRow],[afterGapTile,lastRow,lastColumn,lastRow],
  ],blocked,width);
  const scenery=[...data.sprites,...fence].sort((a,b)=>a.depth-b.depth);
  for(let i=0;i<blocked.length;i++){
    const p=i*4;
    rgba.data[p]=236;
    rgba.data[p+1]=75;
    rgba.data[p+2]=81;
    rgba.data[p+3]=blocked[i]?105:0;
  }
  overlayContext.putImageData(rgba,0,0);
  const walk = makeWalk(width,height,blocked,data.radius);
  const focus=new URL(location.href).searchParams.get('focus');
  const focusedResident = residents.find(npc=>npc.id===focus);
  let [x,y] = focusedResident ? [focusedResident.x,focusedResident.y+52]
    : data.markers.find(marker=>marker.id===focus)?.point ?? data.spawn;
  const returningFromBuilding=entrances.some(marker=>marker.id===focus);
  let face = villageArrivalFacing(focus,entrances), distance = 0, time = 0, lastFrame = 0;
  let viewportWidth,viewportHeight,pixelStep;
  let renderedX,renderedY;
  const contactRadius = data.radius+RESIDENT_RADIUS;
  const occupied = (px,py)=>residents.some(npc=>Math.hypot(px-npc.x,py-npc.y)<contactRadius);
  const heroOccupied = (px,py)=>Math.hypot(px-x,py-y)<contactRadius;
  const resumed=consumeRestorePosition('village');
  if(!returningFromBuilding && resumed && walk.canStand(resumed.x,resumed.y,true)&&!occupied(resumed.x,resumed.y)){
    x=resumed.x;y=resumed.y;face=villageArrivalFacing(focus,entrances,resumed.face??1);
  }

  function resize() {
    const {step,width,height}=pixelViewport(scene.parentElement.clientWidth,scene.parentElement.clientHeight,devicePixelRatio,zoom);
    pixelStep=step;
    scene.width=width;
    scene.height=height;
    const ratio=Math.min(devicePixelRatio||1,3);
    scene.style.width=(width/ratio)+'px';
    scene.style.height=(height/ratio)+'px';
    viewportWidth=width/step;
    viewportHeight=height/step;
  }

  function drawSprite(sprite) {
    const [sx,sy]=sprite.point;
    if (sprite.sway && !reducedMotion.matches) {
      const [w,h]=sprite.size;
      const frame=Math.floor(time/sprite.frameMs+sx/71)%sprite.frames;
      context.drawImage(art.get(sprite.sway),frame*w,0,w,h,sx,sy,w,h);
    } else {
      context.drawImage(art.get(sprite.file),sx,sy);
    }
  }

  function camera(center,viewport,map) {
    return viewport>=map ? (map-viewport)/2 : Math.max(0,Math.min(map-viewport,center-viewport/2));
  }

  function draw(moving) {
    const left=camera(x,viewportWidth,width);
    const top=camera(y,viewportHeight,height);
    context.setTransform(1,0,0,1,0,0);
    context.fillStyle='#233123';
    context.fillRect(0,0,scene.width,scene.height);
    context.setTransform(pixelStep,0,0,pixelStep,
      -Math.floor(left)*pixelStep,-Math.floor(top)*pixelStep);
    context.imageSmoothingEnabled=false;
    context.drawImage(ground,0,0);
    const right=left+viewportWidth;
    const bottom=top+viewportHeight;
    if(top < riverBottom && bottom > riverTop) {
      paintRiverRipples(context, ripples, width, riverTop, left, right, reducedMotion.matches ? 0 : time);
      context.drawImage(riverCover, 0, riverTop);
    }
    const characters=[{bitmap:hizuki,x,y,face,distance,moving},...residents].sort((a,b)=>a.y-b.y);
    let drawn=0;
    for(const sprite of scenery){
      while(drawn<characters.length && characters[drawn].y<sprite.depth){
        drawCharacter(context,characters[drawn++],data.hero.frame,data.hero.feet);
      }
      const [sx,sy]=sprite.point;
      if(sprite.mask!==undefined){
        if(sx<right&&sx+32>left&&sy-10<bottom&&sy+32>top)drawVillageFence(context,fenceArt,gateArt,sprite);
        continue;
      }
      const bitmap=art.get(sprite.file);
      if(sx<right && sx+bitmap.width>left && sy<bottom && sy+bitmap.height>top){
        context.globalAlpha=canopyOpacity(sprite,x,y,canopies.get(sprite.file));
        drawSprite(sprite);
        context.globalAlpha=1;
      }
    }
    while(drawn<characters.length) drawCharacter(context,characters[drawn++],data.hero.frame,data.hero.feet);
    const eave = houses.find(house => rectangleContains(house.eaveZone,x,y));
    if(eave) context.drawImage(art.get(eave.eave),...eave.eaveRect,...eave.eavePoint,eave.eaveRect[2],eave.eaveRect[3]);
    // Discoverable objects are marked only nearby, and only until collected.
    if(!dialogue.active) for(const find of finds){
      if(shouldShowFindHint({x,y},find,collectedFinds))
        drawFindHint(context,find.hintX,find.hintY,time);
    }

    dialogue.update(residentInFront(x,y,face,residents),x,y);

    const coords=[Math.round(x+worldX),Math.round(y+worldY)];
    if(coords[0]!==renderedX || coords[1]!==renderedY){
      [renderedX,renderedY]=coords;
      scene.dataset.x=String(renderedX);
      scene.dataset.y=String(renderedY);
    }
  }

  function frame(now) {
    const elapsed=lastFrame ? Math.min(now-lastFrame,40) : 0;
    lastFrame=now;
    time+=elapsed;
    const direction=[...input.values()].pop();
    let moving=false;
    if(direction && !dialogue.active){
      const [dx,dy,row]=directions[direction];
      face=row;
      const step=hizukiWalkDistance(elapsed);
      const [nx,ny,leftMap]=walk.move(x,y,dx*step,dy*step,occupied,true);
      if(leftMap){
        clearInput();
        window.KIKOKU_ROUTE.go('../../field/?from=village');
        return;
      }
      const entrance=touchedEntrance(entrances,x,y,nx,ny,data.radius);
      if(entrance){
        clearInput();
        window.KIKOKU_ROUTE.go('../interiors/?building='+encodeURIComponent(entrance.id));
        return;
      }
      const travel=Math.hypot(nx-x,ny-y);
      moving=travel>0;
      distance+=travel;
      x=nx;
      y=ny;
    }
    if(!dialogue.active) for(const npc of residents) advanceResident(npc,elapsed,walk,heroOccupied);
    draw(moving);
    requestAnimationFrame(frame);
  }

  for(const button of buttons){
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0 || dialogue.active) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setInput(event.pointerId,button.dataset.dir);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture']){
      button.addEventListener(type,event=>setInput(event.pointerId,null));
    }
    button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  function interact(){
    if(dialogue.open())return;
    const find=residentInFront(x,y,face,finds);
    if(!find)return;
    const result=collectFind(readPlayer(),find.id);
    if(result.accepted){savePlayer(result.player);collectedFinds.add(find.id);}
    dialogue.openMessage(result.message);
  }
  const actionA=document.querySelector('#action-a');
  const actionB=document.querySelector('#action-b');
  actionA.addEventListener('click',()=>{
    if(dialogue.active)dialogue.advance();
    else interact();
  });
  actionB.addEventListener('click',()=>{
    if(dialogue.active)dialogue.advance();
  });
  addEventListener('keydown',event=>{
    if(dialogue.active){
      // Native button Enter/Space already triggers click; never advance twice.
      if((event.key==='Enter'||event.key===' ') && event.target?.tagName==='BUTTON') return;
      if(['Enter',' ','Escape'].includes(event.key)){
        event.preventDefault();
        if(!event.repeat)dialogue.advance();
      }
      return;
    }
    if ((event.key==='Enter'||event.key===' ') && event.target===document.body) {
      event.preventDefault();
      if(!event.repeat)interact();
      return;
    }
    const direction=keys[event.key];
    if(!direction || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if(!event.repeat) setInput(event.key,direction);
  });
  addEventListener('keyup',event=>{
    if(keys[event.key]) setInput(event.key,null);
  });
  addEventListener('blur',clearInput);
  addEventListener('pagehide',clearInput);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) clearInput();
  });


  resize();
  new ResizeObserver(resize).observe(scene.parentElement);
  load.hidden=true;
  window.KIKOKU_SAVE_SNAPSHOT=()=>({scene:'village',position:{x,y,face}});
  window.parent?.KIKOKU_GAME?.autosave?.(window);
  requestAnimationFrame(frame);
}

start().catch(error=>{
  console.error(error);
  load.textContent='村を読み込めませんでした。ページを再読み込みしてください。';
});
