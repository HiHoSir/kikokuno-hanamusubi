// Audio routing for the first game. One BGM player per document; sources
// are approved files from the November 2026 music pack. Never play BGM over the MP4.
const ASSET_ROOT=new URL('../../../assets/audio/',import.meta.url);
export const TRACKS=Object.freeze({
  title:  {file:'bgm/title.ogg',loopStart:10.91,length:88.9},
  village:{file:'bgm/village.ogg',loopStart:0,length:62.9},
  field:  {file:'bgm/field.ogg',loopStart:7.27,length:52.5},
  dungeon:{file:'bgm/dungeon.ogg',loopStart:0,length:52.1},
  battle: {file:'bgm/battle.ogg',loopStart:1.54,length:40.1},
  prologue:{file:'bgm/prologue-theme.ogg',loopStart:10,length:81.6},
});
export const ENCOUNTER_SE=new URL('se/battle-encounter.ogg',ASSET_ROOT);
export const SOUND_SETTING_KEY='kikokuno-hanamusubi-audio-enabled';
export const BGM_CHECKPOINT_KEY='kikokuno-hanamusubi-bgm-checkpoint';

export function makeAudioEngine(trackName,button=null) {
  let track=TRACKS[trackName];
  if(!track)throw new Error('Unknown game BGM: '+trackName);
  const player=new Audio(new URL(track.file,ASSET_ROOT).href);
  player.preload='metadata';
  player.loop=track.loopStart===0;
  player.volume=.48;
  let allowed=true;
  try{allowed=localStorage.getItem(SOUND_SETTING_KEY)!=='off';}catch{}
  let playing=false,unlockNeeded=false,hiddenPaused=false,suspendedForPage=false;
  let ctx=null,voiceLast=0,playSerial=0;

  // Preserve position for the same area track across document navigations
  // (e.g. village <-> house), without restarting the track on every doorway.
  if(trackName==='village'){
    try{
      const point=JSON.parse(sessionStorage.getItem(BGM_CHECKPOINT_KEY)||'null');
      if(point?.track===trackName && Date.now()-point.at<30000 &&
         Number.isFinite(point.time) && point.time>0 && point.time<track.length){
        player.addEventListener('loadedmetadata',()=>{
          try{player.currentTime=point.time;}catch{}
        },{once:true});
      }
    }catch{}
  }

  function updateUI(){
    if(!button)return;
    button.textContent=!allowed?'♪ OFF':playing?'♫ ON':'♪ 再生';
    button.setAttribute('aria-label',!allowed?'サウンドをオン':playing?'サウンドをオフ':'サウンドを再生');
    button.setAttribute('aria-pressed',String(allowed&&playing));
    button.title=!allowed?'音声OFF':playing?'音声ON':'タップして音声を再生';
  }
  async function play(){
    if(!allowed||document.hidden||suspendedForPage)return;
    const request=++playSerial;
    try{
      await player.play();
      if(request!==playSerial)return; // An older promise resolved after a newer tap.
      if(!allowed||document.hidden||suspendedForPage){pause();return;}
      playing=true;unlockNeeded=false;
    }catch(e){
      if(request!==playSerial)return;
      playing=false;
      unlockNeeded=e?.name==='NotAllowedError';
      if(e?.name!=='NotAllowedError'&&e?.name!=='AbortError')console.warn('BGM再生失敗',trackName,e);
    }
    updateUI();
  }
  function pause(){
    playSerial++;
    player.pause();playing=false;updateUI();
  }
  function audioContext(){
    if(!allowed||document.hidden||suspendedForPage)return null;
    if(!ctx){
      const Constructor=globalThis.AudioContext||globalThis.webkitAudioContext;
      if(!Constructor)return null;
      ctx=new Constructor();
    }
    if(ctx.state==='suspended')void ctx.resume().catch(()=>{});
    return ctx;
  }
  function unlock(){
    if(!allowed||document.hidden||suspendedForPage)return;
    if(!playing)void play();
    audioContext();
  }
  function setEnabled(value){
    allowed=Boolean(value);
    try{localStorage.setItem(SOUND_SETTING_KEY,allowed?'on':'off');}catch{}
    if(!allowed){pause();if(ctx?.state==='running')void ctx.suspend().catch(()=>{});}
    else unlock();
    updateUI();
  }
  function switchTrack(nextName) {
    const next = TRACKS[nextName];
    if (!next) throw new Error('Unknown game BGM: ' + nextName);
    if (nextName === trackName) return false; // Never touch the village player at a doorway.
    ++playSerial; // Invalidate any pending play() promise for the previous source.
    player.pause();
    playing = false;
    trackName = nextName;
    track = next;
    player.src = new URL(track.file, ASSET_ROOT).href;
    player.loop = track.loopStart === 0;
    try { player.currentTime = 0; } catch {}
    player.load?.();
    updateUI();
    if (allowed) void play();
    return true;
  }
  function se(name){
    const patterns={
      confirm:[680,980,.10,'triangle',.052],
      cancel:[480,290,.12,'triangle',.045],
      talk:[550,720,.075,'sine',.038],
      step:[175,145,.047,'triangle',.017],
      notify:[760,1040,.16,'sine',.055],
    };
    const a=patterns[name]??patterns.confirm;
    const context=audioContext();
    if(!context||context.state!=='running')return;
    try{
      const oscillator=context.createOscillator();
      const gain=context.createGain();
      const now=context.currentTime;
      oscillator.type=a[3];
      oscillator.frequency.setValueAtTime(a[0],now);
      oscillator.frequency.exponentialRampToValueAtTime(a[1],now+a[2]);
      gain.gain.setValueAtTime(.0001,now);
      gain.gain.linearRampToValueAtTime(a[4],now+.008);
      gain.gain.exponentialRampToValueAtTime(.0001,now+a[2]);
      oscillator.connect(gain);gain.connect(context.destination);
      oscillator.start(now);oscillator.stop(now+a[2]+.005);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    }catch(e){console.warn('SE再生失敗',name,e);}
  }
  function talkChar(ch){
    if(!/[ぁ-ゖァ-ヺー]/.test(ch))return;
    const now=globalThis.performance?.now?.()??Date.now();
    if(now-voiceLast<65)return;
    voiceLast=now;
    const context=audioContext();
    if(!context||context.state!=='running')return;
    try{
      const osc=context.createOscillator(),gain=context.createGain(),t=context.currentTime;
      const base=/[あかさたなはまやらわアカサタナハマヤラワ]/.test(ch)?330:285;
      osc.type='triangle';osc.frequency.setValueAtTime(base,t);
      osc.frequency.exponentialRampToValueAtTime(base*.83,t+.043);
      gain.gain.setValueAtTime(.022,t);
      gain.gain.exponentialRampToValueAtTime(.0001,t+.052);
      osc.connect(gain);gain.connect(context.destination);
      osc.start(t);osc.stop(t+.055);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }catch{}
  }
  // Source loop metadata is not obeyed by HTMLAudio. Respect the authored
  // intro when first playing; skip to loopStart on the second pass.
  function restartAtLoop(){
    if(!allowed||suspendedForPage)return;
    if(track.loopStart>0){
      try{player.currentTime=track.loopStart;}catch{}
      if(!document.hidden)void play();
    }
  }
  player.addEventListener('ended',restartAtLoop);
  player.addEventListener('timeupdate',()=>{
    if(track.loopStart<=0||!playing||!Number.isFinite(player.duration))return;
    if(player.currentTime>=player.duration-.09){
      try{player.currentTime=track.loopStart;}catch{}
    }
  });
  player.addEventListener('pause',()=>{playing=false;updateUI();});
  player.addEventListener('playing',()=>{
    if(!allowed||document.hidden||suspendedForPage){pause();return;}
    playing=true;unlockNeeded=false;updateUI();
  });
  player.addEventListener('error',()=>{playing=false;updateUI();console.warn('BGMファイルを読めません',track.file);});
  button?.addEventListener('click',()=>{
    setEnabled(!allowed||!playing);
    if(allowed)se('confirm');
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      hiddenPaused=allowed&&playing;
      pause();
    }else if(hiddenPaused){
      hiddenPaused=false;
      void play(); // Safari may require an additional user gesture.
    }
  });
  window.addEventListener('pagehide',()=>{
    if(trackName==='village'&&allowed&&Number.isFinite(player.currentTime)&&player.currentTime>0){
      try{sessionStorage.setItem(BGM_CHECKPOINT_KEY,JSON.stringify({
        track:trackName,time:player.currentTime,at:Date.now()
      }));}catch{}
    }
    suspendedForPage=true;pause();
  });
  window.addEventListener('pageshow',()=>{
    if(!suspendedForPage)return;
    suspendedForPage=false;
    if(allowed)void play();
  });
  updateUI();
  if(allowed)void play(); // Automatic playback is best effort, never assumed.
  return {get trackName(){return trackName;},player,unlock,se,talkChar,pause,setEnabled,switchTrack,get enabled(){return allowed;},
    get needsGesture(){return unlockNeeded;},get playing(){return playing;}};
}
