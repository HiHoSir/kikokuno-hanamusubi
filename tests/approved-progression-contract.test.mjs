import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STATUS_V2,ARMORY_STOCK,EQUIPMENT_ITEMS,EQUIPMENT_SLOTS,
  levelStats,DEFAULT_PLAYER,normalizePlayer} from '../src/game/battle/rules.mjs';
import {SHIOMACHI_ARMORY_STOCK} from '../data/maps/shiomachi-village/armory.mjs';

// This literal snapshot is an acceptance contract, not a second balance table
// to rebalance on the basis of village distances, shop prices, or test battles.
const ACCEPTED_TIERS=Object.freeze([
 ['T0',0,0],['T1',20,14],['T2',42,30],['T3',64,46],
 ['T4',88,64],['T5',114,84],['T6',140,104]
]);
const read=path=>readFileSync(path,'utf8');

test('approved B-formula v2 T0-T6 values cannot silently be retuned',()=>{
 const status=JSON.parse(read('data/characters/hizuki-status.json'));
 assert.equal(status.status,'approved-v2-core');
 const jsonTiers=status.tiers.map(t=>[t.id,t.weaponAttack,t.armorDefense]);
 const runtimeTiers=STATUS_V2.equipment.map(t=>[t.id,t.attack,t.defense]);
 assert.deepEqual(jsonTiers,ACCEPTED_TIERS);
 assert.deepEqual(runtimeTiers,ACCEPTED_TIERS);
 assert.deepEqual(status.level.base,{hp:26,mp:12,attack:9,defense:6,speed:9});
 assert.deepEqual(status.level.perLevel,{hp:8,mp:1.3,attack:2.6,defense:1.6,speed:2});
 assert.equal(status.formula,'floor(攻/2 - 守/4)');
 assert.equal(status.level.maximum,99);
 assert.equal(status.targetLastBossLevel,40);
 assert.equal(status.death.goldLossRatio,.25);
 assert.equal(status.death.returnTown,'lastVisitedTown');
 // Tier values describe aggregate bonuses, not another layer of bonuses to
 // stack onto separately bought items without an explicit migration plan.
 for(const [tier,attack,defense] of ACCEPTED_TIERS){
   const base=levelStats(1,'T0'),boosted=levelStats(1,tier);
   assert.equal(boosted.attack-base.attack,attack,tier+' attack');
   assert.equal(boosted.defense-base.defense,defense,tier+' defense');
 }
});

test('individual Hozuki shop catalog remains independently approved and unchanged',()=>{
 assert.deepEqual(Object.keys(EQUIPMENT_SLOTS),['weapon','body','head','feet']);
 assert.deepEqual(ARMORY_STOCK.map(item=>
   [item.id,item.name,item.slot,item.price,item.attack,item.defense]),[
   ['wakizashi','脇差','weapon',40,4,0],
   ['padded-body','厚布の胴当て','body',32,0,4],
   ['headband','鉢巻','head',20,0,2],
   ['tabi','足袋','feet',12,0,1]
 ]);
 assert.equal(ARMORY_STOCK.reduce((n,item)=>n+item.attack,0),4);
 assert.equal(ARMORY_STOCK.reduce((n,item)=>n+item.defense,0),7);
 const tierOne=STATUS_V2.equipment.find(t=>t.id==='T1');
 assert.notDeepEqual([4,7],[tierOne.attack,tierOne.defense],
   'a separate approval of shop items did not change the approved tier benchmark');
 assert.deepEqual(Object.values(EQUIPMENT_SLOTS),['武器','胴','頭','足']);
 assert.ok(EQUIPMENT_ITEMS['starter-weapon']);
 assert.ok(EQUIPMENT_ITEMS['starter-body']);
 assert.deepEqual(normalizePlayer(DEFAULT_PLAYER).equipmentTier,'T0');
});

test('Shiomachi demo does not counterfeit T2 or mutate the battle item catalog',()=>{
 assert.equal(SHIOMACHI_ARMORY_STOCK.length,4);
 assert.deepEqual(SHIOMACHI_ARMORY_STOCK.map(x=>x.slot),Object.keys(EQUIPMENT_SLOTS));
 for(const item of SHIOMACHI_ARMORY_STOCK){
   assert.equal(EQUIPMENT_ITEMS[item.id],undefined,
     'coastal prototype ID cannot masquerade as battle-equipped canon gear');
   assert.ok(Number.isInteger(item.price)&&item.price>=0);
 }
 const doc=read('docs/BALANCE_PROGRESSION_CONTRACT.md');
 assert.match(doc,/攻\+20.*守\+14/);
 assert.match(doc,/攻\+42.*守\+30/);
 assert.match(doc,/鬼灯村/);
 assert.match(doc,/潮待村/);
 assert.match(doc,/T2.*配置未確定/);
 assert.match(doc,/128両案は撤回/);
 assert.match(doc,/個別販売/);
});
