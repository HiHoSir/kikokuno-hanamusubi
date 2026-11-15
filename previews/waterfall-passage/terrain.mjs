const width=36;
const depth=36;
const lipRow=13;
const fallColumn=17;
const fallWidth=1;
const wallRows=6;
const basinRow=lipRow+wallRows;
export const lowerMouth=[13,21];
export const upperMouth=[15,10];
export const start=[14,26];

// The wall and its crest occupy distinct rows in the same 32 px map.
const upperEdge=[
   9, 9,10,10,11,11,12,13,14,14,13,13,14,14,13,12,12,
  12,12,
  12,12,11,10,10, 9,10,11,12,13,13,12,11,11,10,10,10,
];
const riverHead=[[21,24],[21,24],[20,23],[20,23],[19,22],[18,22],
  [17,21],[16,20],[16,19],[16,19],[17,19],[17,18],[17,17]];
const riverBasin=[[16,19],[15,21],[15,22],[15,23],[16,23],[17,22],
  [18,22],[18,21],[18,21],[19,22],[20,23],[21,24],[22,25],[22,26],
  [23,27],[23,27],[24,28]];
const wallAt=(x,y)=>y>upperEdge[x] && y<=upperEdge[x]+wallRows;
const nameAt=(x,y)=>{
  const [left,right]=riverHead[y]??riverBasin[y-basinRow]??[fallColumn,fallColumn+fallWidth-1];
  if(x>=left&&x<=right)return 'river';
  if(wallAt(x,y))return 'grass';
  if((x<=11&&y>=18)||(x>=21&&x<=30&&y>=19)||(x>=21&&x<=28&&y>=5&&y<=11))return 'forest';
  return 'grass';
};

export const waterfall={column:fallColumn,width:fallWidth,edgeRow:lipRow,basinRow};
export const map=Array.from({length:depth},(_,y)=>Array.from({length:width},(_,x)=>nameAt(x,y)));
map.heights=map.map((row,y)=>row.map((_,x)=>y<=upperEdge[x]?2:0));
Object.assign(map,{
  ramps:map.map(row=>row.map(()=>null)),occupiedTiles:new Set(),decorations:[],
  bridgeWaterCells:new Set(),referencePlacedObjects:true,projectedHeights:true,
  elevationEnabled:true,cornerProtected:new Set([lowerMouth.join(),upperMouth.join()]),
  wallDepth:wallRows*32,
  paths:[
    [[12,30],start,[14,24],[14,22],[13,22],lowerMouth],
    [upperMouth,[15,12],[16,12]],
  ].map(path=>path.map(point=>point.map(n=>n*32+16))),
});
for(let x=0;x<width;x++) {
  for(let y=upperEdge[x]+1;y<=upperEdge[x]+wallRows;y++)map.occupiedTiles.add([x,y].join());
}

function prop(kind,x,y,width,height,block=false){
  if(map[y][x]==='river'||wallAt(x,y))return;
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
  [4,19],[5,19],[6,20],[7,21],[8,21],[9,21],[10,21],[11,20],
  [4,22],[5,23],[6,22],[7,24],[8,23],[9,25],[10,24],[11,23],[12,24],
  [7,26],[8,27],[9,26],[10,28],[11,27],[12,26],[11,29],[10,30],[13,28],
  [5,9],[7,9],[8,12],[9,8],[9,13],[10,8],[11,11],[12,12],[13,8],[14,6],[14,10],
  [20,10],[21,10],[22,8],[23,9],[24,8],[24,9],[26,9],[27,10],[29,12],
  [23,20],[24,18],[25,19],[24,21],[25,21],[22,25],[23,24],[24,25],[25,24],
  [26,23],[27,23],[27,24],[28,25],[25,27],[26,28],[28,29],[29,28],
])prop('newTrees',x,y,32,32,true);
for(const [x,y] of [[5,6],[9,5],[12,4],[26,6],[29,6],[31,8]]){
  prop('newMountainLarge',x,y,128,64,true);
}
for(const [x,y] of [[12,22],[14,25],[15,24],[13,27],[11,12],[15,9],[24,23],[25,22],[6,13]]) {
  prop('wildflowers',x,y,32,32);
}

const key=(x,y)=>x+','+y;
export function validateTerrain(elevation){
  for(let x=fallColumn;x<fallColumn+fallWidth;x++){
    if(map.heights[lipRow-1][x]!==2||map.heights[basinRow][x]!==0||
      map.slice(lipRow-1,basinRow+1).some(row=>row[x]!=='river')){
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
  if(!seen.has(lowerMouth.join())||seen.has(upperMouth.join())||
    !elevation.connected(map,upperMouth[0],upperMouth[1],15,11)){
    throw Error('洞窟前の通行判定が地形と一致しません');
  }
}
