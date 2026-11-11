const scenes = [
  { name: '鬼灯村', url: new URL('../../assets/ui/title/village.webp', import.meta.url) },
  { name: '花霞野', url: new URL('../../assets/ui/title/field.webp', import.meta.url) },
];

const home = document.querySelector('.title-home');
const demo = document.querySelector('.title-demo');
const openDemo = document.querySelector('#show-demo');
const image = document.querySelector('#demo-image');
const sceneName = document.querySelector('#demo-name');
const nextScene = document.querySelector('#next-scene');
const closeDemo = document.querySelector('#close-demo');
let sceneIndex = 0;

function showScene() {
  const scene = scenes[sceneIndex];
  image.alt = scene.name;
  image.src = scene.url;
  sceneName.textContent = scene.name;
  nextScene.textContent = sceneIndex === scenes.length - 1 ? 'はじめの風景' : '次の風景';
}

function showTitle() {
  demo.hidden = true;
  home.hidden = false;
  openDemo.focus({ preventScroll: true });
}

openDemo.addEventListener('click', () => {
  sceneIndex = 0;
  showScene();
  home.hidden = true;
  demo.hidden = false;
  nextScene.focus({ preventScroll: true });
});

nextScene.addEventListener('click', () => {
  sceneIndex = (sceneIndex + 1) % scenes.length;
  showScene();
});

closeDemo.addEventListener('click', showTitle);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !demo.hidden) showTitle();
});
