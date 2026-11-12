import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,ENCOUNTER_SE,SOUND_SETTING_KEY,BGM_CHECKPOINT_KEY,makeAudioEngine} from '../src/game/audio/audio.mjs';

test('soundtrack routing uses the approved audio and author-defined intro loops',()=>{
 assert.equal(TRACKS.title.file,'bgm/title.ogg');
 assert.equal(TRACKS.title.loopStart,10.91);
 assert.equal(TRACKS.village.loopStart,0);
 assert.equal(TRACKS.field.loopStart,7.27);
 assert.equal(TRACKS.battle.loopStart,1.54);
 assert.ok(ENCOUNTER_SE.href.endsWith('assets/audio/se/battle-encounter.ogg'));
});

function eventTarget(){
 const events=new Map();
 return {events,addEventListener(name,fn){const list=events.get(name)??[];list.push(fn);events.set(name,list);},
  fire(name){for(const cb of events.get(name)??[])cb();}};
}
class MockAudio {
 constructor(src){this.src=src;this.volume=1;this.currentTime=0;this.duration=88.9;
  this.paused=true;this.allow=false;this.calls=0;this.events=eventTarget();}
 addEventListener(name,fn){this.events.addEventListener(name,fn);}
 play(){this.calls++;if(!this.allow)return Promise.reject(Object.assign(new Error('gesture needed'),{name:'NotAllowedError'}));
  this.paused=false;this.events.fire('playing');return Promise.resolve();}
 pause(){this.paused=true;this.events.fire('pause');}
}
function button(){
 const events=eventTarget();
 return {textContent:'',attributes:{},events,addEventListener:(...a)=>events.addEventListener(...a),setAttribute(k,v){this.attributes[k]=v;},fire(name){events.fire(name);}};
}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
test('Safari autoplay rejection yields manual button and respects persisted mute',async()=>{
 const old={Audio:globalThis.Audio,window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage};
 const win=eventTarget(),doc=eventTarget();doc.hidden=false;
 const prefs=new Map();
 globalThis.Audio=MockAudio;globalThis.window=win;globalThis.document=doc;
 globalThis.localStorage={getItem:key=>prefs.get(key)??null,setItem:(k,v)=>prefs.set(k,v)};
 try{
  const control=button();
  const engine=makeAudioEngine('title',control);
  await flush();
  assert.equal(engine.playing,false,'iOS audio must not be falsely marked as playing');
  assert.equal(engine.needsGesture,true);
  assert.equal(control.textContent,'♪ 再生');
  engine.player.allow=true;
  engine.unlock();
  await flush();
  assert.equal(engine.playing,true);
  assert.equal(control.textContent,'♫ ON');
  control.fire('click');
  assert.equal(engine.enabled,false);
  assert.equal(engine.player.paused,true);
  assert.equal(prefs.get(SOUND_SETTING_KEY),'off');
  control.fire('click');
  await flush();
  assert.equal(engine.enabled,true);
  assert.equal(engine.playing,true);
  assert.equal(prefs.get(SOUND_SETTING_KEY),'on');
  doc.hidden=true;doc.fire('visibilitychange');
  assert.equal(engine.playing,false);
  doc.hidden=false;doc.fire('visibilitychange');
  await flush();
  assert.equal(engine.playing,true,'return from background must re-arm playback');
  win.fire('pagehide');
  assert.equal(engine.player.paused,true);
  win.fire('pageshow');
  await flush();
  assert.equal(engine.playing,true);
 }finally{
  for(const [key,val]of Object.entries(old))globalThis[key]=val;
 }
});
test('BGM skips intros only after the first complete pass',async()=>{
 const old={Audio:globalThis.Audio,window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage};
 const win=eventTarget(),doc=eventTarget();doc.hidden=false;
 globalThis.Audio=MockAudio;globalThis.window=win;globalThis.document=doc;
 globalThis.localStorage={getItem:()=>null,setItem(){}};
 try{
  const engine=makeAudioEngine('field');
  engine.player.allow=true;
  engine.unlock();
  await flush();
  assert.equal(engine.player.currentTime,0,'intro plays on first pass');
  engine.player.duration=52.5;
  engine.player.currentTime=52.45;
  engine.player.events.fire('timeupdate');
  assert.equal(engine.player.currentTime,7.27,'loop returns to the field authored marker');
  const village=makeAudioEngine('village');
  assert.equal(village.player.loop,true,'village loops from 0 without a seek');
  assert.equal(engine.player.loop,false,'field plays intro only once');
 }finally{
  for(const [key,val]of Object.entries(old))globalThis[key]=val;
 }
});

test('village music resumes its saved position on interior navigation',async()=>{
 const old={Audio:globalThis.Audio,window:globalThis.window,document:globalThis.document,
  localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage};
 const win=eventTarget(),doc=eventTarget();doc.hidden=false;
 const points=new Map();
 globalThis.Audio=MockAudio;globalThis.window=win;globalThis.document=doc;
 globalThis.localStorage={getItem:()=>null,setItem(){}};
 globalThis.sessionStorage={getItem:key=>points.get(key)??null,setItem:(key,value)=>points.set(key,value)};
 try{
  const village=makeAudioEngine('village');
  village.player.allow=true;village.unlock();await flush();
  village.player.currentTime=23.5;
  win.fire('pagehide');
  const saved=JSON.parse(points.get(BGM_CHECKPOINT_KEY));
  assert.equal(saved.track,'village');
  assert.equal(saved.time,23.5);
  const newWindow=eventTarget();
  globalThis.window=newWindow;
  const indoors=makeAudioEngine('village');
  indoors.player.events.fire('loadedmetadata');
  assert.equal(indoors.player.currentTime,23.5);
  const field=makeAudioEngine('field');
  field.player.events.fire('loadedmetadata');
  assert.equal(field.player.currentTime,0,'a different track must not inherit the village time');
 }finally{for(const [key,val]of Object.entries(old))globalThis[key]=val;}
});

test('one soundtrack player survives village ↔ interior without touching playback',async()=>{
 const previous={Audio:globalThis.Audio,window:globalThis.window,document:globalThis.document,
   localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage};
 const win=eventTarget(),doc=eventTarget();doc.hidden=false;
 globalThis.Audio=MockAudio;globalThis.window=win;globalThis.document=doc;
 globalThis.localStorage={getItem:()=>null,setItem(){}};
 globalThis.sessionStorage={getItem:()=>null,setItem(){}};
 try {
  const engine=makeAudioEngine('village');
  const player=engine.player;
  player.allow=true;
  engine.unlock();
  await flush();
  player.currentTime=23.5;
  const before=player.calls;
  assert.equal(engine.switchTrack('village'),false);
  assert.equal(engine.player,player);
  assert.equal(engine.player.currentTime,23.5);
  assert.equal(engine.player.paused,false);
  assert.equal(engine.player.calls,before,'door transition must never start a new play call');
  assert.equal(engine.switchTrack('field'),true);
  await flush();
  assert.equal(engine.player,player,'the HTMLAudioElement must be shared across areas');
  assert.equal(engine.trackName,'field');
  assert.equal(engine.player.loop,false);
  assert.equal(engine.player.currentTime,0);
  assert.ok(engine.player.src.endsWith('/assets/audio/bgm/field.ogg'));
  assert.equal(engine.switchTrack('prologue'),true);
  await flush();
  assert.ok(engine.player.src.endsWith('/assets/audio/bgm/prologue-theme.ogg'));
 }finally {
  for(const [key,val] of Object.entries(previous)) globalThis[key]=val;
 }
});
