import {FIELD_ENCOUNTER_PLAN_ENEMIES} from './encounter-plan.mjs?v=6';

import {ENEMIES} from '../../../src/game/battle/rules.mjs';

// Design values for the field map review, separate from live ENEMIES.
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
 'cove-oni':stats('shoreOni',29,18,6,38,24),
 'cove-jelly':stats('bubbleJelly',16,12,3,18,11),
 'cove-crab':stats('tideCrab',32,16,12,41,27),
 'bridge-kodama':stats('kodama',72,49,16,250,72),
 'bridge-lantern':stats('bridgeLantern',63,43,20,225,67),
 'edge-spider':stats('spider',70,48,14,230,64),
 'forest-kodama':stats('kodamaAutumn',138,78,26,360,110),
 'forest-spider':stats('spiderIndigo',98,67,20,290,84),
 'forest-leaf':stats('leafStalker',110,74,18,335,98),
 'falls-snake':stats('snake',190,124,50,620,195),
 'falls-child':stats('waterChild',135,103,44,490,154),
 'falls-bird':stats('sprayCormorant',146,111,42,560,176),
 'tunnel-bat':stats('caveBat',105,94,42,275,90),
 'tunnel-centipede':stats('caveCentipede',225,131,65,650,210),
 'tunnel-hermit':stats('crystalHermit',185,112,88,600,195),
 'pass-boar':stats('mountainBoar',235,145,56,720,230),
 'pass-crow':stats('mountainCrow',142,120,45,540,172),
 'pass-deer':stats('mistDeer',190,136,50,660,208),
 'ridge-fox':stats('fox',300,170,40,820,260),
 'shrine-shadow-fox':stats('shadowFox',470,178,57,1900,530)
};
