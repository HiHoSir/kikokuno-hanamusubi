// [enemy id, formation size, weight]. Definitions without an adopted sprite
// stay in the plan. The runtime and map normalize weights for available enemies.
export const ENCOUNTER_POOLS={
 'village-outskirts':[['field-oni',1,55],['tanuki',2,45]],
 'shrine-approach':[['field-oni',1,20],['onibi',1,45],['tanuki',2,35]],
 'coast':[['cove-crab',1,25],['cove-oni',1,30],['cove-jelly',1,25],['cove-jelly',2,20]],
 'north-bank':[['bridge-lantern',1,45],['bridge-kodama',1,55]],
 'forest-edge':[['bridge-kodama',1,45],['edge-spider',1,55]],
 'forest-depths':[['forest-leaf',1,100]],
 'waterfall':[['falls-bird',1,35],['falls-snake',1,30],['falls-child',1,35]],
 'shrine-cave':[['field-oni',1,30],['onibi',1,45],['tanuki',2,25]],
 'mountain-cave':[['tunnel-bat',1,20],['tunnel-bat',2,15],['tunnel-hermit',1,35],['tunnel-centipede',1,30]],
 'ridge':[['pass-deer',1,40],['pass-boar',1,30],['pass-crow',1,30]],
 'fox-approach':[['ridge-fox',1,100]]
};

export function fieldRegionAt(x,y){
 if(y<=12&&x>=26&&x<=45)return 'fox-approach';
 if(y<=24&&x<48)return 'ridge';
 if(y<=24)return 'waterfall';
 if(y<=32)return 'forest-depths';
 if(y<=35&&x>=55)return 'forest-edge';
 if(y<=43)return 'north-bank';
 if(x>=44&&y<=55)return 'coast';
 return null;
}

export function encounterFormations(zone,enemies){
 return ENCOUNTER_POOLS[zone].filter(([id])=>Object.hasOwn(enemies,id));
}
