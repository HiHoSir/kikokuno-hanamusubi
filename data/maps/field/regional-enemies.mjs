import {FIELD_ENCOUNTER_PLAN_ENEMIES} from './encounter-plan.mjs?v=7';

// Initial values shared by the distribution trial and the actual battle.
const regionalEnemy=(id,key,hp,attack,defense,xp,gold)=>{
 const {name,asset,pixelArt,filter,distribution}=FIELD_ENCOUNTER_PLAN_ENEMIES[key];
 return Object.freeze({id,name,asset,pixelArt,filter,distribution,hp,attack,defense,xp,gold});
};
export const REGIONAL_ENEMIES=Object.freeze({
 'cove-oni':regionalEnemy('cove-oni','shoreOni',26,15,5,52,24),
 'cove-jelly':regionalEnemy('cove-jelly','bubbleJelly',12,10,3,28,11),
 'bridge-kodama':regionalEnemy('bridge-kodama','kodama',38,25,11,95,36),
 'edge-spider':regionalEnemy('edge-spider','spider',40,28,11,108,40),
 'forest-kodama':regionalEnemy('forest-kodama','kodamaAutumn',63,31,18,170,57),
 'forest-spider':regionalEnemy('forest-spider','spiderIndigo',33,28,12,93,31),
 'falls-snake':regionalEnemy('falls-snake','snake',77,40,19,275,90),
 'falls-child':regionalEnemy('falls-child','waterChild',62,35,15,230,76),
 'ridge-fox':regionalEnemy('ridge-fox','fox',105,48,25,455,125),
 'cove-crab':regionalEnemy('cove-crab','tideCrab',26,13,8,65,23),
 'bridge-lantern':regionalEnemy('bridge-lantern','bridgeLantern',36,24,12,100,36),
 'forest-leaf':regionalEnemy('forest-leaf','leafStalker',58,32,16,165,56),
 'falls-bird':regionalEnemy('falls-bird','sprayCormorant',70,38,17,255,82),
 'tunnel-hermit':regionalEnemy('tunnel-hermit','crystalHermit',68,35,40,325,100),
 'pass-deer':regionalEnemy('pass-deer','mistDeer',90,44,20,400,115),
});
