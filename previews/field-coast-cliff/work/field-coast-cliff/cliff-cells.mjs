const cell = 32;
const key = (x,y) => x+','+y;

export function prepareCliffCells(world,geography,landscape,art,compose,refreshCollision) {
  const map = world.mapData;
  const mask = document.createElement('canvas');
  mask.width = map[0].length*cell;
  mask.height = map.length*cell;
  const cliffs = mask.getContext('2d',{willReadFrequently:true});
  const baked = compose(map,landscape,art,cliffs);
  const ground = baked.canvas.getContext('2d');
  const walls = placeCliffCells(map,geography,refreshCollision,world,(x,y)=>{
    const px=x*cell, py=y*cell;
    const edge=cliffs.getImageData(px,py-1,cell,cell+1).data;
    const land=ground.getImageData(px,py,cell,cell).data;
    const toes=[];
    for(let u=0;u<cell;u++){
      if(!edge[u*4+3])return null;
      let v=0;
      while(v<cell&&edge[((v+1)*cell+u)*4+3])v++;
      if(v>18)return null;
      for(let row=0;row<cell;row++)if(land[(row*cell+u)*4+3]!==255)return null;
      // Keep separate lower bands and their silhouettes intact.
      for(let row=v+1;row<cell;row++)if(edge[((row+1)*cell+u)*4+3])return null;
      toes.push(v);
    }
    return toes;
  });
  ground.imageSmoothingEnabled=false;
  for(const {x,y,drop,toes} of walls.values()){
    const previous=walls.has(key(x-1,y));
    const next=walls.has(key(x+1,y));
    const sourceX=(Number(previous)+2*Number(next))*cell;
    for(let u=0;u<cell;u++){
      const start=toes[u];
      ground.drawImage(art['cliff-cell'],sourceX+u,(drop-1)*cell+start,1,cell-start,
        x*cell+u,y*cell+start,1,cell-start);
    }
  }
  mask.width=1;
  mask.height=1;
  return {...baked,cliffCells:walls.size};
}

function placeCliffCells(map,geography,refreshCollision,world,contact) {
  const reserved = new Set([
    ...geography.roads.flat(),...Object.values(geography.places),
    ...geography.restStops.map(stop=>stop.cell),
    ...map.ladders.flatMap(({lower,upper})=>[lower,upper]),
    ...map.decorations.flatMap(object=>object.contactTiles),
  ].map(([x,y])=>key(x,y)));
  const before = new Set(map.travelReachable);
  const walls = new Map();
  map.cliffCells=walls;

  function candidate(x,y) {
    const dry = t => t && !['sea','river','bridge','sand'].includes(t);
    const drop=map.heights[y-1][x]-map.heights[y][x];
    if(drop<1||drop>3||!dry(map[y][x])||!dry(map[y-1][x])||
       reserved.has(key(x,y))||map.bridgeWaterCells.has(key(x,y))||
       map.occupiedTiles.has(key(x,y))||[y-1,y,y+1].some(row=>map.ramps[row][x]))return null;
    const toes=contact(x,y);
    return toes&&{x,y,drop,toes,direction:'s'};
  }

  const walking=walkingNetwork(world);
  function tryRun(run) {
    if(run.length<2)return;
    for(const wall of run)walls.set(key(wall.x,wall.y),wall);
    refreshCollision();
    const reachable=walkingNetwork(world);
    if([...before].every(k=>walls.has(k)||map.travelReachable.has(k))&&
       [...walking].every(k=>walls.has(k)||reachable.has(k)))return;
    for(const wall of run)walls.delete(key(wall.x,wall.y));
    refreshCollision();
  }
  for(let y=1;y<map.length-1;y++){
    let run=[];
    for(let x=1;x<map[0].length-1;x++){
      const wall=candidate(x,y);
      if(wall){run.push(wall);continue;}
      tryRun(run);
      run=[];
    }
    tryRun(run);
  }
  return walls;
}

function walkingNetwork(world) {
  const queue=[world.start], seen=new Set([key(...world.start)]);
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];
    for(const [dx,dy] of [[0,-cell],[cell,0],[0,cell],[-cell,0]]){
      const nx=x+dx,ny=y+dy,k=key(nx,ny);
      if(seen.has(k)||!world.canMove(x,y,nx,ny))continue;
      seen.add(k);
      queue.push([nx,ny]);
    }
  }
  return new Set(queue.map(([x,y])=>key(Math.floor(x/cell),Math.floor(y/cell))));
}
