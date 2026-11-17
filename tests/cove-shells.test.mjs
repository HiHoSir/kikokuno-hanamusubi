import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattle,DEFAULT_PLAYER,savePlayer,readPlayer,normalizePlayer} from '../src/game/battle/rules.mjs';
import {SHELL_KINDS,SHELL_CAP,shellBatchCount,shellBagCount,shellBagValue}
 from '../src/game/items/shells.mjs';
import {COVE_MAP,tileAt} from '../data/maps/sea-cove/scene.mjs';
import {COVE_SHELL_SITES,initialCoveShells,normalizeCoveShells,
 coveVisibleShells,nearestCoveShell,collectCoveShell,sellCoveShells,
 validateCoveShellSites} from '../data/maps/sea-cove/shells.mjs';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,
 setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};

test('production shell pickup sites are fixed, on sand, and do not overlap objects',()=>{
 assert.deepEqual(validateCoveShellSites(),[]);
 assert.ok(COVE_SHELL_SITES.length>=SHELL_CAP);
 assert.equal(new Set(COVE_SHELL_SITES.map(x=>x.id)).size,COVE_SHELL_SITES.length);
 for(const site of COVE_SHELL_SITES){
  assert.equal(tileAt(...site.cell,COVE_MAP),'s');
  assert.ok(Number.isInteger(site.x)&&Number.isInteger(site.y));
 }
 const terrain=readFileSync('data/maps/sea-cove/scene.mjs','utf8');
 assert.match(terrain,/width:COVE_WIDTH,height:COVE_HEIGHT/);
 const render=readFileSync('src/game/cove/render.mjs','utf8');
 assert.match(render,/shells\.map\(shell=>/);
 assert.match(render,/createShellAtlas\(/);
 assert.match(render,/SHELL_ART_SIZE/);
 assert.ok(render.includes('ctx.drawImage(staticArt.ground,0,0)'));
 assert.ok(render.includes('coastShallow'),'existing ocean/shore tiles remain intact');
});
test('each five completed battles creates 1–3 items, never every visit or frame',()=>{
 let state=initialCoveShells(0);
 for(let completed=0;completed<5;completed++){
  state=normalizeCoveShells(state,completed);
  assert.equal(state.onBeach.length,0,'no items after '+completed+' battles');
 }
 state=normalizeCoveShells(state,5);
 assert.equal(state.onBeach.length,shellBatchCount(1));
 assert.ok(state.onBeach.length>=1&&state.onBeach.length<=3);
 const first=JSON.stringify(state.onBeach);
 for(let completed=5;completed<10;completed++)
  state=normalizeCoveShells(state,completed);
 assert.equal(JSON.stringify(state.onBeach),first,'same stable positions until another five battles');
 const n=state.onBeach.length;
 state=normalizeCoveShells(state,10);
 assert.equal(state.onBeach.length,n+shellBatchCount(2));
 assert.equal(state.processedCycles,2);
 assert.deepEqual(normalizeCoveShells(state,10).onBeach,state.onBeach);
 const installed=coveVisibleShells({shells:state,completedBattles:10});
 for(const item of installed)
  assert.deepEqual([item.x,item.y],
   [COVE_SHELL_SITES[item.site].x,COVE_SHELL_SITES[item.site].y]);
});
test('uncollected shells cap at 12 and existing saves do not receive backpay',()=>{
 let state=initialCoveShells(0);
 for(let completed=1;completed<=160;completed++){
  state=normalizeCoveShells(state,completed);
  assert.ok(state.onBeach.length<=SHELL_CAP);
 }
 assert.equal(state.onBeach.length,SHELL_CAP);
 const old=normalizeCoveShells(null,42);
 assert.equal(old.onBeach.length,0);
 assert.equal(normalizeCoveShells(old,44).onBeach.length,0);
 assert.equal(normalizeCoveShells(old,45).onBeach.length,shellBatchCount(9));
});
test('player persistence grants shell batches after exactly five concluded combats',()=>{
 const store=storage();
 const prior=savePlayer({...DEFAULT_PLAYER,completedBattles:4,wins:3,lv:10},store);
 assert.equal(prior.shells.onBeach.length,0);
 const battle=createBattle('tanuki',readPlayer(store),()=>0);
 assert.equal(battle.act('attack').outcome,'victory');
 assert.equal(battle.state.hero.completedBattles,5);
 const after=savePlayer(battle.state.hero,store);
 assert.equal(after.shells.onBeach.length,shellBatchCount(1));
 assert.equal(readPlayer(store).shells.onBeach.length,after.shells.onBeach.length);
 assert.equal(readPlayer(store).shells.processedCycles,1);
 assert.deepEqual(savePlayer(readPlayer(store),store).shells.onBeach,after.shells.onBeach);
});
test('field/teahouse sale credits only collected shell proceeds and cannot duplicate',()=>{
 const store=storage(),hero=savePlayer({...DEFAULT_PLAYER,completedBattles:5},store);
 // Explicitly create a post-battle increment from the 4th through the 5th.
 const fifth=normalizeCoveShells(initialCoveShells(4),5);
 const first=coveVisibleShells({completedBattles:5,shells:fifth})[0];
 assert.ok(first,'the 5th battle produces a shell');
 const far=collectCoveShell({...hero,shells:fifth},first.id,first.x+100,first.y);
 assert.equal(far.accepted,false);
 const gathered=collectCoveShell({...hero,shells:fifth},first.id,first.x,first.y);
 assert.equal(gathered.accepted,true);
 const saved=savePlayer(gathered.player,store);
 assert.equal(saved.shells.onBeach.length,fifth.onBeach.length-1);
 assert.equal(saved.shells.bag[first.kind],1);
 assert.equal(shellBagCount(saved.shells.bag),1);
 const doubled=collectCoveShell(saved,first.id,first.x,first.y);
 assert.equal(doubled.accepted,false,'picked shell is permanently removed');
 const oldGold=saved.gold;
 const sold=sellCoveShells(readPlayer(store));
 assert.equal(sold.accepted,true);
 assert.equal(sold.amount,SHELL_KINDS[first.kind].value);
 const banked=savePlayer(sold.player,store);
 assert.equal(banked.gold,oldGold+sold.amount);
 assert.equal(shellBagValue(banked.shells.bag),0);
 assert.equal(sellCoveShells(readPlayer(store)).accepted,false);
 assert.equal(readPlayer(store).gold,banked.gold);
 const newCycle=normalizePlayer({...banked,completedBattles:10});
 assert.ok(newCycle.shells.onBeach.length>banked.shells.onBeach.length,
  'another 5 completed fights may create more inventory at fixed sites');
 assert.equal(newCycle.gold,banked.gold);
});
test('all battle outcomes advance shell cadence including escape and defeat',()=>{
 const p=normalizePlayer({...DEFAULT_PLAYER,lv:10,completedBattles:4});
 const victory=createBattle('tanuki',p,()=>0);
 assert.equal(victory.act('attack').outcome,'victory');
 assert.equal(normalizePlayer(victory.state.hero).shells.processedCycles,1);
 const fled=createBattle('tanuki',p,()=>0);
 assert.equal(fled.act('flee').outcome,'escape');
 assert.equal(normalizePlayer(fled.state.hero).shells.processedCycles,1);
 const lost=createBattle('field-oni',{...p,lv:1,hp:1,balanceVersion:2},()=>.99);
 assert.equal(lost.act('guard').outcome,'defeat');
 assert.equal(normalizePlayer(lost.state.hero).shells.processedCycles,1);
});
test('production cove UI and teahouse sell while retaining village shop layout',()=>{
 const cove=readFileSync('src/game/cove/walk.mjs','utf8');
 assert.match(cove,/collectCoveShell\(heroInventory/);
 assert.match(cove,/savePlayer\(result\.player\)/);
 assert.match(cove,/nearestCoveShell\(heroInventory/);
 assert.match(cove,/renderer\(\{x,y,face,distance,moving\},fishermen,now,viewport,shells\)/);
 assert.match(cove,/KIKOKU_SAVE_SNAPSHOT/);
 const hud=readFileSync('src/game/cove/index.html','utf8');
 assert.match(hud,/id="shell-hint"/);
 const interior=readFileSync('src/game/interiors/walk.mjs','utf8');
 assert.match(interior,/sellCoveShells\(readPlayer\(\)\)/);
 assert.match(interior,/id:'sell-shells'/);
 assert.match(interior,/savePlayer\(result\.player\)/);
 const items=readFileSync('src/game/ui/field-menu.mjs','utf8');
 assert.match(items,/for\(const shell of Object\.values\(SHELL_KINDS\)\)/);
 assert.equal(readFileSync('src/game/interiors/rooms.mjs','utf8').includes("'teahouse-northeast':'teahouse'"),true);
});
