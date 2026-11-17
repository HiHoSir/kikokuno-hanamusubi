// REVIEW-ONLY coastal study, not the sea-cove production map.
// The approved shoreline animation is retained. The inland sandy expanse
// continues to the study's southern edge: no forced grass/sand adjacency.
export const TILE=32;
export const WIDTH=30;
export const HEIGHT=18;

// A single hand-authored sea boundary, with connected straight and diagonal
// mapchips. Only the ocean-facing edge is a terrain boundary in this study.
export const SHORE_Y=Object.freeze([
  6,6,6,7,7,8,8,9,9,8,8,7,7,6,6,7,7,8,9,9,8,8,7,7,6,6,5,5,5,5
]);
export const MAP=Object.freeze(Array.from({length:HEIGHT},(_,y)=>
  Object.freeze(Array.from({length:WIDTH},(_,x)=>
    y<SHORE_Y[x]?'sea':'sand'
  ))
));
export const START=Object.freeze({x:10*TILE+16,y:13*TILE+16,row:1});
export function terrainAt(x,y){return MAP[y]?.[x]??'sea';}
export function walkable(x,y){
  return Number.isInteger(x)&&Number.isInteger(y)&&x>=1&&y>=1&&
    x<WIDTH-1&&y<HEIGHT-1&&terrainAt(x,y)==='sand';
}
export function safeFoot(px,py){
  if(!Number.isFinite(px)||!Number.isFinite(py))return false;
  // 19px-wide actual foot contact box, not the 80px-wide head.
  return [[-9,-3],[9,-3],[-9,1],[9,1]].every(([dx,dy])=>
    walkable(Math.floor((px+dx)/TILE),Math.floor((py+dy)/TILE)));
}

// Small, reviewed native-size rocks remain on the broad sandy shore.
// Avoid an unnatural strip of grass or grass decorations to "cap" the beach.
const foot=(tx,ty,dx=0,dy=0)=>Object.freeze({x:tx*TILE+16+dx,y:(ty+1)*TILE+dy});
export const SCENERY=Object.freeze([
  Object.freeze({id:'rock-west',kind:'rock',...foot(4,12,4,-4),solid:true,radius:13}),
  Object.freeze({id:'rock-east',kind:'rock',...foot(18,13,-8,-5),solid:true,radius:13}),
  Object.freeze({id:'rock-headland',kind:'rock',...foot(25,10,3,-3),solid:true,radius:13})
]);
export function sceneryCollision(px,py){
  return SCENERY.some(o=>o.solid&&Math.hypot(px-o.x,py-o.y)<o.radius+9);
}
export function canStandWithScenery(px,py){
  return safeFoot(px,py)&&!sceneryCollision(px,py);
}
// NW NE SE SW, preserving the original accepted 16-corner coast atlas.
export function shoreCover(x,y){
  return (terrainAt(x,y)!=='sea'?1:0)|
    (terrainAt(x+1,y)!=='sea'?2:0)|
    (terrainAt(x+1,y+1)!=='sea'?4:0)|
    (terrainAt(x,y+1)!=='sea'?8:0);
}
export function validateShore(){
  const errors=[];
  if(SHORE_Y.length!==WIDTH)errors.push('invalid column data');
  for(let x=0;x<WIDTH;x++){
    if(x>0&&Math.abs(SHORE_Y[x]-SHORE_Y[x-1])>1)
      errors.push('disconnected slope at '+x);
    if(HEIGHT-SHORE_Y[x]<8)
      errors.push('sandy beach too narrow at '+x);
  }
  if(MAP.some(row=>row.some(t=>!['sea','sand'].includes(t))))
    errors.push('unexpected terrain in wide beach study');
  if(!canStandWithScenery(START.x,START.y))
    errors.push('invalid player spawn');
  for(const object of SCENERY){
    if(terrainAt(Math.floor(object.x/TILE),Math.floor((object.y-1)/TILE))!=='sand')
      errors.push('rock is not on the beach: '+object.id);
  }
  return errors;
}
