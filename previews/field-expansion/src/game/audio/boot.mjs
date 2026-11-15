import {makeAudioEngine} from './audio.mjs';
const root=document.querySelector('main');
const track=root?.dataset.bgm;
let parentGame=null;
if(window.parent && window.parent!==window){
  try {
    const host=window.parent.KIKOKU_GAME;
    if(host?.acceptsChild?.(location.href, window))parentGame=host;
  }catch{}
}
const shared=parentGame?.audio;
if(shared){
  // The real audio element and ON/OFF control remain in the outer /src/game/ page.
  // No second BGM player is ever constructed inside a scene.
  globalThis.KIKOKU_AUDIO=shared;
  const duplicate=document.querySelector('#sound-toggle');
  if(duplicate)duplicate.hidden=true;
}else if(track && window.KIKOKU_ROUTE?.admitted!==false){
  globalThis.KIKOKU_AUDIO=makeAudioEngine(track,document.querySelector('#sound-toggle'));
}
const audio=globalThis.KIKOKU_AUDIO;
if(audio && window.KIKOKU_ROUTE?.admitted!==false){
  document.addEventListener('pointerdown',event=>{
    const action=event.target.closest('button,a');
    if(!action||action.id==='sound-toggle')return;
    audio.unlock();
    if(action.matches('[data-dir]'))audio.se('step');
  },true);
  document.addEventListener('keydown',event=>{
    if(event.repeat||event.metaKey||event.altKey||event.ctrlKey)return;
    audio.unlock();
    if(/^(Arrow(Up|Down|Left|Right)|[wasd])$/.test(event.key))audio.se('step');
  },true);
  document.addEventListener('click',event=>{
    const action=event.target.closest('button,a');
    if(!action||action.id==='sound-toggle')return;
    if(root.classList.contains('title-screen'))
      audio.se(action.id==='close-demo'?'cancel':'confirm');
  },true);
}
