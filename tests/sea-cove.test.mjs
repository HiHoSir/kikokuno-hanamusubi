import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SHORE_Y,SCENERY} from '../data/maps/shoreline-study/scene.mjs';
import {
 COVE_MAP,COVE_WIDTH,COVE_HEIGHT,COVE_SHORE,COVE_SAND_DEPTH,COVE_TILE_SIZE,
 tileAt,walkableCell,walkablePoint,isSouthExit
} from '../data/maps/sea-cove/scene.mjs';
import {coastMask} from '../src/game/cove/render.mjs';
import {TIDE_FRAMES,tideFrame,surfSample} from '../src/game/terrain/surf.mjs';
import {CHAPTER_ONE_STAGES,objectiveForStage,normalizeStage} from '../src/game/story/chapter-one.mjs';
import {readSavedGame,saveGame,restoreSavedGame,routeForSavedGame}
 from '../src/game/save/save-game.mjs';
import {readPlayer,savePlayer,DEFAULT_PLAYER} from '../src/game/battle/rules.mjs';
const source=path=>readFileSync(path,'utf8');
const stubStorage=()=>{
 const data=new Map();
 return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),
 removeItem:k=>data.delete(k)};
};
function bfs(start,goal){
 const queue=[start],seen=new Set([start.join(',')]);
 for(const p of queue){
  if(goal(p))return true;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const next=[p[0]+dx,p[1]+dy],key=next.join(',');
   if(!seen.has(key)&&walkableCell(...next)){seen.add(key);queue.push(next);}
  }
 }
 return false;
}
test('production cove replaces its terrain with the APPROVED 30-column coastline, sand to south',()=>{
 assert.equal(COVE_WIDTH,30);
 assert.equal(COVE_HEIGHT,34);
 assert.equal(COVE_TILE_SIZE,32);
 assert.deepEqual(COVE_SHORE,SHORE_Y);
 assert.deepEqual(COVE_SAND_DEPTH,COVE_SHORE.map(y=>34-y));
 assert.equal(COVE_MAP.tiles.length,COVE_HEIGHT);
 for(const [y,row] of COVE_MAP.tiles.entries()){
   assert.equal(row.length,COVE_WIDTH);
   assert.match(row,/^[s~]{30}$/);
   for(let x=0;x<COVE_WIDTH;x++)
     assert.equal(row[x],y<SHORE_Y[x]?'~':'s','coast mismatch '+x+','+y);
 }
 assert.equal(COVE_MAP.objects.filter(o=>o.kind==='rocks').length,SCENERY.length);
 for(const rock of SCENERY)
   assert.ok(COVE_MAP.objects.some(o=>o.id===rock.id&&o.x===rock.x&&o.y===rock.y),
     'accepted native rock moved: '+rock.id);
 assert.equal(COVE_MAP.objects.filter(o=>o.kind==='flowers').length,0,
   'do not introduce unreviewed flowers and woods on the beach');
 assert.ok(walkablePoint(COVE_MAP.entry.x,COVE_MAP.entry.y));
 assert.deepEqual([COVE_MAP.entry.x,COVE_MAP.entry.y],[336,432],
   'do not shift the approved starting view one tile upward');
 assert.equal(tileAt(0,0),'~');
 assert.equal(walkableCell(29,20),false);
 assert.deepEqual(COVE_MAP.tiles.slice(0,22),
  Array.from({length:22},(_,y)=>
    Array.from({length:30},(_,x)=>y<SHORE_Y[x]?'~':'s').join('')),
  'the entire pre-extension map must stay pixel-compatible');
});
test('approved sand reaches the south exit without a grass strip; fisher remains reachable',()=>{
 assert.ok(COVE_SAND_DEPTH.every(n=>n>=25));
 assert.ok(COVE_MAP.exit.columns.every(x=>tileAt(x,COVE_MAP.exit.row)==='s'));
 const entry=[Math.floor(COVE_MAP.entry.x/32),Math.floor(COVE_MAP.entry.y/32)];
 const fisher=[Math.floor(COVE_MAP.fisher.x/32),Math.floor(COVE_MAP.fisher.y/32)];
 assert.ok(bfs(entry,p=>Math.abs(p[0]-fisher[0])+Math.abs(p[1]-fisher[1])===1));
 assert.ok(bfs(entry,p=>isSouthExit(...p)));
 assert.ok(walkableCell(...fisher));
});
test('a fisher homestead extends ONLY south, with native-size assets and real play paths',()=>{
 const house=COVE_MAP.objects.find(o=>o.id==='fisher-house');
 const net=COVE_MAP.objects.find(o=>o.id==='net-rack');
 const bundle=COVE_MAP.objects.find(o=>o.id==='net-bundle');
 const rope=COVE_MAP.objects.find(o=>o.id==='rope-coil');
 assert.equal(house.kind,'fisherHouse');
 assert.equal(net.kind,'netRack');
 assert.equal(bundle.kind,'netBundle');
 assert.equal(rope.kind,'ropeCoil');
 assert.deepEqual([house.x,house.y],[272,976]);
 assert.deepEqual([net.x,net.y],[720,872]);
 assert.ok(house.collision.top>19*32,'the house must not intrude on first view');
 assert.ok(net.collision.top>22*32,'net stays in new area');
 assert.ok(COVE_MAP.objects.some(o=>o.kind==='crate'));
 assert.ok(COVE_MAP.objects.filter(o=>o.kind==='barrel').length>=2);
 const walker=source('src/game/cove/walk.mjs');
 for(const [name,file,w,h] of [
  ['fisherHouse','assets/village/scene/house-thatch.png',390,357],
  ['netRack','assets/sea-cove/objects/net-drying-rack-192x150.png',192,150],
  ['netBundle','assets/sea-cove/objects/net-bundle-112x66.png',112,66],
  ['ropeCoil','assets/sea-cove/objects/rope-coil-68x50.png',68,50],
 ]){
   assert.ok(walker.includes(name+':\''+file+'\''),name+' asset');
   const bin=readFileSync(file);
   assert.equal(bin.readUInt32BE(16),w,name+' native width');
   assert.equal(bin.readUInt32BE(20),h,name+' native height');
   assert.equal(bin[25],6,name+' RGBA alpha');
 }
 const collision=(x,y)=>COVE_MAP.objects.some(o=>{
   if(o.collision){
     const a=o.collision;
     return x>=a.left-6&&x<=a.right+6&&y>=a.top-6&&y<=a.bottom+6;
   }
   const px=o.footPosition?o.x:o.x*32+16;
   const py=o.footPosition?o.y:(o.y+1)*32-10;
   return Math.hypot(x-px,y-py)<(o.radius??22)+3;
 })||Math.hypot(x-COVE_MAP.fisher.x,y-COVE_MAP.fisher.y)<24;
 const start=[Math.floor(COVE_MAP.entry.x/32),Math.floor(COVE_MAP.entry.y/32)];
 const queue=[start],seen=new Set([start.join(',')]);
 let exitReached=false,frontReached=false,rackReached=false;
 for(const here of queue){
   const [tx,ty]=here;
   if(isSouthExit(tx,ty))exitReached=true;
   if(Math.hypot(tx*32+16-house.x,ty*32+16-(house.y+45))<60)frontReached=true;
   if(Math.hypot(tx*32+16-net.x,ty*32+16-(net.y+60))<110)rackReached=true;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const nx=tx+dx,ny=ty+dy,key=nx+','+ny;
     if(!seen.has(key)&&walkableCell(nx,ny)&&!collision(nx*32+16,ny*32+16)){
       seen.add(key);queue.push([nx,ny]);
     }
   }
 }
 assert.equal(exitReached,true,'must reach original south field return around house');
 assert.equal(frontReached,true,'house entrance frontage must remain accessible');
 assert.equal(rackReached,true,'net work area must be reachable');
 assert.equal(collision(house.x,house.y-70),true,'house must block roof invisibility');
 assert.equal(collision(net.x,net.y-40),true,'cannot walk through net mesh');
 assert.equal(collision(COVE_MAP.entry.x,COVE_MAP.entry.y),false);
});

test('same approved landscape ground, contour masks, water chips and eight-frame surf',()=>{
 assert.equal(TIDE_FRAMES.length,8);
 assert.deepEqual(TIDE_FRAMES.map(x=>x.reach),[2,4,7,11,14,11,7,4]);
 assert.equal(tideFrame(260*4).reach,14);
 assert.equal(surfSample(14,'sand',4,0),3);
 const renderer=source('src/game/cove/render.mjs');
 assert.match(renderer,/landscape\.groundLayer\(dryMap\)/);
 assert.match(renderer,/const dryMap=map\.tiles\.map/);
 assert.match(renderer,/chip\(ground\.ctx,sandEdges\[\(x&1\)\+2\*\(y&1\)\]/);
 assert.match(renderer,/surfSample\(wy-shoreY\[wx\],'sand',phase,wx\)/);
 assert.match(renderer,/const frame=Math\.floor\(time\/360\)%2/);
 assert.match(renderer,/ctx\.drawImage\(surf\.sheet,sx,sy,TILE,TILE/);
 assert.match(renderer,/orientation:'sea-north'/);
 assert.match(renderer,/landJoin:'sea-to-sand-16-corner-alpha-autotiles'/);
 assert.doesNotMatch(renderer,/ctx\.globalAlpha=\.74/);
 const preview=source('data/maps/shoreline-study/tide.mjs');
 assert.ok(preview.includes('../../../src/game/terrain/surf.mjs'));
 const coveHtml=source('src/game/cove/index.html');
 const reviewHtml=source('previews/sea-cove-review/index.html');
 for(const html of [coveHtml,reviewHtml]){
   assert.match(html,/field\/assets\.js/);
   assert.match(html,/field\/landscape\.js/);
   assert.match(html,/field\/autotile\.js/);
 }
 const small={tiles:['ss~','ss~','~~~']};
 assert.equal(coastMask(small,0,0),15);
 assert.equal(coastMask(small,1,0),9);
});
test('approved image and hero dimensions remain native; no field edits needed',()=>{
 const images=[
   ['assets/field/effects/water-motion.png',128,64],
   ['assets/field/terrain/atlas/coast-mask-32.png',128,128],
   ...[0,1,2,3].map(n=>['assets/field/terrain/atlas/coast-sand-'+n+'-32.png',128,128]),
   ['assets/characters/hizuki/walk-4dir-80x112.png',240,448],
   ['assets/characters/npc/villager-walk-4dir-80x112.png',240,448],
   ['assets/characters/npc/ushiohei-walk-4dir-80x112.png',240,448]
 ];
 for(const [path,w,h] of images){
   const b=readFileSync(path);
   assert.equal(b.subarray(1,4).toString('ascii'),'PNG');
   assert.equal(b.readUInt32BE(16),w,path+' width');
   assert.equal(b.readUInt32BE(20),h,path+' height');
 }
});
test('field landmark and shell/game routes remain part of the real game shell',()=>{
 const field=source('src/field/walk.mjs');
 const shell=source('src/game/navigation/game-shell.mjs');
 const admission=source('src/game/navigation/entry.js');
 const html=source('src/game/cove/index.html');
 const walker=source('src/game/cove/walk.mjs');
 assert.match(shell,/src\/game\/cove\//);
 assert.match(shell,/track:'field', label:'海の入り江'/);
 assert.match(admission,/src\/game\/cove\//);
 assert.match(html,/navigation\/entry\.js" data-entry="game"/);
 assert.match(html,/data-bgm="field"/);
 assert.match(html,/\.\/walk\.mjs\?v=sea-cove-1/);
 assert.match(field,/destination==='shrine'\|\|destination==='cove'/);
 assert.match(field,/from==='cove' \? coveReturnPosition\(\)/);
 assert.match(walker,/fisher:'assets\/characters\/npc\/ushiohei-walk-4dir-80x112\.png'/);
 assert.doesNotMatch(walker,/fisher:'assets\/characters\/npc\/villager-walk/);
 assert.match(walker,/KIKOKU_ROUTE\.go\(/);
 assert.match(walker,/consumeRestorePosition\('cove'\)/);
 assert.match(walker,/KIKOKU_SAVE_SNAPSHOT/);
 assert.match(walker,/isSouthExit/);
 assert.doesNotMatch(walker,/location\.assign\(/);
});
test('Ushiohei dialogue and in-cove save persist without changing story semantics',()=>{
 assert.equal(CHAPTER_ONE_STAGES.at(-1),'forest');
 assert.equal(normalizeStage('forest'),'forest');
 assert.match(objectiveForStage('forest'),/忘れの森/);
 const walker=source('src/game/cove/walk.mjs');
 assert.match(walker,/advanceStoryStage\('forest'\)/);
 assert.match(walker,/潮平「昨夜の潮は妙だった/);
 const storage=stubStorage(),session=stubStorage();
 savePlayer({...DEFAULT_PLAYER,gold:24},storage);
 storage.setItem('kikokuno-hanamusubi-chapter-one','forest');
 const position={scene:'cove',position:{x:COVE_MAP.entry.x,y:COVE_MAP.entry.y,face:3}};
 assert.ok(saveGame('manual',position,storage,()=>Date.parse('2026-11-17T00:00:00Z')).accepted);
 assert.equal(readSavedGame('manual',storage).story,'forest');
 assert.ok(restoreSavedGame('manual',storage,session).accepted);
 const route=routeForSavedGame(readSavedGame('manual',storage),'https://example.test/kikokuno-hanamusubi/');
 assert.equal(route.pathname,'/kikokuno-hanamusubi/src/game/cove/');
 assert.equal(readPlayer(storage).gold,24);
});
