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

test('all four slots persist purchases and sum distinct combat bonuses',async()=>{
  const rules=await import('../src/game/battle/rules.mjs');
  let hero={...DEFAULT_PLAYER,gold:200,hp:7,mp:3};
  for(const [id,price] of [['wakizashi',40],['padded-body',32],['headband',20],['tabi',12]]){
    const bought=rules.purchaseArmory(hero,id);
    assert.equal(bought.accepted,true,id);
    hero=bought.player;
    assert.equal(hero.equipmentInventory[id],1);
  }
  assert.equal(hero.gold,96);
  assert.equal(hero.attack,9,'buying does not equip automatically');
  const saved=new Map(),adapter={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
  rules.savePlayer(hero,adapter);
  hero=rules.readPlayer(adapter);
  for(const [slot,id] of [['weapon','wakizashi'],['body','padded-body'],['head','headband'],['feet','tabi']]){
    const equipped=rules.changeEquipment(hero,slot,id);
    assert.equal(equipped.accepted,true,slot);
    hero=equipped.player;
  }
  assert.equal(hero.attack,13);
  assert.equal(hero.defense,13);
  assert.equal(hero.hp,7);
  assert.equal(hero.mp,3);
  assert.equal(hero.gold,96);
  assert.equal(rules.createBattle('field-oni',hero).state.hero.attack,13);
  rules.savePlayer(hero,adapter);
  const persisted=rules.readPlayer(adapter);
  assert.equal(persisted.equipment.weapon,'wakizashi');
  assert.equal(persisted.equipment.feet,'tabi');
  assert.equal(rules.changeEquipment(persisted,'weapon','starter-weapon').player.attack,9);
  assert.equal(rules.changeEquipment(persisted,'head',null).player.defense,11);
  assert.equal(rules.changeEquipment(persisted,'weapon','tabi').accepted,false);
  assert.equal(rules.changeEquipment(DEFAULT_PLAYER,'weapon','wakizashi').accepted,false);
  assert.deepEqual(rules.normalizePlayer(persisted),persisted);
});

test('retired bundle owners keep four pieces and their story resources on migration',async()=>{
  const rules=await import('../src/game/battle/rules.mjs');
  const equipped=rules.normalizePlayer({...DEFAULT_PLAYER,equipmentTier:'T1',hp:8,gold:12});
  assert.equal(equipped.equipmentTier,'T0');
  assert.equal(equipped.attack,13);
  assert.equal(equipped.defense,13);
  assert.equal(equipped.hp,8);
  assert.equal(equipped.gold,12);
  assert.deepEqual(equipped.equipment,{weapon:'wakizashi',body:'padded-body',head:'headband',feet:'tabi'});
  assert.deepEqual(rules.normalizePlayer(equipped),equipped);
  const owned=rules.normalizePlayer({...DEFAULT_PLAYER,ownsArmoryGear:true,equipmentTier:'T0'});
  assert.equal(owned.attack,9);
  assert.equal(owned.equipmentInventory.wakizashi,1);
  assert.equal(owned.equipment.weapon,'starter-weapon');
});

test('an interior find is recorded once alongside the consumable count and can be retried when full',async()=>{
  const {collectFind}=await import('../src/game/battle/rules.mjs');
  const id='hozuki-northwest-house-tansu';
  const full=normalizePlayer({...DEFAULT_PLAYER,foods:{onigiri:99}});
  assert.equal(collectFind(full,id).accepted,false);
  const used=useExplorationResource({...full,hp:7},'food','onigiri');
  const first=collectFind(used.player,id);
  assert.equal(first.accepted,true);
  assert.equal(first.player.foods.onigiri,99);
  const next=useExplorationResource({...first.player,hp:7},'food','onigiri');
  const again=collectFind(next.player,id);
  assert.equal(again.accepted,false);
  assert.equal(again.player.foods.onigiri,98);
});

test('discoveries grant their authored item or coins exactly once across reloads',async()=>{
  const rules=await import('../src/game/battle/rules.mjs');
  const state=new Map();
  const storage={getItem:key=>state.get(key),setItem:(key,value)=>state.set(key,value)};
  const herb=rules.collectFind(DEFAULT_PLAYER,'hozuki-bridge-shrub');
  assert.equal(herb.accepted,true);
  assert.equal(herb.player.potions,4);
  const coins=rules.collectFind(herb.player,'hozuki-southeast-tree');
  assert.equal(coins.player.gold,8);
  const indoorCoins=rules.collectFind(coins.player,'hozuki-southwest-house-tansu');
  assert.equal(indoorCoins.player.gold,20);
  const dango=rules.collectFind(indoorCoins.player,'hozuki-northeast-house-tansu');
  assert.equal(dango.player.foods.dango,1);
  rules.savePlayer(dango.player,storage);
  const restored=rules.readPlayer(storage);
  for(const id of ['hozuki-bridge-shrub','hozuki-southeast-tree','hozuki-southwest-house-tansu','hozuki-northeast-house-tansu']){
    const repeat=rules.collectFind(restored,id);
    assert.equal(repeat.accepted,false);
    assert.deepEqual(repeat.player,restored);
  }
});

test('the previously collected northwest find stays collected when opening old player data',async()=>{
  const {collectFind}=await import('../src/game/battle/rules.mjs');
  const old={...DEFAULT_PLAYER,roomFinds:['hozuki-northwest-house-tansu'],foods:{onigiri:2}};
  const result=collectFind(old,'hozuki-northwest-house-tansu');
  assert.equal(result.accepted,false);
  assert.equal(result.player.foods.onigiri,2);
});
