import {BATTLE_REQUEST_KEY,ENEMIES,FOOD_ITEMS,createBattle,readPlayer,savePlayer} from './rules.mjs?v=field-balance-1';

const root=new URL('../../../',import.meta.url);
const el=id=>document.getElementById(id);
const list=el('command-list'),title=el('command-title'),message=el('battle-message');
const hero=el('hero-image'),heroFigure=el('hero-figure'),enemyFigure=el('enemy-figure');
const enemyImage=el('enemy-image'),enemyLabel=el('enemy-label');
const enemyFigure2=el('enemy-figure-2'),enemyImage2=el('enemy-image-2'),enemyLabel2=el('enemy-label-2');
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
const battle=createBattle(request?.enemyId||'field-oni',readPlayer(),Math.random,request?.count||1);
const {state}=battle;
const audio=()=>globalThis.KIKOKU_AUDIO;
let mode='main',selected=0,ready=false,locked=false,targetCommand=null,targetReturn='main';
const commands={
  main:[['たたかう','attack'],['術','magic'],['道具','items'],['防御','guard'],['にげる','flee']],
  magic:[['糸遊  技3','bloom'],['つむぎ  技5','heal'],['もどる','back']],
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
function updateEnemies(){
  const two=state.enemies.length>1;
  const stage=el('battle-stage');
  stage.classList.toggle('pair',two);
  stage.classList.toggle('target-mode',mode==='targets');
  const figures=[enemyFigure,enemyFigure2],images=[enemyImage,enemyImage2],labels=[enemyLabel,enemyLabel2];
  const alive=state.enemies.filter(e=>e.hp>0);
  for(let i=0;i<2;i++){
    const e=state.enemies[i],figure=figures[i],image=images[i],label=labels[i];
    figure.hidden=!e||e.hp<=0;
    const canTarget=mode==='targets'&&!!e&&e.hp>0;
    figure.classList.toggle('targetable',canTarget);
    figure.tabIndex=canTarget?0:-1;
    figure.setAttribute?.('aria-label',canTarget?e.name+' '+(i+1)+'番を標的に選ぶ':e?.name||'');
    if(!e)continue;
    if(image.dataset.enemyId!==e.id){
      image.dataset.enemyId=e.id;
      // Approved individual 128px pixel sprites use nearest-neighbor display;
      // other enemy originals remain unchanged, never canvas-downsampled.
      image.dataset.pixelArt=['tanuki','field-oni','onibi'].includes(e.id)?'true':'false';
      image.alt=e.name;
      const source=new URL(e.asset,root);
      if(e.id==='tanuki')source.searchParams.set('v','77a93691');
      else if(e.id==='field-oni')source.searchParams.set('v','651fcddc');
      else if(e.id==='onibi')source.searchParams.set('v','4efa9446');
      image.src=source.href;
    }
    label.textContent=e.name+(two?' '+(i+1):'');
    figure.classList.toggle('targeted',mode==='targets'&&alive.indexOf(e)===selected);
  }
}
function updateStatus(){
  hp.textContent=state.hero.hp+' / '+state.hero.maxhp;
  mp.textContent=state.hero.mp+' / '+state.hero.maxmp;
  level.textContent=state.hero.lv+'段';
  hpMeter.style.width=(state.hero.hp/state.hero.maxhp*100)+'%';
  mpMeter.style.width=(state.hero.maxmp?state.hero.mp/state.hero.maxmp*100:0)+'%';
  resources.textContent='薬草 '+state.hero.potions+'　両 '+state.hero.gold;
  updateEnemies();
}
function announce(text){message.textContent=text;}
function changeMode(next){mode=next;selected=0;updateMenu();}
function updateMenu(){
  title.textContent=mode==='targets'?'標的を選ぶ':mode==='magic'?'術を選ぶ':mode==='items'?'道具を選ぶ':
    mode==='result'?(state.outcome==='victory'?'勝利':state.outcome==='escape'?'退却':'敗北'):'緋月の行動';
  const rows=mode==='targets'?[...state.enemies.flatMap((enemy,i)=>enemy.hp>0?[[enemy.name+' '+(i+1),'target-'+i]]:[]),['もどる','back']]:mode==='items'?[['薬草 '+state.hero.potions,'herb'],...Object.values(FOOD_ITEMS).map(item=>[item.name+' '+state.hero.foods[item.id],'food:'+item.id]),['もどる','back']]:mode==='result'&&state.outcome==='defeat'?[['鬼灯村へ戻る','return']]:commands[mode];
  list.replaceChildren();
  for(let i=0;i<rows.length;i++){
    const [label,command]=rows[i];
    const button=document.createElement('button');
    button.type='button';button.dataset.command=command;
    button.textContent=label;
    button.classList.toggle('selected',i===selected);
    button.disabled=locked||!ready||(command==='bloom'&&state.hero.lv<3);
    button.addEventListener('click',()=>{if(ready&&!locked){selected=i;choose(command);}});
    list.append(button);
  }
  updateEnemies();
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
  const baseCommand=command.split(':')[0];
  const result=battle.act(command);
  if(!result.accepted){
    locked=false;announce(result.events[0]?.text||'行動できない。');sound('cancel');updateMenu();return;
  }
  const actionPose={attack:'attack',bloom:'skill',heal:'skill',herb:'idle',food:'idle',
    guard:'guard',flee:'idle'}[baseCommand]||'idle';
  pose(actionPose);
  const isStrike=baseCommand==='attack'||baseCommand==='bloom';
  const enemyTarget=command.endsWith(':1')?enemyFigure2:enemyFigure;
  const receivedHit=result.events.some(e=>e.kind==='hit');
  // Timeline for a physical/skill attack: hero attack (0ms), enemy impact
  // (95ms, removed by 505ms), optional enemy retaliation and hero hit (570ms),
  // result (1060ms). Do not display hit.png while attack FX remains on screen.
  // Non-strike actions use a shorter retaliation/recovery timeline.
  announce(result.events[0]?.text||'');
  if(isStrike){
    flash(heroFigure,'attacking');
    sound('confirm');
    setTimeout(()=>{
      flash(enemyTarget,'hit');
      flash(enemyTarget,baseCommand==='bloom'?'impact-magic':'impact-physical');
    },95);
  }else if(baseCommand==='guard'){sound('confirm');}
  else if(baseCommand==='flee'){sound(result.outcome==='escape'?'confirm':'cancel');}
  else sound('notify');
  if(receivedHit){
    setTimeout(()=>{
      pose('hit');
      flash(heroFigure,'hit');
      flash(heroFigure,'impact-hit');
      const retaliation=result.events.filter(e=>e.kind==='hit');
      announce(retaliation.at(-1)?.text||'緋月は傷を負った。');
    },isStrike?570:225);
  }
  setTimeout(()=>{
    updateStatus(); // Enemy defeated: hide only after its impact.
    savePlayer(state.hero);
    if(result.outcome){
      if(result.outcome==='defeat'){
        state.hero.hp=state.hero.maxhp;
        state.hero.mp=state.hero.maxmp;
        savePlayer(state.hero);
        pose('hit');
      }else pose(result.outcome==='victory'?'victory':'idle');
      mode='result';
    }else{
      pose('idle');mode='main';
    }
    // Avoid overflowing the message window with all retaliation lines.
    announce(result.events.at(-1)?.text||'');
    selected=0;locked=false;updateMenu();
  },receivedHit?(isStrike?1060:680):(isStrike?600:440));
}
function choose(command){
  if(!ready||locked)return;
  if(command==='return'){navigateBack();return;}
  if(command==='back'){
    sound('cancel');if(mode==='targets'){targetCommand=null;changeMode(targetReturn);}
    else changeMode('main');return;
  }
  if(mode==='targets'&&command?.startsWith('target-')){
    const index=Number(command.slice(7));const action=targetCommand;
    // Leave target-selection mode before animating the committed attack.
    // Otherwise a different enemy keeps the yellow cursor while hit effects
    // play on the chosen one.
    targetCommand=null;mode='main';selected=0;
    perform(action+':'+index);return;
  }
  if((command==='attack'||command==='bloom')&&state.enemies.filter(e=>e.hp>0).length>1){
    targetCommand=command;targetReturn=mode;sound('confirm');changeMode('targets');return;
  }
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
  updateEnemies();
  sound('step');
}
function confirm(){
  if(ready&&!locked)choose(list.children[selected]?.dataset.command);
}
function cancel(){
  if(!ready||locked)return;
  if(mode==='magic'||mode==='items'||mode==='targets')choose('back');
}
// Enemy art can be tapped in target mode; the D-pad and A/B use the same
// selection state, so an orientation change never recreates the battle.
for(const [index,figure] of [enemyFigure,enemyFigure2].entries()){
  const target=()=>{if(ready&&!locked&&mode==='targets'&&state.enemies[index]?.hp>0)choose('target-'+index);};
  figure.addEventListener('click',target);
  figure.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){
      event.preventDefault?.();event.stopPropagation?.();target();
    }
  });
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
updateEnemies();
el('battle-area').textContent=request?.zone==='shrine-approach'?'天妖の社への道':'花霞野';
pose('idle');
updateStatus();updateMenu();
announce(state.enemies.length>1?state.enemy.name+'が'+state.enemies.length+'体現れた！':state.enemy.name+'が現れた！');
if(audio()?.enabled!==false)void encounterSE.play().catch(()=>{});
setTimeout(()=>{
  intro.hidden=true;
  ready=true;updateMenu();
},1050);
