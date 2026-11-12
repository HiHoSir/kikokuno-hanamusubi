import {HIZUKI_INTERIOR_WALK_SPEED, makeWalk} from '../village/movement.mjs?v=village-speed-288';
import {DEFAULT_CAMERA_ZOOM, pixelViewport} from '../village/render.mjs';
import {drawCharacter, RESIDENT_RADIUS, residentInFront} from '../village/residents.mjs';
import {bindDialogue} from '../village/dialogue.mjs';
import {rooms, resolveInterior, prepareInterior} from './rooms.mjs';
import {paintRoom, paintPartition, paintContactShadow} from './room-art.mjs';

const scene = document.querySelector('#scene');
const context = scene.getContext('2d', {alpha:false});

const load = document.querySelector('#load');

const exit = {href:''};
const buttons = [...document.querySelectorAll('[data-dir]')];
const directions = {down:[0,1,0],up:[0,-1,1],right:[1,0,2],left:[-1,0,3]};
const keys = {ArrowDown:'down',ArrowUp:'up',ArrowRight:'right',ArrowLeft:'left',
              s:'down',w:'up',d:'right',a:'left'};
const input = new Map();

function loadImage(path) {
  return new Promise((resolve,reject)=>{
    const image = new Image();
    image.onload = ()=>resolve(image);
    image.onerror = ()=>reject(new Error(path));
    image.src = path;
  });
}

function setInput(id, direction) {
  if (direction) input.set(id,direction);
  else input.delete(id);
  const current = [...input.values()].at(-1);
  for (const button of buttons) button.classList.toggle('held',button.dataset.dir===current);
}

function clearInput() {
  input.clear();
  for (const button of buttons) button.classList.remove('held');
}

async function start() {
  const assets = new Set(Object.values(rooms).map(room=>room.resident.asset));
  const [furniture, hizuki, portraits] = await Promise.all([
    loadImage('../../../assets/village/interiors/furniture.png'),
    loadImage('../../../assets/characters/hizuki/walk-4dir-80x112.png?v=fb40c1b'),
    Promise.all([...assets].map(async asset=>[asset,await loadImage('../../../assets/characters/npc/'+asset+'-walk-4dir-80x112.png')])),
  ]);
  const residentArt = new Map(portraits);
  const dialogue = bindDialogue(clearInput);
  const params = new URLSearchParams(location.search);
  const initial = resolveInterior(params);
  const outdoor = new URL('../village/',location.href);
  if (initial.returnFocus) outdoor.searchParams.set('focus',initial.returnFocus);
  exit.href = outdoor.href;
  const floor = document.createElement('canvas');
  const floorContext = floor.getContext('2d');
  const overlay = document.createElement('canvas');
  const overlayContext = overlay.getContext('2d');
  let room, plan, walk, x, y, viewport, face, distance;
  let lastFrame=0;

  function setRoom(nextRoom, selected) {
    clearInput();
    dialogue.close();
    room = nextRoom;
    plan = prepareInterior(room);
    plan.resident.bitmap=residentArt.get(plan.resident.asset);
    walk = makeWalk(room.width,room.height,plan.blocked,8);
    [x,y] = plan.spawn;
    face = 1;
    distance = 0;
    scene.dataset.room = selected;
    scene.setAttribute('aria-label',room.name+'の間取り');
    floor.width = overlay.width = room.width;
    floor.height = overlay.height = room.height;
    paintRoom(floorContext,room);
    for (const {footprint} of plan.depthSorted) {
      if (footprint) paintContactShadow(floorContext,footprint);
    }
    const rgba = overlayContext.createImageData(room.width,room.height);
    for (let i=0;i<plan.blocked.length;i++) {
      const p = i*4;
      rgba.data[p] = 236;
      rgba.data[p+1] = 75;
      rgba.data[p+2] = 81;
      rgba.data[p+3] = plan.blocked[i] ? 95 : 0;
    }
    overlayContext.putImageData(rgba,0,0);
  }

  function resize() {
    const parent = scene.parentElement;
    const {step,width,height} = pixelViewport(parent.clientWidth,parent.clientHeight,devicePixelRatio,DEFAULT_CAMERA_ZOOM);
    scene.width = width;
    scene.height = height;
    const ratio = Math.min(devicePixelRatio||1,3);
    scene.style.width = width/ratio+'px';
    scene.style.height = height/ratio+'px';
    viewport = {step,width:width/step,height:height/step};
  }

  function camera(position, visible, size) {
    if (visible>=size) return (size-visible)/2;
    return Math.max(0,Math.min(size-visible,position-visible/2));
  }

  function draw(moving) {
    const {step,width,height} = viewport;
    context.setTransform(1,0,0,1,0,0);
    context.fillStyle='#191714';
    context.fillRect(0,0,scene.width,scene.height);
    const left = camera(x,width,room.width);
    const top = camera(y,height,room.height);
    context.setTransform(step,0,0,step,-Math.floor(left)*step,-Math.floor(top)*step);
    context.imageSmoothingEnabled=false;
    context.drawImage(floor,0,0);
    const drawHero = ()=>drawCharacter(context,{bitmap:hizuki,x,y,face,distance,moving});
    let drewHero = false;
    for (const object of plan.depthSorted) {
      if (!drewHero && object.depth>y) {
        drawHero();
        drewHero = true;
      }
      if (object===plan.resident) {
        drawCharacter(context,object);
      } else if (object.sprite) {
        const [, , w, h] = object.sprite;
        context.drawImage(furniture,...object.sprite,object.x,object.y,w,h);
      } else {
        paintPartition(context,object.x,object.y,object.w);
      }
    }
    if (!drewHero) drawHero();
    dialogue.update(residentInFront(x,y,face,[plan.resident]),x,y);

    const currentX=String(Math.round(x)), currentY=String(Math.round(y));
    if (scene.dataset.x!==currentX) scene.dataset.x=currentX;
    if (scene.dataset.y!==currentY) scene.dataset.y=currentY;
  }

  function frame(now) {
    const elapsed = lastFrame ? Math.min(now-lastFrame,40) : 0;
    lastFrame = now;
    const direction = [...input.values()].at(-1);
    let moving = false;
    if (direction && !dialogue.active) {
      const [dx,dy,row] = directions[direction];
      face = row;
      const step=HIZUKI_INTERIOR_WALK_SPEED*elapsed/1000;
      const [nx,ny] = walk.move(x,y,dx*step,dy*step);
      const travel = Math.hypot(nx-x,ny-y);
      moving = travel>0;
      distance += travel;
      [x,y] = [nx,ny];
      if (direction==='down' && y>=plan.exitY) {
        window.KIKOKU_ROUTE.go(exit.href);
        return;
      }
    }
    draw(moving);
    requestAnimationFrame(frame);
  }



  for (const button of buttons) {
    button.addEventListener('pointerdown',event=>{
      if (event.button!==0 || dialogue.active) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setInput(event.pointerId,button.dataset.dir);
    });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) {
      button.addEventListener(type,event=>setInput(event.pointerId,null));
    }
    button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  const actionA=document.querySelector('#action-a');
  const actionB=document.querySelector('#action-b');
  actionA.addEventListener('click',()=>{
    if(dialogue.active)dialogue.advance();
    else dialogue.open();
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
    if((event.key==='Enter'||event.key===' ') && event.target===document.body){
      dialogue.open();
      return;
    }
    if (!keys[event.key] || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if (!event.repeat) setInput(event.key,keys[event.key]);
  });
  addEventListener('keyup',event=>{
    if (keys[event.key]) setInput(event.key,null);
  });
  addEventListener('blur',clearInput);
  addEventListener('pagehide',clearInput);
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) clearInput();
  });
  setRoom(initial.room,initial.selected);
  resize();
  new ResizeObserver(resize).observe(scene.parentElement);
  load.hidden = true;
  requestAnimationFrame(frame);
}

start().catch(error=>{
  console.error(error);
  load.textContent='室内を読み込めませんでした。ページを再読み込みしてください。';
});
