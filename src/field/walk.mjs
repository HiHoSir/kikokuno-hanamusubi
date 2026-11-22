import {contact, createFieldRenderer, fieldStep, loadFieldArt, villageArrival, placeArrival, world} from './runtime.mjs?v=authored-waterfall-1';
import {BATTLE_REQUEST_KEY,FIELD_RETURN_KEY,chooseFieldEncounter} from '../game/battle/rules.mjs?v=equipment-4slots-2';
import {consumeRestorePosition} from '../game/save/save-game.mjs?v=save-slots-1';

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

const RETURN_KEY='kikokuno-hanamusubi-field-return';
function battleReturnPosition(){
  try{
    const point=JSON.parse(sessionStorage.getItem(FIELD_RETURN_KEY)||'null');
    if(Number.isFinite(point?.x)&&Number.isFinite(point?.y)&&
      world.walkable(point.x,point.y)&&!contact(point.x,point.y)){
      return [point.x,point.y];
    }
  }catch{}
  return villageArrival();
}
function placeReturnPosition(placeId){
  try{
    const prior=JSON.parse(sessionStorage.getItem(RETURN_KEY)||'null');
    if(prior?.place===placeId&&Number.isFinite(prior.x)&&Number.isFinite(prior.y)&&
      world.walkable(prior.x,prior.y)&&contact(prior.x,prior.y)!==placeId&&
      Math.hypot(prior.x-world.places[placeId].point[0],
        prior.y-world.places[placeId].point[1])<256)
      return [prior.x,prior.y];
  }catch{}
  return placeArrival(placeId);
}
function enterFieldPlace(destination,fromPoint){
  clearInput();
  try{
    sessionStorage.setItem(RETURN_KEY,JSON.stringify({
      place:destination,x:fromPoint.x,y:fromPoint.y
    }));
  }catch{}
  const scenePath={
    shrine:'../game/tenyo/',cove:'../game/cove/',shiomachi:'../game/shiomachi/'
  }[destination];
  if(!scenePath)throw Error('未対応の地点: '+destination);
  window.KIKOKU_ROUTE.go(new URL(scenePath,import.meta.url));
}
async function start() {
  const art=await loadFieldArt();
  const from=new URLSearchParams(location.search).get('from');
  const [x, y] = ['shrine','cove','shiomachi'].includes(from)
    ?placeReturnPosition(from) : from==='battle'?battleReturnPosition():villageArrival();
  const resumed=consumeRestorePosition('field');
  const safeResume=resumed&&world.walkable(resumed.x,resumed.y)&&!contact(resumed.x,resumed.y);
  const state = {x:safeResume?resumed.x:x,y:safeResume?resumed.y:y,
    row:safeResume?(resumed.row??1):from==='village' ? 0 : 1,column:0};
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
      if(destination==='village'){
        clearInput();
        window.KIKOKU_ROUTE.go(new URL('../game/village/?focus=field-exit', import.meta.url));
        return;
      }
      if(['shrine','cove','shiomachi'].includes(destination)){
        enterFieldPlace(destination,completed);
        return;
      }
      // Enter battle only after several completed, walkable wilderness steps.
      // Do not trigger on scripted entrances or during a ladder traversal.
      walkedSteps++;
      if(walkedSteps>=encounterAfter && !destination && !wasLadder){
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
    const destination=contact(state.x,state.y);
    if(destination==='village'){
      clearInput();
      window.KIKOKU_ROUTE.go(new URL('../game/village/?focus=field-exit',location.href));
    }else if(['shrine','cove','shiomachi'].includes(destination)){
      enterFieldPlace(destination,state.motion??state);
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
