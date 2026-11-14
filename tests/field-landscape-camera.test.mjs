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
