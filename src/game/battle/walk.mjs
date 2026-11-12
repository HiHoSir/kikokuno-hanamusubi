import {BATTLE_REQUEST_KEY,ENEMIES,createBattle,readPlayer,savePlayer} from './rules.mjs';

const root=new URL('../../../',import.meta.url);
const el=id=>document.getElementById(id);
const list=el('command-list'),title=el('command-title'),message=el('battle-message');
const hero=el('hero-image'),heroFigure=el('hero-figure'),enemyFigure=el('enemy-figure');
const enemyImage=el('enemy-image'),enemyLabel=el('enemy-label');
const hp=el('hp-label'),mp=el('mp-label'),level=el('level-label'),resources=el('resource-label');
const hpMeter=el('hp-meter'),mpMeter=el('mp-meter'),intro=el('encounter');
const image=(path)=>new URL(path,root).href;
const posePaths=Object.freeze({
  idle:'assets/characters/hizuki/battle/idle.png',
  attack:'assets/characters/hizuki/battle/attack.png',
  skill:'assets/characters/hizuki/battle/skill.png',
  hit:'assets/characters/hizuki/battle/hit.png',
  guard:'assets/characters/hizuki/battle/guard.png',
  victory:'assets/characters/hizuki/battle/victory.png',
});
let request=null;
try{
  const value=JSON.parse(sessionStorage.getItem(BATTLE_REQUEST_KEY)||'null');
  if(value && ENEMIES[value.enemyId] && Number.isFinite(value.at) &&
    Date.now()-value.at<120000)request=value;
  sessionStorage.removeItem(BATTLE_REQUEST_KEY);
}catch{}
const battle=createBattle(request?.enemyId||'field-oni',readPlayer());
const {state}=battle;
const audio=()=>globalThis.KIKOKU_AUDIO;
let mode='main',selected=0,ready=false,locked=false;
const commands={
  main:[['たたかう','attack'],['術','magic'],['道具','items'],['防御','guard'],['にげる','flee']],
  magic:[['花焔  術4','bloom'],['癒し  術3','heal'],['もどる','back']],
  items:[['薬草','herb'],['もどる','back']],
  result:[['フィールドへ戻る','return']]
};
function sound(name){audio()?.se?.(name);}
function pose(name='idle'){
  const path=posePaths[name]||posePaths.idle;
  if(hero.dataset.pose!==name){hero.src=image(path);hero.dataset.pose=name;}
}
function flash(node,cssClass){
  node.classList.remove(cssClass);
  void node.offsetWidth;
  node.classList.add(cssClass);
  setTimeout(()=>node.classList.remove(cssClass),410);
}
function updateStatus(){
  hp.textContent=state.hero.hp+' / '+state.hero.maxhp;
  mp.textContent=state.hero.mp+' / '+state.hero.maxmp;
  level.textContent=state.hero.lv+'段';
  hpMeter.style.width=(state.hero.hp/state.hero.maxhp*100)+'%';
  mpMeter.style.width=(state.hero.maxmp?state.hero.mp/state.hero.maxmp*100:0)+'%';
  resources.textContent='薬草 '+state.hero.potions+'　銭 '+state.hero.gold;
}
function announce(text){message.textContent=text;}
function changeMode(next){mode=next;selected=0;updateMenu();}
function updateMenu(){
  title.textContent=mode==='magic'?'術を選ぶ':mode==='items'?'道具を選ぶ':
    mode==='result'?(state.outcome==='victory'?'勝利':state.outcome==='escape'?'退却':'敗北'):'緋月の行動';
  const rows=mode==='result'&&state.outcome==='defeat'?[['鬼灯村へ戻る','return']]:commands[mode];
  list.replaceChildren();
  for(let i=0;i<rows.length;i++){
    const [label,command]=rows[i];
    const button=document.createElement('button');
    button.type='button';button.dataset.command=command;
    button.textContent=label;
    button.classList.toggle('selected',i===selected);
    button.disabled=locked||!ready;
    button.addEventListener('click',()=>{if(ready&&!locked){selected=i;choose(command);}});
    list.append(button);
  }
}
function navigateBack(){
  if(state.outcome==='defeat'){
    window.KIKOKU_ROUTE.go(new URL('../village/?focus=field-exit',import.meta.url));
  }else{
    window.KIKOKU_ROUTE.go(new URL('../../field/?from=battle',import.meta.url));
  }
}
function perform(command){
  if(locked||!ready)return;
  locked=true;updateMenu();
  const result=battle.act(command);
  if(!result.accepted){
    locked=false;announce(result.events[0]?.text||'行動できない。');sound('cancel');updateMenu();return;
  }
  const actionPose={attack:'attack',bloom:'skill',heal:'skill',herb:'idle',
    guard:'guard',flee:'idle'}[command]||'idle';
  pose(actionPose);
  if(command==='attack'||command==='bloom'){
    flash(heroFigure,'attacking');flash(enemyFigure,'hit');sound('confirm');
  }else if(command==='guard'){sound('confirm');}
  else if(command==='flee'){sound(result.outcome==='escape'?'confirm':'cancel');}
  else sound('notify');
  if(result.events.some(e=>e.kind==='hit'))flash(heroFigure,'hit');
  announce(result.events.map(e=>e.text).join('　'));
  updateStatus();
  savePlayer(state.hero);
  setTimeout(()=>{
    if(result.outcome){
      if(result.outcome==='defeat'){
        // Preserve experience and gold, but return home able to move again.
        state.hero.hp=Math.max(1,Math.ceil(state.hero.maxhp/2));
        state.hero.mp=Math.max(0,Math.ceil(state.hero.maxmp/2));
        savePlayer(state.hero);
        pose('hit');
      }else pose(result.outcome==='victory'?'victory':'idle');
      mode='result';
    }else{
      pose('idle');mode='main';
    }
    selected=0;locked=false;updateMenu();
  },440);
}
function choose(command){
  if(!ready||locked)return;
  if(command==='return'){navigateBack();return;}
  if(command==='back'){sound('cancel');changeMode('main');return;}
  if(command==='magic'||command==='items'){
    sound('confirm');changeMode(command);return;
  }
  perform(command);
}
function moveSelection(direction){
  if(!ready||locked)return;
  const len=list.children.length;
  if(!len)return;
  if(direction==='up'||direction==='left')selected=(selected+len-1)%len;
  else selected=(selected+1)%len;
  for(let i=0;i<len;i++)list.children[i].classList.toggle('selected',i===selected);
  sound('step');
}
function confirm(){
  if(ready&&!locked)choose(list.children[selected]?.dataset.command);
}
function cancel(){
  if(!ready||locked)return;
  if(mode==='magic'||mode==='items')choose('back');
}
const directions=new Set(['up','down','left','right']);
for(const b of document.querySelectorAll('[data-dir]')){
  b.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    event.preventDefault();moveSelection(b.dataset.dir);
  });
}
el('action-a').addEventListener('click',confirm);
el('action-b').addEventListener('click',cancel);
addEventListener('keydown',event=>{
  if(event.repeat||event.metaKey||event.altKey||event.ctrlKey)return;
  const map={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
  const direction=map[event.key];
  if(direction&&directions.has(direction)){
    event.preventDefault();moveSelection(direction);
  }else if(['Enter',' '].includes(event.key)){
    if(event.target?.closest?.('button'))return;
    event.preventDefault();confirm();
  }else if(event.key==='Escape'||event.key==='Backspace'){
    event.preventDefault();cancel();
  }
});
const encounterSE=new Audio(image('assets/audio/se/battle-encounter.ogg'));
encounterSE.preload='none';encounterSE.volume=.65;
document.addEventListener('visibilitychange',()=>{if(document.hidden)encounterSE.pause();});
addEventListener('pagehide',()=>encounterSE.pause());
enemyImage.src=image(state.enemy.asset);
enemyImage.alt=state.enemy.name;
enemyLabel.textContent=state.enemy.name;
el('battle-area').textContent='花霞野';
pose('idle');
updateStatus();updateMenu();
announce(state.enemy.name+'が現れた！');
if(audio()?.enabled!==false)void encounterSE.play().catch(()=>{});
setTimeout(()=>{
  intro.hidden=true;
  ready=true;updateMenu();
},1050);
