// Footprint-based movement in Tenyo sanctuary. The map is authored on a
// 32px collision grid, but actor motion is NOT restricted to whole tiles.
// Terrain is tested against actual blocked cell rectangles, while NPCs are
// small circles at their feet. Camera and character artwork never affect this.
export const TENYO_STEP=0.25;
export const TENYO_PLAYER_FOOT_RADIUS=8;
export const TENYO_NPC_FOOT_RADIUS=10;

export function shrineCanStand(map,blocked,residents,x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  const tile=map.tileSize;
  const px=(x+0.5)*tile,py=(y+0.5)*tile,r=TENYO_PLAYER_FOOT_RADIUS;
  if(px<r||py<r||px>map.width*tile-r||py>map.height*tile-r)return false;
  for(let cy=Math.floor((py-r)/tile);cy<=Math.floor((py+r)/tile);cy++){
    for(let cx=Math.floor((px-r)/tile);cx<=Math.floor((px+r)/tile);cx++){
      if(!blocked.has(cx+','+cy))continue;
      const edgeX=Math.max(cx*tile,Math.min(px,(cx+1)*tile));
      const edgeY=Math.max(cy*tile,Math.min(py,(cy+1)*tile));
      const dx=px-edgeX,dy=py-edgeY;
      if(dx*dx+dy*dy<r*r)return false;
    }
  }
  const npcRadius=TENYO_PLAYER_FOOT_RADIUS+TENYO_NPC_FOOT_RADIUS;
  for(const npc of residents){
    const tx=(npc.tile[0]+.5)*tile,ty=(npc.tile[1]+.5)*tile;
    const dx=px-tx,dy=py-ty;
    if(dx*dx+dy*dy<npcRadius*npcRadius)return false;
  }
  return true;
}

// Exit is triggered by the sprite's foot entering the exit row, not by the
// fractional world tile coordinate equalling an integer.
export function shrineExitReached(map,x,y){
  const column=Math.floor(x+0.5),row=Math.floor(y+0.5);
  return row===map.game.southExit.row&&map.game.southExit.columns.includes(column);
}
