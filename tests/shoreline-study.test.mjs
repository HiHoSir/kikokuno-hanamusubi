import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 TILE,WIDTH,HEIGHT,MAP,SHORE_Y,START,SCENERY,
 sceneryCollision,canStandWithScenery,terrainAt,walkable,safeFoot,
 shoreCover,validateShore
} from '../data/maps/shoreline-study/scene.mjs';
import {TIDE_FRAMES,TIDE_INTERVAL_MS,tideFrame,surfFront,surfSample}
 from '../data/maps/shoreline-study/tide.mjs';

test('beach stretches inland without a forced grassy edge',()=>{
 assert.equal(TILE,32);
 assert.deepEqual([WIDTH,HEIGHT],[30,18]);
 assert.equal(SHORE_Y.length,WIDTH);
 assert.equal(MAP.length,HEIGHT);
 assert.ok(MAP.every(row=>row.length===WIDTH));
 assert.deepEqual([...new Set(MAP.flat())].sort(),['sand','sea']);
 assert.deepEqual(validateShore(),[]);
 for(let x=0;x<WIDTH;x++){
   assert.ok(HEIGHT-SHORE_Y[x]>=9,'minimum 9 full sand cells at column '+x);
   for(let y=SHORE_Y[x];y<HEIGHT;y++)
     assert.equal(terrainAt(x,y),'sand','never force grass at end of beach');
 }
 const counts=MAP.flat().reduce((acc,t)=>(acc[t]=(acc[t]||0)+1,acc),{});
 assert.ok(counts.sea>120 && counts.sand>250,JSON.stringify(counts));
 assert.equal(counts.grass,undefined);
});
test('approved sixteen-corner mask still connects straight and diagonal sea edges',()=>{
 const variants=new Set();
 for(let y=-1;y<HEIGHT;y++)for(let x=-1;x<WIDTH;x++){
   const bits=shoreCover(x,y);
   assert.ok(Number.isInteger(bits)&&bits>=0&&bits<=15);
   variants.add(bits);
 }
 assert.ok(variants.has(15)&&variants.has(0));
 assert.ok([...variants].some(v=>![0,3,6,9,12,15].includes(v)));
 for(let x=1;x<WIDTH;x++)
   assert.ok(Math.abs(SHORE_Y[x]-SHORE_Y[x-1])<=1,'coastline is connected');
});
test('eight accepted wave states still advance and retreat over the full sandy beach',()=>{
 assert.equal(TIDE_FRAMES.length,8);
 assert.equal(TIDE_INTERVAL_MS,260);
 assert.deepEqual(Array.from({length:8},(_,i)=>tideFrame(i*260).reach),
   [2,4,7,11,14,11,7,4]);
 assert.equal(tideFrame(0).phase,0);
 assert.equal(tideFrame(TIDE_INTERVAL_MS*8).phase,0,'loop repeats');
 assert.equal(tideFrame(TIDE_INTERVAL_MS*5).retreat,true);
 assert.equal(surfSample(15,'sand',0,0),0,'low tide exposes sand');
 assert.equal(surfSample(15,'sand',4,0),3,'high tide reaches beach');
 assert.equal(surfSample(8,'sand',7,0),1,'sand remains damp while wave retreats');
 assert.equal(surfSample(8,'sea',4,0),0,'wave layer does not replace open ocean');
 for(const phase of [0,1,2,3,4,5,6,7])
   for(let x=32;x<WIDTH*32;x+=32)
     assert.ok(Math.abs(surfFront(phase,x)-surfFront(phase,x-1))<=1,
       'no white-crest seam at world x='+x);
});
test('hero can approach tide and roam an inland sandy expanse but not enter the sea',()=>{
 assert.equal(safeFoot(START.x,START.y),true);
 const x=8*TILE+16,boundary=SHORE_Y[8];
 assert.equal(walkable(8,boundary-1),false);
 assert.equal(walkable(8,boundary),true);
 assert.equal(walkable(8,HEIGHT-2),true,'far inland beach is walkable');
 assert.equal(safeFoot(x,(boundary-1)*TILE+16),false);
 assert.equal(safeFoot(x,(boundary+1)*TILE+16),true);
 assert.equal(safeFoot(-10,200),false);
 assert.equal(safeFoot(300,100000),false);
});
test('three sparse native rocks rest on sand and preserve foot collisions',()=>{
 assert.equal(SCENERY.length,3);
 assert.ok(SCENERY.every(o=>o.kind==='rock'&&o.solid));
 assert.equal(new Set(SCENERY.map(o=>o.id)).size,3);
 for(const object of SCENERY){
   assert.ok(Number.isInteger(object.x)&&Number.isInteger(object.y));
   assert.equal(terrainAt(Math.floor(object.x/TILE),Math.floor((object.y-1)/TILE)),
     'sand','rock rests on beach');
   assert.ok(sceneryCollision(object.x,object.y),'rock foot blocks');
   assert.equal(canStandWithScenery(object.x,object.y),false);
 }
 assert.equal(canStandWithScenery(START.x,START.y),true);
 assert.ok(!sceneryCollision(START.x,START.y));
 assert.equal(canStandWithScenery(0,0),false);
});
test('review HTML draws approved mapchips, not grass band, preserves sprite and tide',()=>{
 const html=readFileSync('previews/shoreline-study/index.html','utf8');
 assert.ok(html.includes('window.YK_LANDSCAPE.groundLayer(dryMap)'));
 assert.ok(html.includes('奥まで広がる砂浜'));
 assert.ok(html.includes('ctx.drawImage(ground.staticMap,0,0)'));
 assert.match(html,/destination-in/);
 assert.match(html,/drawImage\(art\.water,frame\*64/);
 assert.match(html,/32pxアニメマップチップ/);
 assert.ok(html.includes('buildAnimatedTileAtlas(ground)'));
 assert.ok(html.includes('surfSample('));
 assert.ok(html.includes('drawImage(tileAtlas.sheet,'));
 assert.ok(html.includes('animated-32px-atlas-chips'));
 assert.ok(html.includes('ctx.putImageData(tile,'));
 assert.equal(html.includes('buildTideLayers('),false);
 assert.equal(html.includes('grassPaletteSprite('),false);
 assert.equal(html.includes('grassTuft'),false);
 assert.equal(html.includes('grassCover='),false);
 assert.ok(html.includes('drawCharacter(ctx,'));
 assert.ok(html.includes("characterSheet:'village-80x112'"));
 assert.ok(html.includes('canStandWithScenery(nx,ny)'));
 assert.match(html,/data-dir="up"/);
 assert.match(html,/aria-label="四方向移動"/);
 assert.match(html,/waterFrames:2/);
 assert.doesNotMatch(html,/src\/game\/cove|data\/maps\/sea-cove|ushiohei|潮平/);
 const manifest=JSON.parse(readFileSync('assets/manifest.json','utf8'));
 for(const asset of [
   'assets/characters/hizuki/walk-4dir-80x112.png',
   'assets/village/objects/rocks.png',
   'assets/field/effects/water-motion.png',
   'assets/field/terrain/atlas/coast-mask-32.png',
   'assets/field/terrain/atlas/coast-shallow-32.png',
   ...[0,1,2,3].map(n=>'assets/field/terrain/atlas/coast-sand-'+n+'-32.png')
 ])assert.ok(manifest.assets.some(a=>a.path===asset&&a.status==='approved'),asset);
});
