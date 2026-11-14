import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fieldViewportDimensions} from '../src/field/viewport.mjs';

test('landscape field camera expands world width without cropping portrait raster',()=>{
  assert.deepEqual(fieldViewportDimensions(900,390),{width:1255,height:544});
  assert.deepEqual(fieldViewportDimensions(1536,706),{width:1184,height:544});
  assert.deepEqual(fieldViewportDimensions(844,390),{width:1177,height:544});
  assert.deepEqual(fieldViewportDimensions(0,0),{width:640,height:544});
});
test('field uses panoramic camera, native map perspective, full-screen overlays',()=>{
  const source=readFileSync('src/field/runtime.mjs','utf8');
  const field=readFileSync('src/field/index.html','utf8');
  const elevation=readFileSync('src/field/elevation-view.js','utf8');
  const landscape=readFileSync('src/field/landscape.js','utf8');
  assert.ok(source.includes('viewportWidth:dims.width'));
  assert.ok(!source.includes('fieldViewportCrop'));
  assert.ok(!source.includes('bufferContext'));
  assert.ok(elevation.includes('viewportWidth||640'));
  assert.ok(landscape.includes('camera.centerX??320'));
  assert.ok(field.includes('background:transparent;border:0;pointer-events:none'));
  assert.ok(!field.includes('grid-template-rows:minmax(0,1fr) 108px'));
  assert.ok(!field.includes('object-fit:cover'));
});

test('field profiling is opt-in and does not alter the rendered world or state',()=>{
 const runtime=readFileSync('src/field/runtime.mjs','utf8');
 const browser=readFileSync('tools/qa-field-browser.mjs','utf8');
 assert.match(runtime,/new URLSearchParams\(location\.search\)\.get\('profile'\)==='1'/);
 assert.match(runtime,/if\(profile\)window\.__FIELD_RENDER_PROFILE=stats/);
 assert.match(runtime,/if\(profile\)\{\s*const elapsed=performance\.now\(\)-started/);
 assert.match(browser,/p95Ms/);
 assert.match(browser,/ArrowRight/);
});

test('coastline shapes and beach strips cache in world coordinates only',()=>{
 const source=readFileSync('src/field/elevation-view.js','utf8');
 assert.match(source,/const shoreCache=new WeakMap\(\)/);
 assert.match(source,/function shoreGeometry\(m,tx,ty,shape\)/);
 assert.match(source,/window\.YK_FIELD_SHORE_CACHE!==false/);
 assert.match(source,/shore\.sand/);
 assert.match(source,/shore\.darkEdges/);
});
