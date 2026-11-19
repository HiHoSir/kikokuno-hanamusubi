// This sanctuary is not constrained to the field's 32px movement grid.
// Authoritative movement uses continuous world pixels and a small foot circle.
//
// The field alone has a tile movement rule. Both review and game profiles
// enforce the same authored sequel-only passage seals, even if NPC art,
 // camera zoom or decorative scenery is later changed.
 // The visual profile separately corrects inherited artist-foot collisions.
export const TENYO_PLAYER_FOOT_RADIUS=8; // published legacy collision
export const TENYO_NPC_FOOT_RADIUS=10;
export const TENYO_VISUAL_PLAYER_FOOT_RADIUS=4;
export const TENYO_VISUAL_NPC_FOOT_RADIUS=5;
const MAX_SWEEP_SLICE_PX=2;
const VISUAL_OBJECTS=new Set([
 'tenyo_water_gate','torii_gate_v2',
 'rock_island_lantern_base','rock_island_lantern_base_mirror',
 'tenyo_stone_lantern','sanctuary_fall_v2'
]);

function footShapes(map){
 const unit=map.tileSize,shapes=[];
 for(const o of map.objects){
  if(!VISUAL_OBJECTS.has(o.templateId))continue;
  const left=o.x*unit,groundY=(o.y+1)*unit;
  if(o.templateId==='tenyo_water_gate'){
   // Actual water-gate PNG: narrow wooden posts at the LEFT and RIGHT
   // edges and low fence rails joined to those posts. No free passage
   // through the fence artwork or the guards' sequel-only doorway.
   shapes.push({type:'box',left:left+11,right:left+35,
     top:groundY-39,bottom:groundY,id:o.id+':left-post'});
   shapes.push({type:'box',left:left+157,right:left+181,
     top:groundY-39,bottom:groundY,id:o.id+':right-post'});
   shapes.push({type:'box',left:left,right:left+37,
     top:groundY-29,bottom:groundY,id:o.id+':left-fence'});
   shapes.push({type:'box',left:left+155,right:left+192,
     top:groundY-29,bottom:groundY,id:o.id+':right-fence'});
  }else if(o.templateId==='torii_gate_v2'){
   shapes.push({type:'box',left:left+15,right:left+35,
     top:groundY-15,bottom:groundY,id:o.id+':left-foot'});
   shapes.push({type:'box',left:left+94,right:left+114,
     top:groundY-15,bottom:groundY,id:o.id+':right-foot'});
  }else if(o.templateId==='sanctuary_fall_v2'){
   // Waterfall's approved 128x160 painting reaches right to its lower
   // rock shoulders and white plunge spray. Keep the footprint wide
   // enough to include the LEFT rock edge, not only the bright center.
   // The churning pool is not a walkable shallow shore.
   shapes.push({type:'ellipse',x:left+64,y:groundY-5,
     rx:65,ry:38,id:o.id+':plunge-pool'});
  }else if(o.templateId==='tenyo_stone_lantern'){
   // The lamp artwork is supported above the island by 26 world px.
   // Its base occupies only a small contact patch, not a whole 32px cell.
   shapes.push({type:'ellipse',x:left+unit/2,y:groundY-29,
     rx:7,ry:6,id:o.id+':base'});
  }else{
   // 96x64 stone-island art: only the visible low rock band is solid;
   // most of the nominal two-row sprite is transparent atmosphere.
   shapes.push({type:'ellipse',x:left+unit*1.5,y:groundY-14,
     rx:42,ry:13,id:o.id+':rock-foot'});
  }
 }
 return shapes;
}

function blockedCellRects(map,legacyBlocked,profile){
 const unit=map.tileSize;
 if(profile==='legacy')
  return [...legacyBlocked].map(key=>{
   const [cx,cy]=key.split(',').map(Number);
   return {left:cx*unit,top:cy*unit,right:(cx+1)*unit,
    bottom:(cy+1)*unit,source:'legacy-map'};
  });
 const water=new Set((map.waterSurface||[]).filter(o=>o.depth!=='shallow')
  .map(o=>o.x+','+o.y));
 const hard=new Set((map.terrainBlocks||[]).map(p=>p.join(',')));
 const custom=new Set();
 const other=new Set();
 for(const obj of map.objects){
  for(const p of obj.occupiedTiles||[])
   (VISUAL_OBJECTS.has(obj.templateId)?custom:other).add(p.join(','));
 }
 const remainder=new Set(legacyBlocked);
 for(const key of custom)
  if(!water.has(key)&&!hard.has(key)&&!other.has(key))
   remainder.delete(key);
 // Mid/deep-water tiles are never shrunk: the previous 10px recess
 // allowed the actor to stand *inside* a forbidden waterfall pool.
 return [...remainder].map(key=>{
  const [cx,cy]=key.split(',').map(Number);
  const soft=water.has(key)&&!hard.has(key)&&!other.has(key);
  return {left:cx*unit,top:cy*unit,right:(cx+1)*unit,
   bottom:(cy+1)*unit,source:soft?'waterline':'legacy-map'};
 });
}

export function sanctuaryCollisionGeometry(map,legacyBlocked,residents,{profile='legacy'}={}){
 if(profile!=='legacy'&&profile!=='visual')throw Error('Unknown sanctuary collision profile');
 const unit=map.tileSize;
 const rects=blockedCellRects(map,legacyBlocked,profile);
 for(const region of map.game?.footCollisionZones||[]){
  if(region.type!=='rectangle'||!Number.isFinite(region.x)||
    !Number.isFinite(region.y)||!Number.isFinite(region.width)||
    !Number.isFinite(region.height)||region.width<=0||region.height<=0)
   throw Error('Invalid sanctuary pixel-space contact region');
  // Pixel-accurate non-water structural zones only; shallow water is
  // traversable on both sides of the gate unless a real obstacle blocks it.
  rects.push({left:region.x,top:region.y,
   right:region.x+region.width,bottom:region.y+region.height,
   source:region.id});
 }
 // Never infer a sequel seal from NPC circles: with two small guardians
 // there is naturally a walkable gap between their feet.
 const locks=(map.game?.passageLocks||[]).map(zone=>{
  if(zone.type!=='rectangle'||zone.unlockIn!=='sequel'||
   !Number.isFinite(zone.x)||!Number.isFinite(zone.y)||
   !Number.isFinite(zone.width)||!Number.isFinite(zone.height)||
   zone.width<=0||zone.height<=0)
   throw Error('Invalid unbreakable sanctuary sequel passage lock');
  return {id:zone.id,left:zone.x,top:zone.y,
   right:zone.x+zone.width,bottom:zone.y+zone.height};
 });
 if(locks.length!==1||locks[0].id!=='guardian-sequel-passage')
  throw Error('Only the guarded gate aperture is the first-game sequel lock');
 const npcRadius=profile==='visual'
  ?TENYO_VISUAL_NPC_FOOT_RADIUS:TENYO_NPC_FOOT_RADIUS;
 const npcs=residents.map(npc=>({
  id:npc.id,x:(npc.tile[0]+.5)*unit,y:(npc.tile[1]+.5)*unit,
  radius:npcRadius
 }));
 return {
  rects,
  shapes:profile==='visual'?footShapes(map):[],
  locks,
  npcs,
  profile,
  playerRadius:profile==='visual'
   ?TENYO_VISUAL_PLAYER_FOOT_RADIUS:TENYO_PLAYER_FOOT_RADIUS,
  width:map.width*unit,height:map.height*unit,
  exit:{row:map.game.southExit.row,columns:[...map.game.southExit.columns]},
  legacyUnit:unit
 };
}

function rectTouch(box,x,y,r){
 if(x+r<box.left||x-r>box.right||y+r<box.top||y-r>box.bottom)return false;
 const px=Math.max(box.left,Math.min(x,box.right));
 const py=Math.max(box.top,Math.min(y,box.bottom));
 return (x-px)**2+(y-py)**2<r*r;
}

export function shrineCanStand(world,x,y){
 if(!Number.isFinite(x)||!Number.isFinite(y))return false;
 const r=world.playerRadius??TENYO_PLAYER_FOOT_RADIUS;
 if(x<r||y<r||x>world.width-r||y>world.height-r)return false;
 for(const box of world.rects)if(rectTouch(box,x,y,r))return false;
 // Only the opening between the gate guardians is sealed. Shallows
 // around either side of the gate remain reachable and walkable.
 // Neither NPC size nor the visual/legacy selection may open this slit.
 for(const zone of world.locks||[])if(rectTouch(zone,x,y,r))return false;
 for(const shape of world.shapes||[]){
  if(shape.type==='box'&&rectTouch(shape,x,y,r))return false;
  if(shape.type==='ellipse'&&
   ((x-shape.x)/(shape.rx+r))**2+((y-shape.y)/(shape.ry+r))**2<1)
   return false;
 }
 for(const npc of world.npcs)
  if((x-npc.x)**2+(y-npc.y)**2<(r+npc.radius)**2)return false;
 return true;
}

// Short sweep slices prevent skipping thin obstacles. Coordinates are NOT
// snapped or quantized to sweep slices; the final movement is continuous.
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
