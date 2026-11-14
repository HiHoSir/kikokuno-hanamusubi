import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('opening enters a real village game, not the review preview',()=>{
 const opening=readFileSync('src/opening/opening.js','utf8');
 assert.match(opening,/\.\.\/game\//);
 assert.match(readFileSync('src/game/navigation/game-shell.mjs','utf8'),/src\/game\/village\//);
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
  'src/opening/opening.js','src/field/walk.mjs',
  'src/game/audio/audio.mjs','src/game/audio/boot.mjs','src/game/navigation/game-shell.mjs'
 ])execFileSync(process.execPath,['--check',path]);
});

test('production screens use old-game four-way controls with A/B',()=>{
 for(const path of ['src/game/village/index.html','src/game/interiors/index.html','src/field/index.html']){
  const html=readFileSync(path,'utf8');
  assert.match(html,/id="pad"/);
  for(const id of ['up','down','left','right','action-a','action-b'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/controls\.css/);
  assert.doesNotMatch(html,/data-dir="up"[\\s\\S]*data-dir="up"/);
 }
 const css=readFileSync('src/game/ui/controls.css','utf8');
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/\.dpad::before/);
 assert.match(css,/52px/);
 assert.match(css,/#action-a/);
});
test('dialogue reuses the animated arrow and action-button controls',()=>{
 const style=readFileSync('src/game/village/dialogue.css','utf8');
 const code=readFileSync('src/game/village/dialogue.mjs','utf8');
 assert.match(style,/hasNextLine/);
 assert.match(code,/setTimeout\(tick,36\)/);
 assert.match(code,/function advance\(\)/);
 for(const path of ['src/game/village/walk.mjs','src/game/interiors/walk.mjs']){
  const content=readFileSync(path,'utf8');
  assert.match(content,/#action-a/);
  assert.match(content,/#action-b/);
  assert.match(content,/dialogue\.advance\(\)/);
 }
});

test('immersive gameplay fills the viewport and prevents game text selection',()=>{
 const css=readFileSync('src/game/ui/controls.css','utf8');
 assert.match(css,/position:fixed;inset:0/);
 assert.match(css,/height:100dvh/);
 assert.doesNotMatch(css,/main \\.viewport\\{touch-action:none\\}/);
 assert.match(css,/-webkit-user-select:none!important/);
 assert.match(css,/-webkit-touch-callout:none!important/);
 const guard=readFileSync('src/game/ui/selection-guard.mjs','utf8');
 for(const type of ['selectstart','contextmenu','dragstart'])assert.ok(guard.includes(type));
 assert.doesNotMatch(guard,/preventDefault\(\).*(pointer|touch)/);
 for(const p of ['src/game/village/index.html','src/game/interiors/index.html','src/field/index.html']){
  const html=readFileSync(p,'utf8');
  assert.match(html,/selection-guard\.mjs/);
  assert.match(html,/app\.webmanifest/);
  assert.match(html,/apple-mobile-web-app-capable/);
 }
 const field=readFileSync('src/field/index.html','utf8');
 assert.match(field,/object-fit:cover/);
 assert.match(field,/--scene-size:max\(100cqw,100cqh\)/);
 const webmanifest=JSON.parse(readFileSync('src/game/app.webmanifest','utf8'));
 assert.equal(webmanifest.display,'standalone');
 assert.equal(webmanifest.start_url,'../../');
 assert.equal(webmanifest.scope,'../../');
});

test('village entry evaluates the quest objective before loading map assets',()=>{
 // Syntax checks alone cannot detect an unbound story helper used at module
 // top level. Exercise actual ESM linking/evaluation with a minimal DOM.
 const script = `
   const objective={textContent:''};
   const nodes={
     '#scene':{getContext(){return {};}},
     '#status':{textContent:''},
     '#load':{hidden:false,textContent:''},
     '#objective':objective,
   };
   globalThis.document={
     querySelector: selector=>nodes[selector]??null,
     querySelectorAll: ()=>[],
   };
   globalThis.matchMedia=()=>({matches:false});
   globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
   globalThis.fetch=()=>new Promise(()=>{});
   await import('./src/game/village/walk.mjs');
   if(objective.textContent!=='里長の話を聞こう')
     throw new Error('村の初期目標が設定されませんでした: '+objective.textContent);
 `;
 execFileSync(process.execPath,['--input-type=module','-e',script],{timeout:10000,stdio:'pipe'});
});

test('opening video is bound to one clipped-free landscape viewport, not intrinsic grid height',()=>{
 const page=readFileSync('src/opening/index.html','utf8');
 assert.match(page,/body\.opening-screen\{[^}]*height:100dvh/);
 assert.match(page,/body\.opening-screen\{[^}]*min-height:0/);
 assert.match(page,/body\.opening-screen\{[^}]*box-sizing:border-box/);
 assert.match(page,/#opening-video \{[^}]*position:absolute/);
 assert.match(page,/#opening-video \{[^}]*object-fit:contain/);
 assert.match(page,/#opening-video \{[^}]*object-position:center center/);
 assert.match(page,/id="opening-video" playsinline webkit-playsinline/);
});

test('all three top-level pages show the shared landscape-only gate; PWA prefers landscape',()=>{
  for(const [path,css,js] of [
    ['index.html','./src/game/ui/landscape-only.css','./src/game/ui/landscape-only.mjs'],
    ['src/opening/index.html','../game/ui/landscape-only.css','../game/ui/landscape-only.mjs'],
    ['src/game/index.html','./ui/landscape-only.css','./ui/landscape-only.mjs']
  ]){
    const source=readFileSync(path,'utf8');
    assert.ok(source.includes('id="landscape-required"'),path);
    assert.ok(source.includes(css),path);
    assert.ok(source.includes(js),path);
  }
  const css=readFileSync('src/game/ui/landscape-only.css','utf8');
  const js=readFileSync('src/game/ui/landscape-only.mjs','utf8');
  assert.match(css,/@media\s*\(orientation:\s*portrait\)/);
  assert.match(css,/z-index:120/);
  assert.match(js,/inert\s*=\s*portrait/);
  assert.match(js,/dispatchEvent\(new Event\('blur'\)\)/);
  assert.doesNotMatch(js,/location\.reload|location\.replace|\.navigate\(/);
  assert.equal(JSON.parse(readFileSync('src/game/app.webmanifest','utf8')).orientation,'landscape');
  const video=readFileSync('src/opening/opening.js','utf8');
  assert.match(video,/video\.pause\(\)/);
  assert.match(video,/resumeAfterRotation/);
});
