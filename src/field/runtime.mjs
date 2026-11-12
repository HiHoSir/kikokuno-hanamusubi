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

export function createFieldRenderer(context, hero) {
  const [anchorX, anchorY] = assets.heroFootAnchorPx;

  function drawHero(px, py, projection, row, column) {
    const z = .56 * projection;
    const foot = py + (14 - 9 * .56) * projection + 9 * z;
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
      px - anchorX * projection, foot - anchorY * projection, 32 * projection, 32 * projection);
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
