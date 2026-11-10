export function makeWalk(width, height, blocked, radius) {
  const samples = [];
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x*x + y*y <= radius*radius) samples.push([x,y]);
    }
  }

  function canStand(x,y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix-radius < 0 || iy-radius < 0 || ix+radius >= width || iy+radius >= height) return false;
    return samples.every(([dx,dy]) => !blocked[(iy+dy)*width+ix+dx]);
  }

  function move(x,y,dx,dy) {
    const steps = Math.max(1,Math.ceil(Math.hypot(dx,dy)));
    const sx = dx/steps, sy = dy/steps;
    for (let i=0; i<steps; i++) {
      if (!canStand(x+sx,y+sy)) break;
      x += sx;
      y += sy;
    }
    return [x,y];
  }

  return {canStand, move};
}
