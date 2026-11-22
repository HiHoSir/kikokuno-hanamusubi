// Authored village pace, in world pixels per second. The 14px step cycle
// in residents.mjs follows actual movement distance rather than clock time.
export const HIZUKI_WALK_SPEED = 288;
// Interiors retain their previously approved pace; this request adjusts the village only.
export const HIZUKI_INTERIOR_WALK_SPEED = 176;

// When exiting a building, the hero should face the camera (south, row 0).
// Other arrivals, including saved-game restores, keep their previous facing.
export function villageArrivalFacing(focus,entrances,restoreFace=1){
  return entrances.some(marker=>marker.id===focus) ? 0 : restoreFace;
}

export function touchedEntrance(markers,x,y,nx,ny,radius) {
  if(ny>=y || x!==nx) return;
  return markers.find(({entrance:[left,top,width,height]})=>
    nx>=left && nx<left+width && y>=top+height && ny>=top && ny-radius<=top+height);
}

export function makeWalk(width, height, blocked, radius) {
  const samples = [];
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x*x + y*y <= radius*radius) samples.push([x,y]);
    }
  }

  const inside=(x,y)=>x>=0&&x<width&&y>=0&&y<height;

  function clearFootprint(x,y,allowMapEdge) {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix-radius>=0&&iy-radius>=0&&ix+radius<width&&iy+radius<height)
      return samples.every(([dx,dy])=>!blocked[(iy+dy)*width+ix+dx]);
    return allowMapEdge&&samples.every(([dx,dy])=>
      !inside(ix+dx,iy+dy)||!blocked[(iy+dy)*width+ix+dx]);
  }

  function canStand(x,y,allowMapEdge=false) {
    return inside(x,y)&&clearFootprint(x,y,allowMapEdge);
  }

  function move(x,y,dx,dy,occupied,allowMapExit=false) {
    const steps = Math.max(1,Math.ceil(Math.hypot(dx,dy)));
    const sx = dx/steps, sy = dy/steps;
    for (let i=0; i<steps; i++) {
      const nx=x+sx,ny=y+sy;
      if (!clearFootprint(nx,ny,allowMapExit)||occupied?.(nx,ny)) break;
      if (allowMapExit&&!inside(nx,ny)) return [x,y,true];
      x=nx;
      y=ny;
    }
    return [x,y];
  }

  return {canStand, move};
}
