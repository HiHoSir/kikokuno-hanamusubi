import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Real game UMD modules depend on browser globals and are evaluated here
// in the same dependency order. No ESM/CJS module-loader assumptions.
const context=vm.createContext({});
for(const name of ['catalog','autotile','model','render']){
 const file='src/game/tenyo/rendering/'+name+'.js';
 vm.runInContext(readFileSync(file,'utf8'),context,{filename:file});
}
const R=context.SMRender;
const M=context.SMModel;
const m=M.parse(readFileSync('data/maps/tenyo-sanctuary/scene.json','utf8'));
const bounds=Object.fromEntries(['d','u','r','l'].map(k=>[k,{village:true}]));
const depthAt=(id,heroY)=>{
 const q=R.depthQueue(m,{x:13,y:heroY,dir:'d',frame:0},bounds);
 return {
  prop:q.findIndex(v=>v.object?.templateId===id),
  hero:q.findIndex(v=>v.actor)
 };
};

test('original gate draws over actors standing behind its posts, but behind actors in front',()=>{
 const behind=depthAt('tenyo_water_gate',7);
 const front=depthAt('tenyo_water_gate',8);
 assert.ok(behind.hero<behind.prop,'gate should occlude person behind');
 assert.ok(front.prop<front.hero,'actor should occlude gate when closer to camera');
});

test('waterfall wall uses real fixed foot anchor; no camera-specific priority jumps',()=>{
 const behind=depthAt('sanctuary_fall_v2',4);
 const front=depthAt('sanctuary_fall_v2',5);
 assert.ok(behind.hero<behind.prop);
 assert.ok(front.prop<front.hero);
 const waterfall=m.objects.find(v=>v.templateId==='sanctuary_fall_v2');
 assert.equal((waterfall.y+1)*m.tileSize,160);
});

test('lanterns are supported by islands, not painted into a global foreground layer',()=>{
 const q=R.depthQueue(m,null,null);
 const island=m.objects.find(v=>v.templateId==='rock_island_lantern_base');
 const lantern=m.objects.find(v=>v.templateId==='tenyo_stone_lantern'&&v.x===island.x+1&&v.y===island.y);
 assert.ok(lantern);
 const islandIndex=q.findIndex(v=>v.object?.id===island.id);
 const lanternIndex=q.findIndex(v=>v.object?.id===lantern.id);
 assert.ok(islandIndex<lanternIndex,'support precedes its lantern at the same foot depth');
 assert.equal(q[islandIndex].depth,q[lanternIndex].depth);
});

test('preview changes only local compositing, never blocks walkable shallows or sequel lock',()=>{
 const walk=readFileSync('src/game/tenyo/walk.mjs','utf8');
 const render=readFileSync('src/game/tenyo/rendering/render.js','utf8');
 assert.match(walk,/const reviewSceneDepth=reviewRebuild &&/);
 assert.match(walk,/previewSceneDepth:reviewSceneDepth/);
 assert.match(render,/const tenyoBackdropIds=new Set/);
 assert.match(render,/for\(const v of objects\.filter\(v=>v\.templateId\.startsWith\('sanctuary_forest_frame_'\)\)\)object\(v\)/);
 assert.match(render,/return entries\.sort\(\(a,b\)=>a\.depth-b\.depth\)/);
 assert.doesNotMatch(render,/paintContactLip|previewFrontLip|reviewLipHeights/);
 const scene=m.game;
 assert.deepEqual(scene.passageLocks.map(x=>x.id),['guardian-sequel-passage']);
 assert.ok(m.waterSurface.some(x=>x.depth==='shallow'));
});
