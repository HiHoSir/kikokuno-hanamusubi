import {FIELD_ENCOUNTER_PLAN_ENEMIES} from './encounter-plan.mjs?v=6';

// Initial values shared by the distribution trial and the actual battle.
const regionalEnemy=(id,key,hp,attack,defense,xp,gold)=>{
 const {name,asset,pixelArt,distribution}=FIELD_ENCOUNTER_PLAN_ENEMIES[key];
 return Object.freeze({id,name,asset,pixelArt,distribution,hp,attack,defense,xp,gold});
};
export const REGIONAL_ENEMIES=Object.freeze({
 'cove-crab':regionalEnemy('cove-crab','tideCrab',26,13,8,65,23),
 'bridge-lantern':regionalEnemy('bridge-lantern','bridgeLantern',36,24,12,100,36),
 'forest-leaf':regionalEnemy('forest-leaf','leafStalker',58,32,16,165,56),
 'falls-bird':regionalEnemy('falls-bird','sprayCormorant',70,38,17,255,82),
 'tunnel-hermit':regionalEnemy('tunnel-hermit','crystalHermit',68,35,40,325,100),
 'pass-deer':regionalEnemy('pass-deer','mistDeer',90,44,20,400,115),
});
