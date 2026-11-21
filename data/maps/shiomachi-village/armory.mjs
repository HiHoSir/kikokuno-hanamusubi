// 潮待村の兵具屋（試作品揃え）。鬼灯村の4点と混ぜない。
// Values are draft for level/price validation against the *future* coastal
// encounter economy. The real battle item catalog/save is intentionally not
// modified by this preview.
import {ARMORY_STOCK,normalizePlayer} from '../../../src/game/battle/rules.mjs';

export const SHIOMACHI_ARMORY_STOCK=Object.freeze([
 Object.freeze({id:'shiomachi-tide-blade',name:'潮切りの太刀',slot:'weapon',attack:12,defense:0,price:160}),
 Object.freeze({id:'shiomachi-tide-armor',name:'潮革の胴当て',slot:'body',attack:0,defense:10,price:120}),
 Object.freeze({id:'shiomachi-wave-helm',name:'波除けの鉢金',slot:'head',attack:0,defense:5,price:80}),
 Object.freeze({id:'shiomachi-reef-gaiters',name:'磯歩きの脚絆',slot:'feet',attack:0,defense:4,price:60})
]);

export function purchaseShiomachiArmory(player,owned,id){
 const hero=normalizePlayer(player);
 const inventory={...owned};
 const item=SHIOMACHI_ARMORY_STOCK.find(x=>x.id===id);
 if(!item)return {accepted:false,player:hero,owned:inventory,message:'商品を選んでください。'};
 if(inventory[item.id])return {accepted:false,player:hero,owned:inventory,message:'その兵具はもう持っています。'};
 if(hero.gold<item.price)return {accepted:false,player:hero,owned:inventory,message:'両が足りません。'};
 hero.gold-=item.price;
 inventory[item.id]=1;
 return {accepted:true,player:hero,owned:inventory,message:item.name+'を買いました。'};
}

// This is a display-only comparison; the existing game does not accept
// these IDs as equippable equipment until the actual new-village integration.
export function shiomachiStockComparison(){
 return SHIOMACHI_ARMORY_STOCK.map(item=>{
   const current=ARMORY_STOCK.find(x=>x.slot===item.slot);
   return {slot:item.slot,newId:item.id,oldId:current.id,
     attackDifference:item.attack-current.attack,
     defenseDifference:item.defense-current.defense,
     priceDifference:item.price-current.price};
 });
}
