// Pure one-hero battle rules. No DOM, timers or assets.
export const PLAYER_KEY='kikokuno-hanamusubi-battle-player';
export const BATTLE_REQUEST_KEY='kikokuno-hanamusubi-battle-request';
export const FIELD_RETURN_KEY='kikokuno-hanamusubi-battle-field-return';

export const ENEMIES=Object.freeze({
  'field-oni':Object.freeze({id:'field-oni',name:'野の小鬼',asset:'assets/enemies/field-oni.png',hp:38,attack:8,defense:3,xp:14,gold:8}),
  'tanuki':Object.freeze({id:'tanuki',name:'化け狸',asset:'assets/enemies/tanuki.png',hp:31,attack:7,defense:2,xp:12,gold:7}),
  'onibi':Object.freeze({id:'onibi',name:'鬼火',asset:'assets/enemies/onibi.png',hp:27,attack:6,defense:1,xp:10,gold:5}),
});
export const ACTIONS=Object.freeze(['attack','bloom','heal','herb','guard','flee']);
export const DEFAULT_PLAYER=Object.freeze({
  lv:1,hp:48,maxhp:48,mp:12,maxmp:12,attack:13,defense:5,
  xp:0,gold:0,potions:3,wins:0
});
const nonNegative=(n,fallback)=>Number.isFinite(n)?Math.max(0,Math.floor(n)):fallback;
const randomRoll=(rand,n)=>Math.floor(Math.max(0,Math.min(.999999,rand()))*n);
export function normalizePlayer(input={}){
  const player={};
  for(const [key,value] of Object.entries(DEFAULT_PLAYER))
    player[key]=nonNegative(input?.[key],value);
  player.lv=Math.max(1,player.lv);
  player.maxhp=Math.max(1,player.maxhp);
  player.maxmp=Math.max(0,player.maxmp);
  player.hp=Math.min(player.hp,player.maxhp);
  player.mp=Math.min(player.mp,player.maxmp);
  return player;
}
export function readPlayer(storage=globalThis.localStorage){
  try{return normalizePlayer(JSON.parse(storage?.getItem(PLAYER_KEY)||'null'));}catch{return normalizePlayer();}
}
export function savePlayer(player,storage=globalThis.localStorage){
  const value=normalizePlayer(player);
  try{storage?.setItem(PLAYER_KEY,JSON.stringify(value));}catch{}
  return value;
}
export function chooseEnemy(steps=0){
  return ['field-oni','tanuki','onibi'][Math.floor(Math.max(0,steps)/8)%3];
}
export function createBattle(enemyId='field-oni',player=DEFAULT_PLAYER,random=Math.random){
  const enemyBase=ENEMIES[enemyId];
  if(!enemyBase)throw Error('Unknown encounter: '+enemyId);
  const hero=normalizePlayer(player);
  // A saved 0 HP cannot trap the player in a no-input battle.
  if(hero.hp===0)hero.hp=Math.max(1,Math.ceil(hero.maxhp/2));
  const enemy={...enemyBase};
  const state={hero,enemy,phase:'command',turn:1,guarding:false,events:[],outcome:null};
  function event(text,kind='info'){state.events.push({text,kind});}
  function reward(){
    hero.wins++;hero.xp+=enemy.xp;hero.gold+=enemy.gold;
    event(enemy.name+'を倒した！　経験値'+enemy.xp+'、銭'+enemy.gold+'を獲得。','victory');
    while(hero.xp>=hero.lv*40){
      hero.xp-=hero.lv*40;hero.lv++;hero.maxhp+=10;hero.maxmp+=3;
      hero.attack+=2;hero.defense+=1;hero.hp=hero.maxhp;hero.mp=hero.maxmp;
      event('緋月は'+hero.lv+'段に上がった！','levelup');
    }
    state.phase='result';state.outcome='victory';
  }
  function enemyAction(guarding){
    const incoming=Math.max(1,enemy.attack-Math.floor(hero.defense/2)+randomRoll(random,4));
    const damage=guarding?Math.max(1,Math.ceil(incoming*.5)):incoming;
    hero.hp=Math.max(0,hero.hp-damage);
    event(enemy.name+'の攻撃！ 緋月は'+damage+'の傷を負った。','hit');
    if(hero.hp===0){
      state.phase='result';state.outcome='defeat';
      event('緋月は倒れた……鬼灯村へ戻る。','defeat');
    }else {state.turn++;state.phase='command';}
  }
  function act(command){
    if(state.phase!=='command')return {accepted:false,events:[],outcome:state.outcome};
    if(!ACTIONS.includes(command))return {accepted:false,events:[],outcome:null};
    state.events=[];let guarded=false;
    if(command==='attack'){
      const damage=Math.max(1,hero.attack+randomRoll(random,7)-Math.floor(enemy.defense/2));
      enemy.hp=Math.max(0,enemy.hp-damage);
      event('緋月の攻撃！ '+enemy.name+'に'+damage+'の傷を与えた。','attack');
    }else if(command==='bloom'){
      if(hero.mp<4)return {accepted:false,events:[{text:'術力が足りない。',kind:'warning'}],outcome:null};
      hero.mp-=4;
      const damage=20+hero.lv*3+randomRoll(random,8);
      enemy.hp=Math.max(0,enemy.hp-damage);
      event('緋月の秘術・花焔！ '+damage+'の傷を与えた。','skill');
    }else if(command==='heal'){
      if(hero.mp<3)return {accepted:false,events:[{text:'術力が足りない。',kind:'warning'}],outcome:null};
      if(hero.hp===hero.maxhp)return {accepted:false,events:[{text:'体力は満ちている。',kind:'warning'}],outcome:null};
      hero.mp-=3;
      const amount=Math.min(hero.maxhp-hero.hp,18+hero.lv*2);
      hero.hp+=amount;event('緋月は癒しの術で体力を'+amount+'回復した。','heal');
    }else if(command==='herb'){
      if(hero.potions===0)return {accepted:false,events:[{text:'薬草がない。',kind:'warning'}],outcome:null};
      if(hero.hp===hero.maxhp)return {accepted:false,events:[{text:'体力は満ちている。',kind:'warning'}],outcome:null};
      hero.potions--;
      const amount=Math.min(hero.maxhp-hero.hp,26);
      hero.hp+=amount;event('薬草を使い、体力を'+amount+'回復した。','heal');
    }else if(command==='guard'){
      guarded=true;event('緋月は身構えた。','guard');
    }else if(command==='flee'){
      if(random()<.75){
        state.phase='result';state.outcome='escape';
        event('緋月はうまく逃げ出した。','escape');
        return {accepted:true,events:state.events.slice(),outcome:state.outcome};
      }
      event('逃げ道を塞がれた！','warning');
    }
    if(enemy.hp===0)reward();
    else enemyAction(guarded);
    return {accepted:true,events:state.events.slice(),outcome:state.outcome};
  }
  return {state,act};
}
