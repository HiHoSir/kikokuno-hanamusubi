const cell = 32, offset = cell / 2;
const atlasNames = ['coast-mask','coast-sand-0','coast-sand-1','coast-sand-2',
  'coast-sand-3','coast-river','coast-rock','coast-shallow','cliff-1','cliff-2','cliff-3',
  'cliff-forest-1','cliff-forest-2','cliff-forest-3'];
const isWater = t => t === 'sea' || t === 'river' || t === undefined;

export async function loadTerrainChips() {
  return Object.fromEntries(await Promise.all(atlasNames.map(async id => {
    const image = new Image();
    image.src = new URL('./atlas/'+id+'-32.png',import.meta.url);
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
    const terrain=wetType(x,y), ramp=map.ramps?.[y]?.[x];
    return {terrain,dry:!isWater(terrain),ramp,level:map.heights?.[y]?.[x]||0};
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

// The upper trail's west bluff needs a turf shelf under its existing tree.
// Keep the object's cell and anchor, and carry the rock band around the shelf
// in adjoining tiles. Coordinates below are local to the southwest join.
function fitTrailCliffJoin(ground, map) {
  const tree = map.decorations?.find(o=>o.kind==='newTrees'&&
    o.contactTiles?.some(([x,y])=>x===38&&y===9));
  if(!tree||map.heights?.[9]?.[38]!==2||map.heights?.[10]?.[38]!==0||
     map.ramps?.[10]?.[39]!=='n')return;

  const x=37*cell,y=9*cell,width=2*cell,height=2*cell;
  const patch=surface(width,height);
  patch.drawImage(ground.canvas,x,y,width,height,0,0,width,height);
  for(let u=0;u<width;u++){
    // Full shelf across the tree's roots, tapered to the unchanged contour
    // at both ends. Keep the original upstream corner and bottom edge.
    const center=1.5*cell;
    const span=u<center?24:16;
    const t=Math.max(0,Math.min(1,(span-Math.abs(u-center))/7));
    const shift=Math.round(20*t*t*(3-2*t));
    if(!shift)continue;
    const upperLand=16;
    const shelf=upperLand+shift;
    ground.drawImage(patch.canvas,u,0,1,upperLand,x+u,y,1,shelf);
    ground.drawImage(patch.canvas,u,upperLand,1,height-upperLand,x+u,y+shelf,1,height-shelf);
  }
}

const rockProps = new Set(['newTrees','newMountainLarge','newMountainSmall']);

// Resolve the actual atlas coverage under roots, using the same tile
// placements as the map. No dependency on the colors in the base terrain.
function cliffContacts(map, paintedCliffs, art) {
  const alpha = new Map();
  const sprite = surface(128,128);
  function rockAt(x,y) {
    const tx=Math.floor((x-offset)/cell),ty=Math.floor((y-offset)/cell);
    const list=paintedCliffs.get(tx+','+ty);
    if(!list)return false;
    for(const [id,index] of list){
      if(!alpha.has(id)){
        sprite.clearRect(0,0,128,128);
        sprite.drawImage(art[id],0,0);
        alpha.set(id,sprite.getImageData(0,0,128,128).data);
      }
      const u=(index%4)*cell+x-(tx*cell+offset);
      const v=Math.floor(index/4)*cell+y-(ty*cell+offset);
      if(alpha.get(id)[(v*128+u)*4+3]===255)return true;
    }
    return false;
  }
  const ladders = new Set((map.ladders||[]).flatMap(({lower,upper})=>[lower.join(),upper.join()]));
  const shelves = new Map();

  for(const o of map.decorations||[]){
    if(!rockProps.has(o.kind))continue;
    for(const [x,y] of o.contactTiles||[]){
      const foot=(y+1)*cell;
      if(o.foot!==foot||isWater(map[y]?.[x])||map.ramps?.[y]?.[x]||map.ramps?.[y+1]?.[x])continue;
      if(ladders.has([x,y].join())||ladders.has([x,y+1].join()))continue;
      if(!(map.heights?.[y]?.[x]>map.heights?.[y+1]?.[x]))continue;
      if(x===38&&y===9&&map.ramps?.[10]?.[39]==='n')continue;
      const cx=x*cell+offset;
      let overlap=0;
      for(let v=foot-4;v<=foot+2;v++)for(let u=cx-10;u<cx+10;u++)overlap+=rockAt(u,v);
      if(overlap<=32)continue;
      if(!shelves.has(y))shelves.set(y,new Map());
      shelves.get(y).set(x,{x,y,overlap,kind:o.kind});
    }
  }
  return {shelves,rockAt};
}

function fitCliffContacts(ground, map, paintedCliffs, art, cliffMask){
  const {shelves,rockAt}=cliffContacts(map,paintedCliffs,art);
  const adjusted=[];
  const patches=[];
  for(const [row,contacts] of shelves){
    // Combine contiguous contacts before feathering so a row of trees shares
    // a single shelf and the face has no scallops between neighboring trunks.
    const columns=[...contacts.keys()].sort((a,b)=>a-b);
    for(let i=0;i<columns.length;){
      const first=columns[i];
      let last=first;
      while(i<columns.length&&columns[i]<=last+1)last=columns[i++];
      const left=Math.max(0,first*cell-4);
      const right=Math.min(ground.canvas.width,(last+1)*cell+4);
      const top=row*cell+7;
      const height=42;
      const source=surface(right-left,height);
      source.drawImage(ground.canvas,left,top,right-left,height,0,0,right-left,height);
      const sourceMask=cliffMask&&surface(right-left,height);
      sourceMask?.drawImage(cliffMask.canvas,left,top,right-left,height,0,0,right-left,height);
      patches.push({row,left,right,top,height,first,last,source,sourceMask});
      for(let x=first;x<=last;x++)adjusted.push(contacts.get(x));
    }
  }
  // Snapshot all strips before edits and work from the lower edge upward.
  patches.sort((a,b)=>b.top-a.top);
  for(const p of patches){
    const {left,right,top,height,first,last}=p;
    const foot=(p.row+1)*cell;
    for(let x=left;x<right;x++){
      const distance=Math.min(x-(first*cell-4),(last+1)*cell+3-x);
      const t=Math.max(0,Math.min(1,distance/10));
      // Find the original upper edge of the rock band at this column.
      // Set it just beyond the roots and retain the bottom of the patch.
      let edge=foot;
      while(edge>top&&rockAt(x,edge-1))edge--;
      if(edge<=top+2||edge>=foot)continue;
      const shift=Math.round((foot+3-edge)*t*t*(3-2*t));
      if(!shift)continue;
      const upperLand=edge-top;
      const shelf=upperLand+shift;
      for(const [target,source] of [[ground,p.source],[cliffMask,p.sourceMask]]){
        if(!target)continue;
        target.clearRect(x,top,1,height);
        target.drawImage(source.canvas,x-left,0,1,upperLand,x,top,1,shelf);
        target.drawImage(source.canvas,x-left,upperLand,1,height-upperLand,x,top+shelf,1,height-shelf);
      }
    }
  }
  return {adjusted};
}

export function composeTerrainChips(map,landscape,art,cliffMask) {
  const started=performance.now();
  const width=map[0].length,height=map.length;
  const ground=surface(width*cell,height*cell);
  const get=cells(map);
  // Pull art from the normal renderer first. Fill the crop around water with
  // grass so rounded convex and concave shore pieces can sit across cell edges.
  const paint=map.map((row,y)=>row.map((terrain,x)=>{
    if(isWater(terrain)||terrain==='sand'||!get(x,y).dry)return 'grass';
    return terrain;
  }));
  Object.assign(paint,{decorations:map.decorations,referencePlacedObjects:map.referencePlacedObjects,
    projectedHeights:true,shoreRelief:false,paths:map.paths,textureOrigin:map.textureOrigin});
  ground.drawImage(landscape.groundLayer(paint),0,0);
  const shoreline=[];
  let waterCells=0,cliffTiles=0,forestCliffTiles=0;
  const paintedCliffs=new Map();
  const forestCells=new Set(map.decorations.filter(o=>o.kind==='newTrees'||o.kind==='sacredTree')
    .flatMap(o=>o.contactTiles.map(c=>c.join())));
  const ladderCells=new Set((map.ladders||[]).flatMap(({lower,upper})=>[lower.join(),upper.join()]));

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
  for(let y=-1;y<height;y++)for(let x=-1;x<width;x++){
    const local=edgeSamples(get,x,y);
    const minimum=Math.min(...local.map(s=>s.level));
    const maximum=Math.min(3,Math.max(...local.map(s=>s.level)));
    const count=mask(local,s=>s.dry);
    if(maximum<=minimum||count===0)continue;
    const px=x*cell+offset,py=y*cell+offset;
    const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
    const forestEdge=count===15&&corners.some((pos,i)=>
      forestCells.has(pos.join())||local[i].terrain==='forest')&&
      corners.every((pos,i)=>!local[i].ramp&&!ladderCells.has(pos.join()));
    let previousCover=0,drop=0;
    const place=()=>{
      if(!previousCover||previousCover===15||!drop)return;
      const id=(forestEdge?'cliff-forest-':'cliff-')+drop;
      chip(ground,art[id],previousCover,px,py);
      if(cliffMask)chip(cliffMask,art[id],previousCover,px,py);
      if(forestEdge)forestCliffTiles++;
      const key=x+','+y;
      if(!paintedCliffs.has(key))paintedCliffs.set(key,[]);
      paintedCliffs.get(key).push([id,previousCover]);
      cliffTiles++;
    };
    for(let level=minimum+1;level<=maximum;level++){
      // An authored slope blends into its upper side. Keep rock out of
      // the direction of travel across its upper and lower connections.
      const cover=mask(local,(s)=>{
        if(s.level>=level)return s.dry;
        if(!s.ramp||!s.dry||s.level+1!==level)return false;
        const index=local.indexOf(s);
        return (s.ramp==='n'&&index>=2)||(s.ramp==='s'&&index<2)||
          (s.ramp==='e'&&(index===0||index===3))||(s.ramp==='w'&&(index===1||index===2));
      });
      if(cover===previousCover){drop++;continue;}
      place();
      previousCover=cover;
      drop=1;
    }
    place();
  }
  const contacts=fitCliffContacts(ground,map,paintedCliffs,art,cliffMask);
  fitTrailCliffJoin(ground,map);
  if(cliffMask)fitTrailCliffJoin(cliffMask,map);
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
    if(raised)chip(ground,art['coast-rock'],cover,px,py);
    else chip(ground,art[ocean?'coast-sand-'+phase:'coast-river'],cover,px,py);
  }

  for(const ladder of map.ladders||[]){
    const [x,y]=ladder.lower;
    landscape.drawAsset(ground,'ladder',x*cell+8,y*cell-18,16,29);
  }
  return {canvas:ground.canvas,coastTiles:shoreline.length-waterCells,cliffTiles,forestCliffTiles,waterCells,
    buildMs:performance.now()-started,...contacts};
}
