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
test('every entrance has adult clearance above the unchanged Hizuki sprite',()=>{
 for(const house of data.sprites.filter(s=>s.eave)) {
  assert.ok(house.doorVisibleHeight*house.scale>=55,
    `${house.name}: entrance needs at least 55 world pixels for the approximately 50px adult`);
 }
});
test('road corners retain subcell silhouettes instead of 16px stair steps',()=>{
 assert.equal(data.terrain.roadShape,'pixel-contour');
});
const {pixelViewport} = await import(local('render.mjs'));
test('approved 1.0 camera zoom stays 1.0 on every device, including iPhone DPR 3',()=>{
 for(const dpr of [1,1.05,2,2.75,3])for(const [w,h] of [[393,620],[852,290],[858,790]]){
  const p=pixelViewport(w,h,dpr);
  const ratio=Math.min(dpr||1,3);
  const displayedBellHeight=229*p.step/ratio;
  assert.ok(Math.abs(displayedBellHeight-229*1.0)<1e-9,
    `DPR ${dpr}: belltower displayed at ${displayedBellHeight}px instead of ${229*1.0}px`);
  assert.ok(Math.abs(p.step/ratio-1.0)<1e-12);
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
