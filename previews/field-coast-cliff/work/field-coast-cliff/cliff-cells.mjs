const land = tile => tile !== undefined && !['sea','river','bridge'].includes(tile);
const key = (x,y) => x+','+y;

// The direction names the face as seen from the lower terrain.
const faces = [
  {direction:'s', dx:0, dy:1},
  {direction:'e', dx:1, dy:0},
  {direction:'w', dx:-1, dy:0},
  {direction:'n', dx:0, dy:-1},
];

export function placeCliffCells(map, geography, refreshCollision, world) {
  const reserved = new Set([
    ...geography.roads.flat(),
    ...Object.values(geography.places),
    ...geography.restStops.map(stop => stop.cell),
    ...map.ladders.flatMap(({lower,upper}) => [lower,upper]),
    ...map.decorations.flatMap(object => object.contactTiles),
  ].map(([x,y]) => key(x,y)));
  for (let y=0;y<map.length;y++)for(let x=0;x<map[y].length;x++){
    const direction=map.ramps[y][x];
    if(!direction)continue;
    const {dx,dy}=faces.find(face=>face.direction===direction);
    for(let i=-1;i<=1;i++)reserved.add(key(x+i*dx,y+i*dy));
  }
  // Keep the authored apron in front of the two shrine approach slopes.
  for(let x=39;x<=41;x++)reserved.add(key(x,12));
  for (const k of map.bridgeWaterCells) reserved.add(k);
  for (const k of map.occupiedTiles) reserved.add(k);
  const walls = new Map();
  map.cliffCells = walls;
  const width = map[0].length, height = map.length;
  const reachable = new Set(map.travelReachable);
  const walking = walkingNetwork(world);

  function candidate(x,y,{direction,dx,dy}) {
    const k=key(x,y), ux=x-dx, uy=y-dy;
    const drop=map.heights[uy][ux]-map.heights[y][x];
    if(drop<1||drop>3||reserved.has(k)||walls.has(k)||!land(map[y][x])||map[y][x]==='sand'||
       !land(map[uy][ux])||map.ramps[y][x]||map.ramps[uy][ux]||map.ramps[y+dy][x+dx])return null;
    return {x,y,drop,direction};
  }

  const preserves = (before,after) => [...before].every(k=>walls.has(k)||after.has(k));

  function tryRun(run) {
    if(run.length<2)return;
    for(const wall of run)walls.set(key(wall.x,wall.y),wall);
    if(run.every(({x,y})=>!reachable.has(key(x,y))))return;
    refreshCollision();
    if(preserves(reachable,map.travelReachable)&&preserves(walking,walkingNetwork(world)))return;
    for(const wall of run)walls.delete(key(wall.x,wall.y));
    refreshCollision();
  }

  for(const face of faces){
    // Parallel faces join along their shared edge, never along their depth.
    const horizontal = face.dx===0;
    for(let row=1;row<(horizontal?height:width)-1;row++){
      let run=[];
      for(let along=1;along<(horizontal?width:height)-1;along++){
        const wall = candidate(horizontal?along:row,horizontal?row:along,face);
        if(wall){run.push(wall);continue;}
        tryRun(run);
        run=[];
      }
      tryRun(run);
    }
  }
  refreshCollision();
  return walls;
}

function walkingNetwork(world) {
  const queue=[world.start], seen=new Set([key(...world.start)]);
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];
    for(const [dx,dy] of [[0,-32],[32,0],[0,32],[-32,0]]){
      const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(seen.has(k)||!world.canMove(x,y,nx,ny))continue;
      seen.add(k);
      queue.push([nx,ny]);
    }
  }
  return new Set(queue.map(([x,y])=>key(Math.floor(x/32),Math.floor(y/32))));
}
