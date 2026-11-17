// Trial beachcombing data for shoreline-study ONLY. Production economy
// and village shop stock are intentionally unchanged until scenery review.
import {TILE,WIDTH,HEIGHT,MAP,SHORE_Y,SCENERY,START} from './scene.mjs';

export const SHELL_SAVE_KEY='kikokuno-hanamusubi-preview-shoreline-shells-v1';
export const SHELL_KINDS=Object.freeze({
  sakura:Object.freeze({id:'sakura',name:'桜貝',value:12,weight:0.17}),
  spiral:Object.freeze({id:'spiral',name:'巻貝',value:7,weight:0.30}),
  white:Object.freeze({id:'white',name:'白貝',value:3,weight:0.53})
});
export const SHELL_COUNT=14;
export const PICKUP_DISTANCE=36;

const rng=seed=>{
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6D2B79F5)>>>0;
    let t=Math.imul(state^(state>>>15),1|state);
    t^=t+Math.imul(t^(t>>>7),61|t);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
};
const dist=(x,y,px,py)=>Math.hypot(x-px,y-py);
export function generateShells(seed){
  const random=rng(seed>>>0),result=[];
  // Only sandy terrain, past the furthest wave wash. No arbitrary grid-centre
  // columns, and no freshly appearing shells while the camera is moving.
  for(let tries=0;tries<600&&result.length<SHELL_COUNT;tries++){
    const tx=2+Math.floor(random()*(WIDTH-4));
    const row=SHORE_Y[tx]+1+Math.floor(random()*Math.min(4,HEIGHT-SHORE_Y[tx]-3));
    if(row>=HEIGHT-2||MAP[row]?.[tx]!=='sand')continue;
    const x=tx*TILE+Math.floor(5+random()*23);
    const y=row*TILE+Math.floor(7+random()*19);
    if(dist(x,y,START.x,START.y)<28)continue;
    if(SCENERY.some(rock=>dist(x,y,rock.x,rock.y)<34))continue;
    if(result.some(item=>dist(x,y,item.x,item.y)<32))continue;
    const draw=random();
    const kind=draw<.17?'sakura':draw<.47?'spiral':'white';
    result.push(Object.freeze({id:'shell-'+result.length,kind,x,y}));
  }
  return Object.freeze(result);
}
export const emptyBag=()=>({sakura:0,spiral:0,white:0});
export function normalizeShellState(value,fallbackSeed=0){
  const input=value&&typeof value==='object'?value:{};
  const seed=Number.isInteger(input.seed)&&input.seed>=0&&input.seed<=0xffffffff?
    input.seed>>>0:fallbackSeed>>>0;
  const availableIds=new Set(generateShells(seed).map(item=>item.id));
  const picked=Array.isArray(input.picked)?
    [...new Set(input.picked.filter(id=>availableIds.has(id)))]:[];
  // A bag is derived only from actually gathered shells so reload cannot
  // create items from arbitrary localStorage counts.
  const bag=emptyBag();
  const sold=Array.isArray(input.sold)?
    [...new Set(input.sold.filter(id=>picked.includes(id)))]:[];
  const byId=new Map(generateShells(seed).map(item=>[item.id,item]));
  for(const id of picked){
    if(!sold.includes(id))bag[byId.get(id).kind]++;
  }
  const gold=Number.isSafeInteger(input.gold)&&input.gold>=0?Math.min(input.gold,999999):0;
  return {seed,picked,sold,bag,gold};
}
export function visibleShells(state){
  const normalized=normalizeShellState(state);
  const collected=new Set(normalized.picked);
  return generateShells(normalized.seed).filter(shell=>!collected.has(shell.id));
}
export function nearestShell(state,x,y,radius=PICKUP_DISTANCE){
  return visibleShells(state).filter(shell=>dist(shell.x,shell.y,x,y)<=radius)
    .sort((a,b)=>dist(a.x,a.y,x,y)-dist(b.x,b.y,x,y))[0]??null;
}
export function gatherShell(state,id,x,y){
  const current=normalizeShellState(state);
  const shell=visibleShells(current).find(item=>item.id===id);
  if(!shell||!Number.isFinite(x)||!Number.isFinite(y)||
     dist(shell.x,shell.y,x,y)>PICKUP_DISTANCE)
    return {accepted:false,state:current,message:'貝殻に近づいてください。'};
  const next=normalizeShellState({...current,picked:[...current.picked,id]});
  return {accepted:true,state:next,shell,
    message:SHELL_KINDS[shell.kind].name+'を拾った。'};
}
export function bagValue(state){
  const bag=normalizeShellState(state).bag;
  return Object.entries(SHELL_KINDS)
    .reduce((sum,[kind,item])=>sum+bag[kind]*item.value,0);
}
export function sellAllShells(state){
  const current=normalizeShellState(state),amount=bagValue(current);
  if(!amount)return {accepted:false,state:current,amount:0,message:'売れる貝殻を持っていません。'};
  const next=normalizeShellState({
    ...current,sold:current.picked,gold:Math.min(999999,current.gold+amount)
  });
  return {accepted:true,state:next,amount,
    message:'貝殻を売って '+amount+'両を受け取った。'};
}
