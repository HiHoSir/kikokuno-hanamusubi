import {CAVE_WHITE_SEAL,CAVE_BLACK_SEAL} from './finds.mjs?v=guardian-1';

export const CAVE_TILE=48;
export const CAVE_BOSS_ID='cave-guardian';
export const CAVE_TOOL_NAME='岩砕きの槌';

// Each pair is an inclusive run of floor cells. Separate runs leave solid
// rock between passages. The same grid drives the prototype's cliff mask.
function terrain(width,runs){
 return runs.map(row=>Array.from({length:width},(_,col)=>
   row.some(([left,right])=>col>=left&&col<=right)?'.':'#').join(''));
}

const floors=[
 {
  // The west galleries lead past the stores and an inscription. The
  // southeast route leads straight to the stairs, below the return ledge.
  grid:terrain(26,[
   [],[[4,7]],[[3,8],[11,21]],[[3,7],[11,22]],[[4,7],[11,12],[19,22]],
   [[4,12],[19,23]],[[4,12],[18,23]],[[4,5],[8,12],[18,23]],
   [[4,5],[8,11],[19,22]],[[4,5],[8,9],[20,21]],[[4,9],[14,21]],
   [[4,9],[14,21]],[[4,5],[14,15],[18,20]],[[4,5],[14,17]],
   [[4,5],[14,17]],[[4,19]],[[4,15]],[[8,10]],[[8,10]],
   [[8,10]],[[8,10]]
  ]),
  entry:[9,19],exit:[9,20],
  down:{kind:'down',origin:[20,5],approach:[21,7]},
  danger:(x,y)=>x>=13&&y>=8&&y<=16,
  visibilityRadius:340,
  scenery:[
   {kind:'ledge',origin:[6,3]},
   {kind:'cache',origin:[6,2],id:'cave-entry-shelf'},
   {kind:'inscription',origin:[10,5],text:'刻まれた文字。「下の階で、白を沈めよ。続いて黒を沈めれば道はひらく」'},
   {kind:'inscription',origin:[16,13],text:'荷運び人の刻み跡。「東の段から下りれば、入口までひと息。荷を担いで登るのは無理だ」'},
   {kind:'drop',origin:[19,12],landing:[19,15]}
  ]
 },
 {
  // Two passages around a rock mass. Both reach the east chamber, where the
  // stairwell opens south; a solid spur separates its lip from the east wall.
  grid:terrain(30,[
   [],[[7,11]],[[5,15]],[[4,18]],[[4,9],[13,21]],
   [[3,8],[17,25]],[[3,8],[19,26]],[[3,8],[20,27]],[[3,8],[20,27]],
   [[4,8],[19,26]],[[4,9],[18,25]],[[4,9],[17,24]],
   [[5,10],[15,23]],[[5,23]],[[5,22]],[[6,20]],
   [[6,13]],[[6,8]],[[6,9]],[[8,10]],[]
  ]),
  up:{kind:'up',origin:[7,17],approach:[7,18]},
  down:{kind:'down',origin:[23,6],approach:[24,8]},
  danger:(x,y)=>x>=9&&y>=10&&y<=16,
  scenery:[{kind:'cache',origin:[9,2],id:'cave-upper-passage'},
   {kind:'seal',origin:[11,2],id:CAVE_WHITE_SEAL},
   {kind:'seal',origin:[12,15],id:CAVE_BLACK_SEAL}],
  shortcut:[[6,14,16],[7,9,19]],
  hiddenCache:{kind:'cache',origin:[15,6],id:'cave-sealed-passage'}
 },
 {
  // A bent approach opens into the guardian's room. The alcoves flank the
  // arena without cutting off its way back to the previous stair.
  grid:terrain(26,[
   [],[],[[8,13]],[[6,15]],[[5,17]],[[4,18]],
   [[3,19]],[[3,20]],[[4,20]],[[6,19]],[[8,17]],
   [[9,15]],[[8,11],[12,16]],[[8,10],[13,18]],[[14,20]],[[15,21]],
   [[16,21]],[[17,19]],[[17,21]],[]
  ]),
  up:{kind:'up',origin:[18,17],approach:[18,18]},
  boss:[11,6],
  scenery:[{kind:'cache',origin:[9,13],id:'cave-guardian-alcove'}]
 }
];

export const CAVE_FLOORS=floors.map(floor=>({
 ...floor,entry:floor.up?.approach??floor.entry,
 features:[floor.up,floor.down,...floor.scenery].filter(Boolean)
}));

export const caveCellCenter=cell=>cell.map(value=>(value+.5)*CAVE_TILE);
export const caveCellOpen=(floor,x,y)=>CAVE_FLOORS[floor]?.grid[y]?.[x]==='.';

// Hard shapes constrain feet independently of the art's transparent outline.
// Upper stairs and floor holes use the prototype's distinct footprints.
export function caveFeatureBlocks({kind,origin},x,y){
 const px=x-origin[0]*CAVE_TILE,py=y-origin[1]*CAVE_TILE;
 if(kind==='down')return ((px-48)/36)**2+((py-48)/35)**2<1;
 if(['cache','seal','inscription'].includes(kind))return Math.hypot(px-24,py-24)<18;
 if(kind==='up')return px>6&&px<93&&py>5&&py<94&&!(px<34&&py>=64);
 return false;
}

// Use the visible shore of the floor hole or the foot of the upper stair.
// The arrival cell is independent of where the player approaches it.
export function caveStairAt(floor,x,y){
 return CAVE_FLOORS[floor].features.find(stair=>{
  const px=x-stair.origin[0]*CAVE_TILE,py=y-stair.origin[1]*CAVE_TILE;
  if(caveFeatureBlocks(stair,x,y))return false;
  if(stair.kind==='down')return Math.hypot(px-48,py-48)<=82;
  if(stair.kind==='up')return px>=-14&&px<=52&&py>=53&&py<=111;
  return false;
 });
}

// Measure walking in marked passages only; landings and treasure alcoves are quiet.
export function caveEncounterTerrain(floor,x,y){
 const col=Math.floor(x/CAVE_TILE),row=Math.floor(y/CAVE_TILE);
 return caveCellOpen(floor,col,row)&&Boolean(CAVE_FLOORS[floor].danger?.(col,row));
}

// Opening a route changes both its drawn edges and its walking grid.
export function caveLayout(floor,foundItems){
 const base=CAVE_FLOORS[floor];
 if(!base.shortcut||!foundItems.includes(CAVE_BLACK_SEAL))return base;
 const grid=base.grid.slice();
 for(const [row,left,right] of base.shortcut)
  grid[row]=grid[row].slice(0,left)+'.'.repeat(right-left+1)+grid[row].slice(right+1);
 return {...base,grid,features:[...base.features,base.hiddenCache]};
}
