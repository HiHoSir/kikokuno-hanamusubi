import {
 FIELD_ENCOUNTER_PLAN,FIELD_ENCOUNTER_PLAN_ENEMIES,
 FIELD_ENCOUNTER_PLAN_MARKERS,FIELD_ENCOUNTER_PLANNED_MARKERS
} from '../../data/maps/field/encounter-plan.mjs?v=1';

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
const buttons=FIELD_ENCOUNTER_PLAN.map(zone=>{
 const button=element('button',zone.title,zones);
 button.type='button';
 button.style.setProperty('--zone',zone.color);
 button.addEventListener('click',()=>select(zone));
 return button;
});
function select(zone){
 for(const [index,button] of buttons.entries()){
  const id=FIELD_ENCOUNTER_PLAN[index].id;
  button.setAttribute('aria-pressed',String(id===zone.id));
  paths.get(id).setAttribute('opacity',id===zone.id?'1':'.42');
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
   const image=element('img',null,tile);
   image.src=new URL('../../'+enemy.asset,import.meta.url);
   image.alt='';
   element('span',enemy.name,tile);
  }
 }
}
select(FIELD_ENCOUNTER_PLAN.find(zone=>zone.id==='bridge'));
