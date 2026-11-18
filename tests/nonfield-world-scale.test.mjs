import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WORLD_SCENE_ZOOM,WORLD_ACTOR_FRAME,WORLD_ACTOR_FOOT,WORLD_ACTOR_ATLAS,WORLD_HERO_FRAME,WORLD_HERO_FOOT} from '../src/game/ui/world-scale.mjs';
import {drawCharacter} from '../src/game/village/residents.mjs';
import {rooms} from '../src/game/interiors/rooms.mjs';
import {COVE_MAP} from '../data/maps/sea-cove/scene.mjs';
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
 assert.match(tenyo,/VIEWPORT_EDGE\*WORLD_SCENE_ZOOM/);
 assert.match(tenyo,/viewWidth=width\*worldPixelsPerPixel/);
 assert.match(tenyo,/viewHeight=height\*worldPixelsPerPixel/);
 assert.doesNotMatch(cove,/hamletCameraZoom|basePixelStep|1\.18|0\.65/);
 assert.doesNotMatch(tenyo,/ZOOM=1\.4|heroDisplayScale:0\.52/);
 const scene=JSON.parse(source('data/maps/tenyo-sanctuary/scene.json'));
 assert.equal(Object.hasOwn(scene.game,'heroDisplayScale'),false,
   'sanctuary hero-only scale setting is forbidden');
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

test('all connected playable NPC assets use the native hero sheet frame and shared feet',()=>{
 assert.deepEqual(WORLD_ACTOR_FRAME,[80,112]);
 assert.deepEqual(WORLD_ACTOR_FOOT,[40,106]);
 assert.deepEqual(WORLD_ACTOR_ATLAS,[240,448]);
 assert.equal(WORLD_HERO_FRAME,WORLD_ACTOR_FRAME);
 assert.equal(WORLD_HERO_FOOT,WORLD_ACTOR_FOOT);
 const village=JSON.parse(source('data/maps/hozuki-village/residents.json'));
 const tenyo=JSON.parse(source('data/maps/tenyo-sanctuary/scene.json'));
 const assets=new Set([
  tenyo.game.hero,
  ...village.map(n=>n.asset),
  ...Object.values(rooms).map(room=>
    'assets/characters/npc/'+room.resident.asset+'-walk-4dir-80x112.png'),
  ...tenyo.game.residents.map(n=>n.asset),
  'assets/characters/npc/ushiohei-walk-4dir-80x112.png'
 ]);
 for(const path of assets){
  const raw=readFileSync(path);
  assert.equal(raw.subarray(0,8).toString('hex'),'89504e470d0a1a0a',path+' must be PNG');
  assert.deepEqual([raw.readUInt32BE(16),raw.readUInt32BE(20)],
    WORLD_ACTOR_ATLAS,path+' must provide 4 directions × 3 frames at 80x112');
 }
 for(const resident of [...village,...tenyo.game.residents]){
   assert.equal(resident.displayScale,undefined,
     resident.id+' must not have a per-NPC scale override');
 }
 const painter=source('src/game/village/residents.mjs');
 assert.match(painter,/\[width,height\]=WORLD_ACTOR_FRAME/);
 assert.match(painter,/\[footX,footY\]=WORLD_ACTOR_FOOT/);
 const image={width:240,height:448};
 for(const role of ['hizuki','village-npc','interior-npc','ushiohei']){
   const calls=[],ctx={drawImage(...args){calls.push(args);}};
   for(const face of [0,1,2,3]){
     drawCharacter(ctx,{bitmap:image,x:180,y:260,face,distance:0,moving:false});
     const args=calls.at(-1);
     assert.deepEqual(args.slice(1),[0,face*112,80,112,140,154,80,112],
       role+' cannot change size or foot based on location/direction');
   }
   drawCharacter(ctx,{bitmap:image,x:180,y:260,face:0,distance:28,moving:true});
   assert.deepEqual(calls.at(-1).slice(1,5),[160,0,80,112],
     role+' must preserve native 80px walking frames');
 }
 assert.doesNotMatch(source('src/game/tenyo/walk.mjs'),/heroDisplayScale/,
   'Tenyo must not pass protagonist-only scale');
 assert.doesNotMatch(source('src/game/tenyo/rendering/render.js'),/o\.heroDisplayScale/,
   'Tenyo must render all actors with one world factor');
});

test('buildings, furniture, and fishing props use the same world pixels as characters',()=>{
 const village=JSON.parse(source('data/maps/hozuki-village/scene.json'));
 const villageHouse=village.sprites.find(s=>s.file==='house-thatch.png');
 const coveHouse=COVE_MAP.objects.find(s=>s.kind==='fisherHouse');
 assert.deepEqual(villageHouse.size,[390,357]);
 assert.ok(coveHouse && coveHouse.footPosition,
   'fishing home must have a native world foot position');
 const house=readFileSync('assets/village/scene/house-thatch.png');
 assert.deepEqual([house.readUInt32BE(16),house.readUInt32BE(20)],villageHouse.size,
   'cove and village must use SAME original-size house asset');
 // The model establishes scale through native world pixels, not a per-object
 // multiplier or a different scale when the hero walks indoors.
 const villageRenderer=source('src/game/village/walk.mjs');
 const interior=source('src/game/interiors/walk.mjs');
 const cove=source('src/game/cove/render.mjs');
 assert.match(villageRenderer,/drawImage\(art\.get\(sprite\.file\),sx,sy\)/);
 assert.match(interior,/context\.drawImage\(furniture,\.\.\.object\.sprite,object\.x,object\.y,w,h\)/);
 assert.match(cove,/actor\.image\.naturalWidth\/2/);
 assert.match(cove,/actor\.image\.naturalHeight/);
 assert.doesNotMatch(cove,/drawImage\(actor\.image,[^;]*\*\s*[12]\./s,
   'do not introduce house/net-only drawn image scaling');
 assert.equal(390*WORLD_SCENE_ZOOM/(80*WORLD_SCENE_ZOOM),390/80,
   'native house-to-character width ratio must be invariant');
 assert.equal(357*WORLD_SCENE_ZOOM/(112*WORLD_SCENE_ZOOM),357/112,
   'native house-to-character height ratio must be invariant');
 // Large buildings in the approved village establish the reference scale
 // for future maps. The type may vary, but it cannot arbitrarily be magnified.
 const doors=village.sprites.filter(v=>v.doorVisibleHeight!==undefined);
 assert.ok(doors.length>=6);
 for(const v of doors){
   assert.ok(v.doorVisibleHeight>=86 && v.doorVisibleHeight<=120,
     v.id+' doorway was authored at a different human scale');
 }
});
