import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TILE,WIDTH,HEIGHT,MAP,SHORE_Y,SAND_DEPTH,START,terrainAt,walkable,safeFoot,shoreCover,validateShore}
 from '../data/maps/shoreline-study/scene.mjs';
import {TIDE_FRAMES,TIDE_INTERVAL_MS,tideFrame,surfFront,surfSample}
 from '../data/maps/shoreline-study/tide.mjs';

test('only a fixed 32px sea, sand, grass prototype is authored',()=>{
 assert.equal(TILE,32);
 assert.deepEqual([WIDTH,HEIGHT],[30,18]);
 assert.equal(SHORE_Y.length,WIDTH);
 assert.equal(SAND_DEPTH.length,WIDTH);
 assert.equal(MAP.length,HEIGHT);
 assert.ok(MAP.every(row=>row.length===WIDTH));
 assert.deepEqual([...new Set(MAP.flat())].sort(),['grass','sand','sea']);
 assert.deepEqual(validateShore(),[]);
 const counts=MAP.flat().reduce((acc,t)=>(acc[t]=(acc[t]||0)+1,acc),{});
 assert.ok(counts.sea>120 && counts.sand>60 && counts.grass>100,JSON.stringify(counts));
});
test('all 4-way coast turns preserve the sand buffer and 16-corner chip masks',()=>{
 const variants=new Set();
 for(let y=-1;y<HEIGHT;y++)for(let x=-1;x<WIDTH;x++){
  const bits=shoreCover(x,y);
  assert.ok(Number.isInteger(bits)&&bits>=0&&bits<=15);
  variants.add(bits);
 }
 assert.ok(variants.has(15)&&variants.has(0));
 assert.ok([...variants].some(v=>![0,3,6,9,12,15].includes(v)),
  'test diagonal/concave corner masks instead of only axis-aligned shores');
 for(let x=0;x<WIDTH;x++){
  for(let y=0;y<HEIGHT;y++){
   const type=terrainAt(x,y);
   if(type==='sea')for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])
     assert.notEqual(terrainAt(x+dx,y+dy),'grass','sea/grass touch at '+x+','+y);
  }
  if(x)assert.ok(Math.abs(SHORE_Y[x]-SHORE_Y[x-1])<=1,'slope exceeded one cell');
  assert.ok(SAND_DEPTH[x]>=3);
 }
});
test('eight wave states make the surf advance, break and retreat over sand',()=>{
 assert.equal(TIDE_FRAMES.length,8);
 assert.equal(TIDE_INTERVAL_MS,260);
 assert.deepEqual(Array.from({length:8},(_,i)=>tideFrame(i*260).reach),
  [2,4,7,11,14,11,7,4]);
 assert.equal(tideFrame(0).phase,0);
 assert.equal(tideFrame(TIDE_INTERVAL_MS*8).phase,0,'loop repeats');
 assert.equal(tideFrame(TIDE_INTERVAL_MS*5).retreat,true);
 assert.equal(surfSample(15,'sand',0,0),0,'low tide leaves exposed sand');
 assert.equal(surfSample(15,'sand',4,0),3,'high tide carries a crest onto the beach');
 assert.equal(surfSample(8,'sand',7,0),1,'wet sand stays visible after retreat');
 assert.equal(surfSample(8,'grass',4,0),0,'grass stays dry');
 assert.equal(surfSample(8,'sea',4,0),0,'surf layer does not replace sea');
 for(const phase of [0,1,2,3,4,5,6,7])
   for(let x=32;x<WIDTH*32;x+=32)
     assert.ok(Math.abs(surfFront(phase,x)-surfFront(phase,x-1))<=1,
       'wave crest has no abrupt tile seam at world x='+x);
});
test('the actor can approach the tide but the actual foot cannot enter the sea',()=>{
 assert.equal(safeFoot(START.x,START.y),true);
 const x=8*TILE+16,boundary=SHORE_Y[8];
 assert.equal(walkable(8,boundary-1),false);
 assert.equal(walkable(8,boundary),true);
 assert.equal(walkable(8,boundary+3),true);
 assert.equal(safeFoot(x,(boundary-1)*TILE+16),false);
 assert.equal(safeFoot(x,(boundary+1)*TILE+16),true);
 assert.equal(safeFoot(-10,200),false);
 assert.equal(safeFoot(300,100000),false);
});
test('preview is independent of the production village and cove, reuses approved 32px images',()=>{
 const html=readFileSync('previews/shoreline-study/index.html','utf8');
 assert.match(html,/from '..\/..\/data\/maps\/shoreline-study\/scene\.mjs'/);
 assert.match(html,/YK_LANDSCAPE\\.groundLayer\\(map\\)/);
 assert.ok(html.includes("grassCover=(x,y)=>"),'sand/grass is a separate 4-corner tile junction');
 assert.ok(html.includes("cutChip(grassMask,art.mask,cover,px,py)"),
   'grass shapes reuse the existing 16-shape chip atlas');
 assert.ok(html.includes("grassDiagonalChips"),'diagonal transitions are generated');
 assert.ok(html.includes("ctx.drawImage(ground.staticMap,0,0)"),
   'render contiguous static mapchip cache without re-cut 32px draw seams');
 assert.match(html,/destination-in/);
 assert.match(html,/drawImage\(art\.water,frame\*64/);
 assert.match(html,/32pxアニメマップチップ/);
 assert.ok(html.includes('buildAnimatedTileAtlas(ground)'));
 assert.ok(html.includes('surfSample('));
 assert.ok(html.includes('drawImage(tileAtlas.sheet,'));
 assert.ok(html.includes('animated-32px-atlas-chips'));
 assert.ok(html.includes('ctx.putImageData(tile,'));
 assert.ok(!html.includes('drawImage(ground.staticMap,x*TILE,y*TILE,TILE,TILE'),'never cut a composed map into cells again');
 assert.equal(html.includes('ctx.drawImage(tideLayers['),false,'do not redraw full-frame tide canvases');
 assert.equal(html.includes('buildTideLayers('),false,'remove the old overlay implementation');
 assert.ok(html.includes('drawCharacter(ctx,'));
 assert.ok(html.includes("characterSheet:'village-80x112'"));
 assert.match(html,/data-dir="up"/);
 assert.match(html,/aria-label="四方向移動"/);
 assert.match(html,/waterFrames:2/);
 assert.doesNotMatch(html,/src\/game\/cove|data\/maps\/sea-cove|ushiohei|潮平/);
 const manifest=JSON.parse(readFileSync('assets/manifest.json','utf8'));
 for(const asset of [
   'assets/characters/hizuki/walk-4dir-80x112.png',
   'assets/field/effects/water-motion.png',
   'assets/field/terrain/atlas/coast-mask-32.png',
   'assets/field/terrain/atlas/coast-shallow-32.png',
   ...[0,1,2,3].map(n=>'assets/field/terrain/atlas/coast-sand-'+n+'-32.png')
 ])assert.ok(manifest.assets.some(a=>a.path===asset&&a.status==='approved'),asset);
});
