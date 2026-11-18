// Production sea-cove shell sites and persistent player satchel.
// Sites follow the accepted shoreline-study on the sea-north cove.
import {COVE_MAP,tileAt} from './scene.mjs';
import {SHELL_SITES} from '../shoreline-study/shells.mjs';
import {
 SHELL_KINDS,BATTLES_PER_SHELL_BATCH,SHELL_CAP,SHELL_PICKUP_DISTANCE,
 emptyShellBag,shellBagCount,shellBagValue,
 shellCycleRandom,shellBatchCount,shellKindFromRoll
} from '../../../src/game/items/shells.mjs';

const TILE=COVE_MAP.tileSize;
// Preserve the approved study's fixed collection sites, not a second
// layout located along the wrong (eastern) edge of the cove.
export const COVE_SHELL_SITES=Object.freeze(SHELL_SITES.map((site,index)=>
 Object.freeze({id:'cove-shell-site-'+index,
   cell:[Math.floor(site.x/TILE),Math.floor(site.y/TILE)],
   x:site.x,y:site.y})
));
const number=n=>Number.isSafeInteger(n)&&n>=0?Math.min(n,1000000):0;
const nearby=(a,b,x,y)=>Math.hypot(a-x,b-y);
const storedShell=shell=>{
 if(!shell||typeof shell!=='object'||!Object.hasOwn(SHELL_KINDS,shell.kind)
   ||typeof shell.id!=='string'||!/^cove-[1-9]\d*-[0-2]$/.test(shell.id)
   ||!Number.isInteger(shell.site)||!COVE_SHELL_SITES[shell.site])return null;
 return {id:shell.id,kind:shell.kind,site:shell.site};
};
const fullShell=shell=>({...shell,x:COVE_SHELL_SITES[shell.site].x,
 y:COVE_SHELL_SITES[shell.site].y});
export const initialCoveShells=completedBattles=>({
 lastBattles:number(completedBattles),
 // Existing saves must not receive retroactive money for old combat totals.
 processedCycles:Math.floor(number(completedBattles)/BATTLES_PER_SHELL_BATCH),
 onBeach:[],bag:emptyShellBag()
});
export function normalizeCoveShells(value,completedBattles=0){
 const total=number(completedBattles);
 if(!value||typeof value!=='object'
    ||number(value.lastBattles)>total)return initialCoveShells(total);
 const seenId=new Set(),seenSite=new Set(),onBeach=[];
 for(const entry of (Array.isArray(value.onBeach)?value.onBeach:[])){
  const shell=storedShell(entry);if(!shell)continue;
  if(seenId.has(shell.id)||seenSite.has(shell.site))continue;
  seenId.add(shell.id);seenSite.add(shell.site);
  onBeach.push(shell);
  if(onBeach.length===SHELL_CAP)break;
 }
 const bag=emptyShellBag();
 for(const kind of Object.keys(SHELL_KINDS))
  bag[kind]=Math.min(99,number(value.bag?.[kind]));
 const lastBattles=number(value.lastBattles);
 let processedCycles=Math.min(number(value.processedCycles),Math.floor(total/BATTLES_PER_SHELL_BATCH));
 const target=Math.floor(total/BATTLES_PER_SHELL_BATCH);
 // If a saved state jumps forward across many fights, process the newest
 // bounded set of cycles; avoid O(untrusted number of wins) work.
 const first=Math.max(processedCycles+1,target-40);
 for(let cycle=first;cycle<=target&&onBeach.length<SHELL_CAP;cycle++){
  const random=shellCycleRandom(cycle);
  const count=shellBatchCount(cycle);
  random(); // the shared first roll determines this batch's quantity
  for(let i=0;i<count&&onBeach.length<SHELL_CAP;i++){
   const occupied=new Set(onBeach.map(shell=>shell.site));
   const order=COVE_SHELL_SITES.map((_,index)=>
     (cycle*3+index)%COVE_SHELL_SITES.length);
   const site=order.find(index=>!occupied.has(index));
   if(site===undefined)break;
   onBeach.push({id:'cove-'+cycle+'-'+i,
     kind:shellKindFromRoll(random()),site});
  }
 }
 processedCycles=target;
 return {lastBattles:total,processedCycles,onBeach,bag};
}
export const coveVisibleShells=player=>
 normalizeCoveShells(player?.shells,player?.completedBattles).onBeach.map(fullShell);
export function nearestCoveShell(player,x,y,distance=SHELL_PICKUP_DISTANCE){
 return coveVisibleShells(player)
 .filter(item=>nearby(item.x,item.y,x,y)<=distance)
 .sort((a,b)=>nearby(a.x,a.y,x,y)-nearby(b.x,b.y,x,y))[0]??null;
}
export function collectCoveShell(player,id,x,y){
 const state=normalizeCoveShells(player?.shells,player?.completedBattles);
 const shell=state.onBeach.find(shell=>shell.id===id);
 if(!shell||!Number.isFinite(x)||!Number.isFinite(y))
  return {accepted:false,player,message:'貝殻に近づいてください。'};
 const point=COVE_SHELL_SITES[shell.site];
 if(nearby(point.x,point.y,x,y)>SHELL_PICKUP_DISTANCE)
  return {accepted:false,player,message:'貝殻に近づいてください。'};
 if(shellBagCount(state.bag)>=99)return {accepted:false,player,message:'貝殻をもう持ちきれない。'};
 const bag={...state.bag,[shell.kind]:state.bag[shell.kind]+1};
 return {accepted:true,player:{...player,shells:{...state,bag,
   onBeach:state.onBeach.filter(item=>item.id!==shell.id)}},
  message:SHELL_KINDS[shell.kind].name+'を拾った。'};
}
export function sellCoveShells(player){
 const state=normalizeCoveShells(player?.shells,player?.completedBattles);
 const amount=shellBagValue(state.bag);
 if(!amount)return {accepted:false,player,message:'売れる貝殻はないようだ。',amount:0};
 const current=number(player?.gold);
 return {accepted:true,player:{...player,gold:Math.min(999999,current+amount),
  shells:{...state,bag:emptyShellBag()}},amount,
  message:'貝殻を売り、'+amount+'両を手に入れた。'};
}
export function validateCoveShellSites(){
 const issues=[];
 for(const [i,site] of COVE_SHELL_SITES.entries()){
  if(tileAt(...site.cell)!=='s')issues.push('not sand: '+i);
  const fisher=COVE_MAP.fisher;
  if(nearby(site.x,site.y,fisher.x,fisher.y)<40)issues.push('near fisher: '+i);
  for(const other of COVE_MAP.objects.filter(o=>['basket','barrel'].includes(o.kind))){
   if(nearby(site.x,site.y,other.x*TILE+16,(other.y+1)*TILE-10)<32)
    issues.push('near blocking prop: '+i);
  }
  for(let j=i+1;j<COVE_SHELL_SITES.length;j++){
   const a=COVE_SHELL_SITES[j];
   if(nearby(site.x,site.y,a.x,a.y)<32)issues.push('overlap: '+i+','+j);
  }
 }
 return issues;
}
