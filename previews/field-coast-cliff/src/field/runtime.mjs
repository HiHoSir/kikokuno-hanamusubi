import {fieldViewportDimensions} from './viewport.mjs';
import {createTileLayerPrototype} from './tile-layer-prototype.mjs?v=field-foreground-exit-2';
const {YK_WORLD: world, YK_LANDSCAPE: landscape, YK_AUTOTILE: autotile,
  YK_ELEVATION: elevation, YK_CAMERA: camera, YK_MOVEMENT: movement,
  YK_AREA_TRANSITIONS: transitions, YK_FIELD_ASSETS: assets} = window;

export {world};
export const contact = (x, y) => transitions.contact(world, x, y);

export function placeArrival(placeId) {
  const place=world.places[placeId];
  if(!place)throw new Error('不明なフィールド地点: '+placeId);
  const queue = [place.point];
  const seen = new Set(queue.map(point => point.join(',')));
  for (const [x, y] of queue) {
    if (contact(x, y) !== placeId && world.walkable(x, y)) return [x, y];
    for (const [dx, dy] of [[0, 32], [32, 0], [-32, 0], [0, -32]]) {
      const next = [x + dx, y + dy];
      const key = next.join(',');
      if (!seen.has(key) && world.canMove(x, y, ...next)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  throw new Error(placeId+'からフィールドに戻れるセルがありません');
}

export function villageArrival(){return placeArrival('village');}

export async function loadFieldArt() {
  if(!window.__FIELD_COAST_CLIFF_CHIPS&&typeof location!=='undefined'&&
     new URLSearchParams(location.search).get('renderer')==='coast-cliff-chips'){
    const {loadTerrainChips,placeShoreTrees,composeTerrainChips}=await import('../../work/field-coast-cliff/terrain-chips.mjs');
    const chips=await loadTerrainChips();
    const changes=placeShoreTrees(world,chips['coast-mask']);
    window.YK_FIELD_ELEVATION.refreshCollision(world.mapData);
    window.__FIELD_COAST_CLIFF_CHIPS={art:chips,composeTerrainChips,shoreTreeChanges:changes};
  }
  const hero = new Image();
  hero.src = assets.url(assets.hero);
  await Promise.all([
    hero.decode(),
    new Promise((resolve, reject) => {
      function check() {
        const errors = {...landscape.errors, ...autotile.errors};
        if (Object.keys(errors).length) reject(new Error(JSON.stringify(errors)));
        else if (landscape.ready() && autotile.ready()) resolve();
      }
      landscape.load(check);
      autotile.load(check);
      check();
    }),
  ]);
  return hero;
}

export function fieldStep(state, dx, dy, at) {
  const {x, y} = state;
  const tx = x + dx * world.tileSize, ty = y + dy * world.tileSize;
  if (!world.canMove(x, y, tx, ty)) return null;
  const next = movement.step('field', x, y, dx, dy, 1, world.size, (px, py) => !world.walkable(px, py));
  if (next.x === x && next.y === y) return null;
  const ladder = dy && elevation.ladderBetween(world.mapData, Math.floor(x / 32), Math.floor(y / 32),
    Math.floor(x / 32), Math.floor(next.y / 32));
  return {
    ...next,
    motion: {x, y, at, duration: ladder ? 400 : movement.duration('field')},
    ladder: ladder ? {from: elevation.height(world.mapData, x, y), to: elevation.height(world.mapData, next.x, next.y)} : null,
  };
}

// Draw the projected world into a true landscape canvas: wider devices reveal
// more world to the LEFT and RIGHT. No portrait square, CSS cover or crop bar.
// Logical height is the original field renderer's 544px; changing width only
// leaves the 32px world grid, camera zoom, pixel-density and Y-perspective intact.
export function createFieldRenderer(context, hero) {
  const [anchorX,anchorY]=assets.heroFootAnchorPx;
  const display=context.canvas;
  const preview=(typeof location!=='undefined'&&new URLSearchParams(location.search).get('renderer')==='tile-layers')||!!window.__FIELD_COAST_CLIFF_CHIPS;
  let trialState={row:0,column:0};
  const trial=preview?createTileLayerPrototype(context,world.mapData,
    (c,px,py,z)=>drawHero(px,py,z,trialState.row,trialState.column,c,!!window.__FIELD_COAST_CLIFF_CHIPS),
    window.__FIELD_COAST_CLIFF_CHIPS,
    {image:hero,anchor:assets.heroFootAnchorPx,frame:()=>trialState}):null;
  if(preview)window.__FIELD_TILE_LAYER_TRIAL=trial;
  // Profiling is opt-in for reproducible browser QA; gameplay never pays
  // timing/allocation costs or displays a debug overlay.
  const profile=typeof location!=='undefined'&&new URLSearchParams(location.search).get('profile')==='1';
  const stats=profile?{frames:0,samples:[],totalMs:0,maxMs:0,viewport:[],lastAt:0}:null;
  if(profile)window.__FIELD_RENDER_PROFILE=stats;
  function drawHero(px,py,projection,row,column,target=context,projectedContact=false) {
    const z=.56*projection;
    // The chip renderer projects its world contact point before drawing.
    const foot=projectedContact?py:py+(14-9*.56)*projection+9*z;
    target.save();
    target.imageSmoothingEnabled=false;
    target.save();
    target.globalAlpha=.28;
    target.fillStyle='#101820';
    target.beginPath();
    target.ellipse(px,foot,20*z,6*z,0,0,Math.PI*2);
    target.fill();
    target.restore();
    target.drawImage(hero,column*32,row*32,32,32,
      px-anchorX*projection,foot-anchorY*projection,32*projection,32*projection);
    target.restore();
    display.dataset.fieldHeroFoot=String(Math.round(foot));
  }
  return function drawField(state,frameTime){
    const started=profile?performance.now():0;
    const box=display?.getBoundingClientRect?.()||{width:display?.width||640,height:display?.height||544};
    const dims=fieldViewportDimensions(box.width,box.height);
    if(display.width!==dims.width||display.height!==dims.height){
      display.width=dims.width;
      display.height=dims.height;
    }
    const {x,y}=camera.position(state,state.motion,frameTime);
    let height;
    if(state.ladder&&state.motion){
      const t=Math.max(0,Math.min(1,(frameTime-state.motion.at)/state.motion.duration));
      height=state.ladder.from+(state.ladder.to-state.ladder.from)*t;
    }
    context.imageSmoothingEnabled=false;
    context.fillStyle='#102635';
    context.fillRect(0,0,dims.width,dims.height);
    trialState=state;
    if(preview){
      trial.draw(context,{x,foot:y,height},frameTime,dims.width);
    }else landscape.drawQuarter(context,world.mapData,{
      x,foot:y,height,
      draw:(px,py,z)=>drawHero(px,py,z,state.row,state.column),
    },1.4,{oceanOutside:true,elevationTerrain:true,viewportWidth:dims.width,motionTime:frameTime});
    display.dataset.fieldViewportWidth=String(dims.width);
    display.dataset.fieldViewportHeight=String(dims.height);
    // Deliberately no fieldCropTop: there is no source crop.
    delete display.dataset.fieldCropTop;
    if(profile){
      const elapsed=performance.now()-started;
      stats.frames++;
      stats.totalMs+=elapsed;
      stats.maxMs=Math.max(stats.maxMs,elapsed);
      stats.lastAt=frameTime;
      stats.viewport=[dims.width,dims.height];
      stats.samples.push(Math.round(elapsed*100)/100);
      if(stats.samples.length>240)stats.samples.shift();
    }
  };
}
