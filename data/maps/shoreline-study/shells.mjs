// Beachcombing prototype. Real saved battle battles, not time or random re-rolls,
// unlock shell batches once after each FIVE completed battles.
import {TILE,WIDTH,HEIGHT,MAP,SHORE_Y,SCENERY,START} from './scene.mjs';

export const SHELL_SAVE_KEY='kikokuno-hanamusubi-preview-shoreline-shells-v2';
export const BATTLES_PER_SHELL_BATCH=5;
export const SHELL_BATCH_MIN=1;
export const SHELL_BATCH_MAX=3;
export const SHELL_CAP=12;
export const PICKUP_DISTANCE=36;
export const SHELL_KINDS=Object.freeze({
  sakura:Object.freeze({id:'sakura',name:'桜貝',value:12,weight:0.17}),
  spiral:Object.freeze({id:'spiral',name:'巻貝',value:7,weight:0.30}),
  white:Object.freeze({id:'white',name:'白貝',value:3,weight:0.53})
});
// Fixed, carefully spaced sandy pickup points. ONLY the COUNT (1–3) and
// variety are random per five battles; positions do not reroll.
const SITE_COLUMNS=Object.freeze([
  [3,2,3,4],[5,2,-4,1],[7,2,4,2],[9,3,-3,-4],
  [11,2,4,2],[13,3,0,-2],[15,2,-4,0],[17,2,3,1],
  [19,2,-3,-2],[21,3,2,-3],[23,2,-2,1],[25,2,3,-2],
  [27,2,-3,1],[4,3,1,0],[12,3,-3,-2],[20,3,4,2]
]);
export const SHELL_SITES=Object.freeze(SITE_COLUMNS.map(([tx,dy,dx,oy],i)=>
  Object.freeze({id:'spot-'+i,x:tx*TILE+16+dx,y:(SHORE_Y[tx]+dy)*TILE+16+oy})
));
const dist=(x,y,px,py)=>Math.hypot(x-px,y-py);
const validBattles=n=>Number.isSafeInteger(n)&&n>=0?Math.min(n,1000000):0;
const rng=seed=>{
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6D2B79F5)>>>0;
    let t=Math.imul(state^(state>>>15),1|state);
    t^=t+Math.imul(t^(t>>>7),61|t);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
};
const kindFor=number=>number<.17?'sakura':number<.47?'spiral':'white';
const shellRecord=(value)=>{
  if(!value||typeof value!=='object'||typeof value.id!=='string'||
    !/^shell-[1-9]\d*-[0-2]$/.test(value.id)||
    !Object.hasOwn(SHELL_KINDS,value.kind)||
    !Number.isInteger(value.site)||value.site<0||value.site>=SHELL_SITES.length)return null;
  const site=SHELL_SITES[value.site];
  return Object.freeze({id:value.id,kind:value.kind,site:value.site,x:site.x,y:site.y});
};
export const emptyBag=()=>({sakura:0,spiral:0,white:0});
export function initialShellState(battles=0){
  battles=validBattles(battles);
  // Existing saved games should not receive years of retroactive payouts.
  // If the first visit falls on the 5th battle, that batch is awarded.
  const processedCycles=Math.floor(Math.max(0,battles-1)/BATTLES_PER_SHELL_BATCH);
  return {version:2,lastBattles:battles,processedCycles,onBeach:[],picked:[],sold:[],gold:0,bag:emptyBag()};
}
export function normalizeShellState(value,currentBattles=0){
  if(!value||value.version!==2)return initialShellState(currentBattles);
  const lastBattles=validBattles(value.lastBattles);
  const processedCycles=validBattles(value.processedCycles);
  const onBeach=(Array.isArray(value.onBeach)?value.onBeach:[])
    .map(shellRecord).filter(Boolean).slice(0,SHELL_CAP);
  const seen=new Set(),sites=new Set();
  const unique=onBeach.filter(shell=>{
    if(seen.has(shell.id)||sites.has(shell.site))return false;
    seen.add(shell.id);sites.add(shell.site);return true;
  });
  const picked=Array.isArray(value.picked)?
    value.picked.map(shellRecord).filter(Boolean):[];
  const collected=[],ids=new Set();
  for(const shell of picked){
    if(ids.has(shell.id)||seen.has(shell.id))continue;
    ids.add(shell.id);collected.push(shell);
  }
  const sold=Array.isArray(value.sold)?
    [...new Set(value.sold.filter(id=>ids.has(id)))]:[];
  const bag=emptyBag(),soldSet=new Set(sold);
  for(const shell of collected)if(!soldSet.has(shell.id))bag[shell.kind]++;
  const gold=Number.isSafeInteger(value.gold)&&value.gold>=0?
    Math.min(value.gold,999999):0;
  return {version:2,lastBattles,processedCycles,onBeach:unique,picked:collected,sold,bag,gold};
}
export function batchCount(cycle){
  const random=rng((cycle*0x9e3779b1)^0xBEEFA416);
  return SHELL_BATCH_MIN+Math.floor(random()*(SHELL_BATCH_MAX-SHELL_BATCH_MIN+1));
}
export function syncBattleShells(value,battles){
  battles=validBattles(battles);
  const original=normalizeShellState(value,battles);
  if(battles<original.lastBattles){
    // A new game / older save must not carry another character's findings.
    return {state:initialShellState(battles),spawned:0,reset:true};
  }
  let onBeach=[...original.onBeach],spawned=0;
  const target=Math.floor(battles/BATTLES_PER_SHELL_BATCH);
  const first=original.processedCycles+1;
  for(let cycle=first;cycle<=target&&onBeach.length<SHELL_CAP;cycle++){
    const random=rng((cycle*0x9e3779b1)^0xBEEFA416);
    const count=SHELL_BATCH_MIN+
      Math.floor(random()*(SHELL_BATCH_MAX-SHELL_BATCH_MIN+1));
    for(let i=0;i<count&&onBeach.length<SHELL_CAP;i++){
      // Deterministic rotation through fixed points; never randomly placed.
      const used=new Set(onBeach.map(shell=>shell.site));
      const candidateOrder=Array.from({length:SHELL_SITES.length},(_,j)=>
        (cycle*3+j)%SHELL_SITES.length);
      const site=candidateOrder.find(index=>!used.has(index));
      if(site===undefined)break;
      const kind=kindFor(random());
      onBeach.push(Object.freeze({
        id:'shell-'+cycle+'-'+i,kind,site,
        x:SHELL_SITES[site].x,y:SHELL_SITES[site].y
      }));
      spawned++;
    }
  }
  const next=normalizeShellState({
    ...original,onBeach,lastBattles:battles,processedCycles:Math.max(target,original.processedCycles)
  },battles);
  return {state:next,spawned,reset:false};
}
export function visibleShells(state){
  return normalizeShellState(state).onBeach;
}
export function nearestShell(state,x,y,radius=PICKUP_DISTANCE){
  return visibleShells(state).filter(shell=>dist(shell.x,shell.y,x,y)<=radius)
    .sort((a,b)=>dist(a.x,a.y,x,y)-dist(b.x,b.y,x,y))[0]??null;
}
export function gatherShell(state,id,x,y){
  const current=normalizeShellState(state);
  const shell=current.onBeach.find(item=>item.id===id);
  if(!shell||!Number.isFinite(x)||!Number.isFinite(y)||
     dist(shell.x,shell.y,x,y)>PICKUP_DISTANCE)
    return {accepted:false,state:current,message:'貝殻に近づいてください。'};
  const next=normalizeShellState({
    ...current,
    onBeach:current.onBeach.filter(item=>item.id!==id),
    picked:[...current.picked,shell]
  });
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
    ...current,sold:current.picked.map(shell=>shell.id),
    gold:Math.min(999999,current.gold+amount)
  });
  return {accepted:true,state:next,amount,
    message:'貝殻を売って '+amount+'両を受け取った。（試作）'};
}
// Validate the authored fixed pickup spots before browser rendering.
export function validateShellSites(){
  const errors=[];
  for(const [i,spot] of SHELL_SITES.entries()){
    const tx=Math.floor(spot.x/TILE),ty=Math.floor(spot.y/TILE);
    if(tx<1||tx>=WIDTH-1||ty<SHORE_Y[tx]+1||ty>=HEIGHT-1||
       MAP[ty]?.[tx]!=='sand')errors.push('shell is not on dry sand: '+i);
    if(dist(spot.x,spot.y,START.x,START.y)<28)
      errors.push('shell is at character spawn: '+i);
    if(SCENERY.some(rock=>dist(spot.x,spot.y,rock.x,rock.y)<34))
      errors.push('shell is buried in a rock: '+i);
  }
  for(let i=0;i<SHELL_SITES.length;i++)
    for(let j=i+1;j<SHELL_SITES.length;j++)
      if(dist(SHELL_SITES[i].x,SHELL_SITES[i].y,
        SHELL_SITES[j].x,SHELL_SITES[j].y)<32)
        errors.push('shell pickup sites overlap: '+i+','+j);
  return errors;
}
