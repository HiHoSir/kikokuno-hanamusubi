// 海の入り江: the approved shoreline-study is the TERRAIN/SCENERY source.
// This scene expands its dry sand to the southern field return, rather than
// recreating a second unapproved grass/forest shoreline.
import {SHORE_Y,SCENERY} from '../shoreline-study/scene.mjs';

export const COVE_TILE_SIZE=32;
export const COVE_WIDTH=SHORE_Y.length; // identical 30-column approved coastline
export const COVE_HEIGHT=22; // extra 4 rows of sand for the field exit
// One coastline datum per COLUMN (sea north), not a different eastern beach.
export const COVE_SHORE=Object.freeze([...SHORE_Y]);
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
  Object.freeze({kind:'barrel',x:18,y:17})
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
