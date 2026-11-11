const facingVectors = [[0,1],[0,-1],[1,0],[-1,0]];
export const RESIDENT_RADIUS = 11;

export function faceToward(dx,dy) {
  return Math.abs(dx)>Math.abs(dy) ? (dx>0 ? 2 : 3) : (dy>0 ? 0 : 1);
}

export function makeResident(config) {
  const [x,y] = config.route[0];
  return {...config,x,y,target:1,wait:700,distance:0,moving:false};
}

export function residentInFront(x,y,face,residents) {
  const [dx,dy] = facingVectors[face];
  let nearest;
  let distance = 65;
  for(const npc of residents){
    const nx = npc.x-x, ny = npc.y-y;
    if(nx*dx+ny*dy<=0 || Math.abs(nx*dy-ny*dx)>28) continue;
    const length = Math.hypot(nx,ny);
    if(length<distance){
      nearest=npc;
      distance=length;
    }
  }
  return nearest;
}

export function advanceResident(npc,elapsed,walk,occupied) {
  npc.moving=false;
  if(npc.route.length===1) return;
  npc.wait=Math.max(0,npc.wait-elapsed);
  if(npc.wait>0) return;

  const [tx,ty] = npc.route[npc.target];
  const dx=tx-npc.x, dy=ty-npc.y;
  const length=Math.hypot(dx,dy);
  if(length>0){
    npc.face=faceToward(dx,dy);
    const fraction=Math.min(1,npc.speed*elapsed/(1000*length));
    const [x,y]=walk.move(npc.x,npc.y,dx*fraction,dy*fraction,occupied);
    const travel=Math.hypot(x-npc.x,y-npc.y);
    npc.moving=travel>0;
    npc.distance+=travel;
    npc.x=x;
    npc.y=y;
  }
  if(Math.hypot(tx-npc.x,ty-npc.y)<0.001){
    npc.x=tx;
    npc.y=ty;
    npc.target=(npc.target+1)%npc.route.length;
    npc.wait=650;
    npc.moving=false;
  }
}
