const cell = 32;

export function composeForestCliffs(map,landscape,art,compose) {
  const mask=document.createElement('canvas');
  mask.width=map[0].length*cell;
  mask.height=map.length*cell;
  const cliffs=mask.getContext('2d',{willReadFrequently:true});
  const baked=compose(map,landscape,art,cliffs);
  const ground=baked.canvas.getContext('2d',{willReadFrequently:true});
  const forestCliffCrests=new Map();
  const wet=t=>!t||t==='sea'||t==='river';
  const bridge=map.bridgeWaterCells;
  for(const tree of landscape.objects(map)){
    if(!['newTrees','sacredTree'].includes(tree.kind))continue;
    const below=tree.contactTiles?.filter(([x,y])=>!map.ramps[y]?.[x]&&!bridge?.has(x+','+y)&&[-1,0,1].some(dx=>
      !wet(map[y-1]?.[x+dx])&&!bridge?.has((x+dx)+','+(y-1))&&!map.ramps[y-1]?.[x+dx]&&
      map.heights[y-1][x+dx]>map.heights[y][x]));
    if(!below?.length)continue;
    const left=Math.max(0,tree.x-cell/2),right=Math.min(mask.width,tree.x+tree.width+cell/2);
    const top=Math.max(0,tree.foot-cell*2),bottom=Math.min(mask.height,tree.foot-cell/4);
    if(bottom<=top||right<=left)continue;
    const width=right-left,height=bottom-top;
    const terrain=ground.getImageData(left,top,width,height);
    const edge=cliffs.getImageData(left,top,width,height).data;
    let visible=false;
    for(let i=3;i<edge.length;i+=4){
      terrain.data[i]=edge[i]&&terrain.data[i]===255?255:0;
      visible ||= !!terrain.data[i];
    }
    if(!visible)continue;
    const image=document.createElement('canvas');
    image.width=width;
    image.height=height;
    image.getContext('2d').putImageData(terrain,0,0);
    forestCliffCrests.set(tree,{image,left,top,right,bottom});
  }
  mask.width=1;
  mask.height=1;
  return {...baked,forestCliffCrests};
}
