// 海の入り江: the approved shoreline-study is the TERRAIN/SCENERY source.
// Original approved 30-column coastline remains intact at the NW corner.
// EAST extension connects wave tiles automatically; SOUTH extension houses the
// fishing hamlet. All original 30x22 terrain cells and spawn stay intact.
import {SHORE_Y,SCENERY} from '../shoreline-study/scene.mjs';

export const COVE_TILE_SIZE=32;
// EAST: a hand-authored natural continuation of the same coastal waterline.
// The first 30 columns MUST always equal approved SHORE_Y.
export const COVE_EAST_SHORE=Object.freeze([5,5,6,6,7,7,8,8,9,9,8,8]);
export const COVE_WIDTH=SHORE_Y.length+COVE_EAST_SHORE.length; // 42 columns
export const COVE_HEIGHT=44; // 22 additional SOUTHERN rows for home and working sand
// One coastline datum per COLUMN (sea north), not a different eastern beach.
export const COVE_SHORE=Object.freeze([...SHORE_Y,...COVE_EAST_SHORE]);
export const COVE_SAND_DEPTH=Object.freeze(COVE_SHORE.map(y=>COVE_HEIGHT-y));

const tiles=Object.freeze(Array.from({length:COVE_HEIGHT},(_,y)=>
 Array.from({length:COVE_WIDTH},(_,x)=>y<COVE_SHORE[x]?'~':'s').join('')));
// Reuse the three approved native rock positions; their source foot coordinates
// are not rounded to new arbitrary object centers.
const nativeRocks=SCENERY.map(rock=>Object.freeze({
 kind:'rocks',id:rock.id,
 x:rock.x,y:rock.y,footPosition:true,solid:true,radius:rock.radius
}));
export const COVE_MAP=Object.freeze({
 id:'sea-cove',name:'海の入り江',tileSize:COVE_TILE_SIZE,
 width:COVE_WIDTH,height:COVE_HEIGHT,tiles,
 entry:Object.freeze({x:10*32+16,y:13*32+16,face:1}),
 exit:Object.freeze({row:COVE_HEIGHT-1,columns:Object.freeze([9,10,11])}),
 fisher:Object.freeze({id:'ushiohei',name:'潮平',x:16*32+16,y:12*32+16,face:3}),
 // Keep NPC life on the sand, but never paint unrelated forests over the
 // approved beach. Only approved native rocks + a few game props remain.
 objects:Object.freeze([
  ...nativeRocks,
  Object.freeze({kind:'basket',x:20,y:16}),
  Object.freeze({kind:'barrel',x:18,y:17}),
  // Reused original village art, native size. A house is not enterable yet.
  Object.freeze({
   id:'fisher-house',kind:'fisherHouse',footPosition:true,
   x:280,y:1140,solid:true,
   collision:Object.freeze({left:85,right:475,top:783,bottom:1140})
  }),
  // Drying net, ropes and folded nets are distinct native RGBA sprites.
  Object.freeze({
   id:'net-rack',kind:'netRack',footPosition:true,
   x:1010,y:1050,solid:true,
   collision:Object.freeze({left:920,right:1100,top:900,bottom:1050})
  }),
  Object.freeze({id:'net-bundle',kind:'netBundle',
   footPosition:true,x:770,y:1175,solid:true,radius:39}),
  Object.freeze({id:'rope-coil',kind:'ropeCoil',
   footPosition:true,x:1130,y:1250,solid:true,radius:23}),
  // Reuse village-original props; no rescaling or palette substitution.
  Object.freeze({id:'fish-crate-east',kind:'crate',x:19,y:29,solid:true,radius:22}),
  Object.freeze({id:'gear-barrel',kind:'barrel',x:28,y:34,solid:true,radius:22}),
  Object.freeze({id:'spare-basket',kind:'basket',x:21,y:38,solid:true,radius:22})
 ])
});
export function tileAt(x,y,map=COVE_MAP){
 return map.tiles[y]?.[x]??'~';
}
export function walkableCell(x,y,map=COVE_MAP){
 return Number.isInteger(x)&&Number.isInteger(y)&&
  x>0&&x<map.width-1&&y>=0&&y<map.height&&tileAt(x,y,map)==='s';
}
export function walkablePoint(x,y,map=COVE_MAP){
 return Number.isFinite(x)&&Number.isFinite(y)&&
  walkableCell(Math.floor(x/map.tileSize),Math.floor(y/map.tileSize),map);
}
export function isSouthExit(x,y,map=COVE_MAP){
 return y===map.exit.row&&map.exit.columns.includes(x);
}
