// Current FIRST-GAME equipment availability, sourced from the actual game data.
// A record of *what works today*, not an approval for new prices or tier shops.
// Individual shop items and the B-v2 tier benchmarks are tracked independently.
import {
  ARMORY_STOCK,EQUIPMENT_ITEMS,EQUIPMENT_SLOTS,STARTER_EQUIPMENT,STATUS_V2
} from '../battle/rules.mjs';
import {SHIOMACHI_ARMORY_STOCK} from '../../../data/maps/shiomachi-village/armory.mjs';

const itemRow=(item,{availability,location,action})=>Object.freeze({
  id:item.id,name:item.name,slot:item.slot,
  attack:item.attack,defense:item.defense,price:item.price,
  availability,location,action,
  battleEquippable:availability!=='preview-only',
  savedInventory:availability!=='preview-only'
});

const startItems=Object.values(STARTER_EQUIPMENT).filter(Boolean)
  .map(id=>itemRow(EQUIPMENT_ITEMS[id],{
    availability:'initial',location:'start',action:'initially-equipped'
  }));
const hozukiItems=ARMORY_STOCK.map(item=>itemRow(item,{
  availability:'in-game',location:'hozuki-village',action:'purchase'
}));
const shiomachiItems=SHIOMACHI_ARMORY_STOCK.map(item=>itemRow(item,{
  availability:'in-game',location:'shiomachi-village',action:'purchase'
}));

export const EXISTING_EQUIPMENT_CATALOG=Object.freeze([
  ...startItems,...hozukiItems,...shiomachiItems
]);

// Each entry corresponds to an existing area and its current equipment sources.
export const EXISTING_EQUIPMENT_LOCATIONS=Object.freeze([
  Object.freeze({id:'start',name:'旅立ち',availability:'initial',
    enteredFrom:'new-game',gameplayConnected:true,
    note:'初期所持・初期装備。追加購入はできない。'}),
  Object.freeze({id:'hozuki-village',name:'鬼灯村',availability:'in-game',
    enteredFrom:'field',gameplayConnected:true,
    note:'兵具屋で4点を個別購入可能。購入後は装備メニューで装着。'}),
  Object.freeze({id:'tenyo-sanctuary',name:'天妖の社',availability:'no-equipment',
    enteredFrom:'field',gameplayConnected:true,
    note:'現行実装に兵具の販売・装備品の拾得はない。'}),
  Object.freeze({id:'sea-cove',name:'海の入り江',availability:'no-equipment',
    enteredFrom:'field',gameplayConnected:true,
    note:'貝殻は拾って売れるが装備品ではない。兵具の販売・拾得はない。'}),
  Object.freeze({id:'shiomachi-village',name:'潮待村',
    availability:'in-game',enteredFrom:'field-and-independent-preview',
    gameplayConnected:true,
    note:'本編の兵具屋で4点を個別購入・装着・保存可能。独立プレビューは試用購入。'})
]);

export function existingEquipmentAt(locationId){
  const site=EXISTING_EQUIPMENT_LOCATIONS.find(x=>x.id===locationId);
  if(!site)return null;
  return Object.freeze({...site,items:Object.freeze(
    EXISTING_EQUIPMENT_CATALOG.filter(item=>item.location===locationId)
  )});
}

export function firstVillageTierMismatch(){
  const total={
    attack:hozukiItems.reduce((s,item)=>s+item.attack,0),
    defense:hozukiItems.reduce((s,item)=>s+item.defense,0),
    price:hozukiItems.reduce((s,item)=>s+item.price,0)
  };
  const confirmed=STATUS_V2.equipment.find(t=>t.id==='T1');
  return Object.freeze({
    actualShop:Object.freeze(total),
    approvedT1:Object.freeze({attack:confirmed.attack,defense:confirmed.defense}),
    difference:Object.freeze({attack:confirmed.attack-total.attack,
      defense:confirmed.defense-total.defense}),
    resolved:false,
    // A purchase does NOT automatically confer a tier. Do not double-add.
    rule:'tier bonuses and individual item bonuses must not be assumed equivalent or stacked'
  });
}

export function approvedTierBenchmarks(){
  return STATUS_V2.equipment.map(t=>Object.freeze({
    id:t.id,attack:t.attack,defense:t.defense,
    // No vendor, event or pickup location is approved just from this table.
    acquisitionLocation:null
  }));
}

export const EQUIPMENT_CATALOG_SCOPE=Object.freeze({
  game:'kikokuno-hanamusubi',
  onlyCurrentLocations:true,
  tierPlacementApproved:false,
  inventedItems:0,
  slots:Object.freeze(Object.keys(EQUIPMENT_SLOTS))
});
