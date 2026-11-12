import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('opening enters a real village game, not the review preview',()=>{
 const opening=readFileSync('src/opening/opening.js','utf8');
 assert.match(opening,/\.\.\/game\/village\//);
 assert.doesNotMatch(opening,/previews\//);
 for(const path of ['src/game/village/index.html','src/game/interiors/index.html']){
  const page=readFileSync(path,'utf8');
  assert.doesNotMatch(page,/検査|判定を表示|id="debug"|id="room"|id="reset"/);
 }
});
test('game navigation and story entry are connected',()=>{
 const village=readFileSync('src/game/village/walk.mjs','utf8');
 const interior=readFileSync('src/game/interiors/walk.mjs','utf8');
 const field=readFileSync('src/field/walk.mjs','utf8');
 assert.match(village,/\.\.\/interiors\/\?building=/);
 assert.match(village,/\.\.\/\.\.\/field\/\?from=village/);
 assert.match(interior,/new URL\('\.\.\/village\//);
 assert.match(field,/\.\.\/game\/village\/\?focus=field-exit/);
 assert.match(village,/completeStoryDialogue/);
});
test('all authored village art and NPC files exist',()=>{
 const scene=JSON.parse(readFileSync('data/maps/hozuki-village/scene.json','utf8'));
 const residents=JSON.parse(readFileSync('data/maps/hozuki-village/residents.json','utf8'));
 const images=new Set(['collision.png','ground-decor.png',scene.terrain.atlas,...scene.sprites.flatMap(s=>[s.file,s.eave,s.sway]).filter(Boolean)]);
 for(const image of images)assert.ok(existsSync('assets/village/scene/'+image),image);
 for(const npc of residents)assert.ok(existsSync(npc.asset),npc.name);
 assert.ok(existsSync('assets/village/interiors/furniture.png'));
 assert.ok(residents.find(n=>n.id==='chief').lines.some(s=>s.includes('結び札')));
});

test('production modules pass Node syntax checks',()=>{
 for(const path of [
  'src/game/village/walk.mjs','src/game/village/dialogue.mjs',
  'src/game/village/movement.mjs','src/game/village/residents.mjs',
  'src/game/village/render.mjs','src/game/interiors/walk.mjs',
  'src/game/interiors/rooms.mjs','src/game/interiors/room-art.mjs',
  'src/opening/opening.js','src/field/walk.mjs'
 ])execFileSync(process.execPath,['--check',path]);
});
