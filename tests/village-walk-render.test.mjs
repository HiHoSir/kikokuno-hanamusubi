import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root = new URL('../previews/village-walk/', import.meta.url);
const local = path => new URL(path,root);
const data = JSON.parse(readFileSync(local('map/scene.json')));
test('same sakura species uses one native image, without per-instance resizes',()=>{
 const files=new Set(data.sprites.filter(s=>/^sprite-(0[8-9]|[12][0-9]|3[0-2])\.png$/.test(s.file)).map(s=>s.file));
 assert.equal(files.size,1,`${files.size} independently resized versions of one tree`);
});
test('scenery is drawn at native PNG size without per-object scale',()=>{
 assert.equal(data.hero.scale,undefined,'Hizuki must also use its native frame dimensions');
 for(const sprite of data.sprites) {
  assert.equal(sprite.scale,undefined,`${sprite.id??sprite.file} still rescales its PNG`);
  if(sprite.eave) {
   const png=readFileSync(local('map/'+sprite.file));
   assert.deepEqual(sprite.size,[png.readUInt32BE(16),png.readUInt32BE(20)]);
  }
 }
 const runtime=readFileSync(local('walk.mjs'),'utf8');
 assert.ok(!runtime.includes('ctx.scale(sprite.scale'),'runtime must not construct resized scenery canvases');
 assert.ok(!runtime.includes('frameWidth*scale'),'Hizuki frames must not be resampled');
});
test('house physalis placements follow local anchors beside their own building',()=>{
 const plants=data.sprites.filter(s=>s.anchor?.kind==='building');
 assert.equal(plants.length,18,'two explicit side placements for each of nine houses');
 for(const plant of plants) {
  const house=data.sprites.find(s=>s.id===plant.anchor.id);
  assert.ok(house);
  assert.deepEqual(plant.point,plant.anchor.offset.map((n,i)=>house.point[i]+n));
  const png=readFileSync(local('map/'+plant.file));
  const pw=png.readUInt32BE(16),ph=png.readUInt32BE(20);
  assert.ok(plant.point[0]>=0 && plant.point[1]>=0 && plant.point[0]+pw<=data.bounds[2] && plant.point[1]+ph<=data.bounds[3],
   'anchored plants must fit inside the map');
  assert.ok(plant.point[0]+pw<=house.point[0]+24 || plant.point[0]>=house.point[0]+house.size[0]-24,
   'plant stays beside the wall, not across its doorway');
  assert.ok(Math.abs(plant.point[1]+ph-house.feet[1])<=24,'plant roots meet the building base');
 }
});
test('native tree canopies leave the house entrances and their approach clear',()=>{
 const zones=data.sprites.filter(s=>s.eave).map(s=>[s.feet[0]-72,s.feet[1]-130,s.feet[0]+72,s.feet[1]+80]);
 for(const tree of data.sprites.filter(s=>s.footprint)) {
  const png=readFileSync(local('map/'+tree.file));
  const [x,y]=tree.point,w=png.readUInt32BE(16),h=png.readUInt32BE(20);
  assert.ok(!zones.some(([l,t,r,b])=>x<r && x+w>l && y<b && y+h>t),
   `${tree.id}: canopy hides a door approach`);
 }
});
test('road corners retain subcell silhouettes instead of 16px stair steps',()=>{
 assert.equal(data.terrain.roadShape,'pixel-contour');
});
const {pixelViewport} = await import(local('render.mjs'));
test('wider 0.75 camera stays consistent across devices and permits other zoom values',()=>{
 for(const dpr of [1,1.05,2,2.75,3])for(const [w,h] of [[393,620],[852,290],[858,790]]){
  const p=pixelViewport(w,h,dpr);
  const ratio=Math.min(dpr||1,3);
  assert.ok(Math.abs(p.step/ratio-0.75)<1e-12,'default camera must show a wider area');
  for(const zoom of [0.5,0.75,1.0]){
   assert.ok(Math.abs(pixelViewport(w,h,dpr,zoom).step/ratio-zoom)<1e-12,
    `DPR ${dpr}: camera must preserve requested ${zoom} zoom`);
  }
 }
});
test('the generated belltower includes its foundation and connected stairs as one sprite',()=>{
 const bell=data.sprites.find(s=>s.id==='belltower');
 assert.ok(bell,'new belltower is actually referenced by the live scene');
 const png=readFileSync(local('map/'+bell.file));
 assert.equal(png.readUInt32BE(16),300,'width follows the reference relative to the houses');
 assert.ok(!data.terrain.layers.some(l=>['bell-platform','bell-stairs'].includes(l.name)),
   'detached legacy stone platform and stairs must not remain underneath the new sprite');
 assert.deepEqual([bell.point[0]+png.readUInt32BE(16)/2,bell.point[1]+png.readUInt32BE(20)],bell.feet,'the stairs keep their ground connection');
});

test('roads use only horizontal and vertical straight segments',()=>{
 for(const {points} of data.roads)for(let i=1;i<points.length;i++) {
  assert.ok(points[i][0]===points[i-1][0] || points[i][1]===points[i-1][1],JSON.stringify(points));
 }
});

test('the belltower rear contact keeps Hizuki above its roof edge',()=>{
 const bell=data.sprites.find(s=>s.id==='belltower');
 const center=bell.feet[0];
 const rear=bell.blockers.filter(([x,,w])=>x<=center && center<x+w);
 assert.ok(Math.min(...rear.map(b=>b[1]))-bell.point[1]<=48,
  'the rear blocker must stop feet before the entire 50px hero enters the opaque roof');
 const roof=rear.find(b=>b[1]<=bell.point[1]+48);
 assert.ok(roof[0]<=bell.point[0] && roof[0]+roof[2]>=bell.point[0]+300,
  'side contact must also stop outside the roof overhang');
});
