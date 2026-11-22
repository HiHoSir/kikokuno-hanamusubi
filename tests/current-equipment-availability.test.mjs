import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  EQUIPMENT_CATALOG_SCOPE,EXISTING_EQUIPMENT_CATALOG,
  EXISTING_EQUIPMENT_LOCATIONS,existingEquipmentAt,
  firstVillageTierMismatch,approvedTierBenchmarks
} from '../src/game/equipment/current-availability.mjs';
import {
  DEFAULT_PLAYER,normalizePlayer,levelStats,ARMORY_STOCK,EQUIPMENT_ITEMS,
  EQUIPMENT_SLOTS,STARTER_EQUIPMENT,purchaseArmory,changeEquipment
} from '../src/game/battle/rules.mjs';
import {SHIOMACHI_ARMORY_STOCK} from '../data/maps/shiomachi-village/armory.mjs';

test('equipment catalog is from the one correct first-game repository and defines actual locations',()=>{
 assert.equal(EQUIPMENT_CATALOG_SCOPE.game,'kikokuno-hanamusubi');
 assert.equal(EQUIPMENT_CATALOG_SCOPE.tierPlacementApproved,false);
 assert.equal(EQUIPMENT_CATALOG_SCOPE.inventedItems,0);
 assert.deepEqual(EQUIPMENT_CATALOG_SCOPE.slots,Object.keys(EQUIPMENT_SLOTS));
 assert.deepEqual(EXISTING_EQUIPMENT_LOCATIONS.map(x=>x.id),
   ['start','hozuki-village','tenyo-sanctuary','sea-cove','shiomachi-village']);
 assert.equal(existingEquipmentAt('rest-stop'),null);
 assert.equal(existingEquipmentAt('mountain-cave'),null);
 assert.equal(existingEquipmentAt('unknown-town'),null);
});

test('starting gear and Hozuki armory are the ONLY playable equippable items',()=>{
 const playable=EXISTING_EQUIPMENT_CATALOG.filter(x=>x.battleEquippable);
 assert.deepEqual(playable.map(x=>x.id),[
   'starter-weapon','starter-body','wakizashi','padded-body','headband','tabi'
 ]);
 const initial=existingEquipmentAt('start');
 assert.deepEqual(initial.items.map(x=>x.id),Object.values(STARTER_EQUIPMENT).filter(Boolean));
 const shop=existingEquipmentAt('hozuki-village');
 assert.equal(shop.gameplayConnected,true);
 assert.equal(shop.availability,'in-game');
 assert.deepEqual(shop.items.map(x=>x.id),ARMORY_STOCK.map(x=>x.id));
 for(const row of playable){
   assert.deepEqual([row.name,row.slot,row.attack,row.defense,row.price],
     ((EQUIPMENT_ITEMS[row.id])&&[
       EQUIPMENT_ITEMS[row.id].name,EQUIPMENT_ITEMS[row.id].slot,
       EQUIPMENT_ITEMS[row.id].attack,EQUIPMENT_ITEMS[row.id].defense,
       EQUIPMENT_ITEMS[row.id].price]));
   assert.equal(row.savedInventory,true);
 }
 assert.deepEqual(shop.items.map(x=>[x.price,x.attack,x.defense]),
   [[40,4,0],[32,0,4],[20,0,2],[12,0,1]]);
 assert.equal(Object.isFrozen(shop),true);
 assert.equal(Object.isFrozen(shop.items),true);
});

test('the shrine and sea cove have NO gameplay equipment pickup or armory',()=>{
 for(const name of ['tenyo-sanctuary','sea-cove']){
   const area=existingEquipmentAt(name);
   assert.equal(area.gameplayConnected,true);
   assert.equal(area.availability,'no-equipment');
   assert.deepEqual(area.items,[]);
 }
 assert.ok(readFileSync('src/game/cove/walk.mjs','utf8').includes('shell'));
 assert.ok(readFileSync('data/maps/sea-cove/shells.mjs','utf8').includes('sellCoveShells'));
 assert.ok(!readFileSync('data/maps/hozuki-village/finds.mjs','utf8').includes('equipment'));
});

test('Shiomachi equipment is restricted to the standalone preview, never equip/save',()=>{
 const area=existingEquipmentAt('shiomachi-village');
 assert.equal(area.gameplayConnected,true,'the village map is now connected; only its gear remains trial-only');
 assert.equal(area.availability,'preview-only');
 assert.deepEqual(area.items.map(x=>x.id),SHIOMACHI_ARMORY_STOCK.map(x=>x.id));
 assert.deepEqual(area.items.map(x=>x.name),[
   '潮切りの太刀','潮革の胴当て','波除けの鉢金','磯歩きの脚絆']);
 for(const row of area.items){
   assert.equal(row.battleEquippable,false);
   assert.equal(row.savedInventory,false);
   assert.equal(EQUIPMENT_ITEMS[row.id],undefined);
   assert.equal(row.action,'trial-purchase');
 }
 // Preserve the actual current prototype values without endorsing them.
 assert.deepEqual(area.items.map(x=>[x.price,x.attack,x.defense]),
   [[160,12,0],[120,0,10],[80,0,5],[60,0,4]]);
 assert.equal(EXISTING_EQUIPMENT_CATALOG.length,10);
 assert.equal(new Set(EXISTING_EQUIPMENT_CATALOG.map(x=>x.id)).size,10);
});

test('T0-T6 benchmark is a separate design contract, not shop availability',()=>{
 assert.deepEqual(approvedTierBenchmarks().map(x=>
   [x.id,x.attack,x.defense,x.acquisitionLocation]),[
   ['T0',0,0,null],['T1',20,14,null],['T2',42,30,null],
   ['T3',64,46,null],['T4',88,64,null],['T5',114,84,null],
   ['T6',140,104,null]
 ]);
 const mismatch=firstVillageTierMismatch();
 assert.deepEqual(mismatch.actualShop,{attack:4,defense:7,price:104});
 assert.deepEqual(mismatch.approvedT1,{attack:20,defense:14});
 assert.deepEqual(mismatch.difference,{attack:16,defense:7});
 assert.equal(mismatch.resolved,false,'do not silently make Hozuki=T1');
});

test('existing purchase + equipment flow uses real items without invented tier upgrades',()=>{
 let hero=normalizePlayer({...DEFAULT_PLAYER,gold:200});
 const base=levelStats(hero.lv,'T0');
 assert.equal(hero.equipmentTier,'T0');
 for(const item of ARMORY_STOCK){
   const buy=purchaseArmory(hero,item.id);
   assert.equal(buy.accepted,true,item.id);
   assert.equal(buy.player.equipmentInventory[item.id],1);
   hero=buy.player;
   const wear=changeEquipment(hero,item.slot,item.id);
   assert.equal(wear.accepted,true,item.id);
   hero=wear.player;
   assert.equal(hero.equipmentTier,'T0','buying is not an automatic tier assignment');
 }
 assert.equal(hero.gold,200-104);
 assert.equal(hero.attack,base.attack+4);
 assert.equal(hero.defense,base.defense+7);
 assert.equal(hero.hp,DEFAULT_PLAYER.hp);
 assert.equal(hero.mp,DEFAULT_PLAYER.mp);
 const serialized=JSON.parse(JSON.stringify(hero));
 const restored=normalizePlayer(serialized);
 assert.deepEqual(restored.equipment,hero.equipment);
 assert.equal(restored.attack,hero.attack);
 assert.equal(restored.defense,hero.defense);
 assert.equal(restored.gold,96);
 assert.equal(purchaseArmory(hero,'shiomachi-tide-blade').accepted,false);
});
