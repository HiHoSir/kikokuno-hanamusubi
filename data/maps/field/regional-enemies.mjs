import {FIELD_ENCOUNTER_PLAN_ENEMIES} from './encounter-plan.mjs?v=6';

// Initial values shared by the distribution trial and the actual battle.
const regionalEnemy=(id,key,hp,attack,defense,xp,gold)=>{
 const {name,asset,pixelArt,distribution}=FIELD_ENCOUNTER_PLAN_ENEMIES[key];
 return Object.freeze({id,name,asset,pixelArt,distribution,hp,attack,defense,xp,gold});
};
export const REGIONAL_ENEMIES=Object.freeze({
 'cove-crab':regionalEnemy('cove-crab','tideCrab',32,16,12,41,27),
 'bridge-lantern':regionalEnemy('bridge-lantern','bridgeLantern',63,43,20,225,67),
 'forest-leaf':regionalEnemy('forest-leaf','leafStalker',110,74,18,335,98),
 'falls-bird':regionalEnemy('falls-bird','sprayCormorant',146,111,42,560,176),
 'tunnel-hermit':regionalEnemy('tunnel-hermit','crystalHermit',185,112,88,600,195),
 'pass-deer':regionalEnemy('pass-deer','mistDeer',190,136,50,660,208),
});
