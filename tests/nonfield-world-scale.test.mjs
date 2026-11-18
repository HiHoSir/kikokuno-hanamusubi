import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WORLD_SCENE_ZOOM,WORLD_HERO_FRAME,WORLD_HERO_FOOT} from '../src/game/ui/world-scale.mjs';
import {DEFAULT_CAMERA_ZOOM,pixelViewport} from '../src/game/village/render.mjs';

const source=p=>readFileSync(p,'utf8');
test('all walking scenes except the field share ONE CSS/world pixel scale',()=>{
 assert.equal(WORLD_SCENE_ZOOM,0.5);
 assert.equal(DEFAULT_CAMERA_ZOOM,WORLD_SCENE_ZOOM);
 assert.deepEqual(WORLD_HERO_FRAME,[80,112]);
 assert.deepEqual(WORLD_HERO_FOOT,[40,106]);
 for(const dpr of [1,2,3]){
   const viewport=pixelViewport(874,402,dpr);
   assert.equal(viewport.step/dpr,WORLD_SCENE_ZOOM);
   assert.equal(viewport.width,874*dpr);
   assert.equal(viewport.height,402*dpr);
 }
 const village=source('src/game/village/walk.mjs');
 const rooms=source('src/game/interiors/walk.mjs');
 const cove=source('src/game/cove/walk.mjs');
 const tenyo=source('src/game/tenyo/walk.mjs');
 assert.match(village,/DEFAULT_CAMERA_ZOOM/);
 assert.match(rooms,/pixelViewport\(parent.clientWidth,parent.clientHeight,devicePixelRatio,DEFAULT_CAMERA_ZOOM\)/);
 assert.match(cove,/pixelViewport\(parent.clientWidth,parent.clientHeight,devicePixelRatio,DEFAULT_CAMERA_ZOOM\)/);
 assert.match(tenyo,/import \{WORLD_SCENE_ZOOM\} from '\.\.\/ui\/world-scale\.mjs'/);
 assert.match(tenyo,/viewWidth=scene.parentElement.clientWidth\/WORLD_SCENE_ZOOM/);
 assert.match(tenyo,/viewHeight=scene.parentElement.clientHeight\/WORLD_SCENE_ZOOM/);
 assert.doesNotMatch(cove,/hamletCameraZoom|basePixelStep|1\.18|0\.65/);
 assert.doesNotMatch(tenyo,/ZOOM=1\.4|heroDisplayScale:0\.52/);
 const scene=JSON.parse(source('data/maps/tenyo-sanctuary/scene.json'));
 assert.equal(scene.game.heroDisplayScale,1,
   'no hero-only scaling in the sanctuary; NPCs already render at native size');
});
test('non-field camera cannot change with location or rescale only one prop',()=>{
 const cove=source('src/game/cove/walk.mjs');
 const renderer=source('src/game/cove/render.mjs');
 assert.match(cove,/viewport\.step=dims\.step/);
 assert.doesNotMatch(cove,/viewport\.step=basePixelStep|cameraZoomAt|hamletCameraZoom/);
 assert.match(renderer,/Math\.floor\(cameraX\)\*step/);
 assert.match(renderer,/Math\.floor\(cameraY\)\*step/);
 assert.match(renderer,/image\.naturalWidth\/2/);
 assert.match(renderer,/image\.naturalHeight/);
 const house={width:390,height:357};
 const hero={width:80,height:112};
 assert.equal(house.height*WORLD_SCENE_ZOOM/(hero.height*WORLD_SCENE_ZOOM),
   house.height/hero.height,
   'whole-scene zoom preserves the height ratio of roof and hero');
});
