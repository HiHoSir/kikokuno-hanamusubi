// First-game one-hero B-formula v2 rules. Pure game logic: no DOM, timers, or assets.
// Approved base/growth/T0–T6 values must match data/characters/hizuki-status.json.
export const PLAYER_KEY='kikokuno-hanamusubi-field-comparison-battle-player';
export const BATTLE_REQUEST_KEY='kikokuno-hanamusubi-field-comparison-battle-request';
export const FIELD_RETURN_KEY='kikokuno-hanamusubi-field-comparison-battle-field-return';
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
export function nextLevelXp(lv){return Math.round(80*Math.pow(clamp(Math.floor(lv),1,99),1.35));}
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
// One early equipment tier is available from the existing armory interior.
// Price and item name are playtest values, not a final equipment catalog.
export const ARMORY_STOCK=Object.freeze({id:'starter-gear',name:'旅の兵具一式',price:200,tier:'T1'});
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
  xp:0,gold:0,potions:3,foods:Object.freeze({onigiri:0,dango:0}),wins:0
});
export function normalizePlayer(input={}){
  const lv=clamp(nonNegative(input?.lv,1),1,99);
  const equipmentTier=STATUS_V2.equipment.some(x=>x.id===input?.equipmentTier)?input.equipmentTier:'T0';
  const awakening=clamp(nonNegative(input?.awakening,0),0,3);
  const stats=levelStats(lv,equipmentTier,awakening);
  // No completed user-facing save system exists. Old battle-only data must not
  // import v1 combat stats into the approved v2 formula.
  const v2=input?.balanceVersion===2;
  return {
    lv,...stats, hp:v2?clamp(nonNegative(input.hp,stats.maxhp),0,stats.maxhp):stats.maxhp,
    mp:v2?clamp(nonNegative(input.mp,stats.maxmp),0,stats.maxmp):stats.maxmp,
    equipmentTier,awakening,balanceVersion:2,
    xp:nonNegative(input?.xp,0),gold:nonNegative(input?.gold,0),
    potions:nonNegative(input?.potions,3),
    foods:Object.fromEntries(Object.keys(FOOD_ITEMS).map(id=>[id,clamp(nonNegative(input?.foods?.[id],0),0,99)])),
    wins:nonNegative(input?.wins,0)
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
// Field consumables share the official battle recovery amounts.
export function useExplorationResource(player,kind,id=''){
  const hero=normalizePlayer(player);
  if(hero.hp>=hero.maxhp)return {accepted:false,player:hero,message:'体力は満ちている。'};
  let heal=0,source='';
  if(kind==='herb'){
    if(hero.potions===0)return {accepted:false,player:hero,message:'薬草がない。'};
    hero.potions--;heal=26;source='薬草';
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
export function purchaseArmory(player){
  const hero=normalizePlayer(player),item=ARMORY_STOCK;
  if(hero.equipmentTier!=='T0')return {accepted:false,player:hero,message:'その兵具はもう揃っています。'};
  if(hero.gold<item.price)return {accepted:false,player:hero,message:'両が足りません。'};
  const updated=normalizePlayer({...hero,gold:hero.gold-item.price,equipmentTier:item.tier});
  return {accepted:true,player:updated,message:item.name+'を身につけました。'};
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
  function reward(){
    hero.wins++;
    const xp=enemies.reduce((s,e)=>s+e.xp,0),gold=enemies.reduce((s,e)=>s+e.gold,0);
    hero.xp+=xp;hero.gold+=gold;
    event(original.name+'を倒した！　心'+xp+'、'+gold+'両を獲得。','victory');
    while(hero.lv<STATUS_V2.maxLevel&&hero.xp>=nextLevelXp(hero.lv)){
      hero.xp-=nextLevelXp(hero.lv);hero.lv++;
      Object.assign(hero,levelStats(hero.lv,hero.equipmentTier,hero.awakening));
      hero.hp=hero.maxhp;hero.mp=hero.maxmp;
      event('緋月は'+hero.lv+'段に上がった！','levelup');
    }
    state.phase='result';state.outcome='victory';
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
        state.phase='result';state.outcome='defeat';return;
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
      const amount=Math.min(hero.maxhp-hero.hp,26);
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
        state.phase='result';state.outcome='escape';
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
