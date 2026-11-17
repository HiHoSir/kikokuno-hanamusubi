import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TILE,WIDTH,HEIGHT,MAP,SHORE_Y,SAND_DEPTH,START,terrainAt,walkable,safeFoot,shoreCover,validateShore}
 from '../data/maps/shoreline-study/scene.mjs';

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
 assert.match(html,/YK_LANDSCAPE\.groundLayer\(paint\)/);
 assert.match(html,/destination-in/);
 assert.match(html,/drawImage\(art\.water,frame\*64/);
 assert.match(html,/32px地形チップ/);
 assert.match(html,/data-dir="up"/);
 assert.match(html,/aria-label="四方向移動"/);
 assert.match(html,/waterFrames:2/);
 assert.doesNotMatch(html,/src\/game\/cove|data\/maps\/sea-cove|ushiohei|潮平/);
 const manifest=JSON.parse(readFileSync('assets/manifest.json','utf8'));
 for(const asset of [
   'assets/characters/hizuki/walk-sd-32.png',
   'assets/field/effects/water-motion.png',
   'assets/field/terrain/atlas/coast-mask-32.png',
   'assets/field/terrain/atlas/coast-shallow-32.png',
   ...[0,1,2,3].map(n=>'assets/field/terrain/atlas/coast-sand-'+n+'-32.png')
 ])assert.ok(manifest.assets.some(a=>a.path===asset&&a.status==='approved'),asset);
});
