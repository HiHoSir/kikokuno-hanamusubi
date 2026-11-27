import '../data/maps/field/terrain.js';
import {
 FIELD_ENCOUNTER_PLAN,FIELD_ENCOUNTER_PLAN_ENEMIES,
 FIELD_ENCOUNTER_PLAN_MARKERS,FIELD_ENCOUNTER_PLANNED_MARKERS
} from '../data/maps/field/encounter-plan.mjs?v=6';
import {FIELD_ENCOUNTER_BALANCE_DRAFT} from '../data/maps/field/encounter-balance-draft.mjs?v=8';
import {addBattleTrial,HOZUKI_TRIAL_KIT,TIDE_TRIAL_KIT,REGIONAL_TRIAL_REFERENCES} from './field-encounter-trial.mjs?v=5';

document.title='敵分布案｜鬼哭の花結び';
const style=document.createElement('style');
style.textContent=`:root{color-scheme:dark;background:#12232a;color:#fff3da;font:15px/1.65 system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;padding:clamp(12px,3vw,28px)}
main{max-width:1060px;margin:auto}
h1{font-size:clamp(24px,4vw,36px);margin:0 0 3px}
h2{margin:0 0 10px;font-size:22px}
h3{font-size:16px;margin:0}
p{margin:0 0 10px}
.layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,0.65fr);gap:16px;align-items:start}
.map{width:100%;display:block;background:#183342;border:1px solid #476269;border-radius:8px}
aside{background:#1b3237;border:1px solid #446066;border-radius:8px;padding:14px}
nav{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
button{border:1px solid #6e8584;border-radius:6px;background:#263d42;color:inherit;min-height:38px;padding:4px 8px;font:inherit;font-size:.85rem}
button[aria-pressed=true]{border-color:var(--zone);box-shadow:inset 0 -2px var(--zone)}
article+article{border-top:1px solid #4c6363;margin-top:12px;padding-top:12px}
.enemies{display:flex;gap:10px;flex-wrap:wrap}
.enemy{display:grid;grid-template-rows:66px auto;width:70px;text-align:center;font-size:.75rem}
.concept-enemy{display:flex;flex-direction:column-reverse;justify-content:start;width:140px;text-align:left}
.concept-enemy span{font-weight:700}
.concept-enemy p{margin:0}
.encounter-location{margin-top:8px}
.encounter-location small{display:block;margin-top:4px;color:#cbd4cc}
.enemy img[data-pixel-art],.trial-portraits img[data-pixel-art]{image-rendering:pixelated}
.enemy img{width:100%;height:100%;object-fit:contain}
table{width:100%;margin-top:12px;border-collapse:collapse;font-size:.8rem}
caption{text-align:left;color:#d7d8b8}
th,td{padding:3px 4px;border-bottom:1px solid #496067;text-align:right}
th:first-child{text-align:left}
.note{color:#cbd4cc;margin:0 0 14px}
.trial-buttons,.trial-commands{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.trial-battle{background:#172e35;color:#fff3da;border:1px solid #7c9999;border-radius:8px;
 width:min(520px,calc(100% - 24px));max-height:calc(100% - 24px);padding:16px}
.trial-battle::backdrop{background:#07161be5}
.trial-battle select{font:inherit;max-width:100%}
.trial-portraits{display:flex;justify-content:center;gap:12px;text-align:center;margin-top:8px}
.trial-portraits img{width:clamp(72px,24vw,144px);height:clamp(72px,24vw,144px);object-fit:contain}
.trial-status{font-weight:700}
.trial-log{padding-left:22px;background:#11242a;border-radius:4px;min-height:70px;padding-block:5px}
.trial-battle button:disabled{opacity:.45}
@media(max-width:620px){.layout{grid-template-columns:1fr}.map{max-height:55svh}}`;
document.head.append(style);
document.body.innerHTML=`<main>
<h1>フィールドの敵分布案</h1>
<p class="note">区間を選ぶと、敵候補と出方を確認できます。</p>
<div class="layout">
 <section>
  <svg class="map" id="map" viewBox="0 0 800 800" role="img" aria-label="花霞野のフィールドに敵の分布区間を重ねた地図"></svg>
  <p class="note">● 追加敵の出現地　◆ 地上の入口案　破線 山越えの洞窟　× 塞ぐ迂回路</p>
 </section>
 <aside>
  <nav id="zones" aria-label="敵の分布区間"></nav>
  <div id="details" aria-live="polite"></div>
 </aside>
</div>
</main>`;

const {tiles,referenceComposition}=window.YK_FIELD_TERRAIN;
const places={...referenceComposition.places,shiomachi:[53,51],kozuene:[56,35]};
const colors={sea:'#17384c',river:'#306482',sand:'#9b8b66',grass:'#576f56',
 road:'#576f56',bridge:'#a68152',forest:'#2c4c3d',mountain:'#4a4e4b'};
const map=document.querySelector('#map');
const zones=document.querySelector('#zones');
const details=document.querySelector('#details');
const svgNs='http://www.w3.org/2000/svg';

function shape(parent,tag,attributes,label){
 const node=document.createElementNS(svgNs,tag);
 for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);
 if(label)node.textContent=label;
 parent.append(node);
 return node;
}
function element(tag,text,parent){
 const node=document.createElement(tag);
 if(text)node.textContent=text;
 parent.append(node);
 return node;
}
const center=n=>10*n+5;
const terrain=shape(map,'g',{'shape-rendering':'crispEdges'});
for(const [y,row] of tiles.entries()){
 for(let x=0;x<row.length;){
  let end=x+1;
  while(end<row.length&&colors[row[end]]===colors[row[x]])end++;
  shape(terrain,'rect',{x:x*10,y:y*10,width:(end-x)*10,height:10,fill:colors[row[x]]});
  x=end;
 }
}

const paths=new Map();
for(const zone of FIELD_ENCOUNTER_PLAN){
 const route=shape(map,'g',{'data-zone':zone.id,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'});
 paths.set(zone.id,route);
 for(const section of zone.sections){
  const roads=(section.roadIndices??[]).map(index=>referenceComposition.roads[index]);
  for(const path of [...roads,...section.paths]){
   const points=path.map(([x,y])=>`${center(x)},${center(y)}`).join(' ');
   shape(route,'polyline',{points,stroke:'#172a2a','stroke-width':13});
   const attrs={points,stroke:zone.color,'stroke-width':7};
   if(zone.tunnel)attrs['stroke-dasharray']='12 9';
   shape(route,'polyline',attrs);
  }
 }
}

for(const [x,y] of [[36,35],[39,23],[49,18]]){
 shape(map,'text',{x:center(x),y:center(y)+7,'text-anchor':'middle',
   fill:'#ffae9d',stroke:'#263838','stroke-width':3,'paint-order':'stroke','font-size':26},'×');
}
const markers=[
 ...Object.entries(FIELD_ENCOUNTER_PLAN_MARKERS).map(([id,name])=>({name,point:places[id]})),
 ...FIELD_ENCOUNTER_PLANNED_MARKERS.map(marker=>({...marker,planned:true}))
];
for(const {name,point:[tx,ty],planned} of markers){
 const x=center(tx),y=center(ty);
 const marker={fill:'#fff3d8',stroke:'#172d32','stroke-width':2};
 if(planned)shape(map,'path',{...marker,d:`M${x} ${y-8} l8 8 -8 8 -8 -8 Z`});
 else shape(map,'circle',{...marker,cx:x,cy:y,r:6});
 const left=name==='梢音村'||name==='洞窟 西口'||name==='龍神の滝';
 shape(map,'text',{x:x+(left?-10:10),y:y+(name==='忘れの森'?18:-9),
   'text-anchor':left?'end':'start',fill:'#fff5dc',stroke:'#172d32',
   'stroke-width':5,'paint-order':'stroke','font-weight':700,'font-size':20},name);
}
const encounterPins=new Map();
const pinLayer=shape(map,'g',{'aria-hidden':'true'});
for(const zone of FIELD_ENCOUNTER_PLAN){
 const pins=shape(pinLayer,'g',{'data-encounter-zone':zone.id});
 encounterPins.set(zone.id,pins);
 for(const {formations} of zone.sections){
  for(const id of formations){
   const {name,distribution}=FIELD_ENCOUNTER_PLAN_ENEMIES[id];
   if(!distribution?.point)continue;
   const [x,y]=distribution.point;
   const pin=shape(pins,'circle',{cx:center(x),cy:center(y),r:6,
    fill:zone.color,stroke:'#fff3d8','stroke-width':2,'data-enemy':id});
   shape(pin,'title',{},name+'　'+distribution.habitat);
  }
 }
}
const buttons=FIELD_ENCOUNTER_PLAN.map(zone=>{
 const button=element('button',zone.title,zones);
 button.type='button';
 button.style.setProperty('--zone',zone.color);
 button.addEventListener('click',()=>select(zone));
 return button;
});
const tierReference=(lv,equipmentTier)=>({
 label:`${lv}段・${equipmentTier}相当の設計値`,player:{lv,equipmentTier}
});
const zoneReference={
 bridge:{label:'12段・潮待村の装備4点',player:{...TIDE_TRIAL_KIT,lv:12}},
 waterfall:tierReference(25,'T5'),tunnel:tierReference(26,'T5'),
 ridge:tierReference(28,'T5'),fox:tierReference(30,'T6')
};
const coastReference={label:'3段・鬼灯村の装備4点',player:{...HOZUKI_TRIAL_KIT,lv:3}};
const pairs=new Set(['forest-spider','cove-jelly','tunnel-bat']);
function select(zone){
 for(const [index,button] of buttons.entries()){
  const id=FIELD_ENCOUNTER_PLAN[index].id;
  button.setAttribute('aria-pressed',String(id===zone.id));
  paths.get(id).setAttribute('opacity',id===zone.id?'1':'.42');
  encounterPins.get(id).setAttribute('display',id===zone.id?'inline':'none');
 }
 details.replaceChildren();
 element('h2',zone.title,details);
 for(const section of zone.sections){
  const article=element('article',null,details);
  element('h3',section.name,article);
  element('p',section.detail,article);
  if(!section.formations.length)continue;
  const list=element('div',null,article);
  list.className='enemies';
  for(const id of section.formations){
   const enemy=FIELD_ENCOUNTER_PLAN_ENEMIES[id];
   const tile=element('div',null,list);
   tile.className='enemy';
   if(enemy.asset){
    const image=element('img',null,tile);
    image.src=new URL('../'+enemy.asset,import.meta.url);
    image.alt='';
    if(enemy.pixelArt)image.dataset.pixelArt='';
    if(enemy.filter)image.style.filter=enemy.filter;
   }else{
    tile.classList.add('concept-enemy');
    element('p',enemy.concept,tile);
   }
   element('span',enemy.name,tile);
  }
  for(const id of section.formations){
   const {name,distribution,technique}=FIELD_ENCOUNTER_PLAN_ENEMIES[id];
   if(!distribution)continue;
   const location=element('p',null,article);
   location.className='encounter-location';
   element('strong',name,location);
   location.append('　'+distribution.habitat+'・'+distribution.count+'体');
   if(technique)element('small','技案（試戦では未使用）　'+technique,location);
  }
  if(section.balance){
   for(const id of section.balance){
    const reference=REGIONAL_TRIAL_REFERENCES[id]??(id.startsWith('cove-')?coastReference:zoneReference[zone.id]);
    if(id.startsWith('early-')||(zone.id!=='forest'&&!reference))continue;
    const enemy=FIELD_ENCOUNTER_BALANCE_DRAFT[id];
    const host=element('div',null,article);
    host.className='trial-buttons';
    host.setAttribute('role','group');
    host.setAttribute('aria-label',enemy.name);
    const trial={host,enemy,portrait:FIELD_ENCOUNTER_PLAN_ENEMIES[enemy.enemy],element,
     deep:id.startsWith('forest-'),reference};
    element('strong',enemy.name,host);
    addBattleTrial({...trial,count:trial.portrait.distribution?.count??1});
    if(pairs.has(id))addBattleTrial({...trial,count:2});
   }
  }
  if(section.balance){
   const table=element('table',null,article);
   element('caption','敵1体あたり（本編未登場の敵は試算値）',table);
   const header=element('tr',null,element('thead',null,table));
   for(const label of ['敵','体力','攻','守','心','両'])element('th',label,header).scope='col';
   const body=element('tbody',null,table);
   for(const id of section.balance){
    const enemy=FIELD_ENCOUNTER_BALANCE_DRAFT[id];
    const row=element('tr',null,body);
    element('th',enemy.name,row).scope='row';
    for(const field of ['hp','attack','defense','xp','gold'])
     element('td',String(enemy[field]),row);
   }
  }
 }
}
select(FIELD_ENCOUNTER_PLAN.find(zone=>zone.id==='bridge'));
