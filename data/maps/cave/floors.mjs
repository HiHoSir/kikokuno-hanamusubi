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
  // South entrance, the original raised steps to the north, and an eastern
  // alcove that branches off the main path before the recessed stairwell.
  grid:terrain(26,[
   [],[[7,10]],[[6,11]],[[5,12]],[[4,12],[18,21]],
   [[3,15],[17,23]],[[3,23]],[[4,16],[18,22]],[[7,13],[19,21]],
   [[6,15]],[[5,17]],[[5,17]],[[6,15]],[[6,14]],[[8,10]]
  ]),
  entry:[9,13],exit:[9,14],
  down:{kind:'down',origin:[11,9],approach:[12,11]},
  scenery:[{kind:'rise',origin:[8,1]},{kind:'ledge',origin:[19,6]}]
 },
 {
  // Two passages around a rock mass. Both reach the east chamber, where the
  // stairwell opens south; a solid spur separates its lip from the east wall.
  grid:terrain(30,[
   [],[[7,11]],[[5,15]],[[4,18]],[[4,9],[13,21]],
   [[3,8],[17,25]],[[3,8],[19,26]],[[3,8],[20,27]],[[3,8],[20,27]],
   [[4,8],[19,26]],[[4,9],[18,25]],[[4,9],[17,24]],
   [[5,10],[15,23]],[[5,23]],[[5,22]],[[6,20]],
   [[6,13]],[[6,11]],[[6,11]],[[8,10]],[]
  ]),
  up:{kind:'up',origin:[7,17],approach:[7,18]},
  down:{kind:'down',origin:[23,6],approach:[24,8]},
  scenery:[{kind:'ledge',origin:[6,8]},{kind:'ledge',origin:[15,13]}]
 },
 {
  // A bent approach opens into the guardian's room. The alcoves flank the
  // arena without cutting off its way back to the previous stair.
  grid:terrain(26,[
   [],[],[[8,13]],[[6,15]],[[5,17]],[[4,18]],
   [[3,19]],[[3,20]],[[4,20]],[[6,19]],[[8,17]],
   [[10,15]],[[12,16]],[[13,18]],[[14,20]],[[15,21]],
   [[16,21]],[[17,21]],[[17,21]],[]
  ]),
  up:{kind:'up',origin:[18,17],approach:[18,18]},
  boss:[11,6],
  scenery:[{kind:'ledge',origin:[6,8]},{kind:'ledge',origin:[17,8]}]
 }
];

export const CAVE_FLOORS=floors.map(floor=>({
 ...floor,entry:floor.up?.approach??floor.entry,
 features:[floor.up,floor.down,...floor.scenery].filter(Boolean)
}));

export const caveCellCenter=cell=>cell.map(value=>(value+.5)*CAVE_TILE);
export const caveCellOpen=(floor,x,y)=>CAVE_FLOORS[floor]?.grid[y]?.[x]==='.';

// Hard shapes constrain feet independently of the art's transparent outline.
// Stairs, floor holes and raised stone use the prototype's distinct footprints.
export function caveFeatureBlocks({kind,origin},x,y){
 const px=x-origin[0]*CAVE_TILE,py=y-origin[1]*CAVE_TILE;
 switch(kind){
  case 'down':return ((px-48)/36)**2+((py-48)/35)**2<1;
  case 'up':return px>6&&px<93&&py>5&&py<94&&!(px<34&&py>68);
  case 'rise':return Math.abs(px-48)<34&&py>12&&py<86.4;
  default:return false;
 }
}

export function caveStairAt(floor,x,y){
 return CAVE_FLOORS[floor].features.find(({approach})=>{
  if(!approach)return false;
  const [cx,cy]=caveCellCenter(approach);
  return Math.hypot(x-cx,y-cy)<24;
 });
}
