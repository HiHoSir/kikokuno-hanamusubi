// 海の入り江: one authored, editable 32px scene. The coast line is a fixed
// row-by-row design, not a noise field or an enlarged single background image.
export const COVE_TILE_SIZE=32;
export const COVE_WIDTH=46;
export const COVE_HEIGHT=34;
export const COVE_SHORE=[
  31,32,33,34,35,35,34,33,31,30,29,28,27,26,25,25,26,
  26,27,28,29,30,31,33,34,35,36,37,38,39,39,39,39,39
];
// The approved study demonstrated that a 3–5-cell beach is too narrow.
// These authored depths give the cove 10–14 cells of open sand, not a forced
// grass border running parallel to the foam. Terrain edits remain map data.
export const COVE_SAND_DEPTH=Object.freeze([
  10,10,11,11,12,12,11,11,10,10,10,11,11,12,12,12,12,
  12,11,11,10,10,10,11,11,12,12,12,12,12,13,14,14,14
]);
const cellKey=(x,y)=>x+','+y;
const rockCells=new Set([
  [9,5],[10,5],[11,5],[6,11],[7,11],[8,11],
  [16,9],[17,9],[18,9],[13,25],[14,25],
  [30,7],[28,9],[31,23],[33,25],[37,27]
].map(([x,y])=>cellKey(x,y)));
// Hand-authored native 32px forest footprints. Each row is a contiguous
// [left,right] inclusive span, widening and narrowing to make rounded groves
// instead of clipped rectangular collision slabs. The common 16-corner
// forest atlas clips their visual edges; no canvas-drawn vegetation patches.
export const COVE_GROVES=Object.freeze([
  [4, [[6,7],[5,8],[4,8],[4,9],[5,8],[6,7]]],
  [2, [[12,13],[11,14],[10,15],[10,15],[11,14],[12,13]]],
  [3, [[19,21],[18,22],[17,22],[17,23],[18,22],[20,21]]],
  [15,[[5,6],[4,8],[4,9],[4,9],[5,9],[5,8],[6,8]]],
  [17,[[11,12],[10,14],[9,14],[9,15],[10,14],[11,13]]],
  [23,[[6,7],[5,8],[4,9],[5,8],[6,7]]],
  [27,[[13,14],[12,15],[12,16],[13,15],[14,14]]],
  [27,[[23,24],[22,25],[21,26],[21,26],[22,25],[23,24]]]
]);
const denseScrub=(x,y)=>COVE_GROVES.some(([north,spans])=>{
  const range=spans[y-north];
  return range!==undefined&&x>=range[0]&&x<=range[1];
});
// Terrain legend: g grass, s sandy foreshore, ~ moving sea,
// t thick impassable scrub, r boulders. No hidden object collisions.
const rows=Array.from({length:COVE_HEIGHT},(_,y)=>
  Array.from({length:COVE_WIDTH},(_,x)=>{
    if(x>=COVE_SHORE[y])return '~';
    if(x===0||x===COVE_WIDTH-1)return 't';
    if(y<=1)return 't';
    // The southern gateway remains sand, without a blocky green corridor.
    if(y>=32)return (x>=COVE_SHORE[y]-COVE_SAND_DEPTH[y])?'s':'t';
    if(rockCells.has(cellKey(x,y)))return 'r';
    // Beach takes priority over inland scrub so collision blobs cannot
    // accidentally eat a walking corridor along the accepted coast.
    if(x>=COVE_SHORE[y]-COVE_SAND_DEPTH[y])return 's';
    if(denseScrub(x,y))return 't';
    return 'g';
  })
);
// The field entry, the southern exit and all sides of Ushiohei sit inside
// the authored broad sand. Do not paint a rectangular grass path over it.
const tiles=rows.map(row=>row.join(''));
export const COVE_MAP=Object.freeze({
 id:'sea-cove',name:'海の入り江',tileSize:COVE_TILE_SIZE,
 width:COVE_WIDTH,height:COVE_HEIGHT,tiles:Object.freeze(tiles),
 entry:Object.freeze({x:28*32+16,y:29*32+16,face:1}),
 exit:Object.freeze({row:33,columns:Object.freeze([27,28,29])}),
 fisher:Object.freeze({id:'ushiohei',name:'潮平',x:22*32+16,y:16*32+16,face:3}),
 objects:Object.freeze([
  {kind:'basket',x:20,y:18},{kind:'barrel',x:18,y:19},
  {kind:'rocks',x:17,y:9},{kind:'rocks',x:13,y:25},
  // A sparse sequence of native, single-tile flowers leads through the
  // grass-to-beach transition without adding a trail overlay or blocking sand.
  {kind:'flowers',x:11,y:8,chip:3},{kind:'flowers',x:16,y:10,chip:10},
  {kind:'flowers',x:11,y:13,chip:9},{kind:'flowers',x:17,y:13,chip:1},
  {kind:'flowers',x:16,y:22,chip:8},{kind:'flowers',x:21,y:24,chip:4},
  {kind:'flowers',x:22,y:25,chip:5},{kind:'flowers',x:17,y:27,chip:12},
  {kind:'flowers',x:28,y:26,chip:11},{kind:'flowers',x:19,y:30,chip:6}
 ])
});
export function tileAt(x,y,map=COVE_MAP){
 return map.tiles[y]?.[x]??'~';
}
export function walkableCell(x,y,map=COVE_MAP){
 return Number.isInteger(x)&&Number.isInteger(y)&&
  ['g','s'].includes(tileAt(x,y,map));
}
export function walkablePoint(x,y,map=COVE_MAP){
 return Number.isFinite(x)&&Number.isFinite(y)&&walkableCell(Math.floor(x/map.tileSize),Math.floor(y/map.tileSize),map);
}
export function isSouthExit(x,y,map=COVE_MAP){
 return y===map.exit.row&&map.exit.columns.includes(x);
}
