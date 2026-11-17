import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHORE_Y,MAP,SCENERY,TILE,START} from '../data/maps/shoreline-study/scene.mjs';
import {
 BATTLES_PER_SHELL_BATCH,SHELL_BATCH_MIN,SHELL_BATCH_MAX,SHELL_CAP,
 SHELL_SITES,SHELL_KINDS,SHELL_SAVE_KEY,PICKUP_DISTANCE,
 initialShellState,normalizeShellState,validateShellSites,syncBattleShells,
 visibleShells,nearestShell,gatherShell,bagValue,sellAllShells,batchCount
} from '../data/maps/shoreline-study/shells.mjs';
import {SHELL_ART,SHELL_COLORS,SHELL_ART_SIZE}
 from '../src/game/items/shell-art.mjs';
import {createBattle,normalizePlayer} from '../src/game/battle/rules.mjs';

test('native 20px pixel art for three shell kinds has closed palette',()=>{
 assert.equal(SHELL_ART_SIZE,20);
 assert.deepEqual(Object.keys(SHELL_ART).sort(),Object.keys(SHELL_KINDS).sort());
 for(const [kind,rows] of Object.entries(SHELL_ART)){
   assert.equal(rows.length,20,kind+' has 20 rows');
   let opaque=0;
   for(const row of rows){
     assert.ok(row.length<=20,kind+' width exceeds 20');
     for(const token of row){
       if(token==='.')continue;
       assert.ok(SHELL_COLORS[kind][token],kind+' palette missing '+token);
       opaque++;
     }
   }
   assert.ok(opaque>=70&&opaque<=300,kind+' remains a small pixel sprite');
   assert.equal(SHELL_COLORS[kind].O[3],255);
 }
 assert.ok(SHELL_KINDS.sakura.value>SHELL_KINDS.spiral.value);
 assert.ok(SHELL_KINDS.spiral.value>SHELL_KINDS.white.value);
});

test('shell positions are fixed (not random) and safely authored away from water and rocks',()=>{
 assert.equal(BATTLES_PER_SHELL_BATCH,5);
 assert.equal(SHELL_BATCH_MIN,1);
 assert.equal(SHELL_BATCH_MAX,3);
 assert.equal(SHELL_CAP,12);
 assert.ok(SHELL_SITES.length>=SHELL_CAP);
 assert.deepEqual(validateShellSites(),[]);
 assert.equal(new Set(SHELL_SITES.map(site=>site.id)).size,SHELL_SITES.length);
 for(const spot of SHELL_SITES){
   const tx=Math.floor(spot.x/TILE),ty=Math.floor(spot.y/TILE);
   assert.equal(MAP[ty]?.[tx],'sand');
   assert.ok(ty>=SHORE_Y[tx]+1);
   assert.ok(Math.hypot(spot.x-START.x,spot.y-START.y)>=28);
   assert.ok(SCENERY.every(rock=>Math.hypot(spot.x-rock.x,spot.y-rock.y)>=34));
 }
 const source=readFileSync('data/maps/shoreline-study/shells.mjs','utf8');
 assert.doesNotMatch(source,/generateShells\(seed\)|newSeed\(|Math\.random\(\)/,
   'shell placement is authored, never rerolled');
});

test('zero shells before fifth completed battle; only 1-3 generated at each milestone',()=>{
 let state=initialShellState(0);
 for(let battles=0;battles<5;battles++){
   const sync=syncBattleShells(state,battles);
   assert.equal(sync.spawned,0,'nothing at battle '+battles);
   state=sync.state;
   assert.equal(visibleShells(state).length,0);
 }
 const fifth=syncBattleShells(state,5);
 assert.ok(fifth.spawned>=1&&fifth.spawned<=3);
 assert.equal(fifth.spawned,batchCount(1));
 assert.equal(fifth.state.processedCycles,1);
 state=fifth.state;
 const sourceCount=visibleShells(state).length;
 for(let battles=5;battles<10;battles++){
   const sync=syncBattleShells(state,battles);
   assert.equal(sync.spawned,0,'no repeat generation within 5-battle interval');
   state=sync.state;
   assert.equal(state.onBeach.length,sourceCount,'refresh cannot spawn shells');
 }
 const tenth=syncBattleShells(state,10);
 assert.equal(tenth.spawned,batchCount(2));
 assert.equal(tenth.state.processedCycles,2);
 assert.equal(tenth.state.onBeach.length,sourceCount+tenth.spawned);
 assert.equal(syncBattleShells(tenth.state,10).spawned,0);
 for(const item of tenth.state.onBeach)
   assert.deepEqual({x:item.x,y:item.y},
     {x:SHELL_SITES[item.site].x,y:SHELL_SITES[item.site].y},
     'only authored positions are used');
});

test('shell deposits cap on beach and avoid huge retroactive free rewards',()=>{
 let state=initialShellState(0);
 for(let battles=1;battles<=150;battles++){
   const sync=syncBattleShells(state,battles);
   state=sync.state;
   assert.ok(state.onBeach.length<=SHELL_CAP);
 }
 assert.equal(state.onBeach.length,SHELL_CAP);
 assert.equal(state.processedCycles,30);
 const existingSave=initialShellState(42);
 assert.equal(existingSave.onBeach.length,0,'old game does not get 8 instant batches');
 assert.equal(syncBattleShells(existingSave,44).spawned,0);
 assert.equal(syncBattleShells(existingSave,45).spawned,batchCount(9));
});

test('collection persists, cannot duplicate rewards, and sells only once',()=>{
 let state=syncBattleShells(initialShellState(4),5).state;
 const first=state.onBeach[0];
 assert.ok(first);
 assert.equal(nearestShell(state,first.x,first.y)?.id,first.id);
 assert.equal(gatherShell(state,first.id,first.x+PICKUP_DISTANCE+4,first.y).accepted,false);
 const pick=gatherShell(state,first.id,first.x,first.y);
 assert.equal(pick.accepted,true);
 state=pick.state;
 assert.equal(state.picked.length,1);
 assert.equal(state.bag[first.kind],1);
 assert.ok(!visibleShells(state).some(item=>item.id===first.id));
 assert.equal(bagValue(state),SHELL_KINDS[first.kind].value);
 assert.equal(gatherShell(state,first.id,first.x,first.y).accepted,false);
 state=normalizeShellState(JSON.parse(JSON.stringify(state)));
 assert.equal(state.picked.length,1,'reloading does not respawn collected shell');
 assert.equal(syncBattleShells(state,5).spawned,0);
 const sold=sellAllShells(state);
 assert.equal(sold.accepted,true);
 assert.equal(sold.amount,SHELL_KINDS[first.kind].value);
 assert.equal(sold.state.gold,sold.amount);
 assert.equal(bagValue(sold.state),0);
 assert.equal(sellAllShells(sold.state).accepted,false,'no double sale');
 assert.equal(sellAllShells(sold.state).state.gold,sold.amount);
 const next=syncBattleShells(sold.state,10);
 assert.ok(next.spawned>=1,'new deposits need another five battles');
 assert.equal(next.state.gold,sold.amount);
});

test('completed battle counter records victories, defeats and escape once',()=>{
 const starter=normalizePlayer({lv:10,completedBattles:4,wins:3,balanceVersion:2});
 assert.equal(starter.completedBattles,4);
 const win=createBattle('tanuki',starter,()=>0);
 const reward=win.act('attack');
 assert.equal(reward.outcome,'victory');
 assert.equal(win.state.hero.completedBattles,5);
 assert.equal(win.state.hero.wins,4);
 assert.equal(win.act('attack').accepted,false);
 assert.equal(win.state.hero.completedBattles,5);
 const retreat=createBattle('tanuki',starter,()=>0);
 assert.equal(retreat.act('flee').outcome,'escape');
 assert.equal(retreat.state.hero.completedBattles,5);
 assert.equal(retreat.state.hero.wins,3);
 assert.equal(retreat.act('flee').accepted,false);
 const defeat=createBattle('field-oni',{...starter,lv:1,hp:1,balanceVersion:2},()=>.99);
 assert.equal(defeat.act('guard').outcome,'defeat');
 assert.equal(defeat.state.hero.completedBattles,5);
 assert.equal(defeat.state.hero.wins,3);
 assert.equal(defeat.act('guard').accepted,false);
 assert.equal(defeat.state.hero.completedBattles,5);
 const legacy=normalizePlayer({wins:9});
 assert.equal(legacy.completedBattles,9,'existing save has at least its wins');
});

test('resetting game and malformed state cannot carry invalid shell items',()=>{
 let state=syncBattleShells(initialShellState(0),5).state;
 const item=state.onBeach[0];
 state=gatherShell(state,item.id,item.x,item.y).state;
 const old=syncBattleShells(state,0);
 assert.equal(old.reset,true);
 assert.equal(old.state.onBeach.length,0);
 assert.equal(old.state.bag[item.kind],0);
 const invalid=normalizeShellState({
   version:2,lastBattles:4,processedCycles:0,
   onBeach:[{id:'made-up',site:4,kind:'sakura'},{id:'shell-1-0',site:999,kind:'white'}],
   picked:[{id:'made-up',site:4,kind:'sakura'}],sold:['made-up'],gold:-10
 });
 assert.equal(invalid.onBeach.length,0);
 assert.equal(invalid.picked.length,0);
 assert.equal(invalid.gold,0);
});

test('preview sells only in review wallet and never modifies main money',()=>{
 assert.match(SHELL_SAVE_KEY,/preview-shoreline/);
 const html=readFileSync('previews/shoreline-study/index.html','utf8');
 assert.match(html,/readPlayer\(\)\.completedBattles/);
 assert.match(html,/syncBattleShells\(shellState,battles\)/);
 assert.match(html,/localStorage\.setItem\(SHELL_SAVE_KEY/);
 assert.match(html,/id="pickup-shell"/);
 assert.match(html,/id="sell-shells"/);
 assert.doesNotMatch(html,/id="reroll-shells"|newSeed\(|generateShells\(/);
 assert.ok(html.includes('ctx.drawImage(shellAtlas.canvas'));
 assert.doesNotMatch(html,/savePlayer\(|KIKOKU_SAVE_SNAPSHOT/);
});
