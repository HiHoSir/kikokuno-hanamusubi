// The authored 80x80 reference composition is baked into field-terrain.js.
// All object contact/collision coordinates are explicit integer movement cells.
window.YK_WORLD=(()=>{
 const tileSize=32,size=2560,viewSize=640,revision=120;
 const geography=window.YK_FIELD_TERRAIN.referenceComposition;
 const center=([x,y])=>[x*32+16,y*32+16];
 const descriptions={
  village:['鬼灯村','南の半島から林と花の道を抜け、天妖の社へ。'],
  shrine:['天妖の社','西の山裾から川沿いを東へ進み、海の入り江へ。'],
  cove:['海の入り江','川を渡り、北東の忘れの森へ。'],
  forest:['忘れの森','森の北の山裾を辿り、龍神の滝へ。'],
  waterfall:['龍神の滝','山脈の南、湖畔の道を西へ進み月見の湯へ。'],
  hotspring:['月見の湯','北の森から山の参道へ進み、九尾の祠へ。'],
  fox:['九尾の祠','北の山に囲まれた旅路の終点。']
 };
 const places=Object.fromEntries(Object.entries(geography.places).map(([id,cell])=>[id,{point:center(cell),name:descriptions[id][0],note:descriptions[id][1]}]));
 const start=center([37,71]),hub=start;
 // Roads are navigation metadata only. The historical wilderness has no
 // constructed road surface: use existing grass tiles instead.
 const mapData=window.YK_FIELD_TERRAIN.tiles.map(row=>row.map(tile=>tile==='road'?'grass':tile));
 mapData.heights=window.YK_FIELD_TERRAIN.heights?.map(row=>row.slice())||mapData.map(row=>row.map(()=>0));
 mapData.heightTransitions=[];mapData.projectedHeights=true;mapData.shoreRelief=true;
 mapData.fieldObjectCollisionDeferred=false;mapData.referencePlacedObjects=true;
 mapData.bridgeWaterCells=new Set(geography.bridgeWaterCells.map(c=>c.join(',')));
 mapData.decorations=geography.decorations.map(o=>{
  const contactTiles=o.contactTiles.map(c=>c.slice());
  // Entrance footprints are walkable: transition happens only after the hero overlaps them.
  // Preserve collision on every other cell of the same landmark.
  const entrance=o.destination||o.placeId;
  const occupiedTiles=o.occupiedTiles.filter(([x,y])=>!entrance||!contactTiles.some(([cx,cy])=>cx===x&&cy===y)).map(c=>c.slice());
  return {...o,contactTiles,occupiedTiles};
 });
 const roads=geography.roads.map(r=>r.map(center));
 // Keep routes for directions, elevation corridors and save compatibility,
 // but never rasterize the old dirt-road overlay on the outdoor field.
 mapData.paths=[];
 const restStops=geography.restStops.map(o=>({...o,point:center(o.cell)}));
 const guides=[[30,56,'南の地蔵','林の西を通り、天妖の社へ向かうのじゃ。'],[34,46,'川辺の地蔵','東へ川沿いに進むと海の入り江じゃ。'],[56,37,'森の地蔵','北の鳥居が忘れの森の入口じゃ。'],[40,22,'湖畔の地蔵','湖の南を西へ進むと月見の湯じゃ。']].map(([tx,ty,name,tip],id)=>({id,...{x:tx*32+16,y:ty*32+16},name,tip}));
 // Each guide occupies one authored movement cell; its approaches remain open.
 for(const g of guides){const tx=Math.floor(g.x/32),ty=Math.floor(g.y/32);mapData.decorations.push({kind:'jizo',x:tx*32,y:ty*32,width:32,height:32,foot:(ty+1)*32,contactTiles:[[tx,ty]],occupiedTiles:[[tx,ty]],walkThrough:false});}
 window.YK_FIELD_ELEVATION.prepare(mapData,geography);
 // On high terraces, mountain sprites obscure the cliff silhouette.
 // Reuse the existing 32px forest object instead; preserve the original
 // occupied/contact cells so movement and saved positions remain stable.
 // Clear the mountain cluster around field tile (28,35), including
 // its previously converted tree sprites. Keep unrelated objects intact.
 const clearMountainCluster=o=>['newMountainLarge','newMountainSmall'].includes(o.kind)
  &&o.contactTiles.some(([x,y])=>x>=23&&x<=32&&y>=31&&y<=39);
 mapData.decorations=mapData.decorations.filter(o=>!clearMountainCluster(o));
 mapData.decorations=mapData.decorations.flatMap(o=>{
  if(!['newMountainLarge','newMountainSmall'].includes(o.kind))return [o];
  const elevated=o.contactTiles.some(([x,y])=>(mapData.heights[y]?.[x]||0)>=2);
  if(!elevated)return [o];
  return o.contactTiles.map(([x,y])=>({
   kind:'newTrees',x:x*32,y:y*32,width:32,height:32,foot:(y+1)*32,
   contactTiles:[[x,y]],occupiedTiles:o.occupiedTiles.some(([cx,cy])=>cx===x&&cy===y)?[[x,y]]:[],
   walkThrough:o.walkThrough,biome:'forest',supportHeight:mapData.heights[y][x]
  }));
 });
 YK_FIELD_ELEVATION.refreshCollision(mapData);
 const solid=mapData.occupiedTiles;
 const passable=new Set(['grass','forest','sand','snow','barren','road','bridge']);
 const cellOpen=(x,y)=>x>0&&y>0&&x<79&&y<79&&passable.has(mapData[y]?.[x])&&!solid.has(x+','+y)&&mapData.travelReachable.has(x+','+y)&&YK_ELEVATION.pointWalkable(mapData,x*32+16,y*32+16);
 // Data-only save repair: keep valid positions, otherwise find the nearest
 // open cell. Do not teleport all existing saves to a story destination.
 function safePosition(point){
  if(!Array.isArray(point)||!point.every(Number.isFinite))return start.slice();
  const tx=Math.floor(point[0]/32),ty=Math.floor(point[1]/32);
  if(cellOpen(tx,ty))return center([tx,ty]);
  for(let r=1;r<80;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++)
   if(Math.max(Math.abs(dx),Math.abs(dy))===r&&cellOpen(tx+dx,ty+dy))return center([tx+dx,ty+dy]);
  return start.slice();
 }
 function restStopAt(x,y){
  const tx=Math.floor(x/32),ty=Math.floor(y/32);
  const object=mapData.decorations.find(o=>o.restStop&&o.contactTiles.some(([cx,cy])=>cx===tx&&cy===ty));
  return restStops.find(s=>s.id===object?.restStop)||null;
 }
 function guideRoute(from,target){
  const nodes=new Map(),key=(x,y)=>x+','+y;
  for(const road of roads)for(const p of road)nodes.set(key(...p),p);
  if(!nodes.size)return '地図で道を確かめるのじゃ。';
  const nearest=p=>[...nodes.keys()].sort((a,b)=>Math.hypot(nodes.get(a)[0]-p[0],nodes.get(a)[1]-p[1])-Math.hypot(nodes.get(b)[0]-p[0],nodes.get(b)[1]-p[1]))[0];
  const fromKey=nearest(from),toKey=nearest(target),queue=[fromKey],prev=new Map([[fromKey,null]]);
  for(let i=0;i<queue.length&&!prev.has(toKey);i++){const [x,y]=nodes.get(queue[i]);for(const [dx,dy] of [[32,0],[-32,0],[0,32],[0,-32]]){const k=key(x+dx,y+dy);if(nodes.has(k)&&!prev.has(k)&&YK_ELEVATION.canMove(mapData,x,y,x+dx,y+dy)){prev.set(k,queue[i]);queue.push(k);}}}
  if(!prev.has(toKey))return '地図で道と橋の位置を確かめるのじゃ。';
  const path=[];for(let k=toKey;k;k=prev.get(k))path.unshift(nodes.get(k));const turns=[];
  for(let i=1;i<path.length;i++){const [x,y]=path[i],[px,py]=path[i-1],d=x>px?'東':x<px?'西':y>py?'南':'北';if(turns.at(-1)!==d)turns.push(d);}
  return turns.length?'そばの道に出たら、まず'+turns.slice(0,3).join('、次の曲がり角で')+'へ進むのじゃ。':'入口はこの近くじゃ。Aを押すのじゃ。';
 }
 const walkable=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&window.YK_LANDSCAPE.walkable(mapData,x,y)&&YK_ELEVATION.pointWalkable(mapData,x,y);
 const canMove=(x,y,nx,ny)=>YK_ELEVATION.canMove(mapData,x,y,nx,ny)&&walkable(nx,ny);
 const tileAt=(x,y)=>mapData[Math.floor(y/32)]?.[Math.floor(x/32)]||'sea';
 const near=(x,y)=>Object.keys(places).find(k=>Math.hypot(x-places[k].point[0],y-places[k].point[1])<=36)||null;
 const camera=(x,y)=>({x:x-viewSize/2,y:y-viewSize/2,size:viewSize,zoom:1.4});
 const draw=c=>window.YK_LANDSCAPE.draw(c,mapData);
 const worldObjects=Object.entries(places).map(([id,p])=>({id,destination:id,x:p.point[0],y:p.point[1],name:p.name}));
 const legacy={village:[211,565],shrine:[194,366],cove:[467,610],forest:[661,405],waterfall:[637,191],hotspring:[431,214],fox:[171,111]};
 function migratePosition(point){
  if(!Array.isArray(point)||!point.every(Number.isFinite))return start.slice();
  const id=Object.keys(legacy).sort((a,b)=>Math.hypot(point[0]-legacy[a][0],point[1]-legacy[a][1])-Math.hypot(point[0]-legacy[b][0],point[1]-legacy[b][1]))[0];
  return places[id].point.slice();
 }
 return {start,hub,places,roads,restStops,restStopAt,guides,guideRoute,worldObjects,mapData,walkable,canMove,near,revision,tileAt,tileSize,size,viewSize,camera,draw,migratePosition,safePosition};
})();




