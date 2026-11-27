// Replay battle rules with draft enemies on cloned battle instances.
import {nextLevelXp} from '../src/game/battle/rules.mjs';
import {createTrialBattle,TIDE_TRIAL_KIT as tideKit,HOZUKI_TRIAL_KIT as hozukiKit,REGIONAL_TRIAL_REFERENCES} from './field-encounter-trial.mjs';
import {FIELD_ENCOUNTER_BALANCE_DRAFT} from '../data/maps/field/encounter-balance-draft.mjs';

const cases=[
 ...Object.entries(REGIONAL_TRIAL_REFERENCES).map(([id,{label,player}])=>({
  id,lv:player.lv,kit:label,player
 })),
 {id:'cove-crab',lv:2,kit:'旅立ちの装備',player:{}},
 {id:'bridge-lantern',lv:4,kit:'鬼灯村の装備4点',player:hozukiKit},
 {id:'cove-oni',lv:3,kit:'鬼灯村の4点',player:hozukiKit},
 {id:'cove-jelly',lv:3,kit:'鬼灯村の4点',player:hozukiKit,count:2},
 {id:'bridge-kodama',lv:5,kit:'潮待村の4点',player:tideKit},
 {id:'bridge-kodama',lv:12,kit:'潮待村の4点',player:tideKit},
 {id:'bridge-kodama',lv:15,kit:'潮待村の4点',player:tideKit},
 {id:'edge-spider',lv:15,kit:'潮待村の4点',player:tideKit},
 {id:'forest-kodama',lv:15,kit:'潮待村の4点',player:tideKit},
 {id:'forest-kodama',lv:18,kit:'T3試算',player:{equipmentTier:'T3'}},
 {id:'forest-spider',lv:18,kit:'T3試算',player:{equipmentTier:'T3'}},
 {id:'forest-spider',lv:18,kit:'T3試算',player:{equipmentTier:'T3'},count:2},
 {id:'forest-spider',lv:18,kit:'潮待村の4点',player:tideKit,count:2},
 {id:'falls-snake',lv:25,kit:'T5試算',player:{equipmentTier:'T5'}},
 {id:'falls-child',lv:25,kit:'T5試算',player:{equipmentTier:'T5'}},
 {id:'tunnel-bat',lv:26,kit:'T5試算',player:{equipmentTier:'T5'},count:2},
 {id:'tunnel-centipede',lv:26,kit:'T5試算',player:{equipmentTier:'T5'}},
 {id:'pass-boar',lv:28,kit:'T5試算',player:{equipmentTier:'T5'}},
 {id:'pass-crow',lv:28,kit:'T5試算',player:{equipmentTier:'T5'}},
 {id:'ridge-fox',lv:30,kit:'T6試算',player:{equipmentTier:'T6'}},
 {id:'shrine-shadow-fox',lv:30,kit:'T6試算',player:{equipmentTier:'T6'}}
];
function simulate(enemy,count,player,random){
 const fight=createTrialBattle(enemy,count,player,random);
 const {hero}=fight.state;
 const health=hero.hp;
 let attacks=0;
 let damage=0;
 while(!fight.state.outcome){
  const result=fight.act('attack');
  damage+=result.events.filter(e=>e.kind==='hit')
    .reduce((sum,e)=>sum+Number(e.text.match(/緋月は(\d+)の傷/)?.[1]??0),0);
  attacks++;
  if(!result.accepted||attacks>500)throw Error('Battle could not finish');
  if(fight.state.outcome==='defeat')damage=Math.min(damage,health);
 }
 return {attacks,damage,outcome:fight.state.outcome};
}
function rng(seed){
 return ()=>{
  seed=(Math.imul(1664525,seed)+1013904223)>>>0;
  return seed/0x100000000;
 };
}
const rows=cases.map(({id,lv,kit,player,count=1})=>{
 const enemy=FIELD_ENCOUNTER_BALANCE_DRAFT[id];
 const won=simulate(enemy,count,{...player,lv},()=>.5);
 const sample=Array.from({length:256},(_,index)=>simulate(enemy,count,{...player,lv},rng(index*9151+1)));
 return {enemy:enemy.name,count,lv,kit,
  attacks:won.attacks,damage:won.damage,win:won.outcome==='victory',
  defeats:sample.filter(result=>result.outcome==='defeat').length,
  nextLevelFights:Math.ceil(nextLevelXp(lv)/(enemy.xp*count)),
  xp:enemy.xp*count,gold:enemy.gold*count};
});
console.table(rows);
