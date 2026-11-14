// Authored-world adapter. Materials/objects remain unchanged; topology is explicit.
window.YK_FIELD_ELEVATION=(()=>{
 const E=window.YK_ELEVATION;
 function prepare(m,geography){
  m.ramps=m.map(r=>r.map(()=>null));m.cornerCut=30;m.elevationEnabled=true;m.elevationRise=20;
  m.occupiedTiles=new Set(m.decorations.flatMap(o=>o.occupiedTiles.map(c=>c.join(','))));
  const water=t=>['sea','river'].includes(t),set=(x,y,h)=>{if(m[y]?.[x]&&!water(m[y][x]))m.heights[y][x]=h;};
  // Remove isolated one-cell spikes from the old editor heights before
  // joining the travel network. Keep large authored terrace/mountain regions.
  for(let pass=0;pass<2;pass++){
   const old=m.heights;
   m.heights=old.map((row,y)=>row.map((h,x)=>{
    if(water(m[y][x]))return 0;const values=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(m[y+dy]?.[x+dx]&&!water(m[y+dy][x+dx]))values.push(old[y+dy][x+dx]);
    return values.sort((a,b)=>a-b)[Math.floor(values.length/2)]??h;
   }));
  }
  // Keep authored mountain/terrace heights away from the existing travel network.
  // Reserve level corridors including approaches and bridge banks; never change tiles.
  const protectedCells=new Set();
  function corridor(x,y,r=1){for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){set(x+dx,y+dy,0);protectedCells.add((x+dx)+','+(y+dy));}}
  for(const route of geography.roads)for(const [x,y] of route)corridor(x,y);
  for(const cell of Object.values(geography.places))corridor(...cell,2);
  for(const stop of geography.restStops)corridor(...stop.cell,2);
  for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++)if(water(m[y][x]))m.heights[y][x]=0;
  // Keep the authored raised destinations, but retire every legacy ramp.
  const terraces=[{x:40,from:3,to:7,h:2},{x:40,from:9,to:9,h:1},{x:67,from:18,to:20,h:1}];
  for(const t of terraces)for(let y=t.from;y<=t.to;y++)for(let x=t.x-1;x<=t.x+1;x++)set(x,y,t.h);
  // Final shrine approach: retain the deliberate two-stage north-facing slope.
  // (40,8) is the final upper approach, so it is intentionally NOT a ladder.
  // The lower ramp at (40,10) joins ground 0→1; (40,8) joins 1→2.
  for(const [cy,base] of [[10,0],[8,1]])for(let x=39;x<=41;x++){
   set(x,cy,base);
   if(m[cy]?.[x]&&!water(m[cy][x]))m.ramps[cy][x]='n';
  }
  // Foundations are authored contact cells, never sprite bounds. Equalize a
  // multi-cell foundation; route reservations win except explicit raised entries.
  for(const o of m.decorations){
   const cells=o.contactTiles||[],valid=cells.filter(([x,y])=>m[y]?.[x]&&!water(m[y][x]));
   if(!valid.length||o.ground)continue;
   const raisedEntry=['fox','waterfall'].includes(o.destination),nearRoute=valid.some(([x,y])=>protectedCells.has(x+','+y));
   const h=raisedEntry?(o.destination==='fox'?2:1):nearRoute?0:Math.min(...valid.map(([x,y])=>m.heights[y][x]));
   for(const [x,y] of valid){set(x,y,h);m.ramps[y][x]=null;}
   o.supportHeight=h;
  }
  // Simplify the former mountain cluster at field (28,35) to one terrace
  // level. Retain lowland corridors, water, ramps and authored materials.
  // No level-2/3 stacks remain inside this local footprint.
  for(let y=31;y<=39;y++)for(let x=23;x<=32;x++){
   if(!water(m[y]?.[x])&&m.heights[y][x]>1)m.heights[y][x]=1;
  }
  // The localized highland simplification may lower an existing object's
  // single-level foundation after supportHeight was first assigned.
  // Refresh metadata only for actually flat foundations; never force terrain
  // heights to a stale object height or hide a mixed-height footprint.
  for(const o of m.decorations){
   if(o.ground||o.supportHeight==null)continue;
   const levels=(o.contactTiles||[]).filter(([x,y])=>m[y]?.[x]&&!water(m[y][x])).map(([x,y])=>m.heights[y][x]);
   if(levels.length&&levels.every(h=>h===levels[0]))o.supportHeight=levels[0];
  }
  m.cornerProtected=new Set(m.decorations.flatMap(o=>(o.contactTiles||[]).map(c=>c.join(','))));
  // Build connections from the player's reachable land, one inaccessible
  // elevated component at a time. Prefer south-facing cliff ladders.
  // Only if no safe south-facing edge exists, form a validated ramp instead.
  E.prepare(m);
  m.ladders=[];
  const dirs=[[0,-1,'n'],[0,1,'s'],[-1,0,'w'],[1,0,'e']];
  const key=(x,y)=>x+','+y,center=(x,y)=>[x*32+16,y*32+16];
  const pass=(x,y)=>E.walkable(m,x,y)&&E.pointWalkable(m,...center(x,y));
  const flood=()=>reachable(m);
  // Classify the whole upper landmass by height and land geometry only.
  // Forest and other props may block walking but must NEVER split a plateau.
  // This is independent of the strict collision checks used for entrances.
  const land=(x,y)=>E.inside(m,x,y)&&!water(m[y][x]);
  const plateauIds=new Map(),plateauCells=new Map();
  let nextPlateauId=0;
  for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++){
   const origin=key(x,y);
   if(!land(x,y)||plateauIds.has(origin))continue;
   const id=nextPlateauId++,height=m.heights[y][x],cells=[],queue=[[x,y]];
   plateauIds.set(origin,id);
   for(let i=0;i<queue.length;i++){const [cx,cy]=queue[i];cells.push(key(cx,cy));
    for(const [dx,dy] of dirs){
     const nx=cx+dx,ny=cy+dy,k=key(nx,ny);
     if(!land(nx,ny)||plateauIds.has(k)||m.heights[ny][nx]!==height)continue;
     plateauIds.set(k,id);queue.push([nx,ny]);
    }
   }
   plateauCells.set(id,cells);
  }
  const reserved=new Set();
  // Restrict automatic construction to actual unreachable higher ground.
  // Multiple levels may need more than one connector.
  for(let iteration=0;iteration<400;iteration++){
   const reachable=flood(),ladderCandidates=[],rampCandidates=[];
   for(const entry of reachable){
    const [x,y]=entry.split(',').map(Number);
    if(!pass(x,y))continue;
    for(const [dx,dy,dir] of dirs){
     const nx=x+dx,ny=y+dy,nkey=key(nx,ny);
     if(reachable.has(nkey)||!pass(nx,ny)||reserved.has(nkey))continue;
     if(E.level(m,nx,ny)!==E.level(m,x,y)+1)continue;
     if(m.ramps[y]?.[x]||m.ramps[ny]?.[nx])continue;
     if(dy===-1&&!E.outline(m,x,y).cuts.length&&!E.outline(m,nx,ny).cuts.length){
      ladderCandidates.push({x,y,nx,ny});
     }
     // A ramp occupies a lower-level tile. Its opposite neighbor must remain
     // at the same lower level, and both endpoints must be unobstructed.
     const bx=x-dx,by=y-dy;
     if(!pass(bx,by)||!reachable.has(key(bx,by)))continue;
     if(E.level(m,bx,by)!==E.level(m,x,y))continue;
     if(protectedCells.has(key(x,y))||m.cornerProtected.has(key(x,y)))continue;
     rampCandidates.push({x,y,nx,ny,bx,by,dir});
    }
   }
   const before=reachable.size;
   let installed=false;
   for(const c of ladderCandidates){
    m.ladders.push({lower:[c.x,c.y],upper:[c.nx,c.ny]});
    E.prepare(m);
    if(flood().size>before){
     installed=true;
     // Reserve the WHOLE upper plateau, preventing another ladder to the
     // same contiguous destination from being chosen in a later iteration.
     for(const tile of plateauCells.get(plateauIds.get(key(c.nx,c.ny)))||[])reserved.add(tile);
     break;
    }
    m.ladders.pop();
   }
   if(!installed)for(const c of rampCandidates){
    const old=m.ramps[c.y][c.x];
    m.ramps[c.y][c.x]=c.dir;
    E.prepare(m);
    if(E.canMove(m,...center(c.bx,c.by),...center(c.x,c.y))&&
       E.canMove(m,...center(c.x,c.y),...center(c.nx,c.ny))&&flood().size>before){
     installed=true;reserved.add(key(c.nx,c.ny));break;
    }
    m.ramps[c.y][c.x]=old;E.prepare(m);
   }
   if(!installed)break;
  }
  E.prepare(m);
  m.travelReachable=flood();
  return m;
 }
 // Rebuild derived data after the final object replacement/removal pass.
 // Never keep contact cells from sprites that no longer exist.
 function reachable(m){
  const queue=[[37,71]],seen=new Set(['37,71']);
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of Object.values(E.dirs)){
   const nx=x+dx,ny=y+dy,k=nx+','+ny;
   if(!seen.has(k)&&E.canMove(m,x*32+16,y*32+16,nx*32+16,ny*32+16)){seen.add(k);queue.push([nx,ny]);}
  }}return seen;
 }
 function refreshCollision(m){
  m.occupiedTiles=new Set(m.decorations.flatMap(o=>o.occupiedTiles.map(c=>c.join(','))));
  m.travelReachable=reachable(m);return m;
 }
 return {prepare,refreshCollision};
})();
