import {FIELD_ENCOUNTER_PLAN_ENEMIES} from './encounter-plan.mjs?v=3';

// Design values for the field map review, separate from live ENEMIES.
const stats=(enemy,hp,attack,defense,xp,gold)=>({
 enemy,name:FIELD_ENCOUNTER_PLAN_ENEMIES[enemy].name,hp,attack,defense,xp,gold
});
export const FIELD_ENCOUNTER_BALANCE_DRAFT={
 'bridge-kodama':stats('kodama',72,49,16,250,72),
 'edge-spider':stats('spider',70,48,14,230,64),
 'forest-kodama':stats('kodamaAutumn',138,78,26,360,110),
 'forest-spider':stats('spiderIndigo',98,67,20,290,84),
 'falls-snake':stats('snake',190,124,50,620,195),
 'falls-child':stats('waterChild',135,103,44,490,154),
 'ridge-fox':stats('fox',300,170,40,820,260)
};
