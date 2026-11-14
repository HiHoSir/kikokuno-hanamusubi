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
  assert.ok(source.includes('frameTime,dims.width'));
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
 assert.match(runtime,/if\(profile\)\{\s*window\.__FIELD_RENDER_PROFILE=stats/);
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

test('production water/river/waterfall motion uses the same RAF phase as field scheduling',()=>{
 const landscape=readFileSync('src/field/landscape.js','utf8');
 const runtime=readFileSync('src/field/runtime.mjs','utf8');
 const walk=readFileSync('src/field/walk.mjs','utf8');
 const tenyo=readFileSync('src/game/tenyo/rendering/render.js','utf8');
 assert.match(landscape,/Number\.isFinite\(settings\.motionTime\)\?settings\.motionTime/);
 assert.match(landscape,/movingWater=motionArt\('water',motionTime\)/);
 assert.match(landscape,/sea:movingWater,river:movingWater,waterfall:movingFall/);
 assert.match(runtime,/renderer\.draw\(context,\{x,foot:y\},frameTime/);
 assert.match(walk,/Math\.floor\(now \/ 360\)/);
 assert.match(tenyo,/waterKinds=\['shallow','mid','deep'\]/);
 assert.match(tenyo,/Math\.floor\(\(o\.animationTime\|\|0\)\/360\)%4/);
});

test('animated water atlas uses HALF the atlas width per frame; second frame is not out of range',()=>{
 const code=readFileSync('src/field/landscape.js','utf8');
 assert.match(code,/const \[atlasWidth,h\]=specs\[kind\+'Motion'\]/);
 assert.match(code,/frameWidth=atlasWidth\/frames/);
 assert.match(code,/ctx\.drawImage\(atlas,i\*frameWidth,0,frameWidth,h,0,0,frameWidth,h\)/);
 assert.doesNotMatch(code,/ctx\.drawImage\(atlas,i\*w,0,w,h,0,0,w,h\)/);
});

test('the normal field loads approved coast and cliff chips with animated water',()=>{
 const renderer=readFileSync('src/field/terrain-renderer.mjs','utf8');
 const runtime=readFileSync('src/field/runtime.mjs','utf8');
 const chips=readFileSync('src/field/terrain-chips.mjs','utf8');
 assert.match(runtime,/createFieldTerrainRenderer\(world\.mapData/);
 assert.doesNotMatch(runtime,/get\('renderer'\)|drawQuarter/);
 assert.match(chips,/destination-in/);
 assert.match(renderer,/motionArt\('water',time\)/);
 assert.match(renderer,/landscape\.unproject/);
 assert.match(renderer,/staticLand:true,animatedWater:true/);
});
test('terrain rework QA judges camera, height and shoreline fidelity rather than pixel identity',()=>{
 const qa=readFileSync('tools/qa-field-tile-layers.mjs','utf8');
 assert.match(qa,/The pixel-difference number is diagnostic ONLY/);
 assert.match(qa,/village-coast/);
 assert.match(qa,/raised-shrine/);
 assert.match(qa,/mountain-cliffs/);
 assert.doesNotMatch(qa,/differentPercent\s*[><=]/);
 assert.match(qa,/animatedPixels<100/);
 assert.match(qa,/fixedLand/);
});

test('the production atlases are registered and match their 32px tile layout',()=>{
 const manifest=JSON.parse(readFileSync('assets/manifest.json','utf8'));
 const assets=manifest.assets.filter(asset=>asset.usage==='field-terrain-atlas');
 assert.equal(assets.length,14);
 for(const asset of assets){
  assert.equal(asset.status,'approved');
  const png=readFileSync(asset.path);
  assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20),png[25]],[128,128,6]);
 }
 assert.ok(assets.some(asset=>asset.id==='field-coast-mask-32'));
 assert.equal(assets.filter(asset=>asset.id.startsWith('field-cliff-forest-')).length,3);
});
