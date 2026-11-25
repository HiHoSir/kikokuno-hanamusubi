import {ARMORY_STOCK,FOOD_ITEMS,purchaseArmory,purchaseFood,readPlayer,savePlayer,normalizePlayer} from '../battle/rules.mjs?v=equipment-4slots-2-cove-shells-1-shiomachi-gear-1-cave-quest-1-finds-1-guardian-1';
import {shellBagCount,shellBagValue} from '../items/shells.mjs';
import {sellCoveShells} from '../../../data/maps/sea-cove/shells.mjs';

export const INN_PRICE=20;
export function stayAtInn(hero,price=INN_PRICE){
 const player=normalizePlayer(hero);
 if(player.gold<price)return {accepted:false,player,message:'両が足りません。'};
 const next=normalizePlayer({...player,gold:player.gold-price,hp:player.maxhp,mp:player.maxmp});
 return {accepted:true,player:next,message:'ごゆっくり。体力と術力が回復しました。'};
}

const titles={teahouse:'茶店の品書き',armory:'兵具屋の品書き',inn:'宿'};
export function createVillageShop({panel,title,wallet,options,message,clearInput,armoryStock=ARMORY_STOCK,trial}){
 let room=null,selected=0,staying=false;
 const isTrial=()=>Boolean(trial);
 const player=()=>isTrial()?trial.read():readPlayer();
 function entries(hero){
   let goods;
   if(room==='teahouse'){
     const bag=hero.shells.bag;
     goods=[
       ...Object.values(FOOD_ITEMS).map(item=>({id:item.id,label:item.name+'　'+item.price+'両（体力+'+item.heal+'）'})),
       {id:'sell-shells',label:'貝殻を売る　'+shellBagCount(bag)+'個（'+shellBagValue(bag)+'両）'}
     ];
   }else if(room==='armory'){
     goods=armoryStock.map(item=>({id:item.id,label:item.name+'　'+item.price+'両（'+
       (item.attack?'攻撃+'+item.attack:'守備+'+item.defense)+'）'}));
   }else{
     goods=[{id:'sleep',label:'一泊する　'+INN_PRICE+'両（体力・術力を回復）'}];
   }
   return [...goods,{id:'exit',label:'もどる'}];
 }
 function refresh(){
   const hero=player();
   wallet.textContent=(isTrial()?'試用所持金 ':'所持金 ')+hero.gold+'両';
   if(isTrial()&&panel.dataset.layout!=='armory')wallet.textContent+='　体力 '+hero.hp+'/'+hero.maxhp+'　術力 '+hero.mp+'/'+hero.maxmp;
   const scroll=options.scrollTop;
   options.replaceChildren();
   for(const [index,item] of entries(hero).entries()){
     const button=document.createElement('button');
     button.type='button';
     button.dataset.shopItem=item.id;
     button.classList.toggle('selected',selected===index);
     button.textContent=item.label+(Object.hasOwn(hero.foods,item.id)?'　所持'+hero.foods[item.id]:
       hero.equipmentInventory[item.id]?'　購入済':'');
     button.addEventListener('click',()=>{selected=index;confirm();});
     options.append(button);
   }
   options.scrollTop=scroll;
 }
 function open(type,name=titles[type]){
   if(staying||!Object.hasOwn(titles,type))return false;
   room=type;selected=0;clearInput();
   title.textContent=name+(isTrial()?'（試用・セーブには反映しません）':'');
   message.textContent=room==='inn'?'お泊まりになりますか？':'何をお求めですか？';
   panel.hidden=false;
   refresh();
   return true;
 }
 function close(){
   if(staying)return;
   room=null;panel.hidden=true;clearInput();
 }
 function choose(direction){
   if(!room||staying)return;
   const count=entries(player()).length;
   selected=(selected+(direction==='up'||direction==='left'?-1:1)+count)%count;
   refresh();
   if(panel.dataset.layout==='armory')options.children[selected]?.scrollIntoView({block:'nearest'});
 }
 function confirm(){
   if(!room||staying)return false;
   const hero=player(),choice=entries(hero)[selected];
   if(!choice)return false;
   if(choice.id==='exit'){close();return true;}
   const result=choice.id==='sell-shells'?sellCoveShells(hero):
     room==='armory'?purchaseArmory(hero,choice.id,armoryStock):
       room==='inn'?stayAtInn(hero):purchaseFood(hero,choice.id);
   if(result.accepted){
     if(isTrial())trial.save(result.player);
     else{
       savePlayer(result.player);
       if(room==='inn'){
         const game=globalThis.parent?.KIKOKU_GAME;
         game?.autosave?.(globalThis);
         if(game?.playInnMorning){
           staying=true;
           clearInput();
           const wake=()=>{
             message.textContent='おはようございます。体力と術力が回復しました。';
             refresh();
           };
           game.playInnMorning(globalThis,wake)
             .catch(error=>{console.warn('宿泊演出を再生できませんでした',error);wake();})
             .finally(()=>{staying=false;});
           return true;
         }
       }
     }
   }
   message.textContent=result.message;
   if(result.accepted&&room==='armory'&&!isTrial())
     message.textContent+=' メニューの「装備」から装着できます。';
   refresh();
   globalThis.KIKOKU_AUDIO?.se?.(result.accepted?'confirm':'cancel');
   return result.accepted;
 }
 return {open,close,choose,confirm,get active(){return room!==null;}};
}
