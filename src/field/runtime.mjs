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

// Compose the fixed authored projection into the true landscape viewport.
// This is a pixel-space camera crop, not CSS object-fit (which cannot track
// the actual projected player and caused the hero to leave the visible area).
export function fieldViewportCrop(aspect, footY, sourceSize=768) {
  if (!Number.isFinite(aspect) || aspect<=1.35) return {height:sourceSize,top:0};
  const height=Math.max(1,Math.min(sourceSize,Math.round(sourceSize/aspect)));
  const foot=Number.isFinite(footY)?footY:sourceSize*.60;
  const top=Math.max(0,Math.min(sourceSize-height,foot-height*.68));
  return {height,top};
}

export function createFieldRenderer(context, hero) {
  const [anchorX, anchorY] = assets.heroFootAnchorPx;
  const display=context.canvas;
  // An offscreen 768px square keeps the world perspective and sprite scale
  // identical to portrait. Only the visible slice changes in landscape.
  const buffer=display&&typeof document!=='undefined'&&typeof document.createElement==='function'
    ?document.createElement('canvas'):null;
  if(buffer){buffer.width=768;buffer.height=768;}
  const bufferContext=buffer?.getContext?.('2d',{alpha:false})||null;
  let paint=context,projectedFoot=null;

  function drawHero(px, py, projection, row, column) {
    const z = .56 * projection;
    const foot = py + (14 - 9 * .56) * projection + 9 * z;
    // Includes the original renderer's translate(0,32) and scale(1.2).
    // Track the *actual drawn* sprite foot instead of guessing camera offsets.
    projectedFoot=32+1.2*foot;
    paint.save();
    paint.imageSmoothingEnabled = false;
    paint.save();
    paint.globalAlpha = .28;
    paint.fillStyle = '#101820';
    paint.beginPath();
    paint.ellipse(px, foot, 20 * z, 6 * z, 0, 0, Math.PI * 2);
    paint.fill();
    paint.restore();
    paint.drawImage(hero, column * 32, row * 32, 32, 32,
      px - anchorX * projection, foot - anchorY * projection, 32 * projection, 32 * projection);
    paint.restore();
  }

  return function drawField(state, frameTime) {
    const {x, y} = camera.position(state, state.motion, frameTime);
    let height;
    if (state.ladder && state.motion) {
      const t = Math.max(0, Math.min(1, (frameTime - state.motion.at) / state.motion.duration));
      height = state.ladder.from + (state.ladder.to - state.ladder.from) * t;
    }
    const box=display?.getBoundingClientRect?.();
    const ratio=box?.height>0&&box?.width>0?box.width/box.height:1;
    const wide=ratio>1.35&&!!bufferContext;
    paint=wide?bufferContext:context;
    projectedFoot=null;
    // Match the actual CSS aspect: the displayed canvas will not be clipped
    // by its object-fit rule or stretched into a different pixel aspect.
    if(display&&bufferContext){
      const targetHeight=wide?Math.round(768/ratio):768;
      if(display.width!==768||display.height!==targetHeight){
        display.width=768;display.height=targetHeight;
      }
    }
    paint.clearRect(0, 0, 768, 768);
    paint.fillStyle = '#102635';
    paint.fillRect(0, 0, 768, 768);
    paint.imageSmoothingEnabled = false;
    paint.save();
    paint.translate(0, 32);
    paint.scale(1.2, 1.2);
    landscape.drawQuarter(paint, world.mapData, {
      x, foot: y, height,
      draw: (px, py, z) => drawHero(px, py, z, state.row, state.column),
    }, 1.4, {oceanOutside: true, elevationTerrain: true});
    paint.restore();
    if(wide){
      const crop=fieldViewportCrop(ratio,projectedFoot);
      context.imageSmoothingEnabled=false;
      context.clearRect(0,0,768,display.height);
      context.drawImage(buffer,0,crop.top,768,crop.height,0,0,768,display.height);
      display.dataset.fieldCropTop=String(Math.round(crop.top));
      display.dataset.fieldHeroFoot=String(Math.round(projectedFoot??-1));
    }
  };
}
