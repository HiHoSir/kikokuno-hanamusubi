import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHORE_Y,MAP,SCENERY,TILE,START} from '../data/maps/shoreline-study/scene.mjs';
import {
 SHELL_COUNT,SHELL_KINDS,SHELL_SAVE_KEY,PICKUP_DISTANCE,
 generateShells,normalizeShellState,visibleShells,nearestShell,
 gatherShell,bagValue,sellAllShells
} from '../data/maps/shoreline-study/shells.mjs';
import {SHELL_ART,SHELL_COLORS,SHELL_ART_SIZE}
 from '../data/maps/shoreline-study/shell-art.mjs';

test('shell pixel art has three native-sized palettes and no unsupported colors',()=>{
 assert.equal(SHELL_ART_SIZE,20);
 assert.deepEqual(Object.keys(SHELL_ART).sort(),Object.keys(SHELL_KINDS).sort());
 for(const [kind,rows] of Object.entries(SHELL_ART)){
  assert.equal(rows.length,20,'each sprite is 20 rows');
  let solid=0;
  for(const row of rows){
   assert.ok(row.length<=20,'sprite exceeds width');
   for(const token of row){
    if(token==='.')continue;
    assert.ok(SHELL_COLORS[kind][token],kind+' missing palette key '+token);
    solid++;
   }
  }
  assert.ok(solid>70&&solid<300,'small but detailed pixel silhouette');
  assert.ok(SHELL_COLORS[kind].O[3]===255,'opaque dark pixel edge');
 }
 assert.notEqual(SHELL_KINDS.white.value,SHELL_KINDS.sakura.value);
 assert.ok(SHELL_KINDS.sakura.value>SHELL_KINDS.spiral.value);
 assert.ok(SHELL_KINDS.spiral.value>SHELL_KINDS.white.value);
});

test('shell scatter is seeded, random-looking, sparse and never enters sea or rocks',()=>{
 assert.match(SHELL_SAVE_KEY,/preview-shoreline/);
 const a=generateShells(90412),b=generateShells(90412),c=generateShells(90413);
 assert.deepEqual(a,b,'reload uses the same positions');
 assert.notDeepEqual(a,c,'a different tide cycle produces another layout');
 assert.equal(a.length,SHELL_COUNT);
 assert.equal(new Set(a.map(item=>item.id)).size,SHELL_COUNT);
 assert.ok(new Set(a.map(item=>item.x%TILE)).size>=7,'placement is not all cell-centred');
 assert.ok(new Set(a.map(item=>item.kind)).size>=2,'varied shell types');
 for(const item of a){
  const tx=Math.floor(item.x/TILE),ty=Math.floor(item.y/TILE);
  assert.equal(MAP[ty]?.[tx],'sand','not sea');
  assert.ok(ty>=SHORE_Y[tx]+1,'past breaking surf');
  assert.ok(Math.hypot(item.x-START.x,item.y-START.y)>=28,'not on hero spawn');
  for(const rock of SCENERY)
   assert.ok(Math.hypot(item.x-rock.x,item.y-rock.y)>=34,'not buried under rock');
 }
 for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)
  assert.ok(Math.hypot(a[i].x-a[j].x,a[i].y-a[j].y)>=32,'no stacked shells');
 for(let seed=0;seed<12;seed++){
  const group=generateShells(seed);
  assert.equal(group.length,SHELL_COUNT,'all tested seeds produce the requested 20');
 }
});

test('pickup requires foot proximity, remains gone after reload and sells once',()=>{
 const seed=90412,first=generateShells(seed)[0];
 let state=normalizeShellState({seed});
 assert.equal(visibleShells(state).length,SHELL_COUNT);
 assert.equal(nearestShell(state,first.x,first.y)?.id,first.id);
 let far=gatherShell(state,first.id,first.x+PICKUP_DISTANCE+3,first.y);
 assert.equal(far.accepted,false);
 assert.equal(far.state.picked.length,0);
 let pick=gatherShell(state,first.id,first.x,first.y);
 assert.equal(pick.accepted,true);
 state=pick.state;
 assert.equal(state.picked.length,1);
 assert.equal(state.bag[first.kind],1);
 assert.equal(visibleShells(state).length,SHELL_COUNT-1);
 assert.equal(bagValue(state),SHELL_KINDS[first.kind].value);
 assert.equal(gatherShell(state,first.id,first.x,first.y).accepted,false,
  'already collected id cannot duplicate rewards');
 state=normalizeShellState(JSON.parse(JSON.stringify(state)));
 assert.equal(state.picked.length,1,'collected shell stays gone on refresh');
 const sold=sellAllShells(state);
 assert.equal(sold.accepted,true);
 assert.equal(sold.amount,SHELL_KINDS[first.kind].value);
 assert.equal(sold.state.gold,sold.amount);
 assert.equal(bagValue(sold.state),0);
 assert.equal(visibleShells(sold.state).length,SHELL_COUNT-1);
 assert.equal(sellAllShells(sold.state).accepted,false,'cannot sell twice');
 assert.equal(sellAllShells(sold.state).state.gold,sold.amount);
});

test('bag accounts for multiple kinds and a new cycle retains sold gold',()=>{
 const seed=7217,items=generateShells(seed);
 let state=normalizeShellState({seed});
 for(const shell of items.slice(0,6)){
  const picked=gatherShell(state,shell.id,shell.x,shell.y);
  assert.equal(picked.accepted,true);
  state=picked.state;
 }
 const expected=items.slice(0,6).reduce((sum,shell)=>sum+SHELL_KINDS[shell.kind].value,0);
 assert.equal(bagValue(state),expected);
 const sold=sellAllShells(state);
 assert.equal(sold.amount,expected);
 state=normalizeShellState({seed:7218,gold:sold.state.gold});
 assert.equal(state.gold,expected);
 assert.equal(state.picked.length,0);
 assert.equal(visibleShells(state).length,SHELL_COUNT);
});

test('malformed persistence does not create invalid shell entries or negative gold',()=>{
 const clean=normalizeShellState({seed:77,picked:['not-a-shell','shell-0','shell-0'],
  sold:['not-a-shell','shell-0'],gold:-20});
 assert.deepEqual(clean.picked,['shell-0']);
 assert.deepEqual(clean.sold,['shell-0']);
 assert.equal(clean.gold,0);
 assert.equal(bagValue(clean),0);
 assert.equal(normalizeShellState({seed:Infinity},77).seed,77);
 assert.ok(visibleShells(clean).every(s=>s.id!=='shell-0'));
});

test('shell collection stays a standalone preview without modifying production currency',()=>{
 const preview=readFileSync('previews/shoreline-study/index.html','utf8');
 assert.match(preview,/data\/maps\/shoreline-study\/shells\.mjs/);
 assert.match(preview,/data\/maps\/shoreline-study\/shell-art\.mjs/);
 assert.ok(preview.includes('createShellAtlas()'));
 assert.ok(preview.includes("render:'native-20px-pixel-atlas'"));
 assert.ok(preview.includes('gatherShell(shellState,'));
 assert.ok(preview.includes('sellAllShells(shellState)'));
 assert.ok(preview.includes("localStorage.setItem(SHELL_SAVE_KEY"));
 assert.ok(preview.includes('ctx.drawImage(shellAtlas.canvas'));
 assert.match(preview,/id="pickup-shell"/);
 assert.match(preview,/id="sell-shells"/);
 assert.match(preview,/id="reroll-shells"/);
 assert.doesNotMatch(preview,/readPlayer\(|savePlayer\(|PLAYER_KEY|KIKOKU_SAVE_SNAPSHOT/);
});
