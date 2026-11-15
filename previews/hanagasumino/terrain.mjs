import {map as gorge,waterfall as falls,lowerMouth as low,upperMouth as high} from '../waterfall-passage/terrain.mjs?v=tall-falls';

export const width=96,depth=88;
const gorgeX=46,gorgeY=16;
const position=([x,y])=>[x+gorgeX,y+gorgeY];
export const lowerMouth=position(low),upperMouth=position(high);
export const lowerArrival=position([13,22]),upperArrival=position([15,11]);
export const start=[46,78];
export const waterfall={...falls,column:falls.column+gorgeX,edgeRow:falls.edgeRow+gorgeY,basinRow:falls.basinRow+gorgeY};

export const landmarks=[
  {name:'鬼灯村',point:[46,79],kind:'newVillage',town:true},
  {name:'入り江の漁村',point:[82,62],kind:'newVillage',town:true},
  {name:'森口の集落',point:[56,54],kind:'newVillage',town:true},
  {name:'月見の湯',point:[34,17],kind:'newHouse',town:true},
  {name:'天妖の社',point:[21,52],kind:'newTorii'},
  {name:'九尾の祠',point:[47,9],kind:'shrine'},
  {name:'潮だまりの岬',point:[62,72],kind:'jizo'},
  {name:'海を見下ろす高台',point:[34,69],kind:'stoneMonument'},
  {name:'龍神の滝',point:[waterfall.column,waterfall.basinRow]},
  {name:'洞窟 南口',point:lowerMouth},
  {name:'洞窟 北口',point:upperMouth},
];
const shore=[
  [0,49,49],[5,43,54],[8,36,64],[11,27,72],[15,21,77],[18,18,82],
  [23,14,84],[28,12,85],[33,10,88],[37,8,88],[42,7,83],[46,10,79],
  [50,14,81],[54,12,86],[58,15,89],[61,19,87],[64,20,86],[67,23,81],
  [70,25,76],[73,28,68],[75,31,59],[79,35,55],[82,39,52],[85,43,49],[87,46,46],
];
function coast(y){
  const i=shore.findIndex(row=>row[0]>y);
  if(i<1)return [48,47];
  const [a,l,r]=shore[i-1], [b,m,n]=shore[i];
  return [Math.round(l+(m-l)*(y-a)/(b-a)),Math.round(r+(n-r)*(y-a)/(b-a))];
}
const mainRoad=[
  start,[46,74],[43,71],[43,65],[49,62],[49,57],[55,55],[56,55],
  [61,56],[68,56],[72,59],[77,60],[81,61],[82,62],
];
const roads=[
  mainRoad,
  [start,[43,74],[38,72],[34,72],[34,69]],
  [start,[50,75],[55,75],[57,71],[62,72]],
  [[49,57],[43,55],[31,55],[27,52],[21,52]],
  [[56,55],[54,52],[54,47],[56,44],[57,41],[58,39],[59,39],lowerMouth],
  [upperArrival,[60,27],[60,25],[61,24],[59,23],[56,23],[53,23],[50,22],[45,21],[41,21],[38,19],[34,17]],
  [[34,17],[36,14],[42,13],[45,10],[47,9]],
  [upperArrival,[61,28],[62,28]],
];
const westRiver=[[43,35],[42,40],[43,44],[41,47],[39,50],[37,54],[35,58],[34,62],[31,65],[25,67],[22,69]];
const eastRiver=[[70,51],[70,52],[71,53],[73,54],[75,54],[78,55],[82,56],[89,57]];
function line(a,b){
  const steps=Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]));
  return Array.from({length:steps+1},(_,i)=>a.map((v,k)=>Math.round(v+(b[k]-v)*i/(steps||1))));
}
const trace=points=>points.slice(1).flatMap((p,i)=>line(points[i],p));
const key=(x,y)=>[x,y].join();
const wet=new Set([...trace(westRiver),...trace(eastRiver)].flatMap(([x,y])=>[key(x,y),key(x+1,y)]));
const trail=new Set(roads.flatMap(trace).flatMap(([x,y])=>[key(x,y),key(x+1,y),key(x-1,y),key(x,y+1),key(x,y-1)]));
const isLand=(x,y)=>{const [a,b]=coast(y);return x>=a&&x<=b;};
const inGorge=(x,y)=>x>=gorgeX&&x<gorgeX+gorge[0].length&&y>=gorgeY&&y<gorgeY+gorge.length;
const ridge=x=>x<46?25+Math.min(7,Math.floor((46-x)/4))+Math.round(Math.sin(x*.32)*2):27;
const pools=new Set([[63,73],[64,73],[64,74],[66,72],[66,73]].map(point=>key(...point)));
const hill=(x,y)=>x>=31&&x<=36&&y>=66&&y<=70;
const woods=(x,y)=>Math.sin(x*.29+y*.18)+Math.cos(y*.31-x*.17)+Math.sin(x*.63-y*.19)*.32>.29;

export const map=Array.from({length:depth},(_,y)=>Array.from({length:width},(_,x)=>{
  if(!isLand(x,y))return 'sea';
  if(wet.has(key(x,y))||pools.has(key(x,y)))return 'river';
  if(inGorge(x,y))return gorge[y-gorgeY][x-gorgeX];
  if(trail.has(key(x,y)))return 'grass';
  return woods(x,y)?'forest':'grass';
}));
map.heights=map.map((row,y)=>row.map((type,x)=>{
  if(type==='sea')return 0;
  if(inGorge(x,y))return gorge.heights[y-gorgeY][x-gorgeX];
  return y<gorgeY||y<=ridge(x)?2:hill(x,y)?1:0;
}));
Object.assign(map,{
  ramps:map.map(row=>row.map(()=>null)),occupiedTiles:new Set(),decorations:[],bridgeWaterCells:new Set(),
  referencePlacedObjects:true,projectedHeights:true,elevationEnabled:true,
  wallDepth:32,wallDepthAt:(x,y)=>x>=gorgeX&&x<82&&y>=23&&y<=30?gorge.wallDepth:32,
  cornerProtected:new Set([...trail,key(...lowerMouth),key(...upperMouth)]),bridges:[],
  paths:roads.map(path=>path.map(point=>point.map(n=>n*32+16))),
});
map.ramps[71][34]='n';
for(const point of gorge.occupiedTiles){
  const [x,y]=position(point.split(',').map(Number));
  if(isLand(x,y))map.occupiedTiles.add(key(x,y));
}
for(const gate of [lowerMouth,upperMouth])map.occupiedTiles.delete(key(...gate));
const reserved=new Set(landmarks.flatMap(({point:[x,y]})=>Array.from({length:25},(_,i)=>key(x+i%5-2,y+Math.floor(i/5)-2))));
function prop(kind,x,y,w=32,h=32,block=false){
  if(!map[y]?.[x]||['sea','river','bridge'].includes(map[y][x]))return;
  if(block&&(trail.has(key(x,y))||reserved.has(key(x,y))))return;
  const foot=(y+1)*32;
  map.decorations.push({kind,x:x*32+16-w/2,y:foot-h,width:w,height:h,foot});
  if(block)map.occupiedTiles.add(key(x,y));
}
for(const o of gorge.decorations){
  const tx=Math.floor((o.x+o.width/2)/32)+gorgeX,ty=o.foot/32-1+gorgeY;
  prop(o.kind,tx,ty,o.width,o.height);
}
for(const {point:[x,y],kind,town} of landmarks){
  if(!kind)continue;
  const [w,h]=town?(kind==='newVillage'?[64,32]:[32,32]):kind==='shrine'?[64,64]:kind==='newTorii'?[32,32]:[32,32];
  prop(kind,x,y,w,h);
  if(town){
    prop('newHouse',x-2,y,32,32);
    if(kind==='newVillage')prop('newHouse',x+2,y-1,32,32);
  }
}
for(const [x,y] of [
  [17,48],[18,49],[19,49],[21,48],[22,49],[22,50],[18,53],[19,54],[21,55],
  [51,50],[52,50],[53,51],[51,52],[52,53],[57,51],[58,52],[59,53],[59,57],[60,58],
  [73,61],[74,62],[75,63],[76,64],[78,65],[79,65],
  [39,74],[40,75],[41,76],[42,77],[50,77],[51,78],[49,81],[42,80],
  [58,70],[59,73],[61,74],[29,69],[30,70],[37,69],[38,69],
])prop('newTrees',x,y,32,32,true);
for(const [x,y] of [[65,74],[67,72],[68,72],[64,71],[71,68],[22,60],[24,61],[23,63],[76,65],[85,61]]){
  prop('newMountainSmall',x,y,32,32,true);
}
for(const [x,y] of [[13,34],[19,40],[25,36],[33,39],[24,45],[32,46],[43,38],[31,64],[34,68],[62,71],[67,67],[80,60],
 [22,24],[25,22],[27,14],[34,11],[40,10],[53,11],[58,14],[64,12],[74,21],[80,25]]){
  prop('newMountainLarge',x,y,128,64,true);
}
for(let y=2;y<depth-2;y++)for(let x=2;x<width-2;x++){
  if(inGorge(x,y)||map.occupiedTiles.has(key(x,y))||trail.has(key(x,y))||reserved.has(key(x,y)))continue;
  if(![[0,0],[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dy])=>['grass','forest'].includes(map[y+dy][x+dx])))continue;
  const detail=(x*29+y*19+x*y*7)%53;
  if(map[y][x]==='forest'&&detail<16)prop('newTrees',x,y,32,32,true);
  else if(detail===22)prop('wildflowers',x,y);
}
for(const route of roads){
  for(const [x,y] of trace(route)){
    if(map[y]?.[x]!=='river'||!wet.has(key(x,y)))continue;
    map[y][x]='bridge';
    map.bridgeWaterCells.add(key(x,y));
    map.bridges.push([x,y]);
  }
}

export const reviewRoutes={
  south:[start,[56,55],[82,62],[21,52],[34,69],[62,72],lowerMouth],
  north:[upperArrival,[62,28],[34,17],[47,9],upperMouth],
};
export function routeTo(elevation,from,to){
  const path=new Map([[key(...from),null]]), queue=[from];
  for(const p of queue){
    if(key(...p)===key(...to)){
      const route=[];
      for(let q=p;q;q=path.get(key(...q)))route.push(q);
      return route.reverse();
    }
    for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
      const q=[p[0]+dx,p[1]+dy],k=key(...q);
      if(path.has(k)||!elevation.connected(map,...p,...q))continue;
      if(k!==key(...to)&&(k===key(...lowerMouth)||k===key(...upperMouth)))continue;
      if(!elevation.canMove(map,...p.map(v=>v*32+16),...q.map(v=>v*32+16)))continue;
      path.set(k,p);
      queue.push(q);
    }
  }
  return [];
}
export function validateTerrain(elevation){
  for(const route of Object.values(reviewRoutes)){
    for(const goal of route.slice(1)){
      if(!routeTo(elevation,route[0],goal).length)throw Error('歩行経路がつながっていません '+goal.join());
    }
  }
  if(routeTo(elevation,start,upperMouth).length)throw Error('洞窟の外で上下がつながっています');
}
