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
test('iPhone and desktop output have integral physical pixels and whole-pixel camera steps',()=>{
 for(const dpr of [1,1.25,2,2.75,3])for(const [w,h] of [[393,620],[852,290],[858,790]]){
  const p=pixelViewport(w,h,dpr);
  assert.ok(Number.isInteger(p.step));
  assert.equal(p.width%p.step,0);
  assert.equal(p.height%p.step,0);
 }
});
