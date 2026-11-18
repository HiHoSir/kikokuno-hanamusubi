import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  NON_FIELD_CAMERA_ZOOM,DEFAULT_CAMERA_ZOOM,pixelViewport
} from '../src/game/village/render.mjs';

const source=path=>readFileSync(path,'utf8');

test('one scale controls all walkable non-field scenes, excluding the world field',()=>{
 assert.equal(NON_FIELD_CAMERA_ZOOM,0.5,
   'preserve the village/interior scale as the shared baseline');
 assert.equal(DEFAULT_CAMERA_ZOOM,NON_FIELD_CAMERA_ZOOM);
 const cssSizes=[[874,402,2],[402,874,3],[1280,720,1]];
 for(const [width,height,dpr] of cssSizes){
   const a=pixelViewport(width,height,dpr);
   const b=pixelViewport(width,height,dpr,NON_FIELD_CAMERA_ZOOM);
   assert.deepEqual(a,b);
   assert.ok(Math.abs(b.step/Math.min(dpr,3)-0.5)<1e-8);
   assert.ok(Math.abs(80*b.step/Math.min(dpr,3)-40)<1e-8,
     '80px sprite is 40 CSS pixels tall/wide across screen sizes');
 }
 const village=source('src/game/village/walk.mjs');
 const interiors=source('src/game/interiors/walk.mjs');
 const cove=source('src/game/cove/walk.mjs');
 const sanctuary=source('src/game/tenyo/walk.mjs');
 assert.match(village,/const zoom = DEFAULT_CAMERA_ZOOM/);
 assert.match(interiors,/pixelViewport\(parent\.clientWidth,parent\.clientHeight,devicePixelRatio,DEFAULT_CAMERA_ZOOM\)/);
 assert.match(cove,/pixelViewport\(parent\.clientWidth,parent\.clientHeight,devicePixelRatio,\s*NON_FIELD_CAMERA_ZOOM\)/);
 assert.match(cove,/cameraZoomAt:\(\)=>NON_FIELD_CAMERA_ZOOM/);
 assert.doesNotMatch(cove,/hamletCameraZoom|basePixelStep|viewport\.step\s*=\s*[^;]+\by\b/);
 assert.match(sanctuary,/pixelViewport\(clientWidth,clientHeight,\s*globalThis\.devicePixelRatio\?\?1,NON_FIELD_CAMERA_ZOOM\)/);
 assert.match(sanctuary,/const viewWidth=width\/cameraStep,viewHeight=height\/cameraStep/);
 assert.doesNotMatch(sanctuary,/VIEWPORT_EDGE|ZOOM\s*=\s*1\.4/);
 const map=JSON.parse(source('data/maps/tenyo-sanctuary/scene.json'));
 assert.equal(map.game.heroDisplayScale,1,'sanctuary must not shrink native hero relative to other NPCs');
 const gameScenes=['village','interiors','cove','tenyo'];
 assert.equal(gameScenes.length,4);
});

test('field remains an independent system and approved shore terrain is still the source',()=>{
 const cove=source('data/maps/sea-cove/scene.mjs');
 const renderer=source('src/game/cove/render.mjs');
 const field=source('src/field/walk.mjs');
 assert.match(cove,/import \{SHORE_Y,SCENERY\} from '\.\.\/shoreline-study\/scene\.mjs'/);
 assert.match(renderer,/surfSample\(wy-shoreY\[wx\],'sand',phase,wx\)/);
 assert.match(field,/from==='cove' \? coveReturnPosition\(\)/);
});
