import {makeAudioEngine} from './audio.mjs';
const root=document.querySelector('main');
const track=root?.dataset.bgm;
if(track){
  const audio=makeAudioEngine(track,document.querySelector('#sound-toggle'));
  globalThis.KIKOKU_AUDIO=audio;
  // A new document loses iOS autoplay authorization. Re-attempt when the
  // player actually taps a control, without cancelling the gameplay input.
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
    if(root.classList.contains('title-screen')){
      audio.se(action.id==='close-demo'?'cancel':'confirm');
    }
  },true);
}
