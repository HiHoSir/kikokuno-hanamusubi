import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as rules from '../src/game/battle/rules.mjs';
import {SHELL_KINDS} from '../src/game/items/shells.mjs';

const source=readFileSync('src/game/ui/field-menu.mjs','utf8')
 .replace(/import \{[\s\S]*?\} from '\.\.\/battle\/rules\.mjs\?v=[^']+';\n/,'')
 .replace(/import \{SHELL_KINDS\} from '\.\.\/items\/shells\.mjs';\n/,'')
 .replace(/import \{readStoryStage\} from '\.\.\/story\/chapter-one\.mjs';\n/,'')
 .replace(/import \{readManualGame,readAutoGame,manualSaveLabel\} from '\.\.\/save\/save-game\.mjs\?v=[^']+';\n/,'');
if(source.includes('import {'))throw Error('Unable to isolate field menu for DOM interaction test');

function makeNode(tag='div'){
 const node={
  tagName:tag.toUpperCase(),children:[],dataset:{},attributes:{},className:'',style:{removeProperty(){}},
  textValue:'',hidden:false,disabled:false,listeners:{},
  set textContent(value){this.textValue=String(value);this.children=[];},
  get textContent(){return this.textValue+this.children.map(x=>x.textContent).join('');},
  append(...children){this.children.push(...children);},
  replaceChildren(...children){this.children=[...children];this.textValue='';},
  setAttribute(key,val){this.attributes[key]=String(val);},
  getAttribute(key){return this.attributes[key];},
  addEventListener(event,listener){this.listeners[event]=listener;},
  click(){this.listeners.click?.({target:this});},
  focus(){},
  scrollIntoView(){},
  querySelectorAll(selector){
   const selectors=selector.split(',').map(x=>x.trim());
   const matches=(child,rule)=>{
    if(rule==='button:not([disabled])')return child.tagName==='BUTTON'&&!child.disabled;
    if(rule==='[data-menu-dir]')return !!child.dataset.menuDir;
    if(rule.startsWith('.'))return child.className.split(/\s+/).includes(rule.slice(1));
    if(rule.startsWith('#'))return child.id===rule.slice(1);
    return false;
   };
   const result=[];
   function visit(parent){for(const child of parent.children){
    if(selectors.some(s=>matches(child,s)))result.push(child);
    visit(child);
   }}
   visit(this);return result;
  },
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
 };
 node.classList={
  toggle(name,force){
   const classes=new Set(node.className.split(/\s+/).filter(Boolean));
   const enabled=force===undefined?!classes.has(name):Boolean(force);
   if(enabled)classes.add(name);else classes.delete(name);
   node.className=[...classes].join(' ');return enabled;
  },
  contains(name){return node.className.split(/\s+/).includes(name);}
 };
 return node;
}
function createMenu(player){
 const storage=new Map();
 const adapter={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 rules.savePlayer(player,adapter);
 const roots={};
 for(const id of ['game-scene','field-menu-toggle','field-menu-backdrop',
   'field-menu-summary','field-menu-commands','field-menu-detail','field-menu-message'])
   roots['#'+id]=makeNode();
 const frame=roots['#game-scene'];
 frame.src='https://example.test/kikokuno-hanamusubi/src/game/village/';
 frame.contentWindow={dispatchEvent(){},addEventListener(){}};
 frame.contentDocument={getElementById:()=>makeNode()};
 const backdrop=roots['#field-menu-backdrop'];
 for(const direction of ['up','down','left','right']){
  const node=makeNode('button');node.dataset.menuDir=direction;backdrop.append(node);
 }
 const accept=makeNode('button');accept.id='field-menu-action-a';backdrop.append(accept);
 const cancel=makeNode('button');cancel.id='field-menu-action-b';backdrop.append(cancel);
 const document={
  querySelector:selector=>roots[selector],createElement:makeNode,
  listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}
 };
 const window={KIKOKU_GAME:{audio:{se(){}}}};
 const context={document,window,Event:class{constructor(name){this.type=name;}},
  matchMedia:()=>({matches:false}),getComputedStyle:()=>({gridTemplateColumns:'100px'}),
  readPlayer:()=>rules.readPlayer(adapter),savePlayer:p=>rules.savePlayer(p,adapter),
  carriedConsumables:rules.carriedConsumables,SHELL_KINDS,ARMORY_STOCK:rules.ARMORY_STOCK,
  EQUIPMENT_ITEMS:rules.EQUIPMENT_ITEMS,EQUIPMENT_SLOTS:rules.EQUIPMENT_SLOTS,
  equipmentPreview:rules.equipmentPreview,changeEquipment:rules.changeEquipment,
  useExplorationResource:rules.useExplorationResource,nextLevelXp:rules.nextLevelXp,
  readStoryStage:()=> 'chief'};
 runInNewContext(source,context);
 roots['#field-menu-toggle'].click();
 roots['#field-menu-commands'].children.find(x=>x.dataset.menuCommand==='equipment').click();
 return {roots,document,readPlayer:()=>rules.readPlayer(adapter),accept,cancel,
   direction:dir=>backdrop.children.find(x=>x.dataset.menuDir===dir).click()};
}

test('four equipment slots and owned gear share one view; a tap equips without a confirmation pane',()=>{
 let hero={...rules.DEFAULT_PLAYER,gold:200};
 for(const id of ['wakizashi','padded-body','headband','tabi'])
  hero=rules.purchaseArmory(hero,id).player;
 const ui=createMenu(hero);
 const detail=ui.roots['#field-menu-detail'];
 assert.equal(detail.querySelectorAll('.equipment-slot-choice').length,4);
 assert.deepEqual(detail.querySelectorAll('.equipment-slot-choice').map(x=>x.dataset.equipmentSlot),
  ['weapon','body','head','feet']);
 assert.equal(detail.querySelectorAll('.equipment-gear-choice').length,2);
 detail.querySelectorAll('.equipment-slot-choice')[0].click();
 const wakizashi=detail.querySelectorAll('.equipment-gear-choice').find(x=>x.dataset.equipmentId==='wakizashi');
 assert.ok(wakizashi);
 assert.match(detail.querySelector('.equipment-stat-preview').textContent,/攻撃 9 → 13/);
 wakizashi.click();
 assert.equal(ui.readPlayer().equipment.weapon,'wakizashi');
 assert.equal(ui.readPlayer().attack,13);
 assert.equal(detail.querySelectorAll('.equipment-slot-choice').length,4,'stay in the equipment screen');
 detail.querySelectorAll('.equipment-slot-choice')[2].click();
 detail.querySelectorAll('.equipment-gear-choice').find(x=>x.dataset.equipmentId==='headband').click();
 assert.equal(ui.readPlayer().equipment.head,'headband');
 assert.equal(ui.readPlayer().defense,8);
 ui.cancel.click(); // gear -> slot side
 assert.equal(detail.querySelectorAll('.equipment-slot-choice').length,4);
 ui.cancel.click(); // slot side -> command menu
 assert.ok(ui.roots['#field-menu-commands'].children.some(x=>x.dataset.menuCommand==='equipment'));
});

test('D-pad navigates slots and gear; empty head and feet remain visible and unequipped',()=>{
 const ui=createMenu(rules.DEFAULT_PLAYER),detail=ui.roots['#field-menu-detail'];
 assert.equal(detail.querySelectorAll('.equipment-slot-choice').length,4);
 ui.direction('down');
 assert.equal(detail.querySelectorAll('.equipment-slot-choice')[1].classList.contains('menu-focus'),true);
 ui.direction('down');
 assert.equal(detail.querySelectorAll('.equipment-slot-choice')[2].classList.contains('menu-focus'),true);
 ui.direction('right');
 assert.equal(detail.querySelectorAll('.equipment-gear-choice').length,1);
 assert.equal(detail.querySelectorAll('.equipment-gear-choice')[0].dataset.equipmentId,'none');
 ui.accept.click();
 assert.equal(ui.readPlayer().equipment.head,null);
 assert.match(ui.roots['#field-menu-message'].textContent,/装備している/);
 ui.direction('left');
 assert.equal(detail.querySelectorAll('.equipment-slot-choice')[2].classList.contains('menu-focus'),true);
});

test('landscape equipment has separate compact columns and clear focus affordance',()=>{
 const css=readFileSync('src/game/ui/field-menu.css','utf8');
 const game=readFileSync('src/game/index.html','utf8');
 assert.match(css,/\.equipment-layout\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) minmax\(0,1\.14fr\)/);
 assert.match(css,/\.equipment-slot-choice\.menu-focus/);
 assert.match(css,/\.equipment-stat-preview/);
 assert.match(css,/@media\(orientation:landscape\) and \(max-height:420px\)/);
 assert.match(game,/field-menu\.css\?v=equipment-ui-1/);
 assert.match(game,/field-menu\.mjs\?v=save-slots-1/);
});
