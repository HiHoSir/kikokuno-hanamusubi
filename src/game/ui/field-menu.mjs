// Single parent-owned landscape command menu; neither scene iframe nor BGM is replaced.
// The on-screen D-pad/A/B is menu-local. Scene controls cannot receive input behind it.
import {
  ARMORY_STOCK, EQUIPMENT_ITEMS, EQUIPMENT_SLOTS, carriedConsumables,
  changeEquipment, equipmentPreview, nextLevelXp, readPlayer, savePlayer,
  useExplorationResource
} from '../battle/rules.mjs?v=equipment-4slots-2-cove-shells-1';
import {SHELL_KINDS} from '../items/shells.mjs';
import {readStoryStage} from '../story/chapter-one.mjs';
import {readManualGame,readAutoGame,manualSaveLabel} from '../save/save-game.mjs?v=save-slots-1';

const frame=document.querySelector('#game-scene');
const opener=document.querySelector('#field-menu-toggle');
const backdrop=document.querySelector('#field-menu-backdrop');
const summary=document.querySelector('#field-menu-summary');
const commands=document.querySelector('#field-menu-commands');
const detail=document.querySelector('#field-menu-detail');
const message=document.querySelector('#field-menu-message');
const entries=[
  ['items','道具'], ['status','強さ'], ['settings','設定'],
  ['magic','術'], ['equipment','装備'], ['record','記録']
];
const commandColumns=3;
const equipmentSlots=Object.entries(EQUIPMENT_SLOTS);
let selected=0,opened=false,pane='commands',detailIndex=0,actionIndex=0,selection=null,scenePad=null;
let equipmentSlotIndex=0,equipmentOptionIndex=0,equipmentFocus='slots',equipmentOptions=[];
const el=(tag,txt)=>{const node=document.createElement(tag);node.textContent=txt;return node};
const isEquipment=()=>pane==='detail'&&entries[selected][0]==='equipment';
const activeButtons=()=>{
  if(isEquipment())return [...detail.querySelectorAll(equipmentFocus==='slots'?'.equipment-slot-choice':'.equipment-gear-choice')];
  return [...(pane==='commands'?commands:detail).querySelectorAll('button:not([disabled])')];
};
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
  equipmentSlotIndex=0;equipmentOptionIndex=0;equipmentFocus='slots';
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
  const index=isEquipment()?(equipmentFocus==='slots'?equipmentSlotIndex:equipmentOptionIndex)
    :pane==='commands'?selected:pane==='action'?actionIndex:detailIndex;
  const focused=buttons[index];
  if(isEquipment()){
    for(const node of detail.querySelectorAll('.equipment-slot-choice,.equipment-gear-choice')){
      const active=node===focused;
      node.classList.toggle('menu-focus',active);
      node.setAttribute('aria-current',active?'true':'false');
      node.tabIndex=active?0:-1;
    }
    updateEquipmentPreview(readPlayer());
    return;
  }
  for(const [i,node] of buttons.entries()){
    node.classList.toggle('menu-focus',i===index);
    node.setAttribute('aria-current',i===index?'true':'false');
    node.tabIndex=i===index?0:-1;
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
// The equipment view stays on one screen: slots left, carried gear right.
function equipmentChoices(hero,slot){
  const owned=Object.values(EQUIPMENT_ITEMS).filter(item=>item.slot===slot&&hero.equipmentInventory[item.id]);
  return ['head','feet'].includes(slot)?[{id:null,name:'なし',attack:0,defense:0},...owned]:owned;
}
function updateEquipmentPreview(hero){
  const preview=detail.querySelector('.equipment-stat-preview');
  if(!preview)return;
  const [slot]=equipmentSlots[equipmentSlotIndex];
  const choice=equipmentOptions[equipmentOptionIndex];
  const comparing=equipmentFocus==='gear';
  const next=comparing&&choice?equipmentPreview(hero,slot,choice.id):null;
  const attack=next?.attack??hero.attack,defense=next?.defense??hero.defense;
  preview.replaceChildren();
  const heading=el('span',comparing?'変更後の能力':'現在の能力');
  heading.className='equipment-preview-heading';
  const atk=el('strong',comparing?'攻撃 '+hero.attack+' → '+attack:'攻撃 '+hero.attack);
  const def=el('strong',comparing?'守備 '+hero.defense+' → '+defense:'守備 '+hero.defense);
  if(comparing&&attack>hero.attack)atk.className='equipment-stat-up';
  if(comparing&&defense>hero.defense)def.className='equipment-stat-up';
  preview.append(heading,atk,def);
}
function renderEquipment(hero){
  const layout=document.createElement('div');
  layout.className='equipment-layout';
  const left=document.createElement('section'),right=document.createElement('section');
  left.className='equipment-panel';right.className='equipment-panel';
  left.append(el('h3','装備部位'));right.append(el('h3','所持している兵具'));
  const slotList=document.createElement('div'),gearList=document.createElement('div');
  slotList.className='equipment-slot-list';gearList.className='equipment-choice-list';
  const currentSlot=equipmentSlots[equipmentSlotIndex][0];
  equipmentOptions=equipmentChoices(hero,currentSlot);
  equipmentOptionIndex=Math.min(equipmentOptionIndex,Math.max(0,equipmentOptions.length-1));
  equipmentSlots.forEach(([slot,label],index)=>{
    const item=EQUIPMENT_ITEMS[hero.equipment[slot]];
    const node=button(slotList,'',()=>{
      equipmentSlotIndex=index;equipmentFocus='gear';
      const current=readPlayer();
      const choices=equipmentChoices(current,slot);
      const alternative=choices.findIndex(choice=>choice.id!==current.equipment[slot]);
      equipmentOptionIndex=Math.max(0,alternative);
      message.textContent='';render();
    });
    node.className='equipment-slot-choice';
    node.dataset.equipmentSlot=slot;
    node.classList.toggle('equipment-current-slot',slot===currentSlot);
    node.append(el('span',label),el('strong',item?.name||'なし'));
  });
  equipmentOptions.forEach((item,index)=>{
    const equipped=hero.equipment[currentSlot]===item.id;
    const bonus=item.attack?'攻撃 +'+item.attack:item.defense?'守備 +'+item.defense:'補正なし';
    const node=button(gearList,'',()=>{
      equipmentOptionIndex=index;equipmentFocus='gear';
      if(readPlayer().equipment[currentSlot]===item.id){
        message.textContent='現在装備している兵具です。';
        updateCursor();return;
      }
      apply(changeEquipment(readPlayer(),currentSlot,item.id));
    });
    node.className='equipment-gear-choice';
    node.dataset.equipmentId=item.id??'none';
    node.setAttribute('aria-pressed',equipped?'true':'false');
    node.append(el('span',item.name),el('small',equipped?'装備中':bonus));
  });
  left.append(slotList);right.append(gearList);
  layout.append(left,right);
  detail.append(layout);
  const preview=document.createElement('div');
  preview.className='equipment-stat-preview';
  preview.setAttribute('aria-label','装備変更後の能力値');
  detail.append(preview);
  const help=el('p','← → 部位と兵具の切替　A 決定　B 戻る');
  help.className='equipment-help';detail.append(help);
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
    for(const shell of Object.values(SHELL_KINDS)){
      const count=hero.shells?.bag?.[shell.id]??0;
      if(count)rows.push({
        label:shell.name+' ×'+count,caption:'茶店で1個'+shell.value+'両で売れる'
      });
    }
    if(ARMORY_STOCK.some(item=>hero.equipmentInventory[item.id]&&hero.equipment[item.slot]!==item.id)){
      rows.push({label:'持っている兵具',caption:'装備を変更する',action:'装備を開く',run:()=>{
        selected=entries.findIndex(([key])=>key==='equipment');
        pane='detail';detailIndex=0;selection=null;render();
      }});
    }
    if(readStoryStage()!=='chief')rows.push({label:'結び札',caption:'里長から預かった札。'});
    if(readStoryStage()==='forest')rows.push({
      label:'潮花の花びら',caption:'潮平が海の入り江で拾った、淡く光る花びら。'
    });
  }else if(id==='equipment'){
    renderEquipment(hero);
    return;
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
  }else if(id==='record'){
    const manual=readManualGame(),automatic=readAutoGame();
    const info=el('p',manual?'前回の記録　'+manualSaveLabel(manual):'手動セーブ　記録なし');
    detail.append(info);
    detail.append(el('p',automatic?'自動保存　'+manualSaveLabel(automatic):'自動保存　記録なし'));
    button(detail,manual?'記録を上書きする':'記録する',()=>{
      const result=window.KIKOKU_GAME?.manualSave?.()||
        {accepted:false,message:'現在地を取得できません。'};
      window.KIKOKU_GAME?.audio?.se?.(result.accepted?'confirm':'cancel');
      render();
      message.textContent=result.message;
    });
    detail.append(el('p','手動セーブと自動保存は別々に保持されます。'));
  }
  if(rows.length){
    const list=document.createElement('div');
    list.className='field-menu-list';
    rows.forEach((row,i)=>addItem(list,row,i));
    detail.append(list);
  }else if(id==='items')detail.append(el('p','道具を持っていない。'));

}
function render(){
  const hero=readPlayer();
  const [id,name]=entries[selected];
  summary.textContent='緋月　'+hero.lv+'段　 体 '+hero.hp+'/'+hero.maxhp+'　 技 '+hero.mp+'/'+hero.maxmp+'　 '+hero.gold+'両';
  commands.hidden=pane!=='commands';
  detail.hidden=pane==='commands';
  commands.replaceChildren();
  detail.replaceChildren();
  detail.classList.toggle('equipment-view',isEquipment());
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
  if(entries[index][0]==='equipment'){
    equipmentSlotIndex=0;equipmentOptionIndex=0;equipmentFocus='slots';
  }
  message.textContent='';
  render();
}
function direction(dir){
  if(!opened)return;
  if(isEquipment()){
    if(dir==='left'||dir==='right'){
      equipmentFocus=dir==='left'?'slots':'gear';
      updateCursor();
    }else if(equipmentFocus==='slots'){
      const count=equipmentSlots.length;
      equipmentSlotIndex=(equipmentSlotIndex+(dir==='up'?-1:1)+count)%count;
      equipmentOptionIndex=0;
      render();
    }else{
      const count=equipmentOptions.length;
      if(count)equipmentOptionIndex=(equipmentOptionIndex+(dir==='up'?-1:1)+count)%count;
      updateCursor();
    }
    activeButtons()[equipmentFocus==='slots'?equipmentSlotIndex:equipmentOptionIndex]
      ?.scrollIntoView({block:'nearest'});
    return;
  }
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
  const index=isEquipment()?(equipmentFocus==='slots'?equipmentSlotIndex:equipmentOptionIndex)
    :pane==='commands'?selected:pane==='action'?actionIndex:detailIndex;
  activeButtons()[index]?.click();
}
function back(){
  if(!opened)return;
  if(pane==='commands'){hide();return;}
  if(isEquipment()&&equipmentFocus==='gear'){
    equipmentFocus='slots';message.textContent='';updateCursor();return;
  }
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
