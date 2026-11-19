import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {SHORE_Y,SCENERY} from '../data/maps/shoreline-study/scene.mjs';
import {COVE_SHELL_SITES,validateCoveShellSites} from '../data/maps/sea-cove/shells.mjs';
import {SHELL_ART_SIZE} from '../src/game/items/shell-art.mjs';
import {
 COVE_MAP,COVE_WIDTH,COVE_HEIGHT,COVE_SHORE,COVE_SAND_DEPTH,COVE_TILE_SIZE,
 tileAt,walkableCell,walkablePoint,isSouthExit
} from '../data/maps/sea-cove/scene.mjs';
import {coastMask} from '../src/game/cove/render.mjs';
import {WORLD_SCENE_ZOOM} from '../src/game/ui/world-scale.mjs';
import {PSP_DISPLAY,PSP_ASPECT,minPSPScrollingMapCells,pspScrollingMapCoverage}
 from '../src/game/ui/psp-display.mjs';
import {pixelViewport} from '../src/game/village/render.mjs';
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
test('PSP 480x272 is the scrolling-world minimum; no iPhone-only terrain expansion',()=>{
 assert.deepEqual(PSP_DISPLAY,{width:480,height:272});
 assert.equal(PSP_ASPECT,480/272);
 assert.equal(WORLD_SCENE_ZOOM,0.5);
 assert.deepEqual(minPSPScrollingMapCells(32,WORLD_SCENE_ZOOM),
   {columns:30,rows:17});
 assert.throws(()=>minPSPScrollingMapCells(32,0),RangeError);
 const coverage=pspScrollingMapCoverage(COVE_MAP,WORLD_SCENE_ZOOM);
 assert.equal(coverage.coversScreen,true,
   'at PSP native output, the scrolling cove should have no outside-map region');
 assert.deepEqual(coverage.displayPixels,{width:672,height:704});
 assert.deepEqual(coverage.cameraRange,{x:384,y:864});
 for(const dpr of [1,2,3]){
   const vp=pixelViewport(PSP_DISPLAY.width,PSP_DISPLAY.height,dpr);
   const visibleWorldWidth=vp.width/vp.step;
   const visibleWorldHeight=vp.height/vp.step;
   assert.equal(visibleWorldWidth,960);
   assert.equal(visibleWorldHeight,544);
   // Even when the hero approaches any map corner, the camera's clamped
   // rect must remain inside the authored map; there is no right/bottom void.
   for(const [px,py] of [[0,0],[COVE_WIDTH*32,0],[0,COVE_HEIGHT*32],
      [COVE_WIDTH*32,COVE_HEIGHT*32],[COVE_MAP.entry.x,COVE_MAP.entry.y]]){
     const cameraX=Math.max(0,Math.min(COVE_WIDTH*32-visibleWorldWidth,px-visibleWorldWidth/2));
     const cameraY=Math.max(0,Math.min(COVE_HEIGHT*32-visibleWorldHeight,py-visibleWorldHeight/2-106));
     assert.ok(cameraX>=0 && cameraX+visibleWorldWidth<=COVE_WIDTH*32);
     assert.ok(cameraY>=0 && cameraY+visibleWorldHeight<=COVE_HEIGHT*32);
   }
 }
});

test('approved 30-column coast is preserved exactly while its connected wave chips extend east',()=>{
 assert.equal(COVE_WIDTH,42);
 assert.equal(COVE_HEIGHT,44);
 assert.equal(COVE_TILE_SIZE,32);
 assert.deepEqual(COVE_SHORE.slice(0,SHORE_Y.length),SHORE_Y);
 assert.equal(COVE_SHORE.length,42);
 for(let x=1;x<COVE_WIDTH;x++)assert.ok(Math.abs(COVE_SHORE[x]-COVE_SHORE[x-1])<=1,
   'extended shoreline must not skip chip corners at x='+x);
 assert.deepEqual(COVE_SAND_DEPTH,COVE_SHORE.map(y=>44-y));
 assert.equal(COVE_MAP.tiles.length,COVE_HEIGHT);
 for(const [y,row] of COVE_MAP.tiles.entries()){
   assert.equal(row.length,COVE_WIDTH);
   assert.match(row,/^[s~]{42}$/);
   for(let x=0;x<COVE_WIDTH;x++)
     assert.equal(row[x],y<COVE_SHORE[x]?'~':'s','coast mismatch '+x+','+y);
 }
 assert.equal(COVE_MAP.objects.filter(o=>o.kind==='rocks').length,SCENERY.length);
 for(const rock of SCENERY)
   assert.ok(COVE_MAP.objects.some(o=>o.id===rock.id&&o.x===rock.x&&o.y===rock.y),
     'original rock position moved: '+rock.id);
 assert.equal(COVE_MAP.objects.filter(o=>o.kind==='flowers').length,0,
   'do not introduce unreviewed flowers and woods on the beach');
 assert.ok(walkablePoint(COVE_MAP.entry.x,COVE_MAP.entry.y));
 assert.deepEqual([COVE_MAP.entry.x,COVE_MAP.entry.y],[336,432],
   'do not shift the approved starting view one tile upward');
 assert.equal(tileAt(0,0),'~');
 assert.equal(walkableCell(41,20),false);
 assert.equal(walkableCell(29,20),true);
 assert.deepEqual(COVE_MAP.tiles.slice(0,22).map(row=>row.slice(0,30)),
  Array.from({length:22},(_,y)=>
    Array.from({length:30},(_,x)=>y<SHORE_Y[x]?'~':'s').join('')),
  'the entire pre-extension map must stay pixel-compatible');
});
test('approved sand reaches the south exit without a grass strip; fisher remains reachable',()=>{
 assert.ok(COVE_SAND_DEPTH.every(n=>n>=35));
 assert.ok(COVE_MAP.exit.columns.every(x=>tileAt(x,COVE_MAP.exit.row)==='s'));
 const entry=[Math.floor(COVE_MAP.entry.x/32),Math.floor(COVE_MAP.entry.y/32)];
 const fisher=[Math.floor(COVE_MAP.fisher.x/32),Math.floor(COVE_MAP.fisher.y/32)];
 assert.ok(bfs(entry,p=>Math.abs(p[0]-fisher[0])+Math.abs(p[1]-fisher[1])===1));
 assert.ok(bfs(entry,p=>isSouthExit(...p)));
 assert.ok(walkableCell(...fisher));
});
test('fisher homestead uses new southern sand; native assets; no blocked field return',()=>{
 const house=COVE_MAP.objects.find(o=>o.id==='fisher-house');
 const net=COVE_MAP.objects.find(o=>o.id==='net-rack');
 const bundle=COVE_MAP.objects.find(o=>o.id==='net-bundle');
 const rope=COVE_MAP.objects.find(o=>o.id==='rope-coil');
 assert.equal(house.kind,'fisherHouse');
 assert.equal(net.kind,'netRack');
 assert.equal(bundle.kind,'netBundle');
 assert.equal(rope.kind,'ropeCoil');
 assert.deepEqual([house.x,house.y],[660,1063]);
 assert.deepEqual([net.x,net.y],[1050,1050]);
 assert.ok(house.collision.top>22*32,'the house must not overlap any old terrain rows');
 assert.ok(net.collision.top>22*32,'net stays in new area');
 assert.deepEqual(net.collision,{
   left:net.x-232/2,right:net.x+232/2,top:net.y-176,bottom:net.y
 },'collision must track the entire redrawn original-size drying net');
 assert.equal(bundle.radius,49,'net-bundle collision must follow its enlarged footprint');
 assert.equal(rope.radius,29,'rope collision must follow its enlarged footprint');
 for(const old of ['net-drying-rack-192x150.png','net-bundle-112x66.png',
   'rope-coil-68x50.png']){
   assert.equal(existsSync('assets/sea-cove/objects/'+old),false,
     'outdated object should not remain alongside redrawn version: '+old);
 }

 assert.ok(house.collision.right<net.collision.left-40,
   'retain at least one clear walking corridor between home and drying rack');
 assert.ok(COVE_MAP.objects.some(o=>o.kind==='crate'));
 assert.ok(COVE_MAP.objects.filter(o=>o.kind==='barrel').length>=2);
 const walker=source('src/game/cove/walk.mjs');
 for(const [name,file,w,h] of [
  ['fisherHouse','assets/village/scene/house-thatch.png',390,357],
  ['netRack','assets/sea-cove/objects/net-drying-rack-232x176.png',232,176],
  ['netBundle','assets/sea-cove/objects/net-bundle-146x88.png',146,88],
  ['ropeCoil','assets/sea-cove/objects/rope-coil-88x62.png',88,62],
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

test('cove supply sprites have actual native dimensions, never fake-size 32px village props',()=>{
 const walker=source('src/game/cove/walk.mjs');
 const renderer=source('src/game/cove/render.mjs');
 assert.match(renderer,/actor\.image\.naturalWidth\/2/);
 assert.match(renderer,/actor\.image\.naturalHeight/);
 for(const [kind,path,w,h,radius,requiredCount] of [
  ['basket','assets/sea-cove/objects/fish-basket-80x74.png',80,74,37,2],
  ['barrel','assets/sea-cove/objects/fish-barrel-64x86.png',64,86,29,2],
  ['crate','assets/sea-cove/objects/fish-crate-92x70.png',92,70,40,1],
 ]){
  assert.ok(walker.includes(kind+':\''+path+'\''),kind+' uses its own real-size art');
  const png=readFileSync(path);
  assert.equal(png.subarray(1,4).toString('ascii'),'PNG');
  assert.equal(png.readUInt32BE(16),w,kind+' actual art width');
  assert.equal(png.readUInt32BE(20),h,kind+' actual art height');
  assert.equal(png[25],6,kind+' RGBA image');
  const instances=COVE_MAP.objects.filter(o=>o.kind===kind);
  assert.equal(instances.length,requiredCount);
  for(const o of instances){
   assert.equal(o.footPosition,true,'pixel-art foot anchors are world coordinates');
   assert.equal(o.radius,radius,'collision matches the intended visible footprint');
   assert.ok(o.radius*2<=w&&o.radius*2>=w-16,'not a tiny sprite with an oversized collision');
  }
 }
 assert.doesNotMatch(walker,/basket:'assets\/village\/objects\/basket\.png'/);
 assert.doesNotMatch(walker,/barrel:'assets\/village\/objects\/barrel\.png'/);
 assert.doesNotMatch(walker,/crate:'assets\/village\/objects\/crate\.png'/);
});
test('native rock sprites are actual sizes and do not visually bury shell pickups',()=>{
 const walker=source('src/game/cove/walk.mjs');
 const renderer=source('src/game/cove/render.mjs');
 assert.match(renderer,/art\[object\.sprite\?\?object\.kind\]/);
 const rocks=COVE_MAP.objects.filter(o=>o.kind==='rocks');
 assert.equal(rocks.length,3);
 for(const [id,key,path,w,h,radius] of [
  ['rock-west','rockWest','assets/sea-cove/objects/shore-rock-west-60x40.png',60,40,23],
  ['rock-east','rockEast','assets/sea-cove/objects/shore-rock-east-104x64.png',104,64,39],
  ['rock-headland','rockHeadland','assets/sea-cove/objects/shore-rock-headland-108x72.png',108,72,43]
 ]){
  const rock=rocks.find(o=>o.id===id);
  assert.ok(rock);
  assert.equal(rock.sprite,key);
  assert.equal(rock.radius,radius);
  assert.equal(rock.footPosition,true);
  assert.ok(walker.includes(key+':\''+path+'\''));
  assert.ok(radius*2<=w);
  const png=readFileSync(path);
  assert.equal(png.subarray(1,4).toString('ascii'),'PNG');
  assert.equal(png.readUInt32BE(16),w);
  assert.equal(png.readUInt32BE(20),h);
  assert.equal(png[25],6);
  const area={l:rock.x-w/2,r:rock.x+w/2,t:rock.y-h,b:rock.y};
  for(const shell of COVE_SHELL_SITES){
   const pickup={l:shell.x-SHELL_ART_SIZE/2,r:shell.x+SHELL_ART_SIZE/2,
     t:shell.y-SHELL_ART_SIZE+4,b:shell.y+4};
   assert.equal(area.l<pickup.r&&area.r>pickup.l&&
     area.t<pickup.b&&area.b>pickup.t,false,rock.id+' hides '+shell.id);
  }
 }
 assert.deepEqual(validateCoveShellSites(),[]);
 assert.doesNotMatch(walker,/rocks:'assets\/village\/objects\/rocks\.png'/);
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
