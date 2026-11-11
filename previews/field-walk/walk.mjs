import { arrival, canEnterCell, cellPx, terrain, villageCell } from './map.mjs?v=field-connection';
import { pixelViewport } from '../village-walk/render.mjs?v=camera-0.5';
import { drawCharacter } from '../village-walk/residents.mjs?v=indoor-residents';

const scene = document.querySelector('#scene');
const load = document.querySelector('#load');
const status = document.querySelector('#status');
const buttons = [...document.querySelectorAll('[data-dir]')];
const context = scene.getContext('2d', {alpha:false});
const width = terrain[0].length * cellPx;
const height = terrain.length * cellPx;
const directions = {up:[0,-1,1],down:[0,1,0],left:[-1,0,3],right:[1,0,2]};
const keys = {ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
const inputs = new Map();
const moveMs = 220;

function setInput(id, direction) {
  if (direction) inputs.set(id, direction);
  else inputs.delete(id);
  const active = [...inputs.values()].at(-1);
  for (const button of buttons) button.classList.toggle('held', button.dataset.dir === active);
}

function clearInput() {
  inputs.clear();
  for (const button of buttons) button.classList.remove('held');
}

async function loadBitmap(path) {
  const bitmap = new Image();
  bitmap.src = '../../assets/' + path;
  await bitmap.decode();
  return bitmap;
}

async function start() {
  const paths = {
    grass:'field/terrain/grass.png', sea:'field/terrain/water.png', sand:'field/terrain/sand.png',
    road:'field/terrain/road.png', trees:'field/objects/trees.png',
    hill:'field/objects/mountain-small.png', village:'field/objects/village.png',
    hero:'characters/hizuki/walk-sd-32.png',
  };
  const art = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([id,path])=>[id,await loadBitmap(path)])));
  const ground = document.createElement('canvas');
  ground.width = width;
  ground.height = height;
  const floor = ground.getContext('2d', {alpha:false});
  const scenery = [];
  const roadAt = (column,row) => terrain[row]?.[column] === '=';
  const [villageX,villageY] = villageCell;
  const villageDepth = villageY * cellPx;
  scenery.push({bitmap:art.village, x:villageX*cellPx, y:villageDepth-cellPx, depth:villageDepth});
  terrain.forEach((row, rowIndex) => [...row].forEach((tile, column) => {
    const x = column * cellPx;
    const y = rowIndex * cellPx;
    const texture = tile === '~' ? art.sea : tile === 's' ? art.sand : art.grass;
    floor.drawImage(texture,x%texture.width,y%texture.height,cellPx,cellPx,x,y,cellPx,cellPx);
    if (tile === '=') {
      const left = roadAt(column-1,rowIndex) ? 0 : 5;
      const right = roadAt(column+1,rowIndex) ? cellPx : 27;
      const top = roadAt(column,rowIndex-1) || rowIndex === villageY ? 0 : 5;
      const bottom = roadAt(column,rowIndex+1) ? cellPx : 27;
      const roadWidth = right-left;
      const roadHeight = bottom-top;
      floor.drawImage(art.road,x%64+left,y%64+top,roadWidth,roadHeight,x+left,y+top,roadWidth,roadHeight);
    }
    const bitmap = tile === 'f' ? art.trees : tile === '^' ? art.hill : null;
    if (bitmap) scenery.push({bitmap,x,y,depth:y+cellPx-3});
  }));
  scenery.sort((a,b)=>a.depth-b.depth);

  let [column,row] = arrival;
  let face = new URLSearchParams(location.search).get('from') === 'village' ? 0 : 1;
  let step;
  let distance = 0;
  let scale, viewWidth, viewHeight;
  const center = tile => tile * cellPx + cellPx/2;
  const camera = (focus, view, total) => view >= total ? (total-view)/2 : Math.max(0,Math.min(total-view,focus-view/2));

  function resize() {
    const parent = scene.parentElement;
    const ratio = Math.min(devicePixelRatio || 1, 3);
    const viewport = pixelViewport(parent.clientWidth,parent.clientHeight,ratio,1.75);
    scene.width = viewport.width;
    scene.height = viewport.height;
    scene.style.width = scene.width/ratio+'px';
    scene.style.height = scene.height/ratio+'px';
    scale = viewport.step;
    viewWidth = scene.width/scale;
    viewHeight = scene.height/scale;
  }

  function draw(progress) {
    const x = center(column) + (step ? step.dx * cellPx * progress : 0);
    const y = center(row) + (step ? step.dy * cellPx * progress : 0);
    const left = camera(x,viewWidth,width);
    const top = camera(y,viewHeight,height);
    context.resetTransform();
    context.fillStyle = '#075d7c';
    context.fillRect(0,0,scene.width,scene.height);
    context.setTransform(scale,0,0,scale,-Math.floor(left)*scale,-Math.floor(top)*scale);
    context.imageSmoothingEnabled = false;
    context.drawImage(ground,0,0);
    const hero = {bitmap:art.hero,x,y,face,moving:Boolean(step),distance:distance+progress*cellPx};
    let drawn = false;
    for (const item of scenery) {
      if (!drawn && y < item.depth) {
        drawCharacter(context,hero,[32,32],[16,28]);
        drawn = true;
      }
      context.drawImage(item.bitmap,item.x,item.y);
    }
    if (!drawn) drawCharacter(context,hero,[32,32],[16,28]);
    if (scene.dataset.x !== String(column) || scene.dataset.y !== String(row)) {
      scene.dataset.x = String(column);
      scene.dataset.y = String(row);
      status.textContent = column === villageX && row === villageY+1 ? '鬼灯村は道の上側' : '鬼灯村周辺';
    }
  }

  function frame(now) {
    let progress = step ? Math.min(1,(now-step.started)/moveMs) : 0;
    if (step && progress === 1) {
      column += step.dx;
      row += step.dy;
      distance += cellPx;
      step = undefined;
      progress = 0;
      if (column === villageX && row === villageY) {
        clearInput();
        location.assign('../village-walk/?focus=field-exit&v=field-connection');
        return;
      }
    }
    const direction = [...inputs.values()].at(-1);
    if (direction && !step) {
      const [dx,dy,rowIndex] = directions[direction];
      face = rowIndex;
      if (canEnterCell(column+dx,row+dy)) step = {dx,dy,started:now};
    }
    draw(progress);
    requestAnimationFrame(frame);
  }

  for (const button of buttons) {
    button.addEventListener('pointerdown',event=>{
      if (event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setInput(event.pointerId,button.dataset.dir);
    });
    for (const type of ['pointerup','pointercancel','lostpointercapture']) {
      button.addEventListener(type,event=>setInput(event.pointerId));
    }
    button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  addEventListener('keydown',event=>{
    const direction = keys[event.key];
    if (!direction || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if (!event.repeat) setInput(event.key,direction);
  });
  addEventListener('keyup',event=>{ if (keys[event.key]) setInput(event.key); });
  addEventListener('blur',clearInput);
  addEventListener('pagehide',clearInput);
  document.addEventListener('visibilitychange',()=>{ if (document.hidden) clearInput(); });
  resize();
  new ResizeObserver(resize).observe(scene.parentElement);
  draw(0);
  load.hidden = true;
  requestAnimationFrame(frame);
}

start().catch(error=>{
  console.error(error);
  load.textContent = 'フィールドを読み込めませんでした。ページを再読み込みしてください。';
});
