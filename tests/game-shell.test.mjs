import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const shellSource=readFileSync('src/game/navigation/game-shell.mjs','utf8');
const html=readFileSync('src/game/index.html','utf8');
const boot=readFileSync('src/game/audio/boot.mjs','utf8');
test('one top-level game document hosts all four production areas',()=>{
  assert.match(html,/id="game-scene"/);
  assert.match(html,/id="sound-toggle"/);
  assert.match(html,/game-shell\.mjs/);
  assert.match(shellSource,/src\/game\/village\//);
  assert.match(shellSource,/src\/game\/interiors\//);
  assert.match(shellSource,/src\/field\//);
  assert.match(shellSource,/src\/game\/tenyo\//);
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
});
