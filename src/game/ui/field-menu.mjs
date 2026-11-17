// Single parent-owned landscape command menu; neither scene iframe nor BGM is replaced.
// The on-screen D-pad/A/B is menu-local. Scene controls cannot receive input behind it.
import {
  ARMORY_STOCK, EQUIPMENT_ITEMS, EQUIPMENT_SLOTS, carriedConsumables,
  changeEquipment, equipmentPreview, nextLevelXp, readPlayer, savePlayer,
  useExplorationResource
} from '../battle/rules.mjs?v=equipment-4slots-2';
import {readStoryStage} from '../story/chapter-one.mjs';

const frame=document.querySelector('#game-scene');
const opener=document.querySelector('#field-menu-toggle');
const backdrop=document.querySelector('#field-menu-backdrop');
const summary=document.querySelector('#field-menu-summary');
const commands=document.querySelector('#field-menu-commands');
const detail=document.querySelector('#field-menu-detail');
const message=document.querySelector('#field-menu-message');
const entries=[
  ['items','道具'], ['status','強さ'], ['settings','設定'],
  ['magic','術'], ['equipment','装備']
];
const commandColumns=3;
let selected=0,opened=false,pane='commands',detailIndex=0,actionIndex=0,selection=null,scenePad=null;
const el=(tag,txt)=>{const node=document.createElement(tag);node.textContent=txt;return node};
const activeButtons=()=>[...(pane==='commands'?commands:detail).querySelectorAll('button:not([disabled])')];
function isBattle(){return frame.src.includes('/src/game/battle/')}
function hide(){
  if(!opened)return;
  opened=false;backdrop.hidden=true;frame.style.pointerEvents='';
  if(scenePad)scenePad.style.removeProperty('visibility');
  scenePad=null;
  opener.textContent='メニュー';
  try{frame.contentWindow?.dispatchEvent(new Event('game-menu-close'))}catch{}
  opener.setAttribute('aria-expanded','false');
  if(!opener.hidden)opener.focus();
}
function show(){
  if(opened||isBattle()||opener.hidden||matchMedia('(orientation: portrait)').matches)return;
  try{frame.contentWindow?.dispatchEvent(new Event('blur'))}catch{}
  try{frame.contentWindow?.dispatchEvent(new Event('game-menu-open'))}catch{}
  opened=true;selected=0;pane='commands';detailIndex=0;selection=null;
  scenePad=frame.contentDocument?.getElementById('pad');
  if(scenePad)scenePad.style.visibility='hidden';
  frame.style.pointerEvents='none';backdrop.hidden=false;
  opener.textContent='閉じる';
  opener.setAttribute('aria-expanded','true');message.textContent='';
  render();activeButtons()[0]?.focus({preventScroll:true});
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
  const buttons=activeButtons();
  const index=pane==='commands'?selected:pane==='action'?actionIndex:detailIndex;
  for(const [i,button] of buttons.entries()){
    button.classList.toggle('menu-focus',i===index);
    button.setAttribute('aria-current',i===index?'true':'false');
    button.tabIndex=i===index?0:-1;
  }
}
function button(parent,label,callback){
  const node=el('button',label);
  node.type='button';
  node.addEventListener('click',callback);
  parent.append(node);
  return node;
}
function apply(outcome){
  if(outcome.accepted)savePlayer(outcome.player);
  window.KIKOKU_GAME?.audio?.se?.(outcome.accepted?'confirm':'cancel');
  pane='detail';
  selection=null;
  render();
  message.textContent=outcome.message;
}
function selectAction(item){
  selection=item;
  actionIndex=0;
  pane='action';
  render();
}
function addItem(list,item,index){
  button(list,item.label,()=>{
    detailIndex=index;
    message.textContent='';
    selectAction(item);
  });
}
function renderDetails(hero,id){
  const rows=[];
  if(id==='items'){
    for(const item of carriedConsumables(hero)){
      rows.push({
        label:item.name+' ×'+item.count, caption:'体力を'+item.heal+'回復', action:'使う',
        run:()=>apply(useExplorationResource(readPlayer(),item.kind,item.id))
      });
    }
    if(ARMORY_STOCK.some(item=>hero.equipmentInventory[item.id]&&hero.equipment[item.slot]!==item.id)){
      rows.push({label:'持っている兵具',caption:'装備を変更する',action:'装備を開く',run:()=>{
        selected=entries.findIndex(([key])=>key==='equipment');
        pane='detail';detailIndex=0;selection=null;render();
      }});
    }
    if(readStoryStage()!=='chief')rows.push({label:'結び札',caption:'里長から預かった札。'});
  }else if(id==='equipment'){
    const equippedList=document.createElement('dl');
    for(const [slot,label] of Object.entries(EQUIPMENT_SLOTS)){
      const current=hero.equipment[slot];
      const pair=document.createElement('div');
      pair.append(el('dt',label),el('dd',current?EQUIPMENT_ITEMS[current].name:'なし'));
      equippedList.append(pair);
      const owned=Object.values(EQUIPMENT_ITEMS).filter(item=>item.slot===slot&&hero.equipmentInventory[item.id]&&item.id!==current);
      const choices=[...owned,...(['head','feet'].includes(slot)&&current?[null]:[])];
      for(const item of choices){
        const id=item?.id??null;
        const next=equipmentPreview(hero,slot,id);
        const name=item?.name||'はずす';
        rows.push({
          label:label+'：'+name,
          caption:'攻撃 '+hero.attack+' → '+next.attack+'　守備 '+hero.defense+' → '+next.defense,
          action:'装備する',run:()=>apply(changeEquipment(readPlayer(),slot,id))
        });
      }
    }
    detail.append(equippedList);
  }else if(id==='magic'){
    rows.push({label:'つむぎ',caption:'技 5　体力を回復',action:'使う',run:()=>apply(useExplorationResource(readPlayer(),'heal'))});
    if(hero.lv>=3)rows.push({label:'糸遊',caption:'戦闘で使う術。'});
  }else if(id==='status'){
    const list=document.createElement('dl');
    for(const [key,value] of [['攻撃',hero.attack],['守備',hero.defense],['速さ',hero.speed],['心',hero.xp+'/'+nextLevelXp(hero.lv)]]){
      const pair=document.createElement('div');
      pair.append(el('dt',key),el('dd',String(value)));
      list.append(pair);
    }
    detail.append(list);
  }else if(id==='settings'){
    const audio=window.KIKOKU_GAME?.audio;
    if(audio)button(detail,'音声 '+(audio.enabled?'ON':'OFF'),()=>{audio.setEnabled(!audio.enabled);render()});
  }
  if(rows.length){
    const list=document.createElement('div');
    list.className='field-menu-list';
    rows.forEach((row,i)=>addItem(list,row,i));
    detail.append(list);
  }else if(id==='items')detail.append(el('p','道具を持っていない。'));
  else if(id==='equipment')detail.append(el('p','替えの兵具を持っていない。'));
}
function render(){
  const hero=readPlayer();
  const [id,name]=entries[selected];
  summary.textContent='緋月　'+hero.lv+'段　 体 '+hero.hp+'/'+hero.maxhp+'　 技 '+hero.mp+'/'+hero.maxmp+'　 '+hero.gold+'両';
  commands.hidden=pane!=='commands';
  detail.hidden=pane==='commands';
  commands.replaceChildren();
  detail.replaceChildren();
  if(pane==='commands'){
    for(const [index,[key,label]] of entries.entries()){
      button(commands,label,()=>openCommand(index)).dataset.menuCommand=key;
    }
  }else if(pane==='action'){
    detail.append(el('h2',selection.label),el('p',selection.caption));
    if(selection.run)button(detail,selection.action,selection.run);
    button(detail,'戻る',back);
  }else {
    detail.append(el('h2',name));
    renderDetails(hero,id);
    detailIndex=Math.min(detailIndex,Math.max(0,activeButtons().length-1));
  }
  updateCursor();
}
function openCommand(index){
  selected=index;
  detailIndex=0;
  pane='detail';
  message.textContent='';
  render();
}
function direction(dir){
  if(!opened)return;
  if(pane==='commands'){
    const column=selected%commandColumns;
    const rowStart=selected-column;
    const width=Math.min(commandColumns,entries.length-rowStart);
    if(dir==='right'||dir==='left'){
      selected=rowStart+(column+(dir==='right'?1:-1)+width)%width;
    }else{
      const next=selected<commandColumns?selected+commandColumns:selected-commandColumns;
      if(next<entries.length)selected=next;
    }
  }else{
    const buttons=activeButtons();
    if(!buttons.length)return;
    const horizontal=dir==='left'||dir==='right';
    const list=detail.querySelector('.field-menu-list');
    const columns=list&&getComputedStyle(list).gridTemplateColumns.split(' ').length===2?2:1;
    if(horizontal&&columns===1)return;
    const sign=dir==='up'||dir==='left'?-1:1;
    if(pane==='action')actionIndex=(actionIndex+sign+buttons.length)%buttons.length;
    else {
      const next=detailIndex+sign*(horizontal?1:columns);
      if(columns===1)detailIndex=(next+buttons.length)%buttons.length;
      else if(next>=0&&next<buttons.length&&(!horizontal||Math.floor(next/columns)===Math.floor(detailIndex/columns)))detailIndex=next;
      buttons[detailIndex].scrollIntoView({block:'nearest'});
    }
  }
  updateCursor();
}
function confirm(){
  if(!opened)return;
  const index=pane==='commands'?selected:pane==='action'?actionIndex:detailIndex;
  activeButtons()[index]?.click();
}
function back(){
  if(!opened)return;
  if(pane==='commands'){hide();return;}
  pane=pane==='action'?'detail':'commands';
  selection=null;
  message.textContent='';
  render();
}
opener.addEventListener('click',()=>opened?hide():show());
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
