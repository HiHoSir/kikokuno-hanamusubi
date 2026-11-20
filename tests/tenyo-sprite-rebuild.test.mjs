import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=p=>readFileSync(p,'utf8');
const root='assets/tenyo-rebuild-v1/original-atlas.png';
const atlas=readFileSync(root);

test('new shrine sprite atlas is an original standalone indexed PNG, without scaling game sprites',()=>{
 assert.equal(atlas.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(atlas.readUInt32BE(16),320);
 assert.equal(atlas.readUInt32BE(20),224);
 assert.equal(atlas[25],3,'palette-indexed PNG, not scaled RGBA canvas');
 assert.equal(createHash('sha256').update(atlas).digest('hex'),
  'e6f19cba8a7ba8a74b3416da0dd3d7e1a5d0a3169bdddd2110e9ef53ea21d679');
});

test('rebuilding is restricted to the walkable preview; published game still loads original art',()=>{
 const game=read('src/game/tenyo/index.html');
 const review=read('previews/tenyo-scale-review/index.html');
 const walk=read('src/game/tenyo/walk.mjs');
 assert.ok(!game.includes('tenyo-rebuild-v1'));
 assert.match(review,/data-tenyo-art="rebuild"/);
 assert.match(review,/data-tenyo-art="legacy"/);
 assert.match(walk,/const reviewRebuild=previewMode &&/);
 assert.match(walk,/if\(reviewRebuild&&Object\.hasOwn\(REBUILD_RECTS,id\)\)/);
 assert.match(walk,/previewFrontLip:reviewRebuild/);
 assert.match(walk,/tenyo-rebuild-v1\/original-atlas\.png/);
 for(const token of ['sanctuary_fall_v2:[0,0,128,160]',
  'tenyo_water_gate:[128,0,192,128]','torii_gate_v2:[128,128,128,96]',
  'rock_island_lantern_base:[0,160,96,64]',
  'tenyo_stone_lantern:[96,160,32,64]'])
   assert.ok(walk.includes(token),token);
});

test('the waterfall and gate never reorder their complete image over the hero',()=>{
 const render=read('src/game/tenyo/rendering/render.js');
 assert.match(render,/const lipObjects=o\.previewFrontLip/);
 assert.match(render,/const lipSet=new Set\(lipObjects\)/);
 assert.match(render,/c\.drawImage\(im,sx,sy\+sh-band,sw,band/);
 assert.match(render,/if\(lipSet\.has\(item\.object\)\)continue/);
 assert.doesNotMatch(render,/foregroundOcclusion/);
 const map=JSON.parse(read('data/maps/tenyo-sanctuary/scene.json'));
 assert.deepEqual(map.game.passageLocks.map(x=>x.id),['guardian-sequel-passage']);
 assert.deepEqual(map.game.residents.find(x=>x.id==='shirotae').tile,[12,8]);
 assert.equal((map.game.footCollisionZones??[]).some(x=>x.id==='rear-scenic-water'),false);
});
