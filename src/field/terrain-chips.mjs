const cell = 32, offset = cell / 2;
const atlasNames = ['coast-mask','coast-sand-0','coast-sand-1','coast-sand-2',
  'coast-sand-3','coast-river','coast-shallow'];
export const isBridgeDeck = o => o.ground&&(o.kind==='bridge'||o.kind==='bridgeNS');
const isWater = t => t === 'sea' || t === 'river' || t === undefined;

export async function loadTerrainChips() {
  return Object.fromEntries(await Promise.all(atlasNames.map(async id => {
    const image = new Image();
    image.src = new URL('../../assets/field/terrain/atlas/'+id+'-32.png',import.meta.url);
    await image.decode();
    if (image.width !== 128 || image.height !== 128) throw Error('Invalid terrain atlas: '+id);
    return [id,image];
  })));
}

function surface(width,height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  return context;
}

function chip(c,image,index,x,y) {
  c.drawImage(image,(index%4)*cell,Math.floor(index/4)*cell,cell,cell,x,y,cell,cell);
}

function mask(samples,predicate) {
  return samples.reduce((bits,item,index)=>predicate(item) ? bits | (1<<index) : bits,0);
}

function cells(map) {
  const bridge = map.bridgeWaterCells || new Set();
  const wetType=(x,y)=>bridge.has(x+','+y)?'river':map[y]?.[x];
  return (x,y)=>{
    const terrain=wetType(x,y);
    return {terrain,dry:!isWater(terrain),level:map.heights?.[y]?.[x]||0};
  };
}

const edgeSamples = (get,x,y) => [get(x,y),get(x+1,y),get(x+1,y+1),get(x,y+1)];

// Placement uses the same offset tiles and alpha as the visible shore.
export function diagonalShoreCells(map, coastMask) {
  const get=cells(map);
  const atlas=surface(128,128);
  atlas.drawImage(coastMask,0,0);
  const rgba=atlas.getImageData(0,0,128,128).data;
  const straight=new Set([0,3,6,9,12,15]);
  const diagonal=new Set();
  function wetAt(x,y,cover) {
    const u=(cover%4)*cell+x,v=Math.floor(cover/4)*cell+y;
    return rgba[(v*128+u)*4+3]===0;
  }
  for(let y=-1;y<map.length;y++)for(let x=-1;x<map[0].length;x++){
    const cover=mask(edgeSamples(get,x,y),s=>s.dry);
    if(straight.has(cover))continue;
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      if(!get(x+dx,y+dy).dry)continue;
      const u=offset*dx,v=offset*dy;
      let wet=false;
      for(let py=v;py<v+offset&&!wet;py++){
        for(let px=u;px<u+offset&&!wet;px++)wet=wetAt(px,py,cover);
      }
      if(wet)diagonal.add([x+dx,y+dy].join());
    }
  }
  // Also check the visual foot, which extends across the lower cell boundary.
  function dryRoots(x,y) {
    const foot=(y+1)*cell,cx=x*cell+offset;
    for(let py=foot-4;py<=foot+2;py++)for(let px=cx-11;px<=cx+11;px++){
      const tx=Math.floor((px-offset)/cell),ty=Math.floor((py-offset)/cell);
      const cover=mask(edgeSamples(get,tx,ty),s=>s.dry);
      if(wetAt(px-(tx*cell+offset),py-(ty*cell+offset),cover))return false;
    }
    return true;
  }
  return {diagonal,dryRoots};
}

export function placeShoreTrees(world, coastMask) {
  const map=world.mapData;
  const {diagonal,dryRoots}=diagonalShoreCells(map,coastMask);
  const occupied=new Set(map.decorations.flatMap(o=>[...o.contactTiles,...o.occupiedTiles].map(c=>c.join())));
  const reserved=new Set();
  for(const [px,py] of [...world.roads.flat(),...Object.values(world.places).map(p=>p.point)]){
    const x=Math.floor(px/cell),y=Math.floor(py/cell);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)reserved.add([x+dx,y+dy].join());
  }
  for(const {lower,upper} of map.ladders||[]){
    reserved.add(lower.join());
    reserved.add(upper.join());
  }
  const moved=[],removed=[];
  map.decorations=map.decorations.flatMap(o=>{
    if(o.kind!=='newTrees'||!diagonal.has(o.contactTiles[0].join()))return [o];
    const [x,y]=o.contactTiles[0];
    // Solid trees leave their old cell open. Relocating only permeable trees
    // guarantees their new placement cannot take away a traversable cell.
    if(o.walkThrough&&o.occupiedTiles.length===0){
      for(let d=1;d<=2;d++)for(let dy=-d;dy<=d;dy++)for(let dx=-d;dx<=d;dx++){
        if(Math.abs(dx)+Math.abs(dy)!==d)continue;
        const nx=x+dx,ny=y+dy,key=[nx,ny].join();
        if(occupied.has(key)||reserved.has(key)||diagonal.has(key))continue;
        if(!['forest','grass'].includes(map[ny]?.[nx])||map.ramps[ny]?.[nx])continue;
        if(map.heights[y][x]!==map.heights[ny][nx]||!dryRoots(nx,ny))continue;
        occupied.add(key);
        moved.push({from:[x,y],to:[nx,ny]});
        return [{...o,x:nx*cell,y:ny*cell,foot:(ny+1)*cell,contactTiles:[[nx,ny]]}];
      }
    }
    removed.push([x,y]);
    return [];
  });
  return {moved,removed};
}

export function composeCoast(map,landscape,art) {
  const width=map[0].length,height=map.length;
  const ground=surface(width*cell,height*cell);
  const get=cells(map);
  // Pull art from the normal renderer first. Fill the crop around water with
  // grass so rounded convex and concave shore pieces can sit across cell edges.
  const paint=map.map((row,y)=>row.map((terrain,x)=>{
    if(isWater(terrain)||terrain==='sand'||!get(x,y).dry)return 'grass';
    return terrain;
  }));
  Object.assign(paint,{decorations:map.decorations.filter(o=>!isBridgeDeck(o)),referencePlacedObjects:map.referencePlacedObjects,
    projectedHeights:true,shoreRelief:false,paths:map.paths,textureOrigin:map.textureOrigin});
  ground.drawImage(landscape.groundLayer(paint),0,0);
  const shoreline=[];
  let waterCells=0;

  // The four samples are the logical cell centres. Draw each 32px tile on the
  // offset grid so a diagonal shore crosses a whole logical tile corner.
  for(let y=-1;y<height;y++)for(let x=-1;x<width;x++){
    const local=edgeSamples(get,x,y);
    const cover=mask(local,s=>s.dry);
    const px=x*cell+offset,py=y*cell+offset;
    if (cover===15) continue;
    shoreline.push({x,y,px,py,cover,local});
    if(cover===0)waterCells++;
  }
  // Cut the coast with one mask composite. This avoids an expensive
  // destination-in layer per cell on browsers and software canvases.
  const coverage=surface(width*cell,height*cell);
  coverage.fillStyle='white';
  coverage.fillRect(0,0,coverage.canvas.width,coverage.canvas.height);
  for(const {px,py,cover} of shoreline){
    coverage.clearRect(px,py,cell,cell);
    if(cover)chip(coverage,art['coast-mask'],cover,px,py);
  }
  ground.globalCompositeOperation='destination-in';
  ground.drawImage(coverage.canvas,0,0);
  ground.globalCompositeOperation='source-over';
  coverage.canvas.width=1;
  coverage.canvas.height=1;
  for(const {x,y,px,py,cover,local} of shoreline){
    if(cover===0)continue;
    const ocean=local.some(s=>s.terrain==='sea'||s.terrain==='sand'||s.terrain===undefined);
    const raised=!local.some(s=>s.terrain==='sand')&&local.some(s=>s.dry&&s.level>0);
    const phase=((x%2+2)%2)+2*((y%2+2)%2);
    chip(ground,art['coast-shallow'],cover,px,py);
    if(!raised)chip(ground,art[ocean?'coast-sand-'+phase:'coast-river'],cover,px,py);
  }

  return {canvas:ground.canvas,coastTiles:shoreline.length-waterCells,waterCells};
}
