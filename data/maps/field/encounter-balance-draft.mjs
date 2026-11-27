import {FIELD_ENCOUNTER_PLAN_ENEMIES} from './encounter-plan.mjs?v=7';

import {ENEMIES} from '../../../src/game/battle/rules.mjs?v=regional-1-promotion-pace-1-balance-1-pools-1';

// Design values for the field map review, with the six regional enemies reading their shared initial values.
const stats=(enemy,hp,attack,defense,xp,gold)=>({
 enemy,name:FIELD_ENCOUNTER_PLAN_ENEMIES[enemy].name,hp,attack,defense,xp,gold
});
const live=(enemy,id)=>{
 const {hp,attack,defense,xp,gold}=ENEMIES[id];
 return stats(enemy,hp,attack,defense,xp,gold);
};
export const FIELD_ENCOUNTER_BALANCE_DRAFT={
 'early-oni':live('oni','field-oni'),
 'early-tanuki':live('tanuki','tanuki'),
 'early-onibi':live('onibi','onibi'),
 'cave-guardian':live('caveGuardian','cave-guardian'),
 'cove-oni':live('shoreOni','cove-oni'),
 'cove-jelly':live('bubbleJelly','cove-jelly'),
 'cove-crab':live('tideCrab','cove-crab'),
 'bridge-kodama':live('kodama','bridge-kodama'),
 'bridge-lantern':live('bridgeLantern','bridge-lantern'),
 'edge-spider':live('spider','edge-spider'),
 'forest-kodama':live('kodamaAutumn','forest-kodama'),
 'forest-spider':live('spiderIndigo','forest-spider'),
 'forest-leaf':live('leafStalker','forest-leaf'),
 'falls-snake':live('snake','falls-snake'),
 'falls-child':live('waterChild','falls-child'),
 'falls-bird':live('sprayCormorant','falls-bird'),
 'tunnel-bat':stats('caveBat',31,29,12,150,45),
 'tunnel-centipede':stats('caveCentipede',71,38,24,315,98),
 'tunnel-hermit':live('crystalHermit','tunnel-hermit'),
 'pass-boar':stats('mountainBoar',98,45,22,415,118),
 'pass-crow':stats('mountainCrow',72,40,17,345,102),
 'pass-deer':live('mistDeer','pass-deer'),
 'ridge-fox':live('fox','ridge-fox'),
 'shrine-shadow-fox':stats('shadowFox',470,178,57,1900,530)
};
