// Extend the authored regions between landmarks on the existing 32px grid.
window.YK_FIELD_TERRAIN=(()=>{
 const original=window.YK_FIELD_TERRAIN;
 const cell=original.tileSize;
 const columns=new Map([[22,5],[32,10],[60,9]]);
 const rows=new Map([[24,7],[39,7],[57,10]]);

 function expandAxis(length,inserts){
  const samples=[],coordinates=[];
  for(let i=0;i<length;i++){
   const count=inserts.get(i)||0;
   for(let n=0;n<count;n++)samples.push({before:i-1,after:i,portion:(n+1)/(count+1)});
   coordinates.push(samples.length);
   samples.push({before:i,after:i,portion:0});
  }
  return {samples,coordinates};
 }

 const horizontal=expandAxis(original.width,columns);
 const vertical=expandAxis(original.height,rows);
 const cellAt=([x,y])=>[horizontal.coordinates[x],vertical.coordinates[y]];
 function sample({before,after,portion},cross){
  // Continue irregular banks and woods into the added cells with curved edges.
  // Authored cells resolve to themselves, including every landmark footprint.
  if(before===after)return before;
  const boundary=.5+.20*Math.sin(cross*.31+after*.67)+.10*Math.sin(cross*.73-after);
  return portion<boundary?before:after;
 }
 const sources=vertical.samples.map((row,y)=>horizontal.samples.map((column,x)=>[
  sample(column,y),sample(row,x)
 ]));
 const expand=matrix=>sources.map(row=>row.map(([x,y])=>matrix[y][x]));
 const tiles=expand(original.tiles);
 const heights=expand(original.heights);

 function expandRoute(route){
  const expanded=[cellAt(route[0])];
  for(const point of route.slice(1)){
   let [x,y]=expanded.at(-1);
   const [tx,ty]=cellAt(point);
   while(x!==tx){x+=Math.sign(tx-x);expanded.push([x,y]);}
   while(y!==ty){y+=Math.sign(ty-y);expanded.push([x,y]);}
  }
  return expanded;
 }

 function moveObject(object){
  const [oldX,oldY]=object.contactTiles[0];
  const [newX,newY]=cellAt([oldX,oldY]);
  const dx=(newX-oldX)*cell,dy=(newY-oldY)*cell;
  return {...object,x:object.x+dx,y:object.y+dy,foot:object.foot+dy,
    contactTiles:object.contactTiles.map(cellAt),occupiedTiles:object.occupiedTiles.map(cellAt)};
 }

 const geography=original.referenceComposition;
 const roads=geography.roads.map(expandRoute);
 const decorations=geography.decorations.map(moveObject);
 const originalColumns=new Set(horizontal.coordinates),originalRows=new Set(vertical.coordinates);
 const usedCells=new Set(decorations.flatMap(object=>object.contactTiles.map(point=>point.join(','))));
 const trail=new Set(roads.flatMap(route=>route.flatMap(([x,y])=>
  [[x,y],[x+1,y],[x-1,y],[x,y+1],[x,y-1]].map(point=>point.join(',')))));
 for(let y=1;y<tiles.length-1;y++)for(let x=1;x<tiles[y].length-1;x++){
  if((originalColumns.has(x)&&originalRows.has(y))||tiles[y][x]!=='forest')continue;
  const key=x+','+y;
  if((x*29+y*19+x*y*7)%37>2||usedCells.has(key)||trail.has(key))continue;
  if([tiles[y-1][x],tiles[y+1][x],tiles[y][x-1],tiles[y][x+1]].some(tile=>tile==='sea'||tile==='river'))continue;
  decorations.push({kind:'newTrees',x:x*cell,y:y*cell,width:cell,height:cell,foot:(y+1)*cell,
   contactTiles:[[x,y]],occupiedTiles:[[x,y]],walkThrough:false,biome:'forest'});
 }

 return {...original,width:horizontal.samples.length,height:vertical.samples.length,tiles,heights,
  referenceComposition:{...geography,cellAt,
   places:Object.fromEntries(Object.entries(geography.places).map(([id,point])=>[id,cellAt(point)])),
   restStops:geography.restStops.map(stop=>({...stop,cell:cellAt(stop.cell)})),
   bridgeWaterCells:geography.bridgeWaterCells.map(cellAt),
   watercourses:Object.fromEntries(Object.entries(geography.watercourses).map(([id,points])=>[id,points.map(cellAt)])),
   roads,decorations
  }
 };
})();
