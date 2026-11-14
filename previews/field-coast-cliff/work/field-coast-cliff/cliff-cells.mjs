// A south-facing cliff can take the first lower cell where there is room
// for its face and a landing. Its appearance and collision share this list.
const walkableTerrain = new Set(['grass','forest','barren','snow']);
const key = (x,y) => x+','+y;

export function placeCliffCells(map,geography,elevation,refreshCollision) {
  const reachable = new Set(map.travelReachable);
  const reserved = new Set([
    ...geography.roads.flat(),
    ...Object.values(geography.places),
    ...geography.restStops.map(stop=>stop.cell),
    ...map.ladders.flatMap(({lower,upper})=>[lower,upper]),
    ...map.decorations.flatMap(object=>object.contactTiles),
  ].map(([x,y])=>key(x,y)));
  for (const cell of map.bridgeWaterCells) reserved.add(cell);
  const originallyOccupied = new Set(map.occupiedTiles);
  const walls = new Map();
  map.cliffCells = walls;
  const width = map[0].length;

  function protectedCell(x,y) {
    return reserved.has(key(x,y)) || map.ramps[y]?.[x];
  }

  function candidate(x,y) {
    const k=key(x,y);
    const drop=map.heights[y-1][x]-map.heights[y][x];
    if(drop<1||drop>3||!reachable.has(k)||originallyOccupied.has(k)||!walkableTerrain.has(map[y][x])||
       protectedCell(x,y)||map.ramps[y-1][x]||map.ramps[y+1][x]||
       !reachable.has(key(x,y+1))||!walkableTerrain.has(map[y+1][x])||
       !elevation.connected(map,x,y,x,y+1))return null;
    return {x,y,drop};
  }

  // Submit contiguous runs and retain any existing route around them. If a
  // run isolates terrain, omit the whole run instead of leaving holes in it.
  for(let y=1;y<map.length-1;y++){
    const runs=[];
    let run=[];
    for(let x=1;x<width-1;x++){
      const wall=candidate(x,y);
      if(wall){run.push(wall);continue;}
      if(run.length>=2)runs.push(run);
      run=[];
    }
    if(run.length>=2)runs.push(run);
    for(const section of runs){
      for(const wall of section){
        const k=key(wall.x,wall.y);
        walls.set(k,wall);
        map.occupiedTiles.add(k);
      }
      refreshCollision();
      if([...reachable].some(k=>!walls.has(k)&&!map.travelReachable.has(k))){
        for(const wall of section)walls.delete(key(wall.x,wall.y));
        refreshCollision();
      }
    }
  }
  return walls;
}
