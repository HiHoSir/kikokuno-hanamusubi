import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const shellSource=readFileSync('src/game/navigation/game-shell.mjs','utf8');
const html=readFileSync('src/game/index.html','utf8');
const boot=readFileSync('src/game/audio/boot.mjs','utf8');
test('one top-level game document hosts all five production areas',()=>{
  assert.match(html,/id="game-scene"/);
  assert.match(html,/id="sound-toggle"/);
  assert.match(html,/game-shell\.mjs/);
  assert.match(shellSource,/src\/game\/village\//);
  assert.match(shellSource,/src\/game\/interiors\//);
  assert.match(shellSource,/src\/field\//);
  assert.match(shellSource,/src\/game\/tenyo\//);
  assert.match(shellSource,/src\/game\/battle\//);
  assert.match(shellSource,/new URL\('src\/game\/village\/',root\)/);
  assert.match(boot,/const shared=parentGame\?\.audio/);
  assert.match(boot,/duplicate\.hidden=true/);
});
test('BGM ownership is persistent and a door to the interior does not restart village music',()=>{
  const audioSource=readFileSync('src/game/audio/audio.mjs','utf8');
  assert.match(audioSource,/function switchTrack\(nextName\)/);
  assert.match(audioSource,/if \(nextName === trackName\) return false/);
  assert.match(shellSource,/if \(audio\.trackName !== nextTrack\) audio\.switchTrack\(nextTrack\)/);
  const maps=[...shellSource.matchAll(/\[new URL\('([^']+)', root\)\.pathname, \{track:'([^']+)'/g)];
  const map=new Map(maps.map(([,route,track])=>[route,track]));
  assert.equal(map.get('src/game/village/'),'village');
  assert.equal(map.get('src/game/interiors/'),'village');
  assert.equal(map.get('src/field/'),'field');
  assert.equal(map.get('src/game/tenyo/'),'prologue');
  assert.equal(map.get('src/game/battle/'),'battle');
});
test('game shell navigation is delegated and validates scene and frame identity',()=>{
  const base='https://example.test/kikokuno-hanamusubi/';
  const frame={
    title:'',src:'',contentWindow:{location:{href:new URL('src/game/village/',base).href}},
    listeners:{},addEventListener(event,fn){this.listeners[event]=fn;},
  };
  const curtain={hidden:false};
  const transitions=[];
  const audio={trackName:'village',switchTrack(track){transitions.push(track);this.trackName=track;}};
  const document={querySelector(selector){
    return {'#game-scene':frame,'#scene-transition':curtain,'#sound-toggle':{}}[selector];
  }};
  const window={};
  const location={href:new URL('src/game/',base).href};
  const source=shellSource.replace(/import \{makeAudioEngine\} from '[^']+';\s*/,'')
    .replaceAll('import.meta.url',JSON.stringify(new URL('src/game/navigation/game-shell.mjs',base).href));
  runInNewContext(source,{document,window,globalThis:window,location,URL,makeAudioEngine:()=>audio});
  assert.equal(frame.src,new URL('src/game/village/',base).href);
  frame.listeners.load();
  assert.equal(curtain.hidden,true);
  const host=window.KIKOKU_GAME;
  assert.ok(host.acceptsChild(frame.src,frame.contentWindow));
  host.navigate(new URL('src/game/interiors/?building=inn',base),frame.contentWindow);
  assert.equal(frame.src,new URL('src/game/interiors/?building=inn',base).href);
  assert.deepEqual(transitions,[]);
  assert.throws(()=>host.navigate(new URL('src/game/village/',base),{}),/現在のゲーム画面/);
  assert.throws(()=>host.navigate(new URL('previews/cave-prototype/',base),frame.contentWindow),/ゲーム本編以外/);
  host.navigate(new URL('src/field/?from=village',base),frame.contentWindow);
  assert.deepEqual(transitions,['field']);
  host.navigate(new URL('src/game/battle/',base),frame.contentWindow);
  assert.deepEqual(transitions,['field','battle']);
  host.navigate(new URL('src/field/?from=battle',base),frame.contentWindow);
  assert.deepEqual(transitions,['field','battle','field']);
});

test('world menu is hosted by the persistent game shell, not duplicated in the scenes',()=>{
 const menu=readFileSync('src/game/ui/field-menu.mjs','utf8');
 assert.match(html,/id="field-menu-toggle"/);
 assert.match(html,/id="field-menu-backdrop" hidden/);
 assert.match(html,/field-menu.mjs/);
 assert.match(menu,/readPlayer/);
 assert.match(menu,/useExplorationResource/);
 assert.match(menu,/isBattle/);
 assert.match(menu,/dispatchEvent\(new Event\('blur'\)\)/);
 assert.doesNotMatch(menu,/location.assign|location.replace/);
});

test('field menu has its own on-screen gamepad with no duplicate scene control IDs',()=>{
  const js=readFileSync('src/game/ui/field-menu.mjs','utf8');
  const css=readFileSync('src/game/ui/field-menu.css','utf8');
  for(const dir of ['up','down','left','right'])assert.match(html,new RegExp('data-menu-dir="'+dir+'"'));
  for(const id of ['field-menu-action-a','field-menu-action-b','field-menu-controller'])assert.ok(html.includes('id="'+id+'"'));
  for(const code of ['function direction(dir)','function confirm()','function back()','pane=','frame.style.pointerEvents','dataset.menuCommand'])
    assert.ok(js.includes(code),code);
  assert.match(css,/#field-menu-dpad/);
  assert.match(css,/\.menu-focus/);
  assert.doesNotMatch(html,/\sid="action-a"/);
  assert.doesNotMatch(html,/\sid="action-b"/);
});

test('landscape D-pad touch targets are at least 44 CSS pixels when rendered',()=>{
 const controls=readFileSync('src/game/ui/controls.css','utf8');
 const field=readFileSync('src/field/index.html','utf8');
 const battle=readFileSync('src/game/battle/battle.css','utf8');
 const menu=readFileSync('src/game/ui/field-menu.css','utf8');
 assert.match(controls,/@media\(orientation:landscape\)[^\n]*transform:scale\(\.85\)/);
 assert.match(field,/transform:scale\(\.85\)/);
 assert.match(battle,/#pad \.dpad\{[^\n]*transform:scale\(\.85\)/);
 assert.match(menu,/#field-menu-dpad button\{[^\n]*width:44px;height:44px/);
});
