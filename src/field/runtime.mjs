const {YK_WORLD: world, YK_LANDSCAPE: landscape, YK_AUTOTILE: autotile,
  YK_ELEVATION: elevation, YK_CAMERA: camera, YK_MOVEMENT: movement,
  YK_AREA_TRANSITIONS: transitions, YK_FIELD_ASSETS: assets} = window;

export {world};
export const contact = (x, y) => transitions.contact(world, x, y);

export function villageArrival() {
  const queue = [world.places.village.point];
  const seen = new Set(queue.map(point => point.join(',')));
  for (const [x, y] of queue) {
    if (contact(x, y) !== 'village' && world.walkable(x, y)) return [x, y];
    for (const [dx, dy] of [[0, 32], [32, 0], [-32, 0], [0, -32]]) {
      const next = [x + dx, y + dy];
      const key = next.join(',');
      if (!seen.has(key) && world.canMove(x, y, ...next)) {
        seen.add(key);
        queue.push(next);
      }
    }
  }
  throw new Error('鬼灯村からフィールドに戻れるセルがありません');
}

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

export function createFieldRenderer(context, hero) {
  const boundsCanvas = document.createElement('canvas');
  boundsCanvas.width = boundsCanvas.height = 32;
  const boundsContext = boundsCanvas.getContext('2d', {willReadFrequently: true});
  // Source game.js uses the neutral frame's opaque bounds for every step in that direction.
  const bounds = Array.from({length: 4}, (_, row) => {
    boundsContext.clearRect(0, 0, 32, 32);
    boundsContext.drawImage(hero, 0, row * 32, 32, 32, 0, 0, 32, 32);
    const {data} = boundsContext.getImageData(0, 0, 32, 32);
    let left = 32, right = -1, top = 32, bottom = -1;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (data[(y * 32 + x) * 4 + 3] < 32) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
    return {left, width: right - left + 1, bottom, height: bottom - top + 1};
  });

  function drawHero(px, py, projection, row, column) {
    const neutral = bounds[row];
    const z = .56 * projection;
    const foot = py + (14 - 9 * .56) * projection + 9 * z;
    const scale = (28 / neutral.height) * (z / .56);
    context.save();
    context.imageSmoothingEnabled = false;
    context.save();
    context.globalAlpha = .28;
    context.fillStyle = '#101820';
    context.beginPath();
    context.ellipse(px, foot, 20 * z, 6 * z, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.drawImage(hero, column * 32, row * 32, 32, 32,
      px - (neutral.left + neutral.width / 2) * scale, foot - (neutral.bottom + 1) * scale, 32 * scale, 32 * scale);
    context.restore();
  }

  return function drawField(state, frameTime) {
    const {x, y} = camera.position(state, state.motion, frameTime);
    let height;
    if (state.ladder && state.motion) {
      const t = Math.max(0, Math.min(1, (frameTime - state.motion.at) / state.motion.duration));
      height = state.ladder.from + (state.ladder.to - state.ladder.from) * t;
    }
    context.clearRect(0, 0, 768, 768);
    context.fillStyle = '#102635';
    context.fillRect(0, 0, 768, 768);
    context.imageSmoothingEnabled = false;
    context.save();
    context.translate(0, 32);
    context.scale(1.2, 1.2);
    landscape.drawQuarter(context, world.mapData, {
      x, foot: y, height,
      draw: (px, py, z) => drawHero(px, py, z, state.row, state.column),
    }, 1.4, {oceanOutside: true, elevationTerrain: true});
    context.restore();
  };
}
