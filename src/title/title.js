import {
  readManualGame,readAutoGame,restoreSavedGame,startNewGame,manualSaveLabel
} from '../game/save/save-game.mjs?v=save-slots-1-shiomachi-gear-1-cave-quest-1-ushiohei-hammer-1-finds-1-guardian-1-rematch-1-kozuene-1-mountain-tunnel-1';

const scenes = [
  { name: '鬼灯村', url: new URL('../../assets/ui/title/village.webp', import.meta.url) },
  { name: '花霞野', url: new URL('../../assets/ui/title/field.webp', import.meta.url) },
];

// Only a title-menu click may authorize entering the opening movie.
const startLink=document.querySelector('.title-start');
startLink.addEventListener('click', event => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const reset=startNewGame();
  if(!reset.accepted){loadMessage.textContent=reset.message;return;}
  window.KIKOKU_ROUTE.go(event.currentTarget.href);
});

const continueButton=document.querySelector('#title-continue');
const loadPanel=document.querySelector('#title-load');
const loadSlots=document.querySelector('#title-load-slots');
const loadMessage=document.querySelector('#title-load-message');
const loadBack=document.querySelector('#title-load-back');
const titleMenu=document.querySelector('.title-menu');
function displayDate(iso){
  try{return new Intl.DateTimeFormat('ja-JP',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));}
  catch{return '';}
}
function refreshSaveChoices(){
  const choices=[['manual','手動セーブ',readManualGame()],['auto','自動保存',readAutoGame()]];
  continueButton.disabled=!choices.some(([, ,save])=>save);
  loadSlots.replaceChildren();
  for(const [slot,name,save] of choices){
    const button=document.createElement('button');
    button.type='button';button.className='title-load-slot';
    button.disabled=!save;button.dataset.saveSlot=slot;
    const heading=document.createElement('strong');
    heading.textContent=name;
    const detail=document.createElement('span');
    detail.textContent=save?manualSaveLabel(save)+'　'+displayDate(save.savedAt):'記録なし';
    button.append(heading,detail);
    const load=guardianRematch=>{
      const restored=restoreSavedGame(slot,undefined,undefined,{guardianRematch});
      if(!restored.accepted){loadMessage.textContent=restored.message;refreshSaveChoices();return;}
      const target=new URL('src/game/',document.baseURI);
      const build=new URL(startLink.href,document.baseURI).searchParams.get('build');
      if(build)target.searchParams.set('build',build);
      window.KIKOKU_ROUTE.go(target);
    };
    button.addEventListener('click',()=>load(false));
    loadSlots.append(button);
    if(save?.player?.caveQuest?.rockBreaker){
      const rematch=document.createElement('button');
      rematch.type='button';rematch.className='title-load-slot';
      rematch.dataset.guardianRematch=slot;
      rematch.textContent=name+'で岩守の鬼に再戦';
      rematch.addEventListener('click',()=>{
        if(window.confirm(name+'の岩砕きの槌と橋の開通状態を戻し、岩守の鬼の前から始めますか？'))load(true);
      });
      loadSlots.append(rematch);
    }
  }
}
continueButton.addEventListener('click',()=>{
  refreshSaveChoices();
  if(continueButton.disabled)return;
  loadMessage.textContent='';
  titleMenu.hidden=true;loadPanel.hidden=false;
  loadSlots.querySelector('button:not([disabled])')?.focus({preventScroll:true});
});
function hideLoad(){
  loadPanel.hidden=true;titleMenu.hidden=false;loadMessage.textContent='';
  continueButton.focus({preventScroll:true});
}
loadBack.addEventListener('click',hideLoad);
refreshSaveChoices();

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
  if (event.key === 'Escape' && !loadPanel.hidden) hideLoad();
  else if (event.key === 'Escape' && !demo.hidden) showTitle();
});
