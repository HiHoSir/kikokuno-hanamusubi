import {contact, createFieldRenderer, fieldStep, loadFieldArt, villageArrival, world} from './runtime.mjs?v=26136fe';

const scene = document.querySelector('#scene');
const load = document.querySelector('#load');
const status = document.querySelector('#status');
const buttons = [...document.querySelectorAll('[data-dir]')];
const directions = {up: [0, -1, 1], down: [0, 1, 0], left: [-1, 0, 3], right: [1, 0, 2]};
const keys = {ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right'};
const inputs = new Map();
const stride = [0, 1, 0, 2];

function updateButtons() {
  const active = [...inputs.values()].at(-1);
  for (const button of buttons) button.classList.toggle('held', button.dataset.dir === active);
}

function setInput(id, direction) {
  if (direction) inputs.set(id, direction);
  else inputs.delete(id);
  updateButtons();
}

function clearInput() {
  inputs.clear();
  updateButtons();
}

async function start() {
  const [x, y] = villageArrival();
  const state = {x, y, row: new URLSearchParams(location.search).get('from') === 'village' ? 0 : 1, column: 0};
  const hero = await loadFieldArt();
  const render = createFieldRenderer(scene.getContext('2d', {alpha: false}), hero);
  let phase = 0;
  let lastWaterFrame = -1;

  function updatePosition() {
    scene.dataset.x = String(Math.floor(state.x / world.tileSize));
    scene.dataset.y = String(Math.floor(state.y / world.tileSize));
    const place = world.near(state.x, state.y);
    status.textContent = place ? world.places[place].name + '付近' : 'フィールド';
  }

  function frame(now) {
    let dirty = Boolean(state.motion);
    let startAt = now;
    if (state.motion && now - state.motion.at >= state.motion.duration) {
      startAt = Math.max(state.motion.at + state.motion.duration, now - 32);
      state.motion = null;
      state.ladder = null;
      state.column = 0;
      updatePosition();
      if (contact(state.x, state.y) === 'village') {
        clearInput();
        location.assign(new URL('../../previews/village-walk/?focus=field-exit&v=field-connection', import.meta.url));
        return;
      }
    }
    const direction = [...inputs.values()].at(-1);
    if (direction && !state.motion) {
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
    const waterFrame = Math.floor(now / 360);
    if (dirty || waterFrame !== lastWaterFrame) {
      render(state, now);
      lastWaterFrame = waterFrame;
    }
    requestAnimationFrame(frame);
  }

  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setInput(event.pointerId, button.dataset.dir);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, event => setInput(event.pointerId));
    }
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
  requestAnimationFrame(frame);
}

start().catch(error => {
  console.error(error);
  load.textContent = 'フィールドを読み込めませんでした。ページを再読み込みしてください。';
});
