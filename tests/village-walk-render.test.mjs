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
test('building display uses one half-size transform of the originals',()=>{
 for(const s of data.sprites.filter(s=>s.eave)) assert.equal(s.scale,0.5);
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
 assert.deepEqual(bell.feet,[800,480],'the stairs keep their ground connection');
});
