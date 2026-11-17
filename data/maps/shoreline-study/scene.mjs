// REVIEW-ONLY: 32px water -> sand -> grass connectivity contract.
// No fishing village, cliffs, NPCs, story or battle. Approved native-size
// rock/grass samples are review-only props, not a production map.
export const TILE=32;
export const WIDTH=30;
export const HEIGHT=18;
// One explicit vertical shoreline offset per column. Adjacent offsets may
// change by at most one cell; the atlas owns the sub-cell diagonal corners.
export const SHORE_Y=Object.freeze([
  6,6,6,7,7,8,8,9,9,8,8,7,7,6,6,7,7,8,9,9,8,8,7,7,6,6,5,5,5,5
]);
export const SAND_DEPTH=Object.freeze([
  3,3,3,3,3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4,4,3,3,3,3,3,3
]);
export const MAP=Object.freeze(Array.from({length:HEIGHT},(_,y)=>
  Object.freeze(Array.from({length:WIDTH},(_,x)=>{
    const shore=SHORE_Y[x];
    return y<shore?'sea':y<shore+SAND_DEPTH[x]?'sand':'grass';
  }))
));
export const START=Object.freeze({x:10*TILE+16,y:13*TILE+16,row:1});
export function terrainAt(x,y){return MAP[y]?.[x]??'sea';}
export function walkable(x,y){return x>=1&&y>=1&&x<WIDTH-1&&y<HEIGHT-1&&terrainAt(x,y)!=='sea';}
export function safeFoot(px,py){
  if(!Number.isFinite(px)||!Number.isFinite(py))return false;
  // The foot is a 19px-wide contact box, not the character's 32px head.
  return [[-9,-3],[9,-3],[-9,1],[9,1]].every(([dx,dy])=>
    walkable(Math.floor((px+dx)/TILE),Math.floor((py+dy)/TILE)));
}

// Stage 2 review: small, authored shoreline dressing only. Approved village
// sprites are displayed in their ORIGINAL pixel dimensions, never resized.
// Each foot is in world coordinates, independent of the terrain 32px grid.
// Avoid regular cell-centre repetition so the coastline stays the focus.
const foot=(tx,ty,dx=0,dy=0)=>Object.freeze({x:tx*TILE+16+dx,y:(ty+1)*TILE+dy});
export const SCENERY=Object.freeze([
  Object.freeze({id:'rock-west',kind:'rock',...foot(4,12,4,-4),solid:true,radius:13}),
  Object.freeze({id:'rock-east',kind:'rock',...foot(18,13,-8,-5),solid:true,radius:13}),
  Object.freeze({id:'rock-headland',kind:'rock',...foot(25,10,3,-3),solid:true,radius:13}),
  Object.freeze({id:'grass-west',kind:'grass-tuft',...foot(2,14,-5,-7),solid:false,radius:0}),
  Object.freeze({id:'grass-path',kind:'grass-tuft',...foot(8,12,-2,-5),solid:false,radius:0}),
  Object.freeze({id:'grass-center',kind:'grass-tuft',...foot(15,13,7,-4),solid:false,radius:0}),
  Object.freeze({id:'grass-east',kind:'grass-tuft',...foot(22,14,-3,-7),solid:false,radius:0}),
  Object.freeze({id:'grass-headland',kind:'grass-tuft',...foot(27,11,5,-5),solid:false,radius:0})
]);
export function sceneryCollision(px,py){
  // 9px actor-foot width. Tall sprite art does not create an invisible
  // rectangle above the character's feet.
  return SCENERY.some(o=>o.solid&&Math.hypot(px-o.x,py-o.y)<o.radius+9);
}
export function canStandWithScenery(px,py){
  return safeFoot(px,py)&&!sceneryCollision(px,py);
}

// Cover in NW, NE, SE, SW order. This indexes the existing approved 4x4 atlas.
export function shoreCover(x,y){
  return (terrainAt(x,y)!=='sea'?1:0)|
    (terrainAt(x+1,y)!=='sea'?2:0)|
    (terrainAt(x+1,y+1)!=='sea'?4:0)|
    (terrainAt(x,y+1)!=='sea'?8:0);
}
// Boundary rules explicitly reject unmediated sea/grass contact.
export function validateShore(){
  const errors=[];
  if(SHORE_Y.length!==WIDTH||SAND_DEPTH.length!==WIDTH)errors.push('invalid column data');
  for(let x=0;x<WIDTH;x++){
    if(x>0&&Math.abs(SHORE_Y[x]-SHORE_Y[x-1])>1)errors.push('disconnected slope at '+x);
    if(SAND_DEPTH[x]<2)errors.push('insufficient sand at '+x);
    for(let y=0;y<HEIGHT;y++){
      const t=terrainAt(x,y);
      if(t==='sea'&&
        [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>
          x+dx>=0&&y+dy>=0&&x+dx<WIDTH&&y+dy<HEIGHT&&
          terrainAt(x+dx,y+dy)==='grass'))errors.push('sea touches grass at '+x+','+y);
    }
  }
  if(!safeFoot(START.x,START.y))errors.push('invalid player spawn');
  return errors;
}
