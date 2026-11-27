import {createBattle} from '../src/game/battle/rules.mjs';
import {SHIOMACHI_ARMORY_STOCK} from '../data/maps/shiomachi-village/armory.mjs';

export const TIDE_TRIAL_KIT={
 equipment:Object.fromEntries(SHIOMACHI_ARMORY_STOCK.map(item=>[item.slot,item.id])),
 equipmentInventory:Object.fromEntries(SHIOMACHI_ARMORY_STOCK.map(item=>[item.id,1]))
};

export function createTrialBattle(enemy,count,player,random=Math.random){
 const fight=createBattle('field-oni',player,random,count);
 for(const target of fight.state.enemies)Object.assign(target,enemy);
 return fight;
}

export function addBattleTrial({host,enemy,portrait,element,count=1,deep=false}){
 const launch=element('button',count===2?'2体と試しに戦う':'試しに戦う',host);
 launch.type='button';
 launch.addEventListener('click',()=>{
  const panel=element('dialog',null,document.body);
  panel.className='trial-battle';
  panel.setAttribute('aria-label',enemy.name+'との試遊戦');
  element('h2',enemy.name+(count===2?' ×2':''),panel);
  const label=element('label','緋月の装備 ',panel);
  const kit=element('select',null,label);
  element('option','15段・潮待村の装備4点',kit).value='tide';
  element('option','18段・T3相当の設計値',kit).value='tier';
  kit.value=deep?'tier':'tide';
  const portraits=element('div',null,panel);
  portraits.className='trial-portraits';
  const cards=Array.from({length:count},()=>{
   const card=element('div',null,portraits);
   const img=element('img',null,card);
   img.src=new URL('../'+portrait.asset,import.meta.url);
   img.alt=portrait.name;
   if(portrait.filter)img.style.filter=portrait.filter;
   return element('p',null,card);
  });
  const status=element('p',null,panel);
  status.className='trial-status';
  const commands=element('div',null,panel);
  commands.className='trial-commands';
  const log=element('ul',null,panel);
  log.setAttribute('aria-live','polite');
  log.className='trial-log';
  let fight;
  const actions=[['attack','攻撃'],['bloom','糸遊'],['heal','つむぎ'],['herb','薬草'],['guard','身構える']];
  const actionButtons=actions.map(([action,name])=>{
   const button=element('button',name,commands);
   button.addEventListener('click',()=>{
    const {events,outcome}=fight.act(action);
    log.replaceChildren();
    for(const event of events.filter(event=>event.kind!=='victory'))element('li',event.text,log);
    if(outcome==='victory')element('li',`勝利　心${fight.state.hero.xp}・${fight.state.hero.gold}両`,log);
    update();
   });
   return button;
  });
  function update(){
   const {hero,enemies,outcome,turn}=fight.state;
   status.textContent=`緋月　体力 ${hero.hp}/${hero.maxhp}　技 ${hero.mp}/${hero.maxmp}　薬草 ${hero.potions}`+
     (outcome?'':`　${turn}ターン`);
   cards.forEach((card,i)=>{card.textContent=`体力 ${enemies[i].hp}/${enemy.hp}`;});
   for(const button of actionButtons)button.disabled=Boolean(outcome);
  }
  function reset(){
   const player=kit.value==='tide'?{...TIDE_TRIAL_KIT,lv:15}:{lv:18,equipmentTier:'T3'};
   fight=createTrialBattle(enemy,count,{...player,potions:2});
   log.replaceChildren();
   element('li','戦闘開始。攻撃は一番手前の敵を狙います。',log);
   update();
  }
  const retry=element('button','やり直す',panel);
  retry.addEventListener('click',reset);
  kit.addEventListener('change',reset);
  const close=element('button','閉じる',panel);
  close.addEventListener('click',()=>panel.close());
  panel.addEventListener('close',()=>{panel.remove();launch.focus();},{once:true});
  reset();
  panel.showModal();
 });
}
