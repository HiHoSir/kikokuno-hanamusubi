// Sanctuary is NOT subject to the field's 32px movement grid.
// Import the old map's cell collision as world-pixel rectangles once, then
// move freely in continuous world-pixel coordinates with foot-circle tests.
// The legacy map cell size determines only its imported geometry, never
// a movement increment, art size, zoom, or independent character scale.
export const TENYO_PLAYER_FOOT_RADIUS=8;
export const TENYO_NPC_FOOT_RADIUS=10;
const MAX_SWEEP_SLICE_PX=2;

export function sanctuaryCollisionGeometry(map,legacyBlocked,residents){
 const unit=map.tileSize;
 const rects=[...legacyBlocked].map(key=>{
  const [cx,cy]=key.split(',').map(Number);
  return {left:cx*unit,top:cy*unit,right:(cx+1)*unit,bottom:(cy+1)*unit,source:'legacy-map'};
 });
 for(const region of map.game?.footCollisionZones||[]){
  if(region.type!=='rectangle'||!Number.isFinite(region.x)||
    !Number.isFinite(region.y)||!Number.isFinite(region.width)||
    !Number.isFinite(region.height)||region.width<=0||region.height<=0)
   throw Error('Invalid sanctuary pixel-space contact region');
  rects.push({left:region.x,top:region.y,
   right:region.x+region.width,bottom:region.y+region.height,
   source:region.id});
 }
 const npcs=residents.map(npc=>({
  id:npc.id,x:(npc.tile[0]+.5)*unit,y:(npc.tile[1]+.5)*unit,
  radius:TENYO_NPC_FOOT_RADIUS
 }));
 return {rects,npcs,width:map.width*unit,height:map.height*unit,
  exit:{row:map.game.southExit.row,columns:[...map.game.southExit.columns]},
  legacyUnit:unit};
}
export function shrineCanStand(world,x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 const r=TENYO_PLAYER_FOOT_RADIUS;
 if(x<r||y<r||x>world.width-r||y>world.height-r)return false;
 for(const box of world.rects){
  if(x+r<box.left||x-r>box.right||y+r<box.top||y-r>box.bottom)continue;
  const px=Math.max(box.left,Math.min(x,box.right));
  const py=Math.max(box.top,Math.min(y,box.bottom));
  if((x-px)**2+(y-py)**2<r*r)return false;
 }
 for(const npc of world.npcs)
  if((x-npc.x)**2+(y-npc.y)**2<(r+npc.radius)**2)return false;
 return true;
}
// The small sweep segments prevent tunnelling at low FPS. They are NOT
// discrete movement destinations: coordinates remain arbitrary floats.
export function shrineAdvance(world,x,y,dx,dy,distancePx){
 const norm=Math.hypot(dx,dy);
 if(!Number.isFinite(distancePx)||distancePx<=0||!norm)return {x,y,traveled:0};
 const distance=Math.min(distancePx,32);
 const pieces=Math.ceil(distance/MAX_SWEEP_SLICE_PX);
 const sx=dx/norm*distance/pieces,sy=dy/norm*distance/pieces;
 let nx=x,ny=y;
 for(let i=0;i<pieces;i++){
  if(!shrineCanStand(world,nx+sx,ny+sy))break;
  nx+=sx;ny+=sy;
 }
 return {x:nx,y:ny,traveled:Math.hypot(nx-x,ny-y)};
}
export function shrineExitReached(world,x,y){
 const unit=world.legacyUnit;
 if(y<world.exit.row*unit)return false;
 return world.exit.columns.some(column=>x>=column*unit&&x<(column+1)*unit);
}
