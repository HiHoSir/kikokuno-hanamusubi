import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMapProgressionAudit} from '../tools/audit-map-progression.mjs';

const audit=buildMapProgressionAudit();

test('map-based progression audit tracks current authored 80x80 route and actual passage lengths',()=>{
 assert.deepEqual([audit.map.width,audit.map.height,audit.map.tileSize],[80,80,32]);
 assert.deepEqual(audit.map.locations.map(p=>p.id),
   ['village','shrine','cove','forest','waterfall','hotspring','fox']);
 assert.deepEqual(audit.map.legs.map(p=>p.metadataSteps),[42,45,33,20,60,30]);
 assert.deepEqual(audit.map.legs.map(p=>p.liveBothEnds),
   [true,true,false,false,false,false]);
 assert.deepEqual(audit.map.liveTransitionDestinations,['village','shrine','cove']);
 assert.equal(audit.map.caveDestinationPresent,false,
   'a mandatory mountain-pass cave is not yet an authored field destination');
 assert.equal(audit.map.restStopLocations.length,4);
 assert.equal(audit.map.hasRestStopShopConnection,false,
   'rest-stop pin data must not be mistaken for playable merchant services');
});

test('first-route actual encounters and level thresholds expose old tier timing mismatch',()=>{
 assert.deepEqual([audit.encounters.minSteps,audit.encounters.maxSteps],[9,13]);
 assert.equal(audit.encounters.firstRouteOnly,true,
   'non-connected field regions still use the first route safe encounter fallback');
 assert.deepEqual(audit.encounters.enemies.map(x=>[x.id,x.count,x.xp,x.gold]),[
   ['field-oni',1,24,8],['tanuki',2,24,8],['onibi',1,27,8]
 ]);
 assert.deepEqual(audit.growth.firstAreaExperience,{
   toLevel2:80,toLevel5:1060,toLevel10:5300,
   firstLegRoughBattles:{min:3,max:4},
   level5BattleCountAtCurrentFirstRouteRewards:{min:40,max:45}
 });
 assert.deepEqual(audit.growth.approvedTierBonuses,[
   ['T0',0,0],['T1',20,14],['T2',42,30],['T3',64,46],
   ['T4',88,64],['T5',114,84],['T6',140,104]
 ]);
});

test('the audit distinguishes legacy T1 targets from approved four-slot Hozuki stock',()=>{
 assert.deepEqual(audit.equipment.hozuki.map(x=>
   [x.id,x.slot,x.price,x.attack,x.defense]),[
   ['wakizashi','weapon',40,4,0],
   ['padded-body','body',32,0,4],
   ['headband','head',20,0,2],
   ['tabi','feet',12,0,1]
 ]);
 assert.deepEqual(audit.equipment.hozukiTotals,{price:104,attack:4,defense:7});
 const doc=readFileSync('docs/MAP_ENEMY_EQUIPMENT_RECONCILIATION.md','utf8');
 for(const phrase of ['2026-11-15','43歩','68歩','33歩','31歩','42マス','30マス',
   '天妖の社','海の入り江','忘れの森','龍神の滝','九尾の祠',
   '洞窟','未実装','1109','124〜139','T1','T2','保護']){
   assert.ok(doc.includes(phrase),'audit document must explicitly cover '+phrase);
 }
 const source=readFileSync('docs/FOUR_VILLAGES_EQUIPMENT_PLAN.md','utf8');
 assert.ok(!source.includes('潮待村T2相当の個別商品'),
   'unapproved village-to-tier mapping cannot remain in the TODO');
});
