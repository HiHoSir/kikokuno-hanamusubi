import test from 'node:test';
import assert from 'node:assert/strict';
import {CAVE_FLOORS,CAVE_TILE,CAVE_BOSS_ID,caveCellOpen,caveCellCenter,caveFeatureBlocks,caveStairAt,caveEncounterTerrain,caveLayout} from '../data/maps/cave/floors.mjs';
import {DEFAULT_PLAYER,createBattle,collectFind,normalizePlayer,readPlayer,savePlayer} from '../src/game/battle/rules.mjs';
import {makeWalk} from '../src/game/village/movement.mjs';
import {saveManualGame,restoreSavedGame} from '../src/game/save/save-game.mjs';

test('all three cave floors have walkable routes between their portals',()=>{
 for(const [floor,layout] of CAVE_FLOORS.entries()){
   assert.ok(layout.grid.every(row=>row.length===layout.grid[0].length));
   const cells=[layout.entry],visited=new Set(cells.map(cell=>cell.join(',')));
   for(const [x,y] of cells)for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
     const cell=[x+dx,y+dy],key=cell.join(',');
     if(caveCellOpen(floor,...cell)&&!visited.has(key)){visited.add(key);cells.push(cell);}
   }
   for(const feature of [layout.up,layout.down].filter(Boolean)){
     const position=caveCellCenter(feature.approach);
     const [x,y]=position;
     for(const offset of [-14,0,14])
      assert.equal(caveStairAt(floor,x+offset,y),feature);
     assert.ok(layout.features.every(part=>!caveFeatureBlocks(part,...position)));
     const solid=feature.origin.map(value=>(value+1)*CAVE_TILE);
     assert.equal(caveFeatureBlocks(feature,...solid),true);
     assert.equal(caveStairAt(floor,...solid),undefined);
   }
   for(const key of ['exit','up','down','boss']){
     const cell=layout[key]?.approach??layout[key];
     if(cell)assert.ok(visited.has(cell.join(',')),key+' on B'+(floor+1));
   }
 }
});

test('off-center walking from each stair landing reaches the opening',()=>{
 for(const [index,floor] of CAVE_FLOORS.entries()){
  const width=floor.grid[0].length*CAVE_TILE,height=floor.grid.length*CAVE_TILE;
  const blocked=Uint8Array.from({length:width*height},(_,pixel)=>
   floor.grid[Math.floor(pixel/width/CAVE_TILE)][Math.floor(pixel%width/CAVE_TILE)]==='#');
  const walk=makeWalk(width,height,blocked,8);
  for(const stair of [floor.up,floor.down].filter(Boolean)){
   for(const offset of [-14,0,14]){
    const [cx,cy]=caveCellCenter(stair.approach);
    let x=cx+offset,y=cy,touched=false;
    const dy=stair.kind==='up'?5:-5;
    for(let step=0;step<20&&!touched;step++){
     const active=caveStairAt(index,x,y);
     [x,y]=walk.move(x,y,0,dy,(px,py)=>{
      if(active===stair&&caveFeatureBlocks(stair,px,py))touched=true;
      return floor.features.some(part=>caveFeatureBlocks(part,px,py));
     });
    }
    assert.ok(touched,'stair approach '+[index,stair.kind,offset].join('/'));
   }
  }
 }
});

test('the entrance maze has independent west and east routes and a one-way return ledge',()=>{
 const floor=CAVE_FLOORS[0];
 const portal=floor.down.approach.join(',');
 function traverse(blocked, features=floor.features){
  const reachable=new Set([floor.entry.join(',')]);
  const queue=[floor.entry];
  for(const [x,y] of queue){
   for(const [col,row] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
    const key=[col,row].join(',');
    if(blocked.has(key)||reachable.has(key)||!caveCellOpen(0,col,row))continue;
    if(features.some(part=>caveFeatureBlocks(part,...caveCellCenter([col,row]))))continue;
    queue.push([col,row]);
    reachable.add(key);
   }
  }
  return reachable;
 }
 const west=traverse(new Set(['12,17','14,17']));
 assert.ok(west.has(portal));
 assert.ok(west.has('6,3'),'the store alcove is accessible');
 const east=traverse(new Set(['8,17']));
 assert.ok(east.has(portal));
 const ledge=floor.features.find(part=>part.kind==='drop');
 assert.ok(east.has(ledge.origin.join(','))&&east.has(ledge.landing.join(',')));
 assert.equal(caveCellOpen(0,ledge.origin[0],ledge.origin[1]+1),false);
 assert.equal(caveCellOpen(0,ledge.landing[0],ledge.landing[1]-1),false);
});

test('the lower passage has encounters, and caches use the saved one-time pickup system',()=>{
 assert.equal(caveEncounterTerrain(1,...caveCellCenter([15,14])),true);
 assert.equal(caveEncounterTerrain(1,...caveCellCenter([15,3])),false);
 assert.equal(caveEncounterTerrain(1,...caveCellCenter([6,14])),false);
 for(const floor of CAVE_FLOORS){
  const cache=floor.features.find(feature=>feature.kind==='cache');
  const find=collectFind(DEFAULT_PLAYER,cache.id);
  assert.equal(find.accepted,true);
  const restored=normalizePlayer(find.player);
  assert.equal(collectFind(restored,cache.id).accepted,false);
 }
});

test('the cave shortcut opens only after the second seal has been recorded',()=>{
 assert.equal(caveLayout(1,[]).grid[7][14],'#');
 assert.equal(caveLayout(1,['cave-white-seal']).grid[7][14],'#');
 const opened=caveLayout(1,['cave-white-seal','cave-black-seal']);
 assert.equal(opened.grid[7].slice(8,21),'.............');
 assert.equal(opened.features.at(-1).id,'cave-sealed-passage');
});

test('the guardian telegraphs the heavy strike and guarding reduces it',()=>{
 const hero={...DEFAULT_PLAYER,lv:3,hp:42};
 const attack=createBattle(CAVE_BOSS_ID,hero,()=>0.5);
 const guard=createBattle(CAVE_BOSS_ID,hero,()=>0.5);
 const opening=attack.act('attack');
 guard.act('attack');
 assert.match(opening.events.at(-1).text,/大槌を高く掲げた/);
 assert.equal(attack.state.hero.hp,42);
 const result=attack.act('attack');
 guard.act('guard');
 assert.match(result.events.at(-1).text,/岩砕き/);
 assert.ok(guard.state.hero.hp>attack.state.hero.hp);
});

test('the guardian grants the tool only on victory; both gate flags survive a cave save',()=>{
 const escaped=createBattle(CAVE_BOSS_ID,DEFAULT_PLAYER,()=>0);
 assert.equal(escaped.act('flee').outcome,'escape');
 assert.equal(escaped.state.hero.caveQuest.rockBreaker,false);
 const lost=createBattle(CAVE_BOSS_ID,{...DEFAULT_PLAYER,hp:1},()=>0.5);
 lost.act('guard');
 assert.equal(lost.act('guard').outcome,'defeat');
 assert.equal(lost.state.hero.caveQuest.rockBreaker,false);
 const fight=createBattle(CAVE_BOSS_ID,{...DEFAULT_PLAYER,lv:5,hp:58},()=>0.5);
 for(const command of ['bloom','guard','bloom','bloom'])fight.act(command);
 assert.equal(fight.state.outcome,'victory');
 const hero=fight.state.hero;
 assert.deepEqual(hero.caveQuest,{rockBreaker:true,bridgeCleared:false});
 assert.equal(normalizePlayer({caveQuest:{bridgeCleared:true}}).caveQuest.bridgeCleared,false);

 const makeStorage=()=>{
   const memory=new Map();
   return {getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),
     removeItem:key=>memory.delete(key)};
 };
 const storage=makeStorage(),session=makeStorage();
 const [x,y]=CAVE_FLOORS[2].entry.map(cell=>(cell+.5)*CAVE_TILE);
 const location={scene:'cave',position:{x,y,floor:2,face:1}};
 savePlayer({...hero,caveQuest:{rockBreaker:true,bridgeCleared:true}},storage);
 assert.equal(saveManualGame(location,storage).accepted,true);
 savePlayer(DEFAULT_PLAYER,storage);
 assert.deepEqual(restoreSavedGame('manual',storage,session).save.location,location);
 assert.deepEqual(readPlayer(storage).caveQuest,{rockBreaker:true,bridgeCleared:true});
});
