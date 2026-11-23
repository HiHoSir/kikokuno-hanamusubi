// The browser stays on /src/game/ while independent scene renderers swap.
// Only this parent document owns the BGM player and the sound toggle.
import {makeAudioEngine} from '../audio/audio.mjs';
import {pendingRestoreLocation,routeForSavedGame,saveAutoGame,saveManualGame}
  from '../save/save-game.mjs?v=save-slots-1-shiomachi-gear-1-cave-quest-1-ushiohei-hammer-1';

const root = new URL('../../../', import.meta.url);
// Scene HTML itself needs a fresh URL, not just the top-level title page.
const build = new URL(location.href).searchParams.get('build');
const frame = document.querySelector('#game-scene');
const curtain = document.querySelector('#scene-transition');
const audio = makeAudioEngine('village', document.querySelector('#sound-toggle'));
globalThis.KIKOKU_AUDIO = audio;

const routes = new Map([
  [new URL('src/game/village/', root).pathname, {track:'village', label:'鬼灯村'}],
  [new URL('src/game/interiors/', root).pathname, {track:'village', label:'室内'}],
  [new URL('src/field/', root).pathname, {track:'field', label:'花霞野'}],
  [new URL('src/game/tenyo/', root).pathname, {track:'prologue', label:'天妖の社'}],
  [new URL('src/game/cove/', root).pathname, {track:'field', label:'海の入り江'}],
  [new URL('src/game/shiomachi/', root).pathname, {track:'field', label:'潮待村'}],
  [new URL('src/game/cave/', root).pathname, {track:'dungeon', label:'社西の洞窟'}],
  [new URL('src/game/battle/', root).pathname, {track:'battle', label:'戦闘'}],
]);
let active = '';
function normalize(url) {
  const target = new URL(url, location.href);
  if (target.origin !== root.origin || !routes.has(target.pathname)) {
    throw new Error('ゲーム本編以外への画面切替は禁止: ' + target.href);
  }
  if(build) target.searchParams.set('build',build);
  return target;
}
function acceptsChild(url, sourceWindow) {
  if (sourceWindow !== frame.contentWindow || !active) return false;
  try {
    const candidate = normalize(url);
    return candidate.pathname + candidate.search === active;
  } catch { return false; }
}
function navigate(target, sourceWindow) {
  if (sourceWindow && sourceWindow !== frame.contentWindow) {
    throw new Error('現在のゲーム画面からのみ遷移できます');
  }
  if(sourceWindow) autosave(sourceWindow);
  const next = normalize(target);
  const route = next.pathname + next.search;
  if (route === active) return;
  active = route;
  curtain.hidden = false;
  frame.title = '鬼哭の花結び ' + routes.get(next.pathname).label;
  const nextTrack = routes.get(next.pathname).track;
  if (audio.trackName !== nextTrack) audio.switchTrack(nextTrack);
  frame.src = next.href;
}
// The scene's own state is the only reliable position source (village pixels,
// field world pixels, sanctuary tiles). Never infer location from DOM offsets.
function snapshot(sourceWindow){
  try{
    if(sourceWindow&&sourceWindow!==frame.contentWindow)return null;
    const scene=normalize(frame.contentWindow.location.href);
    if(scene.pathname+scene.search!==active)return null;
    const getter=frame.contentWindow.KIKOKU_SAVE_SNAPSHOT;
    return typeof getter==='function'?getter():null;
  }catch{return null;}
}
function autosave(sourceWindow){
  const position=snapshot(sourceWindow);
  if(!position)return {accepted:false,message:'自動保存できる場面ではありません。'};
  return saveAutoGame(position);
}
function manualSave(){
  const position=snapshot();
  if(!position)return {accepted:false,message:'読み込み中は記録できません。'};
  return saveManualGame(position);
}
window.KIKOKU_GAME = Object.freeze({acceptsChild, navigate, audio, autosave,manualSave});
globalThis.setInterval?.(()=>{
  if(!document.hidden)autosave();
},15000);
frame.addEventListener('load', () => {
  try {
    const target = normalize(frame.contentWindow.location.href);
    if (target.pathname + target.search === active) curtain.hidden = true;
  } catch {
    // Keep the transition cover if a scene was unexpectedly replaced.
  }
});
const restore=pendingRestoreLocation();
navigate((restore&&routeForSavedGame({location:restore},root))||new URL('src/game/village/',root));
