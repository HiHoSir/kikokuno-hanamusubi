// The browser stays on /src/game/ while independent scene renderers swap.
// Only this parent document owns the BGM player and the sound toggle.
import {makeAudioEngine} from '../audio/audio.mjs';

const root = new URL('../../../', import.meta.url);
const frame = document.querySelector('#game-scene');
const curtain = document.querySelector('#scene-transition');
const audio = makeAudioEngine('village', document.querySelector('#sound-toggle'));
globalThis.KIKOKU_AUDIO = audio;

const routes = new Map([
  [new URL('src/game/village/', root).pathname, {track:'village', label:'鬼灯村'}],
  [new URL('src/game/interiors/', root).pathname, {track:'village', label:'室内'}],
  [new URL('src/field/', root).pathname, {track:'field', label:'花霞野'}],
  [new URL('src/game/tenyo/', root).pathname, {track:'prologue', label:'天妖の社'}],
  [new URL('src/game/battle/', root).pathname, {track:'battle', label:'戦闘'}],
]);
// Only the explicitly ticketed comparison preview may persist an alternate
// field renderer across scene navigation. Normal gameplay always uses the
// approved Momotaro-style renderer, including after a battle.
const rendererPreview = new URL(location.href).searchParams.get('field-renderer-preview') === '1';
const fieldPath = new URL('src/field/', root).pathname;
let fieldRenderer = null;
let active = '';
function setFieldRenderer(value) {
  if (!rendererPreview) throw new Error('描画方式の変更は比較プレビュー専用です');
  if (value !== null && value !== 'tile-layers') throw new Error('未対応の描画方式です');
  fieldRenderer = value;
}
function normalize(url) {
  const target = new URL(url, location.href);
  if (target.origin !== root.origin || !routes.has(target.pathname)) {
    throw new Error('ゲーム本編以外への画面切替は禁止: ' + target.href);
  }
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
  const next = normalize(target);
  if (rendererPreview && next.pathname === fieldPath) {
    // Battle and shrine routes omit renderer=...; the host must restore the
    // selected preview renderer when returning to the field.
    if (fieldRenderer === 'tile-layers') next.searchParams.set('renderer',fieldRenderer);
    else next.searchParams.delete('renderer');
  }
  const route = next.pathname + next.search;
  if (route === active) return;
  active = route;
  curtain.hidden = false;
  frame.title = '鬼哭の花結び ' + routes.get(next.pathname).label;
  const nextTrack = routes.get(next.pathname).track;
  if (audio.trackName !== nextTrack) audio.switchTrack(nextTrack);
  frame.src = next.href;
}
window.KIKOKU_GAME = Object.freeze({acceptsChild, navigate, setFieldRenderer, audio});
frame.addEventListener('load', () => {
  try {
    const target = normalize(frame.contentWindow.location.href);
    if (target.pathname + target.search === active) curtain.hidden = true;
  } catch {
    // Keep the transition cover if a scene was unexpectedly replaced.
  }
});
navigate(new URL('src/game/village/',root));
