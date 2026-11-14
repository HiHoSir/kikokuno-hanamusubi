// Use low trees on the downhill edge, keeping each object's footprint.
export function cliffUnderstoryTrees(map,objects){
 const isLand=(x,y)=>map[y]?.[x]&&!['sea','river','bridge'].includes(map[y][x])&&
  !map.bridgeWaterCells?.has(x+','+y);
 return new Set(objects.filter(tree=>tree.kind==='newTrees'&&tree.contactTiles?.some(([x,y])=>
  isLand(x,y)&&!map.ramps[y]?.[x]&&[-1,0,1].some(dx=>
   isLand(x+dx,y-1)&&!map.ramps[y-1]?.[x+dx]&&map.heights[y-1][x+dx]>map.heights[y][x]))));
}
