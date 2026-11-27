import {contact, createFieldRenderer, fieldStep, loadFieldArt, villageArrival, fieldExitPosition, world} from './runtime.mjs?v=shared-field-entrances-1';
import {FIELD_PLACE_ROUTES} from './landmarks.mjs?v=1';
import {BATTLE_REQUEST_KEY,FIELD_RETURN_KEY,chooseFieldEncounter,readPlayer,savePlayer} from '../game/battle/rules.mjs?v=equipment-4slots-2-cave-quest-1-finds-1-guardian-1-regional-1-pools-1-forest-palettes-1';
import {consumeRestorePosition} from '../game/save/save-game.mjs?v=save-slots-1-cave-quest-1-finds-1-guardian-1';

const scene = document.querySelector('#scene');
const load = document.querySelector('#load');
const buttons = [...document.querySelectorAll('[data-dir]')];
const directions = {up: [0, -1, 1], down: [0, 1, 0], left: [-1, 0, 3], right: [1, 0, 2]};
const keys = {ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right'};
const inputs = new Map();
const stride = [0, 1, 0, 2];
let pendingInput = null;

function updateButtons() {
  const active = [...inputs.values()].at(-1);
  for (const button of buttons) button.classList.toggle('held', button.dataset.dir === active);
}

function setInput(id, direction) {
  if (direction) {
    inputs.set(id, direction);
    // A full tap can land between two paints on a slow frame.
    pendingInput = {id, direction};
  } else inputs.delete(id);
  updateButtons();
}

function clearInput() {
  inputs.clear();
  pendingInput = null;
  updateButtons();
}

function canResumeFieldAt(x,y){
  if(!world.walkable(x,y))return false;
  const destination=contact(x,y);
  return !destination||Object.hasOwn(FIELD_PLACE_ROUTES,destination);
}
function battleReturnPosition(){
  try{
    const point=JSON.parse(sessionStorage.getItem(FIELD_RETURN_KEY)||'null');
    if(Number.isFinite(point?.x)&&Number.isFinite(point?.y)&&canResumeFieldAt(point.x,point.y)){
      return [point.x,point.y];
    }
  }catch{}
  return villageArrival();
}
function enterFieldPlace(destination){
  clearInput();
  window.KIKOKU_ROUTE.go(new URL(FIELD_PLACE_ROUTES[destination],import.meta.url));
}
async function start() {
  const art=await loadFieldArt();
  if(readPlayer().caveQuest?.bridgeCleared)world.setBridgeRockCleared?.(true);
  const from=new URLSearchParams(location.search).get('from');
  const fromLandmark=Object.hasOwn(FIELD_PLACE_ROUTES,from);
  const [x,y]=fromLandmark?fieldExitPosition(from):
    from==='battle'?battleReturnPosition():villageArrival();
  const resumed=consumeRestorePosition('field');
  const safeResume=resumed&&canResumeFieldAt(resumed.x,resumed.y);
  // Saves made before this gate can be on the far bank. Place those
  // checkpoints on the near side so the tool remains reachable.
  const gatedResume=resumed&&world.bridgeRockCell&&!world.mapData.bridgeRockCleared&&
    !world.mapData.travelReachable.has(Math.floor(resumed.x/32)+','+Math.floor(resumed.y/32));
  const nearBank=world.bridgeRockCell&&world.bridgeRockCell.map((cell,index)=>cell*32+16+index*32);
  const state = {x:gatedResume?nearBank[0]:safeResume?resumed.x:x,
    y:gatedResume?nearBank[1]:safeResume?resumed.y:y,
    row:safeResume?(resumed.row??1):fromLandmark?0:1,column:0};
  let walkedSteps=0;
  const encounterAfter=9+Math.floor(Math.random()*5);
  function startBattle(){
    clearInput();
    try{
      sessionStorage.setItem(FIELD_RETURN_KEY,JSON.stringify({x:state.x,y:state.y,row:state.row}));
      const encounter=chooseFieldEncounter({x:state.x,y:state.y},world,Math.random);
      sessionStorage.setItem(BATTLE_REQUEST_KEY,JSON.stringify({
        ...encounter,at:Date.now()
      }));
    }catch{}
    window.KIKOKU_ROUTE.go(new URL('../game/battle/', import.meta.url));
  }
  const render = createFieldRenderer(scene.getContext('2d', {alpha: false}), art);
  let phase = 0;
  let lastWaterFrame = -1;
  // The menu and rotation gate cover the world. Keep logical movement state
  // and parent's BGM intact, but skip 100ms terrain draws while invisible.
  const portraitMedia=typeof matchMedia==='function'
    ?matchMedia('(orientation: portrait)'):{matches:false,addEventListener(){}};
  const profileEnabled=new URLSearchParams(location.search).get('profile')==='1';
  let menuPaused=false,renderPaused=portraitMedia.matches;
  if(profileEnabled)window.__FIELD_RENDER_PAUSED=renderPaused;
  function updateSuspension(){
    const next=menuPaused||portraitMedia.matches;
    if(next===renderPaused)return;
    renderPaused=next;
    if(renderPaused)clearInput();
    else lastWaterFrame=-1; // First resumed RAF must repaint immediately.
    if(profileEnabled)window.__FIELD_RENDER_PAUSED=renderPaused;
  }
  portraitMedia.addEventListener?.('change',updateSuspension);
  addEventListener('game-menu-open',()=>{menuPaused=true;updateSuspension()});
  addEventListener('game-menu-close',()=>{menuPaused=false;updateSuspension()});

  function updatePosition() {
    scene.dataset.x = String(Math.floor(state.x / world.tileSize));
    scene.dataset.y = String(Math.floor(state.y / world.tileSize));
  }

  function frame(now) {
    let dirty = Boolean(state.motion);
    let startAt = now;
    if (state.motion && now - state.motion.at >= state.motion.duration) {
      const completed=state.motion;
      const wasLadder=Boolean(state.ladder);
      startAt = Math.max(state.motion.at + state.motion.duration, now - 32);
      state.motion = null;
      state.ladder = null;
      state.column = 0;
      updatePosition();
      const destination=contact(state.x,state.y);
      if(Object.hasOwn(FIELD_PLACE_ROUTES,destination)&&contact(completed.x,completed.y)!==destination){
        // Show the landed pose before covering the field. Movement within
        // the same marker never retriggers entry after returning to it.
        clearInput();
        if(!renderPaused)render(state,now);
        requestAnimationFrame(()=>enterFieldPlace(destination));
        return;
      }
      // Enter battle only after several completed, walkable wilderness steps.
      // Do not trigger on scripted entrances or during a ladder traversal.
      walkedSteps++;
      if(walkedSteps>=encounterAfter && !destination && !wasLadder && world.tileAt(state.x,state.y)!=='bridge'){
        startBattle();
        return;
      }
    }
    const direction = pendingInput?.direction ?? [...inputs.values()].at(-1);
    if (direction && !state.motion) {
      pendingInput = null;
      const [dx, dy, row] = directions[direction];
      dirty ||= state.row !== row;
      state.row = row;
      const next = fieldStep(state, dx, dy, startAt);
      if (next) {
        Object.assign(state, next);
        if (state.ladder) state.row = 1;
        phase = (phase + 1) % stride.length;
        state.column = stride[phase];
        dirty = true;
      }
    }
    // Sea/river frames still change every 360ms. Update this shared canvas
    // at 180ms to display all four approved waterfall frames while idle.
    // Rendering remains suspended behind the menu and rotation gate.
    const animatedFrame = Math.floor(now / 180);
    if (!renderPaused && (dirty || animatedFrame !== lastWaterFrame)) {
      render(state, now);
      lastWaterFrame = animatedFrame;
    }
    requestAnimationFrame(frame);
  }

  document.querySelector('#action-a')?.addEventListener('click',()=>{
    const front=Object.values(directions).find(([, ,row])=>row===state.row);
    if(!state.motion&&world.bridgeRockCell&&!world.mapData.bridgeRockCleared&&
       world.bridgeRockCell.every((cell,index)=>cell===Math.floor((index?state.y:state.x)/32)+front[index])){
      const player=readPlayer();
      const notice=document.querySelector('#field-notice');
      if(player.caveQuest.rockBreaker){
        savePlayer({...player,caveQuest:{...player.caveQuest,bridgeCleared:true}});
        world.setBridgeRockCleared(true);
        lastWaterFrame=-1;
        notice.textContent='岩砕きの槌で岩を砕いた。橋を渡れるようになった。';
        window.parent?.KIKOKU_GAME?.autosave?.(window);
      }else notice.textContent='大きな岩が橋をふさいでいる。砕く道具があれば通れそうだ。';
      notice.hidden=false;
      clearTimeout(notice.hideTimer);
      notice.hideTimer=setTimeout(()=>{notice.hidden=true;},3500);
      return;
    }
  });
  const backAction=document.querySelector('#action-b');
  if(backAction)backAction.disabled=true;
  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setInput(event.pointerId, button.dataset.dir);
    });
    for (const type of ['pointerup', 'lostpointercapture']) {
      button.addEventListener(type, event => setInput(event.pointerId));
    }
    button.addEventListener('pointercancel', event => {
      if (pendingInput?.id === event.pointerId) pendingInput = null;
      setInput(event.pointerId);
    });
    button.addEventListener('contextmenu', event => event.preventDefault());
  }
  addEventListener('keydown', event => {
    const direction = keys[event.key];
    if (!direction || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    if (!event.repeat) setInput(event.key, direction);
  });
  addEventListener('keyup', event => { if (keys[event.key]) setInput(event.key); });
  addEventListener('blur', clearInput);
  addEventListener('pagehide', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
  updatePosition();
  render(state, performance.now());
  load.hidden = true;
  window.KIKOKU_SAVE_SNAPSHOT=()=>({scene:'field',position:{x:state.x,y:state.y,row:state.row}});
  window.parent?.KIKOKU_GAME?.autosave?.(window);
  requestAnimationFrame(frame);
}

start().catch(error => {
  console.error(error);
  load.textContent = 'フィールドを読み込めませんでした。ページを再読み込みしてください。';
});
