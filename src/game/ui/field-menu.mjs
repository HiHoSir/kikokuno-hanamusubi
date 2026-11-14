// Single parent-owned landscape command menu; neither scene iframe nor BGM is replaced.
// The on-screen D-pad/A/B is menu-local. Scene controls cannot receive input behind it.
import {readPlayer,savePlayer,useExplorationResource,FOOD_ITEMS,nextLevelXp} from '../battle/rules.mjs';

const frame=document.querySelector('#game-scene');
const opener=document.querySelector('#field-menu-toggle');
const backdrop=document.querySelector('#field-menu-backdrop');
const closer=document.querySelector('#field-menu-close');
const summary=document.querySelector('#field-menu-summary');
const commands=document.querySelector('#field-menu-commands');
const detail=document.querySelector('#field-menu-detail');
const message=document.querySelector('#field-menu-message');
const entries=[['items','道具'],['magic','術'],['equipment','装備'],['status','強さ'],['record','記録'],['settings','設定']];
const enabled=entries.filter(([id])=>id!=='record').map(([id])=>id);
let selected='items',opened=false,pane='commands',detailIndex=0;
const el=(tag,txt)=>{const node=document.createElement(tag);node.textContent=txt;return node};
const actionable=()=>[...detail.querySelectorAll('button:not([disabled])')];
function isBattle(){return frame.src.includes('/src/game/battle/')}
function hide(){
  if(!opened)return;
  opened=false;backdrop.hidden=true;frame.style.pointerEvents='';
  opener.setAttribute('aria-expanded','false');
  if(!opener.hidden)opener.focus();
}
function show(){
  if(opened||isBattle()||opener.hidden||matchMedia('(orientation: portrait)').matches)return;
  try{frame.contentWindow?.dispatchEvent(new Event('blur'))}catch{}
  opened=true;selected='items';pane='commands';detailIndex=0;
  frame.style.pointerEvents='none';backdrop.hidden=false;
  opener.setAttribute('aria-expanded','true');message.textContent='';
  render();closer.focus();
}
function refreshScene(){
  if(opened)hide(); // Even a scripted route change must dismiss a stale menu.
  opener.hidden=isBattle();
  try{frame.contentWindow?.addEventListener('keydown',e=>{
    if(e.key?.toLowerCase()==='m'&&!e.repeat&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!isBattle()){
      e.preventDefault();if(!opened)show();
    }
  },true)}catch{}
}
function updateCursor(){
  for(const button of commands.querySelectorAll('button')){
    const active=button.dataset.menuCommand===selected;
    button.classList.toggle('selected',active);
    button.classList.toggle('menu-focus',active&&pane==='commands');
    button.setAttribute('aria-current',active?'true':'false');
  }
  const available=actionable();
  detailIndex=Math.max(0,Math.min(available.length-1,detailIndex));
  for(const button of detail.querySelectorAll('button')){
    const index=available.indexOf(button);
    const focused=pane==='detail'&&index>=0&&index===detailIndex;
    button.classList.toggle('menu-focus',focused);
  }
  commands.dataset.menuPane=pane;
  detail.dataset.menuPane=pane;
}
function addAction(label,callback,disabled=false){
  const b=el('button',label);b.type='button';b.disabled=disabled;
  b.addEventListener('click',()=>{
    if(!opened)return;
    pane='detail';detailIndex=Math.max(0,actionable().indexOf(b));callback();
    updateCursor();
  });
  detail.append(b);
}
function use(kind,id){
  const outcome=useExplorationResource(readPlayer(),kind,id);
  if(outcome.accepted)savePlayer(outcome.player);
  message.textContent=outcome.message;
  window.KIKOKU_GAME?.audio?.se?.(outcome.accepted?'confirm':'cancel');
  render();
}
function change(id){
  if(!enabled.includes(id))return;
  selected=id;pane='commands';detailIndex=0;message.textContent='';render();
}
function render(){
  const hero=readPlayer();
  summary.textContent='緋月 '+hero.lv+'段　 体 '+hero.hp+'/'+hero.maxhp+'　 技 '+hero.mp+'/'+hero.maxmp+'　 '+hero.gold+'両';
  commands.replaceChildren();detail.replaceChildren();
  for(const [id,name] of entries){
    const b=el('button',(id===selected?'▶ ':'　')+name);
    b.type='button';b.dataset.menuCommand=id;b.disabled=id==='record';
    if(id==='record')b.title='セーブ機能は未実装です';
    b.addEventListener('click',()=>change(id));commands.append(b);
  }
  detail.append(el('h2',entries.find(row=>row[0]===selected)[1]));
  if(selected==='items'){
    addAction('薬草 ×'+hero.potions+' 体力+26',()=>use('herb'),hero.potions===0);
    for(const item of Object.values(FOOD_ITEMS)){
      addAction(item.name+' ×'+hero.foods[item.id]+' 体力+'+item.heal,()=>use('food',item.id),hero.foods[item.id]===0);
    }
    detail.append(el('p','選んだ道具をその場で使います。'));
  }else if(selected==='magic'){
    addAction('つむぎ 技5 体力回復',()=>use('heal'),hero.mp<5);
    detail.append(el('p','糸遊：3段で習得（戦闘用）'));
  }else if(selected==='equipment'){
    detail.append(el('p',hero.equipmentTier==='T0'?'初期の兵具':'旅の兵具一式 '+hero.equipmentTier));
    detail.append(el('p','兵具屋で買った装備は自動装備です。'));
  }else if(selected==='status'){
    const dl=document.createElement('dl');detail.append(dl);
    for(const [key,value] of [['段',hero.lv],['体',hero.hp+'/'+hero.maxhp],['技',hero.mp+'/'+hero.maxmp],['攻撃',hero.attack],['守備',hero.defense],['速さ',hero.speed],['心',hero.xp+'/'+nextLevelXp(hero.lv)],['両',hero.gold]]){
      dl.append(el('dt',key),el('dd',String(value)));
    }
  }else if(selected==='settings'){
    const audio=window.KIKOKU_GAME?.audio;
    addAction('音声 '+(audio?.enabled?'ON':'OFF'),()=>{audio?.setEnabled(!audio.enabled);render()},!audio);
    detail.append(el('p','詳細設定は今後追加します。'));
  }
  if(pane==='detail'&&!actionable().length)pane='commands';
  updateCursor();
}
function direction(dir){
  if(!opened)return;
  if(pane==='commands'){
    if(dir==='right'){
      if(actionable().length){pane='detail';detailIndex=0;}
    }else if(dir==='up'||dir==='down'){
      const index=enabled.indexOf(selected);
      selected=enabled[(index+(dir==='up'?-1:1)+enabled.length)%enabled.length];
      message.textContent='';detailIndex=0;render();
      return;
    }
  }else if(pane==='detail'){
    if(dir==='left'){pane='commands';}
    else if(dir==='up'||dir==='down'||dir==='right'){
      const n=actionable().length;
      if(n)detailIndex=(detailIndex+(dir==='up'?-1:1)+n)%n;
    }
  }
  updateCursor();
}
function confirm(){
  if(!opened)return;
  if(pane==='commands'){
    if(actionable().length){pane='detail';detailIndex=0;updateCursor();}
  }else actionable()[detailIndex]?.click();
}
function back(){
  if(!opened)return;
  if(pane==='detail'){pane='commands';updateCursor();}
  else hide();
}
opener.addEventListener('click',()=>opened?hide():show());
closer.addEventListener('click',hide);
backdrop.addEventListener('click',e=>{if(e.target===backdrop)hide()});
for(const button of backdrop.querySelectorAll('[data-menu-dir]')){
  button.addEventListener('click',()=>direction(button.dataset.menuDir));
}
backdrop.querySelector('#field-menu-action-a').addEventListener('click',confirm);
backdrop.querySelector('#field-menu-action-b').addEventListener('click',back);
document.addEventListener('keydown',event=>{
  if(!opened||event.ctrlKey||event.altKey||event.metaKey)return;
  const keys={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'};
  if(keys[event.key]){
    event.preventDefault();event.stopPropagation();
    if(!event.repeat)direction(keys[event.key]);
  }else if(['Enter',' ','z','Z'].includes(event.key)){
    event.preventDefault();event.stopPropagation();
    if(!event.repeat)confirm();
  }else if(['Escape','Backspace','x','X'].includes(event.key)){
    event.preventDefault();event.stopPropagation();
    if(!event.repeat)back();
  }else if(event.key.toLowerCase()==='m'){
    event.preventDefault();event.stopPropagation();if(!event.repeat)hide();
  }
},true);
document.addEventListener('landscape-blocked',hide);
frame.addEventListener('load',refreshScene);
refreshScene();
