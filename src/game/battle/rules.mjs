// First-game one-hero B-formula v2 rules. Pure game logic: no DOM, timers, or assets.
// Approved base/growth/T0–T6 values must match data/characters/hizuki-status.json.
import {VILLAGE_FINDS} from '../../../data/maps/hozuki-village/finds.mjs';

export const PLAYER_KEY='kikokuno-hanamusubi-battle-player';
export const BATTLE_REQUEST_KEY='kikokuno-hanamusubi-battle-request';
export const FIELD_RETURN_KEY='kikokuno-hanamusubi-battle-field-return';
export const STATUS_V2=Object.freeze({
  base:Object.freeze({hp:26,mp:12,attack:9,defense:6,speed:9}),
  growth:Object.freeze({hp:8,mp:1.3,attack:2.6,defense:1.6,speed:2}),
  equipment:Object.freeze([
    Object.freeze({id:'T0',attack:0,defense:0}),
    Object.freeze({id:'T1',attack:20,defense:14}),
    Object.freeze({id:'T2',attack:42,defense:30}),
    Object.freeze({id:'T3',attack:64,defense:46}),
    Object.freeze({id:'T4',attack:88,defense:64}),
    Object.freeze({id:'T5',attack:114,defense:84}),
    Object.freeze({id:'T6',attack:140,defense:104})
  ]),
  maxLevel:99
});
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const nonNegative=(n,defaultValue)=>Number.isFinite(n)?Math.max(0,Math.floor(n)):defaultValue;
const halfUp=n=>Math.floor(n+.5);
const roll=random=>clamp(Number(random()),0,.999999999);
export function nextLevelXp(lv){
  const level=clamp(Math.floor(lv),1,99);
  return level===1?32:Math.round(80*Math.pow(level,1.35));
}
export function levelStats(lv=1,equipmentTier='T0',awakening=0){
  lv=clamp(nonNegative(lv,1),1,99);
  const t=STATUS_V2.equipment.find(x=>x.id===equipmentTier)||STATUS_V2.equipment[0];
  const n=lv-1,b=STATUS_V2.base,g=STATUS_V2.growth;
  const stats={
    maxhp:halfUp(b.hp+g.hp*n),maxmp:halfUp(b.mp+g.mp*n),
    attack:halfUp(b.attack+g.attack*n)+t.attack,
    defense:halfUp(b.defense+g.defense*n)+t.defense,
    speed:halfUp(b.speed+g.speed*n)
  };
  if(awakening>=1){stats.maxhp+=20;stats.attack+=8;}
  if(awakening>=2){stats.defense+=8;stats.speed+=6;}
  // The third awakening remains story-defined and has no approved numeric bonus.
  return stats;
}
export function physicalDamage(attack,defense,random=Math.random){
  const atk=Math.max(0,Number(attack)||0),def=Math.max(0,Number(defense)||0);
  const base=Math.floor(atk/2-def/4);
  const withVariance=Math.floor(base*(1+(roll(random)-.5)/8));
  return Math.max(1,Math.floor(atk*.1),withVariance);
}
// Provisional first-village food stock: bought in the teahouse and usable in battle.
export const FOOD_ITEMS=Object.freeze({
  onigiri:Object.freeze({id:'onigiri',name:'おにぎり',price:8,heal:12}),
  dango:Object.freeze({id:'dango',name:'団子',price:16,heal:22})
});
// Four approved village-shop pieces replace the trial T1 bundle.
// The historical T0–T6 aggregate table above remains unchanged for reference.
export const EQUIPMENT_SLOTS=Object.freeze({weapon:'武器',body:'胴',head:'頭',feet:'足'});
export const STARTER_EQUIPMENT=Object.freeze({weapon:'starter-weapon',body:'starter-body',head:null,feet:null});
export const EQUIPMENT_ITEMS=Object.freeze({
 'starter-weapon':Object.freeze({id:'starter-weapon',name:'手持ちの刀',slot:'weapon',attack:0,defense:0,price:null}),
 'starter-body':Object.freeze({id:'starter-body',name:'緋月の旅装',slot:'body',attack:0,defense:0,price:null}),
 wakizashi:Object.freeze({id:'wakizashi',name:'脇差',slot:'weapon',attack:4,defense:0,price:40}),
 'padded-body':Object.freeze({id:'padded-body',name:'厚布の胴当て',slot:'body',attack:0,defense:4,price:32}),
 headband:Object.freeze({id:'headband',name:'鉢巻',slot:'head',attack:0,defense:2,price:20}),
 tabi:Object.freeze({id:'tabi',name:'足袋',slot:'feet',attack:0,defense:1,price:12})
});
export const ARMORY_STOCK=Object.freeze(['wakizashi','padded-body','headband','tabi'].map(id=>EQUIPMENT_ITEMS[id]));
function applyEquipmentStats(stats,equipment){
 const result={...stats};
 for(const [slot,id] of Object.entries(equipment||{})){
  const item=EQUIPMENT_ITEMS[id];
  if(item?.slot===slot){result.attack+=item.attack;result.defense+=item.defense;}
 }
 return result;
}
export function equipmentPreview(player,slot,id){
 const hero=normalizePlayer(player);
 if(!Object.hasOwn(EQUIPMENT_SLOTS,slot)||(id===null&&['weapon','body'].includes(slot))||
   (id!==null&&(EQUIPMENT_ITEMS[id]?.slot!==slot||!hero.equipmentInventory[id])))return null;
 return applyEquipmentStats(levelStats(hero.lv,hero.equipmentTier,hero.awakening),{...hero.equipment,[slot]:id});
}
export const HERB=Object.freeze({name:'薬草',heal:26});
export const ENEMIES=Object.freeze({
  // Initial field only. These are provisional first-area numbers, not the planned late regions.
  'field-oni':Object.freeze({id:'field-oni',name:'野の小鬼',asset:'assets/enemies/field-oni.png',hp:12,attack:7,defense:2,xp:8,gold:8}),
  'tanuki':Object.freeze({id:'tanuki',name:'化け狸',asset:'assets/enemies/tanuki.png',hp:6,attack:6,defense:2,xp:4,gold:4}),
  'onibi':Object.freeze({id:'onibi',name:'鬼火',asset:'assets/enemies/onibi.png',hp:16,attack:8,defense:2,xp:9,gold:8})
});
export const ACTIONS=Object.freeze(['attack','bloom','heal','herb','food','guard','flee']);
export const DEFAULT_PLAYER=Object.freeze({
  lv:1,hp:26,maxhp:26,mp:12,maxmp:12,attack:9,defense:6,speed:9,
  equipmentTier:'T0',awakening:0,balanceVersion:2,
  xp:0,gold:0,potions:3,foods:Object.freeze({onigiri:0,dango:0}),wins:0,completedBattles:0
});
export function normalizePlayer(input={}){
  const lv=clamp(nonNegative(input?.lv,1),1,99);
  const equipmentTier=STATUS_V2.equipment.some(x=>x.id===input?.equipmentTier)?input.equipmentTier:'T0';
  const awakening=clamp(nonNegative(input?.awakening,0),0,3);
  // Retired bundle owners keep their purchase as all four individual pieces.
  // This migration is idempotent and preserves HP, MP, money and progression.
  const hasInventory=input?.equipmentInventory&&typeof input.equipmentInventory==='object'&&!Array.isArray(input.equipmentInventory);
  const migrateBundle=!hasInventory&&(input?.ownsArmoryGear===true||equipmentTier==='T1');
  const inventory={};
  for(const id of Object.values(STARTER_EQUIPMENT))if(id)inventory[id]=1;
  for(const item of ARMORY_STOCK){
   inventory[item.id]=migrateBundle?1:clamp(nonNegative(input?.equipmentInventory?.[item.id],0),0,1);
  }
  const equippedBundle=migrateBundle&&equipmentTier==='T1';
  const savedEquipment=equippedBundle?Object.fromEntries(ARMORY_STOCK.map(item=>[item.slot,item.id])):input?.equipment;
  const equipment={};
  for(const [slot,fallback] of Object.entries(STARTER_EQUIPMENT)){
   const id=Object.hasOwn(savedEquipment||{},slot)?savedEquipment[slot]:fallback;
   equipment[slot]=((id===null&&['head','feet'].includes(slot))||
     (EQUIPMENT_ITEMS[id]?.slot===slot&&inventory[id]>0))?id:fallback;
  }
  const activeTier=equippedBundle?'T0':equipmentTier;
  const stats=applyEquipmentStats(levelStats(lv,activeTier,awakening),equipment);
  // No completed user-facing save system exists. Old battle-only data must not
  // import v1 combat stats into the approved v2 formula.
  const v2=input?.balanceVersion===2;
  const savedFinds=input?.foundItems??input?.roomFinds;
  return {
    lv,...stats, hp:v2?clamp(nonNegative(input.hp,stats.maxhp),0,stats.maxhp):stats.maxhp,
    mp:v2?clamp(nonNegative(input.mp,stats.maxmp),0,stats.maxmp):stats.maxmp,
    equipmentTier:activeTier,equipment,equipmentInventory:inventory,awakening,balanceVersion:2,
    foundItems:Array.isArray(savedFinds)?Object.keys(VILLAGE_FINDS).filter(id=>savedFinds.includes(id)):[],
    xp:nonNegative(input?.xp,0),gold:nonNegative(input?.gold,0),
    potions:nonNegative(input?.potions,3),
    foods:Object.fromEntries(Object.keys(FOOD_ITEMS).map(id=>[id,clamp(nonNegative(input?.foods?.[id],0),0,99)])),
    wins:nonNegative(input?.wins,0),
    // Older saves only tracked wins; retain them as the minimum number
    // of completed encounters rather than erasing past battle progress.
    completedBattles:nonNegative(input?.completedBattles,nonNegative(input?.wins,0))
  };
}
export function readPlayer(storage=globalThis.localStorage){
  try{return normalizePlayer(JSON.parse(storage?.getItem(PLAYER_KEY)||'null'));}catch{return normalizePlayer();}
}
export function savePlayer(player,storage=globalThis.localStorage){
  const value=normalizePlayer(player);
  try{storage?.setItem(PLAYER_KEY,JSON.stringify(value));}catch{}
  return value;
}
export function carriedConsumables(hero){
  return [
    {...HERB,kind:'herb',id:'herb',count:hero.potions},
    ...Object.values(FOOD_ITEMS).map(item=>({...item,kind:'food',count:hero.foods[item.id]}))
  ].filter(item=>item.count>0);
}
export function collectFind(player,id){
  const hero=normalizePlayer(player);
  if(!Object.hasOwn(VILLAGE_FINDS,id))
    return {accepted:false,player:hero,message:'何も見つからなかった。'};
  const site=VILLAGE_FINDS[id];
  if(hero.foundItems.includes(id)){
    return {accepted:false,player:hero,message:site.building?'もう何も入っていない。':'もう何も見つからない。'};
  }
  let name;
  if(site.gold){
    hero.gold+=site.gold;
    name=site.gold+'両';
  }else if(site.item==='herb'){
    ++hero.potions;
    name=HERB.name;
  }else{
    name=FOOD_ITEMS[site.item].name;
    if(hero.foods[site.item]>=99)
      return {accepted:false,player:hero,message:name+'を見つけた。持ちきれない。'};
    ++hero.foods[site.item];
  }
  hero.foundItems.push(id);
  return {accepted:true,player:hero,message:name+'を見つけた！'};
}
// Field consumables share the official battle recovery amounts.
export function useExplorationResource(player,kind,id=''){
  const hero=normalizePlayer(player);
  if(hero.hp>=hero.maxhp)return {accepted:false,player:hero,message:'体力は満ちている。'};
  let heal=0,source='';
  if(kind==='herb'){
    if(hero.potions===0)return {accepted:false,player:hero,message:'薬草がない。'};
    hero.potions--;heal=HERB.heal;source=HERB.name;
  }else if(kind==='food'&&Object.hasOwn(FOOD_ITEMS,id)){
    if(hero.foods[id]===0)return {accepted:false,player:hero,message:'持っていない。'};
    hero.foods[id]--;heal=FOOD_ITEMS[id].heal;source=FOOD_ITEMS[id].name;
  }else if(kind==='heal'){
    if(hero.mp<5)return {accepted:false,player:hero,message:'技が足りません。'};
    hero.mp-=5;heal=Math.ceil(hero.maxhp*.3);source='つむぎ';
  }else return {accepted:false,player:hero,message:'使用できません。'};
  const amount=Math.min(heal,hero.maxhp-hero.hp);
  hero.hp+=amount;
  return {accepted:true,player:hero,message:source+'で体力を'+amount+'回復した。'};
}
export function purchaseFood(player,id){
  const hero=normalizePlayer(player),item=FOOD_ITEMS[id];
  if(!Object.hasOwn(FOOD_ITEMS,id))return {accepted:false,player:hero,message:'商品を選んでください。'};
  if(hero.foods[id]>=99)return {accepted:false,player:hero,message:'もう持ちきれません。'};
  if(hero.gold<item.price)return {accepted:false,player:hero,message:'両が足りません。'};
  hero.gold-=item.price;hero.foods[id]++;
  return {accepted:true,player:hero,message:item.name+'を買いました。'};
}
export function purchaseArmory(player,id){
 const hero=normalizePlayer(player),item=ARMORY_STOCK.find(entry=>entry.id===id);
 if(!item)return {accepted:false,player:hero,message:'商品を選んでください。'};
 if(hero.equipmentInventory[id])return {accepted:false,player:hero,message:'その兵具はもう持っています。'};
 if(hero.gold<item.price)return {accepted:false,player:hero,message:'両が足りません。'};
 hero.gold-=item.price;
 hero.equipmentInventory[id]=1;
 return {accepted:true,player:hero,message:item.name+'を買いました。'};
}
export function changeEquipment(player,slot,id){
 const hero=normalizePlayer(player);
 if(hero.equipment[slot]===id||!equipmentPreview(hero,slot,id))
  return {accepted:false,player:hero,message:'装備を変更できない。'};
 const previous=hero.equipment[slot];
 const updated=normalizePlayer({...hero,equipment:{...hero.equipment,[slot]:id}});
 const name=id===null?EQUIPMENT_ITEMS[previous]?.name:EQUIPMENT_ITEMS[id].name;
 return {accepted:true,player:updated,message:name+(id===null?'を外した。':'を装備した。')};
}
export function chooseEnemy(steps=0){
  return ['field-oni','tanuki','onibi'][Math.floor(Math.max(0,steps)/8)%3];
}
// The first authored field route is Village -> Tenyo Shrine. Do not use the
// unreleased destinations or the archived game's area IDs as encounter zones.
// The live field remains safe against inventing enemies when walking off-route.
export function fieldEncounterZone(point,world){
  const road=world?.roads?.[0];
  if(!road?.length||!Number.isFinite(point?.x)||!Number.isFinite(point?.y))
    return 'village-outskirts';
  let closest=Infinity,index=0;
  for(let i=0;i<road.length;i++){
    const d=Math.hypot(point.x-road[i][0],point.y-road[i][1]);
    if(d<closest){closest=d;index=i;}
  }
  if(closest>32*4)return 'village-outskirts';
  return index>=Math.floor(road.length*.6)?'shrine-approach':'village-outskirts';
}
export function chooseFieldEncounter(point,world,random=Math.random){
  const zone=fieldEncounterZone(point,world),r=roll(random);
  const [enemyId,count]=zone==='shrine-approach'
    ?r<.20?['field-oni',1]:r<.65?['onibi',1]:['tanuki',2]
    :r<.55?['field-oni',1]:['tanuki',2];
  return {enemyId,count,zone};
}

export function createBattle(enemyId='field-oni',player=DEFAULT_PLAYER,random=Math.random,count=1){
  const original=ENEMIES[enemyId];
  if(!original)throw Error('Unknown encounter: '+enemyId);
  const hero=normalizePlayer(player);
  if(hero.hp===0)hero.hp=Math.max(1,Math.ceil(hero.maxhp/2));
  count=clamp(nonNegative(count,1),1,2);
  const enemies=Array.from({length:count},(_,index)=>({...original,instance:index}));
  const state={hero,enemies,enemy:enemies[0],phase:'command',turn:1,guarding:false,events:[],outcome:null};
  const event=(text,kind='info')=>state.events.push({text,kind});
  const alive=()=>enemies.filter(e=>e.hp>0);
  function finish(outcome){
    // Exactly once per concluded encounter, including retreat and defeat.
    // This drives the optional beach-shell replenishment every five battles.
    if(state.outcome!==null)return;
    hero.completedBattles++;
    state.phase='result';state.outcome=outcome;
  }
  function reward(){
    hero.wins++;
    const xp=enemies.reduce((s,e)=>s+e.xp,0),gold=enemies.reduce((s,e)=>s+e.gold,0);
    hero.xp+=xp;hero.gold+=gold;
    event(original.name+'を倒した！　心'+xp+'、'+gold+'両を獲得。','victory');
    while(hero.lv<STATUS_V2.maxLevel&&hero.xp>=nextLevelXp(hero.lv)){
      hero.xp-=nextLevelXp(hero.lv);hero.lv++;
      Object.assign(hero,applyEquipmentStats(levelStats(hero.lv,hero.equipmentTier,hero.awakening),hero.equipment));
      hero.hp=hero.maxhp;hero.mp=hero.maxmp;
      event('緋月は'+hero.lv+'段に上がった！','levelup');
    }
    finish('victory');
  }
  function enemyActions(guarding){
    for(const enemy of alive()){
      const raw=physicalDamage(enemy.attack,hero.defense,random);
      const damage=guarding?Math.max(1,Math.floor(raw/2)):raw;
      hero.hp=Math.max(0,hero.hp-damage);
      event(enemy.name+'の攻撃！ 緋月は'+damage+'の傷を負った。','hit');
      if(hero.hp===0){
        // Money is deducted once, at defeat; it is not restored on town return.
        const lost=Math.floor(hero.gold*.25);hero.gold-=lost;
        event('緋月は倒れた……'+lost+'両を失い、鬼灯村へ戻る。','defeat');
        finish('defeat');return;
      }
    }
    state.turn++;state.phase='command';
  }
  function act(command){
    if(state.phase!=='command')return {accepted:false,events:[],outcome:state.outcome};
    const [kind,indexText]=String(command||'').split(':');
    if(!ACTIONS.includes(kind))return {accepted:false,events:[],outcome:null};
    const hasTarget=indexText!==undefined,targetIndex=hasTarget?Number(indexText):enemies.findIndex(e=>e.hp>0);
    const target=enemies[targetIndex];
    if((kind==='attack'||kind==='bloom')&&(!target||target.hp<=0||!Number.isInteger(targetIndex)))
      return {accepted:false,events:[{text:'標的を選んでください。',kind:'warning'}],outcome:null};
    state.events=[];let guarding=false;
    if(kind==='attack'){
      const damage=physicalDamage(hero.attack,target.defense,random);
      target.hp=Math.max(0,target.hp-damage);
      event('緋月の攻撃！ '+target.name+'に'+damage+'の傷を与えた。','attack');
    }else if(kind==='bloom'){
      if(hero.lv<3)return {accepted:false,events:[{text:'糸遊は3段で習得する。',kind:'warning'}],outcome:null};
      if(hero.mp<3)return {accepted:false,events:[{text:'技が足りない。',kind:'warning'}],outcome:null};
      hero.mp-=3;
      target.hp=Math.max(0,target.hp-30);
      event('緋月の術・糸遊！ '+target.name+'に30の傷を与えた。','skill');
    }else if(kind==='heal'){
      if(hero.mp<5)return {accepted:false,events:[{text:'技が足りない。',kind:'warning'}],outcome:null};
      if(hero.hp>=hero.maxhp)return {accepted:false,events:[{text:'体力は満ちている。',kind:'warning'}],outcome:null};
      hero.mp-=5;
      const amount=Math.min(hero.maxhp-hero.hp,Math.ceil(hero.maxhp*.3));
      hero.hp+=amount;event('緋月はつむぎで体力を'+amount+'回復した。','heal');
    }else if(kind==='herb'){
      if(hero.potions===0)return {accepted:false,events:[{text:'薬草がない。',kind:'warning'}],outcome:null};
      if(hero.hp>=hero.maxhp)return {accepted:false,events:[{text:'体力は満ちている。',kind:'warning'}],outcome:null};
      hero.potions--;
      const amount=Math.min(hero.maxhp-hero.hp,HERB.heal);
      hero.hp+=amount;event('薬草を使い、体力を'+amount+'回復した。','heal');
    }else if(kind==='food'){
      if(!Object.hasOwn(FOOD_ITEMS,indexText))return {accepted:false,events:[{text:'食べ物を選んでください。',kind:'warning'}],outcome:null};
      const item=FOOD_ITEMS[indexText];
      if(!hero.foods[indexText])return {accepted:false,events:[{text:item.name+'を持っていない。',kind:'warning'}],outcome:null};
      if(hero.hp>=hero.maxhp)return {accepted:false,events:[{text:'体力は満ちている。',kind:'warning'}],outcome:null};
      hero.foods[indexText]--;
      const amount=Math.min(hero.maxhp-hero.hp,item.heal);
      hero.hp+=amount;event(item.name+'を食べ、体力を'+amount+'回復した。','heal');
    }else if(kind==='guard'){
      guarding=true;event('緋月は身構えた。','guard');
    }else if(kind==='flee'){
      const chance=clamp(.70+(hero.speed-9)*.0015,.70,.85);
      if(roll(random)<chance){
        finish('escape');
        event('緋月はうまく逃げ出した。','escape');
        return {accepted:true,events:state.events.slice(),outcome:state.outcome};
      }
      event('逃げ道を塞がれた！','warning');
    }
    if(!alive().length)reward(); else enemyActions(guarding);
    return {accepted:true,events:state.events.slice(),outcome:state.outcome};
  }
  return {state,act};
}
