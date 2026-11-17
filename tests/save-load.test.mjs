import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {DEFAULT_PLAYER,PLAYER_KEY,savePlayer,readPlayer,FIELD_RETURN_KEY,BATTLE_REQUEST_KEY} from '../src/game/battle/rules.mjs';
import {coveVisibleShells,collectCoveShell,sellCoveShells} from '../data/maps/sea-cove/shells.mjs';
import {readStoryStage,advanceStoryStage,CHAPTER_ONE_KEY} from '../src/game/story/chapter-one.mjs';
import {
  AUTO_SAVE_KEY,MANUAL_SAVE_KEY,RESTORE_POSITION_KEY,
  readManualGame,readAutoGame,saveManualGame,saveAutoGame,
  restoreSavedGame,routeForSavedGame,consumeRestorePosition,
  pendingRestoreLocation,startNewGame,manualSaveLabel
} from '../src/game/save/save-game.mjs';

const makeStorage=()=>{
 const values=new Map();
 return {
  getItem:key=>values.get(key)??null,
  setItem:(key,value)=>{values.set(key,String(value));},
  removeItem:key=>values.delete(key),
  has:key=>values.has(key)
 };
};
test('manual save and autosave stay independent, including story, inventory and position',()=>{
 const storage=makeStorage(),session=makeStorage();
 const manualTime=Date.parse('2026-11-17T00:00:00Z');
 const autoTime=Date.parse('2026-11-17T00:03:00Z');
 savePlayer({...DEFAULT_PLAYER,lv:3,hp:12,gold:75,foods:{onigiri:2}},storage);
 advanceStoryStage('shrine',storage);
 const first=saveManualGame({scene:'village',position:{x:520,y:430,face:2}},storage,()=>manualTime);
 assert.equal(first.accepted,true);
 const before=storage.getItem(MANUAL_SAVE_KEY);
 savePlayer({...readPlayer(storage),hp:6,gold:122},storage);
 advanceStoryStage('cove',storage);
 const auto=saveAutoGame({scene:'field',position:{x:640,y:704,row:3}},storage,()=>autoTime);
 assert.equal(auto.accepted,true);
 assert.equal(storage.getItem(MANUAL_SAVE_KEY),before,'autosave cannot overwrite a manual slot');
 assert.ok(storage.getItem(AUTO_SAVE_KEY));
 assert.equal(readManualGame(storage).player.hp,12);
 assert.equal(readManualGame(storage).story,'shrine');
 assert.equal(readAutoGame(storage).player.hp,6);
 assert.equal(readAutoGame(storage).story,'cove');
 assert.equal(readAutoGame(storage).location.position.row,3);
 assert.match(manualSaveLabel(readAutoGame(storage)),/花霞野/);

 savePlayer({...DEFAULT_PLAYER,lv:1,gold:0},storage);
 const manual=restoreSavedGame('manual',storage,session);
 assert.equal(manual.accepted,true);
 assert.equal(readPlayer(storage).lv,3);
 assert.equal(readPlayer(storage).hp,12);
 assert.equal(readPlayer(storage).gold,75);
 assert.equal(readPlayer(storage).foods.onigiri,2);
 assert.equal(readStoryStage(storage),'shrine');
 assert.deepEqual(pendingRestoreLocation(session),{
  scene:'village',position:{x:520,y:430,face:2}
 });
 assert.equal(consumeRestorePosition('field',session),null,'wrong scene must not consume another position');
 assert.deepEqual(consumeRestorePosition('village',session),{x:520,y:430,face:2});
 assert.equal(pendingRestoreLocation(session),null);

 const automatic=restoreSavedGame('auto',storage,session);
 assert.equal(automatic.accepted,true);
 assert.equal(readPlayer(storage).hp,6);
 assert.equal(readPlayer(storage).gold,122);
 assert.equal(readStoryStage(storage),'cove');
 assert.deepEqual(consumeRestorePosition('field',session),{x:640,y:704,row:3});
 assert.equal(storage.getItem(MANUAL_SAVE_KEY),before);
});
test('new game resets only live state, while retaining both saved slots',()=>{
 const storage=makeStorage(),session=makeStorage();
 savePlayer({...DEFAULT_PLAYER,gold:35},storage);
 advanceStoryStage('shrine',storage);
 saveManualGame({scene:'interiors',building:'house-southeast-tile',position:{x:368,y:410,face:0}},storage);
 saveAutoGame({scene:'tenyo',position:{x:11,y:20,face:1}},storage);
 session.setItem(FIELD_RETURN_KEY,'old-battle');
 session.setItem(BATTLE_REQUEST_KEY,'old-encounter');
 session.setItem(RESTORE_POSITION_KEY,'old-restore');
 assert.equal(startNewGame(storage,session).accepted,true);
 assert.equal(readPlayer(storage).gold,0);
 assert.equal(readStoryStage(storage),'chief');
 assert.ok(readManualGame(storage));
 assert.ok(readAutoGame(storage));
 assert.equal(session.getItem(FIELD_RETURN_KEY),null);
 assert.equal(session.getItem(BATTLE_REQUEST_KEY),null);
 assert.equal(session.getItem(RESTORE_POSITION_KEY),null);
});
test('checkpoint routes are restricted and corrupt or absent saves remain unusable',()=>{
 const storage=makeStorage(),session=makeStorage();
 assert.equal(restoreSavedGame('auto',storage,session).accepted,false);
 const bad=saveManualGame({scene:'field',position:{x:NaN,y:0}},storage);
 assert.equal(bad.accepted,false);
 assert.equal(storage.getItem(MANUAL_SAVE_KEY),null);
 storage.setItem(AUTO_SAVE_KEY,'{');
 assert.equal(readAutoGame(storage),null);
 storage.removeItem(AUTO_SAVE_KEY);
 saveManualGame({scene:'interiors',building:'house-southeast-tile',
  position:{x:352,y:390,face:1}},storage);
 const url=routeForSavedGame(readManualGame(storage),'https://example.test/kikokuno-hanamusubi/');
 assert.equal(url.pathname,'/kikokuno-hanamusubi/src/game/interiors/');
 assert.equal(url.searchParams.get('building'),'house-southeast-tile');
 assert.equal(restoreSavedGame('other',storage,session).accepted,false);
 session.setItem(RESTORE_POSITION_KEY,JSON.stringify({
  scene:'evil',position:{x:1,y:1}
 }));
 assert.equal(consumeRestorePosition('evil',session),null);
 assert.equal(session.getItem(RESTORE_POSITION_KEY),null);
});
test('save write failures do not destroy the other slot or invent a checkpoint',()=>{
 const storage=makeStorage();
 const session=makeStorage();
 saveManualGame({scene:'village',position:{x:100,y:200}},storage);
 const badStorage={getItem:storage.getItem,setItem(){throw Error('quota');}};
 assert.equal(saveAutoGame({scene:'field',position:{x:32,y:32}},badStorage).accepted,false);
 assert.ok(readManualGame(storage));
 assert.equal(readAutoGame(storage),null);
 assert.equal(restoreSavedGame('auto',storage,session).accepted,false);
});
test('title continue opens distinct selectable manual and automatic checkpoints',()=>{
 const title=readFileSync('src/title/title.js','utf8');
 const source=title.replace(/^import \{[\s\S]*?\} from '\.\.\/game\/save\/save-game\.mjs\?v=save-slots-1';\s*/,'')
  .replaceAll('import.meta.url',JSON.stringify('https://example.test/kikokuno-hanamusubi/src/title/title.js'));
 assert.ok(!source.includes('import {'),'title VM script retained an import');
 function node(tag='div'){
  const obj={tagName:tag.toUpperCase(),children:[],events:{},dataset:{},hidden:false,
    disabled:false,textContent:'',href:'',
    addEventListener(event,cb){this.events[event]=cb;},
    append(...x){this.children.push(...x);},
    replaceChildren(...x){this.children=[...x];},
    querySelector(selector){return this.children.find(x=>x.tagName==='BUTTON'&&!x.disabled)??null;},
    focus(){},click(){this.events.click?.({defaultPrevented:false,button:0,
      metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,
      preventDefault(){},currentTarget:this});}
  };
  return obj;
 }
 const selectors=['.title-start','#title-continue','#title-load','#title-load-slots',
  '#title-load-message','#title-load-back','.title-menu','.title-home',
  '.title-demo','#show-demo','#demo-image','#demo-name',
  '#next-scene','#close-demo'];
 const nodes=Object.fromEntries(selectors.map(k=>[k,node()]));
 nodes['.title-start'].href='https://example.test/kikokuno-hanamusubi/src/opening/';
 const calls=[];
 const manual={savedAt:'2026-11-17T00:00:00Z',location:{scene:'village'},player:{lv:2,gold:25}};
 const auto={savedAt:'2026-11-17T00:03:00Z',location:{scene:'field'},player:{lv:3,gold:29}};
 const context={
  document:{baseURI:'https://example.test/kikokuno-hanamusubi/',
    querySelector:key=>nodes[key],createElement:node,addEventListener(){}},
  window:{KIKOKU_ROUTE:{go:url=>calls.push(url)}},URL,Intl,Date,
  readManualGame:()=>manual,readAutoGame:()=>auto,
  restoreSavedGame:slot=>({accepted:true,slot}),
  startNewGame:()=>({accepted:true}),
  manualSaveLabel:save=>save.location.scene+' '+save.player.lv
 };
 runInNewContext(source,context);
 const cont=nodes['#title-continue'];
 assert.equal(cont.disabled,false);
 cont.click();
 assert.equal(nodes['.title-menu'].hidden,true);
 assert.equal(nodes['#title-load'].hidden,false);
 const slots=nodes['#title-load-slots'].children;
 assert.deepEqual(slots.map(x=>x.dataset.saveSlot),['manual','auto']);
 assert.ok(slots[0].children[0].textContent.includes('手動'));
 assert.ok(slots[1].children[0].textContent.includes('自動'));
 slots[1].click();
 assert.match(String(calls.at(-1)),/src\/game\/\?build=save-slots-1/);
 nodes['#title-load-back'].click();
 assert.equal(nodes['.title-menu'].hidden,false);
 assert.match(readFileSync('index.html','utf8'),/id="title-continue"/);
});

test('manual/auto saves restore gathered cove shells and money without double credit',()=>{
 const storage=makeStorage(),session=makeStorage();
 const before=savePlayer({...DEFAULT_PLAYER,completedBattles:4},storage);
 const deposited=savePlayer({...before,completedBattles:5},storage);
 assert.ok(deposited.shells.onBeach.length>=1);
 const shell=coveVisibleShells(deposited)[0];
 const picked=collectCoveShell(deposited,shell.id,shell.x,shell.y);
 assert.equal(picked.accepted,true);
 const carrying=savePlayer(picked.player,storage);
 assert.equal(carrying.shells.bag[shell.kind],1);
 assert.equal(saveManualGame({scene:'cove',position:{x:shell.x,y:shell.y,face:2}},storage).accepted,true);
 const sold=sellCoveShells(readPlayer(storage));
 assert.equal(sold.accepted,true);
 savePlayer(sold.player,storage);
 assert.equal(saveAutoGame({scene:'village',position:{x:520,y:430,face:1}},storage).accepted,true);
 assert.equal(readPlayer(storage).shells.bag[shell.kind],0);
 assert.equal(restoreSavedGame('manual',storage,session).accepted,true);
 const restored=readPlayer(storage);
 assert.equal(restored.gold,0);
 assert.equal(restored.shells.bag[shell.kind],1);
 assert.ok(!coveVisibleShells(restored).some(s=>s.id===shell.id),
   'collected shell must not reappear after manual restore');
 assert.equal(restoreSavedGame('auto',storage,session).accepted,true);
 const afterSale=readPlayer(storage);
 assert.equal(afterSale.gold,sold.amount);
 assert.equal(afterSale.shells.bag[shell.kind],0);
 assert.equal(sellCoveShells(afterSale).accepted,false);
 assert.equal(startNewGame(storage,session).accepted,true);
 assert.equal(readPlayer(storage).shells.onBeach.length,0);
 assert.equal(readPlayer(storage).shells.bag[shell.kind],0);
});
