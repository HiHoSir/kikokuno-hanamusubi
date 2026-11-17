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
const clusters=[
  [4,4,5,4],[10,2,5,4],[17,3,6,4],[4,15,5,6],
  [9,17,5,4],[4,23,5,3],[12,27,4,4],[21,27,5,4]
];
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
    if(clusters.some(([left,top,w,h])=>x>=left&&x<left+w&&y>=top&&y<top+h))return 't';
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
  {kind:'flowers',x:17,y:13},{kind:'flowers',x:22,y:25},
  {kind:'flowers',x:28,y:26}
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
