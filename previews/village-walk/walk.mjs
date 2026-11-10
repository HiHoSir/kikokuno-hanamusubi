import { makeWalk } from './movement.mjs';
import { pixelViewport } from './render.mjs?v=adult-layout';

const scene = document.querySelector('#scene');
const status = document.querySelector('#status');
const load = document.querySelector('#load');
const debug = document.querySelector('#debug');
const context = scene.getContext('2d', {alpha:false});
const directions = {
  down:[0,1,0], up:[0,-1,1], right:[1,0,2], left:[-1,0,3],
};
const keys = {ArrowDown:'down',ArrowUp:'up',ArrowRight:'right',ArrowLeft:'left',
              s:'down',w:'up',d:'right',a:'left'};
const input = new Map();
const buttons = [...document.querySelectorAll('[data-dir]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const zoom = 1.0;
const speed = 152;

function image(name) {
  return new Promise((resolve,reject) => {
    const bitmap = new Image();
    bitmap.onload = () => resolve(bitmap);
    bitmap.onerror = () => reject(new Error(name));
    bitmap.src = './map/'+name;
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
  const response = await fetch('./map/scene.json');
  if (!response.ok) throw new Error('scene.json');
  const data = await response.json();
  const [worldX,worldY,width,height] = data.bounds;
  const [tiles,collision,hizuki,decor] = await Promise.all([data.terrain.atlas,'collision.png','hizuki.png','ground-decor.png'].map(image));
  const paths = new Set(data.sprites.flatMap(p => [p.file,p.eave,p.sway].filter(Boolean)));
  const art = new Map(await Promise.all([...paths].map(async name => [name,await image(name)])));
  // Resize each original once. The same bitmap serves every instance and its eave.
  for(const sprite of data.sprites.filter(sprite=>sprite.scale)) {
    const original=art.get(sprite.file);
    if(original instanceof HTMLCanvasElement) continue;
    const bitmap=document.createElement('canvas');
    [bitmap.width,bitmap.height]=sprite.size;
    const ctx=bitmap.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    ctx.scale(sprite.scale,sprite.scale);
    ctx.drawImage(original,0,0);
    art.set(sprite.file,bitmap);
  }
  const ground = document.createElement('canvas');
  ground.width = width;
  ground.height = height;
  const tileContext = ground.getContext('2d', {alpha:false});
  tileContext.imageSmoothingEnabled=false;
  for(const layer of data.terrain.layers){
    const [left,top] = layer.origin;
    const {columns,cellPx} = layer;
    layer.cells.forEach((tile,index)=>{
      if(tile<0) return;
      const [sx,sy] = data.terrain.tiles[tile];
      const x = left + index%columns*cellPx;
      const y = top + Math.floor(index/columns)*cellPx;
      tileContext.drawImage(tiles,sx,sy,cellPx,cellPx,x,y,cellPx,cellPx);
    });
  }
  const houses = data.sprites.filter(sprite => sprite.eave);
  for(const [index,x,y,w,h] of data.groundDecor){
    tileContext.drawImage(decor,index%8*32,Math.floor(index/8)*32,w,h,x,y,w,h);
  }
  const overlay = document.createElement('canvas');
  overlay.width = width;
  overlay.height = height;
  const overlayContext = overlay.getContext('2d',{willReadFrequently:true});
  overlayContext.drawImage(collision,0,0);
  const rgba = overlayContext.getImageData(0,0,width,height);
  const blocked = new Uint8Array(width*height);
  for(let i=0;i<blocked.length;i++){
    const p=i*4;
    blocked[i]=rgba.data[p]>127;
    rgba.data[p]=236;
    rgba.data[p+1]=75;
    rgba.data[p+2]=81;
    rgba.data[p+3]=blocked[i]?105:0;
  }
  overlayContext.putImageData(rgba,0,0);
  const walk = makeWalk(width,height,blocked,data.radius);
  const [frameWidth,frameHeight] = data.hero.frame;
  const [footX,footY] = data.hero.feet;
  const scale = data.hero.scale;
  const focus=new URL(location.href).searchParams.get('focus');
  let [x,y] = data.markers.find(marker=>marker.id===focus)?.point ?? data.spawn;
  let face = 1, distance = 0, time = 0, lastFrame = 0;
  let viewportWidth,viewportHeight,pixelStep;
  let renderedX,renderedY;

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

  function drawHero(column) {
    context.drawImage(hizuki,frameWidth*column,frameHeight*face,frameWidth,frameHeight,
      Math.round(x-footX*scale),Math.round(y-footY*scale),frameWidth*scale,frameHeight*scale);
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
    const stride=[1,0,2,0];
    const column=moving?stride[Math.floor(distance/14)%stride.length]:0;
    let drewHero=false;
    for(const sprite of data.sprites){
      if(!drewHero && sprite.depth>y){
        drawHero(column);
        drewHero=true;
      }
      const [sx,sy]=sprite.point;
      const bitmap=art.get(sprite.file);
      if(sx<right && sx+bitmap.width>left && sy<bottom && sy+bitmap.height>top){
        drawSprite(sprite);
      }
    }
    if(!drewHero) drawHero(column);
    const eave = houses.find(house => rectangleContains(house.eaveZone,x,y));
    if(eave) context.drawImage(art.get(eave.eave),...eave.eaveRect,...eave.eavePoint,eave.eaveRect[2],eave.eaveRect[3]);
    const showDebug=debug.getAttribute('aria-pressed')==='true';
    const marker=data.markers.find(({point:[mx,my]})=>Math.hypot(mx-x,my-y)<22);
    if(showDebug){
      context.drawImage(overlay,0,0);
      for(const {point:[mx,my],entrance} of data.markers){
        context.fillStyle='#f1d96f';
        context.fillRect(mx-2,my-2,4,4);
        if(entrance){
          context.strokeStyle='#f1d96f';
          context.strokeRect(...entrance);
        }
      }
      context.strokeStyle='#fff';
      context.lineWidth=1.5;
      context.beginPath();
      context.arc(x,y,data.radius,0,Math.PI*2);
      context.stroke();
    }
    const rear=showDebug && houses.find(house=>{
      const [left,top]=house.point;
      return y>=top && y<house.depth && x>=left && x<left+art.get(house.file).width;
    });
    const location=eave ? eave.name+'の軒下' : rear ? rear.name+'の裏' : marker?.name ?? '村の中';
    const coords=[Math.round(x+worldX),Math.round(y+worldY)];
    const label=showDebug ? location+'  '+coords.join(', ') : location;
    if(status.textContent!==label) status.textContent=label;
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
    if(direction){
      const [dx,dy,row]=directions[direction];
      face=row;
      const [nx,ny]=walk.move(x,y,dx*speed*elapsed/1000,dy*speed*elapsed/1000);
      const travel=Math.hypot(nx-x,ny-y);
      moving=travel>0;
      distance+=travel;
      x=nx;
      y=ny;
    }
    draw(moving);
    requestAnimationFrame(frame);
  }

  for(const button of buttons){
    button.addEventListener('pointerdown',event=>{
      if(event.button!==0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setInput(event.pointerId,button.dataset.dir);
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture']){
      button.addEventListener(type,event=>setInput(event.pointerId,null));
    }
    button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  addEventListener('keydown',event=>{
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
  document.querySelector('#reset').addEventListener('click',()=>{
    clearInput();
    [x,y]=data.spawn;
    face=1;
    distance=0;
  });
  debug.addEventListener('click',()=>{
    const enabled=debug.getAttribute('aria-pressed')!=='true';
    debug.setAttribute('aria-pressed',String(enabled));
    debug.textContent=enabled?'判定を隠す':'判定を表示';
  });
  resize();
  new ResizeObserver(resize).observe(scene.parentElement);
  load.hidden=true;
  requestAnimationFrame(frame);
}

start().catch(error=>{
  console.error(error);
  status.textContent='読み込み失敗';
  load.textContent='村を読み込めませんでした。ページを再読み込みしてください。';
});
