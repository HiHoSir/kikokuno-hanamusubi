const width=36;
const depth=31;
const lipRow=13;
const fallColumn=16;
export const lowerMouth=[12,16];
export const upperMouth=[14,10];
export const start=[14,20];
// Last cell on the upper ridge by column. The four waterfall cells share a lip.
const upperEdge=[9,9,10,10,11,11,12,13,14,14,13,13,14,14,13,12,12,12,12,12,
  12,11,10,10,9,10,11,12,13,13,12,11,11,10,10,10];
const westShelf=[
  [4,14,7,15],[5,15,9,16],[6,16,10,17],[7,17,10,18],[8,18,9,19],
];
const eastShelf=[
  [23,12,26,13],[22,13,27,14],[23,14,28,15],[24,15,29,16],[25,16,29,17],
  [26,17,28,18],
];
const riverByRow=[
  [19,22],[19,22],[18,22],[18,21],[17,21],[17,20],[16,20],[16,19],
  [16,19],[16,19],[16,19],[16,19],[16,19],[16,19],[15,20],[15,21],
  [15,22],[15,22],[16,22],[16,21],[16,21],[17,21],[17,22],[18,23],
  [19,23],[20,24],[21,25],[22,25],[22,26],[23,27],[23,27],
];

export const waterfall={column:fallColumn,edgeRow:lipRow,upperLevel:2,lowerLevel:0,width:4};
export const map=Array.from({length:depth},(_,y)=>Array.from({length:width},(_,x)=>{
  const [left,right]=riverByRow[y];
  if(x>=left&&x<=right)return 'river';
  if((x<=11&&y>=15)||(x>=22&&x<28&&y>4&&y<12))return 'forest';
  return 'grass';
}));
const inShelf=(x,y,shelves)=>shelves.some(([left,top,right,bottom])=>x>=left&&x<=right&&y>=top&&y<=bottom);
map.heights=map.map((row,y)=>row.map((_,x)=>y<=upperEdge[x]?2:
  inShelf(x,y,westShelf)||inShelf(x,y,eastShelf)?1:0));
Object.assign(map,{
  ramps:map.map(row=>row.map(()=>null)),occupiedTiles:new Set(),decorations:[],
  bridgeWaterCells:new Set(),referencePlacedObjects:true,projectedHeights:true,
  elevationEnabled:true,cornerProtected:new Set([lowerMouth.join(),upperMouth.join()]),
  paths:[
    [[13,23],[14,20],[14,18],[13,17],[12,17],lowerMouth],
    [upperMouth,[14,12],[15,12]],
  ].map(path=>path.map(point=>point.map(n=>n*32+16))),
});

function prop(kind,x,y,width,height,block=false){
  if(map[y][x]==='river')return;
  const foot=(y+1)*32;
  map.decorations.push({
    kind,x:x*32+16-width/2,y:foot-height,width,height,foot,
    supportHeight:map.heights[y][x],occupiedTiles:block?[[x,y]]:[],
  });
  if(block)map.occupiedTiles.add([x,y].join());
}

prop('cave',...lowerMouth,80,64);
prop('cave',...upperMouth,80,64);
for(const [x,y] of [
  [4,16],[5,17],[6,19],[7,20],[8,19],[8,21],[9,20],[9,22],[10,21],[10,23],[11,22],
  [11,18],[10,17],[9,16],[8,16],[7,15],[6,14],[11,15],[9,14],
  [5,9],[7,9],[9,8],[10,8],[11,9],[12,8],[13,7],[14,6],[15,8],
  [20,10],[21,10],[22,9],[23,8],[24,8],[24,10],[26,9],[27,10],
  [23,16],[24,16],[25,15],[26,16],[24,18],[25,19],[23,20],[24,21],
  [26,23],[27,23],[27,24],[12,25],[11,26],[10,25],
])prop('newTrees',x,y,32,32,true);
for(const [x,y] of [[5,6],[9,5],[13,4],[24,6],[28,6],[31,8]]){
  prop('newMountainLarge',x,y,128,64,true);
}
for(const [x,y] of [[12,19],[15,18],[14,22],[14,13],[11,12],[15,10],[22,17],[25,21],[6,13]]) {
  prop('wildflowers',x,y,32,32);
}

const key=(x,y)=>x+','+y;
export function validateTerrain(elevation){
  for(let x=fallColumn;x<fallColumn+waterfall.width;x++){
    if(map[lipRow-1][x]!=='river'||map[lipRow][x]!=='river'||
      map.heights[lipRow-1][x]!==2||map.heights[lipRow][x]!==0){
      throw Error('滝の落ち口・滝壺の地形が一致しません');
    }
  }
  const seen=new Set([start.join()]);
  const queue=[start];
  for(const [x,y] of queue){
    for(const [dx,dy] of [[0,1],[1,0],[0,-1],[-1,0]]){
      const nx=x+dx,ny=y+dy;
      if(seen.has(key(nx,ny))||!elevation.connected(map,x,y,nx,ny))continue;
      seen.add(key(nx,ny));
      queue.push([nx,ny]);
    }
  }
  if(!seen.has(lowerMouth.join())||seen.has(upperMouth.join())){
    throw Error('洞窟でつなぐ前に上下の地形が連通しています');
  }
}
