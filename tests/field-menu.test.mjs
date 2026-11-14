import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PLAYER,normalizePlayer,useExplorationResource} from '../src/game/battle/rules.mjs';
test('field consumables follow battle heal values and do not mutate input',()=>{
  const hero=normalizePlayer({...DEFAULT_PLAYER,hp:3,mp:10,potions:1,foods:{onigiri:1,dango:1}});
  const rice=useExplorationResource(hero,'food','onigiri');
  assert.equal(rice.accepted,true);assert.equal(rice.player.hp,15);assert.equal(rice.player.foods.onigiri,0);
  assert.equal(hero.foods.onigiri,1);
  assert.equal(useExplorationResource(hero,'food','dango').player.hp,25);
  assert.equal(useExplorationResource(hero,'herb').player.hp,26);
  const magic=useExplorationResource(hero,'heal');
  assert.equal(magic.player.hp,11);assert.equal(magic.player.mp,5);
  assert.equal(useExplorationResource(hero,'food','invalid').accepted,false);
  assert.equal(useExplorationResource(DEFAULT_PLAYER,'herb').accepted,false);
  assert.equal(useExplorationResource({...hero,potions:0},'herb').accepted,false);
  assert.equal(useExplorationResource({...hero,mp:4},'heal').accepted,false);
});

test('inventory exposes only acquired consumables together with their exact counts',async()=>{
  const rules=await import('../src/game/battle/rules.mjs');
  const hero=normalizePlayer({...DEFAULT_PLAYER,potions:0,foods:{onigiri:2,dango:0}});
  const items=rules.carriedConsumables?.(hero);
  assert.deepEqual(items?.map(({name,count})=>[name,count]),[['おにぎり',2]]);
});

test('purchased gear stays owned through saving, equipping, and removing',async()=>{
  const rules=await import('../src/game/battle/rules.mjs');
  const shop=rules.purchaseArmory({...DEFAULT_PLAYER,gold:205,hp:7,mp:3});
  const storage=new Map();
  const adapter={getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
  rules.savePlayer(shop.player,adapter);
  const before=rules.readPlayer(adapter);
  const equipped=rules.changeEquipment?.(before,'T1');
  assert.equal(equipped?.accepted,true);
  assert.equal(equipped.player.attack,29);
  assert.equal(equipped.player.defense,20);
  assert.equal(equipped.player.hp,7);
  assert.equal(equipped.player.mp,3);
  assert.equal(equipped.player.gold,5);
  assert.equal(rules.createBattle('field-oni',equipped.player).state.hero.attack,29);
  rules.savePlayer(equipped.player,adapter);
  const removed=rules.changeEquipment(rules.readPlayer(adapter),'T0');
  assert.equal(removed.accepted,true);
  assert.equal(removed.player.attack,9);
  assert.equal(rules.changeEquipment(removed.player,'T1').accepted,true);
  assert.equal(rules.changeEquipment(DEFAULT_PLAYER,'T1').accepted,false);
});

test('previously auto-equipped armory gear stays equipped and can be put back in inventory',async()=>{
  const rules=await import('../src/game/battle/rules.mjs');
  const old=rules.normalizePlayer({...DEFAULT_PLAYER,equipmentTier:'T1',hp:8});
  assert.equal(old.equipmentTier,'T1');
  assert.equal(old.attack,29);
  assert.equal(old.ownsArmoryGear,true);
  const removed=rules.changeEquipment(old,'T0');
  assert.equal(removed.player.ownsArmoryGear,true);
  assert.equal(removed.player.hp,8);
});

test('an interior find is recorded once alongside the consumable count and can be retried when full',async()=>{
  const {findRoomItem}=await import('../src/game/battle/rules.mjs');
  const id='hozuki-northwest-house-tansu';
  const full=normalizePlayer({...DEFAULT_PLAYER,foods:{onigiri:99}});
  assert.equal(findRoomItem(full,id,'onigiri').accepted,false);
  const used=useExplorationResource({...full,hp:7},'food','onigiri');
  const first=findRoomItem(used.player,id,'onigiri');
  assert.equal(first.accepted,true);
  assert.equal(first.player.foods.onigiri,99);
  const next=useExplorationResource({...first.player,hp:7},'food','onigiri');
  const again=findRoomItem(next.player,id,'onigiri');
  assert.equal(again.accepted,false);
  assert.equal(again.player.foods.onigiri,98);
});
